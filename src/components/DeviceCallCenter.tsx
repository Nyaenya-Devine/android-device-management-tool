'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Mic, Volume2, Pause, Users, BarChart3 } from 'lucide-react';

interface CallMessage {
  id: string;
  speaker: 'client' | 'you' | 'system' | 'expert';
  text: string;
  time: string;
  action?: { description: string; output?: string };
  score?: number;
}

interface Call {
  id: string;
  status: 'incoming' | 'active' | 'ended';
  duration: number;
  transcript: CallMessage[];
  clientType: 'enterprise' | 'field' | 'kiosk';
  deviceId: string;
  phase: 'waiting_greeting' | 'waiting_intro' | 'problem_stated' | 'troubleshooting' | 'resolution';
}

const greetingResponses = {
  enterprise: [
    "Hello? Is this MDM support? My work phone is locked, can't access email.",
    "Hi, is this device management? My company phone shows compliance error.",
  ],
  field: [
    "Hey, my rugged device is stuck in kiosk mode, can't scan barcodes, need help ASAP!",
    "Hello? Field device not syncing, delivery app not working, I'm on route!",
  ],
  kiosk: [
    "Good morning, kiosk device in lobby shows 'Device not compliant', customers waiting.",
    "Hi, dedicated device in warehouse is in lost mode, how to unlock?",
  ],
};

const introResponses = {
  enterprise: (device: string) => `Hi thank you, this is Alex from Sales at NovaTech, device ${device} — Pixel 7, Fully Managed. It's showing DeviceNotCompliant, error 53000, blocking Outlook and Teams. I have client meeting in 20 mins, P1. Could you help?`,
  field: (device: string) => `Yeah so it's Jamal from Logistics, device ${device} — Zebra TC26 rugged, Dedicated mode. It's stuck, scanner not working, says policy violation. I'm on delivery route, 12 packages pending! Need simple steps?`,
  kiosk: (device: string) => `Good morning, this is Priya from Facilities at Apex, device ${device} — Samsung Knox kiosk in lobby. Per policy SEC-2024-07, device shows Non-Compliant, blocking customer check-in. Need audit trail and fix.`,
};

const troubleshootingReplies = {
  enterprise: [
    "I checked Company Portal, last sync 2 mins ago, Compliance NO, Battery 45%. Should I check Settings → Accounts?",
    "Ran dsregcmd status — AzureAdJoined YES Compliance NO. What next? Correlation ID {id}",
    "Checked policy — Require compliant device ON, BitLocker not applicable for Android but SafetyNet failing. What is ETA?",
  ],
  field: [
    "Where do I find QR code? Is it in email? Says enrollment token expired — what does that mean?",
    "I tried reboot, still stuck in kiosk mode, can't exit. Will I lose my delivery data if I wipe?",
    "Oh, SafetyNet? Is it safe? Will it delete my delivery app?",
  ],
  kiosk: [
    "Executed policy check per instruction. Compliance NO, SafetyNet FAIL, per SEC-2024-07 need remediation plus audit trail.",
    "Checked Play Integrity — BASIC fail, DEVICE fail, need approved procedure and confirm key attestation.",
    "Per policy SEC-2024-07, need audit trail for compliance review, please advise remediation.",
  ],
};

