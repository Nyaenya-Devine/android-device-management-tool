import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { enterprises, policies, enrollmentTokens, auditLogs } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { ensureEnterpriseInitialized } from "@/lib/db-seed";
import { buildCloudDpcQrBundle, generateQrDataUrl, generateQrSvg, fetchGoogleAccessToken, callAmapi } from "@/lib/amapi/amapi-service";
import { generateEnrollmentTokenString, decryptText } from "@/lib/crypto";
import { AmapiEnrollmentTokenResponse } from "@/lib/types/amapi";
import { authenticateApiRequest } from "@/lib/api-auth";

const MAX_BODY = 16_384;
const VALID_USAGE = ["PERSONAL_USAGE_ALLOWED", "PERSONAL_USAGE_DISALLOWED"] as const;
const VALID_WIFI = ["NONE", "WPA", "WEP"] as const;

function s(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length <= max ? value.trim() : null;
}

export async function GET(req: NextRequest) {
  const identity = authenticateApiRequest(req);
  if (!identity) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (identity.role !== "admin" && identity.role !== "operator") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    await ensureEnterpriseInitialized();
    const entList = await db.select().from(enterprises).limit(1);
    if (!entList.length) return NextResponse.json({ error: "Enterprise not initialized" }, { status: 404 });

    const tokens = await db.select({ token: enrollmentTokens, policyName: policies.name })
      .from(enrollmentTokens)
      .leftJoin(policies, eq(enrollmentTokens.policyId, policies.id))
      .where(eq(enrollmentTokens.enterpriseId, entList[0].id))
      .orderBy(desc(enrollmentTokens.createdAt));

    const enriched = await Promise.all(tokens.map(async (item) => ({
      ...item.token,
      policyName: item.policyName || "Default Policy",
      qrDataUrl: await generateQrDataUrl(item.token.qrCodeData),
    })));

    return NextResponse.json({ tokens: enriched }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to fetch tokens" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const identity = authenticateApiRequest(req);
  if (!identity) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (identity.role !== "admin" && identity.role !== "operator") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    await ensureEnterpriseInitialized();
    const entList = await db.select().from(enterprises).limit(1);
    if (!entList.length) return NextResponse.json({ error: "Enterprise not initialized" }, { status: 404 });
    const enterprise = entList[0];

    const rawBody = await req.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY) return NextResponse.json({ error: "Request payload too large" }, { status: 413 });
    let body: Record<string, unknown>;
    try {
      const parsed = JSON.parse(rawBody);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const policyId = s(body.policyId, 200);
    const durationDays = body.durationDays == null ? 7 : body.durationDays;
    const allowPersonalUsage = body.allowPersonalUsage == null ? "PERSONAL_USAGE_DISALLOWED" : s(body.allowPersonalUsage, 40);
    const oneTimeUse = body.oneTimeUse == null ? true : body.oneTimeUse;
    const wifiSsid = body.wifiSsid == null ? null : s(body.wifiSsid, 128);
    const wifiPassword = body.wifiPassword == null ? null : s(body.wifiPassword, 256);
    const wifiSecurityType = body.wifiSecurityType == null ? "WPA" : s(body.wifiSecurityType, 8);
    const additionalData = body.additionalData == null ? null : s(body.additionalData, 2048);

    if (!policyId || !allowPersonalUsage || !VALID_USAGE.includes(allowPersonalUsage as typeof VALID_USAGE[number]) ||
        typeof oneTimeUse !== "boolean" || !Number.isInteger(durationDays) || (durationDays as number) < 1 || (durationDays as number) > 30 ||
        !wifiSecurityType || !VALID_WIFI.includes(wifiSecurityType as typeof VALID_WIFI[number]) ||
        (wifiSsid !== null && wifiSsid.length === 0) || (wifiPassword !== null && wifiPassword.length === 0)) {
      return NextResponse.json({ error: "Invalid enrollment token parameters" }, { status: 400 });
    }
    if (wifiSecurityType !== "NONE" && wifiSsid && !wifiPassword) {
      return NextResponse.json({ error: "Wi-Fi password required for secured Wi-Fi" }, { status: 400 });
    }

    const [policy] = await db.select().from(policies)
      .where(and(eq(policies.id, policyId), eq(policies.enterpriseId, enterprise.id))).limit(1);
    if (!policy) return NextResponse.json({ error: "Selected policy not found" }, { status: 400 });

    const durationSec = Math.min((durationDays as number) * 86400, 86400 * 30);
    const expirationTimestamp = new Date(Date.now() + durationSec * 1000);
    let tokenValue = generateEnrollmentTokenString();
    let googleTokenName = `${enterprise.enterpriseId}/enrollmentTokens/${tokenValue}`;

    if (enterprise.mode === "LIVE_AMAPI") {
      // Live mode never falls back to a local token: that could create a token that Google does not recognize.
      if (!enterprise.serviceAccountEmail || !enterprise.serviceAccountPrivateKey) {
        return NextResponse.json({ error: "Live enrollment blocked: AMAPI credentials are incomplete" }, { status: 503 });
      }
      try {
        const privateKey = decryptText(enterprise.serviceAccountPrivateKey);
        const accessToken = await fetchGoogleAccessToken(enterprise.serviceAccountEmail, privateKey);
        const amapiRes = await callAmapi<AmapiEnrollmentTokenResponse>(`${enterprise.enterpriseId}/enrollmentTokens`, {
          method: "POST", accessToken,
          body: {
            policyName: policy.googlePolicyName || `${enterprise.enterpriseId}/policies/${policy.id}`,
            duration: `${durationSec}s`, allowPersonalUsage, oneTimeOnly: oneTimeUse, additionalData,
          },
        });
        if (!amapiRes?.value) throw new Error("Google AMAPI did not return an enrollment token");
        tokenValue = amapiRes.value;
        googleTokenName = amapiRes.name || googleTokenName;
      } catch {
        await db.insert(auditLogs).values({
          id: `log-${crypto.randomUUID()}`, enterpriseId: enterprise.id, actor: identity.actor,
          action: "ENROLLMENT_TOKEN_CREATE_BLOCKED", resourceType: "ENROLLMENT_TOKEN", resourceId: null,
          details: { reason: "Google AMAPI token creation failed", policyId }, status: "FAILURE",
        });
        return NextResponse.json({ error: "Live enrollment token creation failed" }, { status: 502 });
      }
    }

    const qrBundle = buildCloudDpcQrBundle(tokenValue, {
      wifiSsid: wifiSsid || undefined,
      wifiPassword: wifiPassword || undefined,
      wifiSecurityType: wifiSecurityType as "NONE" | "WPA" | "WEP",
      leaveSystemAppsEnabled: true,
    });
    const qrCodeData = JSON.stringify(qrBundle, null, 2);
    const tokenId = `tok-${crypto.randomUUID()}`;

    const [createdToken] = await db.insert(enrollmentTokens).values({
      id: tokenId, enterpriseId: enterprise.id, policyId: policy.id, tokenValue, googleTokenName,
      qrCodeData, allowPersonalUsage, durationSec, expirationTimestamp, oneTimeUse, status: "ACTIVE",
      wifiSsid: wifiSsid || null, wifiPassword: wifiPassword || null, wifiSecurityType: wifiSecurityType || null,
      additionalData: additionalData || null,
    }).returning();

    // Never place the enrollment credential itself in the audit log.
    await db.insert(auditLogs).values({
      id: `log-${crypto.randomUUID()}`, enterpriseId: enterprise.id, actor: identity.actor,
      action: "ENROLLMENT_TOKEN_CREATED", resourceType: "ENROLLMENT_TOKEN", resourceId: createdToken.id,
      details: { policy: policy.name, durationDays, allowPersonalUsage, hasWifiPreset: !!wifiSsid }, status: "SUCCESS",
    });

    const qrDataUrl = await generateQrDataUrl(qrCodeData);
    const qrSvg = await generateQrSvg(qrCodeData);
    return NextResponse.json({
      success: true,
      token: { ...createdToken, policyName: policy.name, qrDataUrl, qrSvg, qrBundle },
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to create enrollment token" }, { status: 500 });
  }
}
