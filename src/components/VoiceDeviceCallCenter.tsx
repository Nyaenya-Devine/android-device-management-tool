'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CallMessage {
  id: string;
  speaker: 'client' | 'you' | 'system';
  text: string;
  time: string;
  isVoice: boolean;
}

interface Call {
  id: string;
  status: 'incoming' | 'active' | 'ended';
  duration: number;
  transcript: CallMessage[];
  clientType: 'enterprise' | 'field' | 'kiosk';
  deviceId: string;
  phase: 'waiting_greeting' | 'waiting_intro' | 'problem' | 'troubleshooting' | 'resolution';
}

const greetings = {
  enterprise: ["Hello? Is this MDM support? My work phone is locked.", "Hi, is this device management? Compliance error."],
  field: ["Hey, my rugged device is stuck in kiosk mode, can't scan!", "Hello? Field device not syncing, delivery app not working!"],
  kiosk: ["Good morning, kiosk device in lobby shows 'Device not compliant'.", "Hi, dedicated device in warehouse is in lost mode."],
};

const intros = {
  enterprise: (device: string) => `Hi thank you, this is Alex from Sales at NovaTech, device ${device} — Pixel 7, Fully Managed. It's showing DeviceNotCompliant, error 53000, blocking Outlook and Teams. P1 meeting in 20 mins.`,
  field: (device: string) => `Yeah so it's Jamal from Logistics, device ${device} — Zebra TC26 rugged, Dedicated mode. It's stuck, scanner not working, says policy violation. 12 packages pending!`,
  kiosk: (device: string) => `Good morning, this is Priya from Facilities at Apex, device ${device} — Samsung Knox kiosk in lobby. Per policy SEC-2024-07, device Non-Compliant, blocking check-in. Need audit trail.`,
};

