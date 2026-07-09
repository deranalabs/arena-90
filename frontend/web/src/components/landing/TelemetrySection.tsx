"use client";

import { motion } from "framer-motion";
import { Panel } from "@/components/ui/Panel";
import { useEffect, useState } from "react";

const MOCK_LOGS = [
  "[SYSTEM] Connecting to TxLINE Oracle...",
  "[SYSTEM] Oracle stream active.",
  "[AGENT:ISAGI] Fetching latest market odds...",
  "[AGENT:ISAGI] Odds acquired. Analyzing expected value...",
  "[AGENT:AIKU] Calculating defensive block probabilities...",
  "[AGENT:ISAGI] Detected vulnerability in Zone 14.",
  "[SYSTEM] Block hash 84F2... confirmed.",
  "[AGENT:AIKU] Defensive posture locked.",
  "[SYSTEM] Awaiting next tick...",
];

export function TelemetrySection() {
  const [logs, setLogs] = useState<string[]>([]);
  
  useEffect(() => {
    let currentIndex = 0;
    const interval = setInterval(() => {
      setLogs(prev => {
        const newLogs = [...prev, MOCK_LOGS[currentIndex]];
        if (newLogs.length > 6) newLogs.shift();
        return newLogs;
      });
      currentIndex = (currentIndex + 1) % MOCK_LOGS.length;
    }, 1200);
    
    return () => clearInterval(interval);
  }, []);

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
            Agent <span className="text-arena-cyan">Telemetry</span>
          </h2>
          <p className="mt-4 font-mono text-lg uppercase text-arena-text/80 max-w-2xl mx-auto border-b-2 border-black inline-block pb-2">
            Real-time ZeroClaw engine execution logs.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.1 }}
            className="md:col-span-8"
          >
            <Panel className="p-6 bg-black text-green-400 font-mono text-sm sm:text-base h-[350px] overflow-hidden flex flex-col justify-end" variant="default">
                <div className="space-y-2 opacity-80">
                  {logs.map((log, i) => (
                    <motion.div 
                      key={`${i}-${log}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-l-2 border-green-500 pl-2"
                    >
                      {log}
                    </motion.div>
                  ))}
                  <div className="animate-pulse inline-block w-3 h-5 bg-green-500 mt-2"></div>
                </div>
            </Panel>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.2 }}
            className="md:col-span-4 flex flex-col gap-6"
          >
            <Panel className="p-6" variant="cyan">
               <h4 className="font-mono font-bold uppercase border-b-2 border-black pb-2 mb-4">ISAGI Status</h4>
               <div className="space-y-2 font-mono text-sm">
                 <div className="flex justify-between"><span>Compute</span><span className="font-bold">Active</span></div>
                 <div className="flex justify-between"><span>Confidence</span><span className="font-bold">84%</span></div>
                 <div className="flex justify-between"><span>Target</span><span className="font-bold text-arena-red">Over 2.5</span></div>
               </div>
            </Panel>
            <Panel className="p-6" variant="red">
               <h4 className="font-mono font-bold uppercase border-b-2 border-black pb-2 mb-4">AIKU Status</h4>
               <div className="space-y-2 font-mono text-sm">
                 <div className="flex justify-between"><span>Compute</span><span className="font-bold">Active</span></div>
                 <div className="flex justify-between"><span>Confidence</span><span className="font-bold">92%</span></div>
                 <div className="flex justify-between"><span>Target</span><span className="font-bold text-arena-cyan">Under 2.5</span></div>
               </div>
            </Panel>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
