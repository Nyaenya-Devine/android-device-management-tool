import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { devices, policies, deviceCommands, auditLogs, pubsubMessages, enterprises } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { fetchGoogleAccessToken, callAmapi } from "@/lib/amapi/amapi-service";
import { decryptText } from "@/lib/crypto";
import { authenticateApiRequest } from "@/lib/api-auth";

const MAX_ID = 200;
const MAX_BODY = 16_384;
const VALID_STATES = ["ACTIVE", "DISABLED", "PROVISIONING", "LOST_MODE"] as const;
const VALID_BATTERY_STATUS = ["CHARGING", "DISCHARGING", "FULL", "NOT_CHARGING"] as const;

function str(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length <= max ? value.trim() : null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!authenticateApiRequest(req)) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const { id } = await params;
    if (!id || id.length > MAX_ID) return NextResponse.json({ error: "Invalid device ID" }, { status: 400 });

    const [deviceRow] = await db.select({
      device: devices, policyName: policies.name, policyJson: policies.policyJson, policyVersion: policies.version,
    }).from(devices).leftJoin(policies, eq(devices.appliedPolicyId, policies.id)).where(eq(devices.id, id)).limit(1);
    if (!deviceRow) return NextResponse.json({ error: "Device not found" }, { status: 404 });

    const commands = await db.select().from(deviceCommands).where(eq(deviceCommands.deviceId, id)).orderBy(desc(deviceCommands.issuedAt)).limit(10);
    const pubsubEvents = await db.select().from(pubsubMessages).where(eq(pubsubMessages.deviceId, id)).orderBy(desc(pubsubMessages.publishTime)).limit(10);

    return NextResponse.json({
      device: { ...deviceRow.device, policyName: deviceRow.policyName, policyJson: deviceRow.policyJson, policyVersion: deviceRow.policyVersion },
      commands,
      pubsubEvents,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to fetch device details" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const identity = authenticateApiRequest(req);
  if (!identity) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (identity.role !== "admin" && identity.role !== "operator") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;
    if (!id || id.length > MAX_ID) return NextResponse.json({ error: "Invalid device ID" }, { status: 400 });
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

    const [device] = await db.select().from(devices).where(eq(devices.id, id)).limit(1);
    if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 });

    const updateData: Partial<typeof devices.$inferInsert> = { updatedAt: new Date() };
    const allowedFields = ["appliedPolicyId", "state", "appliedState", "isCompliant", "batteryLevel", "batteryStatus", "ipAddress", "wifiSsid"];
    if (Object.keys(body).some(k => !allowedFields.includes(k))) return NextResponse.json({ error: "Unsupported update field" }, { status: 400 });

    if (body.appliedPolicyId !== undefined) {
      const policyId = body.appliedPolicyId === null ? null : str(body.appliedPolicyId, MAX_ID);
      if (body.appliedPolicyId !== null && !policyId) return NextResponse.json({ error: "Invalid policy ID" }, { status: 400 });
      updateData.appliedPolicyId = policyId;
      if (policyId) {
        const [pol] = await db.select({ id: policies.id, version: policies.version }).from(policies)
          .where(and(eq(policies.id, policyId), eq(policies.enterpriseId, device.enterpriseId))).limit(1);
        if (!pol) return NextResponse.json({ error: "Policy not found" }, { status: 404 });
        updateData.appliedPolicyVersion = pol.version;
      } else updateData.appliedPolicyVersion = null;
    }

    if (body.state !== undefined) {
      if (typeof body.state !== "string" || !VALID_STATES.includes(body.state as typeof VALID_STATES[number])) return NextResponse.json({ error: "Invalid state" }, { status: 400 });
      updateData.state = body.state;
    }
    if (body.appliedState !== undefined) {
      if (typeof body.appliedState !== "string" || !VALID_STATES.includes(body.appliedState as typeof VALID_STATES[number])) return NextResponse.json({ error: "Invalid applied state" }, { status: 400 });
      updateData.appliedState = body.appliedState;
    }
    if (body.isCompliant !== undefined) {
      if (typeof body.isCompliant !== "boolean") return NextResponse.json({ error: "Invalid compliance value" }, { status: 400 });
      updateData.isCompliant = body.isCompliant;
    }
    if (body.batteryLevel !== undefined) {
      if (!Number.isInteger(body.batteryLevel) || (body.batteryLevel as number) < 0 || (body.batteryLevel as number) > 100) return NextResponse.json({ error: "Invalid battery level" }, { status: 400 });
      updateData.batteryLevel = body.batteryLevel as number;
    }
    if (body.batteryStatus !== undefined) {
      if (typeof body.batteryStatus !== "string" || !VALID_BATTERY_STATUS.includes(body.batteryStatus as typeof VALID_BATTERY_STATUS[number])) return NextResponse.json({ error: "Invalid battery status" }, { status: 400 });
      updateData.batteryStatus = body.batteryStatus;
    }
    if (body.ipAddress !== undefined) {
      const value = str(body.ipAddress, 64);
      if (!value) return NextResponse.json({ error: "Invalid IP address" }, { status: 400 });
      updateData.ipAddress = value;
    }
    if (body.wifiSsid !== undefined) {
      const value = str(body.wifiSsid, 128);
      if (!value) return NextResponse.json({ error: "Invalid Wi-Fi SSID" }, { status: 400 });
      updateData.wifiSsid = value;
    }

    const [updated] = await db.update(devices).set(updateData).where(eq(devices.id, id)).returning();
    await db.insert(auditLogs).values({
      id: `log-${crypto.randomUUID()}`, enterpriseId: device.enterpriseId, actor: identity.actor,
      action: "DEVICE_UPDATED", resourceType: "DEVICE", resourceId: device.id,
      details: { fields: Object.keys(updateData).filter(k => k !== "updatedAt") }, status: "SUCCESS",
    });
    return NextResponse.json({ success: true, device: updated }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to update device" }, { status: 500 });
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
    if (!id || id.length > MAX_ID) return NextResponse.json({ error: "Invalid device ID" }, { status: 400 });
    const [device] = await db.select().from(devices).where(eq(devices.id, id)).limit(1);
    if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 });

    const [enterprise] = await db.select().from(enterprises).where(eq(enterprises.id, device.enterpriseId)).limit(1);
    let liveError: string | null = null;

    if (enterprise?.mode === "LIVE_AMAPI") {
      // A live device must not be deleted locally unless Google confirms deprovisioning.
      if (!enterprise.serviceAccountEmail || !enterprise.serviceAccountPrivateKey || !device.googleDeviceName) {
        return NextResponse.json({ error: "Live deletion blocked: incomplete AMAPI configuration" }, { status: 503 });
      }
      try {
        const privateKey = decryptText(enterprise.serviceAccountPrivateKey);
        const accessToken = await fetchGoogleAccessToken(enterprise.serviceAccountEmail, privateKey);
        await callAmapi(device.googleDeviceName, { method: "DELETE", accessToken });
      } catch (gErr: unknown) {
        liveError = gErr instanceof Error ? gErr.message : "Live AMAPI delete failed";
        await db.insert(auditLogs).values({
          id: `log-${crypto.randomUUID()}`, enterpriseId: device.enterpriseId, actor: identity.actor,
          action: "DEVICE_DELETE_BLOCKED", resourceType: "DEVICE", resourceId: id,
          details: { reason: "Google AMAPI deletion failed" }, status: "FAILURE",
        });
        return NextResponse.json({ success: false, error: "Live device deletion failed; local record was preserved" }, { status: 502 });
      }
    }

    await db.delete(devices).where(eq(devices.id, id));
    await db.insert(auditLogs).values({
      id: `log-${crypto.randomUUID()}`, enterpriseId: device.enterpriseId, actor: identity.actor,
      action: "DEVICE_DELETED", resourceType: "DEVICE", resourceId: id,
      details: { model: device.model, serialNumber: device.serialNumber, googleDeviceName: device.googleDeviceName, liveError }, status: "SUCCESS",
    });
    return NextResponse.json({ success: true, message: "Device deprovisioned and removed successfully" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to delete device" }, { status: 500 });
  }
}
