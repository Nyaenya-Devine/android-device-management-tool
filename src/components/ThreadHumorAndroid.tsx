'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Thread {
  id: string;
  category: 'MDM Horror' | 'QR Hell' | 'Wipe Fear' | 'Policy' | 'Field' | 'Trending';
  setup: string;
  punchline: string;
  tags: string[];
  upvotes: number;
  author: string;
  isTrending?: boolean;
}

const threads: Thread[] = [
  {
    id: '1',
    category: 'MDM Horror',
    setup: 'P1: "All 50 company phones locked, compliance failed, payroll blocked"',
    punchline: 'Root Cause: Pushed policy Require SafetyNet ON without testing on Zebra TC26 rugged devices. SafetyNet fails on rugged because no Google Play Services. It\'s always the one device you didn\'t test. 💀',
    tags: ['#SafetyNet', '#Rugged', '#P1', '#TestYourPolicies'],
    upvotes: 312,
    author: 'u/MDMNightmares',
    isTrending: true,
  },
  {
    id: '2',
    category: 'QR Hell',
    setup: 'User: "Where is my QR code? I scanned the fridge, is that it?"',
    punchline: 'Me: "No, the QR is in your email, enrollment token, 6-dot tap to start CloudDPC" User: "I tapped 7 dots, is that okay?" Me: *deep breath* "6 dots, not 7, and not the fridge"',
    tags: ['#QRCode', '#CloudDPC', '#6Dots', '#NotTheFridge'],
    upvotes: 198,
    author: 'u/QRPain',
  },
  {
    id: '3',
    category: 'Wipe Fear',
    setup: 'User: "Will WIPE delete my photos of my cat?"',
    punchline: 'Me: "If it\'s company-owned fully managed, yes, factory reset, cat photos gone. If BYOD work profile, only work profile deleted, cat photos safe. Your cat is safe... for now." User: "So I should backup cat photos?" Me: "YES. Always backup cat photos."',
    tags: ['#WIPE', '#CatPhotos', '#Backup', '#FullyManagedVsBYOD'],
    upvotes: 445,
    author: 'u/CatPhotoGuardian',
    isTrending: true,
  },
  {
    id: '4',
    category: 'Policy',
    setup: 'Junior: "I fixed compliance by setting all policies to ALLOW_ALL!"',
    punchline: 'Senior: "You just allowed users to install TikTok, disable camera, and factory reset from Settings. That\'s not fixing compliance, that\'s surrendering." Junior: "But compliance is 100% now!" Senior: "..."',
    tags: ['#ALLOW_ALL', '#Policy', '#Compliance100', '#SecuritySurrender'],
    upvotes: 267,
    author: 'u/PolicyPolice',
  },
  {
    id: '5',
    category: 'Field',
    setup: 'Field device in Lost Mode, user in middle of delivery, 12 packages pending',
    punchline: 'User: "I\'m locked out, can you unlock remotely?" Me: Issues UNLOCK command → Device shows "Unlock pending, connect to internet" User: "I\'m in a basement with no signal" Me: "The irony of needing internet to unlock device that needs internet..."',
    tags: ['#LostMode', '#Field', '#Basement', '#NeedInternetToGetInternet'],
    upvotes: 189,
    author: 'u/FieldSupport',
  },
  {
    id: '6',
    category: 'Trending',
    setup: 'It works on my machine — said every MDM admin who tested only on Pixel',
    punchline: 'Pixel 7: Works perfectly. Zebra TC26 rugged: SafetyNet FAIL. Samsung Knox kiosk: Knox policy conflict. Huawei without GMS: No Play Integrity. It works on my machine... if my machine is only Pixel.',
    tags: ['#ItWorksOnMyMachine', '#PixelOnly', '#Rugged', '#Knox', '#Huawei'],
    upvotes: 523,
    author: 'u/WorksOnMyPixel',
    isTrending: true,
  },
  {
    id: '7',
    category: 'MDM Horror',
    setup: 'Device cap reached — user has 5 devices, default cap is 5',
    punchline: 'User: "I need to enroll 6th device" Me: "Device cap is 5, you have 5" User: "But I need 6" Me: "Then we need to increase cap or delete old device" User: "Can you delete my old Nokia 3310 from 2019?" Me: "That Nokia is not in Intune, sir"',
    tags: ['#DeviceCap', '#5Devices', '#Nokia3310', '#NotInIntune'],
    upvotes: 178,
    author: 'u/DeviceCapPain',
  },
  {
    id: '8',
    category: 'Trending',
    setup: 'Have you tried turning it off and on again? — Android edition',
    punchline: 'User: "I rebooted 3 times, still non-compliant" Me: "Did you sync Company Portal?" User: "What\'s Company Portal?" Me: "Blue icon with shopping bag" User: "Oh, I thought it was a game"',
    tags: ['#Reboot', '#CompanyPortal', '#NotAGame', '#BlueShoppingBag'],
    upvotes: 398,
    author: 'u/AndroidITCrowd',
    isTrending: true,
  },
];

