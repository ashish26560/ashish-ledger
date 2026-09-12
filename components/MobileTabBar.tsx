"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "@/lib/nav";

// Thumb-reachable navigation for phones, hidden from `md` up where the
// sidebar takes over. Pinned to the bottom with the iOS home-indicator inset
// added as padding, so the last row of content is never sat on by the bar.
export default function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-paperDim border-t border-line pb-[env(safe-area-inset-bottom)]"
      aria-label="Main"
    >
      <ul className="flex">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-1 h-14 text-[10.5px] whitespace-nowrap transition-colors ${
                  active ? "text-forestDeep" : "text-muted"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={active ? 2 : 1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d={item.icon} />
                </svg>
                <span className={active ? "font-medium" : undefined}>{item.shortLabel ?? item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
