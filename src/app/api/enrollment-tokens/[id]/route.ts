import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { enrollmentTokens, policies, enterprises, devices, auditLogs, pubsubMessages } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateQrDataUrl, generateQrSvg } from "@/lib/amapi/amapi-service";
import { authenticateApiRequest } from "@/lib/api-auth";

const MAX_ID = 200;
const MAX_BODY = 16_384;

function s(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length <= max ? value.trim() : null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const identity = authenticateApiRequest(req);
  if (!identity) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (identity.role !== "admin" && identity.role !== "operator") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const { id } = await params;
    if (!id || id.length > MAX_ID) return NextResponse.json({ error: "Invalid token ID" }, { status: 400 });
    const [item] = await db.select({ token: enrollmentTokens, policyName: policies.name })
      .from(enrollmentTokens).leftJoin(policies, eq(enrollmentTokens.policyId, policies.id))
      .where(eq(enrollmentTokens.id, id)).limit(1);
    if (!item) return NextResponse.json({ error: "Enrollment token not found" }, { status: 404 });

    const qrDataUrl = await generateQrDataUrl(item.token.qrCodeData);
    const qrSvg = await generateQrSvg(item.token.qrCodeData);
    return NextResponse.json({ token: { ...item.token, policyName: item.policyName, qrDataUrl, qrSvg } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to fetch token" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const identity = authenticateApiRequest(req);
  if (!identity) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (identity.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const { id } = await params;
    if (!id || id.length > MAX_ID) return NextResponse.json({ error: "Invalid token ID" }, { status: 400 });
    const [token] = await db.select().from(enrollmentTokens).where(eq(enrollmentTokens.id, id)).limit(1);
    if (!token) return NextResponse.json({ error: "Token not found" }, { status: 404 });
    if (token.status === "CONSUMED") return NextResponse.json({ error: "Consumed tokens cannot be revoked" }, { status: 409 });

    await db.update(enrollmentTokens).set({ status: "REVOKED" }).where(eq(enrollmentTokens.id, id));
    await db.insert(auditLogs).values({
      id: `log-${crypto.randomUUID()}`, enterpriseId: token.enterpriseId, actor: identity.actor,
      action: "ENROLLMENT_TOKEN_REVOKED", resourceType: "ENROLLMENT_TOKEN", resourceId: token.id,
      details: { status: token.status }, status: "WARNING",
    });
    return NextResponse.json({ success: true, message: "Token revoked" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to revoke token" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const identity = authenticateApiRequest(req);
  if (!identity) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (identity.role !== "admin" && identity.role !== "operator") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;
    if (!id || id.length > MAX_ID) return NextResponse.json({ error: "Invalid token ID" }, { status: 400 });
    const rawBody = await req.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY) return NextResponse.json({ error: "Request payload too large" }, { status: 413 });
    let body: Record<string, unknown> = {};
    try {
      if (rawBody.trim()) {
        const parsed = JSON.parse(rawBody);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
        body = parsed as Record<string, unknown>;
      }
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const action = body.action == null ? "test-enroll" : s(body.action, 32);
    if (action !== "test-enroll") return NextResponse.json({ error: "Unknown action" }, { status: 400 });

    const [token] = await db.select().from(enrollmentTokens).where(eq(enrollmentTokens.id, id)).limit(1);
    if (!token) return NextResponse.json({ error: "Enrollment token not found" }, { status: 404 });
    if (token.status !== "ACTIVE") return NextResponse.json({ error: `Enrollment token is ${token.status.toLowerCase()}` }, { status: 409 });
    if (new Date() >= new Date(token.expirationTimestamp)) {
      await db.update(enrollmentTokens).set({ status: "EXPIRED" }).where(and(eq(enrollmentTokens.id, id), eq(enrollmentTokens.status, "ACTIVE")));
      return NextResponse.json({ error: "This enrollment token has expired" }, { status: 400 });
    }

    const [ent] = await db.select().from(enterprises).where(eq(enterprises.id, token.enterpriseId)).limit(1);
    const [policy] = await db.select().from(policies).where(and(eq(policies.id, token.policyId), eq(policies.enterpriseId, token.enterpriseId))).limit(1);
    if (!ent || !policy) return NextResponse.json({ error: "Enrollment configuration not found" }, { status: 500 });

    const model = body.model == null ? "Google Pixel 9 Pro" : s(body.model, 120);
    const manufacturer = body.manufacturer == null ? "Google" : s(body.manufacturer, 120);
    const serialNumber = body.serialNumber == null ? `SN-${crypto.randomUUID()}` : s(body.serialNumber, 200);
    const imei = body.imei == null ? `35${crypto.randomUUID().replace(/\D/g, "").slice(0, 13).padEnd(13, "0")}` : s(body.imei, 32);
    if (!model || !manufacturer || !serialNumber || !imei) return NextResponse.json({ error: "Invalid device enrollment fields" }, { status: 400 });

    const managementMode = token.allowPersonalUsage === "PERSONAL_USAGE_ALLOWED" ? "WORK_PROFILE" : "FULLY_MANAGED";
    const newDeviceId = `dev-${crypto.randomUUID()}`;
    const googleDeviceName = `${ent.enterpriseId}/devices/${newDeviceId}`;

    const [enrolledDevice] = await db.insert(devices).values({
      id: newDeviceId, enterpriseId: ent.id, googleDeviceName, enrollmentTokenId: token.id,
      appliedPolicyId: policy.id, appliedPolicyVersion: policy.version,
      hardwareId: `${manufacturer.toLowerCase()}-${model.toLowerCase().replace(/\s+/g, "-")}`.slice(0, 250),
      serialNumber, imei, model, manufacturer, brand: manufacturer,
      osVersion: "Android 15 Enterprise CloudDPC", apiLevel: 35, securityPatchLevel: "2025-02-01",
      managementMode, state: "ACTIVE", appliedState: "ACTIVE", isCompliant: true,
      batteryLevel: 98, batteryStatus: "DISCHARGING", networkType: "WIFI",
      ipAddress: "192.168.1.199", wifiSsid: token.wifiSsid || "Enterprise-Secure-WiFi",
      totalMemoryBytes: 12884901888, availableMemoryBytes: 8589934592,
      totalInternalStorageBytes: 274877906944, freeInternalStorageBytes: 214748364800,
      installedAppsCount: 42, lastStatusReportTime: new Date(), lastSyncTime: new Date(), enrollmentTime: new Date(),
    }).returning();

    if (token.oneTimeUse) {
      await db.update(enrollmentTokens).set({ status: "CONSUMED", enrolledDeviceId: enrolledDevice.id })
        .where(and(eq(enrollmentTokens.id, token.id), eq(enrollmentTokens.status, "ACTIVE")));
    }

    await db.insert(pubsubMessages).values({
      id: `msg-${crypto.randomUUID()}`, enterpriseId: ent.id, messageId: `pubsub-enr-${crypto.randomUUID()}`,
      notificationType: "ENROLLMENT", deviceId: enrolledDevice.id,
      rawPayload: { enterprise: ent.enterpriseId, device: googleDeviceName, event: "DEVICE_ENROLLED", managementMode, tokenUsed: true, appliedPolicy: policy.name },
      processed: true,
    });
    await db.insert(auditLogs).values({
      id: `log-${crypto.randomUUID()}`, enterpriseId: ent.id, actor: identity.actor,
      action: "DEVICE_PROVISIONED_VIA_QR", resourceType: "DEVICE", resourceId: enrolledDevice.id,
      details: { model, serialNumber, managementMode, tokenId: token.id }, status: "SUCCESS",
    });

    return NextResponse.json({ success: true, message: `Device ${model} (${serialNumber}) successfully enrolled via CloudDPC QR token!`, device: enrolledDevice }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to process token action" }, { status: 500 });
  }
}
