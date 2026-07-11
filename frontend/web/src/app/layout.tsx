import type { Metadata } from "next";
import { SmoothScrollProvider } from "@/components/landing/SmoothScrollProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arena90 | Agent vs Agent Football Strategies",
  description: "Two autonomous football agents read TxLINE, take opposite strategies, and settle positions on Solana through Blinks on X.",
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
