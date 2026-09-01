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
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand & Enterprise Identity */}
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 shadow-md shadow-emerald-900/30">
            <Smartphone className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold tracking-tight text-white sm:text-lg">
                Android Enterprise
              </span>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">
                AMAPI DPC
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {enterprise ? enterprise.name : "Enterprise Fleet Management"}
            </p>
          </div>
        </div>

        {/* Status Indicators & Action Buttons */}
        <div className="flex items-center space-x-3">
          {/* Mode Pill */}
          <div
            className={`hidden sm:flex items-center space-x-1.5 rounded-full px-3 py-1 text-xs font-medium border ${
              isLive
                ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                : "bg-blue-950/60 border-blue-500/40 text-blue-300"
            }`}
          >
            {isLive ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <FlaskConical className="h-3.5 w-3.5 text-blue-400" />
            )}
            <span>{isLive ? "LIVE GOOGLE AMAPI" : "VERIFIED ENTERPRISE SANDBOX"}</span>
          </div>

          {/* Quick QR Token */}
          <button
            onClick={onOpenQuickToken}
            className="flex items-center space-x-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors"
          >
            <QrCode className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">New Provisioning QR</span>
            <span className="sm:hidden">QR</span>
          </button>

          {/* Refresh */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh Fleet Data"
            className="rounded-lg border border-slate-700 bg-slate-800/80 p-2 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-emerald-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-t border-slate-800/60 bg-slate-950/60 px-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl space-x-1 overflow-x-auto py-1 text-sm no-scrollbar">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex items-center space-x-2 whitespace-nowrap rounded-lg px-3 py-1.5 font-medium transition-colors ${
              activeTab === "dashboard"
                ? "bg-slate-800 text-emerald-400 shadow-sm"
                : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
            }`}
          >
            <Activity className="h-4 w-4" />
            <span>Fleet Overview</span>
          </button>

          <button
            onClick={() => setActiveTab("devices")}
            className={`flex items-center space-x-2 whitespace-nowrap rounded-lg px-3 py-1.5 font-medium transition-colors ${
              activeTab === "devices"
                ? "bg-slate-800 text-emerald-400 shadow-sm"
                : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
            }`}
          >
            <Smartphone className="h-4 w-4" />
            <span>Devices & Fleet</span>
          </button>

          <button
            onClick={() => setActiveTab("enrollment")}
            className={`flex items-center space-x-2 whitespace-nowrap rounded-lg px-3 py-1.5 font-medium transition-colors ${
              activeTab === "enrollment"
                ? "bg-slate-800 text-emerald-400 shadow-sm"
                : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
            }`}
          >
            <QrCode className="h-4 w-4" />
            <span>Enrollment & QR Hub</span>
          </button>

          <button
            onClick={() => setActiveTab("policies")}
            className={`flex items-center space-x-2 whitespace-nowrap rounded-lg px-3 py-1.5 font-medium transition-colors ${
              activeTab === "policies"
                ? "bg-slate-800 text-emerald-400 shadow-sm"
                : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
            }`}
          >
            <Shield className="h-4 w-4" />
            <span>Policy Center</span>
          </button>

          <button
            onClick={() => setActiveTab("commands")}
            className={`flex items-center space-x-2 whitespace-nowrap rounded-lg px-3 py-1.5 font-medium transition-colors ${
              activeTab === "commands"
                ? "bg-slate-800 text-emerald-400 shadow-sm"
                : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
            }`}
          >
            <Terminal className="h-4 w-4" />
            <span>Remote Actions</span>
          </button>

          <button
            onClick={() => setActiveTab("logs")}
            className={`flex items-center space-x-2 whitespace-nowrap rounded-lg px-3 py-1.5 font-medium transition-colors ${
              activeTab === "logs"
                ? "bg-slate-800 text-emerald-400 shadow-sm"
                : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
            }`}
          >
            <Activity className="h-4 w-4" />
            <span>Pub/Sub & Audit Log</span>
          </button>

          <button
            onClick={() => setActiveTab("test-suite")}
            className={`flex items-center space-x-2 whitespace-nowrap rounded-lg px-3 py-1.5 font-medium transition-colors ${
              activeTab === "test-suite"
                ? "bg-slate-800 text-emerald-400 shadow-sm"
                : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
            }`}
          >
            <FlaskConical className="h-4 w-4" />
            <span>AMAPI Diagnostics</span>
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`flex items-center space-x-2 whitespace-nowrap rounded-lg px-3 py-1.5 font-medium transition-colors ${
              activeTab === "settings"
                ? "bg-slate-800 text-emerald-400 shadow-sm"
                : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
            }`}
          >
            <Settings className="h-4 w-4" />
            <span>Enterprise Settings</span>
          </button>
        </div>
      </div>
    </header>
  );
}
