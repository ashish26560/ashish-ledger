"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import Sidebar from "@/components/Sidebar";
import MobileTabBar from "@/components/MobileTabBar";
import MobileTopBar from "@/components/MobileTopBar";
import { DataProvider } from "@/lib/DataContext";

// Auth screens render bare: no navigation to somewhere you can't go yet, and
// crucially no DataProvider — it fetches the ledger on mount, which would fire
// two guaranteed 401s and flash an error before you've even signed in.
const BARE_ROUTES = new Set(["/login"]);

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (BARE_ROUTES.has(pathname)) return <>{children}</>;

  return (
    <DataProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <MobileTopBar />
          {/* Bottom padding clears the fixed tab bar (h-14) plus the iOS
              home-indicator inset; from `md` up there's no bar to clear. */}
          <main className="flex-1 min-w-0 pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">{children}</main>
        </div>
      </div>
      <MobileTabBar />
    </DataProvider>
  );
}
