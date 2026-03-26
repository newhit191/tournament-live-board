import type { Metadata } from "next";
import { Instrument_Sans, Teko } from "next/font/google";
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
    default: "Tournament Live Board 賽事直播看板",
    template: "%s | Tournament Live Board 賽事直播看板",
  },
  description:
    "具備公開展示頁、主辦方控制台與 Google Sheets 資料源的賽事直播網站。",
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
      <body className="min-h-full font-sans text-foreground">{children}</body>
    </html>
  );
}
