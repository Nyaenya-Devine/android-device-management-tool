import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { devices, deviceCommands, enterprises, auditLogs, pubsubMessages } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { fetchGoogleAccessToken, callAmapi } from "@/lib/amapi/amapi-service";
import { decryptText } from "@/lib/crypto";
import { CommandType } from "@/lib/types/amapi";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const commands = await db
      .select()
      .from(deviceCommands)
      .where(eq(deviceCommands.deviceId, id))
      .orderBy(desc(deviceCommands.issuedAt));

    return NextResponse.json({ commands });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch commands";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { commandType, payload = {}, actor = "IT Administrator" } = body;

    // NOTE: maps 1:1 to Google's Android Management API CommandType enum.
    // "DELETE" is intentionally absent: removing a device from an enterprise is
    // enterprises.devices.delete — NOT an issueCommand type.
    const validCommands: CommandType[] = [
      "LOCK",
      "WIPE",
      "REBOOT",
      "RELINQUISH_OWNERSHIP",
      "CLEAR_APP_DATA",
      "START_LOST_MODE",
      "STOP_LOST_MODE",
      "RESET_PASSWORD",
    ];

    if (!validCommands.includes(commandType)) {
      return NextResponse.json({ error: `Invalid command type: ${commandType}` }, { status: 400 });
    }

    const [device] = await db.select().from(devices).where(eq(devices.id, id)).limit(1);
    if (!device) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    const [enterprise] = await db.select().from(enterprises).where(eq(enterprises.id, device.enterpriseId)).limit(1);
    if (!enterprise) {
      return NextResponse.json({ error: "Enterprise not found" }, { status: 404 });
    }

    const commandId = `cmd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    let googleOpName = `${enterprise.enterpriseId}/operations/op-${commandType.toLowerCase()}-${Date.now().toString(36)}`;
    let status: "PENDING" | "SENT" | "EXECUTED" | "FAILED" = "EXECUTED";
    let errorMessage: string | null = null;

    // Check if Live Google AMAPI mode
    if (
      enterprise.mode === "LIVE_AMAPI" &&
      enterprise.serviceAccountEmail &&
      enterprise.serviceAccountPrivateKey &&
      device.googleDeviceName
    ) {
      try {
        const privateKey = decryptText(enterprise.serviceAccountPrivateKey);
        const accessToken = await fetchGoogleAccessToken(enterprise.serviceAccountEmail, privateKey);

        const amapiRes = await callAmapi<{ name?: string }>(
          `${device.googleDeviceName}:issueCommand`,
          {
            method: "POST",
            accessToken,
            body: {
              type: commandType,
              ...payload,
            },
          }
        );

        if (amapiRes?.name) {
          googleOpName = amapiRes.name;
        }
        status = "SENT";
      } catch (gErr: unknown) {
        console.warn("Live AMAPI issueCommand failed, falling back to local simulator:", gErr);
        errorMessage = gErr instanceof Error ? gErr.message : "Live AMAPI call warning";
      }
    }

    // Execute state effects on device.
    // Real AM API semantics: a WIPE (or RELINQUISH_OWNERSHIP) only happens once
    // the DEVICE acknowledges the command and it can be cancelled before then.
    // So the local row is marked WIPE_PENDING — never DELETED at issue time.
    // The device is only removed from the enterprise later via
    // enterprises.devices.delete (see DELETE /api/devices/[id]).
    const now = new Date();
    if (commandType === "START_LOST_MODE") {
      await db.update(devices).set({ state: "LOST_MODE", updatedAt: now }).where(eq(devices.id, device.id));
    } else if (commandType === "STOP_LOST_MODE") {
      await db.update(devices).set({ state: "ACTIVE", updatedAt: now }).where(eq(devices.id, device.id));
    } else if (commandType === "WIPE" || commandType === "RELINQUISH_OWNERSHIP") {
      await db.update(devices).set({ state: "WIPE_PENDING", updatedAt: now }).where(eq(devices.id, device.id));
    } else if (commandType === "REBOOT" || commandType === "LOCK") {
      await db.update(devices).set({ lastSyncTime: now, updatedAt: now }).where(eq(devices.id, device.id));
    }

    // Insert command record
    const [createdCommand] = await db
      .insert(deviceCommands)
      .values({
        id: commandId,
        enterpriseId: enterprise.id,
        deviceId: device.id,
        commandType,
        payload,
        status,
        googleOperationName: googleOpName,
        errorMessage,
        issuedBy: actor,
        issuedAt: now,
        executedAt: status === "EXECUTED" ? now : null,
      })
      .returning();

    // Insert Audit Log
    await db.insert(auditLogs).values({
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      enterpriseId: enterprise.id,
      actor,
      action: `COMMAND_ISSUED_${commandType}`,
      resourceType: "DEVICE_COMMAND",
      resourceId: createdCommand.id,
      details: {
        deviceId: device.id,
        deviceModel: device.model,
        commandType,
        payload,
      },
      status: "SUCCESS",
    });

    // Insert Pub/Sub notification
    await db.insert(pubsubMessages).values({
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      enterpriseId: enterprise.id,
      messageId: `gcp-cmd-msg-${Date.now()}`,
      notificationType: "COMMAND_STATUS",
      deviceId: device.id,
      rawPayload: {
        enterprise: enterprise.enterpriseId,
        device: device.googleDeviceName || device.id,
        commandId: createdCommand.id,
        commandType,
        status,
        operationName: googleOpName,
      },
      processed: true,
    });

    return NextResponse.json({
      success: true,
      message: `Command ${commandType} issued to ${device.model} (${device.serialNumber}) successfully!`,
      command: createdCommand,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to issue command";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
