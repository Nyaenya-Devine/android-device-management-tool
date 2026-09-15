import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { devices, deviceCommands, enterprises, auditLogs, pubsubMessages } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { fetchGoogleAccessToken, callAmapi } from "@/lib/amapi/amapi-service";
import { decryptText } from "@/lib/crypto";
import { CommandType } from "@/lib/types/amapi";
import {
  authenticateApiRequest,
  authenticateApprover,
  canIssueCommand,
  requiresDualControl,
} from "@/lib/api-auth";

const VALID_COMMANDS: readonly CommandType[] = [
  "LOCK", "WIPE", "REBOOT", "RELINQUISH_OWNERSHIP", "CLEAR_APP_DATA",
  "START_LOST_MODE", "STOP_LOST_MODE", "RESET_PASSWORD",
];

function safeError(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!authenticateApiRequest(req)) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const commands = await db.select().from(deviceCommands)
      .where(eq(deviceCommands.deviceId, id)).orderBy(desc(deviceCommands.issuedAt));
    return NextResponse.json({ commands });
  } catch {
    return NextResponse.json({ error: "Failed to fetch commands" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const identity = authenticateApiRequest(req);
  if (!identity) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const commandType = body?.commandType as CommandType;
    const payload = body?.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
      ? body.payload : {};

    if (!VALID_COMMANDS.includes(commandType)) {
      return NextResponse.json({ error: "Invalid command type" }, { status: 400 });
    }

    if (!canIssueCommand(identity.role, commandType)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let approver: ReturnType<typeof authenticateApprover> = null;
    if (requiresDualControl(commandType)) {
      approver = authenticateApprover(req);
      if (!approver) {
        return NextResponse.json({ error: "Second-person approval required" }, { status: 403 });
      }
      if (approver.actor === identity.actor) {
        return NextResponse.json({ error: "Requester and approver must be different actors" }, { status: 403 });
      }
      if (approver.role !== "admin") {
        return NextResponse.json({ error: "Approver is not authorized" }, { status: 403 });
      }
    }

    const [device] = await db.select().from(devices).where(eq(devices.id, id)).limit(1);
    if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 });

    const [enterprise] = await db.select().from(enterprises)
      .where(eq(enterprises.id, device.enterpriseId)).limit(1);
    if (!enterprise) return NextResponse.json({ error: "Enterprise not found" }, { status: 404 });

    const commandId = `cmd-${crypto.randomUUID()}`;
    let googleOpName = `${enterprise.enterpriseId}/operations/op-${commandType.toLowerCase()}-${crypto.randomUUID()}`;
    let status: "PENDING" | "SENT" | "EXECUTED" | "FAILED" = "EXECUTED";
    let errorMessage: string | null = null;

    if (enterprise.mode === "LIVE_AMAPI" && enterprise.serviceAccountEmail &&
        enterprise.serviceAccountPrivateKey && device.googleDeviceName) {
      try {
        const privateKey = decryptText(enterprise.serviceAccountPrivateKey);
        const accessToken = await fetchGoogleAccessToken(enterprise.serviceAccountEmail, privateKey);
        const amapiRes = await callAmapi<{ name?: string }>(`${device.googleDeviceName}:issueCommand`, {
          method: "POST", accessToken, body: { type: commandType, ...payload },
        });
        if (amapiRes?.name) googleOpName = amapiRes.name;
        status = "SENT";
      } catch (gErr: unknown) {
        if (requiresDualControl(commandType)) {
          return NextResponse.json({ error: "Live command could not be delivered; no local destructive action was applied" }, { status: 502 });
        }
        errorMessage = safeError(gErr, "Live AMAPI call failed");
        status = "FAILED";
      }
    }

    if (status !== "FAILED") {
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

      const [createdCommand] = await db.insert(deviceCommands).values({
        id: commandId, enterpriseId: enterprise.id, deviceId: device.id, commandType,
        payload, status, googleOperationName: googleOpName, errorMessage,
        issuedBy: identity.actor, issuedAt: now, executedAt: status === "EXECUTED" ? now : null,
      }).returning();

      await db.insert(auditLogs).values({
        id: `log-${crypto.randomUUID()}`, enterpriseId: enterprise.id, actor: identity.actor,
        action: `COMMAND_ISSUED_${commandType}`, resourceType: "DEVICE_COMMAND",
        resourceId: createdCommand.id,
        details: {
          deviceId: device.id,
          deviceModel: device.model,
          commandType,
          approver: approver?.actor ?? null,
          dualControl: Boolean(approver),
        }, status: "SUCCESS",
      });

      await db.insert(pubsubMessages).values({
        id: `msg-${crypto.randomUUID()}`, enterpriseId: enterprise.id,
        messageId: `gcp-cmd-msg-${crypto.randomUUID()}`, notificationType: "COMMAND_STATUS",
        deviceId: device.id,
        rawPayload: { enterprise: enterprise.enterpriseId, device: device.googleDeviceName || device.id,
          commandId: createdCommand.id, commandType, status, operationName: googleOpName }, processed: true,
      });

      return NextResponse.json({ success: true, command: createdCommand });
    }

    await db.insert(auditLogs).values({
      id: `log-${crypto.randomUUID()}`, enterpriseId: enterprise.id, actor: identity.actor,
      action: `COMMAND_FAILED_${commandType}`, resourceType: "DEVICE_COMMAND", resourceId: commandId,
      details: { deviceId: device.id, commandType }, status: "FAILURE",
    });
    return NextResponse.json({ success: false, error: errorMessage || "Command failed" }, { status: 502 });
  } catch {
    return NextResponse.json({ error: "Failed to issue command" }, { status: 500 });
  }
}
