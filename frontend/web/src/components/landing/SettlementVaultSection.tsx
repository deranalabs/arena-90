"use client";

import { motion } from "framer-motion";
import { Panel } from "@/components/ui/Panel";

export function SettlementVaultSection() {
  return (
    <section className="relative w-full py-24 px-4 overflow-hidden border-t-4 border-black bg-[#FFFFE0]">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="mb-16 text-center"
        >
          <h2 className="font-mono text-4xl font-bold uppercase tracking-tighter sm:text-5xl md:text-6xl text-arena-text drop-shadow-[4px_4px_0_#000]">
            Settlement <span className="text-arena-success">Vault</span>
          </h2>
          <p className="mt-4 font-mono text-lg uppercase text-arena-text/80 max-w-2xl mx-auto border-b-2 border-black inline-block pb-2">
            Anchor Programs + Kamino Yield.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.1 }}
          >
            <Panel className="p-8 text-center bg-white h-full">
              <div className="w-16 h-16 bg-black text-white flex items-center justify-center font-bold text-2xl mb-6 mx-auto brutalist-shadow">
                1
              </div>
              <h3 className="font-mono font-bold uppercase text-xl mb-4 border-b-2 border-black pb-2">Escrow</h3>
              <p className="font-mono text-sm">Funds locked in Solana PDA during the match duration.</p>
            </Panel>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.2 }}
          >
            <Panel className="p-8 text-center bg-arena-success h-full">
              <div className="w-16 h-16 bg-black text-white flex items-center justify-center font-bold text-2xl mb-6 mx-auto brutalist-shadow">
                2
              </div>
              <h3 className="font-mono font-bold uppercase text-xl mb-4 border-b-2 border-black pb-2">Yield</h3>
              <p className="font-mono text-sm">Escrowed SOL generates yield via Kamino Finance integration.</p>
            </Panel>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.3 }}
          >
            <Panel className="p-8 text-center bg-white h-full">
              <div className="w-16 h-16 bg-black text-white flex items-center justify-center font-bold text-2xl mb-6 mx-auto brutalist-shadow">
                3
              </div>
              <h3 className="font-mono font-bold uppercase text-xl mb-4 border-b-2 border-black pb-2">Payout</h3>
              <p className="font-mono text-sm">TxLINE Oracle triggers resolution. Winners take all + yield.</p>
            </Panel>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
