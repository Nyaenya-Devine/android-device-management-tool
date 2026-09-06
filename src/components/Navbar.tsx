"use client";

import React from "react";
import {
  Smartphone,
  Shield,
  QrCode,
  Sliders,
  Terminal,
  Activity,
  Settings,
  CheckCircle2,
  AlertCircle,
  FlaskConical,
  RefreshCw,
  Zap,
} from "lucide-react";

export type NavTab =
  | "dashboard"
  | "devices"
  | "enrollment"
  | "policies"
  | "commands"
  | "logs"
  | "settings"
  | "test-suite";

interface NavbarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  enterprise: {
    name: string;
    enterpriseId: string;
    mode: string;
    gcpProjectId?: string | null;
  } | null;
  onRefresh: () => void;
  isRefreshing: boolean;
  onOpenQuickToken: () => void;
}

export function Navbar({
  activeTab,
  setActiveTab,
  enterprise,
  onRefresh,
  isRefreshing,
  onOpenQuickToken,
}: NavbarProps) {
  const isLive = enterprise?.mode === "LIVE_AMAPI";

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0E0E11]/80 backdrop-blur-[20px]">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#FFFDFA] shadow-sm">
            <div className="absolute inset-0 rounded-full blur-[8px] opacity-30 bg-gradient-to-br from-[#FFB224] to-[#8B5CF6]" />
            <Smartphone className="h-5 w-5 text-[#050507] relative z-10" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-display text-[16px] tracking-[-0.02em] text-[#F5F3EF] sm:text-[18px]">
                Android Enterprise
              </span>
              <span className="rounded-full bg-white/[0.06] border border-white/[0.08] px-2 py-0.5 font-mono text-[9px] tracking-[0.12em] uppercase text-white/50">
                AMAPI DPC
              </span>
            </div>
            <p className="font-mono text-[11px] tracking-[0.04em] text-white/40">
              {enterprise ? enterprise.name : "Enterprise Fleet Management"}
            </p>
          </div>
        </div>

        {/* Status & Actions */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div
            className={`hidden sm:flex items-center space-x-1.5 rounded-full px-3 py-1 text-[11px] font-mono tracking-[0.06em] uppercase border backdrop-blur ${
              isLive
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                : "bg-[#8B5CF6]/10 border-[#8B5CF6]/20 text-[#8B5CF6]"
            }`}
          >
            {isLive ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <FlaskConical className="h-3.5 w-3.5" />
            )}
            <span>{isLive ? "LIVE AMAPI" : "SANDBOX"}</span>
          </div>

          <button
            onClick={onOpenQuickToken}
            className="flex items-center space-x-1.5 rounded-full bg-[#FFFDFA] px-4 py-2 text-xs font-semibold text-[#050507] shadow-sm hover:bg-white transition"
          >
            <QrCode className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">New QR</span>
            <span className="sm:hidden">QR</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh Fleet Data"
            className="rounded-full border border-white/[0.08] bg-white/[0.04] p-2.5 text-white/60 hover:bg-white/[0.08] hover:text-white transition disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-[#FFB224]" : ""}`} />
          </button>
        </div>
      </div>

      {/* Navigation Tabs - Obsidian Aurora */}
      <div className="border-t border-white/[0.06] bg-[#050507]/60 px-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl space-x-1 overflow-x-auto py-2 text-sm no-scrollbar">
          {[
            { id: "dashboard", label: "Fleet Overview", icon: Activity },
            { id: "devices", label: "Devices & Fleet", icon: Smartphone },
            { id: "enrollment", label: "Enrollment & QR Hub", icon: QrCode },
            { id: "policies", label: "Policy Center", icon: Shield },
            { id: "commands", label: "Remote Actions", icon: Terminal },
            { id: "logs", label: "Audit Log", icon: Activity },
            { id: "test-suite", label: "Diagnostics", icon: FlaskConical },
            { id: "settings", label: "Settings", icon: Settings },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as NavTab)}
                className={`flex items-center space-x-2 whitespace-nowrap rounded-full px-4 py-2 font-medium transition-all text-[13px] ${
                  isActive
                    ? "bg-[#FFFDFA] text-[#050507] shadow-sm"
                    : "text-white/50 hover:bg-white/[0.06] hover:text-white/80 border border-transparent hover:border-white/[0.06]"
                }`}
              >
                <tab.icon className={`h-4 w-4 ${isActive ? "text-[#050507]" : ""}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
