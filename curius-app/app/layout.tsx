import type { Metadata } from "next";
import { Source_Serif_4, JetBrains_Mono, Caveat } from "next/font/google";
import "./globals.css";

const sourceSerif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const caveat = Caveat({
  variable: "--font-handwritten",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Curius - Discover Bookmarks",
  description: "Explore curated bookmarks from curious minds",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${sourceSerif.variable} ${jetbrainsMono.variable} ${caveat.variable} antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
