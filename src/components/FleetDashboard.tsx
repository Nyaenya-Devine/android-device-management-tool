"use client";

import React, { useState } from "react";
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
  Activity,
  ShieldAlert,
} from "lucide-react";
import { FleetRiskHeatmap } from "./FleetRiskHeatmap";
import ThreadHumorAndroid from "./ThreadHumorAndroid";
import DeviceRemoteView from "./DeviceRemoteView";

interface FleetDashboardProps {
  devices: any[];
  policies: any[];
  tokens: any[];
  logs: any[];
  enterprise: any;
  onNavigateTab: (tab: any) => void;
  onSelectDevice: (device: any) => void;
  onOpenQuickToken: () => void;
  onDeviceAction?: (deviceId: string, action: string) => void;
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
  onDeviceAction,
}: FleetDashboardProps) {
  const [selectedLiveDevice, setSelectedLiveDevice] = useState<any>(devices[0] || null);
  const totalDevices = devices.length;
  const compliantDevices = devices.filter((d) => d.isCompliant).length;
  const complianceRate = totalDevices > 0 ? Math.round((compliantDevices / totalDevices) * 100) : 100;
  const fullyManagedCount = devices.filter((d) => d.managementMode === "FULLY_MANAGED").length;
  const workProfileCount = devices.filter((d) => d.managementMode === "WORK_PROFILE").length;
  const dedicatedCount = devices.filter((d) => d.managementMode === "DEDICATED").length;
  const activeTokens = tokens.filter((t) => t.status === "ACTIVE").length;
  const nonCompliant = totalDevices - compliantDevices;

  React.useEffect(() => {
    if (!selectedLiveDevice && devices.length > 0) setSelectedLiveDevice(devices[0]);
  }, [devices, selectedLiveDevice]);

  return (
    <div className="space-y-5 relative z-10">
      {/* Hero — Android Livery Bento, OrbitDesk level */}
      <div className="relative overflow-hidden rounded-[20px] border border-white/[0.06] bg-[#101012]/80 backdrop-blur-[24px] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#3DDC84]/30 to-transparent" />
        <div className="absolute top-[-35%] right-[-15%] w-[520px] h-[380px] rounded-full blur-[70px] opacity-[0.12] bg-[#3DDC84]" />
        <div className="absolute bottom-[-25%] left-[-10%] w-[400px] h-[400px] rounded-full blur-[70px] opacity-[0.08] bg-[#8B5CF6]" />
        <div className="absolute bottom-[-10%] right-[20%] w-[300px] h-[300px] rounded-full blur-[60px] opacity-[0.06] bg-[#0078D4]" />
        {/* QR pattern overlay */}
        <div className="absolute inset-0 opacity-[0.02] qr-pattern pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#3DDC84]/10 border border-[#3DDC84]/20 px-3 py-1 text-[11px] font-mono tracking-[0.06em] uppercase text-[#3DDC84]">
                <Sparkles className="h-3 w-3" /> Android Enterprise • AMAPI
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] px-3 py-1 text-[10px] font-mono text-white/40">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE • {enterprise?.mode || 'Sandbox'} • Pub/Sub
              </span>
              <span className="font-mono text-[11px] text-white/30">ID: {enterprise?.enterpriseId?.substring(0,24) || "enterprises/LC03..."}</span>
            </div>
            <h1 className="font-display text-[26px] md:text-[32px] tracking-[-0.02em] text-[#F5F3EF] leading-[1.05]">
              Fleet Command <span className="text-[#3DDC84]">— Real Devices, Real Policies</span>
            </h1>
            <p className="text-[13px] leading-[1.6] text-white/50 max-w-3xl">
              Legit Android Management API with CloudDPC QR provisioning, SafetyNet & Play Integrity attestation, fine-grained policy enforcement. Each client different policies like real workplace — ability to execute LOCK, REBOOT, WIPE that seem 100% real with visual proof.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {[
                `📱 ${totalDevices} devices`,
                `✅ ${complianceRate}% compliant`,
                `🔒 SEC-2024-07 enforced`,
                `📡 dumpsys live`,
              ].map(chip => (
                <span key={chip} className="text-[11px] px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-white/50">{chip}</span>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2.5 shrink-0">
            <button
              onClick={onOpenQuickToken}
              className="flex items-center justify-center gap-2 rounded-full bg-[#3DDC84] px-6 py-3 text-[13px] font-bold text-black shadow-lg shadow-[#3DDC84]/20 hover:bg-[#2AA86B] hover:-translate-y-0.5 transition-all"
            >
              <QrCode className="h-4 w-4" />
              <span>Enroll New Device — QR 6-dot</span>
            </button>
            <button
              onClick={() => onNavigateTab("test-suite")}
              className="flex items-center justify-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-6 py-3 text-[13px] font-medium text-white/70 hover:bg-white/[0.08] hover:text-white transition"
            >
              <Activity className="h-4 w-4 text-[#3DDC84]" />
              <span>Run Diagnostics • SafetyNet Check</span>
            </button>
            <p className="text-[10px] text-white/30 text-center font-mono">💡 Call center live — clients call, you greet first</p>
          </div>
        </div>
      </div>

      {/* Bento KPI — Clean organized, OrbitDesk level */}
      <div className="grid grid-cols-12 gap-4">
        {/* Main KPIs — 3 cols */}
        <div className="col-span-12 lg:col-span-9 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              label: "Managed Fleet",
              value: totalDevices,
              sub: "active units",
              icon: Smartphone,
              accent: "android",
              footer: `${fullyManagedCount} DO • ${workProfileCount} PO • ${dedicatedCount} DEDICATED`,
              highlight: `${nonCompliant} need attention`,
            },
            {
              label: "Security Compliance",
              value: `${complianceRate}%`,
              sub: "fleet compliant",
              icon: ShieldCheck,
              accent: "emerald",
              footer: `${compliantDevices} of ${totalDevices} adhering to AMAPI + SEC-2024-07`,
              highlight: complianceRate < 90 ? "⚠️ Below 90% — P1" : "✅ Healthy",
            },
            {
              label: "CloudDPC QR Tokens",
              value: activeTokens,
              sub: "active • 6-dot tap",
              icon: QrCode,
              accent: "violet",
              footer: `${policies.length} Policies • Expires 30d`,
              action: () => onNavigateTab("enrollment"),
              actionLabel: "Manage →",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="group relative overflow-hidden rounded-[16px] bento-card p-5"
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent opacity-0 group-hover:opacity-100 transition" />
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-white/40">{card.label}</span>
                <div className={`flex h-9 w-9 items-center justify-center rounded-full border ${
                  card.accent === 'android' ? 'bg-[#3DDC84]/10 border-[#3DDC84]/20 text-[#3DDC84]' :
                  card.accent === 'violet' ? 'bg-[#8B5CF6]/10 border-[#8B5CF6]/20 text-[#8B5CF6]' :
                  'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                }`}>
                  <card.icon className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-display text-[32px] leading-none tracking-[-0.02em] text-[#F5F3EF]">{card.value}</span>
                <span className="font-mono text-[11px] text-white/40">{card.sub}</span>
              </div>
              <div className="mt-3 space-y-1.5">
                <p className="font-mono text-[11px] text-white/40 leading-[1.3]">{card.footer}</p>
                <p className={`text-[11px] font-medium ${card.highlight?.includes('⚠️') ? 'text-amber-400' : 'text-white/50'}`}>{card.highlight}</p>
              </div>
              {card.action && (
                <button onClick={card.action} className="mt-3 font-mono text-[11px] text-[#3DDC84] hover:text-[#2AA86B] flex items-center gap-1">
                  {card.actionLabel} <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* AMAPI Gateway bento */}
        <div className="col-span-12 lg:col-span-3 rounded-[16px] bento-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-white/40">AMAPI Gateway</span>
              <div className="h-8 w-8 rounded-full bg-[#0078D4]/10 border border-[#0078D4]/20 flex items-center justify-center text-[#0078D4]"><Zap className="h-4 w-4" /></div>
            </div>
            <p className="font-display text-[20px] text-[#F5F3EF] mt-3">{enterprise?.mode === "LIVE_AMAPI" ? "Live GCP" : "Sandbox Lab"}</p>
            <p className="font-mono text-[11px] text-white/40 mt-1">Pub/Sub webhook active • {logs.length} events</p>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 text-[11px] text-white/50"><span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> CloudDPC receiver ON</div>
            <div className="flex items-center gap-2 text-[11px] text-white/50"><span className="h-2 w-2 rounded-full bg-[#3DDC84] animate-pulse" /> SafetyNet attestation</div>
            <div className="flex items-center gap-2 text-[11px] text-white/50"><span className="h-2 w-2 rounded-full bg-violet-400 animate-pulse" /> Play Integrity API</div>
          </div>
        </div>
      </div>

      {/* Main bento grid — Fleet + Live View + Humor */}
      <div className="grid grid-cols-12 gap-4">
        {/* Live Fleet Status — 7 cols */}
        <div className="col-span-12 lg:col-span-7 rounded-[16px] bento-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-[18px] tracking-[-0.01em] text-[#F5F3EF] flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-[#3DDC84]/10 border border-[#3DDC84]/20 flex items-center justify-center"><Smartphone className="h-3.5 w-3.5 text-[#3DDC84]" /></span>
                Live Fleet — Real Devices
              </h2>
              <p className="font-mono text-[11px] text-white/40 mt-1">Tap device → see live screen • Each client different policies</p>
            </div>
            <button onClick={() => onNavigateTab("devices")} className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 font-mono text-[11px] text-white/60 hover:bg-white/[0.08] hover:text-white transition flex items-center gap-1">
              Full Fleet <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.06] text-white/30">
                  <th className="pb-2.5 pl-1 font-mono text-[10px] tracking-[0.08em] uppercase font-medium">Device / Model</th>
                  <th className="pb-2.5 font-mono text-[10px] tracking-[0.08em] uppercase font-medium">Mode</th>
                  <th className="pb-2.5 font-mono text-[10px] tracking-[0.08em] uppercase font-medium">OS</th>
                  <th className="pb-2.5 font-mono text-[10px] tracking-[0.08em] uppercase font-medium">Batt</th>
                  <th className="pb-2.5 font-mono text-[10px] tracking-[0.08em] uppercase font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {devices.slice(0, 6).map((device) => {
                  const modeStyle =
                    device.managementMode === "FULLY_MANAGED"
                      ? "bg-[#3DDC84]/10 text-[#3DDC84] border-[#3DDC84]/20"
                      : device.managementMode === "DEDICATED"
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      : "bg-[#8B5CF6]/10 text-[#8B5CF6] border-[#8B5CF6]/20";
                  const isSelected = selectedLiveDevice?.id === device.id;
                  return (
                    <tr key={device.id} onClick={() => { onSelectDevice(device); setSelectedLiveDevice(device); }} className={`hover:bg-white/[0.03] transition-colors cursor-pointer group ${isSelected ? 'bg-[#3DDC84]/5' : ''}`}>
                      <td className="py-3 pr-2 pl-1">
                        <div className={`text-[13px] font-medium ${isSelected ? 'text-[#3DDC84]' : 'text-[#F5F3EF] group-hover:text-[#3DDC84]'} transition-colors`}>{device.model}</div>
                        <div className="font-mono text-[10px] text-white/30">{device.manufacturer} • {device.serialNumber?.substring(0,10)}</div>
                      </td>
                      <td className="py-3 pr-2"><span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-mono uppercase font-semibold border ${modeStyle}`}>{device.managementMode.replace("_", " ").substring(0,10)}</span></td>
                      <td className="py-3 pr-2"><div className="text-[11px] text-white/60">{device.osVersion?.split(" (")[0]?.substring(0,12) || '14'}</div></td>
                      <td className="py-3 pr-2"><div className="flex items-center gap-1 text-[11px] text-white/60"><BatteryCharging className="h-3 w-3 text-[#3DDC84]" />{device.batteryLevel || 72}%</div></td>
                      <td className="py-3 pr-2">
                        {device.state === "LOST_MODE" ? <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400"><Lock className="h-3 w-3" /> Lost</span> :
                         device.isCompliant ? <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400"><CheckCircle2 className="h-3 w-3" /> OK</span> :
                         <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-400"><AlertTriangle className="h-3 w-3" /> NO</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Device View + Thread Humor stacked — 5 cols */}
        <div className="col-span-12 lg:col-span-5 space-y-4">
          {selectedLiveDevice ? (
            <DeviceRemoteView device={selectedLiveDevice} onCommand={(cmd) => onDeviceAction?.(selectedLiveDevice.id, cmd)} />
          ) : (
            <div className="rounded-[16px] bento-card p-5 h-[280px] flex items-center justify-center text-white/30 font-mono text-[12px]">Select device to see live view</div>
          )}
          <ThreadHumorAndroid />
        </div>
      </div>

      {/* Bottom bento — Distribution + Risk + Telemetry */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-4 rounded-[16px] bento-card p-5">
          <h3 className="flex items-center gap-2 font-display text-[14px] tracking-[-0.01em] text-[#F5F3EF] mb-4">
            <Layers className="h-4 w-4 text-[#3DDC84]" /> Provisioning Mode
          </h3>
          <div className="space-y-3.5">
            {[
              { label: "Fully Managed (DO)", count: fullyManagedCount, color: "bg-[#3DDC84]" },
              { label: "Dedicated Kiosk/Rugged", count: dedicatedCount, color: "bg-amber-500" },
              { label: "BYOD Work Profile (PO)", count: workProfileCount, color: "bg-[#8B5CF6]" },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between font-mono text-[11px] text-white/50 mb-1.5"><span>{item.label}</span><span className="font-semibold text-white">{item.count}</span></div>
                <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden"><div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${totalDevices > 0 ? (item.count / totalDevices) * 100 : 0}%` }} /></div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-12 md:col-span-4">
          <FleetRiskHeatmap devices={devices as any} onSelectDevice={onSelectDevice as any} />
        </div>

        <div className="col-span-12 md:col-span-4 rounded-[16px] bento-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="flex items-center gap-2 font-display text-[14px] text-[#F5F3EF]"><Clock className="h-4 w-4 text-[#3DDC84]" /> Live Telemetry</h3>
            <button onClick={() => onNavigateTab("logs")} className="font-mono text-[11px] text-[#3DDC84] hover:text-[#2AA86B]">All Logs →</button>
          </div>
          <div className="space-y-2.5">
            {logs.slice(0, 4).map((log) => (
              <div key={log.id} className="rounded-[12px] border border-white/[0.06] bg-[#08080A] p-3 flex items-start gap-2.5 hover:border-[#3DDC84]/20 transition">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#3DDC84]/10 text-[#3DDC84] border border-[#3DDC84]/20"><CheckCircle2 className="h-3 w-3" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between"><span className="font-mono text-[11px] font-medium text-white/70 truncate">{log.action.replace(/_/g, " ")}</span><span className="font-mono text-[10px] text-white/30 shrink-0">{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
                  <p className="font-mono text-[10px] text-white/30 truncate mt-0.5">Actor: {log.actor} • {log.resourceType} • dumpsys</p>
                </div>
              </div>
            ))}
            {logs.length === 0 && <p className="text-[11px] text-white/30 font-mono text-center py-4">No telemetry yet — issue command</p>}
          </div>
        </div>
      </div>

      {/* Clear expectations — like Influx would */}
      <div className="rounded-[16px] border border-[#3DDC84]/10 bg-[#3DDC84]/[0.04] backdrop-blur p-4">
        <div className="flex gap-3">
          <div className="h-8 w-8 rounded-full bg-[#3DDC84]/10 border border-[#3DDC84]/20 flex items-center justify-center shrink-0"><ShieldAlert className="h-4 w-4 text-[#3DDC84]" /></div>
          <div className="space-y-1.5">
            <p className="text-[12px] font-semibold text-[#F5F3EF]">What to expect — Real Workplace Experience (Influx-level clarity)</p>
            <ul className="text-[11px] text-white/50 leading-[1.5] list-disc pl-4 space-y-1">
              <li><span className="text-white/70">Each device different policy</span> — like real enterprise: Sales needs Outlook, Field needs kiosk, Facilities needs compliance audit trail per SEC-2024-07</li>
              <li><span className="text-white/70">100% real feel actions</span> — LOCK needs internet, WIPE is factory reset (cat photos gone if DO), REBOOT keeps data. Visual proof via live device view + dumpsys logs</li>
              <li><span className="text-white/70">Call center flowing</span> — Client says "Hello?" first → YOU greet first → intro → problem → troubleshooting back-and-forth with real actions → resolution. Voice + mic support</li>
              <li><span className="text-white/70">Thread humor trending</span> — r/Intune, r/AndroidEnterprise, #SafetyNetFails, #QRHell, #WorksOnMyPixel — nasty good humor from real MDM horror</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
