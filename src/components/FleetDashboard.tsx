"use client";

import React from "react";
import {
  Smartphone,
  ShieldCheck,
  QrCode,
  Zap,
  BatteryCharging,
  Wifi,
  AlertTriangle,
  CheckCircle2,
  Lock,
  RotateCw,
  Clock,
  Layers,
  ArrowRight,
  Sparkles,
} from "lucide-react";

interface FleetDashboardProps {
  devices: any[];
  policies: any[];
  tokens: any[];
  logs: any[];
  enterprise: any;
  onNavigateTab: (tab: any) => void;
  onSelectDevice: (device: any) => void;
  onOpenQuickToken: () => void;
}

export function FleetDashboard({
  devices,
  policies,
  tokens,
  logs,
  enterprise,
  onNavigateTab,
  onSelectDevice,
  onOpenQuickToken,
}: FleetDashboardProps) {
  const totalDevices = devices.length;
  const compliantDevices = devices.filter((d) => d.isCompliant).length;
  const complianceRate = totalDevices > 0 ? Math.round((compliantDevices / totalDevices) * 100) : 100;

  const fullyManagedCount = devices.filter((d) => d.managementMode === "FULLY_MANAGED").length;
  const workProfileCount = devices.filter((d) => d.managementMode === "WORK_PROFILE").length;
  const dedicatedCount = devices.filter((d) => d.managementMode === "DEDICATED").length;
  const lostModeCount = devices.filter((d) => d.state === "LOST_MODE").length;

  const activeTokens = tokens.filter((t) => t.status === "ACTIVE").length;

  // OS distribution
  const osCount: Record<string, number> = {};
  devices.forEach((d) => {
    const key = d.osVersion.split(" ")[0] + " " + (d.osVersion.split(" ")[1] || "");
    osCount[key] = (osCount[key] || 0) + 1;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900/90 to-emerald-950/40 p-6 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                <Sparkles className="mr-1 h-3 w-3" /> Android Enterprise Architecture
              </span>
              <span className="text-xs text-slate-400">
                ID: {enterprise?.enterpriseId || "enterprises/LC03..."}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Fleet Overview & Compliance Hub
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl">
              Legitimate Android Management API (AMAPI) infrastructure with CloudDPC QR provisioning, fine-grained policy enforcement, real-time telemetry, and remote MDM command dispatch.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenQuickToken}
              className="flex items-center space-x-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-950/50 hover:bg-emerald-500 transition-all hover:scale-[1.02]"
            >
              <QrCode className="h-4 w-4" />
              <span>Enroll New Device (QR)</span>
            </button>
            <button
              onClick={() => onNavigateTab("test-suite")}
              className="flex items-center space-x-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700 transition-all"
            >
              <Zap className="h-4 w-4 text-emerald-400" />
              <span>Run Diagnostics</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Fleet Card */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 backdrop-blur shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Managed Fleet
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Smartphone className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-bold text-white">{totalDevices}</span>
            <span className="text-xs text-slate-400">active units</span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2.5 text-[11px] text-slate-400">
            <span>{fullyManagedCount} Full</span>
            <span>•</span>
            <span>{workProfileCount} BYOD</span>
            <span>•</span>
            <span>{dedicatedCount} Kiosk</span>
          </div>
        </div>

        {/* Compliance Rate Card */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 backdrop-blur shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Security Compliance
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <ShieldCheck className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-bold text-emerald-400">{complianceRate}%</span>
            <span className="text-xs text-slate-400">fleet compliant</span>
          </div>
          <div className="mt-3 flex items-center space-x-1.5 border-t border-slate-800/80 pt-2.5 text-[11px] text-slate-400">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span>{compliantDevices} of {totalDevices} devices adhering to AMAPI rules</span>
          </div>
        </div>

        {/* CloudDPC Tokens Card */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 backdrop-blur shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Active CloudDPC QR Tokens
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <QrCode className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-bold text-white">{activeTokens}</span>
            <span className="text-xs text-slate-400">available tokens</span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2.5 text-[11px] text-slate-400">
            <span>{policies.length} Active Policies</span>
            <button
              onClick={() => onNavigateTab("enrollment")}
              className="text-emerald-400 hover:text-emerald-300 font-medium flex items-center"
            >
              Manage <ArrowRight className="ml-1 h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Enterprise Mode & Cloud Gateway */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 backdrop-blur shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              AMAPI Cloud Gateway
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Zap className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-xl font-bold text-slate-200">
              {enterprise?.mode === "LIVE_AMAPI" ? "Live GCP" : "Verified Sandbox"}
            </span>
          </div>
          <div className="mt-3 flex items-center space-x-1.5 border-t border-slate-800/80 pt-2.5 text-[11px] text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Pub/Sub Webhook Receiver Active</span>
          </div>
        </div>
      </div>

      {/* Grid: Active Fleet Table & OS Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Fleet Quick Status */}
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/80 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-white">Live Fleet Status</h2>
              <p className="text-xs text-slate-400">Real-time telemetry and management mode summary</p>
            </div>
            <button
              onClick={() => onNavigateTab("devices")}
              className="text-xs font-medium text-emerald-400 hover:text-emerald-300 flex items-center"
            >
              View Full Fleet <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-2.5 font-medium">Device / Model</th>
                  <th className="pb-2.5 font-medium">Mode</th>
                  <th className="pb-2.5 font-medium">OS / Patch</th>
                  <th className="pb-2.5 font-medium">Battery & Net</th>
                  <th className="pb-2.5 font-medium">Status</th>
                  <th className="pb-2.5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {devices.slice(0, 5).map((device) => {
                  const modeBadgeColor =
                    device.managementMode === "FULLY_MANAGED"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : device.managementMode === "DEDICATED"
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      : "bg-blue-500/10 text-blue-400 border-blue-500/20";

                  return (
                    <tr
                      key={device.id}
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                      onClick={() => onSelectDevice(device)}
                    >
                      <td className="py-3 pr-2">
                        <div className="font-medium text-slate-200 group-hover:text-emerald-300 transition-colors">
                          {device.model}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {device.manufacturer} • SN: {device.serialNumber}
                        </div>
                      </td>
                      <td className="py-3 pr-2">
                        <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-semibold border ${modeBadgeColor}`}>
                          {device.managementMode.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3 pr-2">
                        <div className="text-slate-300">{device.osVersion.split(" (")[0]}</div>
                        <div className="text-[10px] text-slate-500">Patch: {device.securityPatchLevel}</div>
                      </td>
                      <td className="py-3 pr-2">
                        <div className="flex items-center space-x-1.5 text-slate-300">
                          <BatteryCharging className="h-3.5 w-3.5 text-emerald-400" />
                          <span>{device.batteryLevel}%</span>
                        </div>
                        <div className="flex items-center space-x-1 text-[10px] text-slate-500">
                          <Wifi className="h-3 w-3" />
                          <span>{device.wifiSsid || device.networkType}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-2">
                        {device.state === "LOST_MODE" ? (
                          <span className="inline-flex items-center text-[11px] font-medium text-amber-400">
                            <Lock className="mr-1 h-3 w-3" /> Lost Mode
                          </span>
                        ) : device.isCompliant ? (
                          <span className="inline-flex items-center text-[11px] font-medium text-emerald-400">
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Compliant
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[11px] font-medium text-rose-400">
                            <AlertTriangle className="mr-1 h-3 w-3" /> Non-Compliant
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectDevice(device);
                          }}
                          className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Col: Fleet Architecture & Recent Events */}
        <div className="space-y-6">
          {/* Management Mode Distribution */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center space-x-2">
              <Layers className="h-4 w-4 text-emerald-400" />
              <span>Provisioning Mode Distribution</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Company-Owned Fully Managed (DO)</span>
                  <span className="font-semibold text-white">{fullyManagedCount}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{
                      width: `${totalDevices > 0 ? (fullyManagedCount / totalDevices) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Dedicated Kiosk / Rugged Handheld</span>
                  <span className="font-semibold text-white">{dedicatedCount}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{
                      width: `${totalDevices > 0 ? (dedicatedCount / totalDevices) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>BYOD Work Profile (PO)</span>
                  <span className="font-semibold text-white">{workProfileCount}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{
                      width: `${totalDevices > 0 ? (workProfileCount / totalDevices) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Recent Pub/Sub & Audit Events */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
                <Clock className="h-4 w-4 text-emerald-400" />
                <span>Live Telemetry & Audit Stream</span>
              </h3>
              <button
                onClick={() => onNavigateTab("logs")}
                className="text-[11px] text-emerald-400 hover:underline"
              >
                All Logs
              </button>
            </div>

            <div className="space-y-2.5">
              {logs.slice(0, 4).map((log) => (
                <div
                  key={log.id}
                  className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-2.5 text-xs flex items-start space-x-2.5"
                >
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="h-3 w-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-300 truncate">
                        {log.action.replace(/_/g, " ")}
                      </span>
                      <span className="text-[10px] text-slate-500 shrink-0">
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      Actor: {log.actor} • Type: {log.resourceType}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
