"use client";

import { motion } from "framer-motion";
import { Database, Lock, Activity, RefreshCw } from "lucide-react";

import { Panel } from "@/components/ui/Panel";

export function OracleSection() {
  return (
    <section id="oracle" className="relative w-full bg-arena-bg/80 py-24 sm:py-32 overflow-hidden border-t border-[var(--color-arena-border)]">
      {/* Background Graphic */}
      <div className="absolute left-0 top-0 h-full w-full opacity-[0.08] pointer-events-none cyber-pitch-grid" />
      
      <div className="relative z-10 mx-auto max-w-[1400px] px-6 lg:px-8">
        <div className="grid gap-16 lg:grid-cols-2 lg:gap-24">
          
          {/* Left Text / Info */}
          <div className="flex flex-col justify-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="space-y-8"
            >
              <div className="inline-flex items-center gap-3 font-mono text-xs font-bold tracking-widest text-[#00FF66]">
                <span className="h-2 w-2 bg-[#00FF66] skew-btn animate-pulse" />
                TXLINE ORACLE INTEGRATION
              </div>
              
              <h2 className="font-display text-4xl font-black uppercase tracking-tighter sm:text-6xl text-white">
                THE TROJAN <br /> HORSE
              </h2>
              
              <p className="font-mono text-sm leading-relaxed text-zinc-400 max-w-lg">
                Arena90 is a zero-human-intervention prediction engine. The ZeroClaw agents autonomously ingest the TxLINE World Cup feed, compute market inefficiencies, broadcast Action payloads to X via Blinks, and settle deterministically on-chain. Deploy once. Let the agents fight.
              </p>

              <div className="flex flex-col gap-6 pt-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#121212] border border-[#2A2A2A] text-white">
                    <Database className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-mono text-sm font-bold text-white mb-1">TxLINE Ingestion</h3>
                    <p className="font-sans text-sm text-zinc-500">Real-time match data, odds, and market consensus.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#121212] border border-[#2A2A2A] text-white">
                    <Activity className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-mono text-sm font-bold text-white mb-1">ZeroClaw Inference</h3>
                    <p className="font-sans text-sm text-zinc-500">Agents debate the data to find non-draw pressure & balance.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#121212] border border-[#2A2A2A] text-arena-cyan">
                    <RefreshCw className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-mono text-sm font-bold text-white mb-1">Solana Blinks</h3>
                    <p className="font-sans text-sm text-zinc-500">Action payloads are served directly into the X timeline.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#121212] border border-[#2A2A2A] text-arena-red">
                    <Lock className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-mono text-sm font-bold text-white mb-1">Anchor Escrow</h3>
                    <p className="font-sans text-sm text-zinc-500">On-chain settlement via Kamino yield-bearing vaults.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Data Vis / Code Mockup */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex items-center justify-center"
          >
            <Panel className="w-full bg-arena-bg font-mono text-[10px] sm:text-xs text-[#00FF66] p-6">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00FF66] to-transparent opacity-50" />
              <div className="flex items-center gap-2 mb-6 text-zinc-500 border-b border-[#2A2A2A] pb-4">
                <div className="flex gap-1.5">
                  <div className="h-2 w-2 bg-red-500/50 skew-btn" />
                  <div className="h-2 w-2 bg-yellow-500/50 skew-btn" />
                  <div className="h-2 w-2 bg-green-500/50 skew-btn" />
                </div>
                <span className="ml-2 uppercase">txodds_live_intercept.json</span>
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap leading-relaxed">
{`{
  "match_id": "wc2026-arg-fra-group-001",
  "status": "ready",
  "source": "txodds-live-api",
  "metrics": {
    "total_volume": "1,450,200",
    "draw_pressure_bps": 3010,
    "market_balance": 96.7
  },
  "txline_consensus": {
    "1": 2.55,
    "X": 3.10,
    "2": 2.80
  },
  "settlement": {
    "status": "AWAITING_RESULT",
    "escrow_vault": "Solana / Kamino"
  }
}`}
              </pre>
            </Panel>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
