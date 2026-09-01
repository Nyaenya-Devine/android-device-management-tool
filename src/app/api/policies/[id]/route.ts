import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { policies, enterprises, devices, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { fetchGoogleAccessToken, callAmapi } from "@/lib/amapi/amapi-service";
import { decryptText } from "@/lib/crypto";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [policy] = await db.select().from(policies).where(eq(policies.id, id)).limit(1);
    if (!policy) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }

    const assignedDevices = await db
      .select()
      .from(devices)
      .where(eq(devices.appliedPolicyId, id));

    return NextResponse.json({ policy, devices: assignedDevices });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch policy";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const [policy] = await db.select().from(policies).where(eq(policies.id, id)).limit(1);
    if (!policy) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }

    const [enterprise] = await db.select().from(enterprises).where(eq(enterprises.id, policy.enterpriseId)).limit(1);

    const updateData: Partial<typeof policies.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.name) updateData.name = body.name.trim();
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;
    if (body.policyJson) {
      updateData.policyJson = body.policyJson;
      updateData.version = (policy.version || 1) + 1;
    }
    if (body.isDefault !== undefined) {
      updateData.isDefault = body.isDefault;
      if (body.isDefault) {
        await db
          .update(policies)
          .set({ isDefault: false })
          .where(eq(policies.enterpriseId, policy.enterpriseId));
      }
    }

    // If LIVE_AMAPI, sync to Google AMAPI
    if (
      enterprise?.mode === "LIVE_AMAPI" &&
      enterprise.serviceAccountEmail &&
      enterprise.serviceAccountPrivateKey &&
      body.policyJson
    ) {
      try {
        const privateKey = decryptText(enterprise.serviceAccountPrivateKey);
        const accessToken = await fetchGoogleAccessToken(enterprise.serviceAccountEmail, privateKey);
        const gName = policy.googlePolicyName || `${enterprise.enterpriseId}/policies/${policy.id}`;
        await callAmapi(gName, {
          method: "PATCH",
          accessToken,
          body: body.policyJson,
        });
      } catch (gErr) {
        console.warn("Live AMAPI patchPolicy warning:", gErr);
      }
    }

    const [updated] = await db
      .update(policies)
      .set(updateData)
      .where(eq(policies.id, id))
      .returning();

    // Also update appliedPolicyVersion on all assigned devices
    if (body.policyJson) {
      await db
        .update(devices)
        .set({
          appliedPolicyVersion: updated.version,
          lastSyncTime: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(devices.appliedPolicyId, id));
    }

    await db.insert(auditLogs).values({
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      enterpriseId: policy.enterpriseId,
      actor: "Console Admin",
      action: "POLICY_UPDATED",
      resourceType: "POLICY",
      resourceId: updated.id,
      details: { name: updated.name, newVersion: updated.version },
      status: "SUCCESS",
    });

    return NextResponse.json({ success: true, policy: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update policy";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [policy] = await db.select().from(policies).where(eq(policies.id, id)).limit(1);
    if (!policy) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }

    if (policy.isDefault) {
      return NextResponse.json(
        { error: "Cannot delete the default policy. Set another policy as default first." },
        { status: 400 }
      );
    }

    await db.delete(policies).where(eq(policies.id, id));

    await db.insert(auditLogs).values({
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      enterpriseId: policy.enterpriseId,
      actor: "Console Admin",
      action: "POLICY_DELETED",
      resourceType: "POLICY",
      resourceId: id,
      details: { name: policy.name },
      status: "SUCCESS",
    });

    return NextResponse.json({ success: true, message: "Policy deleted successfully" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete policy";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
