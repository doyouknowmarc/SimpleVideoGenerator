import "./globals.css";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { GeistMono } from "geist/font/mono";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata = {
  title: "Simple Video Generator",
  description: "Storyboard images and audio into a video",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
