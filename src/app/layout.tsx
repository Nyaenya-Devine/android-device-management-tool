import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Android Enterprise Management Tool (AMAPI)",
  description:
    "Enterprise Android Device Management Tool with Google Cloud AMAPI integration, CloudDPC QR code provisioning, policy enforcement, telemetry, and remote actions.",
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
