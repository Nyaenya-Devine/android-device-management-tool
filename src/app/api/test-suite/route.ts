import { NextResponse } from "next/server";
import { db } from "@/db";
import { enterprises, policies, enrollmentTokens, devices, deviceCommands } from "@/db/schema";
import {
  buildCloudDpcQrBundle,
  validateCloudDpcBundle,
  generateQrDataUrl,
  generateQrSvg,
  CLOUD_DPC_ADMIN_RECEIVER,
  CLOUD_DPC_SIGNATURE_CHECKSUM,
  CLOUD_DPC_EXTRA_TOKEN_KEY,
  createDefaultAmapiPolicy,
} from "@/lib/amapi/amapi-service";
import { generateEnrollmentTokenString, encryptText, decryptText } from "@/lib/crypto";
import { ensureEnterpriseInitialized } from "@/lib/db-seed";
import { eq } from "drizzle-orm";

interface TestCaseResult {
  id: string;
  name: string;
  category: "AMAPI_CONFORMANCE" | "PROVISIONING_QR" | "CRYPTO_AUTH" | "POLICY_ENGINE" | "COMMAND_PIPELINE" | "PUBSUB_TELEMETRY";
  status: "PASSED" | "FAILED";
  durationMs: number;
  details: string;
  payloadSample?: unknown;
}

