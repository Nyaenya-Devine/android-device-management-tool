import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { devices, policies, enterprises, auditLogs } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { ensureEnterpriseInitialized } from "@/lib/db-seed";
import { authenticateApiRequest } from "@/lib/api-auth";

const MAX_QUERY = 100;
const VALID_MODES = ["FULLY_MANAGED", "WORK_PROFILE", "DEDICATED"] as const;

type ManagementMode = typeof VALID_MODES[number];

function boundedString(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length <= max ? value.trim() : null;
}

export async function GET(req: NextRequest) {
  if (!authenticateApiRequest(req)) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  try {
    await ensureEnterpriseInitialized();
    const entList = await db.select().from(enterprises).limit(1);
    if (!entList.length) return NextResponse.json({ error: "Enterprise not initialized" }, { status: 404 });
    const enterprise = entList[0];

    const { searchParams } = new URL(req.url);
    const filter = boundedString(searchParams.get("filter"), 32);
    const q = boundedString(searchParams.get("q"), MAX_QUERY);

    const rows = await db
      .select({ device: devices, policyName: policies.name })
      .from(devices)
      .leftJoin(policies, eq(devices.appliedPolicyId, policies.id))
      .where(eq(devices.enterpriseId, enterprise.id))
      .orderBy(desc(devices.lastStatusReportTime));

    let filtered = rows.map((r) => ({ ...r.device, policyName: r.policyName || "No Policy Assigned" }));

    if (filter && filter !== "ALL") {
      if (filter === "NON_COMPLIANT") filtered = filtered.filter((d) => !d.isCompliant);
      else if (filter === "LOST_MODE") filtered = filtered.filter((d) => d.state === "LOST_MODE");
      else if (VALID_MODES.includes(filter as ManagementMode)) filtered = filtered.filter((d) => d.managementMode === filter);
      else return NextResponse.json({ error: "Invalid filter" }, { status: 400 });
    }

    if (q) {
      const term = q.toLowerCase();
      filtered = filtered.filter((d) =>
        d.model.toLowerCase().includes(term) ||
        d.manufacturer.toLowerCase().includes(term) ||
        d.serialNumber.toLowerCase().includes(term) ||
        (d.imei && d.imei.toLowerCase().includes(term)) ||
        d.policyName.toLowerCase().includes(term) ||
        d.id.toLowerCase().includes(term)
      );
    }

    return NextResponse.json({ devices: filtered }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to fetch devices" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const identity = authenticateApiRequest(req);
  if (!identity) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  if (identity.role !== "admin" && identity.role !== "operator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await ensureEnterpriseInitialized();
    const entList = await db.select().from(enterprises).limit(1);
    if (!entList.length) return NextResponse.json({ error: "Enterprise not initialized" }, { status: 404 });
    const enterprise = entList[0];

    const rawBody = await req.text();
    if (Buffer.byteLength(rawBody, "utf8") > 16_384) {
      return NextResponse.json({ error: "Request payload too large" }, { status: 413 });
    }
    let body: Record<string, unknown>;
    try {
      const parsed = JSON.parse(rawBody);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const model = boundedString(body.model, 120);
    const manufacturer = boundedString(body.manufacturer, 120);
    const serialNumber = boundedString(body.serialNumber, 200);
    const imei = body.imei == null ? null : boundedString(body.imei, 32);
    const osVersion = body.osVersion == null ? "Android 15 Enterprise" : boundedString(body.osVersion, 80);
    const managementMode = body.managementMode == null ? "FULLY_MANAGED" : boundedString(body.managementMode, 32);
    const policyId = body.policyId == null ? null : boundedString(body.policyId, 200);

    if (!model || !manufacturer || !serialNumber || !osVersion || !managementMode ||
        !VALID_MODES.includes(managementMode as ManagementMode)) {
      return NextResponse.json({ error: "Invalid device registration fields" }, { status: 400 });
    }

    let appliedPolicyId = policyId;
    if (appliedPolicyId) {
      const [policy] = await db.select({ id: policies.id }).from(policies)
        .where(and(eq(policies.id, appliedPolicyId), eq(policies.enterpriseId, enterprise.id))).limit(1);
      if (!policy) return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    } else {
      const [defaultPol] = await db.select().from(policies)
        .where(and(eq(policies.enterpriseId, enterprise.id), eq(policies.isDefault, true))).limit(1);
      appliedPolicyId = defaultPol?.id || null;
    }

    const deviceId = `dev-${crypto.randomUUID()}`;
    const googleDeviceName = `${enterprise.enterpriseId}/devices/${deviceId}`;

    const [created] = await db.insert(devices).values({
      id: deviceId,
      enterpriseId: enterprise.id,
      googleDeviceName,
      appliedPolicyId,
      hardwareId: `${manufacturer.toLowerCase()}-${model.toLowerCase().replace(/\s+/g, "-")}`.slice(0, 250),
      serialNumber,
      imei,
      model,
      manufacturer,
      brand: manufacturer,
      osVersion,
      apiLevel: 35,
      securityPatchLevel: "2025-02-01",
      managementMode: managementMode as ManagementMode,
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
    }).returning();

    await db.insert(auditLogs).values({
      id: `log-${crypto.randomUUID()}`,
      enterpriseId: enterprise.id,
      actor: identity.actor,
      action: "DEVICE_REGISTERED_MANUAL",
      resourceType: "DEVICE",
      resourceId: created.id,
      details: { model, serialNumber, managementMode },
      status: "SUCCESS",
    });

    return NextResponse.json({ success: true, device: created }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Failed to register device" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
