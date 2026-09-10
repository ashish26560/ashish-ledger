"use client";

import { useEffect, useState } from "react";

// Tailwind's `md` breakpoint, as a number so JS and CSS can't drift.
const MD_BREAKPOINT_PX = 768;

/**
 * True on phone-width viewports.
 *
 * Only for things CSS genuinely can't reach — chiefly Recharts props like
 * axis width and tick font size, which are JS values rather than styles.
 * Anything expressible as a Tailwind `md:` variant should use that instead:
 * this hook returns `false` on the server and during the first client render,
 * so a layout depending on it flashes its desktop form before correcting.
 */
export function useIsCompact(): boolean {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MD_BREAKPOINT_PX - 1}px)`);
    const sync = () => setIsCompact(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  return isCompact;
}
