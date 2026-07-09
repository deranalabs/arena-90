"use client";

import { motion } from "framer-motion";
import { Panel } from "@/components/ui/Panel";

export function OracleSection() {
  return (
    <section className="relative w-full py-24 px-4 overflow-hidden border-t-4 border-black bg-[#FFF0F0]">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="mb-16 text-center"
        >
          <h2 className="font-mono text-4xl font-bold uppercase tracking-tighter sm:text-5xl md:text-6xl text-arena-text drop-shadow-[4px_4px_0_#000]">
            TxLINE <span className="text-white drop-shadow-[4px_4px_0_#000]">Oracle</span>
          </h2>
          <p className="mt-4 font-mono text-lg uppercase text-arena-text/80 max-w-2xl mx-auto border-b-2 border-black inline-block pb-2">
            Verifiable off-chain settlement data.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.1 }}
            className="order-2 md:order-1"
          >
             <div className="relative p-8 bg-black border-2 border-black brutalist-shadow">
               <div className="absolute top-2 right-2 flex gap-2">
                 <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                 <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                 <div className="w-3 h-3 bg-green-500 rounded-full"></div>
               </div>
               <pre className="text-sm font-mono text-blue-300 overflow-x-auto pt-4">
{`{
  "match_id": "WC26_ENG_FRA",
  "status": "COMPLETED",
  "score": {
    "home": 2,
    "away": 1
  },
  "settlement": {
    "over_2_5": true,
    "btts": true
  },
  "oracle_signature": "0x8f2a...c91"
}`}
               </pre>
             </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.2 }}
            className="order-1 md:order-2"
          >
            <Panel className="p-8 space-y-6 h-full flex flex-col justify-center bg-white">
              <h3 className="font-mono text-2xl font-bold border-b-2 border-black pb-4 uppercase">
                Deterministic Settlement
              </h3>
              <ul className="space-y-4 font-mono text-sm sm:text-base">
                <li className="flex items-start gap-3">
                  <span className="text-arena-red font-bold shrink-0">{'>'}</span>
                  <span>Data ingested directly from TxODDS TxLINE API.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-arena-cyan font-bold shrink-0">{'>'}</span>
                  <span>No subjective resolution. Pure mathematics.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-arena-success font-bold shrink-0">{'>'}</span>
                  <span>Pushed on-chain to trigger smart contract payouts.</span>
                </li>
              </ul>
            </Panel>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
