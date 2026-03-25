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
    default: "Tournament Live Board",
    template: "%s | Tournament Live Board",
  },
  description:
    "A broadcast-style tournament website with public display pages, an admin control room, and Google Sheets as the data source.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${instrumentSans.variable} ${teko.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans text-foreground">{children}</body>
    </html>
  );
}
