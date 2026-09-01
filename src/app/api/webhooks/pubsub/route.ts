import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { pubsubMessages, devices, enterprises, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureEnterpriseInitialized } from "@/lib/db-seed";

export async function POST(req: NextRequest) {
  try {
    await ensureEnterpriseInitialized();
    const body = await req.json();

    let decodedData: Record<string, unknown> = {};
    let messageId = `msg-${Date.now()}`;
    let publishTime = new Date();

    // Standard Google Cloud Pub/Sub Push payload format
    if (body.message && body.message.data) {
      messageId = body.message.messageId || body.message.message_id || messageId;
      if (body.message.publishTime) {
        publishTime = new Date(body.message.publishTime);
      }
      try {
        const decodedString = Buffer.from(body.message.data, "base64").toString("utf-8");
        decodedData = JSON.parse(decodedString);
      } catch {
        decodedData = { rawString: Buffer.from(body.message.data, "base64").toString("utf-8") };
      }
    } else {
      // Direct JSON testing payload
      decodedData = body;
    }

    const enterpriseName = (decodedData.enterpriseName || decodedData.enterprise || "") as string;
    const deviceName = (decodedData.deviceName || decodedData.device || "") as string;
    const notificationType = (decodedData.notificationType || "STATUS_REPORT") as
      | "ENROLLMENT"
      | "STATUS_REPORT"
      | "COMMAND_STATUS"
      | "NON_COMPLIANCE";

    // Find enterprise
    const entList = await db.select().from(enterprises).limit(1);
    const enterprise = entList[0];

    let matchedDeviceId: string | null = null;

    if (deviceName && enterprise) {
      const [matchedDevice] = await db
        .select()
        .from(devices)
        .where(eq(devices.googleDeviceName, deviceName))
        .limit(1);

      if (matchedDevice) {
        matchedDeviceId = matchedDevice.id;

        // Process device state update based on notification
        const now = new Date();
        const updateObj: Partial<typeof devices.$inferInsert> = {
          lastStatusReportTime: now,
          updatedAt: now,
        };

        if (notificationType === "NON_COMPLIANCE") {
          updateObj.isCompliant = false;
          updateObj.nonComplianceDetails = decodedData.details || { reason: "Security violation detected via AMAPI" };
        } else if (notificationType === "STATUS_REPORT") {
          if (decodedData.batteryLevel !== undefined) {
            updateObj.batteryLevel = Number(decodedData.batteryLevel);
          }
          if (decodedData.batteryStatus) {
            updateObj.batteryStatus = String(decodedData.batteryStatus);
          }
          if (decodedData.ipAddress) {
            updateObj.ipAddress = String(decodedData.ipAddress);
          }
          if (decodedData.isCompliant !== undefined) {
            updateObj.isCompliant = Boolean(decodedData.isCompliant);
          }
        }

        await db.update(devices).set(updateObj).where(eq(devices.id, matchedDevice.id));
      }
    }

    if (enterprise) {
      await db.insert(pubsubMessages).values({
        id: `pubsub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        enterpriseId: enterprise.id,
        messageId,
        publishTime,
        notificationType,
        deviceId: matchedDeviceId,
        rawPayload: decodedData,
        processed: true,
      });

      await db.insert(auditLogs).values({
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        enterpriseId: enterprise.id,
        actor: "Google Cloud Pub/Sub Webhook",
        action: `PUBSUB_EVENT_${notificationType}`,
        resourceType: "PUBSUB_NOTIFICATION",
        resourceId: messageId,
        details: decodedData,
        status: "SUCCESS",
      });
    }

    // Google Cloud Pub/Sub requires 200/204 to acknowledge the message
    return NextResponse.json({
      success: true,
      acknowledged: true,
      messageId,
      notificationType,
      matchedDeviceId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Webhook processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
