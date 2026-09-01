import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { policies, enterprises, devices, auditLogs } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { ensureEnterpriseInitialized } from "@/lib/db-seed";
import { fetchGoogleAccessToken, callAmapi, createDefaultAmapiPolicy } from "@/lib/amapi/amapi-service";
import { decryptText } from "@/lib/crypto";

export async function GET() {
  try {
    await ensureEnterpriseInitialized();
    const entList = await db.select().from(enterprises).limit(1);
    if (!entList.length) {
      return NextResponse.json({ error: "Enterprise not initialized" }, { status: 404 });
    }
    const enterprise = entList[0];

    const policyRows = await db
      .select({
        policy: policies,
        deviceCount: sql<number>`(SELECT count(*) FROM devices WHERE devices.applied_policy_id = policies.id)`,
      })
      .from(policies)
      .where(eq(policies.enterpriseId, enterprise.id))
      .orderBy(desc(policies.isDefault), desc(policies.updatedAt));

    return NextResponse.json({
      policies: policyRows.map((r) => ({
        ...r.policy,
        deviceCount: Number(r.deviceCount || 0),
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch policies";
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
    const { name, description, isDefault = false, policyJson } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Policy name is required" }, { status: 400 });
    }

    const policyId = `pol-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const googlePolicyName = `${enterprise.enterpriseId}/policies/${policyId}`;
    const policyDefinition = policyJson || createDefaultAmapiPolicy(name);

    // If default, unset previous default
    if (isDefault) {
      await db
        .update(policies)
        .set({ isDefault: false })
        .where(eq(policies.enterpriseId, enterprise.id));
    }

    // If LIVE_AMAPI mode, try patching to Google Cloud
    if (
      enterprise.mode === "LIVE_AMAPI" &&
      enterprise.serviceAccountEmail &&
      enterprise.serviceAccountPrivateKey
    ) {
      try {
        const privateKey = decryptText(enterprise.serviceAccountPrivateKey);
        const accessToken = await fetchGoogleAccessToken(enterprise.serviceAccountEmail, privateKey);
        await callAmapi(`${googlePolicyName}`, {
          method: "PATCH",
          accessToken,
          body: policyDefinition,
        });
      } catch (gErr) {
        console.warn("Live AMAPI patchPolicy warning:", gErr);
      }
    }

    const [created] = await db
      .insert(policies)
      .values({
        id: policyId,
        enterpriseId: enterprise.id,
        name: name.trim(),
        googlePolicyName,
        description: description?.trim() || null,
        version: 1,
        isDefault,
        policyJson: policyDefinition,
      })
      .returning();

    await db.insert(auditLogs).values({
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      enterpriseId: enterprise.id,
      actor: "Console Admin",
      action: "POLICY_CREATED",
      resourceType: "POLICY",
      resourceId: created.id,
      details: { name: created.name, googlePolicyName },
      status: "SUCCESS",
    });

    return NextResponse.json({ success: true, policy: created });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create policy";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
