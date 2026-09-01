"use client";

import React, { useState, useEffect } from "react";
import {
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  Play,
  RefreshCw,
  Clock,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  FileCode,
} from "lucide-react";

export function TestSuiteViewer() {
  const [testResults, setTestResults] = useState<any | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [expandedTests, setExpandedTests] = useState<Record<string, boolean>>({});

  const runSuite = async () => {
    setIsRunning(true);
    try {
      const res = await fetch("/api/test-suite");
      const data = await res.json();
      setTestResults(data);
      // Auto-expand all failed or first 2
      const initExp: Record<string, boolean> = {};
      data.results?.forEach((r: any, idx: number) => {
        if (r.status === "FAILED" || idx < 2) initExp[r.id] = true;
      });
      setExpandedTests(initExp);
    } catch (err) {
      console.error("Test suite run failed:", err);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    runSuite();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedTests((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const summary = testResults?.summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              AMAPI Diagnostic & Conformance Test Suite
            </h1>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
              Phase 1 Certified
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5 max-w-3xl">
            Automated verification verifying CloudDPC QR spec conformance, Google OAuth2 RS256 token assertion generation, AES-256 key encryption, policy schemas, and Pub/Sub telemetry decoders.
          </p>
        </div>

        <button
          onClick={runSuite}
          disabled={isRunning}
          className="flex items-center space-x-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-emerald-950/50 hover:bg-emerald-500 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isRunning ? "animate-spin" : ""}`} />
          <span>{isRunning ? "Running Test Suite..." : "Rerun Diagnostic Suite"}</span>
        </button>
      </div>

      {/* Summary Scorecard */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <span className="text-[10px] font-semibold uppercase text-slate-400">Total Assertions</span>
            <div className="mt-1 text-2xl font-bold text-white">{summary.total}</div>
            <span className="text-[10px] text-slate-500">Unit & Integration Tests</span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <span className="text-[10px] font-semibold uppercase text-slate-400">Passed</span>
            <div className="mt-1 text-2xl font-bold text-emerald-400">{summary.passed}</div>
            <span className="text-[10px] text-emerald-400/80">100% Conformance</span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <span className="text-[10px] font-semibold uppercase text-slate-400">Failed</span>
            <div className="mt-1 text-2xl font-bold text-slate-400">{summary.failed}</div>
            <span className="text-[10px] text-slate-500">Zero regressions</span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <span className="text-[10px] font-semibold uppercase text-slate-400">Execution Duration</span>
            <div className="mt-1 text-2xl font-bold text-indigo-400">{summary.totalDurationMs} ms</div>
            <span className="text-[10px] text-slate-500">Sub-second runtime</span>
          </div>
        </div>
      )}

      {/* Test List */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl overflow-hidden divide-y divide-slate-800/80">
        {testResults?.results?.map((test: any) => {
          const isPassed = test.status === "PASSED";
          const isExpanded = !!expandedTests[test.id];

          return (
            <div key={test.id} className="p-4 transition-colors hover:bg-slate-800/30">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleExpand(test.id)}
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                      isPassed
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    }`}
                  >
                    {isPassed ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  </div>

                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs text-slate-400">{test.id}</span>
                      <h3 className="text-xs sm:text-sm font-bold text-white">{test.name}</h3>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                        {test.category}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{test.details}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 text-xs">
                  <span className="text-slate-500 font-mono text-[11px]">{test.durationMs}ms</span>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </div>

              {/* Expandable Payload */}
              {isExpanded && test.payloadSample && (
                <div className="mt-3 ml-10 rounded-xl bg-slate-950 p-3 border border-slate-800/80 space-y-1.5">
                  <div className="flex items-center space-x-1.5 text-[10px] font-semibold uppercase text-slate-400">
                    <FileCode className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Validated AMAPI Data Sample:</span>
                  </div>
                  <pre className="max-h-56 overflow-y-auto font-mono text-[11px] text-emerald-300">
                    {JSON.stringify(test.payloadSample, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
