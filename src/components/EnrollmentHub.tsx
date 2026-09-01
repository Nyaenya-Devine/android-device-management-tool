"use client";

import React, { useState } from "react";
import {
  QrCode,
  Shield,
  Wifi,
  Clock,
  Download,
  Copy,
  Check,
  Smartphone,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FlaskConical,
} from "lucide-react";

interface EnrollmentHubProps {
  tokens: any[];
  policies: any[];
  onGenerateToken: (tokenData: any) => Promise<any>;
  onRevokeToken: (tokenId: string) => Promise<void>;
  onTestEnrollToken: (token: any) => void;
}

export function EnrollmentHub({
  tokens,
  policies,
  onGenerateToken,
  onRevokeToken,
  onTestEnrollToken,
}: EnrollmentHubProps) {
  const [selectedPolicyId, setSelectedPolicyId] = useState(policies[0]?.id || "");
  const [durationDays, setDurationDays] = useState(7);
  const [allowPersonalUsage, setAllowPersonalUsage] = useState<"PERSONAL_USAGE_DISALLOWED" | "PERSONAL_USAGE_ALLOWED">("PERSONAL_USAGE_DISALLOWED");
  const [oneTimeUse, setOneTimeUse] = useState(false);
  const [wifiSsid, setWifiSsid] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [wifiSecurityType, setWifiSecurityType] = useState<"WPA" | "WEP" | "NONE">("WPA");
  const [additionalData, setAdditionalData] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTokenModal, setActiveTokenModal] = useState<any>(tokens[0] || null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      const created = await onGenerateToken({
        policyId: selectedPolicyId || policies[0]?.id,
        durationDays,
        allowPersonalUsage,
        oneTimeUse,
        wifiSsid: wifiSsid.trim() || undefined,
        wifiPassword: wifiPassword || undefined,
        wifiSecurityType,
        additionalData: additionalData.trim() || undefined,
      });
      if (created?.token) {
        setActiveTokenModal(created.token);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const downloadDataUrl = (dataUrl: string, filename: string) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    a.click();
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Android Enterprise Enrollment & CloudDPC QR Hub
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl">
          Generate official Android Management API enrollment tokens and 6-tap CloudDPC QR codes. Provision fully managed company devices, dedicated kiosk terminals, or BYOD employee work profiles.
        </p>
      </div>

      {/* Main 2-Column Layout: Token Creator & Live QR Code Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 cols): Token Creator Form */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl space-y-5">
          <div className="flex items-center space-x-2.5 border-b border-slate-800 pb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Plus className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Create Provisioning Token</h2>
              <p className="text-[11px] text-slate-400">Generates CloudDPC QR payload</p>
            </div>
          </div>

          <form onSubmit={handleGenerate} className="space-y-4 text-xs">
            {/* Policy Selection */}
            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">
                Target Enterprise Policy <span className="text-emerald-400">*</span>
              </label>
              <select
                value={selectedPolicyId}
                onChange={(e) => setSelectedPolicyId(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
              >
                {policies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.isDefault ? "(Default)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Management Mode & Personal Usage */}
            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">
                Ownership & Personal Usage Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAllowPersonalUsage("PERSONAL_USAGE_DISALLOWED")}
                  className={`rounded-xl border p-2.5 text-left transition-all ${
                    allowPersonalUsage === "PERSONAL_USAGE_DISALLOWED"
                      ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
                      : "border-slate-800 bg-slate-800/40 text-slate-400 hover:bg-slate-800"
                  }`}
                >
                  <div className="font-semibold text-[11px] text-white">Company Owned</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Fully Managed / Kiosk</div>
                </button>

                <button
                  type="button"
                  onClick={() => setAllowPersonalUsage("PERSONAL_USAGE_ALLOWED")}
                  className={`rounded-xl border p-2.5 text-left transition-all ${
                    allowPersonalUsage === "PERSONAL_USAGE_ALLOWED"
                      ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
                      : "border-slate-800 bg-slate-800/40 text-slate-400 hover:bg-slate-800"
                  }`}
                >
                  <div className="font-semibold text-[11px] text-white">Work Profile (BYOD)</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Personal usage allowed</div>
                </button>
              </div>
            </div>

            {/* Token Lifespan Duration */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">
                  Token Validity Duration
                </label>
                <select
                  value={durationDays}
                  onChange={(e) => setDurationDays(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value={1}>1 Day (24 Hours)</option>
                  <option value={7}>7 Days (1 Week)</option>
                  <option value={14}>14 Days (2 Weeks)</option>
                  <option value={30}>30 Days (1 Month)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">
                  Usage Limit
                </label>
                <select
                  value={oneTimeUse ? "true" : "false"}
                  onChange={(e) => setOneTimeUse(e.target.value === "true")}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="false">Multi-Device Reusable</option>
                  <option value="true">Single-Use Token</option>
                </select>
              </div>
            </div>

            {/* Optional Pre-set WiFi */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3.5 space-y-3">
              <div className="flex items-center space-x-1.5 text-slate-300 font-semibold text-[11px]">
                <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                <span>Pre-configure Device WiFi in QR (Optional)</span>
              </div>
              <p className="text-[10px] text-slate-400">
                Allows devices to automatically connect to WiFi during the 6-tap setup screen without manual SSID entry.
              </p>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <input
                    type="text"
                    value={wifiSsid}
                    onChange={(e) => setWifiSsid(e.target.value)}
                    placeholder="WiFi SSID (e.g. Corp-WLAN)"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/80 p-2 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <input
                    type="password"
                    value={wifiPassword}
                    onChange={(e) => setWifiPassword(e.target.value)}
                    placeholder="WiFi Password"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/80 p-2 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Additional Tag */}
            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Batch Description / Tag (Optional)
              </label>
              <input
                type="text"
                value={additionalData}
                onChange={(e) => setAdditionalData(e.target.value)}
                placeholder="e.g., Warehouse Logistics Rugged Handhelds Q1"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/90 p-2 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isGenerating}
              className="w-full rounded-xl bg-emerald-600 py-2.5 font-semibold text-white shadow-lg shadow-emerald-950/50 hover:bg-emerald-500 transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              <QrCode className="h-4 w-4" />
              <span>{isGenerating ? "Generating AMAPI Token..." : "Generate CloudDPC QR Code"}</span>
            </button>
          </form>
        </div>

        {/* Right Column (7 cols): Live CloudDPC QR Viewer & Provisioning Instructions */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl space-y-6">
          {activeTokenModal ? (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center space-x-2">
                    <QrCode className="h-5 w-5 text-emerald-400" />
                    <span>Android Enterprise Provisioning QR Code</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Policy: <span className="text-emerald-400 font-medium">{activeTokenModal.policyName}</span>
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onTestEnrollToken(activeTokenModal)}
                    className="flex items-center space-x-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
                  >
                    <FlaskConical className="h-3.5 w-3.5" />
                    <span>Test Pair Device</span>
                  </button>
                </div>
              </div>

              {/* QR Image & Quick Metadata */}
              <div className="flex flex-col sm:flex-row items-center gap-6 rounded-xl border border-slate-800 bg-slate-950/60 p-5">
                {/* QR Visual */}
                <div className="relative rounded-2xl bg-white p-3 shadow-2xl flex-shrink-0">
                  {activeTokenModal.qrDataUrl ? (
                    <img
                      src={activeTokenModal.qrDataUrl}
                      alt="Android Enterprise CloudDPC QR Code"
                      className="h-48 w-48 rounded-lg"
                    />
                  ) : (
                    <div className="h-48 w-48 flex items-center justify-center bg-slate-100 text-slate-400 text-xs">
                      Rendering QR...
                    </div>
                  )}
                </div>

                {/* Meta details & Buttons */}
                <div className="space-y-3 flex-1 text-xs">
                  <div>
                    <span className="text-[10px] font-semibold uppercase text-slate-500">Enrollment Token Value</span>
                    <div className="mt-0.5 flex items-center space-x-2 font-mono text-emerald-300 font-bold bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800">
                      <span className="truncate">{activeTokenModal.tokenValue}</span>
                      <button
                        onClick={() => copyToClipboard(activeTokenModal.tokenValue, "tokval")}
                        className="text-slate-400 hover:text-white shrink-0"
                      >
                        {copiedKey === "tokval" ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                    <div className="rounded-lg bg-slate-900/80 p-2">
                      <span className="text-slate-500 block text-[10px]">Expires</span>
                      <span>{new Date(activeTokenModal.expirationTimestamp).toLocaleDateString()}</span>
                    </div>

                    <div className="rounded-lg bg-slate-900/80 p-2">
                      <span className="text-slate-500 block text-[10px]">WiFi Preset</span>
                      <span>{activeTokenModal.wifiSsid || "None (Manual)"}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {activeTokenModal.qrDataUrl && (
                      <button
                        onClick={() => downloadDataUrl(activeTokenModal.qrDataUrl, `amapi-qr-${activeTokenModal.tokenValue}.png`)}
                        className="flex items-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 font-medium text-slate-200 hover:bg-slate-700 transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>PNG</span>
                      </button>
                    )}

                    <button
                      onClick={() => copyToClipboard(activeTokenModal.qrCodeData, "qrjson")}
                      className="flex items-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 font-medium text-slate-200 hover:bg-slate-700 transition-colors"
                    >
                      {copiedKey === "qrjson" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>Copy CloudDPC JSON</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 6-Tap Android Device Provisioning Instructions */}
              <div className="rounded-xl border border-emerald-950/40 bg-emerald-950/10 p-4 space-y-2.5">
                <h4 className="text-xs font-bold text-emerald-400 flex items-center space-x-1.5">
                  <Smartphone className="h-4 w-4" />
                  <span>How to Provision Any Android Device (6-Tap Setup Method)</span>
                </h4>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-300">
                  <li>Power on a new or factory reset Android device running Android 7.0+.</li>
                  <li>At the initial <strong>Welcome / Hi There</strong> setup screen, tap anywhere on the screen <strong>6 times</strong> in the same spot.</li>
                  <li>The device automatically activates the Android Enterprise QR Code setup scanner.</li>
                  <li>Scan the QR code displayed above. The device downloads <strong>Google CloudDPC</strong> and enforces policy automatically.</li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400">
              <QrCode className="h-12 w-12 text-slate-600 mb-2" />
              <p className="text-sm font-semibold text-slate-300">No token selected</p>
              <p className="text-xs">Create a token on the left or select an existing token below.</p>
            </div>
          )}
        </div>
      </div>

      {/* Active Enrollment Tokens Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Active Enrollment Tokens</h2>
            <p className="text-xs text-slate-400">Tokens available for CloudDPC provisioning</p>
          </div>
          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">
            {tokens.length} Total Tokens
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-3 font-semibold">Token Value</th>
                <th className="pb-3 font-semibold">Applied Policy</th>
                <th className="pb-3 font-semibold">Personal Usage</th>
                <th className="pb-3 font-semibold">WiFi SSID</th>
                <th className="pb-3 font-semibold">Expiration</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {tokens.map((token) => {
                const isSelected = activeTokenModal?.id === token.id;
                const isExpired = new Date() > new Date(token.expirationTimestamp);
                const isConsumed = token.status === "CONSUMED";
                const isRevoked = token.status === "REVOKED";

                return (
                  <tr
                    key={token.id}
                    className={`hover:bg-slate-800/50 transition-colors cursor-pointer ${
                      isSelected ? "bg-slate-800/60" : ""
                    }`}
                    onClick={() => setActiveTokenModal(token)}
                  >
                    <td className="py-3 pr-2 font-mono font-medium text-emerald-400">
                      {token.tokenValue}
                    </td>
                    <td className="py-3 pr-2 text-slate-200">
                      {token.policyName || "Corporate Standard"}
                    </td>
                    <td className="py-3 pr-2">
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                        {token.allowPersonalUsage === "PERSONAL_USAGE_ALLOWED" ? "BYOD Allowed" : "Company Only"}
                      </span>
                    </td>
                    <td className="py-3 pr-2 text-slate-400">
                      {token.wifiSsid || "Manual"}
                    </td>
                    <td className="py-3 pr-2 text-slate-400">
                      {new Date(token.expirationTimestamp).toLocaleDateString()}
                    </td>
                    <td className="py-3 pr-2">
                      {isRevoked ? (
                        <span className="rounded bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-400 border border-rose-500/20">
                          Revoked
                        </span>
                      ) : isConsumed ? (
                        <span className="rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-400 border border-blue-500/20">
                          Consumed
                        </span>
                      ) : isExpired ? (
                        <span className="rounded bg-slate-500/10 px-2 py-0.5 text-[10px] font-semibold text-slate-400 border border-slate-500/20">
                          Expired
                        </span>
                      ) : (
                        <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTokenModal(token);
                        }}
                        className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700 transition-colors"
                      >
                        View QR
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onTestEnrollToken(token);
                        }}
                        className="rounded bg-blue-600/80 px-2 py-1 text-[11px] text-white hover:bg-blue-500 transition-colors"
                      >
                        Test Pair
                      </button>

                      {token.status === "ACTIVE" && !isExpired && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Revoke token ${token.tokenValue}?`)) {
                              onRevokeToken(token.id);
                            }
                          }}
                          className="rounded border border-rose-900/60 bg-rose-950/30 px-2 py-1 text-[11px] text-rose-400 hover:bg-rose-900/60 transition-colors"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
