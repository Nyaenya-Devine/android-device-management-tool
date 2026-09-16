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
const MAX_PAYLOAD_BYTES = 16_384;
const MAX_DEVICE_ID_LENGTH = 200;

function safeError(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
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
    if (!id || id.length > MAX_DEVICE_ID_LENGTH) {
      return NextResponse.json({ error: "Invalid device ID" }, { status: 400 });
    }
    const commands = await db.select().from(deviceCommands)
      .where(eq(deviceCommands.deviceId, id)).orderBy(desc(deviceCommands.issuedAt));
    return NextResponse.json({ commands }, { headers: { "Cache-Control": "no-store" } });
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
    return NextResponse.json({ error: "Authentication required" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const { id } = await params;
    if (!id || id.length > MAX_DEVICE_ID_LENGTH) {
      return NextResponse.json({ error: "Invalid device ID" }, { status: 400 });
    }

    const rawBody = await req.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_PAYLOAD_BYTES) {
      return NextResponse.json({ error: "Request payload too large" }, { status: 413 });
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const commandType = (body as { commandType?: unknown }).commandType;
    if (typeof commandType !== "string" || !VALID_COMMANDS.includes(commandType as CommandType)) {
      return NextResponse.json({ error: "Invalid command type" }, { status: 400 });
    }

    const rawPayload = (body as { payload?: unknown }).payload;
    const payload = rawPayload === undefined
      ? {}
      : rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload)
        ? rawPayload as Record<string, unknown>
        : null;
    if (payload === null) {
      return NextResponse.json({ error: "Invalid command payload" }, { status: 400 });
    }

    // The command type is security-sensitive and must never be overridden by payload fields.
    const { type: _ignoredType, ...commandPayload } = payload;
    if (JSON.stringify(commandPayload).length > MAX_PAYLOAD_BYTES) {
      return NextResponse.json({ error: "Command payload too large" }, { status: 413 });
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

    if (enterprise.mode === "LIVE_AMAPI") {
      if (!enterprise.serviceAccountEmail || !enterprise.serviceAccountPrivateKey || !device.googleDeviceName) {
        await db.insert(auditLogs).values({
          id: `log-${crypto.randomUUID()}`, enterpriseId: enterprise.id, actor: identity.actor,
          action: `COMMAND_BLOCKED_${commandType}`, resourceType: "DEVICE_COMMAND", resourceId: commandId,
          details: { deviceId: device.id, commandType, reason: "live configuration incomplete" }, status: "FAILURE",
        });
        return NextResponse.json({ error: "Live command blocked: device or enterprise AMAPI configuration is incomplete" }, { status: 503 });
      }

      try {
        const privateKey = decryptText(enterprise.serviceAccountPrivateKey);
        const accessToken = await fetchGoogleAccessToken(enterprise.serviceAccountEmail, privateKey);
        const amapiRes = await callAmapi<{ name?: string }>(`${device.googleDeviceName}:issueCommand`, {
          method: "POST", accessToken, body: { type: commandType, ...commandPayload },
        });
        if (amapiRes?.name) googleOpName = amapiRes.name;
        status = "SENT";
      } catch (gErr: unknown) {
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
        payload: commandPayload, status, googleOperationName: googleOpName, errorMessage,
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

      return NextResponse.json({ success: true, command: createdCommand }, { headers: { "Cache-Control": "no-store" } });
    }

    await db.insert(auditLogs).values({
      id: `log-${crypto.randomUUID()}`, enterpriseId: enterprise.id, actor: identity.actor,
      action: `COMMAND_FAILED_${commandType}`, resourceType: "DEVICE_COMMAND", resourceId: commandId,
      details: { deviceId: device.id, commandType }, status: "FAILURE",
    });
    return NextResponse.json({ success: false, error: "Command failed" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to issue command" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
