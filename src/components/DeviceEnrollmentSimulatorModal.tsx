"use client";

import React, { useState } from "react";
import {
  X,
  Smartphone,
  QrCode,
  FlaskConical,
  CheckCircle2,
  AlertCircle,
  Wifi,
  Sparkles,
} from "lucide-react";

interface DeviceEnrollmentSimulatorModalProps {
  token: any;
  onClose: () => void;
  onSuccess: (newDevice: any) => void;
}

export function DeviceEnrollmentSimulatorModal({
  token,
  onClose,
  onSuccess,
}: DeviceEnrollmentSimulatorModalProps) {
  const [model, setModel] = useState("Google Pixel 9 Pro");
  const [manufacturer, setManufacturer] = useState("Google");
  const [serialNumber, setSerialNumber] = useState(
    `SN${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 4).toUpperCase()}`
  );
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const devicePresets = [
    { model: "Pixel 9 Pro", manufacturer: "Google" },
    { model: "Galaxy S24 Ultra", manufacturer: "Samsung" },
    { model: "TC58 Rugged Mobile Computer", manufacturer: "Zebra Technologies" },
    { model: "CT47 Enterprise Handheld", manufacturer: "Honeywell" },
    { model: "ThinkPhone by Motorola", manufacturer: "Motorola" },
  ];

  const handleSelectPreset = (preset: { model: string; manufacturer: string }) => {
    setModel(preset.model);
    setManufacturer(preset.manufacturer);
  };

  const handleSimulatePair = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsEnrolling(true);
    setResultMessage(null);

    try {
      const res = await fetch(`/api/enrollment-tokens/${token.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test-enroll",
          model,
          manufacturer,
          serialNumber,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setResultMessage(`Device ${model} successfully provisioned!`);
        setTimeout(() => {
          onSuccess(data.device);
          onClose();
        }, 1200);
      } else {
        setResultMessage(data.error || "Enrollment simulation failed");
      }
    } catch (err: unknown) {
      setResultMessage(err instanceof Error ? err.message : "Enrollment request error");
    } finally {
      setIsEnrolling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Simulate Device Enrollment (6-Tap)</h2>
              <p className="text-xs text-slate-400">Pair an Android device against this token</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Token Context */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-400">Target Policy:</span>
            <span className="font-semibold text-emerald-400">{token.policyName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Token String:</span>
            <span className="font-mono text-slate-200">{token.tokenValue}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Management Mode:</span>
            <span className="text-slate-300">
              {token.allowPersonalUsage === "PERSONAL_USAGE_ALLOWED" ? "WORK_PROFILE (BYOD)" : "FULLY_MANAGED"}
            </span>
          </div>
        </div>

        {/* Quick Presets */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Quick Hardware Presets</label>
          <div className="flex flex-wrap gap-1.5">
            {devicePresets.map((p) => (
              <button
                type="button"
                key={p.model}
                onClick={() => handleSelectPreset(p)}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  model === p.model
                    ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
                    : "border-slate-800 bg-slate-800/60 text-slate-400 hover:bg-slate-800"
                }`}
              >
                {p.model}
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSimulatePair} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Manufacturer</label>
              <input
                type="text"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2 text-white"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Model Name</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2 text-white"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Serial Number</label>
            <input
              type="text"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2 text-white font-mono"
              required
            />
          </div>

          {resultMessage && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-3 text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>{resultMessage}</span>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 font-medium text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isEnrolling}
              className="flex items-center space-x-2 rounded-xl bg-blue-600 px-5 py-2 font-semibold text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
            >
              <Smartphone className="h-4 w-4" />
              <span>{isEnrolling ? "Provisioning..." : "Simulate 6-Tap Scan"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
