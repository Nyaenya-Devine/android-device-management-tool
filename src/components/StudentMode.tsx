'use client';
import { useState } from 'react';

const lessons = [
  {
    id: 'enrollment',
    title: '1. CloudDPC QR Provisioning',
    desc: '6-dot tap → QR scan → DPC installs. Token expires 30d. Each device different policy.',
    check: 'Can you generate QR token and enroll device?',
    action: 'Go to Enrollment Hub → Generate Token → Scan in Simulator',
  },
  {
    id: 'compliance',
    title: '2. SafetyNet & Play Integrity',
    desc: 'Real compliance: SafetyNet FAIL blocks work apps per SEC-2024-07. Play Integrity BASIC vs DEVICE.',
    check: 'What fails compliance? Check live device view.',
    action: 'Select non-compliant device → see dumpsys • SafetyNet FAIL',
  },
  {
    id: 'commands',
    title: '3. Real Actions with Proof',
    desc: 'LOCK needs internet, WIPE factory resets, REBOOT keeps data. Visual proof in telemetry.',
    check: 'Issue LOCK command and watch live logs',
    action: 'Device List → Manage → Issue LOCK → Check Audit Logs',
  },
  {
    id: 'calls',
    title: '4. Device Support Calls',
    desc: 'Flowing: Client says hello → You greet first → Problem → Troubleshooting with actions → Resolution',
    check: 'Answer incoming call and help client',
    action: 'Wait for 📞 call → Accept → Say "Hello, how may I help?" first',
  },
];

export default function StudentMode({ onNavigate }: { onNavigate: (tab: any) => void }) {
  const [completed, setCompleted] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)} className="fixed bottom-4 left-4 z-30 h-10 px-4 rounded-full bg-[#101012]/90 backdrop-blur border border-white/[0.08] text-[12px] font-medium text-white/70 hover:text-white flex items-center gap-2 shadow-lg">
        🎓 Student Mode — Learn MDM
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-40 w-[340px] rounded-[16px] border border-white/[0.08] bg-[#0a0a0a]/95 backdrop-blur-[20px] shadow-2xl overflow-hidden">
      <div className="h-11 px-4 bg-[#15151A]/80 border-b border-white/[0.06] flex items-center justify-between">
        <p className="text-[12px] font-semibold text-[#F5F3EF]">🎓 Student Mode — Android MDM Lab</p>
        <button onClick={() => setIsOpen(false)} className="h-6 w-6 rounded-full bg-white/[0.06] flex items-center justify-center text-white/40 hover:text-white">✕</button>
      </div>
      <div className="p-3 space-y-2.5 max-h-[380px] overflow-y-auto">
        {lessons.map(lesson => {
          const isDone = completed.includes(lesson.id);
          return (
            <div key={lesson.id} className={`rounded-[12px] border p-3 ${isDone ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-[#08080A] border-white/[0.06]'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className={`text-[12px] font-medium ${isDone ? 'text-emerald-300' : 'text-[#F5F3EF]'}`}>{isDone ? '✅ ' : ''}{lesson.title}</p>
                  <p className="text-[11px] text-white/50 leading-[1.4] mt-1">{lesson.desc}</p>
                  <p className="text-[10px] text-white/30 mt-1.5 italic">Check: {lesson.check}</p>
                </div>
                <button onClick={() => setCompleted(prev => isDone ? prev.filter(id => id!==lesson.id) : [...prev, lesson.id])} className={`h-6 w-6 rounded-full border flex items-center justify-center shrink-0 ${isDone ? 'bg-emerald-500 text-black border-emerald-500' : 'bg-white/[0.04] border-white/[0.08] text-white/30'}`}>{isDone ? '✓' : '○'}</button>
              </div>
              <button onClick={() => onNavigate(lesson.id === 'enrollment' ? 'enrollment' : lesson.id === 'commands' ? 'commands' : 'dashboard')} className="mt-2 h-7 px-3 rounded-full bg-white/[0.06] border border-white/[0.08] text-[10px] text-white/60 hover:text-white">→ {lesson.action}</button>
            </div>
          );
        })}
        <div className="pt-2 border-t border-white/[0.06]">
          <p className="text-[10px] text-white/30 font-mono text-center">{completed.length}/{lessons.length} completed • Real workplace simulation</p>
          <div className="h-1.5 w-full rounded-full bg-white/[0.06] mt-2 overflow-hidden"><div className="h-full bg-[#3DDC84] rounded-full transition-all" style={{ width: `${(completed.length/lessons.length)*100}%` }} /></div>
        </div>
      </div>
    </div>
  );
}
