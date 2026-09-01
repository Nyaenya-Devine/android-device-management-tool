import { pgTable, text, timestamp, boolean, integer, bigint, jsonb } from "drizzle-orm/pg-core";

export const enterprises = pgTable("enterprises", {
  id: text("id").primaryKey(),
  enterpriseId: text("enterprise_id").notNull().unique(), // e.g. "enterprises/LC03abcd1234"
  name: text("name").notNull(),
  mode: text("mode").notNull().default("SANDBOX"), // "LIVE_AMAPI" | "SANDBOX"
  gcpProjectId: text("gcp_project_id"),
  serviceAccountEmail: text("service_account_email"),
  serviceAccountPrivateKey: text("service_account_private_key"),
  pubsubTopic: text("pubsub_topic"),
  pubsubSubscription: text("pubsub_subscription"),
  signupUrlName: text("signup_url_name"),
  status: text("status").notNull().default("ACTIVE"), // "ACTIVE" | "PENDING_ONBOARDING" | "SUSPENDED"
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const policies = pgTable("policies", {
  id: text("id").primaryKey(),
  enterpriseId: text("enterprise_id").notNull().references(() => enterprises.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  googlePolicyName: text("google_policy_name"), // e.g. "enterprises/LC03.../policies/policy-1"
  description: text("description"),
  version: integer("version").notNull().default(1),
  isDefault: boolean("is_default").notNull().default(false),
  policyJson: jsonb("policy_json").notNull(), // Full Android Management API policy definition
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const enrollmentTokens = pgTable("enrollment_tokens", {
  id: text("id").primaryKey(),
  enterpriseId: text("enterprise_id").notNull().references(() => enterprises.id, { onDelete: "cascade" }),
  policyId: text("policy_id").notNull().references(() => policies.id, { onDelete: "cascade" }),
  tokenValue: text("token_value").notNull().unique(),
  googleTokenName: text("google_token_name"), // e.g. "enterprises/LC03.../enrollmentTokens/..."
  qrCodeData: text("qr_code_data").notNull(), // JSON string for Android CloudDPC QR Provisioning
  allowPersonalUsage: text("allow_personal_usage").notNull().default("PERSONAL_USAGE_DISALLOWED"), // "PERSONAL_USAGE_ALLOWED" | "PERSONAL_USAGE_DISALLOWED"
  durationSec: integer("duration_sec").notNull().default(86400),
  expirationTimestamp: timestamp("expiration_timestamp", { withTimezone: true }).notNull(),
  oneTimeUse: boolean("one_time_use").notNull().default(true),
  status: text("status").notNull().default("ACTIVE"), // "ACTIVE" | "CONSUMED" | "EXPIRED" | "REVOKED"
  wifiSsid: text("wifi_ssid"),
  wifiPassword: text("wifi_password"),
  wifiSecurityType: text("wifi_security_type"), // "NONE" | "WPA" | "WEP"
  wifiHidden: boolean("wifi_hidden").default(false),
  enrolledDeviceId: text("enrolled_device_id"),
  additionalData: text("additional_data"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const devices = pgTable("devices", {
  id: text("id").primaryKey(),
  enterpriseId: text("enterprise_id").notNull().references(() => enterprises.id, { onDelete: "cascade" }),
  googleDeviceName: text("google_device_name"), // e.g. "enterprises/LC03.../devices/dev-..."
  enrollmentTokenId: text("enrollment_token_id").references(() => enrollmentTokens.id, { onDelete: "set null" }),
  appliedPolicyId: text("applied_policy_id").references(() => policies.id, { onDelete: "set null" }),
  appliedPolicyVersion: integer("applied_policy_version").default(1),
  hardwareId: text("hardware_id"),
  serialNumber: text("serial_number").notNull(),
  imei: text("imei"),
  model: text("model").notNull(),
  manufacturer: text("manufacturer").notNull(),
  brand: text("brand"),
  osVersion: text("os_version").notNull(),
  apiLevel: integer("api_level").notNull().default(34),
  securityPatchLevel: text("security_patch_level"),
  managementMode: text("management_mode").notNull().default("FULLY_MANAGED"), // "FULLY_MANAGED" | "WORK_PROFILE" | "DEDICATED"
  state: text("state").notNull().default("ACTIVE"), // "ACTIVE" | "DISABLED" | "DELETED" | "PROVISIONING" | "LOST_MODE"
  appliedState: text("applied_state").default("ACTIVE"),
  isCompliant: boolean("is_compliant").notNull().default(true),
  nonComplianceDetails: jsonb("non_compliance_details"),
  batteryLevel: integer("battery_level").default(85),
  batteryStatus: text("battery_status").default("DISCHARGING"),
  networkType: text("network_type").default("WIFI"),
  ipAddress: text("ip_address").default("192.168.1.142"),
  wifiSsid: text("wifi_ssid").default("Enterprise-Secure-WiFi"),
  totalMemoryBytes: bigint("total_memory_bytes", { mode: "number" }).default(6442450944),
  availableMemoryBytes: bigint("available_memory_bytes", { mode: "number" }).default(3221225472),
  totalInternalStorageBytes: bigint("total_internal_storage_bytes", { mode: "number" }).default(137438953472),
  freeInternalStorageBytes: bigint("free_internal_storage_bytes", { mode: "number" }).default(75161927680),
  installedAppsCount: integer("installed_apps_count").default(38),
  kioskAppPackage: text("kiosk_app_package"),
  lastStatusReportTime: timestamp("last_status_report_time", { withTimezone: true }).notNull().defaultNow(),
  lastSyncTime: timestamp("last_sync_time", { withTimezone: true }).notNull().defaultNow(),
  enrollmentTime: timestamp("enrollment_time", { withTimezone: true }).notNull().defaultNow(),
  rawDeviceReport: jsonb("raw_device_report"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const deviceCommands = pgTable("device_commands", {
  id: text("id").primaryKey(),
  enterpriseId: text("enterprise_id").notNull().references(() => enterprises.id, { onDelete: "cascade" }),
  deviceId: text("device_id").notNull().references(() => devices.id, { onDelete: "cascade" }),
  commandType: text("command_type").notNull(), // "LOCK" | "WIPE" | "REBOOT" | "RELINQUISH_OWNERSHIP" | "DELETE" | "CLEAR_APP_DATA" | "START_LOST_MODE" | "STOP_LOST_MODE" | "RESET_PASSWORD"
  payload: jsonb("payload"),
  status: text("status").notNull().default("PENDING"), // "PENDING" | "SENT" | "EXECUTED" | "FAILED" | "CANCELLED"
  googleOperationName: text("google_operation_name"),
  errorMessage: text("error_message"),
  issuedBy: text("issued_by").notNull().default("IT Administrator"),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  executedAt: timestamp("executed_at", { withTimezone: true }),
});

export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  enterpriseId: text("enterprise_id").notNull().references(() => enterprises.id, { onDelete: "cascade" }),
  actor: text("actor").notNull().default("IT Admin"),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  details: jsonb("details"),
  status: text("status").notNull().default("SUCCESS"), // "SUCCESS" | "FAILURE" | "WARNING"
  ipAddress: text("ip_address").default("127.0.0.1"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pubsubMessages = pgTable("pubsub_messages", {
  id: text("id").primaryKey(),
  enterpriseId: text("enterprise_id").notNull().references(() => enterprises.id, { onDelete: "cascade" }),
  messageId: text("message_id").notNull(),
  publishTime: timestamp("publish_time", { withTimezone: true }).notNull().defaultNow(),
  notificationType: text("notification_type").notNull(), // "ENROLLMENT" | "STATUS_REPORT" | "COMMAND_STATUS" | "NON_COMPLIANCE"
  deviceId: text("device_id"),
  rawPayload: jsonb("raw_payload").notNull(),
  processed: boolean("processed").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