export default function DeviceCallCenter({ devices, onDeviceAction }: { devices: any[], onDeviceAction?: (deviceId: string, action: string) => void }) {
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [incomingCall, setIncomingCall] = useState<any | null>(null);
  const [input, setInput] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const transcriptRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.onresult = (event: any) => {
          let interim = '';
          let final = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) final += transcript + ' ';
            else interim += transcript;
          }
          if (final) {
            setInput(prev => prev + final);
            setLiveTranscript('');
          } else setLiveTranscript(interim);
        };
        recognitionRef.current = recognition;
      }
    }
  }, []);

  const speakText = (text: string) => {
    if (!synthRef.current || isMuted) return;
    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 0.9;
    synthRef.current.speak(utterance);
  };

  useEffect(() => {
    if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [activeCall?.transcript, liveTranscript]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (devices.length > 0 && !activeCall && !incomingCall && Math.random() < 0.1) {
        const device = devices[Math.floor(Math.random() * devices.length)];
        const types: Array<'enterprise' | 'field' | 'kiosk'> = ['enterprise', 'field', 'kiosk'];
        const clientType = types[Math.floor(Math.random() * types.length)];
        setIncomingCall({ device, clientType });
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [devices, activeCall, incomingCall]);

  useEffect(() => {
    if (!activeCall || activeCall.status !== 'active') return;
    const timer = setInterval(() => setActiveCall(prev => prev ? { ...prev, duration: prev.duration + 1 } : null), 1000);
    return () => clearInterval(timer);
  }, [activeCall]);

  const acceptCall = () => {
    if (!incomingCall) return;
    const type = incomingCall.clientType as 'enterprise' | 'field' | 'kiosk';
    const greeting = greetingResponses[type][Math.floor(Math.random() * greetingResponses[type].length)];
    const newCall: Call = {
      id: incomingCall.device.id,
      status: 'active',
      duration: 0,
      transcript: [
        { id: '1', speaker: 'system', text: `📞 Call connected • ${incomingCall.device.model} • ${incomingCall.device.serialNumber} • ${incomingCall.clientType} • 🔴 Recording`, time: '00:00' },
        { id: '2', speaker: 'client', text: greeting, time: '00:03' },
      ],
      clientType: incomingCall.clientType,
      deviceId: incomingCall.device.id,
      phase: 'waiting_greeting',
    };
    setActiveCall(newCall);
    setIncomingCall(null);
    setTimeout(() => speakText(greeting), 600);
  };

  const declineCall = () => setIncomingCall(null);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Use Chrome/Edge for mic 🎙️');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setLiveTranscript('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const sendMessage = () => {
    if (!input.trim() || !activeCall) return;
    const now = `${String(Math.floor(activeCall.duration / 60)).padStart(2,'0')}:${String(activeCall.duration % 60).padStart(2,'0')}`;
    const userMsg: CallMessage = { id: Date.now().toString(), speaker: 'you', text: input, time: now };
    const prevPhase = activeCall.phase;
    let nextPhase: Call['phase'] = prevPhase;
    if (prevPhase === 'waiting_greeting') nextPhase = 'waiting_intro';
    else if (prevPhase === 'waiting_intro') nextPhase = 'problem_stated';
    else if (prevPhase === 'problem_stated') nextPhase = 'troubleshooting';

    setActiveCall(prev => prev ? { ...prev, transcript: [...prev.transcript, userMsg], phase: nextPhase } : null);
    const userInput = input;
    setInput('');
    setLiveTranscript('');

    setTimeout(() => {
      let replyText = '';
      let action = undefined;
      const deviceId = activeCall.deviceId;

      if (prevPhase === 'waiting_greeting') {
        replyText = introResponses[activeCall.clientType](deviceId.substring(0,8));
        setActiveCall(prev => prev ? { ...prev, phase: 'waiting_intro' } : null);
      } else if (prevPhase === 'waiting_intro') {
        if (activeCall.clientType === 'enterprise') replyText = `Yes, so device shows Non-Compliant blocking Outlook. Checked Company Portal last sync 2 mins ago Compliance NO. Could you check policy? P1 meeting in 20 mins.`;
        else if (activeCall.clientType === 'field') replyText = `Yeah so rugged device stuck in kiosk mode can't scan barcodes. Says policy violation. I'm on delivery route 12 packages pending! Need simple steps?`;
        else replyText = `Thank you. Per SEC-2024-07 device Non-Compliant blocking check-in. Checked Play Integrity BASIC fail DEVICE fail. Need audit trail and fix.`;
        setActiveCall(prev => prev ? { ...prev, phase: 'problem_stated' } : null);
      } else {
        const replies = troubleshootingReplies[activeCall.clientType];
        replyText = replies[Math.floor(Math.random() * replies.length)].replace('{id}', Math.random().toString(36).substring(7));
        const lower = userInput.toLowerCase();
        if (lower.includes('wipe') || lower.includes('lock') || lower.includes('reboot')) {
          action = { description: `Executed ${lower.includes('wipe') ? 'WIPE' : lower.includes('lock') ? 'LOCK' : 'REBOOT'} command`, output: `Command queued for ${deviceId.substring(0,8)} — state: PENDING` };
          if (onDeviceAction) onDeviceAction(deviceId, lower.includes('wipe') ? 'WIPE' : lower.includes('lock') ? 'LOCK' : 'REBOOT');
          replyText = `Okay I did ${lower.includes('wipe') ? 'wipe' : lower.includes('lock') ? 'lock' : 'reboot'} — device shows ${lower.includes('wipe') ? 'WIPE_PENDING' : 'command queued'}. What next?`;
        } else if (lower.includes('policy') || lower.includes('compliance')) {
          action = { description: 'Checked compliance policy', output: 'Compliance: SafetyNet FAIL, Play Integrity BASIC fail' };
          replyText = `Checked policy — Compliance NO, SafetyNet FAIL. Should I update policy?`;
        } else if (lower.includes('qr') || lower.includes('enrollment') || lower.includes('token')) {
          action = { description: 'Opened enrollment QR', output: 'QR token: enrollment token active, policy: Fully Managed' };
          replyText = `QR? Is it in email? Says enrollment token active but device not compliant?`;
        }
      }

      const clientMsg: CallMessage = {
        id: (Date.now()+1).toString(),
        speaker: 'client',
        text: replyText,
        time: `${String(Math.floor((activeCall.duration+2) / 60)).padStart(2,'0')}:${String((activeCall.duration+2) % 60).padStart(2,'0')}`,
        action,
      };
      setActiveCall(prev => prev ? { ...prev, transcript: [...prev.transcript, clientMsg] } : null);
      speakText(replyText);
    }, 1000);
  };

  const endCall = () => {
    if (!activeCall) return;
    const endMsg: CallMessage = { id: Date.now().toString(), speaker: 'system', text: `📞 Call ended • Duration ${Math.floor(activeCall.duration/60)}:${String(activeCall.duration%60).padStart(2,'0')} • Device ${activeCall.deviceId.substring(0,8)}`, time: '00:00' };
    setActiveCall(prev => prev ? { ...prev, status: 'ended', transcript: [...prev.transcript, endMsg] } : null);
    setTimeout(() => setActiveCall(null), 3000);
  };

  return (
    <>
      <AnimatePresence>
        {incomingCall && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[#0a0a0a] rounded-[28px] shadow-2xl max-w-sm w-full overflow-hidden border border-zinc-800">
              <div className="bg-gradient-to-br from-[#3DDC84] via-emerald-600 to-[#2AA86B] p-8 text-white text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.15),transparent)]" />
                <div className="relative">
                  <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-24 h-24 bg-white/15 backdrop-blur rounded-full flex items-center justify-center mx-auto mb-5 ring-4 ring-white/10">
                    <span className="text-4xl">📱</span>
                  </motion.div>
                  <h3 className="font-bold text-[18px]">Incoming Device Call — Flowing</h3>
                  <p className="text-[14px] opacity-90 mt-1">{incomingCall.device.model} • {incomingCall.clientType}</p>
                  <p className="text-[12px] opacity-70 mt-1 font-mono">{incomingCall.device.serialNumber}</p>
                  <div className="mt-4 inline-flex items-center gap-2 bg-white/15 backdrop-blur px-3 py-1.5 rounded-full text-[11px] font-medium border border-white/10">
                    <span className="h-2 w-2 bg-emerald-400 rounded-full animate-pulse" />
                    Real conversation — you greet first
                  </div>
                </div>
              </div>
              <div className="p-6 bg-[#0a0a0a]">
                <div className="bg-zinc-900 rounded-2xl p-4 text-[13px] mb-5 border border-zinc-800">
                  <p className="text-zinc-200 leading-[1.4]">Device {incomingCall.device.model} needs help — {incomingCall.clientType} user calling</p>
                  <div className="flex gap-1.5 mt-3">
                    <span className="text-[10px] px-2 py-1 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">{incomingCall.device.managementMode}</span>
                    <span className="text-[10px] px-2 py-1 rounded-full bg-[#3DDC84]/10 text-[#3DDC84] border border-[#3DDC84]/20">Flowing</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={declineCall} className="flex-1 h-12 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded-full font-medium text-[14px]">✕ Decline</button>
                  <button onClick={acceptCall} className="flex-1 h-12 bg-[#3DDC84] hover:bg-[#2AA86B] text-black rounded-full font-bold text-[14px] shadow-lg shadow-[#3DDC84]/20">✓ Accept — Say Hello First</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {activeCall && activeCall.status === 'active' && (
        <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[96%] max-w-5xl bg-[#0a0a0a] rounded-[24px] shadow-2xl border border-zinc-800 overflow-hidden flex flex-col max-h-[85vh]">
          <div className="h-14 px-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#3DDC84] to-emerald-600 flex items-center justify-center text-black font-bold">📱</div>
              <div>
                <p className="text-[13px] font-semibold text-zinc-100 flex items-center gap-2">
                  {activeCall.deviceId.substring(0,8)} • {activeCall.clientType}
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[11px] text-emerald-400">{String(Math.floor(activeCall.duration/60)).padStart(2,'0')}:{String(activeCall.duration%60).padStart(2,'0')}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">{activeCall.phase}</span>
                </p>
                <p className="text-[11px] text-zinc-500">Device call • {activeCall.clientType} • Flowing • 🔴 REC</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setIsMuted(!isMuted)} className={`h-9 w-9 rounded-full flex items-center justify-center border ${isMuted ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-zinc-800 text-zinc-300 border-zinc-700'}`}><Volume2 className="h-4 w-4" /></button>
              <button onClick={endCall} className="h-9 w-9 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center"><Phone className="h-4 w-4" /></button>
            </div>
          </div>

          <div ref={transcriptRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#050507]">
            {activeCall.transcript.map(m => (
              <div key={m.id} className={`flex ${m.speaker === 'you' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-[13px] leading-[1.4] border ${m.speaker === 'you' ? 'bg-[#3DDC84] border-[#2AA86B] text-black rounded-br-sm' : m.speaker === 'client' ? 'bg-zinc-800 border-zinc-700 text-zinc-100 rounded-bl-sm' : 'bg-zinc-900 border-zinc-800 text-zinc-500 text-[11px]'}`}>
                  <p className="text-[10px] opacity-70 mb-1">{m.speaker === 'you' ? 'You' : m.speaker === 'client' ? 'Client' : 'System'} • {m.time}</p>
                  <p>{m.text}</p>
                  {m.action && (
                    <div className="mt-2 p-2.5 rounded-xl bg-black/40 border border-white/10">
                      <p className="text-[11px] font-medium">⚡ Client action: {m.action.description}</p>
                      {m.action.output && <p className="text-[11px] font-mono text-emerald-300 mt-1">{m.action.output}</p>}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {liveTranscript && (
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-br-sm px-4 py-3 text-[13px] border bg-[#3DDC84]/50 border-[#3DDC84]/50 text-black border-dashed">
                  <p className="text-[10px] mb-1">🎙️ Live...</p>
                  <p className="italic">{liveTranscript}</p>
                </div>
              </div>
            )}
          </div>

          <div className="p-3 bg-zinc-900 border-t border-zinc-800">
            <div className="flex gap-2">
              <button onClick={toggleListening} className={`h-10 w-10 rounded-full flex items-center justify-center border ${isListening ? 'bg-red-500 text-white border-red-500 animate-pulse' : 'bg-zinc-800 text-zinc-300 border-zinc-700'}`}><Mic className="h-4 w-4" /></button>
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder={activeCall.phase === 'waiting_greeting' ? "Say hello first: Hello, how may I help you today?" : activeCall.phase === 'waiting_intro' ? "Acknowledge and ask for problem details..." : "Help with device — wipe, lock, reboot, policy, QR..."} className="flex-1 h-10 px-4 rounded-full bg-zinc-800 border border-zinc-700 text-[13px] text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#3DDC84]/50" />
              <button onClick={sendMessage} disabled={!input.trim()} className="h-10 px-5 rounded-full bg-[#3DDC84] hover:bg-[#2AA86B] disabled:bg-zinc-800 disabled:text-zinc-600 text-black text-[13px] font-semibold">Send</button>
            </div>
            <div className="flex gap-1.5 mt-2 overflow-x-auto">
              {(activeCall.phase === 'waiting_greeting' ? ["Hello, thank you for calling device support, how may I help you today?", "Hi, this is MDM support, how can I assist?"] : activeCall.phase === 'waiting_intro' ? ["Thank you, I can help with that device. What error are you seeing?", "I understand, let me help. Could you tell me more?"] : ["I understand, can you check Company Portal and tell me compliance status?", "Sorry about that! Can you try reboot? Will you lose data?", "Thanks! Can you confirm if you see QR enrollment token?"]).map(q => (
                <button key={q} onClick={() => setInput(q)} className="h-6 px-2.5 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-[11px] text-zinc-400 whitespace-nowrap">{q.substring(0, 35)}...</button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </>
  );
}
