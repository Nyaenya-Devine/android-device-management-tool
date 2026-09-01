"use client";

import React, { useState } from "react";
import {
  Shield,
  Plus,
  Lock,
  Camera,
  EyeOff,
  RefreshCw,
  AppWindow,
  Radio,
  Sliders,
  CheckCircle2,
  Copy,
  Check,
  Smartphone,
  Layers,
  Save,
} from "lucide-react";
import { AmapiPolicyObject } from "@/lib/types/amapi";

interface PolicyCenterProps {
  policies: any[];
  onCreatePolicy: (policyData: any) => Promise<any>;
  onUpdatePolicy: (policyId: string, policyData: any) => Promise<any>;
  onDeletePolicy: (policyId: string) => Promise<void>;
}

export function PolicyCenter({
  policies,
  onCreatePolicy,
  onUpdatePolicy,
  onDeletePolicy,
}: PolicyCenterProps) {
  const [selectedPolicy, setSelectedPolicy] = useState<any>(policies[0] || null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Policy Form State
  const [formName, setFormName] = useState(selectedPolicy?.name || "");
  const [formDesc, setFormDesc] = useState(selectedPolicy?.description || "");
  const [isDefault, setIsDefault] = useState(selectedPolicy?.isDefault || false);

  // AMAPI Structured fields
  const [minPasscodeLen, setMinPasscodeLen] = useState<number>(
    selectedPolicy?.policyJson?.passwordRequirements?.passwordMinimumLength || 6
  );
  const [passcodeQuality, setPasscodeQuality] = useState<string>(
    selectedPolicy?.policyJson?.passwordRequirements?.passwordQuality || "NUMERIC_COMPLEX"
  );
  const [maxFailedPasscode, setMaxFailedPasscode] = useState<number>(
    selectedPolicy?.policyJson?.passwordRequirements?.maximumFailedPasswordsForWipe || 10
  );
  const [cameraDisabled, setCameraDisabled] = useState<boolean>(
    Boolean(selectedPolicy?.policyJson?.cameraDisabled)
  );
  const [screenCaptureDisabled, setScreenCaptureDisabled] = useState<boolean>(
    Boolean(selectedPolicy?.policyJson?.screenCaptureDisabled)
  );
  const [kioskModeEnabled, setKioskModeEnabled] = useState<boolean>(
    Boolean(selectedPolicy?.policyJson?.kioskCustomLauncherEnabled)
  );
  const [kioskPackage, setKioskPackage] = useState<string>(
    selectedPolicy?.policyJson?.applications?.find((a: any) => a.installType === "KIOSK")?.packageName || ""
  );
  const [systemUpdateType, setSystemUpdateType] = useState<string>(
    selectedPolicy?.policyJson?.systemUpdate?.type || "AUTOMATIC"
  );
  const [locationMode, setLocationMode] = useState<string>(
    selectedPolicy?.policyJson?.locationMode || "LOCATION_USER_CHOICE"
  );

  const selectPolicy = (pol: any) => {
    setSelectedPolicy(pol);
    setFormName(pol.name);
    setFormDesc(pol.description || "");
    setIsDefault(pol.isDefault);
    setMinPasscodeLen(pol.policyJson?.passwordRequirements?.passwordMinimumLength || 6);
    setPasscodeQuality(pol.policyJson?.passwordRequirements?.passwordQuality || "NUMERIC_COMPLEX");
    setMaxFailedPasscode(pol.policyJson?.passwordRequirements?.maximumFailedPasswordsForWipe || 10);
    setCameraDisabled(Boolean(pol.policyJson?.cameraDisabled));
    setScreenCaptureDisabled(Boolean(pol.policyJson?.screenCaptureDisabled));
    setKioskModeEnabled(Boolean(pol.policyJson?.kioskCustomLauncherEnabled));
    setKioskPackage(
      pol.policyJson?.applications?.find((a: any) => a.installType === "KIOSK")?.packageName || ""
    );
    setSystemUpdateType(pol.policyJson?.systemUpdate?.type || "AUTOMATIC");
    setLocationMode(pol.policyJson?.locationMode || "LOCATION_USER_CHOICE");
    setIsEditing(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedPolicyJson: AmapiPolicyObject = {
        ...(selectedPolicy?.policyJson || {}),
        passwordRequirements: {
          passwordMinimumLength: minPasscodeLen,
          passwordQuality: passcodeQuality as any,
          maximumFailedPasswordsForWipe: maxFailedPasscode,
        },
        cameraDisabled,
        screenCaptureDisabled,
        locationMode: locationMode as any,
        kioskCustomLauncherEnabled: kioskModeEnabled,
        systemUpdate: {
          type: systemUpdateType as any,
          startMinutes: 120,
          endMinutes: 300,
        },
        statusReportingSettings: {
          applicationReportsEnabled: true,
          deviceSettingsEnabled: true,
          softwareInfoEnabled: true,
          memoryInfoEnabled: true,
          networkInfoEnabled: true,
          powerManagementEventsEnabled: true,
          hardwareStatusReportsEnabled: true,
          displayInfoEnabled: true,
        },
      };

      if (kioskModeEnabled && kioskPackage.trim()) {
        updatedPolicyJson.applications = [
          {
            packageName: kioskPackage.trim(),
            installType: "KIOSK",
            defaultPermissionPolicy: "GRANT",
          },
          {
            packageName: "com.google.android.apps.work.clouddpc",
            installType: "FORCE_INSTALLED",
            defaultPermissionPolicy: "GRANT",
          },
        ];
      }

      await onUpdatePolicy(selectedPolicy.id, {
        name: formName,
        description: formDesc,
        isDefault,
        policyJson: updatedPolicyJson,
      });

      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateNew = async () => {
    const newName = `Enterprise Policy ${policies.length + 1}`;
    const res = await onCreatePolicy({
      name: newName,
      description: "Custom enterprise policy configuration",
    });
    if (res?.policy) {
      selectPolicy(res.policy);
      setIsEditing(true);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Android Enterprise Policy Center
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Define Android Management API (AMAPI) policies to enforce password constraints, app lockdowns, system update windows, and kiosk profiles.
          </p>
        </div>

        <button
          onClick={handleCreateNew}
          className="flex items-center space-x-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-md hover:bg-emerald-500 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>New AMAPI Policy</span>
        </button>
      </div>

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (4 cols): Policy List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
            Enterprise Policies ({policies.length})
          </div>

          <div className="space-y-2">
            {policies.map((policy) => {
              const isSelected = selectedPolicy?.id === policy.id;
              return (
                <div
                  key={policy.id}
                  onClick={() => selectPolicy(policy)}
                  className={`rounded-xl border p-4 cursor-pointer transition-all ${
                    isSelected
                      ? "border-emerald-500/60 bg-emerald-950/20 shadow-md"
                      : "border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                      <Shield className={`h-4 w-4 ${isSelected ? "text-emerald-400" : "text-slate-400"}`} />
                      <span className="truncate">{policy.name}</span>
                    </h3>
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                      v{policy.version}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2">
                    {policy.description || "Android enterprise policy definition"}
                  </p>

                  <div className="mt-3 flex items-center justify-between text-[11px] border-t border-slate-800/80 pt-2 text-slate-400">
                    <div className="flex items-center space-x-1.5">
                      <Smartphone className="h-3.5 w-3.5 text-slate-500" />
                      <span>{policy.deviceCount || 0} Devices</span>
                    </div>

                    {policy.isDefault && (
                      <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                        Default Fleet Policy
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column (8 cols): Interactive AMAPI Policy Editor */}
        {selectedPolicy && (
          <div className="lg:col-span-8 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl space-y-6">
            {/* Header / Save Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white">{selectedPolicy.name}</h2>
                <span className="text-xs font-mono text-slate-400">
                  {selectedPolicy.googlePolicyName || `policies/${selectedPolicy.id}`}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center space-x-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-emerald-500 transition-colors disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  <span>{isSaving ? "Saving & Syncing..." : "Save & Sync Fleet"}</span>
                </button>
              </div>
            </div>

            {/* Policy Parameters Form */}
            <div className="space-y-6 text-xs">
              {/* General Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Policy Display Name</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2 text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Description</label>
                  <input
                    type="text"
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2 text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Passcode Requirements */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
                <h3 className="text-xs font-bold text-white flex items-center space-x-2">
                  <Lock className="h-4 w-4 text-emerald-400" />
                  <span>Screen Lock & Passcode Constraints</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Minimum PIN Length</label>
                    <select
                      value={minPasscodeLen}
                      onChange={(e) => setMinPasscodeLen(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-white"
                    >
                      <option value={4}>4 Digits</option>
                      <option value={6}>6 Digits (Standard)</option>
                      <option value={8}>8 Digits</option>
                      <option value={10}>10 Digits (High Sec)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Complexity Quality</label>
                    <select
                      value={passcodeQuality}
                      onChange={(e) => setPasscodeQuality(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-white"
                    >
                      <option value="NUMERIC">Numeric</option>
                      <option value="NUMERIC_COMPLEX">Numeric Complex (Non-Sequential)</option>
                      <option value="ALPHANUMERIC">Alphanumeric</option>
                      <option value="COMPLEX">Complex (Symbols & Mixed)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Max Failed Attempts (Wipe)</label>
                    <select
                      value={maxFailedPasscode}
                      onChange={(e) => setMaxFailedPasscode(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-white"
                    >
                      <option value={5}>5 Attempts</option>
                      <option value={10}>10 Attempts (Standard)</option>
                      <option value={15}>15 Attempts</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Hardware & Privacy Restrictions */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
                <h3 className="text-xs font-bold text-white flex items-center space-x-2">
                  <Camera className="h-4 w-4 text-teal-400" />
                  <span>Hardware & Sensor Policy</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center space-x-3 rounded-lg bg-slate-900 p-3 border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cameraDisabled}
                      onChange={(e) => setCameraDisabled(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="font-semibold text-white">Disable Hardware Camera</div>
                      <div className="text-[10px] text-slate-400">Blocks all camera sensors across apps</div>
                    </div>
                  </label>

                  <label className="flex items-center space-x-3 rounded-lg bg-slate-900 p-3 border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={screenCaptureDisabled}
                      onChange={(e) => setScreenCaptureDisabled(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="font-semibold text-white">Disable Screen Capture</div>
                      <div className="text-[10px] text-slate-400">Prevents screenshots and screen recording</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Dedicated Kiosk Mode */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white flex items-center space-x-2">
                    <AppWindow className="h-4 w-4 text-amber-400" />
                    <span>Dedicated Kiosk / Single App Lockdown</span>
                  </h3>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={kioskModeEnabled}
                      onChange={(e) => setKioskModeEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>

                {kioskModeEnabled && (
                  <div className="pt-2">
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Kiosk Application Android Package Name
                    </label>
                    <input
                      type="text"
                      value={kioskPackage}
                      onChange={(e) => setKioskPackage(e.target.value)}
                      placeholder="e.g. com.apex.fieldops.scanner"
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-white"
                    />
                  </div>
                )}
              </div>

              {/* System Updates */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
                <h3 className="text-xs font-bold text-white flex items-center space-x-2">
                  <RefreshCw className="h-4 w-4 text-indigo-400" />
                  <span>OTA System Update Policy</span>
                </h3>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "AUTOMATIC", label: "Automatic", desc: "Install as soon as published" },
                    { id: "WINDOWED", label: "Maintenance Window", desc: "Install 02:00 - 05:00 only" },
                    { id: "POSTPONE", label: "Postpone 30 Days", desc: "Block for QA testing" },
                  ].map((u) => (
                    <button
                      type="button"
                      key={u.id}
                      onClick={() => setSystemUpdateType(u.id)}
                      className={`rounded-lg border p-2.5 text-left transition-all ${
                        systemUpdateType === u.id
                          ? "border-indigo-500/60 bg-indigo-500/10 text-indigo-300"
                          : "border-slate-800 bg-slate-900 text-slate-400"
                      }`}
                    >
                      <div className="font-semibold text-white text-[11px]">{u.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{u.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Raw AMAPI JSON View */}
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-slate-400">AMAPI Policy JSON Object</span>
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(selectedPolicy.policyJson, null, 2), "polraw")}
                    className="text-[11px] text-emerald-400 hover:underline flex items-center"
                  >
                    {copiedKey === "polraw" ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
                    <span>Copy JSON</span>
                  </button>
                </div>
                <pre className="max-h-48 overflow-y-auto rounded-lg bg-slate-900 p-3 font-mono text-[10px] text-emerald-300">
                  {JSON.stringify(selectedPolicy.policyJson, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
