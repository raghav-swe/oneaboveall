import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import { OAAProvider } from "@/context/OAAContext";

export const metadata: Metadata = {
  title: "OneAboveAll — Autonomous SRE Control Plane",
  description:
    "Graduated-trust autonomous incident response: diagnose → debate → decide → gate → stabilize → report.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-oaa-bg font-sans text-slate-200 antialiased">
        <OAAProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <TopBar />
              <main className="flex-1">{children}</main>
            </div>
          </div>
        </OAAProvider>
      </body>
    </html>
  );
}
