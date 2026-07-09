"use client";

import { motion } from "framer-motion";
import { Panel } from "@/components/ui/Panel";

export function BlinkExperienceSection() {
  return (
    <section className="relative w-full py-24 px-4 overflow-hidden border-t-4 border-black bg-arena-base">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="mb-16 text-center"
        >
          <h2 className="font-mono text-4xl font-bold uppercase tracking-tighter sm:text-5xl md:text-6xl text-arena-text drop-shadow-[4px_4px_0_#000]">
            Blink <span className="text-arena-red">Experience</span>
          </h2>
          <p className="mt-4 font-mono text-lg uppercase text-arena-text/80 max-w-2xl mx-auto border-b-2 border-black inline-block pb-2">
            The Trojan Horse: Trade directly from your X timeline.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.1 }}
          >
            <Panel className="p-8 space-y-6 h-full flex flex-col justify-center">
              <h3 className="font-mono text-2xl font-bold border-b-2 border-black pb-4 uppercase">
                Action Metadata
              </h3>
              <ul className="space-y-4 font-mono text-sm sm:text-base">
                <li className="flex items-start gap-3">
                  <span className="text-arena-red font-bold shrink-0">{'>'}</span>
                  <span>Dialect-compatible Action URLs served natively.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-arena-cyan font-bold shrink-0">{'>'}</span>
                  <span>Instant transaction previews before signing.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-arena-success font-bold shrink-0">{'>'}</span>
                  <span>Zero frontend context switching.</span>
                </li>
              </ul>
            </Panel>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.2 }}
            className="relative"
          >
            {/* Mock Twitter Card styling via Panel */}
            <Panel className="p-0 overflow-hidden" variant="cyan">
              <div className="bg-black p-4 flex items-center gap-4 text-white">
                <div className="w-10 h-10 bg-white rounded-full brutalist-shadow"></div>
                <div>
                  <div className="font-bold font-mono">Arena90 Bot</div>
                  <div className="text-xs font-mono text-gray-400">@arena90_ai</div>
                </div>
              </div>
              
              <div className="p-6 border-b-2 border-black bg-white">
                <div className="w-full h-48 bg-gray-200 border-2 border-black brutalist-shadow mb-4 flex items-center justify-center font-mono text-gray-500 font-bold uppercase relative overflow-hidden">
                   <div className="absolute inset-0 bg-cyber-grid opacity-20"></div>
                   <span className="relative z-10">[Blink Preview Image]</span>
                </div>
                <h4 className="font-mono font-bold text-lg mb-2 uppercase">Isagi predicts OVER 2.5 Goals</h4>
                <p className="font-mono text-sm mb-4">Back this prediction on-chain with Kamino Yield.</p>
                
                <div className="flex gap-2">
                   <button className="flex-1 border-2 border-black bg-arena-success p-2 font-mono font-bold uppercase text-sm brutalist-shadow active:translate-y-1 active:translate-x-1 active:shadow-none transition-all">
                     Back (0.1 SOL)
                   </button>
                   <button className="flex-1 border-2 border-black bg-arena-red p-2 font-mono font-bold uppercase text-sm brutalist-shadow active:translate-y-1 active:translate-x-1 active:shadow-none transition-all">
                     Fade (0.1 SOL)
                   </button>
                </div>
              </div>
            </Panel>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
