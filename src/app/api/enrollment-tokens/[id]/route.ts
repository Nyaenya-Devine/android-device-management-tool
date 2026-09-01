import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { enrollmentTokens, policies, enterprises, devices, auditLogs, pubsubMessages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateQrDataUrl, generateQrSvg } from "@/lib/amapi/amapi-service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [item] = await db
      .select({
        token: enrollmentTokens,
        policyName: policies.name,
      })
      .from(enrollmentTokens)
      .leftJoin(policies, eq(enrollmentTokens.policyId, policies.id))
      .where(eq(enrollmentTokens.id, id))
      .limit(1);

    if (!item) {
      return NextResponse.json({ error: "Enrollment token not found" }, { status: 404 });
    }

    const qrDataUrl = await generateQrDataUrl(item.token.qrCodeData);
    const qrSvg = await generateQrSvg(item.token.qrCodeData);

    return NextResponse.json({
      token: {
        ...item.token,
        policyName: item.policyName,
        qrDataUrl,
        qrSvg,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch token";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [token] = await db.select().from(enrollmentTokens).where(eq(enrollmentTokens.id, id)).limit(1);
    if (!token) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }

    await db
      .update(enrollmentTokens)
      .set({ status: "REVOKED" })
      .where(eq(enrollmentTokens.id, id));

    await db.insert(auditLogs).values({
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      enterpriseId: token.enterpriseId,
      actor: "Console Admin",
      action: "ENROLLMENT_TOKEN_REVOKED",
      resourceType: "ENROLLMENT_TOKEN",
      resourceId: token.id,
      details: { tokenValue: token.tokenValue },
      status: "WARNING",
    });

    return NextResponse.json({ success: true, message: "Token revoked" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to revoke token";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/enrollment-tokens/[id] -> Action handler: simulate/test device enrollment with this token
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const action = body.action || "test-enroll";

    const [token] = await db.select().from(enrollmentTokens).where(eq(enrollmentTokens.id, id)).limit(1);
    if (!token) {
      return NextResponse.json({ error: "Enrollment token not found" }, { status: 404 });
    }

    if (token.status === "REVOKED") {
      return NextResponse.json({ error: "This enrollment token has been revoked" }, { status: 400 });
    }
    if (new Date() > new Date(token.expirationTimestamp)) {
      return NextResponse.json({ error: "This enrollment token has expired" }, { status: 400 });
    }

    const [ent] = await db.select().from(enterprises).where(eq(enterprises.id, token.enterpriseId)).limit(1);
    const [policy] = await db.select().from(policies).where(eq(policies.id, token.policyId)).limit(1);

    if (action === "test-enroll") {
      const model = body.model || "Google Pixel 9 Pro";
      const manufacturer = body.manufacturer || "Google";
      const serialNumber = body.serialNumber || `SN${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 4).toUpperCase()}`;
      const imei = body.imei || `35${Math.floor(1000000000000 + Math.random() * 9000000000000)}`;
      const managementMode = token.allowPersonalUsage === "PERSONAL_USAGE_ALLOWED" ? "WORK_PROFILE" : "FULLY_MANAGED";

      const newDeviceId = `dev-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const googleDeviceName = `${ent.enterpriseId}/devices/${newDeviceId}`;

      const [enrolledDevice] = await db
        .insert(devices)
        .values({
          id: newDeviceId,
          enterpriseId: ent.id,
          googleDeviceName,
          enrollmentTokenId: token.id,
          appliedPolicyId: policy?.id || null,
          appliedPolicyVersion: policy?.version || 1,
          hardwareId: `${manufacturer.toLowerCase()}-${model.toLowerCase().replace(/\s+/g, "-")}`,
          serialNumber,
          imei,
          model,
          manufacturer,
          brand: manufacturer,
          osVersion: "Android 15 Enterprise CloudDPC",
          apiLevel: 35,
          securityPatchLevel: "2025-02-01",
          managementMode,
          state: "ACTIVE",
          appliedState: "ACTIVE",
          isCompliant: true,
          batteryLevel: 98,
          batteryStatus: "DISCHARGING",
          networkType: "WIFI",
          ipAddress: "192.168.1.199",
          wifiSsid: token.wifiSsid || "Enterprise-Secure-WiFi",
          totalMemoryBytes: 12884901888,
          availableMemoryBytes: 8589934592,
          totalInternalStorageBytes: 274877906944,
          freeInternalStorageBytes: 214748364800,
          installedAppsCount: 42,
          lastStatusReportTime: new Date(),
          lastSyncTime: new Date(),
          enrollmentTime: new Date(),
        })
        .returning();

      // If one time use, update token status
      if (token.oneTimeUse) {
        await db
          .update(enrollmentTokens)
          .set({ status: "CONSUMED", enrolledDeviceId: enrolledDevice.id })
          .where(eq(enrollmentTokens.id, token.id));
      }

      // Record Pub/Sub enrollment event
      const pubsubMsgId = `pubsub-enr-${Date.now()}`;
      await db.insert(pubsubMessages).values({
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        enterpriseId: ent.id,
        messageId: pubsubMsgId,
        notificationType: "ENROLLMENT",
        deviceId: enrolledDevice.id,
        rawPayload: {
          enterprise: ent.enterpriseId,
          device: googleDeviceName,
          event: "DEVICE_ENROLLED",
          managementMode,
          tokenUsed: token.tokenValue,
          appliedPolicy: policy?.name,
        },
        processed: true,
      });

      // Record Audit Log
      await db.insert(auditLogs).values({
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        enterpriseId: ent.id,
        actor: "CloudDPC Receiver",
        action: "DEVICE_PROVISIONED_VIA_QR",
        resourceType: "DEVICE",
        resourceId: enrolledDevice.id,
        details: {
          model,
          serialNumber,
          managementMode,
          tokenId: token.id,
          tokenValue: token.tokenValue,
        },
        status: "SUCCESS",
      });

      return NextResponse.json({
        success: true,
        message: `Device ${model} (${serialNumber}) successfully enrolled via CloudDPC QR token!`,
        device: enrolledDevice,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to process token action";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
