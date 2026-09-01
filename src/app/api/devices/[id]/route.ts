import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { devices, policies, deviceCommands, auditLogs, pubsubMessages } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [deviceRow] = await db
      .select({
        device: devices,
        policyName: policies.name,
        policyJson: policies.policyJson,
        policyVersion: policies.version,
      })
      .from(devices)
      .leftJoin(policies, eq(devices.appliedPolicyId, policies.id))
      .where(eq(devices.id, id))
      .limit(1);

    if (!deviceRow) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    // Fetch recent commands
    const commands = await db
      .select()
      .from(deviceCommands)
      .where(eq(deviceCommands.deviceId, id))
      .orderBy(desc(deviceCommands.issuedAt))
      .limit(10);

    // Fetch recent pubsub events
    const pubsubEvents = await db
      .select()
      .from(pubsubMessages)
      .where(eq(pubsubMessages.deviceId, id))
      .orderBy(desc(pubsubMessages.publishTime))
      .limit(10);

    return NextResponse.json({
      device: {
        ...deviceRow.device,
        policyName: deviceRow.policyName,
        policyJson: deviceRow.policyJson,
        policyVersion: deviceRow.policyVersion,
      },
      commands,
      pubsubEvents,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch device details";
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

    const [device] = await db.select().from(devices).where(eq(devices.id, id)).limit(1);
    if (!device) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    const updateData: Partial<typeof devices.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.appliedPolicyId !== undefined) {
      updateData.appliedPolicyId = body.appliedPolicyId;
      // Get policy version
      if (body.appliedPolicyId) {
        const [pol] = await db.select().from(policies).where(eq(policies.id, body.appliedPolicyId)).limit(1);
        if (pol) updateData.appliedPolicyVersion = pol.version;
      }
    }

    if (body.state !== undefined) updateData.state = body.state;
    if (body.appliedState !== undefined) updateData.appliedState = body.appliedState;
    if (body.isCompliant !== undefined) updateData.isCompliant = body.isCompliant;
    if (body.batteryLevel !== undefined) updateData.batteryLevel = body.batteryLevel;
    if (body.batteryStatus !== undefined) updateData.batteryStatus = body.batteryStatus;
    if (body.ipAddress !== undefined) updateData.ipAddress = body.ipAddress;
    if (body.wifiSsid !== undefined) updateData.wifiSsid = body.wifiSsid;

    const [updated] = await db
      .update(devices)
      .set(updateData)
      .where(eq(devices.id, id))
      .returning();

    await db.insert(auditLogs).values({
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      enterpriseId: device.enterpriseId,
      actor: "Console Admin",
      action: "DEVICE_UPDATED",
      resourceType: "DEVICE",
      resourceId: device.id,
      details: body,
      status: "SUCCESS",
    });

    return NextResponse.json({ success: true, device: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update device";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [device] = await db.select().from(devices).where(eq(devices.id, id)).limit(1);
    if (!device) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    await db.delete(devices).where(eq(devices.id, id));

    await db.insert(auditLogs).values({
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      enterpriseId: device.enterpriseId,
      actor: "Console Admin",
      action: "DEVICE_DELETED",
      resourceType: "DEVICE",
      resourceId: id,
      details: {
        model: device.model,
        serialNumber: device.serialNumber,
      },
      status: "SUCCESS",
    });

    return NextResponse.json({ success: true, message: "Device deleted successfully" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete device";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
