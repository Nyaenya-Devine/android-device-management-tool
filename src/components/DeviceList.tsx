"use client";

import React, { useState } from "react";
import {
  Smartphone,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Lock,
  BatteryCharging,
  Wifi,
  HardDrive,
  Cpu,
  MoreVertical,
  Plus,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";

interface DeviceListProps {
  devices: any[];
  policies: any[];
  onSelectDevice: (device: any) => void;
  onOpenRegisterModal: () => void;
  onQuickCommand: (device: any, commandType: string) => void;
}

export function DeviceList({
  devices,
  policies,
  onSelectDevice,
  onOpenRegisterModal,
  onQuickCommand,
}: DeviceListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<string>("ALL");

  const filteredDevices = devices.filter((device) => {
    // Mode / status filter
    if (selectedFilter === "FULLY_MANAGED" && device.managementMode !== "FULLY_MANAGED") return false;
    if (selectedFilter === "WORK_PROFILE" && device.managementMode !== "WORK_PROFILE") return false;
    if (selectedFilter === "DEDICATED" && device.managementMode !== "DEDICATED") return false;
    if (selectedFilter === "NON_COMPLIANT" && device.isCompliant) return false;
    if (selectedFilter === "LOST_MODE" && device.state !== "LOST_MODE") return false;

    // Search filter
    if (searchTerm.trim().length > 0) {
      const term = searchTerm.toLowerCase();
      const match =
        device.model.toLowerCase().includes(term) ||
        device.manufacturer.toLowerCase().includes(term) ||
        device.serialNumber.toLowerCase().includes(term) ||
        (device.imei && device.imei.toLowerCase().includes(term)) ||
        (device.policyName && device.policyName.toLowerCase().includes(term)) ||
        device.id.toLowerCase().includes(term);
      if (!match) return false;
    }

    return true;
  });

  const formatBytes = (bytes?: number) => {
    if (!bytes) return "0 GB";
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Android Device Fleet
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Real-time inventory of fully managed devices, dedicated kiosks, and BYOD work profiles.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onOpenRegisterModal}
            className="flex items-center space-x-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-md hover:bg-emerald-500 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Register Device</span>
          </button>
        </div>
      </div>

      {/* Filter Bar & Search */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by model, serial number, IMEI, or policy..."
            className="w-full rounded-lg border border-slate-700 bg-slate-800/80 py-2 pl-9 pr-3 text-xs sm:text-sm text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center space-x-1 overflow-x-auto text-xs no-scrollbar">
          {[
            { id: "ALL", label: `All (${devices.length})` },
            { id: "FULLY_MANAGED", label: "Fully Managed" },
            { id: "WORK_PROFILE", label: "Work Profile" },
            { id: "DEDICATED", label: "Dedicated Kiosk" },
            { id: "NON_COMPLIANT", label: "Non-Compliant" },
            { id: "LOST_MODE", label: "Lost Mode" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedFilter(tab.id)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 font-medium transition-colors ${
                selectedFilter === tab.id
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Devices Grid / Table */}
      {filteredDevices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 text-slate-400 mb-3">
            <Smartphone className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-white">No devices found</h3>
          <p className="text-xs text-slate-400 max-w-sm mt-1">
            No devices matched your search or filter criteria. Try clearing the search query or enroll a new device.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDevices.map((device) => {
            const isLost = device.state === "LOST_MODE";
            const modeBadgeColor =
              device.managementMode === "FULLY_MANAGED"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : device.managementMode === "DEDICATED"
                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                : "bg-blue-500/10 text-blue-400 border-blue-500/20";

            return (
              <div
                key={device.id}
                onClick={() => onSelectDevice(device)}
                className={`group relative flex flex-col justify-between rounded-xl border p-5 shadow-sm transition-all hover:scale-[1.01] cursor-pointer ${
                  isLost
                    ? "border-amber-500/40 bg-amber-950/10 hover:border-amber-500/60"
                    : "border-slate-800 bg-slate-900/70 hover:border-slate-700"
                }`}
              >
                <div>
                  {/* Top Bar: Mode Badge & Compliance */}
                  <div className="flex items-center justify-between mb-3">
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold border ${modeBadgeColor}`}>
                      {device.managementMode.replace("_", " ")}
                    </span>

                    {isLost ? (
                      <span className="inline-flex items-center rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-500/30">
                        <Lock className="mr-1 h-3 w-3" /> Lost Mode Active
                      </span>
                    ) : device.isCompliant ? (
                      <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="mr-1 h-3 w-3" /> AMAPI Compliant
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-400 border border-rose-500/20">
                        <AlertTriangle className="mr-1 h-3 w-3" /> Non-Compliant
                      </span>
                    )}
                  </div>

                  {/* Device Title & Serial */}
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
                      {device.model}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {device.manufacturer} • SN: <span className="font-mono text-slate-300">{device.serialNumber}</span>
                    </p>
                  </div>

                  {/* Policy Tag */}
                  <div className="mt-3 inline-flex items-center rounded-lg bg-slate-800/80 px-2.5 py-1 text-[11px] text-slate-300 border border-slate-700/60">
                    <span className="text-slate-400 mr-1.5">Policy:</span>
                    <span className="font-medium text-emerald-400 truncate max-w-[200px]">
                      {device.policyName || "Corporate Standard"}
                    </span>
                    <span className="ml-1.5 text-[10px] text-slate-500">v{device.appliedPolicyVersion || 1}</span>
                  </div>

                  {/* Hardware & Telemetry Grid */}
                  <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-slate-300 border-t border-slate-800/80 pt-3">
                    <div className="flex items-center space-x-1.5">
                      <BatteryCharging className="h-3.5 w-3.5 text-emerald-400" />
                      <span>{device.batteryLevel}% ({device.batteryStatus || "Discharging"})</span>
                    </div>

                    <div className="flex items-center space-x-1.5 truncate">
                      <Wifi className="h-3.5 w-3.5 text-blue-400" />
                      <span className="truncate">{device.wifiSsid || device.networkType}</span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <Cpu className="h-3.5 w-3.5 text-indigo-400" />
                      <span>{device.osVersion.split(" (")[0]} (API {device.apiLevel})</span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <HardDrive className="h-3.5 w-3.5 text-amber-400" />
                      <span>Free: {formatBytes(device.freeInternalStorageBytes)}</span>
                    </div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="mt-5 flex items-center justify-between border-t border-slate-800/80 pt-3">
                  <span className="text-[10px] text-slate-500">
                    Sync: {new Date(device.lastStatusReportTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>

                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuickCommand(device, "LOCK");
                      }}
                      title="Remote Lock"
                      className="rounded-md border border-slate-700 bg-slate-800/80 p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                    >
                      <Lock className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuickCommand(device, "REBOOT");
                      }}
                      title="Remote Reboot"
                      className="rounded-md border border-slate-700 bg-slate-800/80 p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDevice(device);
                      }}
                      className="rounded-md bg-emerald-600/90 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500 transition-colors"
                    >
                      Inspect
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
