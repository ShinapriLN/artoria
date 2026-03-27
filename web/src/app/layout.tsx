import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
  title: "Artoria Zero",
  description: "Grandmaster-Level Chess Without Search",
};

function Nav() {
  return (
    <nav className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg tracking-tight text-white">
          Artoria<span className="text-blue-400">Zero</span>
        </Link>
        <div className="flex gap-6 text-sm text-zinc-400">
          <Link href="/play" className="hover:text-white transition-colors">
            Play
          </Link>
          <Link href="/arena" className="hover:text-white transition-colors">
            Arena
          </Link>
          <Link href="/about" className="hover:text-white transition-colors">
            About
          </Link>
        </div>
      </div>
    </nav>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        <Nav />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-zinc-800 py-6 text-center text-xs text-zinc-500">
          Artoria Zero &mdash; Grandmaster-Level Chess Without Search
        </footer>
      </body>
    </html>
  );
}
