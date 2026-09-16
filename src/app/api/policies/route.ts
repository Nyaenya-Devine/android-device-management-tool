import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { policies, enterprises, devices, auditLogs } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { ensureEnterpriseInitialized } from "@/lib/db-seed";
import { fetchGoogleAccessToken, callAmapi, createDefaultAmapiPolicy } from "@/lib/amapi/amapi-service";
import { decryptText } from "@/lib/crypto";
import { authenticateApiRequest } from "@/lib/api-auth";

const MAX_BODY = 64_000;
const MAX_NAME = 120;
const MAX_DESCRIPTION = 1000;

export async function GET(req: NextRequest) {
  const identity = authenticateApiRequest(req);
  if (!identity) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  try {
    await ensureEnterpriseInitialized();
    const entList = await db.select().from(enterprises).limit(1);
    if (!entList.length) return NextResponse.json({ error: "Enterprise not initialized" }, { status: 404 });
    const enterprise = entList[0];
    const policyRows = await db.select({
      policy: policies,
      deviceCount: sql<number>`(SELECT count(*) FROM devices WHERE devices.applied_policy_id = policies.id)`,
    }).from(policies).where(eq(policies.enterpriseId, enterprise.id)).orderBy(desc(policies.isDefault), desc(policies.updatedAt));
    return NextResponse.json({ policies: policyRows.map(r => ({ ...r.policy, deviceCount: Number(r.deviceCount || 0) })) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to fetch policies" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const identity = authenticateApiRequest(req);
  if (!identity) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (identity.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description = body.description == null ? null : typeof body.description === "string" ? body.description.trim() : "__invalid__";
    const isDefault = body.isDefault == null ? false : body.isDefault;
    const policyJson = body.policyJson;
    if (!name || name.length > MAX_NAME || description === "__invalid__" || (description && description.length > MAX_DESCRIPTION) || typeof isDefault !== "boolean") {
      return NextResponse.json({ error: "Invalid policy fields" }, { status: 400 });
    }
    if (policyJson !== undefined && (!policyJson || typeof policyJson !== "object" || Array.isArray(policyJson))) {
      return NextResponse.json({ error: "Policy definition must be a JSON object" }, { status: 400 });
    }

    const policyId = `pol-${crypto.randomUUID()}`;
    const googlePolicyName = `${enterprise.enterpriseId}/policies/${policyId}`;
    const policyDefinition = policyJson || createDefaultAmapiPolicy(name);
    const serializedPolicy = JSON.stringify(policyDefinition);
    if (serializedPolicy.length > MAX_BODY) return NextResponse.json({ error: "Policy definition too large" }, { status: 413 });

    // In live mode, never create a local policy after Google rejected the update.
    if (enterprise.mode === "LIVE_AMAPI") {
      if (!enterprise.serviceAccountEmail || !enterprise.serviceAccountPrivateKey) {
        return NextResponse.json({ error: "Live policy creation blocked: AMAPI credentials are incomplete" }, { status: 503 });
      }
      try {
        const privateKey = decryptText(enterprise.serviceAccountPrivateKey);
        const accessToken = await fetchGoogleAccessToken(enterprise.serviceAccountEmail, privateKey);
        await callAmapi(googlePolicyName, { method: "PATCH", accessToken, body: policyDefinition });
      } catch {
        await db.insert(auditLogs).values({
          id: `log-${crypto.randomUUID()}`, enterpriseId: enterprise.id, actor: identity.actor,
          action: "POLICY_CREATE_BLOCKED", resourceType: "POLICY", resourceId: policyId,
          details: { reason: "Google AMAPI policy update failed", name }, status: "FAILURE",
        });
        return NextResponse.json({ error: "Live policy creation failed" }, { status: 502 });
      }
    }

    // Keep default-policy state consistent with the selected enterprise.
    if (isDefault) await db.update(policies).set({ isDefault: false }).where(eq(policies.enterpriseId, enterprise.id));

    const [created] = await db.insert(policies).values({
      id: policyId, enterpriseId: enterprise.id, name, googlePolicyName,
      description: description || null, version: 1, isDefault, policyJson: policyDefinition,
    }).returning();

    await db.insert(auditLogs).values({
      id: `log-${crypto.randomUUID()}`, enterpriseId: enterprise.id, actor: identity.actor,
      action: "POLICY_CREATED", resourceType: "POLICY", resourceId: created.id,
      details: { name: created.name, googlePolicyName }, status: "SUCCESS",
    });
    return NextResponse.json({ success: true, policy: created }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to create policy" }, { status: 500 });
  }
}
