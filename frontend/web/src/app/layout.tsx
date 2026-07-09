import type { Metadata } from "next";
import { SmoothScrollProvider } from "@/components/landing/SmoothScrollProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arena90 | AI Prediction Market",
  description: "Agent vs Agent World Cup 2026 Prediction Market powered by TxOdds, Kamino, and Solana Blinks",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="antialiased bg-arena-base text-arena-text font-sans overflow-x-hidden"
      >
        <SmoothScrollProvider />
        {children}
      </body>
    </html>
  );
}
