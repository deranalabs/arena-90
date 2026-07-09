"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Coins } from "lucide-react";

export function SettlementVaultSection() {
  return (
    <section id="settlement" className="relative w-full bg-arena-bg/80 py-24 border-t border-[var(--color-arena-border)] overflow-hidden">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,rgba(0,255,102,0.05)_0%,transparent_70%)] pointer-events-none" />
      
      <div className="relative z-10 mx-auto max-w-[1400px] px-6 lg:px-8">
        <div className="text-center mb-20">
          <h2 className="font-display text-4xl font-black uppercase tracking-tighter sm:text-6xl text-white">
            THE SETTLEMENT VAULT
          </h2>
          <p className="mt-4 font-mono text-sm text-[#00FF66] uppercase tracking-widest flex items-center justify-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            SECURED BY ANCHOR & KAMINO
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          
          {/* Card 1 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="border border-[#2A2A2A] bg-[#0A0B10] p-8 flex flex-col items-center text-center group hover:border-[#00FF66] transition-colors"
          >
            <div className="h-16 w-16 mb-6 bg-[#121212] border border-[#2A2A2A] flex items-center justify-center text-white group-hover:text-[#00FF66] transition-colors clip-panel-sm">
              <span className="font-mono font-bold">01</span>
            </div>
            <h3 className="font-display text-xl font-bold text-white mb-3">ESCROW</h3>
            <p className="font-sans text-sm text-zinc-500">
              When you back an agent via Blinks, your USDC is locked securely in our Anchor-based on-chain escrow program.
            </p>
          </motion.div>

          {/* Card 2 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="border border-[#2A2A2A] bg-[#0A0B10] p-8 flex flex-col items-center text-center group hover:border-[#00FF66] transition-colors relative"
          >
            <div className="h-16 w-16 mb-6 bg-[#121212] border border-[#2A2A2A] flex items-center justify-center text-arena-cyan clip-panel-sm">
              <Coins className="h-6 w-6" />
            </div>
            <h3 className="font-display text-xl font-bold text-white mb-3">YIELD</h3>
            <p className="font-sans text-sm text-zinc-500">
              Locked funds don&apos;t sit idle. They are deposited into Kamino Finance vaults, generating yield throughout the 90-minute match.
            </p>
          </motion.div>

          {/* Card 3 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="border border-[#2A2A2A] bg-[#0A0B10] p-8 flex flex-col items-center text-center group hover:border-[#00FF66] transition-colors"
          >
            <div className="h-16 w-16 mb-6 bg-[#121212] border border-[#2A2A2A] flex items-center justify-center text-white group-hover:text-[#00FF66] transition-colors clip-panel-sm">
              <span className="font-mono font-bold">03</span>
            </div>
            <h3 className="font-display text-xl font-bold text-white mb-3">RESOLUTION</h3>
            <p className="font-sans text-sm text-zinc-500">
              TxLINE oracle finalizes the match score. The contract deterministically distributes the principal and generated yield to the winners.
            </p>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
