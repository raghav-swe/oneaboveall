import type { Metadata } from "next";
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import AmbientBackground from "@/components/layout/AmbientBackground";
import { ThemeProvider } from "@/components/layout/ThemeProvider";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const display = Inter_Tight({ subsets: ["latin"], variable: "--font-display" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "OneAboveAll Control Plane",
  description: "Agentic SRE platform UI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      <body className="min-h-screen">
        <ThemeProvider>
        <AmbientBackground />
        <div className="relative z-10 flex min-h-screen">
          <Sidebar />
          <div className="min-w-0 flex-1">
            <header className="app-topbar">
              <div><span className="topbar-kicker">ONEABOVEALL</span><span className="topbar-divider">/</span><span className="topbar-context">Operations workspace</span></div>
            </header>
            <main className="mx-auto w-full max-w-[1600px] overflow-x-hidden p-4 md:p-8">{children}</main>
          </div>
        </div>
        </ThemeProvider>
      </body>
    </html>
  );
}