import { describe, expect, it } from "vitest";
import { evaluateDevicePosture, summarizeFleetPosture } from "./fleetPosture";

const now = Date.parse("2026-09-25T12:00:00Z");

describe("fleet posture", () => {
  it("keeps current, compliant and governed devices healthy", () => {
    const result = evaluateDevicePosture({ id: "d1", isCompliant: true, state: "ACTIVE", apiLevel: 35, securityPatchLevel: "2026-09-01", lastStatusReportTime: "2026-09-25", appliedPolicyId: "p1" }, now);
    expect(result.severity).toBe("healthy");
    expect(result.score).toBe(100);
  });

  it("makes a pending wipe critical and explains the control", () => {
    const result = evaluateDevicePosture({ id: "d2", state: "WIPE_PENDING", isCompliant: true, appliedPolicyId: "p1" }, now);
    expect(result.severity).toBe("critical");
    expect(result.findings[0].remediation).toMatch(/authorization/);
  });

  it("flags stale patches, missing policy and check-in drift", () => {
    const result = evaluateDevicePosture({ id: "d3", state: "ACTIVE", isCompliant: false, apiLevel: 34, securityPatchLevel: "2025-01-01", lastStatusReportTime: "2026-08-01", policyName: "No Policy Assigned" }, now);
    expect(result.severity).toBe("critical");
    expect(result.findings.map((f) => f.code)).toEqual(expect.arrayContaining(["PATCH_STALE", "POLICY_MISSING", "CHECKIN_STALE", "NON_COMPLIANT"]));
  });

  it("summarizes action pressure without hiding empty fleets", () => {
    expect(summarizeFleetPosture([], now).averageScore).toBe(100);
    const summary = summarizeFleetPosture([
      { id: "ok", isCompliant: true, state: "ACTIVE", apiLevel: 35, securityPatchLevel: "2026-09-01", lastStatusReportTime: "2026-09-25", appliedPolicyId: "p1" },
      { id: "risk", state: "LOST_MODE", appliedPolicyId: "p1" },
    ], now);
    expect(summary.counts.critical).toBe(1);
    expect(summary.requiresAction).toBe(1);
  });
});
