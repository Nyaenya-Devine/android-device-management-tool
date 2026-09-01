import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { enterprises, policies, enrollmentTokens, auditLogs } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { ensureEnterpriseInitialized } from "@/lib/db-seed";
import {
  buildCloudDpcQrBundle,
  generateQrDataUrl,
  generateQrSvg,
  fetchGoogleAccessToken,
  callAmapi,
} from "@/lib/amapi/amapi-service";
import { generateEnrollmentTokenString, decryptText } from "@/lib/crypto";
import { AmapiEnrollmentTokenResponse } from "@/lib/types/amapi";

export async function GET() {
  try {
    await ensureEnterpriseInitialized();
    const entList = await db.select().from(enterprises).limit(1);
    if (!entList.length) {
      return NextResponse.json({ error: "Enterprise not initialized" }, { status: 404 });
    }

    const tokens = await db
      .select({
        token: enrollmentTokens,
        policyName: policies.name,
      })
      .from(enrollmentTokens)
      .leftJoin(policies, eq(enrollmentTokens.policyId, policies.id))
      .where(eq(enrollmentTokens.enterpriseId, entList[0].id))
      .orderBy(desc(enrollmentTokens.createdAt));

    // Enrich with QR data URLs
    const enriched = await Promise.all(
      tokens.map(async (item) => {
        const qrDataUrl = await generateQrDataUrl(item.token.qrCodeData);
        return {
          ...item.token,
          policyName: item.policyName || "Default Policy",
          qrDataUrl,
        };
      })
    );

    return NextResponse.json({ tokens: enriched });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch tokens";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureEnterpriseInitialized();
    const entList = await db.select().from(enterprises).limit(1);
    if (!entList.length) {
      return NextResponse.json({ error: "Enterprise not initialized" }, { status: 404 });
    }
    const enterprise = entList[0];

    const body = await req.json();
    const {
      policyId,
      durationDays = 7,
      allowPersonalUsage = "PERSONAL_USAGE_DISALLOWED",
      oneTimeUse = true,
      wifiSsid,
      wifiPassword,
      wifiSecurityType = "WPA",
      additionalData,
    } = body;

    // Verify policy exists
    const [policy] = await db
      .select()
      .from(policies)
      .where(eq(policies.id, policyId))
      .limit(1);

    if (!policy) {
      return NextResponse.json({ error: "Selected policy not found" }, { status: 400 });
    }

    const durationSec = Math.max(3600, Math.min(durationDays * 86400, 86400 * 30));
    const expirationTimestamp = new Date(Date.now() + durationSec * 1000);

    let tokenValue = generateEnrollmentTokenString();
    let googleTokenName = `${enterprise.enterpriseId}/enrollmentTokens/${tokenValue}`;

    // If Enterprise is in LIVE_AMAPI mode and credentials are present, attempt Google AMAPI creation
    if (
      enterprise.mode === "LIVE_AMAPI" &&
      enterprise.serviceAccountEmail &&
      enterprise.serviceAccountPrivateKey
    ) {
      try {
        const privateKey = decryptText(enterprise.serviceAccountPrivateKey);
        const accessToken = await fetchGoogleAccessToken(enterprise.serviceAccountEmail, privateKey);
        const amapiRes = await callAmapi<AmapiEnrollmentTokenResponse>(
          `${enterprise.enterpriseId}/enrollmentTokens`,
          {
            method: "POST",
            accessToken,
            body: {
              policyName: policy.googlePolicyName || `${enterprise.enterpriseId}/policies/${policy.id}`,
              duration: `${durationSec}s`,
              allowPersonalUsage,
              oneTimeOnly: oneTimeUse,
              additionalData,
            },
          }
        );

        if (amapiRes?.value) {
          tokenValue = amapiRes.value;
          googleTokenName = amapiRes.name || googleTokenName;
        }
      } catch (gErr) {
        console.warn("Live AMAPI token call failed, falling back to local spec generation:", gErr);
      }
    }

    // Build official Google CloudDPC QR Provisioning payload
    const qrBundle = buildCloudDpcQrBundle(tokenValue, {
      wifiSsid: wifiSsid || undefined,
      wifiPassword: wifiPassword || undefined,
      wifiSecurityType: wifiSecurityType as "NONE" | "WPA" | "WEP",
      leaveSystemAppsEnabled: true,
    });

    const qrCodeData = JSON.stringify(qrBundle, null, 2);
    const tokenId = `tok-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const [createdToken] = await db
      .insert(enrollmentTokens)
      .values({
        id: tokenId,
        enterpriseId: enterprise.id,
        policyId: policy.id,
        tokenValue,
        googleTokenName,
        qrCodeData,
        allowPersonalUsage,
        durationSec,
        expirationTimestamp,
        oneTimeUse,
        status: "ACTIVE",
        wifiSsid: wifiSsid || null,
        wifiPassword: wifiPassword || null,
        wifiSecurityType: wifiSecurityType || null,
        additionalData: additionalData || null,
      })
      .returning();

    // Log to Audit Log
    await db.insert(auditLogs).values({
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      enterpriseId: enterprise.id,
      actor: "Console Admin",
      action: "ENROLLMENT_TOKEN_CREATED",
      resourceType: "ENROLLMENT_TOKEN",
      resourceId: createdToken.id,
      details: {
        tokenValue,
        policy: policy.name,
        durationDays,
        allowPersonalUsage,
        hasWifiPreset: !!wifiSsid,
      },
      status: "SUCCESS",
    });

    const qrDataUrl = await generateQrDataUrl(qrCodeData);
    const qrSvg = await generateQrSvg(qrCodeData);

    return NextResponse.json({
      success: true,
      token: {
        ...createdToken,
        policyName: policy.name,
        qrDataUrl,
        qrSvg,
        qrBundle,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create enrollment token";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
