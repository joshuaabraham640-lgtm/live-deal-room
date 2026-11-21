'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-cream-grid text-[#14181F] flex flex-col justify-between">
      {/* Top Bar */}
      <header className="max-w-5xl w-full mx-auto px-6 py-8 flex items-center justify-between border-b border-[#14181F]/15">
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 rounded-xl bg-[#1B365D]" />
          <span className="font-semibold tracking-tight text-base text-[#14181F]">
            DealRoom
          </span>
        </div>
        <span className="font-mono text-xs text-[#1B365D] bg-[#1B365D]/10 border border-[#1B365D]/25 px-3 py-1.5 rounded-xl">
          Nexconn Live
        </span>
      </header>

      {/* Main Content */}
      <section className="max-w-5xl w-full mx-auto px-6 py-16">
        <p className="font-mono text-xs uppercase tracking-widest text-[#1B365D] mb-6">
          Live Scope, Quote &amp; Deal Lock
        </p>

        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[1.08] max-w-3xl text-[#14181F]">
          Qualify leads, draft quotes, and lock deals in real time.
        </h1>

        <p className="mt-6 text-base sm:text-lg text-[#14181F]/75 max-w-2xl leading-relaxed">
          Clients explore services, share their real budget and timeline, and review live quotes while the founder builds or revises proposals and both sides sign off.
        </p>

        <div className="mt-12 grid sm:grid-cols-2 gap-6 pt-10 border-t border-[#14181F]/15">
          <Link
            href="/deal-room?role=client_lead"
            className="group p-6 rounded-xl bg-[#FCFBF7] border border-[#14181F]/20 hover:border-[#1B365D] transition-colors flex flex-col justify-between gap-6"
          >
            <div className="space-y-3">
              <span className="inline-block font-mono text-xs text-[#1B365D] bg-[#1B365D]/10 px-3 py-1 rounded-xl">
                client_lead
              </span>
              <h2 className="text-xl font-semibold text-[#14181F]">
                Enter as Prospective Client
              </h2>
              <p className="text-sm text-[#14181F]/70 leading-relaxed">
                Ask about offered services, share your project budget and timeline, and approve live quote terms.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold text-[#1B365D] group-hover:translate-x-1 transition-transform">
              <span>Start client session</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </Link>

          <Link
            href="/deal-room?role=agency_founder"
            className="group p-6 rounded-xl bg-[#FCFBF7] border border-[#14181F]/20 hover:border-[#1B365D] transition-colors flex flex-col justify-between gap-6"
          >
            <div className="space-y-3">
              <span className="inline-block font-mono text-xs text-[#1B365D] bg-[#1B365D]/10 px-3 py-1 rounded-xl">
                agency_founder
              </span>
              <h2 className="text-xl font-semibold text-[#14181F]">
                Enter as Agency Founder
              </h2>
              <p className="text-sm text-[#14181F]/70 leading-relaxed">
                Create custom quotes from scratch, revise pricing live, and give final confirmation once the client approves.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold text-[#1B365D] group-hover:translate-x-1 transition-transform">
              <span>Open founder desk</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-5xl w-full mx-auto px-6 py-8 border-t border-[#14181F]/15 flex flex-wrap items-center justify-between gap-4 text-xs text-[#14181F]/65">
        <span>Next.js · TypeScript · Gemini · Nexconn</span>
        <span className="font-mono text-[#1B365D]">Cream · Ink · Navy</span>
      </footer>
    </main>
  );
}