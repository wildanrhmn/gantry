import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gantry — every swap gets read as it passes",
  description:
    "A Uniswap v4 hook that prices each swap by the caller's on-chain behaviour. Paste an address to see what it would pay, and why.",
};

const FONTS =
  "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,400..900&family=Instrument+Sans:wght@400..700&family=IBM+Plex+Mono:wght@400;500;600&display=swap";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body>{children}</body>
    </html>
  );
}
