"use client";

import React, { useState } from "react";
import {
  X,
  Smartphone,
  Plus,
  CheckCircle2,
} from "lucide-react";
import { ManagementMode } from "@/lib/types/amapi";

interface DeviceRegistrationModalProps {
  policies: any[];
  onClose: () => void;
  onRegister: (deviceData: any) => Promise<void>;
}

export function DeviceRegistrationModal({
  policies,
  onClose,
  onRegister,
}: DeviceRegistrationModalProps) {
  const [model, setModel] = useState("Galaxy S24 Ultra");
  const [manufacturer, setManufacturer] = useState("Samsung");
  const [serialNumber, setSerialNumber] = useState(
    `SN${Date.now().toString().slice(-6)}${Math.random().toString(36).substring(2, 4).toUpperCase()}`
  );
  const [imei, setImei] = useState(`35${Math.floor(1000000000000 + Math.random() * 9000000000000)}`);
  const [managementMode, setManagementMode] = useState<ManagementMode>("FULLY_MANAGED");
  const [policyId, setPolicyId] = useState(policies[0]?.id || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onRegister({
        model,
        manufacturer,
        serialNumber,
        imei,
        managementMode,
        policyId: policyId || policies[0]?.id,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Register Device into Fleet</h2>
              <p className="text-xs text-slate-400">Add hardware unit to enterprise inventory</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
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

          <div className="grid grid-cols-2 gap-3">
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

            <div>
              <label className="block font-semibold text-slate-300 mb-1">IMEI Number (Optional)</label>
              <input
                type="text"
                value={imei}
                onChange={(e) => setImei(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2 text-white font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Management Mode</label>
              <select
                value={managementMode}
                onChange={(e) => setManagementMode(e.target.value as ManagementMode)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2 text-white"
              >
                <option value="FULLY_MANAGED">Fully Managed (DO)</option>
                <option value="WORK_PROFILE">Work Profile (PO)</option>
                <option value="DEDICATED">Dedicated Kiosk</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Assign Policy</label>
              <select
                value={policyId}
                onChange={(e) => setPolicyId(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2 text-white"
              >
                {policies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 font-medium text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center space-x-2 rounded-xl bg-emerald-600 px-5 py-2 font-semibold text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
            >
              <Smartphone className="h-4 w-4" />
              <span>{isSubmitting ? "Registering..." : "Add to Fleet"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
