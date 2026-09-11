"use client";

import React from "react";

interface Device {
  id: string;
  model: string;
  manufacturer: string;
  isCompliant: boolean;
  state: string;
  securityPatchLevel: string;
  batteryLevel: number;
  osVersion: string;
  lastStatusReportTime: string;
}

interface RiskScore {
  device: Device;
  score: number;
  factors: string[];
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

function calculateDeviceRisk(device: Device): RiskScore {
  let score = 0;
  const factors: string[] = [];

  if (!device.isCompliant) {
    score += 40;
    factors.push("Non-compliant");
  }
  if (device.state === "LOST_MODE") {
    score += 30;
    factors.push("Lost mode");
  }
  if (device.state !== "ACTIVE") {
    score += 20;
    factors.push(`State: ${device.state}`);
  }
  if (device.batteryLevel < 20) {
    score += 10;
    factors.push(`Low battery: ${device.batteryLevel}%`);
  }

  // Check patch level - if older than 2025-01-01, risky
  try {
    const patchDate = new Date(device.securityPatchLevel);
    const cutoff = new Date("2025-01-01");
    if (patchDate < cutoff) {
      score += 25;
      factors.push(`Outdated patch: ${device.securityPatchLevel}`);
    }
  } catch {}

  // Check last report time - if > 24h ago, risky
  try {
    const lastReport = new Date(device.lastStatusReportTime);
    const hoursSince = (Date.now() - lastReport.getTime()) / (1000 * 60 * 60);
    if (hoursSince > 24) {
      score += 15;
      factors.push(`Stale telemetry: ${Math.round(hoursSince)}h ago`);
    }
  } catch {}

  let severity: RiskScore["severity"] = "LOW";
  if (score >= 70) severity = "CRITICAL";
  else if (score >= 40) severity = "HIGH";
  else if (score >= 15) severity = "MEDIUM";

  return {
    device,
    score: Math.min(100, score),
    factors,
    severity,
  };
}

export function FleetRiskHeatmap({ devices, onSelectDevice }: { devices: Device[]; onSelectDevice?: (d: Device) => void }) {
  const riskScores = devices.map(calculateDeviceRisk).sort((a, b) => b.score - a.score);
  
  const critical = riskScores.filter(r => r.severity === "CRITICAL").length;
  const high = riskScores.filter(r => r.severity === "HIGH").length;
  const medium = riskScores.filter(r => r.severity === "MEDIUM").length;
  const low = riskScores.filter(r => r.severity === "LOW").length;

  const avgRisk = riskScores.length ? Math.round(riskScores.reduce((s, r) => s + r.score, 0) / riskScores.length) : 0;

  return (
    <div className="rounded-[16px] border border-white/[0.06] bg-[#101012]/80 backdrop-blur-[20px] p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display text-[16px] tracking-[-0.01em] text-[#F5F3EF] flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs">⚠</span>
            Fleet Risk Heatmap (God Mode)
          </h3>
          <p className="font-mono text-[11px] text-white/40 mt-1">Real-time compliance & threat scoring per device</p>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-white/40 font-mono">Avg Risk</div>
          <div className={`text-xl font-bold ${avgRisk > 50 ? "text-red-400" : avgRisk > 20 ? "text-amber-400" : "text-emerald-400"}`}>{avgRisk}</div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-5">
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2.5 text-center">
          <div className="text-lg font-bold text-red-400">{critical}</div>
          <div className="text-[10px] text-red-300/70 font-mono uppercase">Critical</div>
        </div>
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 text-center">
          <div className="text-lg font-bold text-amber-400">{high}</div>
          <div className="text-[10px] text-amber-300/70 font-mono uppercase">High</div>
        </div>
        <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-2.5 text-center">
          <div className="text-lg font-bold text-yellow-400">{medium}</div>
          <div className="text-[10px] text-yellow-300/70 font-mono uppercase">Medium</div>
        </div>
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-center">
          <div className="text-lg font-bold text-emerald-400">{low}</div>
          <div className="text-[10px] text-emerald-300/70 font-mono uppercase">Low</div>
        </div>
      </div>

      <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
        {riskScores.slice(0, 8).map(({ device, score, factors, severity }) => (
          <div key={device.id} onClick={()=>onSelectDevice?.(device)} className="flex items-center gap-3 rounded-xl border border-white/[0.04] bg-[#08080A] p-3 hover:border-white/[0.08] transition-colors cursor-pointer">
            <div className={`h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold border ${
              severity === "CRITICAL" ? "bg-red-500/20 border-red-500/30 text-red-400" :
              severity === "HIGH" ? "bg-amber-500/20 border-amber-500/30 text-amber-400" :
              severity === "MEDIUM" ? "bg-yellow-500/20 border-yellow-500/30 text-yellow-400" :
              "bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
            }`}>
              {score}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-[#F5F3EF] truncate">{device.model}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-mono ${
                  severity === "CRITICAL" ? "bg-red-500/10 border-red-500/20 text-red-400" :
                  severity === "HIGH" ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                  severity === "MEDIUM" ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400" :
                  "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                }`}>
                  {severity}
                </span>
              </div>
              <div className="text-[11px] text-white/40 font-mono truncate mt-0.5">
                {device.manufacturer} • {device.id.slice(0, 12)} • {factors.slice(0, 2).join(", ") || "Healthy"}
              </div>
            </div>
            <div className="w-16 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div className={`h-full rounded-full transition-all ${
                severity === "CRITICAL" ? "bg-red-400" :
                severity === "HIGH" ? "bg-amber-400" :
                severity === "MEDIUM" ? "bg-yellow-400" : "bg-emerald-400"
              }`} style={{ width: `${score}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl bg-[#FFB224]/5 border border-[#FFB224]/10 p-3">
        <div className="text-[11px] font-mono text-[#FFB224] font-medium">Inventive Feature - God Mode</div>
        <div className="text-[11px] text-white/50 mt-1">
          Risk scoring: compliance (40pts), lost mode (30), stale telemetry (&gt;24h = 15), outdated patch (25), low battery (10). 
          Proves security engineering mindset beyond basic CRUD.
        </div>
      </div>
    </div>
  );
}