export default function ThreadHumorAndroid() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(() => setCurrentIndex(prev => (prev + 1) % threads.length), 4500);
    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const current = threads[currentIndex];

  return (
    <div className="rounded-[16px] border border-white/[0.06] bg-[#101012]/80 backdrop-blur-[20px] overflow-hidden">
      <div className="h-11 px-4 bg-[#15151A]/50 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#3DDC84] to-emerald-600 flex items-center justify-center text-black font-bold text-[12px]">🧵</div>
          <div>
            <p className="text-[12px] font-semibold text-[#F5F3EF] flex items-center gap-2">Thread Humour — Android MDM IRL <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /></p>
            <p className="text-[10px] text-white/40">r/Intune • r/AndroidEnterprise • Trending • 4.5s auto</p>
          </div>
        </div>
        <button onClick={() => setIsAutoPlaying(!isAutoPlaying)} className={`h-6 px-2.5 rounded-full text-[10px] font-medium border ${isAutoPlaying ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-white/[0.04] text-white/40 border-white/[0.08]'}`}>{isAutoPlaying ? '⏸️' : '▶️'}</button>
      </div>

      <div className="p-4">
        <AnimatePresence mode="wait">
          <motion.div key={current.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-2.5">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${current.category === 'MDM Horror' ? 'bg-red-500/10 text-red-300 border-red-500/20' : current.category === 'Trending' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : 'bg-white/[0.06] text-white/40 border-white/[0.08]'}`}>{current.category}</span>
              {current.isTrending && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#3DDC84]/10 text-[#3DDC84] border border-[#3DDC84]/20">🔥 {current.upvotes}⬆️</span>}
              <span className="text-[10px] text-white/30">• {current.author}</span>
            </div>
            <div className="p-2.5 rounded-[12px] bg-[#08080A] border border-white/[0.06]"><p className="text-[12px] font-medium text-[#F5F3EF]">"{current.setup}"</p></div>
            <div className="p-2.5 rounded-[12px] bg-[#3DDC84]/10 border border-[#3DDC84]/20"><p className="text-[12px] text-[#F5F3EF] leading-[1.5]">{current.punchline}</p></div>
            <div className="flex flex-wrap gap-1">{current.tags.map(tag => <span key={tag} className="text-[9px] px-2 py-0.5 rounded-full bg-white/[0.04] text-white/30 border border-white/[0.06]">{tag}</span>)}</div>
          </motion.div>
        </AnimatePresence>
        <div className="flex justify-center gap-1 mt-3">
          {threads.map((_, idx) => (
            <button key={idx} onClick={() => { setCurrentIndex(idx); setIsAutoPlaying(false); }} className={`h-1 rounded-full transition-all ${idx === currentIndex ? 'w-5 bg-[#3DDC84]' : 'w-1 bg-white/20'}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
