import QRCode from "qrcode";
import {
  CloudDpcQrBundle,
  AmapiPolicyObject,
  AmapiEnrollmentTokenResponse,
  CommandType,
  PersonalUsageAllowance,
} from "../types/amapi";
import { createGoogleServiceAccountJwt } from "../crypto";

// Google CloudDPC standard constants for Android Enterprise
export const CLOUD_DPC_PACKAGE = "com.google.android.apps.work.clouddpc";
export const CLOUD_DPC_ADMIN_RECEIVER = "com.google.android.apps.work.clouddpc/.receivers.CloudDeviceAdminReceiver";
export const CLOUD_DPC_SIGNATURE_CHECKSUM = "I5YvS0O5hXY46mb01BlRjq4oJJGs2kuUcHvVkAPEXlg";
export const CLOUD_DPC_DOWNLOAD_LOCATION = "https://play.google.com/managed/downloadManagingApp?identifier=setup";
export const CLOUD_DPC_EXTRA_TOKEN_KEY = "com.google.android.apps.work.clouddpc.EXTRA_ENROLLMENT_TOKEN";

const AMAPI_BASE_URL = "https://androidmanagement.googleapis.com/v1";

export interface ProvisioningOptions {
  wifiSsid?: string;
  wifiPassword?: string;
  wifiSecurityType?: "NONE" | "WPA" | "WEP";
  wifiHidden?: boolean;
  locale?: string;
  timeZone?: string;
  skipEncryption?: boolean;
  leaveSystemAppsEnabled?: boolean;
}

/**
 * Generate official Android Enterprise CloudDPC Provisioning QR payload
 */
export function buildCloudDpcQrBundle(
  enrollmentToken: string,
  options?: ProvisioningOptions
): CloudDpcQrBundle {
  const bundle: CloudDpcQrBundle = {
    "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": CLOUD_DPC_ADMIN_RECEIVER,
    "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM": CLOUD_DPC_SIGNATURE_CHECKSUM,
    "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION": CLOUD_DPC_DOWNLOAD_LOCATION,
    "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": {
      [CLOUD_DPC_EXTRA_TOKEN_KEY]: enrollmentToken,
    },
    "android.app.extra.PROVISIONING_LEAVE_ALL_SYSTEM_APPS_ENABLED":
      options?.leaveSystemAppsEnabled !== undefined ? options.leaveSystemAppsEnabled : true,
  };

  if (options?.wifiSsid && options.wifiSsid.trim().length > 0) {
    bundle["android.app.extra.PROVISIONING_WIFI_SSID"] = options.wifiSsid.trim();
    if (options.wifiPassword) {
      bundle["android.app.extra.PROVISIONING_WIFI_PASSWORD"] = options.wifiPassword;
    }
    if (options.wifiSecurityType) {
      bundle["android.app.extra.PROVISIONING_WIFI_SECURITY_TYPE"] = options.wifiSecurityType;
    }
    if (options.wifiHidden) {
      bundle["android.app.extra.PROVISIONING_WIFI_HIDDEN"] = true;
    }
  }

  if (options?.locale) {
    bundle["android.app.extra.PROVISIONING_LOCALE"] = options.locale;
  }
  if (options?.timeZone) {
    bundle["android.app.extra.PROVISIONING_TIME_ZONE"] = options.timeZone;
  }
  if (options?.skipEncryption) {
    bundle["android.app.extra.PROVISIONING_SKIP_ENCRYPTION"] = true;
  }

  return bundle;
}

/**
 * Generate a PNG Data URL for QR Code rendering
 */
export async function generateQrDataUrl(payload: string | object): Promise<string> {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload);
  return await QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 360,
    color: {
      dark: "#0f172a",
      light: "#ffffff",
    },
  });
}

/**
 * Generate SVG string for vector QR Code rendering
 */
export async function generateQrSvg(payload: string | object): Promise<string> {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload);
  return await QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    color: {
      dark: "#0f172a",
      light: "#ffffff",
    },
  });
}

/**
 * Request an OAuth2 Bearer Access Token from Google using Service Account credentials
 */
export async function fetchGoogleAccessToken(
  clientEmail: string,
  privateKey: string
): Promise<string> {
  const jwt = createGoogleServiceAccountJwt(clientEmail, privateKey);

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google OAuth2 Token exchange failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.access_token as string;
}

/**
 * Call Google Android Management API with Bearer Token
 */
export async function callAmapi<T = unknown>(
  endpoint: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    accessToken: string;
    body?: unknown;
  }
): Promise<T> {
  const url = endpoint.startsWith("http") ? endpoint : `${AMAPI_BASE_URL}/${endpoint.replace(/^\//, "")}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.accessToken}`,
    "Content-Type": "application/json",
  };

  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorDetails = await response.text();
    throw new Error(`AMAPI call failed [${options.method || "GET"} ${url}] - HTTP ${response.status}: ${errorDetails}`);
  }

  if (options.method === "DELETE" && response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

/**
 * Helper to build default Android Enterprise policy object
 */
export function createDefaultAmapiPolicy(name: string): AmapiPolicyObject {
  return {
    passwordRequirements: {
      passwordMinimumLength: 6,
      passwordQuality: "NUMERIC_COMPLEX",
      maximumFailedPasswordsForWipe: 10,
    },
    cameraDisabled: false,
    screenCaptureDisabled: false,
    locationMode: "LOCATION_USER_CHOICE",
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
        packageName: "com.google.android.apps.docs",
        installType: "AVAILABLE",
        defaultPermissionPolicy: "PROMPT",
      },
      {
        packageName: "com.google.android.gm",
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
}

/**
 * Validate that an enrollment token or QR bundle complies with Android Enterprise specs
 */
export function validateCloudDpcBundle(bundle: Record<string, unknown>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  const compName = bundle["android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME"];
  if (!compName || compName !== CLOUD_DPC_ADMIN_RECEIVER) {
    errors.push(
      `Invalid PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME. Expected "${CLOUD_DPC_ADMIN_RECEIVER}", received "${compName}"`
    );
  }

  const checksum = bundle["android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM"];
  if (checksum && checksum !== CLOUD_DPC_SIGNATURE_CHECKSUM) {
    errors.push(`Invalid PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM: ${checksum}`);
  }

  const extras = bundle["android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE"] as Record<string, unknown> | undefined;
  if (!extras) {
    errors.push("Missing PROVISIONING_ADMIN_EXTRAS_BUNDLE");
  } else if (!extras[CLOUD_DPC_EXTRA_TOKEN_KEY] || typeof extras[CLOUD_DPC_EXTRA_TOKEN_KEY] !== "string") {
    errors.push(`Missing or invalid ${CLOUD_DPC_EXTRA_TOKEN_KEY} in admin extras bundle`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
