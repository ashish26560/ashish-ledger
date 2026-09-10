"use client";

import { useState } from "react";

interface SignOutButtonProps {
  className?: string;
  /** Render just the icon (used in the cramped mobile header). */
  iconOnly?: boolean;
}

export default function SignOutButton({ className = "", iconOnly = false }: SignOutButtonProps) {
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Even if the request fails, send the user to the sign-in screen — the
      // cookie may already be gone, and stranding them here helps no one.
    }
    // Full navigation so every provider drops the ledger it has in memory.
    window.location.href = "/login";
  }

  return (
    <button type="button" onClick={signOut} disabled={busy} className={className} aria-label="Sign out">
      {iconOnly ? (
        <svg
          viewBox="0 0 24 24"
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
        </svg>
      ) : busy ? (
        "Signing out…"
      ) : (
        "Sign out"
      )}
    </button>
  );
}
