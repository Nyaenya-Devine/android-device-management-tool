'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface Props {
  device: any;
  onCommand: (cmd: string) => void;
}

const androidScreens: Record<string, { bg: string; content: string }> = {
  compliant: {
    bg: 'bg-zinc-900',
    content: 'Company Portal ✓ Compliant • Outlook ✓ • Teams ✓ • SafetyNet PASS • Play Integrity BASIC+DEVICE',
  },
  noncompliant: {
    bg: 'bg-red-950/50',
    content: 'Company Portal ⚠ Non-Compliant • SafetyNet FAIL • Play Integrity FAIL • Outlook BLOCKED per SEC-2024-07',
  },
  kiosk: {
    bg: 'bg-[#0a0a0a]',
    content: 'Kiosk Mode • Customer Check-in App • Locked • Policy: Dedicated • Cannot exit',
  },
  lost: {
    bg: 'bg-black',
    content: 'DEVICE LOST • Contact IT • Call +1-555-0100 • Location tracking ON • LOCKED',
  },
};

export default function DeviceRemoteView({ device, onCommand }: Props) {
  const [screenMode, setScreenMode] = useState<'compliant' | 'noncompliant' | 'kiosk' | 'lost'>('compliant');
  const [logs, setLogs] = useState<string[]>([]);
  const [isLive, setIsLive] = useState(true);

  useEffect(() => {
    if (device?.state === 'ACTIVE') setScreenMode(device?.complianceState === 'COMPLIANT' ? 'compliant' : 'noncompliant');
    else if (device?.managementMode === 'DEDICATED_DEVICE') setScreenMode('kiosk');
    else if (device?.state === 'LOST') setScreenMode('lost');
    else setScreenMode('noncompliant');
  }, [device]);

  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      const entries = [
        `dumpsys device_policy • compliance=${screenMode}`,
        `SafetyNet attestation • ${screenMode === 'compliant' ? 'PASS' : 'FAIL'}`,
        `Play Integrity • ${screenMode === 'compliant' ? 'MEETS_DEVICE_INTEGRITY' : 'MEETS_BASIC_ONLY'}`,
        `Company Portal sync • last ${Math.floor(Math.random()*5)+1}m ago`,
        `Battery ${device?.batteryLevel || 72}% • ${device?.networkInfo || 'WIFI'}`,
      ];
      setLogs(prev => [entries[Math.floor(Math.random()*entries.length)], ...prev].slice(0, 6));
    }, 2000);
    return () => clearInterval(interval);
  }, [isLive, screenMode, device]);

  const screen = androidScreens[screenMode];

  return (
    <div className="rounded-[16px] border border-white/[0.06] bg-[#101012]/80 backdrop-blur-[20px] overflow-hidden">
      <div className="h-11 px-4 bg-[#15151A]/50 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#3DDC84] to-emerald-600 flex items-center justify-center text-black font-bold text-[12px]">📱</div>
          <div>
            <p className="text-[12px] font-semibold text-[#F5F3EF]">Live Device View — {device?.model || 'Pixel 7'}</p>
            <p className="text-[10px] text-white/40 font-mono">{device?.serialNumber?.substring(0,12) || 'SN-XXXX'} • {device?.managementMode || 'FULLY_MANAGED'} • {isLive ? '🔴 LIVE' : '⏸️ Paused'}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setIsLive(!isLive)} className={`h-6 px-2.5 rounded-full text-[10px] font-medium border ${isLive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-white/[0.04] text-white/40 border-white/[0.08]'}`}>{isLive ? '● LIVE' : '○ Paused'}</button>
          <div className="h-6 w-6 rounded-full bg-zinc-800 flex items-center justify-center"><span className="text-[10px]">⚡</span></div>
        </div>
      </div>

      <div className="p-3 grid grid-cols-[200px_1fr] gap-3">
        {/* Phone mockup */}
        <div className="relative mx-auto w-[180px]">
          <div className="relative rounded-[28px] border-[6px] border-zinc-800 bg-black overflow-hidden shadow-2xl aspect-[9/19.5]">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-zinc-800 rounded-b-[10px] z-10" />
            <div className={`absolute inset-0 ${screen.bg} flex flex-col p-2 pt-8`}>
              <div className="h-4 flex items-center justify-between text-[8px] text-white/60 font-mono px-1">
                <span>9:41</span><span>📶 🔋 {device?.batteryLevel || 72}%</span>
              </div>
              <div className="flex-1 mt-2 p-2 rounded-[12px] bg-white/[0.04] border border-white/[0.06]">
                <p className="text-[9px] text-white/80 leading-[1.4] font-mono">{screen.content}</p>
                <div className="mt-2 space-y-1">
                  {['Outlook', 'Teams', 'Company Portal', 'Chrome'].map(app => (
                    <div key={app} className="h-7 rounded-[8px] bg-white/[0.06] border border-white/[0.06] flex items-center px-2 gap-2">
                      <div className="h-4 w-4 rounded-[4px] bg-[#3DDC84]/20" /><span className="text-[8px] text-white/70">{app}</span>
                      <span className={`ml-auto text-[7px] px-1 py-0.5 rounded-full ${screenMode === 'compliant' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{screenMode === 'compliant' ? '✓' : '✕'}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="h-8 mt-2 flex justify-center items-center"><div className="h-1 w-12 rounded-full bg-white/20" /></div>
            </div>
          </div>
          <div className="mt-2 flex justify-center gap-1">
            {(['compliant','noncompliant','kiosk','lost'] as const).map(m => (
              <button key={m} onClick={() => setScreenMode(m)} className={`h-5 px-2 rounded-full text-[8px] font-medium border ${screenMode===m ? 'bg-[#3DDC84]/20 text-[#3DDC84] border-[#3DDC84]/30' : 'bg-white/[0.04] text-white/30 border-white/[0.06]'}`}>{m}</button>
            ))}
          </div>
        </div>

        {/* Telemetry + actions */}
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              { k: 'SafetyNet', v: screenMode === 'compliant' ? 'PASS' : 'FAIL', c: screenMode === 'compliant' ? 'text-emerald-400' : 'text-red-400' },
              { k: 'Play Integrity', v: screenMode === 'compliant' ? 'DEVICE' : 'BASIC', c: screenMode === 'compliant' ? 'text-emerald-400' : 'text-amber-400' },
              { k: 'Compliance', v: screenMode === 'compliant' ? 'COMPLIANT' : 'NON', c: screenMode === 'compliant' ? 'text-emerald-400' : 'text-red-400' },
            ].map(item => (
              <div key={item.k} className="rounded-[10px] bg-[#08080A] border border-white/[0.06] p-2.5">
                <p className="text-[9px] text-white/40 uppercase tracking-wide">{item.k}</p>
                <p className={`text-[11px] font-bold font-mono ${item.c}`}>{item.v}</p>
              </div>
            ))}
          </div>

          <div className="rounded-[10px] bg-[#08080A] border border-white/[0.06] p-2.5">
            <p className="text-[10px] text-white/40 uppercase tracking-wide mb-2 flex items-center gap-1.5">📡 Live dumpsys • {device?.model} <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /></p>
            <div className="space-y-1 font-mono text-[10px]">
              {logs.map((l,i) => <p key={i} className={`${i===0 ? 'text-emerald-300' : 'text-white/30'} truncate`}>{i===0 ? '▶ ' : '  '}{l}</p>)}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              { cmd: 'LOCK', label: '🔒 Lock', color: 'bg-amber-500/10 text-amber-300 border-amber-500/20' },
              { cmd: 'REBOOT', label: '🔄 Reboot', color: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20' },
              { cmd: 'WIPE', label: '💥 Wipe', color: 'bg-red-500/10 text-red-300 border-red-500/20' },
              { cmd: 'SYNC', label: '🔄 Sync', color: 'bg-[#3DDC84]/10 text-[#3DDC84] border-[#3DDC84]/20' },
            ].map(b => (
              <button key={b.cmd} onClick={() => onCommand(b.cmd)} className={`h-7 px-3 rounded-full text-[11px] font-medium border ${b.color} hover:scale-[1.02] transition-transform`}>{b.label}</button>
            ))}
          </div>

          <div className="rounded-[10px] bg-amber-500/5 border border-amber-500/10 p-2.5">
            <p className="text-[10px] text-amber-300 font-medium">💡 Real workplace: Each client different policies</p>
            <p className="text-[10px] text-white/50 leading-[1.4] mt-1">Device {device?.serialNumber?.substring(0,8)} has policy {device?.policyName || 'Fully Managed'} • SEC-2024-07 requires SafetyNet ON • You can execute actions that seem real — LOCK needs internet, WIPE is factory reset.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
