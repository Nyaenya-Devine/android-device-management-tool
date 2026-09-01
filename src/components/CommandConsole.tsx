"use client";

import React, { useState } from "react";
import {
  Terminal,
  Send,
  Lock,
  RotateCw,
  Trash2,
  Radio,
  KeyRound,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Smartphone,
} from "lucide-react";
import { CommandType } from "@/lib/types/amapi";

interface CommandConsoleProps {
  devices: any[];
  onIssueCommand: (deviceId: string, commandType: string, payload?: any) => Promise<void>;
}

export function CommandConsole({ devices, onIssueCommand }: CommandConsoleProps) {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(devices[0]?.id || "");
  const [commandType, setCommandType] = useState<CommandType>("LOCK");
  const [lostMessage, setLostMessage] = useState("Corporate Device. Call +1-800-555-0199 if found.");
  const [lostPhone, setLostPhone] = useState("+1-800-555-0199");
  const [passcode, setPasscode] = useState("892014");
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionMessage, setExecutionMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const targetDevice = devices.find((d) => d.id === selectedDeviceId) || devices[0];

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeviceId) return;

    setIsExecuting(true);
    setExecutionMessage(null);
    try {
      let payload: Record<string, unknown> = {};
      if (commandType === "START_LOST_MODE") {
        payload = { lostMessage, lostPhone };
      } else if (commandType === "RESET_PASSWORD") {
        payload = { newPasscode: passcode };
      }

      await onIssueCommand(selectedDeviceId, commandType, payload);
      setExecutionMessage({
        text: `AMAPI Command [${commandType}] successfully dispatched to ${targetDevice?.model || selectedDeviceId}!`,
        type: "success",
      });
    } catch (err: unknown) {
      setExecutionMessage({
        text: err instanceof Error ? err.message : "Failed to issue command",
        type: "error",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Remote MDM Command Dispatcher
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5 max-w-3xl">
          Direct AMAPI command pipeline: Trigger instant remote actions across enrolled devices over Google CloudDPC.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 cols): Command Dispatcher Box */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl space-y-5">
          <div className="flex items-center space-x-2.5 border-b border-slate-800 pb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Terminal className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Issue Device Command</h2>
              <p className="text-[11px] text-slate-400">AMAPI :issueCommand endpoint</p>
            </div>
          </div>

          <form onSubmit={handleExecute} className="space-y-4 text-xs">
            {/* Target Device */}
            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">
                Target Device <span className="text-emerald-400">*</span>
              </label>
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
              >
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.model} ({d.serialNumber}) - {d.managementMode}
                  </option>
                ))}
              </select>
            </div>

            {/* Command Type Grid */}
            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">
                Action Type <span className="text-emerald-400">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "LOCK", label: "Remote Lock", icon: Lock },
                  { id: "REBOOT", label: "Reboot Device", icon: RotateCw },
                  { id: "START_LOST_MODE", label: "Start Lost Mode", icon: Radio },
                  { id: "STOP_LOST_MODE", label: "Stop Lost Mode", icon: Radio },
                  { id: "RESET_PASSWORD", label: "Reset PIN", icon: KeyRound },
                  { id: "WIPE", label: "Remote Wipe", icon: Trash2 },
                ].map((c) => {
                  const Icon = c.icon;
                  const isSelected = commandType === c.id;
                  return (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => setCommandType(c.id as CommandType)}
                      className={`flex items-center space-x-2 rounded-xl border p-2.5 text-left transition-all ${
                        isSelected
                          ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
                          : "border-slate-800 bg-slate-800/40 text-slate-400 hover:bg-slate-800"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="font-semibold text-[11px] text-white">{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Contextual Parameters */}
            {commandType === "START_LOST_MODE" && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3.5 space-y-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Lost Screen Message</label>
                  <input
                    type="text"
                    value={lostMessage}
                    onChange={(e) => setLostMessage(e.target.value)}
                    className="w-full rounded border border-slate-700 bg-slate-800 p-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Owner Contact Phone</label>
                  <input
                    type="text"
                    value={lostPhone}
                    onChange={(e) => setLostPhone(e.target.value)}
                    className="w-full rounded border border-slate-700 bg-slate-800 p-1.5 text-white"
                  />
                </div>
              </div>
            )}

            {commandType === "RESET_PASSWORD" && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3.5">
                <label className="block text-[10px] text-slate-400 mb-1">New Lock PIN / Passcode</label>
                <input
                  type="text"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="w-full rounded border border-slate-700 bg-slate-800 p-1.5 text-white font-mono"
                />
              </div>
            )}

            {commandType === "WIPE" && (
              <div className="rounded-xl border border-rose-950/40 bg-rose-950/20 p-3 text-rose-300 text-[11px]">
                <strong>Warning:</strong> Remote Wipe will factory reset the device or eradicate the enterprise work container immediately upon next CloudDPC sync.
              </div>
            )}

            {executionMessage && (
              <div
                className={`rounded-xl p-3 text-xs border ${
                  executionMessage.type === "success"
                    ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-300"
                    : "border-rose-500/40 bg-rose-950/20 text-rose-300"
                }`}
              >
                {executionMessage.text}
              </div>
            )}

            <button
              type="submit"
              disabled={isExecuting || !selectedDeviceId}
              className="w-full rounded-xl bg-emerald-600 py-2.5 font-semibold text-white shadow-lg shadow-emerald-950/50 hover:bg-emerald-500 transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              <Send className="h-4 w-4" />
              <span>{isExecuting ? "Executing AMAPI Dispatch..." : `Execute ${commandType}`}</span>
            </button>
          </form>
        </div>

        {/* Right Column (7 cols): Selected Device Telemetry Card */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl space-y-5">
          <h2 className="text-sm font-bold text-white flex items-center space-x-2">
            <Smartphone className="h-4 w-4 text-emerald-400" />
            <span>Target Device Context</span>
          </h2>

          {targetDevice ? (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div>
                  <h3 className="text-base font-bold text-white">{targetDevice.model}</h3>
                  <p className="text-xs text-slate-400">
                    {targetDevice.manufacturer} • SN: {targetDevice.serialNumber}
                  </p>
                </div>
                <span className="rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                  {targetDevice.managementMode}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                  <span className="text-[10px] text-slate-500 uppercase">State</span>
                  <div className="font-semibold text-white mt-0.5">{targetDevice.state}</div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                  <span className="text-[10px] text-slate-500 uppercase">Battery</span>
                  <div className="font-semibold text-emerald-400 mt-0.5">{targetDevice.batteryLevel}%</div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                  <span className="text-[10px] text-slate-500 uppercase">IP Address</span>
                  <div className="font-semibold text-white mt-0.5">{targetDevice.ipAddress}</div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-2">
                <span className="text-[11px] font-semibold text-slate-300">AMAPI Resource Path:</span>
                <p className="font-mono text-[11px] text-emerald-300 break-all bg-slate-900 p-2 rounded border border-slate-800">
                  {targetDevice.googleDeviceName || `enterprises/demo/devices/${targetDevice.id}`}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs">No device selected.</div>
          )}
        </div>
      </div>
    </div>
  );
}
