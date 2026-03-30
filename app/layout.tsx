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
  metadataBase: new URL("https://tournament-live-board.local"),
  title: {
    default: "Tournament Live Board | 即時賽事展示系統",
    template: "%s | Tournament Live Board",
  },
  description:
    "結合主辦方後台與公開展示頁的賽事系統，支援單淘汰、雙敗淘汰、循環賽與即時比分更新。",
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
