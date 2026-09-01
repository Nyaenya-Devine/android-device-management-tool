"use client";

import React, { useState } from "react";
import {
  Settings,
  Key,
  Globe,
  Radio,
  CheckCircle2,
  AlertTriangle,
  FlaskConical,
  RefreshCw,
  Save,
  HelpCircle,
  ShieldCheck,
} from "lucide-react";

interface EnterpriseSettingsProps {
  enterprise: any;
  onUpdateEnterprise: (data: any) => Promise<any>;
}

export function EnterpriseSettings({ enterprise, onUpdateEnterprise }: EnterpriseSettingsProps) {
  const [name, setName] = useState(enterprise?.name || "");
  const [enterpriseId, setEnterpriseId] = useState(enterprise?.enterpriseId || "enterprises/LC03xyz89enterprise");
  const [mode, setMode] = useState<"LIVE_AMAPI" | "SANDBOX">(enterprise?.mode || "SANDBOX");
  const [gcpProjectId, setGcpProjectId] = useState(enterprise?.gcpProjectId || "apex-mobile-enterprise-2025");
  const [serviceAccountEmail, setServiceAccountEmail] = useState(enterprise?.serviceAccountEmail || "");
  const [serviceAccountPrivateKey, setServiceAccountPrivateKey] = useState("");
  const [pubsubTopic, setPubsubTopic] = useState(enterprise?.pubsubTopic || "projects/apex-mobile-enterprise-2025/topics/amapi-device-telemetry");
  const [pubsubSubscription, setPubsubSubscription] = useState(enterprise?.pubsubSubscription || "projects/apex-mobile-enterprise-2025/subscriptions/amapi-device-sync");

  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onUpdateEnterprise({
        name,
        enterpriseId,
        mode,
        gcpProjectId,
        serviceAccountEmail,
        serviceAccountPrivateKey: serviceAccountPrivateKey.trim() || undefined,
        pubsubTopic,
        pubsubSubscription,
      });
      setTestResult({
        success: true,
        message: "Enterprise settings successfully updated!",
      });
    } catch (err: unknown) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : "Failed to update settings",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/enterprise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceAccountEmail,
          serviceAccountPrivateKey: serviceAccountPrivateKey.trim() || undefined,
          enterpriseId,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: data.amapiMessage || "Successfully authenticated with Google OAuth2!",
          details: data.enterpriseDetails,
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || "Google connection test failed",
        });
      }
    } catch (err: unknown) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : "Network error during test",
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Android Enterprise & AMAPI Settings
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5 max-w-3xl">
          Configure Google Cloud Platform (GCP) credentials, Service Account OAuth2 keys, Pub/Sub webhook topics, and dual-mode runtime behavior.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Mode Selector Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl space-y-4">
          <div className="flex items-center space-x-2.5 border-b border-slate-800 pb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Globe className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Runtime Operation Mode</h2>
              <p className="text-[11px] text-slate-400">Select how Android Management API communicates</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              onClick={() => setMode("SANDBOX")}
              className={`rounded-xl border p-4 cursor-pointer transition-all ${
                mode === "SANDBOX"
                  ? "border-blue-500/60 bg-blue-950/20 shadow-md"
                  : "border-slate-800 bg-slate-950/40 hover:bg-slate-900"
              }`}
            >
              <div className="flex items-center space-x-2 mb-2">
                <FlaskConical className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-bold text-white">Verified Enterprise Sandbox</span>
                <span className="rounded bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-300">
                  Ready Out-of-Box
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Generates authentic Google CloudDPC QR codes, runs deterministic state machines, validates policies, and allows testing without requiring live GCP billing.
              </p>
            </div>

            <div
              onClick={() => setMode("LIVE_AMAPI")}
              className={`rounded-xl border p-4 cursor-pointer transition-all ${
                mode === "LIVE_AMAPI"
                  ? "border-emerald-500/60 bg-emerald-950/20 shadow-md"
                  : "border-slate-800 bg-slate-950/40 hover:bg-slate-900"
              }`}
            >
              <div className="flex items-center space-x-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-bold text-white">Live Google AMAPI Integration</span>
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                  Production Mode
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Connects directly to Google Cloud Android Management API endpoints using your GCP Service Account credentials and Pub/Sub notifications.
              </p>
            </div>
          </div>
        </div>

        {/* Enterprise Identity & GCP Credentials */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl space-y-4">
          <div className="flex items-center space-x-2.5 border-b border-slate-800 pb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Key className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Enterprise Identity & GCP Service Account</h2>
              <p className="text-[11px] text-slate-400">Google Cloud credentials for AMAPI OAuth2</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Organization / Enterprise Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Google Enterprise ID (<code className="text-emerald-400">enterprises/LC...</code>)
              </label>
              <input
                type="text"
                value={enterpriseId}
                onChange={(e) => setEnterpriseId(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-white font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Google Cloud Project ID</label>
              <input
                type="text"
                value={gcpProjectId}
                onChange={(e) => setGcpProjectId(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-white font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Service Account Client Email</label>
              <input
                type="email"
                value={serviceAccountEmail}
                onChange={(e) => setServiceAccountEmail(e.target.value)}
                placeholder="amapi-sa@project-id.iam.gserviceaccount.com"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-white font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-300 mb-1">
                Service Account RSA Private Key (PEM format) {enterprise?.hasPrivateKey ? "(Key Stored Securely - Encrypted)" : ""}
              </label>
              <textarea
                rows={3}
                value={serviceAccountPrivateKey}
                onChange={(e) => setServiceAccountPrivateKey(e.target.value)}
                placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;MIIEowIBAAKCAQEA0...&#10;-----END RSA PRIVATE KEY-----"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-white font-mono text-[11px] focus:border-emerald-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Keys are automatically encrypted at rest using AES-256 before database insertion.
              </p>
            </div>
          </div>
        </div>

        {/* Pub/Sub & Webhook Notifications */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl space-y-4">
          <div className="flex items-center space-x-2.5 border-b border-slate-800 pb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <Radio className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Google Cloud Pub/Sub Webhooks</h2>
              <p className="text-[11px] text-slate-400">Device telemetry push receiver</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Pub/Sub Topic Name</label>
              <input
                type="text"
                value={pubsubTopic}
                onChange={(e) => setPubsubTopic(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-white font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Pub/Sub Subscription</label>
              <input
                type="text"
                value={pubsubSubscription}
                onChange={(e) => setPubsubSubscription(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-white font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-[11px] text-slate-300">
              <span className="font-semibold text-white">Pub/Sub Push Webhook Endpoint URL:</span>
              <p className="font-mono text-emerald-400 mt-1">/api/webhooks/pubsub</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Configure this push endpoint on your Google Cloud Pub/Sub subscription to stream live battery, OS updates, and compliance alerts.
              </p>
            </div>
          </div>
        </div>

        {/* Feedback Banner */}
        {testResult && (
          <div
            className={`rounded-xl p-4 text-xs border ${
              testResult.success
                ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-300"
                : "border-rose-500/40 bg-rose-950/20 text-rose-300"
            }`}
          >
            <div className="flex items-center space-x-2 font-semibold">
              {testResult.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              <span>{testResult.message}</span>
            </div>
          </div>
        )}

        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting}
            className="flex items-center justify-center space-x-2 rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isTesting ? "animate-spin text-emerald-400" : ""}`} />
            <span>{isTesting ? "Verifying OAuth2 Token..." : "Test Google AMAPI Connection"}</span>
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center justify-center space-x-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-semibold text-white shadow-lg shadow-emerald-950/50 hover:bg-emerald-500 transition-all disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? "Saving..." : "Save Enterprise Settings"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
