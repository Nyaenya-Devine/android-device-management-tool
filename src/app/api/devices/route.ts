import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { devices, policies, enterprises, auditLogs } from "@/db/schema";
import { eq, desc, and, or, ilike } from "drizzle-orm";
import { ensureEnterpriseInitialized } from "@/lib/db-seed";

export async function GET(req: NextRequest) {
  try {
    await ensureEnterpriseInitialized();
    const entList = await db.select().from(enterprises).limit(1);
    if (!entList.length) {
      return NextResponse.json({ error: "Enterprise not initialized" }, { status: 404 });
    }
    const enterprise = entList[0];

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter"); // ALL, FULLY_MANAGED, WORK_PROFILE, DEDICATED, NON_COMPLIANT, LOST_MODE
    const q = searchParams.get("q");

    const query = db
      .select({
        device: devices,
        policyName: policies.name,
      })
      .from(devices)
      .leftJoin(policies, eq(devices.appliedPolicyId, policies.id))
      .where(eq(devices.enterpriseId, enterprise.id))
      .orderBy(desc(devices.lastStatusReportTime));

    const rows = await query;

    let filtered = rows.map((r) => ({
      ...r.device,
      policyName: r.policyName || "No Policy Assigned",
    }));

    if (filter && filter !== "ALL") {
      if (filter === "NON_COMPLIANT") {
        filtered = filtered.filter((d) => !d.isCompliant);
      } else if (filter === "LOST_MODE") {
        filtered = filtered.filter((d) => d.state === "LOST_MODE");
      } else if (["FULLY_MANAGED", "WORK_PROFILE", "DEDICATED"].includes(filter)) {
        filtered = filtered.filter((d) => d.managementMode === filter);
      }
    }

    if (q && q.trim().length > 0) {
      const term = q.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.model.toLowerCase().includes(term) ||
          d.manufacturer.toLowerCase().includes(term) ||
          d.serialNumber.toLowerCase().includes(term) ||
          (d.imei && d.imei.toLowerCase().includes(term)) ||
          d.policyName.toLowerCase().includes(term) ||
          d.id.toLowerCase().includes(term)
      );
    }

    return NextResponse.json({ devices: filtered });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch devices";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureEnterpriseInitialized();
    const entList = await db.select().from(enterprises).limit(1);
    if (!entList.length) {
      return NextResponse.json({ error: "Enterprise not initialized" }, { status: 404 });
    }
    const enterprise = entList[0];

    const body = await req.json();
    const {
      model,
      manufacturer,
      serialNumber,
      imei,
      managementMode = "FULLY_MANAGED",
      policyId,
      osVersion = "Android 15 Enterprise",
    } = body;

    if (!model || !manufacturer || !serialNumber) {
      return NextResponse.json(
        { error: "Model, manufacturer, and serial number are required" },
        { status: 400 }
      );
    }

    const deviceId = `dev-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const googleDeviceName = `${enterprise.enterpriseId}/devices/${deviceId}`;

    let appliedPolicyId = policyId;
    if (!appliedPolicyId) {
      const [defaultPol] = await db
        .select()
        .from(policies)
        .where(and(eq(policies.enterpriseId, enterprise.id), eq(policies.isDefault, true)))
        .limit(1);
      appliedPolicyId = defaultPol?.id || null;
    }

    const [created] = await db
      .insert(devices)
      .values({
        id: deviceId,
        enterpriseId: enterprise.id,
        googleDeviceName,
        appliedPolicyId,
        hardwareId: `${manufacturer.toLowerCase()}-${model.toLowerCase().replace(/\s+/g, "-")}`,
        serialNumber,
        imei: imei || null,
        model,
        manufacturer,
        brand: manufacturer,
        osVersion,
        apiLevel: 35,
        securityPatchLevel: "2025-02-01",
        managementMode,
        state: "ACTIVE",
        appliedState: "ACTIVE",
        isCompliant: true,
        batteryLevel: 95,
        batteryStatus: "DISCHARGING",
        networkType: "WIFI",
        ipAddress: "192.168.1.180",
        wifiSsid: "Apex-HQ-Secure",
        totalMemoryBytes: 8589934592,
        availableMemoryBytes: 5368709120,
        totalInternalStorageBytes: 137438953472,
        freeInternalStorageBytes: 94489280512,
        installedAppsCount: 36,
        lastStatusReportTime: new Date(),
        lastSyncTime: new Date(),
        enrollmentTime: new Date(),
      })
      .returning();

    await db.insert(auditLogs).values({
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      enterpriseId: enterprise.id,
      actor: "Console Admin",
      action: "DEVICE_REGISTERED_MANUAL",
      resourceType: "DEVICE",
      resourceId: created.id,
      details: { model, serialNumber, managementMode },
      status: "SUCCESS",
    });

    return NextResponse.json({ success: true, device: created });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to register device";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
