"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { APP_NAME } from "@/lib/branding";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [creating, setCreating] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Whether to offer "create an account" at all. Signing in is always the
  // default — registration is the exception, not the landing state.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/status")
      .then((r) => (r.ok ? r.json() : { registrationOpen: false }))
      .then((data: { registrationOpen?: boolean }) => {
        if (!cancelled) setRegistrationOpen(Boolean(data.registrationOpen));
      })
      .catch(() => {
        if (!cancelled) setRegistrationOpen(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function switchMode(toCreating: boolean) {
    setCreating(toCreating);
    setError("");
    setPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    // Only when creating. A mistyped password you can't see would otherwise
    // lock you out for good, since there's no self-service reset.
    if (creating && password !== confirmPassword) {
      setError("Those passwords don't match.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(creating ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creating ? { email, password, inviteCode } : { email, password }),
      });

      if (!response.ok) {
        const body: { error?: string } = await response.json().catch(() => ({}));
        setError(body.error || "Something went wrong. Please try again.");
        return;
      }

      // Full navigation so every provider remounts against the new session.
      window.location.href = next.startsWith("/") ? next : "/";
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = "w-full border border-line rounded px-3 py-2 text-sm bg-paper";

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 bg-paper">
      <div className="w-full max-w-sm">
        <p className="font-display text-3xl text-ink leading-tight text-center mb-8">{APP_NAME}</p>

        <div className="border border-line rounded bg-paperDim/40 p-6">
          <h1 className="font-display text-xl mb-1">{creating ? "Create an account" : "Sign in"}</h1>
          <p className="text-sm text-muted mb-5">
            {creating
              ? "You'll need the invite code for this ledger."
              : "Enter your details to open your ledger."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs text-muted mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs text-muted mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete={creating ? "new-password" : "current-password"}
                required
                minLength={creating ? 10 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
              {creating && <p className="text-xs text-muted mt-1">At least 10 characters.</p>}
            </div>

            {creating && (
              <>
                <div>
                  <label htmlFor="confirmPassword" className="block text-xs text-muted mb-1">
                    Confirm password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={10}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    aria-invalid={confirmPassword.length > 0 && confirmPassword !== password}
                    className={inputClass}
                  />
                  {confirmPassword.length > 0 && confirmPassword !== password && (
                    <p className="text-xs text-rust mt-1">Doesn&apos;t match yet.</p>
                  )}
                </div>

                <div>
                  <label htmlFor="inviteCode" className="block text-xs text-muted mb-1">
                    Invite code
                  </label>
                  <input
                    id="inviteCode"
                    type="text"
                    autoComplete="off"
                    required
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </>
            )}

            {error && (
              <p role="alert" className="border border-rust/40 bg-rust/5 text-rust rounded px-3 py-2 text-sm">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-forest text-paper rounded py-2.5 text-sm hover:bg-forestDeep active:bg-forestDeep transition-colors disabled:opacity-50"
            >
              {submitting ? "Please wait…" : creating ? "Create account" : "Sign in"}
            </button>
          </form>

          {registrationOpen && (
            <p className="text-sm text-muted mt-5 pt-4 border-t border-line text-center">
              {creating ? "Already have an account?" : "Have an invite code?"}{" "}
              <button
                type="button"
                onClick={() => switchMode(!creating)}
                className="text-forestDeep underline underline-offset-2"
              >
                {creating ? "Sign in" : "Create an account"}
              </button>
            </p>
          )}
        </div>

        <p className="text-xs text-muted text-center mt-6">Your ledger is private to your account.</p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary to keep this page prerenderable.
  return (
    <Suspense fallback={<main className="min-h-screen bg-paper" />}>
      <LoginForm />
    </Suspense>
  );
}
