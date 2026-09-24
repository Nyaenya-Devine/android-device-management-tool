import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://android-device-management-tool.vercel.app"),
  title: "Android Enterprise Fleet — Secure Device Management Console",
  description:
    "Android Enterprise management console with device compliance, policy enforcement, enrollment via QR provisioning, and remote operations with audit logging. Supports simulator and live API modes.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-512.png", sizes: "512x512", type: "image/png" }],
  },
  openGraph: {
    title: "Android Enterprise Fleet",
    description: "Explainable Android Enterprise fleet posture and policy operations.",
    images: [{ url: "/adm-logo.png", width: 1024, height: 1024, alt: "Android Enterprise Fleet logo" }],
  },
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
