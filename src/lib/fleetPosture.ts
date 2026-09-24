export type PostureSeverity = "healthy" | "attention" | "high" | "critical";

export interface FleetDeviceSignal {
  id: string;
  isCompliant?: boolean | null;
  state?: string | null;
  apiLevel?: number | null;
  securityPatchLevel?: string | Date | null;
  lastStatusReportTime?: string | Date | null;
  appliedPolicyId?: string | null;
  policyName?: string | null;
}

export interface PostureFinding {
  code: "NON_COMPLIANT" | "LOST_MODE" | "WIPE_PENDING" | "PATCH_STALE" | "CHECKIN_STALE" | "POLICY_MISSING" | "OS_UNSUPPORTED";
  severity: Exclude<PostureSeverity, "healthy">;
  message: string;
  remediation: string;
}

export interface DevicePosture {
  deviceId: string;
  severity: PostureSeverity;
  score: number;
  findings: PostureFinding[];
}

const severityRank: Record<PostureSeverity, number> = { healthy: 0, attention: 1, high: 2, critical: 3 };

function ageDays(value: string | Date | null | undefined, now: number): number | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(parsed) ? Math.max(0, (now - parsed) / 86_400_000) : null;
}

export function evaluateDevicePosture(device: FleetDeviceSignal, now = Date.now()): DevicePosture {
  const findings: PostureFinding[] = [];
  if (device.state === "LOST_MODE") findings.push({ code: "LOST_MODE", severity: "critical", message: "Device is in lost mode.", remediation: "Confirm custody, preserve evidence, and restrict access." });
  if (device.state === "WIPE_PENDING") findings.push({ code: "WIPE_PENDING", severity: "critical", message: "A destructive wipe is pending.", remediation: "Verify authorization, connectivity, FRP handling, and rollback impossibility." });
  if (device.isCompliant === false) findings.push({ code: "NON_COMPLIANT", severity: "high", message: "Device fails its assigned compliance policy.", remediation: "Inspect failed rules before changing access or policy." });

  const patchAge = ageDays(device.securityPatchLevel, now);
  if (patchAge !== null && patchAge > 120) findings.push({ code: "PATCH_STALE", severity: patchAge > 240 ? "critical" : "high", message: `Security patch is ${Math.floor(patchAge)} days old.`, remediation: "Move through a pilot update ring, then enforce the approved maintenance window." });

  const checkinAge = ageDays(device.lastStatusReportTime, now);
  if (checkinAge !== null && checkinAge > 3) findings.push({ code: "CHECKIN_STALE", severity: checkinAge > 14 ? "high" : "attention", message: `Last posture report was ${Math.floor(checkinAge)} days ago.`, remediation: "Check network reachability and Android Device Policy health before issuing commands." });

  if (!device.appliedPolicyId && (!device.policyName || device.policyName === "No Policy Assigned")) findings.push({ code: "POLICY_MISSING", severity: "high", message: "No effective policy is assigned.", remediation: "Assign an approved baseline immediately to avoid AMAPI quarantine or drift." });
  if (typeof device.apiLevel === "number" && device.apiLevel < 29) findings.push({ code: "OS_UNSUPPORTED", severity: "critical", message: "OS is below the Device Trust support floor.", remediation: "Upgrade or retire the device; do not grant conditional access based on unavailable posture signals." });

  let severity: PostureSeverity = "healthy";
  for (const finding of findings) if (severityRank[finding.severity] > severityRank[severity]) severity = finding.severity;
  const deductions = findings.reduce((sum, finding) => sum + ({ attention: 8, high: 22, critical: 40 }[finding.severity]), 0);
  return { deviceId: device.id, severity, score: Math.max(0, 100 - deductions), findings };
}

export function summarizeFleetPosture(devices: FleetDeviceSignal[], now = Date.now()) {
  const assessments = devices.map((device) => evaluateDevicePosture(device, now));
  const counts: Record<PostureSeverity, number> = { healthy: 0, attention: 0, high: 0, critical: 0 };
  for (const assessment of assessments) counts[assessment.severity]++;
  const averageScore = assessments.length ? Math.round(assessments.reduce((sum, item) => sum + item.score, 0) / assessments.length) : 100;
  return { assessments, counts, averageScore, requiresAction: counts.critical + counts.high };
}
