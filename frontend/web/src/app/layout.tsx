import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
