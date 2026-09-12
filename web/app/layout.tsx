import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { WalletProvider } from "@/components/WalletProvider";

export const metadata: Metadata = {
  title: "Gantry | every swap gets read as it passes",
  description:
    "A Uniswap v4 hook that prices each swap by the caller's on-chain behaviour. Paste an address to see what it would pay, and why.",
};

/**
 * Fetched at build time and served from this origin. Loading them from Google's CDN meant a
 * network that cannot reach fonts.gstatic.com never fires the page's load event, and the tab
 * spins forever.
 */
const display = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-display",
  display: "swap",
});

const body = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <WalletProvider>
          <Nav />
          {children}
          <Footer />
        </WalletProvider>
      </body>
    </html>
  );
}
