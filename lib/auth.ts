// Authentication primitives: password hashing and signed session tokens.
//
// Everything here uses Web Crypto (`crypto.subtle`) rather than `node:crypto`
// on purpose. Middleware runs on the Edge runtime, where `node:crypto` isn't
// available, and middleware is exactly where session tokens have to be
// verified. Web Crypto exists in both runtimes, so one module serves both.
//
// Passwords use PBKDF2-HMAC-SHA256 — the only password-grade KDF Web Crypto
// offers. Argon2id or scrypt would be preferable, but both would mean either a
// dependency or code that can't run at the edge. PBKDF2 at a high iteration
// count is a legitimate choice and is what OWASP recommends when it's what you
// have.

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const SESSION_COOKIE = "ledger_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// OWASP's 2023 floor for PBKDF2-HMAC-SHA256. Stored alongside each hash, so
// raising it later doesn't invalidate existing passwords.
const PBKDF2_ITERATIONS = 210_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Returns `Uint8Array<ArrayBuffer>` rather than the default
// `Uint8Array<ArrayBufferLike>`: Web Crypto's `BufferSource` won't accept the
// latter, since it could in principle be backed by a SharedArrayBuffer.
function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Compares two byte strings without short-circuiting on the first difference,
 * so an attacker can't learn how much of a secret they got right by timing the
 * response. Length is compared up front and does leak — that's standard and
 * not useful here, since hash and signature lengths are fixed.
 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

async function pbkdf2(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, KEY_BITS);
  return new Uint8Array(bits);
}

/** Returns `pbkdf2$<iterations>$<salt>$<hash>`, safe to store as-is. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;

  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 1) return false;

  try {
    const salt = fromBase64Url(parts[2]);
    const expected = fromBase64Url(parts[3]);
    const actual = await pbkdf2(password, salt, iterations);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export interface SessionPayload {
  userId: string;
  email: string;
  /** Expiry as epoch milliseconds. */
  exp: number;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
}

/**
 * `<payload>.<signature>`, both base64url. The payload is signed, not
 * encrypted — it holds only a user id and email, and the signature is what
 * stops it being edited. It rides in an httpOnly cookie so page scripts can't
 * read it.
 */
export async function createSessionToken(payload: SessionPayload, secret: string): Promise<string> {
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(body)));
  return `${body}.${toBase64Url(signature)}`;
}

/** Returns the payload only for a token with a valid signature that hasn't expired. */
export async function verifySessionToken(token: string, secret: string): Promise<SessionPayload | null> {
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const body = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  try {
    const key = await hmacKey(secret);
    const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(body)));
    if (!timingSafeEqual(fromBase64Url(signature), expected)) return null;

    const payload = JSON.parse(decoder.decode(fromBase64Url(body))) as SessionPayload;
    if (typeof payload?.userId !== "string" || typeof payload?.exp !== "number") return null;
    if (Date.now() >= payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * The signing secret. Throws rather than falling back to a default — an app
 * that signs sessions with a guessable key is worse than one that refuses to
 * start, because it looks like it's working.
 */
export function requireAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET is missing or too short (needs 32+ characters). Generate one with " +
        "`openssl rand -base64 32` and add it to your Vercel project and .env.development.local."
    );
  }
  return secret;
}
