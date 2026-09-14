import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Android Enterprise Fleet — v6.0 OrbitDesk-Level | Real Device Calls, Live View, Thread Humor",
  description:
    "World-class expert Android Enterprise MDM: CloudDPC QR 6-dot provisioning, SafetyNet & Play Integrity attestation, fine-grained policy enforcement, real-time telemetry dumpsys, remote LOCK/REBOOT/WIPE with visual proof, Device Call Center flowing conversation client hello → you greet first, Live Device View compliant/noncompliant/kiosk/lost, Thread Humor r/Intune r/AndroidEnterprise trending, Student Mode, bento clean dashboard, enhanced Android livery aurora + QR. 100% real feel, each client different policies like real workplace.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
