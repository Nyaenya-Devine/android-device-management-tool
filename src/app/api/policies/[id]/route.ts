import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { policies, enterprises, devices, auditLogs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { fetchGoogleAccessToken, callAmapi } from "@/lib/amapi/amapi-service";
import { decryptText } from "@/lib/crypto";
import { authenticateApiRequest } from "@/lib/api-auth";

const MAX_ID = 200;
const MAX_BODY = 64_000;

function s(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length <= max ? value.trim() : null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!authenticateApiRequest(req)) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  try {
    const { id } = await params;
    if (!id || id.length > MAX_ID) return NextResponse.json({ error: "Invalid policy ID" }, { status: 400 });
    const [policy] = await db.select().from(policies).where(eq(policies.id, id)).limit(1);
    if (!policy) return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    const assignedDevices = await db.select().from(devices).where(eq(devices.appliedPolicyId, id));
    return NextResponse.json({ policy, devices: assignedDevices }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to fetch policy" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const identity = authenticateApiRequest(req);
  if (!identity) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (identity.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;
    if (!id || id.length > MAX_ID) return NextResponse.json({ error: "Invalid policy ID" }, { status: 400 });
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

    const allowedFields = ["name", "description", "policyJson", "isDefault"];
    if (Object.keys(body).some(k => !allowedFields.includes(k))) return NextResponse.json({ error: "Unsupported update field" }, { status: 400 });
    const [policy] = await db.select().from(policies).where(eq(policies.id, id)).limit(1);
    if (!policy) return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    const [enterprise] = await db.select().from(enterprises).where(eq(enterprises.id, policy.enterpriseId)).limit(1);
    if (!enterprise) return NextResponse.json({ error: "Enterprise not found" }, { status: 500 });

    const updateData: Partial<typeof policies.$inferInsert> = { updatedAt: new Date() };
    if (body.name !== undefined) {
      const name = s(body.name, 120);
      if (!name) return NextResponse.json({ error: "Invalid policy name" }, { status: 400 });
      updateData.name = name;
    }
    if (body.description !== undefined) {
      if (body.description !== null && typeof body.description !== "string") return NextResponse.json({ error: "Invalid description" }, { status: 400 });
      const description = body.description == null ? null : s(body.description, 1000);
      if (body.description !== null && !description) return NextResponse.json({ error: "Invalid description" }, { status: 400 });
      updateData.description = description;
    }
    const hasPolicyUpdate = body.policyJson !== undefined;
    if (hasPolicyUpdate) {
      if (!body.policyJson || typeof body.policyJson !== "object" || Array.isArray(body.policyJson)) return NextResponse.json({ error: "Policy definition must be a JSON object" }, { status: 400 });
      if (JSON.stringify(body.policyJson).length > MAX_BODY) return NextResponse.json({ error: "Policy definition too large" }, { status: 413 });
      updateData.policyJson = body.policyJson;
      updateData.version = (policy.version || 1) + 1;
    }
    if (body.isDefault !== undefined) {
      if (typeof body.isDefault !== "boolean") return NextResponse.json({ error: "Invalid default flag" }, { status: 400 });
      updateData.isDefault = body.isDefault;
    }

    // Live policy changes must succeed at Google before local state is committed.
    if (enterprise.mode === "LIVE_AMAPI" && hasPolicyUpdate) {
      if (!enterprise.serviceAccountEmail || !enterprise.serviceAccountPrivateKey) return NextResponse.json({ error: "Live policy update blocked: AMAPI credentials are incomplete" }, { status: 503 });
      try {
        const privateKey = decryptText(enterprise.serviceAccountPrivateKey);
        const accessToken = await fetchGoogleAccessToken(enterprise.serviceAccountEmail, privateKey);
        const gName = policy.googlePolicyName || `${enterprise.enterpriseId}/policies/${policy.id}`;
        await callAmapi(gName, { method: "PATCH", accessToken, body: body.policyJson });
      } catch {
        await db.insert(auditLogs).values({
          id: `log-${crypto.randomUUID()}`, enterpriseId: policy.enterpriseId, actor: identity.actor,
          action: "POLICY_UPDATE_BLOCKED", resourceType: "POLICY", resourceId: policy.id,
          details: { reason: "Google AMAPI policy update failed" }, status: "FAILURE",
        });
        return NextResponse.json({ error: "Live policy update failed; local policy was preserved" }, { status: 502 });
      }
    }

    if (body.isDefault === true) await db.update(policies).set({ isDefault: false }).where(eq(policies.enterpriseId, policy.enterpriseId));
    const [updated] = await db.update(policies).set(updateData).where(eq(policies.id, id)).returning();
    if (hasPolicyUpdate) await db.update(devices).set({ appliedPolicyVersion: updated.version, lastSyncTime: new Date(), updatedAt: new Date() }).where(eq(devices.appliedPolicyId, id));

    await db.insert(auditLogs).values({
      id: `log-${crypto.randomUUID()}`, enterpriseId: policy.enterpriseId, actor: identity.actor,
      action: "POLICY_UPDATED", resourceType: "POLICY", resourceId: updated.id,
      details: { name: updated.name, newVersion: updated.version }, status: "SUCCESS",
    });
    return NextResponse.json({ success: true, policy: updated }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to update policy" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const identity = authenticateApiRequest(req);
  if (!identity) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (identity.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const { id } = await params;
    if (!id || id.length > MAX_ID) return NextResponse.json({ error: "Invalid policy ID" }, { status: 400 });
    const [policy] = await db.select().from(policies).where(eq(policies.id, id)).limit(1);
    if (!policy) return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    if (policy.isDefault) return NextResponse.json({ error: "Cannot delete the default policy. Set another policy as default first." }, { status: 400 });
    const [assigned] = await db.select({ id: devices.id }).from(devices).where(eq(devices.appliedPolicyId, id)).limit(1);
    if (assigned) return NextResponse.json({ error: "Cannot delete a policy assigned to devices" }, { status: 409 });
    await db.delete(policies).where(eq(policies.id, id));
    await db.insert(auditLogs).values({
      id: `log-${crypto.randomUUID()}`, enterpriseId: policy.enterpriseId, actor: identity.actor,
      action: "POLICY_DELETED", resourceType: "POLICY", resourceId: id, details: { name: policy.name }, status: "SUCCESS",
    });
    return NextResponse.json({ success: true, message: "Policy deleted successfully" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to delete policy" }, { status: 500 });
  }
}
