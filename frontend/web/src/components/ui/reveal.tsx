"use client";

import type { CSSProperties, ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

type RevealProps = {
  amount?: number;
  blur?: boolean;
  children: ReactNode;
  className?: string;
  delay?: number;
  id?: string;
  style?: CSSProperties;
  y?: number;
};

export function Reveal({
  amount = 0.24,
  blur = true,
  children,
  className,
  delay = 0,
  y = 18,
  ...props
}: RevealProps) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return (
      <div className={className} {...props}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      initial={{
        filter: blur ? "blur(8px)" : "blur(0px)",
        opacity: 0,
        y,
      }}
      transition={{
        delay,
        duration: 0.7,
        ease: [0.22, 1, 0.36, 1],
      }}
      viewport={{
        amount,
        margin: "0px 0px -12% 0px",
        once: true,
      }}
      whileInView={{
        filter: "blur(0px)",
        opacity: 1,
        y: 0,
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
