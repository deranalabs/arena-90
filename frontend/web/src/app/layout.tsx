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
    <html lang="en">
      <body
        className="antialiased bg-arena-bg text-black font-sans overflow-x-hidden selection:bg-arena-red selection:text-white"
      >
        {children}
      </body>
    </html>
  );
}
