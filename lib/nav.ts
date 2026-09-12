// Single source of truth for the app's sections, shared by the desktop
// sidebar and the mobile tab bar so the two can never drift apart.
//
// `icon` is an SVG path drawn on a 24x24 viewBox and rendered stroked (never
// filled), so all four read as one consistent set. Icons exist only for the
// mobile tab bar — a text label alone is a small target for a thumb.
export interface NavItem {
  href: string;
  label: string;
  icon: string;
  /**
   * Label for the mobile tab bar, where five tabs share the screen width and
   * a long word would wrap or overflow. Falls back to `label`.
   */
  shortLabel?: string;
}

export const NAV: readonly NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    icon: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  },
  {
    href: "/monthly",
    label: "Monthly",
    icon: "M4 20V11M9.5 20V5M15 20v-6M20.5 20V8",
  },
  {
    href: "/transactions",
    label: "Transactions",
    shortLabel: "Txns",
    icon: "M4 7h13M14 4l3 3-3 3M20 17H7m3 3-3-3 3-3",
  },
  {
    href: "/recurring",
    label: "Recurring",
    icon: "M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6",
  },
  {
    href: "/accounts",
    label: "Accounts",
    icon: "M3 7h18v12H3zM3 11h18M7 15h3",
  },
] as const;
