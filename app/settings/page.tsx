"use client";

import { useState, type FormEvent } from "react";
import { useLedger } from "@/lib/DataContext";
import SignOutButton from "@/components/SignOutButton";

export default function SettingsPage() {
  const { email } = useLedger();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaved(false);

    if (newPassword !== confirmPassword) {
      setError("Those passwords don't match.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("That's the password you already have.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!response.ok) {
        const body: { error?: string } = await response.json().catch(() => ({}));
        setError(body.error || "Couldn't change your password. Please try again.");
        return;
      }

      setSaved(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = "w-full border border-line rounded px-3 py-2 text-sm bg-paper";

  return (
    <div className="px-4 md:px-10 py-6 md:py-8 max-w-md">
      <header className="mb-5 md:mb-6">
        <h1 className="font-display text-2xl md:text-3xl">Settings</h1>
        <p className="text-sm text-muted mt-1">Signed in as {email || "…"}</p>
      </header>

      <section className="border border-line rounded bg-paper p-4 md:p-5 mb-6">
        <h2 className="font-display text-lg mb-1">Change password</h2>
        <p className="text-xs text-muted mb-4">
          Your current password is required. Other devices you&apos;re signed in on stay signed in until
          their session expires.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="currentPassword" className="block text-xs text-muted mb-1">
              Current password
            </label>
            <input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="newPassword" className="block text-xs text-muted mb-1">
              New password
            </label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
            />
            <p className="text-xs text-muted mt-1">At least 10 characters.</p>
          </div>

          <div>
            <label htmlFor="confirmNewPassword" className="block text-xs text-muted mb-1">
              Confirm new password
            </label>
            <input
              id="confirmNewPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              aria-invalid={confirmPassword.length > 0 && confirmPassword !== newPassword}
              className={inputClass}
            />
            {confirmPassword.length > 0 && confirmPassword !== newPassword && (
              <p className="text-xs text-rust mt-1">Doesn&apos;t match yet.</p>
            )}
          </div>

          {error && (
            <p role="alert" className="border border-rust/40 bg-rust/5 text-rust rounded px-3 py-2 text-sm">
              {error}
            </p>
          )}
          {saved && (
            <p role="status" className="border border-forest/30 bg-forest/5 text-forestDeep rounded px-3 py-2 text-sm">
              Password changed.
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-forest text-paper rounded py-2.5 text-sm hover:bg-forestDeep active:bg-forestDeep transition-colors disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Change password"}
          </button>
        </form>
      </section>

      <section className="border border-line rounded bg-paper p-4 md:p-5">
        <h2 className="font-display text-lg mb-3">Session</h2>
        <SignOutButton className="border border-line rounded px-4 py-2 text-sm hover:bg-paperDim/60 active:bg-paperDim transition-colors" />
      </section>
    </div>
  );
}
