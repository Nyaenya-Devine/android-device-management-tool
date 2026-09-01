import { db } from "@/db";
import { enterprises, policies, enrollmentTokens, devices, deviceCommands, auditLogs, pubsubMessages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { buildCloudDpcQrBundle, createDefaultAmapiPolicy } from "./amapi/amapi-service";
import { generateEnrollmentTokenString } from "./crypto";

export async function ensureEnterpriseInitialized() {
  try {
    const existingEnterprises = await db.select().from(enterprises).limit(1);
    if (existingEnterprises.length > 0) {
      return existingEnterprises[0];
    }

    const defaultEnterpriseId = "enterprises/LC03xyz89enterprise";
    const enterpriseDbId = "ent-primary-01";

    // 1. Create Default Enterprise
    const [createdEnterprise] = await db
      .insert(enterprises)
      .values({
        id: enterpriseDbId,
        enterpriseId: defaultEnterpriseId,
        name: "Apex Global Android Enterprise",
        mode: "SANDBOX", // default to verified sandbox, switchable to LIVE_AMAPI in Settings
        gcpProjectId: "apex-mobile-enterprise-2025",
        serviceAccountEmail: "amapi-service-account@apex-mobile-enterprise-2025.iam.gserviceaccount.com",
        pubsubTopic: "projects/apex-mobile-enterprise-2025/topics/amapi-device-telemetry",
        pubsubSubscription: "projects/apex-mobile-enterprise-2025/subscriptions/amapi-device-sync",
        status: "ACTIVE",
      })
      .returning();

    // 2. Create Standard Android Enterprise Policies
    const standardPolicyId = "policy-standard-corporate";
    const kioskPolicyId = "policy-rugged-kiosk";
    const byodPolicyId = "policy-byod-work-profile";
    const highSecPolicyId = "policy-high-security-finance";

    const corporatePolicyJson = createDefaultAmapiPolicy("Corporate Standard Policy");
    
    const kioskPolicyJson = {
      ...createDefaultAmapiPolicy("Dedicated Kiosk Policy"),
      kioskCustomLauncherEnabled: true,
      keyguardDisabled: true,
      cameraDisabled: false,
      screenCaptureDisabled: true,
      factoryResetDisabled: true,
      applications: [
        {
          packageName: "com.apex.fieldops.scanner",
          installType: "KIOSK",
          defaultPermissionPolicy: "GRANT",
        },
        {
          packageName: "com.google.android.apps.work.clouddpc",
          installType: "FORCE_INSTALLED",
          defaultPermissionPolicy: "GRANT",
        },
      ],
      systemUpdate: {
        type: "WINDOWED",
        startMinutes: 120,
        endMinutes: 300,
      },
    };

    const byodPolicyJson = {
      passwordRequirements: {
        passwordMinimumLength: 6,
        passwordQuality: "NUMERIC_COMPLEX",
        maximumFailedPasswordsForWipe: 10,
      },
      cameraDisabled: false,
      screenCaptureDisabled: false,
      applications: [
        {
          packageName: "com.google.android.gm",
          installType: "FORCE_INSTALLED",
          defaultPermissionPolicy: "PROMPT",
        },
        {
          packageName: "com.slack",
          installType: "AVAILABLE",
          defaultPermissionPolicy: "PROMPT",
        },
      ],
    };

    const highSecPolicyJson = {
      passwordRequirements: {
        passwordMinimumLength: 10,
        passwordQuality: "COMPLEX",
        maximumFailedPasswordsForWipe: 5,
        passwordExpirationTimeout: "2592000s", // 30 days
      },
      cameraDisabled: true,
      screenCaptureDisabled: true,
      locationMode: "HIGH_ACCURACY",
      bluetoothConfigDisabled: true,
      tetheringConfigDisabled: true,
      mountPhysicalMediaDisabled: true,
      debuggingFeaturesAllowed: false,
      systemUpdate: {
        type: "AUTOMATIC",
      },
      statusReportingSettings: {
        applicationReportsEnabled: true,
        deviceSettingsEnabled: true,
        softwareInfoEnabled: true,
        memoryInfoEnabled: true,
        networkInfoEnabled: true,
        powerManagementEventsEnabled: true,
        hardwareStatusReportsEnabled: true,
        displayInfoEnabled: true,
      },
      applications: [
        {
          packageName: "com.google.android.apps.work.clouddpc",
          installType: "FORCE_INSTALLED",
          defaultPermissionPolicy: "GRANT",
        },
        {
          packageName: "com.google.android.apps.authenticator2",
          installType: "FORCE_INSTALLED",
          defaultPermissionPolicy: "GRANT",
        },
      ],
    };

    await db.insert(policies).values([
      {
        id: standardPolicyId,
        enterpriseId: enterpriseDbId,
        name: "Corporate Standard Policy",
        googlePolicyName: `${defaultEnterpriseId}/policies/corporate-standard`,
        description: "Default enterprise configuration with enforced PIN, automated app updates, and telemetry reporting.",
        version: 3,
        isDefault: true,
        policyJson: corporatePolicyJson,
      },
      {
        id: kioskPolicyId,
        enterpriseId: enterpriseDbId,
        name: "Dedicated Field Kiosk Policy",
        googlePolicyName: `${defaultEnterpriseId}/policies/field-kiosk`,
        description: "Locked down single-app kiosk for Zebra & Honeywell rugged warehouse handhelds.",
        version: 2,
        isDefault: false,
        policyJson: kioskPolicyJson,
      },
      {
        id: byodPolicyId,
        enterpriseId: enterpriseDbId,
        name: "BYOD Work Profile Policy",
        googlePolicyName: `${defaultEnterpriseId}/policies/byod-work-profile`,
        description: "Enables secure enterprise container separation for employee-owned personal Android devices.",
        version: 1,
        isDefault: false,
        policyJson: byodPolicyJson,
      },
      {
        id: highSecPolicyId,
        enterpriseId: enterpriseDbId,
        name: "High Security Executive & Finance Policy",
        googlePolicyName: `${defaultEnterpriseId}/policies/high-security`,
        description: "Zero-trust policy with camera disablement, biometric requirement, and physical media blocking.",
        version: 4,
        isDefault: false,
        policyJson: highSecPolicyJson,
      },
    ]);

    // 3. Create Enrollment Tokens with Official CloudDPC QR Bundles
    const token1 = generateEnrollmentTokenString();
    const token2 = generateEnrollmentTokenString();
    const token3 = generateEnrollmentTokenString();

    const qr1 = buildCloudDpcQrBundle(token1, {
      wifiSsid: "Apex-HQ-Secure",
      wifiPassword: "EnterpriseSecurePass2025!",
      wifiSecurityType: "WPA",
      leaveSystemAppsEnabled: true,
    });

    const qr2 = buildCloudDpcQrBundle(token2, {
      wifiSsid: "Apex-Warehouse-WLAN",
      wifiPassword: "ScannerWifiWPA3!",
      wifiSecurityType: "WPA",
      leaveSystemAppsEnabled: false,
    });

    const qr3 = buildCloudDpcQrBundle(token3, {
      leaveSystemAppsEnabled: true,
    });

    const now = new Date();
    const expire1 = new Date(now.getTime() + 86400 * 1000 * 14); // 14 days
    const expire2 = new Date(now.getTime() + 86400 * 1000 * 7); // 7 days
    const expire3 = new Date(now.getTime() + 86400 * 1000 * 30); // 30 days

    await db.insert(enrollmentTokens).values([
      {
        id: "tok-standard-corp-01",
        enterpriseId: enterpriseDbId,
        policyId: standardPolicyId,
        tokenValue: token1,
        googleTokenName: `${defaultEnterpriseId}/enrollmentTokens/${token1}`,
        qrCodeData: JSON.stringify(qr1, null, 2),
        allowPersonalUsage: "PERSONAL_USAGE_DISALLOWED",
        durationSec: 86400 * 14,
        expirationTimestamp: expire1,
        oneTimeUse: false,
        status: "ACTIVE",
        wifiSsid: "Apex-HQ-Secure",
        wifiPassword: "EnterpriseSecurePass2025!",
        wifiSecurityType: "WPA",
        additionalData: "Corporate HQ Rollout - Batch A",
      },
      {
        id: "tok-kiosk-rugged-02",
        enterpriseId: enterpriseDbId,
        policyId: kioskPolicyId,
        tokenValue: token2,
        googleTokenName: `${defaultEnterpriseId}/enrollmentTokens/${token2}`,
        qrCodeData: JSON.stringify(qr2, null, 2),
        allowPersonalUsage: "PERSONAL_USAGE_DISALLOWED",
        durationSec: 86400 * 7,
        expirationTimestamp: expire2,
        oneTimeUse: false,
        status: "ACTIVE",
        wifiSsid: "Apex-Warehouse-WLAN",
        wifiPassword: "ScannerWifiWPA3!",
        wifiSecurityType: "WPA",
        additionalData: "Warehouse Logistics Barcode Scanners",
      },
      {
        id: "tok-byod-flex-03",
        enterpriseId: enterpriseDbId,
        policyId: byodPolicyId,
        tokenValue: token3,
        googleTokenName: `${defaultEnterpriseId}/enrollmentTokens/${token3}`,
        qrCodeData: JSON.stringify(qr3, null, 2),
        allowPersonalUsage: "PERSONAL_USAGE_ALLOWED",
        durationSec: 86400 * 30,
        expirationTimestamp: expire3,
        oneTimeUse: true,
        status: "ACTIVE",
        additionalData: "Employee BYOD Work Profile Setup",
      },
    ]);

    // 4. Create Initial Device Fleet
    await db.insert(devices).values([
      {
        id: "dev-px8-001",
        enterpriseId: enterpriseDbId,
        googleDeviceName: `${defaultEnterpriseId}/devices/4fa839b201`,
        enrollmentTokenId: "tok-standard-corp-01",
        appliedPolicyId: standardPolicyId,
        appliedPolicyVersion: 3,
        hardwareId: "google-husky-01",
        serialNumber: "983PX8A72001",
        imei: "358923091823901",
        model: "Pixel 8 Pro",
        manufacturer: "Google",
        brand: "Google",
        osVersion: "Android 15 (AP2A.240805.005)",
        apiLevel: 35,
        securityPatchLevel: "2025-02-01",
        managementMode: "FULLY_MANAGED",
        state: "ACTIVE",
        appliedState: "ACTIVE",
        isCompliant: true,
        batteryLevel: 92,
        batteryStatus: "CHARGING",
        networkType: "WIFI",
        ipAddress: "10.0.4.120",
        wifiSsid: "Apex-HQ-Secure",
        totalMemoryBytes: 12884901888,
        availableMemoryBytes: 6442450944,
        totalInternalStorageBytes: 274877906944,
        freeInternalStorageBytes: 182536110080,
        installedAppsCount: 46,
        lastStatusReportTime: new Date(),
        lastSyncTime: new Date(),
        enrollmentTime: new Date(Date.now() - 86400000 * 12),
      },
      {
        id: "dev-s24u-002",
        enterpriseId: enterpriseDbId,
        googleDeviceName: `${defaultEnterpriseId}/devices/7bc910d502`,
        enrollmentTokenId: "tok-standard-corp-01",
        appliedPolicyId: standardPolicyId,
        appliedPolicyVersion: 3,
        hardwareId: "samsung-e3q-02",
        serialNumber: "R5CW209KL12",
        imei: "356781094829104",
        model: "Galaxy S24 Ultra",
        manufacturer: "Samsung",
        brand: "Samsung",
        osVersion: "Android 14 (OneUI 6.1)",
        apiLevel: 34,
        securityPatchLevel: "2025-01-05",
        managementMode: "FULLY_MANAGED",
        state: "ACTIVE",
        appliedState: "ACTIVE",
        isCompliant: true,
        batteryLevel: 78,
        batteryStatus: "DISCHARGING",
        networkType: "CELLULAR_5G",
        ipAddress: "172.56.21.90",
        wifiSsid: "Apex-HQ-Secure",
        totalMemoryBytes: 12884901888,
        availableMemoryBytes: 5368709120,
        totalInternalStorageBytes: 549755813888,
        freeInternalStorageBytes: 412316860416,
        installedAppsCount: 52,
        lastStatusReportTime: new Date(Date.now() - 1000 * 60 * 15),
        lastSyncTime: new Date(Date.now() - 1000 * 60 * 15),
        enrollmentTime: new Date(Date.now() - 86400000 * 20),
      },
      {
        id: "dev-zebra-tc57-003",
        enterpriseId: enterpriseDbId,
        googleDeviceName: `${defaultEnterpriseId}/devices/3ab491e803`,
        enrollmentTokenId: "tok-kiosk-rugged-02",
        appliedPolicyId: kioskPolicyId,
        appliedPolicyVersion: 2,
        hardwareId: "zebra-tc57x-03",
        serialNumber: "212905224D0182",
        imei: "861947040982311",
        model: "TC57 Rugged Touch Computer",
        manufacturer: "Zebra Technologies",
        brand: "Zebra",
        osVersion: "Android 13 Enterprise GMS",
        apiLevel: 33,
        securityPatchLevel: "2025-01-01",
        managementMode: "DEDICATED",
        state: "ACTIVE",
        appliedState: "ACTIVE",
        isCompliant: true,
        kioskAppPackage: "com.apex.fieldops.scanner",
        batteryLevel: 64,
        batteryStatus: "DISCHARGING",
        networkType: "WIFI",
        ipAddress: "10.0.12.44",
        wifiSsid: "Apex-Warehouse-WLAN",
        totalMemoryBytes: 4294967296,
        availableMemoryBytes: 1879048192,
        totalInternalStorageBytes: 68719476736,
        freeInternalStorageBytes: 42949672960,
        installedAppsCount: 19,
        lastStatusReportTime: new Date(Date.now() - 1000 * 60 * 4),
        lastSyncTime: new Date(Date.now() - 1000 * 60 * 4),
        enrollmentTime: new Date(Date.now() - 86400000 * 45),
      },
      {
        id: "dev-pixel7-byod-004",
        enterpriseId: enterpriseDbId,
        googleDeviceName: `${defaultEnterpriseId}/devices/9ef102a704`,
        enrollmentTokenId: "tok-byod-flex-03",
        appliedPolicyId: byodPolicyId,
        appliedPolicyVersion: 1,
        hardwareId: "google-panther-04",
        serialNumber: "29181JEGR02910",
        imei: "354921098271049",
        model: "Pixel 7",
        manufacturer: "Google",
        brand: "Google",
        osVersion: "Android 14",
        apiLevel: 34,
        securityPatchLevel: "2024-12-01",
        managementMode: "WORK_PROFILE",
        state: "ACTIVE",
        appliedState: "ACTIVE",
        isCompliant: true,
        batteryLevel: 45,
        batteryStatus: "DISCHARGING",
        networkType: "WIFI",
        ipAddress: "192.168.1.88",
        wifiSsid: "Home-Fiber-5G",
        totalMemoryBytes: 8589934592,
        availableMemoryBytes: 3758096384,
        totalInternalStorageBytes: 137438953472,
        freeInternalStorageBytes: 64424509440,
        installedAppsCount: 65,
        lastStatusReportTime: new Date(Date.now() - 1000 * 60 * 40),
        lastSyncTime: new Date(Date.now() - 1000 * 60 * 40),
        enrollmentTime: new Date(Date.now() - 86400000 * 8),
      },
      {
        id: "dev-thinkphone-005",
        enterpriseId: enterpriseDbId,
        googleDeviceName: `${defaultEnterpriseId}/devices/1ce847b905`,
        enrollmentTokenId: "tok-standard-corp-01",
        appliedPolicyId: highSecPolicyId,
        appliedPolicyVersion: 4,
        hardwareId: "motorola-bronco-05",
        serialNumber: "ZY22G8TKQ3",
        imei: "351029481920491",
        model: "ThinkPhone by Motorola",
        manufacturer: "Motorola Mobility LLC",
        brand: "Motorola",
        osVersion: "Android 14 Enterprise ThinkShield",
        apiLevel: 34,
        securityPatchLevel: "2025-02-05",
        managementMode: "FULLY_MANAGED",
        state: "ACTIVE",
        appliedState: "ACTIVE",
        isCompliant: true,
        batteryLevel: 89,
        batteryStatus: "DISCHARGING",
        networkType: "WIFI",
        ipAddress: "10.0.4.155",
        wifiSsid: "Apex-HQ-Secure",
        totalMemoryBytes: 8589934592,
        availableMemoryBytes: 4294967296,
        totalInternalStorageBytes: 274877906944,
        freeInternalStorageBytes: 204010946560,
        installedAppsCount: 34,
        lastStatusReportTime: new Date(Date.now() - 1000 * 60 * 8),
        lastSyncTime: new Date(Date.now() - 1000 * 60 * 8),
        enrollmentTime: new Date(Date.now() - 86400000 * 5),
      },
    ]);

    // 5. Initial Device Commands & Audit Logs
    await db.insert(deviceCommands).values([
      {
        id: "cmd-lock-001",
        enterpriseId: enterpriseDbId,
        deviceId: "dev-px8-001",
        commandType: "LOCK",
        payload: { reason: "Routine Security Verification" },
        status: "EXECUTED",
        googleOperationName: `${defaultEnterpriseId}/operations/op-lock-991`,
        issuedBy: "SecOps Lead (Admin)",
        issuedAt: new Date(Date.now() - 1000 * 60 * 120),
        executedAt: new Date(Date.now() - 1000 * 60 * 119),
      },
      {
        id: "cmd-reboot-002",
        enterpriseId: enterpriseDbId,
        deviceId: "dev-zebra-tc57-003",
        commandType: "REBOOT",
        payload: { reason: "Nightly Warehouse Scanner Maintenance" },
        status: "EXECUTED",
        googleOperationName: `${defaultEnterpriseId}/operations/op-reboot-442`,
        issuedBy: "Automated Maintenance Job",
        issuedAt: new Date(Date.now() - 1000 * 60 * 300),
        executedAt: new Date(Date.now() - 1000 * 60 * 298),
      },
    ]);

    await db.insert(auditLogs).values([
      {
        id: "log-init-01",
        enterpriseId: enterpriseDbId,
        actor: "System Initializer",
        action: "ENTERPRISE_INITIALIZED",
        resourceType: "ENTERPRISE",
        resourceId: enterpriseDbId,
        details: { name: "Apex Global Android Enterprise", mode: "SANDBOX" },
        status: "SUCCESS",
      },
      {
        id: "log-token-02",
        enterpriseId: enterpriseDbId,
        actor: "Admin (console)",
        action: "ENROLLMENT_TOKEN_CREATED",
        resourceType: "ENROLLMENT_TOKEN",
        resourceId: "tok-standard-corp-01",
        details: { policyId: standardPolicyId, durationDays: 14, wifiConfigured: true },
        status: "SUCCESS",
      },
      {
        id: "log-dev-03",
        enterpriseId: enterpriseDbId,
        actor: "CloudDPC Provisioner",
        action: "DEVICE_ENROLLED",
        resourceType: "DEVICE",
        resourceId: "dev-px8-001",
        details: { model: "Pixel 8 Pro", serial: "983PX8A72001", mode: "FULLY_MANAGED" },
        status: "SUCCESS",
      },
    ]);

    await db.insert(pubsubMessages).values([
      {
        id: "pubsub-init-01",
        enterpriseId: enterpriseDbId,
        messageId: "gcp-msg-8829104",
        publishTime: new Date(Date.now() - 1000 * 60 * 5),
        notificationType: "STATUS_REPORT",
        deviceId: "dev-px8-001",
        rawPayload: {
          enterprise: defaultEnterpriseId,
          device: `${defaultEnterpriseId}/devices/4fa839b201`,
          event: "STATUS_REPORT_RECEIVED",
          batteryLevel: 92,
          networkState: "CONNECTED_WIFI",
        },
        processed: true,
      },
    ]);

    return createdEnterprise;
  } catch (err) {
    console.error("Error during enterprise initialization:", err);
    throw err;
  }
}
