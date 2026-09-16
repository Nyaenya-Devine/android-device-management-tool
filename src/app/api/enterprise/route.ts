import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { enterprises, devices, policies, enrollmentTokens } from "@/db/schema";
import { ensureEnterpriseInitialized } from "@/lib/db-seed";
import { eq, sql } from "drizzle-orm";
import { fetchGoogleAccessToken, callAmapi } from "@/lib/amapi/amapi-service";
import { encryptText, decryptText } from "@/lib/crypto";
import { authenticateApiRequest } from "@/lib/api-auth";

const MAX_BODY = 32_000;

export async function GET(req: NextRequest) {
  if (!authenticateApiRequest(req)) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  try {
    await ensureEnterpriseInitialized();
    const entList = await db.select().from(enterprises).limit(1);
    if (!entList.length) return NextResponse.json({ error: "Enterprise not initialized" }, { status: 404 });
    const ent = entList[0];
    const [deviceCount] = await db.select({ count: sql<number>`count(*)` }).from(devices).where(eq(devices.enterpriseId, ent.id));
    const [policyCount] = await db.select({ count: sql<number>`count(*)` }).from(policies).where(eq(policies.enterpriseId, ent.id));
    const [tokenCount] = await db.select({ count: sql<number>`count(*)` }).from(enrollmentTokens).where(eq(enrollmentTokens.enterpriseId, ent.id));
    const [compliantCount] = await db.select({ count: sql<number>`count(*)` }).from(devices).where(sql`${devices.enterpriseId} = ${ent.id} AND ${devices.isCompliant} = true`);
    return NextResponse.json({
      enterprise: {
        id: ent.id, enterpriseId: ent.enterpriseId, name: ent.name, mode: ent.mode,
        gcpProjectId: ent.gcpProjectId, serviceAccountEmail: ent.serviceAccountEmail,
        hasPrivateKey: !!ent.serviceAccountPrivateKey, pubsubTopic: ent.pubsubTopic,
        pubsubSubscription: ent.pubsubSubscription, status: ent.status, createdAt: ent.createdAt, updatedAt: ent.updatedAt,
      },
      stats: { totalDevices: Number(deviceCount?.count || 0), compliantDevices: Number(compliantCount?.count || 0), totalPolicies: Number(policyCount?.count || 0), totalTokens: Number(tokenCount?.count || 0) },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const identity = authenticateApiRequest(req);
  if (!identity) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (identity.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const rawBody = await req.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY) return NextResponse.json({ error: "Request payload too large" }, { status: 413 });
    let body: Record<string, unknown>;
    try { const parsed = JSON.parse(rawBody); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(); body = parsed as Record<string, unknown>; }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const entList = await db.select().from(enterprises).limit(1);
    if (!entList.length) return NextResponse.json({ error: "Enterprise not found" }, { status: 404 });
    const ent = entList[0];
    const allowed = ["name", "enterpriseId", "mode", "gcpProjectId", "serviceAccountEmail", "serviceAccountPrivateKey", "pubsubTopic", "pubsubSubscription"];
    if (Object.keys(body).some(k => !allowed.includes(k))) return NextResponse.json({ error: "Unsupported update field" }, { status: 400 });
    const updateData: Partial<typeof enterprises.$inferInsert> = { updatedAt: new Date() };

    if (body.name !== undefined) { if (typeof body.name !== "string" || !body.name.trim() || body.name.length > 160) return NextResponse.json({ error: "Invalid enterprise name" }, { status: 400 }); updateData.name = body.name.trim(); }
    if (body.enterpriseId !== undefined) { if (typeof body.enterpriseId !== "string" || !/^enterprises\/[A-Za-z0-9_-]+$/.test(body.enterpriseId.trim())) return NextResponse.json({ error: "Invalid enterprise ID" }, { status: 400 }); updateData.enterpriseId = body.enterpriseId.trim(); }
    if (body.mode !== undefined) { if (body.mode !== "LIVE_AMAPI" && body.mode !== "SANDBOX") return NextResponse.json({ error: "Invalid enterprise mode" }, { status: 400 }); updateData.mode = body.mode; }
    if (body.gcpProjectId !== undefined) { if (body.gcpProjectId !== null && (typeof body.gcpProjectId !== "string" || body.gcpProjectId.length > 200)) return NextResponse.json({ error: "Invalid GCP project ID" }, { status: 400 }); updateData.gcpProjectId = typeof body.gcpProjectId === "string" ? body.gcpProjectId.trim() || null : null; }
    if (body.serviceAccountEmail !== undefined) { if (body.serviceAccountEmail !== null && (typeof body.serviceAccountEmail !== "string" || body.serviceAccountEmail.length > 320 || !body.serviceAccountEmail.includes("@"))) return NextResponse.json({ error: "Invalid service account email" }, { status: 400 }); updateData.serviceAccountEmail = typeof body.serviceAccountEmail === "string" ? body.serviceAccountEmail.trim() || null : null; }
    if (body.serviceAccountPrivateKey !== undefined) { if (typeof body.serviceAccountPrivateKey !== "string" || body.serviceAccountPrivateKey.length < 32 || body.serviceAccountPrivateKey.length > 16_000) return NextResponse.json({ error: "Invalid private key" }, { status: 400 }); updateData.serviceAccountPrivateKey = encryptText(body.serviceAccountPrivateKey.trim()); }
    if (body.pubsubTopic !== undefined) { if (body.pubsubTopic !== null && (typeof body.pubsubTopic !== "string" || body.pubsubTopic.length > 500)) return NextResponse.json({ error: "Invalid Pub/Sub topic" }, { status: 400 }); updateData.pubsubTopic = typeof body.pubsubTopic === "string" ? body.pubsubTopic.trim() || null : null; }
    if (body.pubsubSubscription !== undefined) { if (body.pubsubSubscription !== null && (typeof body.pubsubSubscription !== "string" || body.pubsubSubscription.length > 500)) return NextResponse.json({ error: "Invalid Pub/Sub subscription" }, { status: 400 }); updateData.pubsubSubscription = typeof body.pubsubSubscription === "string" ? body.pubsubSubscription.trim() || null : null; }

    const [updated] = await db.update(enterprises).set(updateData).where(eq(enterprises.id, ent.id)).returning();
    return NextResponse.json({ success: true, enterprise: {
      id: updated.id, enterpriseId: updated.enterpriseId, name: updated.name, mode: updated.mode,
      gcpProjectId: updated.gcpProjectId, serviceAccountEmail: updated.serviceAccountEmail,
      hasPrivateKey: !!updated.serviceAccountPrivateKey, pubsubTopic: updated.pubsubTopic,
      pubsubSubscription: updated.pubsubSubscription, status: updated.status,
    } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to update enterprise" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const identity = authenticateApiRequest(req);
  if (!identity) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (identity.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const rawBody = await req.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY) return NextResponse.json({ error: "Request payload too large" }, { status: 413 });
    let body: Record<string, unknown> = {};
    try { const parsed = rawBody.trim() ? JSON.parse(rawBody) : {}; if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(); body = parsed as Record<string, unknown>; }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const suppliedEmail = typeof body.serviceAccountEmail === "string" ? body.serviceAccountEmail.trim() : null;
    const suppliedKey = typeof body.serviceAccountPrivateKey === "string" ? body.serviceAccountPrivateKey.trim() : null;
    if ((suppliedEmail && suppliedEmail.length > 320) || (suppliedKey && (suppliedKey.length < 32 || suppliedKey.length > 16_000))) return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });

    const entList = await db.select().from(enterprises).limit(1);
    const stored = entList[0];
    const email = suppliedEmail || stored?.serviceAccountEmail || null;
    const key = suppliedKey || (stored?.serviceAccountPrivateKey ? decryptText(stored.serviceAccountPrivateKey) : null);
    if (!email || !key) return NextResponse.json({ success: false, error: "Service Account Email and Private Key are required." }, { status: 400 });

    const accessToken = await fetchGoogleAccessToken(email, key);
    if (!accessToken) throw new Error("Google OAuth2 returned no access token");
    const targetEnterpriseId = typeof body.enterpriseId === "string" && /^enterprises\/[A-Za-z0-9_-]+$/.test(body.enterpriseId.trim())
      ? body.enterpriseId.trim() : stored?.enterpriseId;
    if (!targetEnterpriseId) return NextResponse.json({ success: false, error: "A valid enterprise ID is required." }, { status: 400 });

    try {
      const amapiDetails = await callAmapi(targetEnterpriseId, { method: "GET", accessToken });
      return NextResponse.json({ success: true, oauthSuccess: true, amapiMessage: "Successfully authenticated with Google Cloud AMAPI and verified Enterprise binding.", enterpriseDetails: amapiDetails }, { headers: { "Cache-Control": "no-store" } });
    } catch {
      // Do not expose the OAuth access token or credential-derived material.
      return NextResponse.json({ success: true, oauthSuccess: true, amapiMessage: "Google OAuth2 authentication succeeded, but the requested enterprise could not be verified." }, { headers: { "Cache-Control": "no-store" } });
    }
  } catch {
    return NextResponse.json({ success: false, error: "Connection test failed" }, { status: 400 });
  }
}