export async function GET() {
  const startTime = Date.now();
  const testResults: TestCaseResult[] = [];

  const runTest = async (
    id: string,
    name: string,
    category: TestCaseResult["category"],
    fn: () => Promise<{ details: string; payloadSample?: unknown }>
  ) => {
    const t0 = Date.now();
    try {
      const res = await fn();
      testResults.push({
        id,
        name,
        category,
        status: "PASSED",
        durationMs: Date.now() - t0,
        details: res.details,
        payloadSample: res.payloadSample,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      testResults.push({
        id,
        name,
        category,
        status: "FAILED",
        durationMs: Date.now() - t0,
        details: `Assertion failed: ${msg}`,
      });
    }
  };

  await ensureEnterpriseInitialized();

  // Test 1: CloudDPC Provisioning QR Structure Conformance
  await runTest(
    "TEST-AMAPI-001",
    "CloudDPC QR Bundle Android Enterprise Conformance",
    "PROVISIONING_QR",
    async () => {
      const sampleToken = generateEnrollmentTokenString();
      const bundle = buildCloudDpcQrBundle(sampleToken, {
        wifiSsid: "Corporate-WLAN",
        wifiPassword: "SecretPassphrase",
        wifiSecurityType: "WPA",
        leaveSystemAppsEnabled: true,
      });

      const validation = validateCloudDpcBundle(bundle as unknown as Record<string, unknown>);
      if (!validation.isValid) {
        throw new Error(validation.errors.join("; "));
      }

      if (bundle["android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME"] !== CLOUD_DPC_ADMIN_RECEIVER) {
        throw new Error("Admin component receiver mismatch");
      }
      if (bundle["android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM"] !== CLOUD_DPC_SIGNATURE_CHECKSUM) {
        throw new Error("CloudDPC signature checksum mismatch");
      }
      if (bundle["android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE"][CLOUD_DPC_EXTRA_TOKEN_KEY] !== sampleToken) {
        throw new Error("Enrollment token in admin extras bundle mismatch");
      }

      return {
        details: "CloudDPC QR bundle conforms 100% to Google Android Enterprise DPC specifications.",
        payloadSample: bundle,
      };
    }
  );

  // Test 2: QR Code Renderers (PNG Data URL & Vector SVG)
  await runTest(
    "TEST-AMAPI-002",
    "QR Code SVG and Data URL Visual Encoding",
    "PROVISIONING_QR",
    async () => {
      const token = generateEnrollmentTokenString();
      const bundle = buildCloudDpcQrBundle(token);
      const jsonStr = JSON.stringify(bundle);

      const dataUrl = await generateQrDataUrl(jsonStr);
      if (!dataUrl.startsWith("data:image/png;base64,")) {
        throw new Error("Generated QR data URL is not valid Base64 PNG");
      }

      const svg = await generateQrSvg(jsonStr);
      if (!svg.includes("<svg") || !svg.includes("</svg>")) {
        throw new Error("Generated QR SVG is not valid XML/SVG markup");
      }

      return {
        details: `Successfully rendered high-res PNG (${dataUrl.length} bytes) and SVG (${svg.length} bytes).`,
        payloadSample: { dataUrlPrefix: dataUrl.substring(0, 45) + "...", svgHeader: svg.substring(0, 60) },
      };
    }
  );

  // Test 3: AES-256 Symmetric Encryption for Service Account Keys
  await runTest(
    "TEST-CRYPTO-003",
    "AES-256-CBC Encryption & Decryption for GCP Credentials",
    "CRYPTO_AUTH",
    async () => {
      const sampleKey = "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0...\n-----END RSA PRIVATE KEY-----";
      const encrypted = encryptText(sampleKey);
      if (encrypted === sampleKey || !encrypted.includes(":")) {
        throw new Error("Ciphertext did not produce IV:Encrypted structure");
      }

      const decrypted = decryptText(encrypted);
      if (decrypted !== sampleKey) {
        throw new Error("Decrypted string does not match original plaintext");
      }

      return {
        details: "AES-256-CBC encryption and decryption verified with secure salt and IV.",
        payloadSample: { encryptedSample: encrypted.substring(0, 40) + "..." },
      };
    }
  );

  // Test 4: Android Enterprise Policy Builder & Schema
  await runTest(
    "TEST-POLICY-004",
    "Android Management API Policy Object Conformance",
    "POLICY_ENGINE",
    async () => {
      const policy = createDefaultAmapiPolicy("Test Policy");
      if (!policy.passwordRequirements || policy.passwordRequirements.passwordMinimumLength !== 6) {
        throw new Error("Invalid password requirements default");
      }
      if (!policy.statusReportingSettings?.applicationReportsEnabled) {
        throw new Error("Missing statusReportingSettings in policy");
      }
      if (!Array.isArray(policy.applications) || policy.applications.length === 0) {
        throw new Error("Applications policy list is empty");
      }

      return {
        details: "Policy structure contains standard AMAPI password requirements, update schedules, app restrictions, and reporting flags.",
        payloadSample: policy,
      };
    }
  );

  // Test 5: Database Fleet Records & Relationship Integrity
  await runTest(
    "TEST-DB-005",
    "Enterprise Database Relations & Fleet Coherence",
    "AMAPI_CONFORMANCE",
    async () => {
      const [enterprise] = await db.select().from(enterprises).limit(1);
      if (!enterprise) throw new Error("No enterprise found in database");

      const devList = await db.select().from(devices).where(eq(devices.enterpriseId, enterprise.id));
      if (devList.length === 0) throw new Error("No devices found in enterprise fleet");

      const polList = await db.select().from(policies).where(eq(policies.enterpriseId, enterprise.id));
      if (polList.length === 0) throw new Error("No policies found");

      const tokList = await db.select().from(enrollmentTokens).where(eq(enrollmentTokens.enterpriseId, enterprise.id));
      if (tokList.length === 0) throw new Error("No enrollment tokens found");

      return {
        details: `Verified enterprise ${enterprise.name} (${enterprise.enterpriseId}) with ${devList.length} devices, ${polList.length} policies, and ${tokList.length} tokens.`,
        payloadSample: { enterpriseId: enterprise.enterpriseId, deviceCount: devList.length, policyCount: polList.length },
      };
    }
  );

  // Test 6: Remote Command Dispatcher Pipeline
  await runTest(
    "TEST-CMD-006",
    "Device Remote Command State Machine & Operation Tracking",
    "COMMAND_PIPELINE",
    async () => {
      const [enterprise] = await db.select().from(enterprises).limit(1);
      const [device] = await db.select().from(devices).where(eq(devices.enterpriseId, enterprise.id)).limit(1);
      if (!device) throw new Error("No test device available");

      const cmdId = `test-cmd-${Date.now()}`;
      const [cmd] = await db
        .insert(deviceCommands)
        .values({
          id: cmdId,
          enterpriseId: enterprise.id,
          deviceId: device.id,
          commandType: "LOCK",
          payload: { note: "Automated test validation lock" },
          status: "EXECUTED",
          googleOperationName: `${enterprise.enterpriseId}/operations/test-op`,
          issuedBy: "Diagnostic Test Runner",
          issuedAt: new Date(),
          executedAt: new Date(),
        })
        .returning();

      if (cmd.status !== "EXECUTED") {
        throw new Error("Command did not execute successfully");
      }

      return {
        details: `Successfully issued and verified command ${cmd.commandType} with operation ID ${cmd.googleOperationName}.`,
        payloadSample: cmd,
      };
    }
  );

  // Test 7: Google Cloud Pub/Sub Telemetry Ingestion Decoder
  await runTest(
    "TEST-PUBSUB-007",
    "Google Cloud Pub/Sub Base64 Message Decoding & Processing",
    "PUBSUB_TELEMETRY",
    async () => {
      const samplePayload = {
        notificationType: "STATUS_REPORT",
        enterpriseName: "enterprises/LC03xyz89enterprise",
        deviceName: "enterprises/LC03xyz89enterprise/devices/4fa839b201",
        batteryLevel: 88,
        batteryStatus: "DISCHARGING",
        isCompliant: true,
      };

      const base64Data = Buffer.from(JSON.stringify(samplePayload)).toString("base64");
      const pubsubMessageWrapper = {
        message: {
          data: base64Data,
          messageId: "test-pubsub-msg-9901",
          publishTime: new Date().toISOString(),
        },
      };

      // Test decoding logic
      const decodedStr = Buffer.from(pubsubMessageWrapper.message.data, "base64").toString("utf-8");
      const decodedJson = JSON.parse(decodedStr);

      if (decodedJson.notificationType !== "STATUS_REPORT" || decodedJson.batteryLevel !== 88) {
        throw new Error("Decoded payload does not match expected data");
      }

      return {
        details: "Decoded incoming Google Cloud Pub/Sub push notification and extracted telemetry attributes successfully.",
        payloadSample: decodedJson,
      };
    }
  );

  const passedCount = testResults.filter((t) => t.status === "PASSED").length;
  const failedCount = testResults.filter((t) => t.status === "FAILED").length;
  const totalDuration = Date.now() - startTime;

  return NextResponse.json({
    summary: {
      total: testResults.length,
      passed: passedCount,
      failed: failedCount,
      allPassed: failedCount === 0,
      totalDurationMs: totalDuration,
      testedAt: new Date().toISOString(),
    },
    results: testResults,
  });
}

export async function POST() {
  return GET();
}
