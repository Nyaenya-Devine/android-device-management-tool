import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Android Enterprise Fleet — Secure Device Management Console",
  description:
    "Android Enterprise management console with device compliance, policy enforcement, enrollment via QR provisioning, and remote operations with audit logging. Supports simulator and live API modes.",
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
