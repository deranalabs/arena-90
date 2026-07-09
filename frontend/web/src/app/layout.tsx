import type { Metadata } from "next";
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
    <html lang="en" className="dark">
      <body
        className="antialiased bg-[#050505] text-white font-sans overflow-x-hidden selection:bg-[#FF1E56] selection:text-white"
      >
        {children}
      </body>
    </html>
  );
}