export default function VoiceDeviceCallCenter({ devices, onDeviceAction }: { devices: any[], onDeviceAction?: (deviceId: string, action: string) => void }) {
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [incoming, setIncoming] = useState<any | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [userLevel, setUserLevel] = useState(0);
  const [clientLevel, setClientLevel] = useState(0);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SR) {
        const rec = new SR();
        rec.continuous = false;
        rec.interimResults = true;
        rec.lang = 'en-US';
        rec.onstart = () => setIsListening(true);
        rec.onend = () => setIsListening(false);
        rec.onresult = (event: any) => {
          let interim = '', final = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const t = event.results[i][0].transcript;
            if (event.results[i].isFinal) final += t + ' ';
            else interim += t;
          }
          if (final) { handleUserVoice(final.trim()); setLiveTranscript(''); }
          else setLiveTranscript(interim);
        };
        recognitionRef.current = rec;
      }
    }
  }, []);

  useEffect(() => { if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight; }, [activeCall?.transcript, liveTranscript]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (devices.length > 0 && !activeCall && !incoming && Math.random() < 0.1) {
        const device = devices[Math.floor(Math.random() * devices.length)];
        const types: Array<'enterprise' | 'field' | 'kiosk'> = ['enterprise', 'field', 'kiosk'];
        const clientType = types[Math.floor(Math.random() * types.length)];
        setIncoming({ device, clientType });
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [devices, activeCall, incoming]);

  useEffect(() => {
    if (!activeCall || activeCall.status !== 'active') return;
    const timer = setInterval(() => setActiveCall(prev => prev ? { ...prev, duration: prev.duration + 1 } : null), 1000);
    return () => clearInterval(timer);
  }, [activeCall]);

  const speakClient = (text: string) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.0; utter.pitch = 1.0; utter.volume = 0.95;
    utter.onstart = () => { setIsSpeaking(true); const iv = setInterval(() => { if (!isSpeaking) clearInterval(iv); setClientLevel(Math.random()*100); }, 100); };
    utter.onend = () => { setIsSpeaking(false); setClientLevel(0); };
    synthRef.current.speak(utter);
  };

  const startMic = async () => {
    if (!recognitionRef.current) { alert('Use Chrome/Edge for mic 🎙️ — voice-to-voice, no texting'); return; }
    try { await navigator.mediaDevices.getUserMedia({ audio: true }); } catch {}
    setLiveTranscript('');
    recognitionRef.current.start();
    const iv = setInterval(() => { if (!isListening) clearInterval(iv); setUserLevel(Math.random()*100); }, 100);
  };

  const stopMic = () => { if (recognitionRef.current && isListening) recognitionRef.current.stop(); setUserLevel(0); };

  const handleUserVoice = (text: string) => {
    if (!text.trim() || !activeCall) return;
    const now = `${String(Math.floor(activeCall.duration/60)).padStart(2,'0')}:${String(activeCall.duration%60).padStart(2,'0')}`;
    const prevPhase = activeCall.phase;
    let nextPhase: Call['phase'] = prevPhase;
    if (prevPhase === 'waiting_greeting') nextPhase = 'waiting_intro';
    else if (prevPhase === 'waiting_intro') nextPhase = 'problem';
    else if (prevPhase === 'problem') nextPhase = 'troubleshooting';

    const userMsg: CallMessage = { id: Date.now().toString(), speaker: 'you', text, time: now, isVoice: true };
    setActiveCall(prev => prev ? { ...prev, transcript: [...prev.transcript, userMsg], phase: nextPhase } : null);

    setTimeout(() => {
      let reply = '';
      const type = activeCall.clientType;
      if (prevPhase === 'waiting_greeting') { reply = intros[type](activeCall.deviceId.substring(0,8)); setActiveCall(prev => prev ? { ...prev, phase: 'waiting_intro' } : null); }
      else if (prevPhase === 'waiting_intro') {
        if (type === 'enterprise') reply = `Yes, device shows Non-Compliant blocking Outlook. Checked Company Portal last sync 2 mins ago Compliance NO. Could you check policy? P1 meeting 20 mins.`;
        else if (type === 'field') reply = `Yeah so rugged device stuck in kiosk mode can't scan barcodes. Says policy violation. I'm on delivery route 12 packages pending! Need simple steps?`;
        else reply = `Thank you. Per SEC-2024-07 device Non-Compliant blocking check-in. Checked Play Integrity BASIC fail DEVICE fail. Need audit trail and fix.`;
        setActiveCall(prev => prev ? { ...prev, phase: 'problem' } : null);
      } else {
        const lower = text.toLowerCase();
        if (lower.includes('wipe') || lower.includes('lock') || lower.includes('reboot')) {
          const cmd = lower.includes('wipe') ? 'WIPE' : lower.includes('lock') ? 'LOCK' : 'REBOOT';
          if (onDeviceAction) onDeviceAction(activeCall.deviceId, cmd);
          reply = `Okay I did ${cmd} — device shows ${cmd}_PENDING. What next?`;
        } else if (lower.includes('policy') || lower.includes('compliance')) reply = `Checked policy — Compliance NO, SafetyNet FAIL. Should I update policy?`;
        else reply = `I checked Company Portal, last sync 2 mins ago, Compliance NO, Battery 45%. Should I check Settings → Accounts?`;
      }
      const clientMsg: CallMessage = { id: (Date.now()+1).toString(), speaker: 'client', text: reply, time: `${String(Math.floor((activeCall.duration+2)/60)).padStart(2,'0')}:${String((activeCall.duration+2)%60).padStart(2,'0')}`, isVoice: true };
      setActiveCall(prev => prev ? { ...prev, transcript: [...prev.transcript, clientMsg] } : null);
      speakClient(reply);
    }, 800);
  };

  const acceptCall = () => {
    if (!incoming) return;
    const type = incoming.clientType as 'enterprise' | 'field' | 'kiosk';
    const greeting = greetings[type][Math.floor(Math.random() * greetings[type].length)];
    const newCall: Call = {
      id: incoming.device.id,
      status: 'active',
      duration: 0,
      transcript: [
        { id: '1', speaker: 'system', text: `📞 Voice Call Connected • ${incoming.device.model} • ${incoming.clientType} • 🔴 Recording • Mouth-to-Ear Voice, No Text`, time: '00:00', isVoice: false },
        { id: '2', speaker: 'client', text: greeting, time: '00:03', isVoice: true },
      ],
      clientType: type,
      deviceId: incoming.device.id,
      phase: 'waiting_greeting',
    };
    setActiveCall(newCall);
    setIncoming(null);
    setTimeout(() => speakClient(greeting), 600);
  };

  const declineCall = () => setIncoming(null);
  const endCall = () => { if (synthRef.current) synthRef.current.cancel(); setActiveCall(null); };

  return (
    <>
      <AnimatePresence>
        {incoming && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[#0a0a0a] rounded-[28px] shadow-2xl max-w-sm w-full overflow-hidden border border-zinc-800">
              <div className="bg-gradient-to-br from-[#3DDC84] via-emerald-600 to-[#2AA86B] p-8 text-white text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.15),transparent)]" />
                <div className="relative">
                  <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-24 h-24 bg-white/15 backdrop-blur rounded-full flex items-center justify-center mx-auto mb-5 ring-4 ring-white/10">
                    <span className="text-4xl">📱</span>
                  </motion.div>
                  <h3 className="font-bold text-[18px]">Incoming Voice Call — Mouth-to-Ear</h3>
                  <p className="text-[14px] opacity-90 mt-1">{incoming.device.model} • {incoming.clientType}</p>
                  <div className="mt-4 inline-flex items-center gap-2 bg-white/15 backdrop-blur px-3 py-1.5 rounded-full text-[11px] font-medium border border-white/10">
                    <span className="h-2 w-2 bg-emerald-400 rounded-full animate-pulse" />
                    Voice-to-Voice • No Texting • You Speak, Caller Hears
                  </div>
                </div>
              </div>
              <div className="p-6 bg-[#0a0a0a]">
                <div className="bg-zinc-900 rounded-2xl p-4 text-[13px] mb-5 border border-zinc-800">
                  <p className="text-zinc-200 leading-[1.4]">Device {incoming.device.model} needs help — {incoming.clientType} user calling</p>
                  <p className="text-[11px] text-zinc-500 mt-3">🔊 Real phone: You pick → You say hello with mouth → Caller hears voice → Caller replies voice → You hear via ear → No texting back after talk</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={declineCall} className="flex-1 h-12 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded-full font-medium text-[14px]">✕ Decline</button>
                  <button onClick={acceptCall} className="flex-1 h-12 bg-[#3DDC84] hover:bg-[#2AA86B] text-black rounded-full font-bold text-[14px] shadow-lg shadow-[#3DDC84]/20">✓ Accept — Speak Now</button>
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
                  {activeCall.deviceId.substring(0,8)} • {activeCall.clientType} • Voice Call
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[11px] text-emerald-400">{String(Math.floor(activeCall.duration/60)).padStart(2,'0')}:{String(activeCall.duration%60).padStart(2,'0')}</span>
                  {isListening && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 animate-pulse">🎙️ You Speaking — Caller Hears You</span>}
                  {isSpeaking && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#3DDC84]/20 text-[#3DDC84] border border-[#3DDC84]/30 animate-pulse">🔊 Client Speaking — You Hear</span>}
                </p>
                <p className="text-[11px] text-zinc-500">Mouth-to-Ear • No Texting • {activeCall.phase} • 🔴 REC</p>
              </div>
            </div>
            <button onClick={endCall} className="h-9 w-9 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center">📞</button>
          </div>

          <div ref={transcriptRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#050507]">
            {activeCall.transcript.map(m => (
              <div key={m.id} className={`flex ${m.speaker === 'you' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-[13px] leading-[1.4] border ${m.speaker === 'you' ? 'bg-[#3DDC84] border-[#2AA86B] text-black rounded-br-sm' : m.speaker === 'client' ? 'bg-zinc-800 border-zinc-700 text-zinc-100 rounded-bl-sm' : 'bg-zinc-900 border-zinc-800 text-zinc-500 text-[11px]'}`}>
                  <p className="text-[10px] opacity-70 mb-1">{m.speaker === 'you' ? '🎙️ You (Voice — Caller Heard)' : '🔊 Client (Voice — You Heard)'} • {m.time}</p>
                  <p>{m.text}</p>
                </div>
              </div>
            ))}
            {liveTranscript && (
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-br-sm px-4 py-3 text-[13px] border bg-[#3DDC84]/50 border-[#3DDC84]/50 text-black border-dashed">
                  <p className="text-[10px] mb-1">🎙️ You Speaking Live — Caller Hears You Now...</p>
                  <p className="italic">{liveTranscript}</p>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-zinc-900 border-t border-zinc-800">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center gap-1">
                  <div className="h-16 w-16 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center relative overflow-hidden">
                    <span className="text-2xl">🎙️</span>
                    {isListening && <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 0.8 }} className="absolute inset-0 rounded-full border-2 border-red-500/50" />}
                  </div>
                  <span className="text-[10px] text-zinc-500">You</span>
                  <div className="h-1 w-12 bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-red-500 transition-all" style={{ width: `${userLevel}%` }} /></div>
                </div>
                <div className="flex flex-col items-center gap-2"><div className="h-px w-12 bg-zinc-700" /><span className="text-[10px] text-zinc-600 font-mono">Voice • Mouth-to-Ear • No Text</span><div className="h-px w-12 bg-zinc-700" /></div>
                <div className="flex flex-col items-center gap-1">
                  <div className="h-16 w-16 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center relative overflow-hidden">
                    <span className="text-2xl">🔊</span>
                    {isSpeaking && <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 0.8 }} className="absolute inset-0 rounded-full border-2 border-[#3DDC84]/50" />}
                  </div>
                  <span className="text-[10px] text-zinc-500">Client</span>
                  <div className="h-1 w-12 bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-[#3DDC84] transition-all" style={{ width: `${clientLevel}%` }} /></div>
                </div>
              </div>
              <button onMouseDown={startMic} onMouseUp={stopMic} onTouchStart={startMic} onTouchEnd={stopMic} className={`h-14 w-72 rounded-full font-bold text-[14px] flex items-center justify-center gap-2 transition-all shadow-lg ${isListening ? 'bg-red-600 text-white shadow-red-600/20 scale-105' : 'bg-[#3DDC84] text-black shadow-[#3DDC84]/20'}`}>
                {isListening ? '● Recording — Caller Hears You — Release to Send' : '🎙️ Hold to Speak — Voice Only, No Texting'}
              </button>
              <p className="text-[11px] text-zinc-500 text-center max-w-[420px] leading-[1.3]">
                {activeCall.phase === 'waiting_greeting' ? 'Client said hello — hold mic and say: Hello, how may I help you today? with your mouth, caller hears your voice' :
                 'Hold mic to speak — your mouth → caller ear, caller mouth → your ear, no texting back after talk, like real phone call from one person to another — even baby understands'}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </>
  );
}
