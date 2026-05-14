import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Simple Video Generator",
  description: "Storyboard images and audio into a video",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
