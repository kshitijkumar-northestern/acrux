import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Acrux — economic immune system for the agent economy",
  description:
    "Drop-in Lightning middleware. Per-load surge pricing, per-wallet attacker pricing, reputation staking with slashing.",
  metadataBase: new URL("https://acrux.run"),
  openGraph: {
    title: "Acrux — economic immune system for the agent economy",
    description:
      "Drop-in Lightning middleware that prices attackers out and pays honest agents back. Real Lightning, sub-cent settlement, no signups.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
