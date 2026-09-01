"use client";

import React, { useState } from "react";
import {
  X,
  Smartphone,
  Shield,
  Terminal,
  Activity,
  BatteryCharging,
  Wifi,
  HardDrive,
  Cpu,
  Lock,
  RotateCw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  Send,
  Radio,
} from "lucide-react";

interface DeviceDetailModalProps {
  device: any;
  policies: any[];
  onClose: () => void;
  onIssueCommand: (deviceId: string, commandType: string, payload?: any) => Promise<void>;
  onUpdateDevice: (deviceId: string, updateData: any) => Promise<void>;
  onDeleteDevice: (deviceId: string) => Promise<void>;
}

export function DeviceDetailModal({
  device,
  policies,
  onClose,
  onIssueCommand,
  onUpdateDevice,
  onDeleteDevice,
}: DeviceDetailModalProps) {
  const [activeSubTab, setActiveSubTab] = useState<"telemetry" | "policy" | "commands" | "json">("telemetry");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);
  const [selectedPolicyId, setSelectedPolicyId] = useState(device.appliedPolicyId || "");
  const [lostModeMessage, setLostModeMessage] = useState("This device is managed by Enterprise IT. Please call +1-800-555-0199 if found.");
  const [lostModePhone, setLostModePhone] = useState("+1-800-555-0199");
  const [newPasscode, setNewPasscode] = useState("892014");

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCommand = async (type: string, payload: any = {}) => {
    setIsIssuing(true);
    try {
      await onIssueCommand(device.id, type, payload);
    } finally {
      setIsIssuing(false);
    }
  };

  const handlePolicyChange = async (newPolId: string) => {
    setSelectedPolicyId(newPolId);
    await onUpdateDevice(device.id, { appliedPolicyId: newPolId });
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return "0 GB";
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const isLost = device.state === "LOST_MODE";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white">{device.model}</h2>
                <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                  {device.managementMode}
                </span>
                {isLost && (
                  <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
                    LOST MODE
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {device.manufacturer} • SN: <span className="font-mono text-slate-300">{device.serialNumber}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6">
          {[
            { id: "telemetry", label: "Hardware & Telemetry", icon: Activity },
            { id: "policy", label: "Policy & Compliance", icon: Shield },
            { id: "commands", label: "Remote MDM Actions", icon: Terminal },
            { id: "json", label: "AMAPI Resource JSON", icon: Cpu },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`flex items-center space-x-2 border-b-2 py-3 px-4 text-xs font-semibold transition-colors ${
                  activeSubTab === tab.id
                    ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
          {/* TAB 1: TELEMETRY */}
          {activeSubTab === "telemetry" && (
            <div className="space-y-6">
              {/* Quick Specs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3.5">
                  <span className="text-[10px] font-semibold uppercase text-slate-500">Operating System</span>
                  <div className="mt-1 font-semibold text-white text-xs sm:text-sm">{device.osVersion.split(" (")[0]}</div>
                  <span className="text-[10px] text-slate-400">API Level {device.apiLevel}</span>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3.5">
                  <span className="text-[10px] font-semibold uppercase text-slate-500">Security Patch</span>
                  <div className="mt-1 font-semibold text-emerald-400 text-xs sm:text-sm">{device.securityPatchLevel}</div>
                  <span className="text-[10px] text-slate-400">Google GMS Certified</span>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3.5">
                  <span className="text-[10px] font-semibold uppercase text-slate-500">Battery Level</span>
                  <div className="mt-1 font-semibold text-white text-xs sm:text-sm flex items-center space-x-1">
                    <BatteryCharging className="h-4 w-4 text-emerald-400" />
                    <span>{device.batteryLevel}%</span>
                  </div>
                  <span className="text-[10px] text-slate-400">{device.batteryStatus}</span>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3.5">
                  <span className="text-[10px] font-semibold uppercase text-slate-500">IP & Network</span>
                  <div className="mt-1 font-semibold text-white text-xs sm:text-sm">{device.ipAddress}</div>
                  <span className="text-[10px] text-slate-400 truncate block">{device.wifiSsid}</span>
                </div>
              </div>

              {/* Memory & Storage Progress */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400 font-medium flex items-center">
                      <Cpu className="mr-1.5 h-3.5 w-3.5 text-indigo-400" /> System RAM Usage
                    </span>
                    <span className="text-white font-semibold">
                      {formatBytes(device.availableMemoryBytes)} free of {formatBytes(device.totalMemoryBytes)}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{
                        width: `${device.totalMemoryBytes ? Math.round(((device.totalMemoryBytes - (device.availableMemoryBytes || 0)) / device.totalMemoryBytes) * 100) : 50}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400 font-medium flex items-center">
                      <HardDrive className="mr-1.5 h-3.5 w-3.5 text-amber-400" /> Internal Storage
                    </span>
                    <span className="text-white font-semibold">
                      {formatBytes(device.freeInternalStorageBytes)} free of {formatBytes(device.totalInternalStorageBytes)}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{
                        width: `${device.totalInternalStorageBytes ? Math.round(((device.totalInternalStorageBytes - (device.freeInternalStorageBytes || 0)) / device.totalInternalStorageBytes) * 100) : 40}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Hardware Identifiers */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <h4 className="text-xs font-semibold text-white mb-3">Enterprise Device Identifiers</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center justify-between rounded-lg bg-slate-900 p-2.5">
                    <span className="text-slate-400">Google AMAPI Device Name:</span>
                    <div className="flex items-center space-x-1.5 font-mono text-slate-200">
                      <span className="truncate max-w-[180px]">{device.googleDeviceName || "N/A"}</span>
                      {device.googleDeviceName && (
                        <button
                          onClick={() => copyToClipboard(device.googleDeviceName, "gname")}
                          className="text-slate-400 hover:text-white"
                        >
                          {copiedKey === "gname" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-slate-900 p-2.5">
                    <span className="text-slate-400">IMEI:</span>
                    <span className="font-mono text-slate-200">{device.imei || "None / WiFi Only"}</span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-slate-900 p-2.5">
                    <span className="text-slate-400">Hardware ID:</span>
                    <span className="font-mono text-slate-200">{device.hardwareId || "N/A"}</span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-slate-900 p-2.5">
                    <span className="text-slate-400">Enrolled Date:</span>
                    <span className="text-slate-200">{new Date(device.enrollmentTime).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: POLICY & COMPLIANCE */}
          {activeSubTab === "policy" && (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-white">Assigned Android Management Policy</h4>
                    <p className="text-xs text-slate-400">
                      Select and reassign policies to this device. AMAPI applies updates automatically over CloudDPC.
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <select
                      value={selectedPolicyId}
                      onChange={(e) => handlePolicyChange(e.target.value)}
                      className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    >
                      {policies.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (v{p.version})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Compliance Badge & Overrides */}
                <div className="flex items-center justify-between border-t border-slate-800/80 pt-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-slate-400">Compliance Status:</span>
                    {device.isCompliant ? (
                      <span className="inline-flex items-center rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Fully Compliant
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-400 border border-rose-500/20">
                        <AlertTriangle className="mr-1 h-3 w-3" /> Non-Compliant
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => onUpdateDevice(device.id, { isCompliant: !device.isCompliant })}
                    className="rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
                  >
                    Toggle Compliance Override
                  </button>
                </div>
              </div>

              {/* Policy JSON Details */}
              {device.policyJson && (
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-400">AMAPI Policy Configuration</span>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(device.policyJson, null, 2), "poljson")}
                      className="text-xs text-emerald-400 hover:underline flex items-center"
                    >
                      {copiedKey === "poljson" ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
                      <span>Copy Policy JSON</span>
                    </button>
                  </div>
                  <pre className="max-h-60 overflow-y-auto rounded-lg bg-slate-900 p-3 font-mono text-[11px] text-emerald-300">
                    {JSON.stringify(device.policyJson, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: REMOTE MDM ACTIONS */}
          {activeSubTab === "commands" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Lock Action */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-2">
                  <div className="flex items-center space-x-2 text-slate-200 font-semibold text-xs">
                    <Lock className="h-4 w-4 text-emerald-400" />
                    <span>Instant Remote Screen Lock</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Immediately locks the device screen and enforces screen lock credentials.
                  </p>
                  <button
                    disabled={isIssuing}
                    onClick={() => handleCommand("LOCK")}
                    className="w-full rounded-lg bg-slate-800 py-2 text-xs font-semibold text-emerald-400 hover:bg-slate-700 transition-colors border border-slate-700"
                  >
                    Send Lock Command
                  </button>
                </div>

                {/* Reboot Action */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-2">
                  <div className="flex items-center space-x-2 text-slate-200 font-semibold text-xs">
                    <RotateCw className="h-4 w-4 text-blue-400" />
                    <span>Remote Device Reboot</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Gracefully triggers an Android system reboot over Google CloudDPC.
                  </p>
                  <button
                    disabled={isIssuing}
                    onClick={() => handleCommand("REBOOT")}
                    className="w-full rounded-lg bg-slate-800 py-2 text-xs font-semibold text-blue-400 hover:bg-slate-700 transition-colors border border-slate-700"
                  >
                    Send Reboot Command
                  </button>
                </div>

                {/* Lost Mode */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3 sm:col-span-2">
                  <div className="flex items-center space-x-2 text-slate-200 font-semibold text-xs">
                    <Radio className="h-4 w-4 text-amber-400" />
                    <span>Lost Mode & Location Beacon</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-[10px] text-slate-400">Lost Screen Message</label>
                      <input
                        type="text"
                        value={lostModeMessage}
                        onChange={(e) => setLostModeMessage(e.target.value)}
                        className="w-full rounded border border-slate-700 bg-slate-800 p-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400">Owner Contact Phone</label>
                      <input
                        type="text"
                        value={lostModePhone}
                        onChange={(e) => setLostModePhone(e.target.value)}
                        className="w-full rounded border border-slate-700 bg-slate-800 p-1.5 text-xs text-white"
                      />
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    {isLost ? (
                      <button
                        disabled={isIssuing}
                        onClick={() => handleCommand("STOP_LOST_MODE")}
                        className="rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 transition-colors"
                      >
                        Stop Lost Mode
                      </button>
                    ) : (
                      <button
                        disabled={isIssuing}
                        onClick={() => handleCommand("START_LOST_MODE", { message: lostModeMessage, phoneNumber: lostModePhone })}
                        className="rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 transition-colors"
                      >
                        Activate Lost Mode
                      </button>
                    )}
                  </div>
                </div>

                {/* Factory Reset / Wipe */}
                <div className="rounded-xl border border-rose-950/40 bg-rose-950/10 p-4 space-y-2 sm:col-span-2">
                  <div className="flex items-center space-x-2 text-rose-300 font-semibold text-xs">
                    <Trash2 className="h-4 w-4 text-rose-400" />
                    <span>Remote Enterprise Wipe & Factory Reset</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Erases corporate work profile or performs complete factory reset if device is company-owned.
                  </p>
                  <button
                    disabled={isIssuing}
                    onClick={() => {
                      if (confirm(`Are you sure you want to trigger remote wipe on ${device.model} (${device.serialNumber})?`)) {
                        handleCommand("WIPE", { wipeReason: "Admin remote trigger" });
                      }
                    }}
                    className="rounded-lg bg-rose-600/90 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 transition-colors"
                  >
                    Confirm Remote Wipe
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: JSON RESOURCE */}
          {activeSubTab === "json" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">AMAPI Device Entity (RFC compliant)</span>
                <button
                  onClick={() => copyToClipboard(JSON.stringify(device, null, 2), "devjson")}
                  className="text-xs text-emerald-400 hover:underline flex items-center"
                >
                  {copiedKey === "devjson" ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
                  <span>Copy Device JSON</span>
                </button>
              </div>
              <pre className="max-h-80 overflow-y-auto rounded-lg bg-slate-950 p-4 font-mono text-[11px] text-emerald-300 border border-slate-800">
                {JSON.stringify(device, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/80 px-6 py-3">
          <button
            onClick={() => {
              if (confirm("Delete device from fleet registry?")) {
                onDeleteDevice(device.id);
                onClose();
              }
            }}
            className="text-xs font-medium text-rose-400 hover:text-rose-300 flex items-center space-x-1"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Unenroll / Delete</span>
          </button>

          <button
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
