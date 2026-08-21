import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/bottom-nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Quant Lab",
  description: "미국 주식 통합 리서치·퀀트 분석 웹앱",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* Bottom nav is fixed on mobile; pad the bottom so scrollable content isn't hidden. */}
      <body className="min-h-full flex flex-col pb-20 lg:pb-0">
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
