"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Navbar, NavTab } from "@/components/Navbar";
import { FleetDashboard } from "@/components/FleetDashboard";
import { DeviceList } from "@/components/DeviceList";
import { DeviceDetailModal } from "@/components/DeviceDetailModal";
import { EnrollmentHub } from "@/components/EnrollmentHub";
import { PolicyCenter } from "@/components/PolicyCenter";
import { CommandConsole } from "@/components/CommandConsole";
import { AuditLogViewer } from "@/components/AuditLogViewer";
import { EnterpriseSettings } from "@/components/EnterpriseSettings";
import { TestSuiteViewer } from "@/components/TestSuiteViewer";
import { DeviceEnrollmentSimulatorModal } from "@/components/DeviceEnrollmentSimulatorModal";
import { DeviceRegistrationModal } from "@/components/DeviceRegistrationModal";
import { RefreshCw } from "lucide-react";

export default function AppHome() {
  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");
  const [enterprise, setEnterprise] = useState<any | null>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any[]>([]);
  const [tokens, setTokens] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [pubsubMessages, setPubsubMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals state
  const [selectedDevice, setSelectedDevice] = useState<any | null>(null);
  const [simulatorToken, setSimulatorToken] = useState<any | null>(null);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  // Fetch all fleet data
  const fetchData = useCallback(async (showLoading = false) => {
    if (showLoading) setIsRefreshing(true);
    try {
      const [entRes, devRes, polRes, tokRes, logRes] = await Promise.all([
        fetch("/api/enterprise").then((r) => r.json()),
        fetch("/api/devices").then((r) => r.json()),
        fetch("/api/policies").then((r) => r.json()),
        fetch("/api/enrollment-tokens").then((r) => r.json()),
        fetch("/api/logs").then((r) => r.json()),
      ]);

      if (entRes.enterprise) setEnterprise(entRes.enterprise);
      if (devRes.devices) setDevices(devRes.devices);
      if (polRes.policies) setPolicies(polRes.policies);
      if (tokRes.tokens) setTokens(tokRes.tokens);
      if (logRes.auditLogs) setAuditLogs(logRes.auditLogs);
      if (logRes.pubsubMessages) setPubsubMessages(logRes.pubsubMessages);
    } catch (err) {
      console.error("Failed to load enterprise fleet data:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Issue MDM command
  const handleIssueCommand = async (deviceId: string, commandType: string, payload?: any) => {
    const res = await fetch(`/api/devices/${deviceId}/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commandType, payload }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Command execution failed");
    }

    // Refresh devices and logs
    await fetchData();
    return data;
  };

  // Update device
  const handleUpdateDevice = async (deviceId: string, updateData: any) => {
    const res = await fetch(`/api/devices/${deviceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updateData),
    });

    if (res.ok) {
      await fetchData();
      if (selectedDevice && selectedDevice.id === deviceId) {
        const updated = devices.find((d) => d.id === deviceId);
        if (updated) setSelectedDevice(updated);
      }
    }
  };

  // Delete device
  const handleDeleteDevice = async (deviceId: string) => {
    await fetch(`/api/devices/${deviceId}`, { method: "DELETE" });
    await fetchData();
  };

  // Register device
  const handleRegisterDevice = async (deviceData: any) => {
    await fetch("/api/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(deviceData),
    });
    await fetchData();
  };

  // Generate Token
  const handleGenerateToken = async (tokenData: any) => {
    const res = await fetch("/api/enrollment-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tokenData),
    });
    const data = await res.json();
    if (res.ok) {
      await fetchData();
      return data;
    }
    throw new Error(data.error || "Token creation failed");
  };

  // Revoke Token
  const handleRevokeToken = async (tokenId: string) => {
    await fetch(`/api/enrollment-tokens/${tokenId}`, { method: "DELETE" });
    await fetchData();
  };

  // Create Policy
  const handleCreatePolicy = async (policyData: any) => {
    const res = await fetch("/api/policies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(policyData),
    });
    const data = await res.json();
    if (res.ok) {
      await fetchData();
      return data;
    }
    throw new Error(data.error || "Policy creation failed");
  };

  // Update Policy
  const handleUpdatePolicy = async (policyId: string, policyData: any) => {
    const res = await fetch(`/api/policies/${policyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(policyData),
    });
    const data = await res.json();
    if (res.ok) {
      await fetchData();
      return data;
    }
    throw new Error(data.error || "Policy update failed");
  };

  // Delete Policy
  const handleDeletePolicy = async (policyId: string) => {
    const res = await fetch(`/api/policies/${policyId}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      await fetchData();
      return data;
    }
    throw new Error(data.error || "Policy deletion failed");
  };

  // Update Enterprise Settings
  const handleUpdateEnterprise = async (data: any) => {
    const res = await fetch("/api/enterprise", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const resData = await res.json();
    if (res.ok) {
      await fetchData();
      return resData;
    }
    throw new Error(resData.error || "Enterprise update failed");
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050507] text-[#F5F3EF] relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-[20%] left-[20%] w-[600px] h-[400px] rounded-full blur-[80px] opacity-[0.08] bg-[#FFB224]" />
          <div className="absolute bottom-[20%] right-[20%] w-[500px] h-[400px] rounded-full blur-[80px] opacity-[0.06] bg-[#8B5CF6]" />
        </div>
        <div className="flex flex-col items-center space-y-4 relative z-10">
          <div className="h-12 w-12 rounded-full bg-[#FFFDFA] flex items-center justify-center relative">
            <div className="absolute inset-0 rounded-full blur-[10px] opacity-30 bg-gradient-to-br from-[#FFB224] to-[#8B5CF6]" />
            <RefreshCw className="h-6 w-6 animate-spin text-[#050507] relative z-10" />
          </div>
          <p className="font-mono text-[11px] tracking-[0.14em] uppercase text-white/50">
            Initializing Android Enterprise AMAPI DPC Console...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050507] text-[#F5F3EF] relative">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        enterprise={enterprise}
        onRefresh={() => fetchData(true)}
        isRefreshing={isRefreshing}
        onOpenQuickToken={() => setActiveTab("enrollment")}
      />

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {activeTab === "dashboard" && (
          <FleetDashboard
            devices={devices}
            policies={policies}
            tokens={tokens}
            logs={auditLogs}
            enterprise={enterprise}
            onNavigateTab={setActiveTab}
            onSelectDevice={setSelectedDevice}
            onOpenQuickToken={() => setActiveTab("enrollment")}
          />
        )}

        {activeTab === "devices" && (
          <DeviceList
            devices={devices}
            policies={policies}
            onSelectDevice={setSelectedDevice}
            onOpenRegisterModal={() => setIsRegisterModalOpen(true)}
            onQuickCommand={async (device, cmd) => {
              await handleIssueCommand(device.id, cmd);
            }}
          />
        )}

        {activeTab === "enrollment" && (
          <EnrollmentHub
            tokens={tokens}
            policies={policies}
            onGenerateToken={handleGenerateToken}
            onRevokeToken={handleRevokeToken}
            onTestEnrollToken={(tok) => setSimulatorToken(tok)}
          />
        )}

        {activeTab === "policies" && (
          <PolicyCenter
            policies={policies}
            onCreatePolicy={handleCreatePolicy}
            onUpdatePolicy={handleUpdatePolicy}
            onDeletePolicy={handleDeletePolicy}
          />
        )}

        {activeTab === "commands" && (
          <CommandConsole
            devices={devices}
            onIssueCommand={handleIssueCommand}
          />
        )}

        {activeTab === "logs" && (
          <AuditLogViewer
            logs={auditLogs}
            pubsubMessages={pubsubMessages}
          />
        )}

        {activeTab === "test-suite" && <TestSuiteViewer />}

        {activeTab === "settings" && (
          <EnterpriseSettings
            enterprise={enterprise}
            onUpdateEnterprise={handleUpdateEnterprise}
          />
        )}
      </main>

      {/* Modals */}
      {selectedDevice && (
        <DeviceDetailModal
          device={selectedDevice}
          policies={policies}
          onClose={() => setSelectedDevice(null)}
          onIssueCommand={handleIssueCommand}
          onUpdateDevice={handleUpdateDevice}
          onDeleteDevice={handleDeleteDevice}
        />
      )}

      {simulatorToken && (
        <DeviceEnrollmentSimulatorModal
          token={simulatorToken}
          onClose={() => setSimulatorToken(null)}
          onSuccess={async () => {
            await fetchData();
          }}
        />
      )}

      {isRegisterModalOpen && (
        <DeviceRegistrationModal
          policies={policies}
          onClose={() => setIsRegisterModalOpen(false)}
          onRegister={handleRegisterDevice}
        />
      )}
    </div>
  );
}
