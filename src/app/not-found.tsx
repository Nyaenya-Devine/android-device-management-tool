import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found — Android Enterprise Fleet",
  description:
    "The requested page does not exist in the Android Enterprise fleet console.",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#050507] px-6 py-20 text-center">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-2xl backdrop-blur md:p-12">
        <p className="font-mono text-[56px] leading-none text-[#3DDC84] md:text-[72px]">
          404
        </p>

        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white md:text-3xl">
          Device not found
        </h1>

        <p className="mt-4 text-sm leading-relaxed text-slate-400">
          This route isn&apos;t part of the fleet console. Check the URL, or head
          back to the device list to manage enrolled hardware.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="rounded-lg bg-[#3DDC84] px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-[#2AA86B]"
          >
            Back to fleet console
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-slate-700 bg-slate-800/60 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
          >
            View devices
          </Link>
        </div>

        <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.16em] text-slate-600">
          Android Enterprise Fleet — simulator and live AMAPI modes
        </p>
      </div>
    </main>
  );
}
