import type { Metadata } from "next";
import { Instrument_Sans, Teko } from "next/font/google";

import { BackgroundMusicHost } from "@/components/background-music-host";

import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

const teko = Teko({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: (() => {
    const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (!raw) {
      return new URL("http://localhost:3000");
    }

    try {
      return new URL(raw);
    } catch {
      return new URL("http://localhost:3000");
    }
  })(),
  title: {
    default: "Tournament Live Board | 戰鬥陀螺競技平台",
    template: "%s | Tournament Live Board",
  },
  description:
    "專為戰鬥陀螺社群打造的即時賽事平台，支援家庭多玩家、直接註冊、星星帳本與大螢幕展示。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-Hant-TW"
      className={`${instrumentSans.variable} ${teko.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans text-foreground">
        {children}
        <BackgroundMusicHost />
      </body>
    </html>
  );
}
