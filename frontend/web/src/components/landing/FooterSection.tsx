"use client";
import { ArrowRight, Terminal } from "lucide-react";

export function FooterSection() {
  return (
    <footer className="relative w-full border-t border-[var(--color-arena-border)] bg-[#0A0B10] py-16 overflow-hidden">
      <div className="absolute inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
      
      <div className="relative z-10 mx-auto max-w-[1400px] px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          
          {/* Brand & Manifesto */}
          <div className="space-y-4 lg:col-span-2">
            <div className="flex items-center gap-3">
              <span className="font-display text-2xl font-black italic tracking-tighter text-white">ARENA90</span>
              <span className="h-4 w-4 bg-[#00FF66] skew-btn" />
            </div>
            <p className="font-mono text-xs text-zinc-500 max-w-sm leading-relaxed">
              Built for the Superteam Earn World Cup 2026 Hackathon. A demonstration of autonomous agents operating on deterministic data within the Solana ecosystem.
            </p>
          </div>

          {/* Infrastructure Partners */}
          <div className="space-y-4">
            <h4 className="font-mono text-[10px] font-bold tracking-[0.2em] text-zinc-400">INFRASTRUCTURE</h4>
            <ul className="space-y-2 font-mono text-xs text-zinc-600">
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 bg-zinc-800" />
                TxLINE (Oracle Data)
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 bg-zinc-800" />
                Solana Actions (Blinks)
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 bg-zinc-800" />
                Anchor (Escrow Program)
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 bg-zinc-800" />
                Kamino (Yield Layer)
              </li>
            </ul>
          </div>

          {/* Links & CTA */}
          <div className="space-y-6">
            <h4 className="font-mono text-[10px] font-bold tracking-[0.2em] text-zinc-400">ACCESS</h4>
            <div className="flex flex-col gap-3">
              <a 
                href="#agents" 
                className="group flex w-fit items-center gap-2 font-mono text-xs font-bold text-[var(--color-system-success)] transition-colors hover:text-white"
              >
                <span>[ OPEN_LIVE_ARENA ]</span>
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
              </a>
              <a 
                href="https://github.com/deranalabs" 
                target="_blank" 
                rel="noreferrer"
                className="group flex w-fit items-center gap-2 font-mono text-xs text-zinc-500 transition-colors hover:text-white"
              >
                <Terminal className="h-3 w-3" />
                <span>SOURCE_CODE</span>
              </a>
            </div>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-center justify-between border-t border-[var(--color-arena-border)] pt-8 sm:flex-row">
          <p className="font-mono text-[10px] text-zinc-600">
            © 2026 ARENA90. ZERO FINANCIAL ADVICE.
          </p>
          <p className="mt-2 font-mono text-[10px] text-zinc-600 sm:mt-0">
            SYS.ARCHITECT: DERANALABS
          </p>
        </div>
      </div>
    </footer>
  );
}
