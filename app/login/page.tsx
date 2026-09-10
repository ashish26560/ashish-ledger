"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";

type Mode = "loading" | "signin" | "setup";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [mode, setMode] = useState<Mode>("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Decides between "sign in" and first-run "create your account". If this
  // check fails (database down, say), fall back to the sign-in form rather
  // than offering to create an account that might already exist.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/status")
      .then((r) => (r.ok ? r.json() : { needsSetup: false }))
      .then((data: { needsSetup?: boolean }) => {
        if (!cancelled) setMode(data.needsSetup ? "setup" : "signin");
      })
      .catch(() => {
        if (!cancelled) setMode("signin");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    // Only when creating the account. A mistyped password you can't see would
    // otherwise lock you out of your own ledger permanently, since there's no
    // reset flow — that's the whole reason to confirm it. Checked here rather
    // than server-side because it's a typo guard, not a security rule: the API
    // has no use for a second copy of the same password.
    if (mode === "setup" && password !== confirmPassword) {
      setError("Those passwords don't match.");
      return;
    }

    setSubmitting(true);

    try {
      const endpoint = mode === "setup" ? "/api/auth/register" : "/api/auth/login";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const body: { error?: string } = await response.json().catch(() => ({}));
        setError(body.error || "Something went wrong. Please try again.");
        return;
      }

      // A full navigation rather than a client-side push, so every provider
      // remounts and picks up the newly-authenticated session.
      window.location.href = next.startsWith("/") ? next : "/";
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const isSetup = mode === "setup";

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 bg-paper">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-display italic text-lg text-ink leading-none">Ashish&apos;s</p>
          <p className="font-display text-3xl text-ink leading-tight">Ledger</p>
        </div>

        <div className="border border-line rounded bg-paperDim/40 p-6">
          {mode === "loading" ? (
            <p className="text-sm text-muted text-center py-6">Loading…</p>
          ) : (
            <>
              <h1 className="font-display text-xl mb-1">{isSetup ? "Create your account" : "Sign in"}</h1>
              <p className="text-sm text-muted mb-5">
                {isSetup
                  ? "This ledger has no account yet. The one you create here becomes the only way in."
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
                    className="w-full border border-line rounded px-3 py-2 text-sm bg-paper"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-xs text-muted mb-1">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete={isSetup ? "new-password" : "current-password"}
                    required
                    minLength={10}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-line rounded px-3 py-2 text-sm bg-paper"
                  />
                  {isSetup && <p className="text-xs text-muted mt-1">At least 10 characters.</p>}
                </div>

                {isSetup && (
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
                      className="w-full border border-line rounded px-3 py-2 text-sm bg-paper"
                    />
                    {/* Live feedback once there's enough typed to judge, so a
                        mismatch surfaces before the submit button is pressed. */}
                    {confirmPassword.length > 0 && confirmPassword !== password && (
                      <p className="text-xs text-rust mt-1">Doesn&apos;t match yet.</p>
                    )}
                  </div>
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
                  {submitting ? "Please wait…" : isSetup ? "Create account" : "Sign in"}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-xs text-muted text-center mt-6">
          Your ledger is private to this account.
        </p>
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
