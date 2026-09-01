export type ManagementMode = "FULLY_MANAGED" | "WORK_PROFILE" | "DEDICATED";
export type DeviceState = "ACTIVE" | "DISABLED" | "DELETED" | "PROVISIONING" | "LOST_MODE";
export type PersonalUsageAllowance = "PERSONAL_USAGE_ALLOWED" | "PERSONAL_USAGE_DISALLOWED";
export type TokenStatus = "ACTIVE" | "CONSUMED" | "EXPIRED" | "REVOKED";
export type CommandType =
  | "LOCK"
  | "WIPE"
  | "REBOOT"
  | "RELINQUISH_OWNERSHIP"
  | "DELETE"
  | "CLEAR_APP_DATA"
  | "START_LOST_MODE"
  | "STOP_LOST_MODE"
  | "RESET_PASSWORD";

export type CommandStatus = "PENDING" | "SENT" | "EXECUTED" | "FAILED" | "CANCELLED";

export interface PasswordRequirements {
  passwordMinimumLength?: number;
  passwordQuality?:
    | "PASSWORD_QUALITY_UNSPECIFIED"
    | "BIOMETRIC_WEAK"
    | "SOMETHING"
    | "NUMERIC"
    | "NUMERIC_COMPLEX"
    | "ALPHABETIC"
    | "ALPHANUMERIC"
    | "COMPLEX";
  maximumFailedPasswordsForWipe?: number;
  passwordExpirationTimeout?: string;
  passwordHistoryLength?: number;
}

export interface SystemUpdatePolicy {
  type: "SYSTEM_UPDATE_TYPE_UNSPECIFIED" | "AUTOMATIC" | "WINDOWED" | "POSTPONE";
  startMinutes?: number;
  endMinutes?: number;
  freezePeriods?: Array<{
    startDate: { month: number; day: number };
    endDate: { month: number; day: number };
  }>;
}

export interface ApplicationPolicy {
  packageName: string;
  installType: "FORCE_INSTALLED" | "AVAILABLE" | "REQUIRED_FOR_SETUP" | "BLOCKED" | "KIOSK";
  defaultPermissionPolicy?: "PERMISSION_POLICY_UNSPECIFIED" | "GRANT" | "PROMPT" | "DENY";
  managedConfiguration?: Record<string, unknown>;
  delegatedScopes?: string[];
  autoUpdateMode?: "AUTO_UPDATE_MODE_UNSPECIFIED" | "AUTO_UPDATE_DEFAULT" | "AUTO_UPDATE_POSTPONED" | "AUTO_UPDATE_HIGH_PRIORITY";
}

export interface StatusReportingSettings {
  applicationReportsEnabled?: boolean;
  deviceSettingsEnabled?: boolean;
  softwareInfoEnabled?: boolean;
  memoryInfoEnabled?: boolean;
  networkInfoEnabled?: boolean;
  powerManagementEventsEnabled?: boolean;
  hardwareStatusReportsEnabled?: boolean;
  displayInfoEnabled?: boolean;
}

export interface AmapiPolicyObject {
  passwordRequirements?: PasswordRequirements;
  cameraDisabled?: boolean;
  screenCaptureDisabled?: boolean;
  locationMode?: "LOCATION_MODE_UNSPECIFIED" | "HIGH_ACCURACY" | "LOCATION_ENFORCED" | "LOCATION_USER_CHOICE" | "LOCATION_DISABLED";
  bluetoothConfigDisabled?: boolean;
  wifiConfigDisabled?: boolean;
  cellBroadcastsConfigDisabled?: boolean;
  credentialsConfigDisabled?: boolean;
  mobileNetworksConfigDisabled?: boolean;
  tetheringConfigDisabled?: boolean;
  vpnConfigDisabled?: boolean;
  systemUpdate?: SystemUpdatePolicy;
  applications?: ApplicationPolicy[];
  statusReportingSettings?: StatusReportingSettings;
  keyguardDisabled?: boolean;
  keyguardDisabledFeatures?: string[];
  kioskCustomLauncherEnabled?: boolean;
  safeBootDisabled?: boolean;
  factoryResetDisabled?: boolean;
  addUserDisabled?: boolean;
  removeUserDisabled?: boolean;
  debuggingFeaturesAllowed?: boolean;
  funDisabled?: boolean;
  autoTimeRequired?: boolean;
  mountPhysicalMediaDisabled?: boolean;
}

export interface CloudDpcQrBundle {
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": string;
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM"?: string;
  "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION"?: string;
  "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": {
    "com.google.android.apps.work.clouddpc.EXTRA_ENROLLMENT_TOKEN": string;
    [key: string]: string | undefined;
  };
  "android.app.extra.PROVISIONING_LOCALE"?: string;
  "android.app.extra.PROVISIONING_TIME_ZONE"?: string;
  "android.app.extra.PROVISIONING_WIFI_SSID"?: string;
  "android.app.extra.PROVISIONING_WIFI_PASSWORD"?: string;
  "android.app.extra.PROVISIONING_WIFI_SECURITY_TYPE"?: "NONE" | "WPA" | "WEP";
  "android.app.extra.PROVISIONING_WIFI_HIDDEN"?: boolean;
  "android.app.extra.PROVISIONING_SKIP_ENCRYPTION"?: boolean;
  "android.app.extra.PROVISIONING_LEAVE_ALL_SYSTEM_APPS_ENABLED"?: boolean;
}

export interface PubSubNotificationData {
  enterpriseName: string;
  deviceName?: string;
  notificationType: "ENROLLMENT" | "STATUS_REPORT" | "COMMAND_STATUS" | "NON_COMPLIANCE";
  timestamp?: string;
  details?: Record<string, unknown>;
}

export interface GoogleServiceAccountKey {
  type: "service_account";
  project_id: string;
  private_key_id?: string;
  private_key: string;
  client_email: string;
  client_id?: string;
  auth_uri?: string;
  token_uri?: string;
  auth_provider_x509_cert_url?: string;
  client_x509_cert_url?: string;
}

export interface AmapiEnrollmentTokenResponse {
  name: string;
  value: string;
  duration: string;
  expirationTimestamp: string;
  policyName: string;
  qrCode?: string;
  allowPersonalUsage?: PersonalUsageAllowance;
  oneTimeOnly?: boolean;
  additionalData?: string;
}

export interface AuditLogItem {
  id: string;
  enterpriseId: string;
  actor: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  details?: Record<string, unknown> | null;
  status: "SUCCESS" | "FAILURE" | "WARNING";
  ipAddress?: string | null;
  createdAt: Date;
}
