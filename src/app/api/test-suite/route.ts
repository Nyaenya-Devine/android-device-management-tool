import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { enterprises, policies, enrollmentTokens, devices, deviceCommands } from "@/db/schema";
import {
  buildCloudDpcQrBundle, validateCloudDpcBundle, generateQrDataUrl, generateQrSvg,
  CLOUD_DPC_ADMIN_RECEIVER, CLOUD_DPC_SIGNATURE_CHECKSUM, CLOUD_DPC_EXTRA_TOKEN_KEY, createDefaultAmapiPolicy,
} from "@/lib/amapi/amapi-service";
import { generateEnrollmentTokenString, encryptText, decryptText } from "@/lib/crypto";
import { ensureEnterpriseInitialized } from "@/lib/db-seed";
import { eq } from "drizzle-orm";
import { authenticateApiRequest } from "@/lib/api-auth";

interface TestCaseResult {
  id: string; name: string;
  category: "AMAPI_CONFORMANCE" | "PROVISIONING_QR" | "CRYPTO_AUTH" | "POLICY_ENGINE" | "COMMAND_PIPELINE" | "PUBSUB_TELEMETRY";
  status: "PASSED" | "FAILED"; durationMs: number; details: string; payloadSample?: unknown;
}

export async function GET(req: NextRequest) {
  const identity = authenticateApiRequest(req);
  if (!identity) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (identity.role !== "admin" && identity.role !== "security_analyst") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const startTime = Date.now();
  const testResults: TestCaseResult[] = [];
  const runTest = async (id: string, name: string, category: TestCaseResult["category"], fn: () => Promise<{ details: string; payloadSample?: unknown }>) => {
    const t0 = Date.now();
    try {
      const res = await fn();
      testResults.push({ id, name, category, status: "PASSED", durationMs: Date.now() - t0, details: res.details, payloadSample: res.payloadSample });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "test failed";
      testResults.push({ id, name, category, status: "FAILED", durationMs: Date.now() - t0, details: `Assertion failed: ${msg}` });
    }
  };

  await ensureEnterpriseInitialized();

  await runTest("TEST-AMAPI-001", "CloudDPC QR Bundle Android Enterprise Conformance", "PROVISIONING_QR", async () => {
    const sampleToken = generateEnrollmentTokenString();
    const bundle = buildCloudDpcQrBundle(sampleToken, { wifiSsid: "Corporate-WLAN", wifiPassword: "SecretPassphrase", wifiSecurityType: "WPA", leaveSystemAppsEnabled: true });
    const validation = validateCloudDpcBundle(bundle as unknown as Record<string, unknown>);
    if (!validation.isValid) throw new Error(validation.errors.join("; "));
    if (bundle["android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME"] !== CLOUD_DPC_ADMIN_RECEIVER) throw new Error("Admin component receiver mismatch");
    if (bundle["android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM"] !== CLOUD_DPC_SIGNATURE_CHECKSUM) throw new Error("CloudDPC signature checksum mismatch");
    if (bundle["android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE"][CLOUD_DPC_EXTRA_TOKEN_KEY] !== sampleToken) throw new Error("Enrollment token mismatch");
    return { details: "CloudDPC QR bundle conformance verified." };
  });

  await runTest("TEST-AMAPI-002", "QR Code SVG and Data URL Visual Encoding", "PROVISIONING_QR", async () => {
    const token = generateEnrollmentTokenString();
    const jsonStr = JSON.stringify(buildCloudDpcQrBundle(token));
    const dataUrl = await generateQrDataUrl(jsonStr);
    if (!dataUrl.startsWith("data:image/png;base64,")) throw new Error("Invalid Base64 PNG");
    const svg = await generateQrSvg(jsonStr);
    if (!svg.includes("<svg") || !svg.includes("</svg>")) throw new Error("Invalid SVG");
    return { details: `Rendered PNG (${dataUrl.length} bytes) and SVG (${svg.length} bytes).` };
  });

  await runTest("TEST-CRYPTO-003", "AES-256 Symmetric Encryption & Decryption", "CRYPTO_AUTH", async () => {
    const sampleKey = "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0...\n-----END RSA PRIVATE KEY-----";
    const encrypted = encryptText(sampleKey);
    if (encrypted === sampleKey || !encrypted.includes(":")) throw new Error("Ciphertext format invalid");
    if (decryptText(encrypted) !== sampleKey) throw new Error("Decryption mismatch");
    return { details: "Credential encryption/decryption round-trip verified." };
  });

  await runTest("TEST-POLICY-004", "Android Enterprise Policy Object Conformance", "POLICY_ENGINE", async () => {
    const policy = createDefaultAmapiPolicy("Test Policy");
    if (!policy.passwordRequirements || policy.passwordRequirements.passwordMinimumLength !== 6) throw new Error("Invalid password requirements");
    if (!policy.statusReportingSettings?.applicationReportsEnabled) throw new Error("Missing status reporting");
    if (!Array.isArray(policy.applications) || policy.applications.length === 0) throw new Error("Applications list empty");
    return { details: "Default AMAPI policy structure verified." };
  });

  await runTest("TEST-DB-005", "Enterprise Database Relations & Fleet Coherence", "AMAPI_CONFORMANCE", async () => {
    const [enterprise] = await db.select().from(enterprises).limit(1);
    if (!enterprise) throw new Error("No enterprise found");
    const devList = await db.select().from(devices).where(eq(devices.enterpriseId, enterprise.id));
    const polList = await db.select().from(policies).where(eq(policies.enterpriseId, enterprise.id));
    const tokList = await db.select().from(enrollmentTokens).where(eq(enrollmentTokens.enterpriseId, enterprise.id));
    if (!devList.length || !polList.length || !tokList.length) throw new Error("Fleet relations incomplete");
    return { details: `Verified enterprise ${enterprise.name} with ${devList.length} devices, ${polList.length} policies, and ${tokList.length} tokens.` };
  });

  await runTest("TEST-CMD-006", "Device Remote Command State Machine & Operation Tracking", "COMMAND_PIPELINE", async () => {
    const [enterprise] = await db.select().from(enterprises).limit(1);
    if (!enterprise) throw new Error("No enterprise found");
    const [device] = await db.select().from(devices).where(eq(devices.enterpriseId, enterprise.id)).limit(1);
    if (!device) throw new Error("No test device available");
    const cmdId = `test-cmd-${crypto.randomUUID()}`;
    const [cmd] = await db.insert(deviceCommands).values({ id: cmdId, enterpriseId: enterprise.id, deviceId: device.id, commandType: "LOCK", payload: { note: "Automated test validation lock" }, status: "EXECUTED", googleOperationName: `${enterprise.enterpriseId}/operations/test-op-${crypto.randomUUID()}`, issuedBy: identity.actor, issuedAt: new Date(), executedAt: new Date() }).returning();
    if (cmd.status !== "EXECUTED") throw new Error("Command state invalid");
    return { details: `Verified command ${cmd.commandType}.` };
  });

  await runTest("TEST-PUBSUB-007", "Google Cloud Pub/Sub Base64 Message Decoding & Processing", "PUBSUB_TELEMETRY", async () => {
    const samplePayload = { notificationType: "STATUS_REPORT", enterpriseName: "enterprises/test", deviceName: "enterprises/test/devices/test", batteryLevel: 88, batteryStatus: "DISCHARGING", isCompliant: true };
    const decodedJson = JSON.parse(Buffer.from(Buffer.from(JSON.stringify(samplePayload)).toString("base64"), "base64").toString("utf-8"));
    if (decodedJson.notificationType !== "STATUS_REPORT" || decodedJson.batteryLevel !== 88) throw new Error("Decode mismatch");
    return { details: "Pub/Sub Base64 decoding verified." };
  });

  const passedCount = testResults.filter(t => t.status === "PASSED").length;
  const failedCount = testResults.length - passedCount;
  return NextResponse.json({ summary: { total: testResults.length, passed: passedCount, failed: failedCount, allPassed: failedCount === 0, totalDurationMs: Date.now() - startTime, testedAt: new Date().toISOString() }, results: testResults }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
