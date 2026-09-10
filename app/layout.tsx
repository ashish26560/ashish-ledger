import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import MobileTabBar from "@/components/MobileTabBar";
import MobileTopBar from "@/components/MobileTopBar";
import { DataProvider } from "@/lib/DataContext";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ashish's Ledger",
  description: "Personal expense tracker across HDFC and SBI accounts",
};

// `viewportFit: "cover"` lets the layout reach under the notch/home indicator
// so the tab bar can sit flush at the bottom; the bar adds the safe-area
// inset back as padding. themeColor tints the browser chrome to match paper.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F4F3EE",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body className="font-sans bg-paper text-ink min-h-screen">
        <DataProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex-1 min-w-0 flex flex-col">
              <MobileTopBar />
              {/* Bottom padding clears the fixed tab bar (h-14) plus the iOS
                  home-indicator inset; from `md` up there's no bar to clear. */}
              <main className="flex-1 min-w-0 pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
                {children}
              </main>
            </div>
          </div>
          <MobileTabBar />
        </DataProvider>
      </body>
    </html>
  );
}
