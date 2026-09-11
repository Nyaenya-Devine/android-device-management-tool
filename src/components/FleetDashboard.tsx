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
  Clock,
  Layers,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { FleetRiskHeatmap } from "./FleetRiskHeatmap";

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

  const activeTokens = tokens.filter((t) => t.status === "ACTIVE").length;

  return (
    <div className="space-y-6 relative z-10">
      {/* Welcome Banner - Obsidian Aurora */}
      <div className="relative overflow-hidden rounded-[20px] border border-white/[0.06] bg-[#101012]/80 backdrop-blur-[20px] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#FFB224]/20 to-transparent" />
        <div className="absolute top-[-30%] right-[-10%] w-[400px] h-[300px] rounded-full blur-[60px] opacity-[0.08] bg-[#FFB224]" />
        <div className="absolute bottom-[-20%] left-[-5%] w-[300px] h-[300px] rounded-full blur-[60px] opacity-[0.06] bg-[#8B5CF6]" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFB224]/10 border border-[#FFB224]/20 px-3 py-1 text-[11px] font-mono tracking-[0.06em] uppercase text-[#FFB224]">
                <Sparkles className="h-3 w-3" /> Android Enterprise
              </span>
              <span className="font-mono text-[11px] text-white/30">
                ID: {enterprise?.enterpriseId || "enterprises/LC03..."}
              </span>
            </div>
            <h1 className="font-display text-[24px] md:text-[30px] tracking-[-0.02em] text-[#F5F3EF] leading-[1.1]">
              Fleet Overview & Compliance Hub
            </h1>
            <p className="text-[13px] leading-[1.6] text-white/50 max-w-2xl">
              Legitimate Android Management API infrastructure with CloudDPC QR provisioning, fine-grained policy enforcement, real-time telemetry, and remote MDM command dispatch.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenQuickToken}
              className="flex items-center gap-2 rounded-full bg-[#FFFDFA] px-5 py-2.5 text-[13px] font-semibold text-[#050507] shadow-sm hover:bg-white transition hover:-translate-y-0.5"
            >
              <QrCode className="h-4 w-4" />
              <span>Enroll New Device (QR)</span>
            </button>
            <button
              onClick={() => onNavigateTab("test-suite")}
              className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-5 py-2.5 text-[13px] font-medium text-white/70 hover:bg-white/[0.08] hover:text-white transition"
            >
              <Zap className="h-4 w-4 text-[#FFB224]" />
              <span>Run Diagnostics</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Managed Fleet",
            value: totalDevices,
            sub: "active units",
            icon: Smartphone,
            accent: "amber",
            footer: `${fullyManagedCount} Full • ${workProfileCount} BYOD • ${dedicatedCount} Kiosk`,
          },
          {
            label: "Security Compliance",
            value: `${complianceRate}%`,
            sub: "fleet compliant",
            icon: ShieldCheck,
            accent: "emerald",
            footer: `${compliantDevices} of ${totalDevices} adhering to AMAPI rules`,
            footerIcon: CheckCircle2,
          },
          {
            label: "Active CloudDPC QR Tokens",
            value: activeTokens,
            sub: "available tokens",
            icon: QrCode,
            accent: "violet",
            footer: `${policies.length} Active Policies`,
            action: () => onNavigateTab("enrollment"),
            actionLabel: "Manage",
          },
          {
            label: "AMAPI Cloud Gateway",
            value: enterprise?.mode === "LIVE_AMAPI" ? "Live GCP" : "Sandbox",
            sub: "",
            icon: Zap,
            accent: "cyan",
            footer: "Pub/Sub Webhook Receiver Active",
            dot: true,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="group relative overflow-hidden rounded-[16px] border border-white/[0.06] bg-[#101012]/80 backdrop-blur-[20px] p-5 hover:border-white/[0.12] hover:bg-[#151519] transition-all hover:-translate-y-1"
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent opacity-0 group-hover:opacity-100 transition" />
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-white/40">
                {card.label}
              </span>
              <div className={`flex h-9 w-9 items-center justify-center rounded-full border ${
                card.accent === 'amber' ? 'bg-[#FFB224]/10 border-[#FFB224]/20 text-[#FFB224]' :
                card.accent === 'violet' ? 'bg-[#8B5CF6]/10 border-[#8B5CF6]/20 text-[#8B5CF6]' :
                card.accent === 'cyan' ? 'bg-[#06B6D4]/10 border-[#06B6D4]/20 text-[#06B6D4]' :
                'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              }`}>
                <card.icon className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-[30px] leading-none tracking-[-0.02em] text-[#F5F3EF]">{card.value}</span>
              {card.sub && <span className="font-mono text-[11px] text-white/40">{card.sub}</span>}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-2.5">
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-white/40">
                {card.dot && <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />}
                {card.footerIcon && <card.footerIcon className="h-3.5 w-3.5 text-emerald-400" />}
                {card.footer}
              </span>
              {card.action && (
                <button onClick={card.action} className="font-mono text-[11px] text-[#FFB224] hover:text-[#FFC96B] flex items-center gap-1">
                  {card.actionLabel} <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Fleet + Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-[16px] border border-white/[0.06] bg-[#101012]/80 backdrop-blur-[20px] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-[18px] tracking-[-0.01em] text-[#F5F3EF]">Live Fleet Status</h2>
              <p className="font-mono text-[11px] text-white/40 mt-1">Real-time telemetry and management mode summary</p>
            </div>
            <button onClick={() => onNavigateTab("devices")} className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 font-mono text-[11px] text-white/60 hover:bg-white/[0.08] hover:text-white transition flex items-center gap-1">
              View Full Fleet <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.06] text-white/30">
                  <th className="pb-2.5 font-mono text-[10px] tracking-[0.08em] uppercase font-medium">Device / Model</th>
                  <th className="pb-2.5 font-mono text-[10px] tracking-[0.08em] uppercase font-medium">Mode</th>
                  <th className="pb-2.5 font-mono text-[10px] tracking-[0.08em] uppercase font-medium">OS / Patch</th>
                  <th className="pb-2.5 font-mono text-[10px] tracking-[0.08em] uppercase font-medium">Battery & Net</th>
                  <th className="pb-2.5 font-mono text-[10px] tracking-[0.08em] uppercase font-medium">Status</th>
                  <th className="pb-2.5 font-mono text-[10px] tracking-[0.08em] uppercase font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {devices.slice(0, 5).map((device) => {
                  const modeStyle =
                    device.managementMode === "FULLY_MANAGED"
                      ? "bg-[#FFB224]/10 text-[#FFB224] border-[#FFB224]/20"
                      : device.managementMode === "DEDICATED"
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      : "bg-[#8B5CF6]/10 text-[#8B5CF6] border-[#8B5CF6]/20";

                  return (
                    <tr key={device.id} className="hover:bg-white/[0.03] transition-colors cursor-pointer group" onClick={() => onSelectDevice(device)}>
                      <td className="py-3 pr-2">
                        <div className="text-[13px] font-medium text-[#F5F3EF] group-hover:text-[#FFB224] transition-colors">{device.model}</div>
                        <div className="font-mono text-[11px] text-white/30">{device.manufacturer} • SN: {device.serialNumber}</div>
                      </td>
                      <td className="py-3 pr-2">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-mono tracking-[0.06em] uppercase font-semibold border ${modeStyle}`}>
                          {device.managementMode.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3 pr-2">
                        <div className="text-[12px] text-white/70">{device.osVersion.split(" (")[0]}</div>
                        <div className="font-mono text-[10px] text-white/30">Patch: {device.securityPatchLevel}</div>
                      </td>
                      <td className="py-3 pr-2">
                        <div className="flex items-center gap-1.5 text-[12px] text-white/60">
                          <BatteryCharging className="h-3.5 w-3.5 text-[#FFB224]" />
                          <span>{device.batteryLevel}%</span>
                        </div>
                        <div className="flex items-center gap-1 font-mono text-[10px] text-white/30">
                          <Wifi className="h-3 w-3" />
                          <span>{device.wifiSsid || device.networkType}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-2">
                        {device.state === "LOST_MODE" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400">
                            <Lock className="h-3 w-3" /> Lost Mode
                          </span>
                        ) : device.isCompliant ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" /> Compliant
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400">
                            <AlertTriangle className="h-3 w-3" /> Non-Compliant
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); onSelectDevice(device); }}
                          className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-white/60 hover:bg-white/[0.08] hover:text-white transition"
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

        <div className="space-y-6">
          <FleetRiskHeatmap devices={devices as any} onSelectDevice={onSelectDevice as any} />

          <div className="rounded-[16px] border border-white/[0.06] bg-[#101012]/80 backdrop-blur-[20px] p-5">
            <h3 className="flex items-center gap-2 font-display text-[15px] tracking-[-0.01em] text-[#F5F3EF] mb-4">
              <Layers className="h-4 w-4 text-[#FFB224]" />
              Provisioning Mode Distribution
            </h3>
            <div className="space-y-4">
              {[
                { label: "Company-Owned Fully Managed (DO)", count: fullyManagedCount, color: "bg-[#FFB224]" },
                { label: "Dedicated Kiosk / Rugged Handheld", count: dedicatedCount, color: "bg-amber-500" },
                { label: "BYOD Work Profile (PO)", count: workProfileCount, color: "bg-[#8B5CF6]" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between font-mono text-[11px] text-white/50 mb-1.5">
                    <span>{item.label}</span>
                    <span className="font-semibold text-white">{item.count}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${totalDevices > 0 ? (item.count / totalDevices) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[16px] border border-white/[0.06] bg-[#101012]/80 backdrop-blur-[20px] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="flex items-center gap-2 font-display text-[15px] text-[#F5F3EF]">
                <Clock className="h-4 w-4 text-[#FFB224]" />
                Live Telemetry
              </h3>
              <button onClick={() => onNavigateTab("logs")} className="font-mono text-[11px] text-[#FFB224] hover:text-[#FFC96B]">
                All Logs
              </button>
            </div>
            <div className="space-y-2.5">
              {logs.slice(0, 4).map((log) => (
                <div key={log.id} className="rounded-[12px] border border-white/[0.06] bg-[#08080A] p-3 flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FFB224]/10 text-[#FFB224] border border-[#FFB224]/20">
                    <CheckCircle2 className="h-3 w-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-medium text-white/70 truncate">{log.action.replace(/_/g, " ")}</span>
                      <span className="font-mono text-[10px] text-white/30 shrink-0">
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="font-mono text-[11px] text-white/30 truncate mt-0.5">Actor: {log.actor} • {log.resourceType}</p>
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
