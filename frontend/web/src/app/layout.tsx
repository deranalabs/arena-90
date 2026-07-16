import type { Metadata } from "next";
import localFont from "next/font/local";

import { SiteHeader } from "@/components/site/SiteHeader";

import "./globals.css";

const poppins = localFont({
  src: [
    {
      path: "./fonts/poppins/Poppins-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/poppins/Poppins-Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/poppins/Poppins-SemiBold.ttf",
      weight: "600",
      style: "normal",
    },
    {
      path: "./fonts/poppins/Poppins-Bold.ttf",
      weight: "700",
      style: "normal",
    },
    {
      path: "./fonts/poppins/Poppins-ExtraBold.ttf",
      weight: "800",
      style: "normal",
    },
  ],
  variable: "--font-poppins",
  display: "swap",
  fallback: ["Arial", "Helvetica", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Arena90 | Autonomous AI Strategy Arena",
  description:
    "Two autonomous agents interpret the same verified football-market snapshot and compete through deterministic virtual portfolio rules.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className={poppins.variable} lang="en">
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
