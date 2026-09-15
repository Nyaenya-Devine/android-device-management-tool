import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";

export type ApiRole = "viewer" | "operator" | "admin" | "security_analyst";

export type ApiIdentity = {
  actor: string;
  role: ApiRole;
};

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function bearer(req: NextRequest, header = "authorization"): string | null {
  const value = req.headers.get(header)?.trim();
  if (!value || !value.toLowerCase().startsWith("bearer ")) return null;
  const token = value.slice(7).trim();
  return token && token.length <= 512 ? token : null;
}

function configuredIdentity(prefix: "MDM_API" | "MDM_APPROVER"): ApiIdentity | null {
  const token = process.env[`${prefix}_TOKEN`];
  const actor = process.env[`${prefix}_ACTOR`];
  const role = process.env[`${prefix}_ROLE`] as ApiRole | undefined;
  if (!token || !actor || !role) return null;
  if (!/^[a-z_]+$/.test(role)) return null;
  if (actor.length > 100 || token.length > 512) return null;
  return { actor, role };
}

export function authenticateApiRequest(req: NextRequest): ApiIdentity | null {
  const configured = configuredIdentity("MDM_API");
  const supplied = bearer(req);
  if (!configured || !supplied || !safeEqual(supplied, process.env.MDM_API_TOKEN!)) return null;
  return configured;
}

export function authenticateApprover(req: NextRequest): ApiIdentity | null {
  const configured = configuredIdentity("MDM_APPROVER");
  const supplied = bearer(req, "x-mdm-approval-authorization");
  if (!configured || !supplied || !safeEqual(supplied, process.env.MDM_APPROVER_TOKEN!)) return null;
  return configured;
}

export function canIssueCommand(role: ApiRole, commandType: string): boolean {
  if (role === "admin") return true;
  if (role === "operator") {
    return !["WIPE", "RELINQUISH_OWNERSHIP", "RESET_PASSWORD"].includes(commandType);
  }
  return false;
}

export function requiresDualControl(commandType: string): boolean {
  return ["WIPE", "RELINQUISH_OWNERSHIP", "RESET_PASSWORD"].includes(commandType);
}
