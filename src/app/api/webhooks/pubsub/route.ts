import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/db";
import { pubsubMessages, devices, enterprises, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureEnterpriseInitialized } from "@/lib/db-seed";

const MAX_BODY = 64_000;
const VALID_TYPES = ["ENROLLMENT", "STATUS_REPORT", "COMMAND_STATUS", "NON_COMPLIANCE"] as const;

function validSecret(req: NextRequest): boolean {
  const expected = process.env.MDM_PUBSUB_TOKEN;
  const supplied = req.headers.get("x-mdm-pubsub-token");
  if (!expected || expected.length < 32 || !supplied || supplied.length > 512) return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(supplied, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!validSecret(req)) return NextResponse.json({ error: "Webhook authentication failed" }, { status: 401 });
  try {
    await ensureEnterpriseInitialized();
    const rawBody = await req.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    let body: Record<string, unknown>;
    try {
      const parsed = JSON.parse(rawBody);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    let decodedData: Record<string, unknown> = {};
    let messageId = `msg-${crypto.randomUUID()}`;
    let publishTime = new Date();
    const message = body.message;

    if (message && typeof message === "object" && !Array.isArray(message)) {
      const msg = message as Record<string, unknown>;
      if (typeof msg.data !== "string" || msg.data.length > 60_000) return NextResponse.json({ error: "Invalid Pub/Sub message" }, { status: 400 });
      messageId = typeof msg.messageId === "string" ? msg.messageId.slice(0, 256) : typeof msg.message_id === "string" ? msg.message_id.slice(0, 256) : messageId;
      if (typeof msg.publishTime === "string") {
        const parsedTime = new Date(msg.publishTime);
        if (Number.isNaN(parsedTime.getTime())) return NextResponse.json({ error: "Invalid publish time" }, { status: 400 });
        publishTime = parsedTime;
      }
      try {
        const decodedString = Buffer.from(msg.data, "base64").toString("utf-8");
        const parsed = JSON.parse(decodedString);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
        decodedData = parsed as Record<string, unknown>;
      } catch {
        return NextResponse.json({ error: "Invalid Pub/Sub message data" }, { status: 400 });
      }
    } else {
      // Direct JSON is retained only for authenticated test/lab webhooks.
      decodedData = body;
    }

    const enterpriseName = typeof decodedData.enterpriseName === "string" ? decodedData.enterpriseName : typeof decodedData.enterprise === "string" ? decodedData.enterprise : "";
    const deviceName = typeof decodedData.deviceName === "string" ? decodedData.deviceName : typeof decodedData.device === "string" ? decodedData.device : "";
    if (enterpriseName.length > 500 || deviceName.length > 500) return NextResponse.json({ error: "Invalid resource name" }, { status: 400 });
    const notificationType = decodedData.notificationType == null ? "STATUS_REPORT" : decodedData.notificationType;
    if (typeof notificationType !== "string" || !VALID_TYPES.includes(notificationType as typeof VALID_TYPES[number])) return NextResponse.json({ error: "Invalid notification type" }, { status: 400 });

    const entList = await db.select().from(enterprises).limit(1);
    const enterprise = entList[0];
    if (!enterprise) return NextResponse.json({ error: "Enterprise not configured" }, { status: 404 });
    if (enterpriseName && enterpriseName !== enterprise.enterpriseId && !enterpriseName.endsWith(`/${enterprise.enterpriseId.split("/").pop()}`)) {
      return NextResponse.json({ error: "Enterprise binding mismatch" }, { status: 403 });
    }

    let matchedDeviceId: string | null = null;
    if (deviceName) {
      const [matchedDevice] = await db.select().from(devices).where(eq(devices.googleDeviceName, deviceName)).limit(1);
      if (matchedDevice && matchedDevice.enterpriseId === enterprise.id) {
        matchedDeviceId = matchedDevice.id;
        const now = new Date();
        const updateObj: Partial<typeof devices.$inferInsert> = { lastStatusReportTime: now, updatedAt: now };
        if (notificationType === "NON_COMPLIANCE") {
          updateObj.isCompliant = false;
          updateObj.nonComplianceDetails = decodedData.details && typeof decodedData.details === "object" ? decodedData.details : { reason: "Security violation detected via AMAPI" };
        } else if (notificationType === "STATUS_REPORT") {
          if (decodedData.batteryLevel !== undefined) {
            const level = Number(decodedData.batteryLevel);
            if (!Number.isFinite(level) || level < 0 || level > 100) return NextResponse.json({ error: "Invalid battery level" }, { status: 400 });
            updateObj.batteryLevel = Math.floor(level);
          }
          if (decodedData.batteryStatus !== undefined && typeof decodedData.batteryStatus === "string" && decodedData.batteryStatus.length <= 32) updateObj.batteryStatus = decodedData.batteryStatus;
          if (decodedData.ipAddress !== undefined && typeof decodedData.ipAddress === "string" && decodedData.ipAddress.length <= 64) updateObj.ipAddress = decodedData.ipAddress;
          if (decodedData.isCompliant !== undefined) {
            if (typeof decodedData.isCompliant !== "boolean") return NextResponse.json({ error: "Invalid compliance value" }, { status: 400 });
            updateObj.isCompliant = decodedData.isCompliant;
          }
        }
        await db.update(devices).set(updateObj).where(eq(devices.id, matchedDevice.id));
      }
    }

    await db.insert(pubsubMessages).values({
      id: `pubsub-${crypto.randomUUID()}`, enterpriseId: enterprise.id, messageId, publishTime,
      notificationType, deviceId: matchedDeviceId, rawPayload: decodedData, processed: true,
    });
    await db.insert(auditLogs).values({
      id: `log-${crypto.randomUUID()}`, enterpriseId: enterprise.id, actor: "Google Cloud Pub/Sub Webhook",
      action: `PUBSUB_EVENT_${notificationType}`, resourceType: "PUBSUB_NOTIFICATION", resourceId: messageId,
      details: { deviceName: deviceName || null, matchedDeviceId, notificationType }, status: "SUCCESS",
    });

    return NextResponse.json({ success: true, acknowledged: true, messageId, notificationType, matchedDeviceId }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
