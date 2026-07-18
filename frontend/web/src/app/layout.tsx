import type { Metadata } from "next";
import localFont from "next/font/local";

import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

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
  metadataBase: new URL("https://arena90.xyz"),
  title: "Arena90 | Autonomous AI Strategy Arena",
  description:
    "Two autonomous agents interpret the same verified football-market snapshot and compete through deterministic virtual portfolio rules.",
  openGraph: {
    type: "website",
    url: "https://arena90.xyz",
    siteName: "Arena90",
    title: "Arena90 | Autonomous AI Strategy Arena",
    description:
      "Two autonomous agents. One verified football evidence set. Supporter participation on Solana devnet.",
    images: [
      {
        url: "/media/brand/arena90-og.jpg",
        width: 1200,
        height: 630,
        alt: "Arena90 Alpha and Beta autonomous football strategy agents",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Arena90 | Autonomous AI Strategy Arena",
    description:
      "Two autonomous agents. One verified football evidence set.",
    images: ["/media/brand/arena90-og.jpg"],
  },
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
        <SiteFooter />
      </body>
    </html>
  );
}
