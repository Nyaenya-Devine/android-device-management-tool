"use client";

import React, { useState } from "react";
import {
  Activity,
  Shield,
  Search,
  CheckCircle2,
  AlertTriangle,
  Radio,
  FileText,
  Copy,
  Check,
  Clock,
} from "lucide-react";

interface AuditLogViewerProps {
  logs: any[];
  pubsubMessages: any[];
}

export function AuditLogViewer({ logs, pubsubMessages }: AuditLogViewerProps) {
  const [activeTab, setActiveTab] = useState<"all" | "audit" | "pubsub">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [inspectedPayload, setInspectedPayload] = useState<any | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const combinedEvents = [
    ...logs.map((l) => ({
      ...l,
      eventType: "AUDIT",
      timestamp: l.createdAt,
    })),
    ...pubsubMessages.map((p) => ({
      id: p.id,
      enterpriseId: p.enterpriseId,
      actor: "Google Cloud Pub/Sub",
      action: `PUBSUB_${p.notificationType}`,
      resourceType: "PUBSUB_MESSAGE",
      resourceId: p.messageId,
      details: p.rawPayload,
      status: "SUCCESS",
      eventType: "PUBSUB",
      timestamp: p.publishTime,
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const filteredEvents = combinedEvents.filter((item) => {
    if (activeTab === "audit" && item.eventType !== "AUDIT") return false;
    if (activeTab === "pubsub" && item.eventType !== "PUBSUB") return false;

    if (searchTerm.trim().length > 0) {
      const term = searchTerm.toLowerCase();
      const match =
        item.action.toLowerCase().includes(term) ||
        item.actor.toLowerCase().includes(term) ||
        (item.resourceId && item.resourceId.toLowerCase().includes(term)) ||
        (item.resourceType && item.resourceType.toLowerCase().includes(term));
      if (!match) return false;
    }

    return true;
  });

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
            Audit Trail & Google Cloud Pub/Sub Feed
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Immutable security log of administrative actions, AMAPI provisioning events, and incoming Pub/Sub telemetry notifications.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center space-x-1 rounded-xl bg-slate-900 p-1 border border-slate-800 text-xs">
          {[
            { id: "all", label: `All Events (${combinedEvents.length})` },
            { id: "audit", label: `Admin Audit (${logs.length})` },
            { id: "pubsub", label: `Pub/Sub Push (${pubsubMessages.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter logs by action, actor, or ID..."
          className="w-full rounded-xl border border-slate-700 bg-slate-900/80 py-2 pl-9 pr-3 text-xs sm:text-sm text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
        />
      </div>

      {/* Events Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                <th className="py-3 px-4 font-semibold">Timestamp</th>
                <th className="py-3 px-4 font-semibold">Source / Actor</th>
                <th className="py-3 px-4 font-semibold">Action / Event</th>
                <th className="py-3 px-4 font-semibold">Resource</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredEvents.map((ev) => {
                const isPubSub = ev.eventType === "PUBSUB";
                return (
                  <tr key={ev.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                      {new Date(ev.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-semibold text-slate-200">{ev.actor}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold border ${
                        isPubSub
                          ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/20"
                          : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      }`}>
                        {ev.action.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400 truncate max-w-[160px]">
                      {ev.resourceId || ev.resourceType || "—"}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center text-emerald-400 font-medium">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        {ev.status || "OK"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {ev.details && (
                        <button
                          onClick={() => setInspectedPayload(ev.details)}
                          className="rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                        >
                          Inspect JSON
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON Payload Inspector Modal */}
      {inspectedPayload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <FileText className="h-4 w-4 text-emerald-400" />
                <span>Event Payload Inspector</span>
              </h3>
              <button
                onClick={() => setInspectedPayload(null)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>

            <pre className="max-h-96 overflow-y-auto rounded-xl bg-slate-950 p-4 font-mono text-[11px] text-emerald-300 border border-slate-800">
              {JSON.stringify(inspectedPayload, null, 2)}
            </pre>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => copyToClipboard(JSON.stringify(inspectedPayload, null, 2), "payload")}
                className="flex items-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white"
              >
                {copiedKey === "payload" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>Copy JSON</span>
              </button>
              <button
                onClick={() => setInspectedPayload(null)}
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
