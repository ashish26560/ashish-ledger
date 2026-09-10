// @vitest-environment node
//
// Node, not jsdom: these exercise Web Crypto (`crypto.subtle`), which jsdom
// doesn't implement.

import { describe, expect, it, vi } from "vitest";
import { createSessionToken, hashPassword, verifyPassword, verifySessionToken } from "@/lib/auth";

const SECRET = "test-secret-that-is-at-least-32-characters-long";

describe("password hashing", () => {
  it("accepts the correct password and rejects a wrong one", async () => {
    const stored = await hashPassword("correct horse battery staple");

    await expect(verifyPassword("correct horse battery staple", stored)).resolves.toBe(true);
    await expect(verifyPassword("Correct horse battery staple", stored)).resolves.toBe(false);
    await expect(verifyPassword("", stored)).resolves.toBe(false);
  });

  it("never stores the password itself", async () => {
    const password = "correct horse battery staple";
    const stored = await hashPassword(password);
    expect(stored).not.toContain(password);
    expect(stored.startsWith("pbkdf2$210000$")).toBe(true);
  });

  it("salts each hash, so identical passwords don't collide in the database", async () => {
    const [a, b] = await Promise.all([hashPassword("same password"), hashPassword("same password")]);
    expect(a).not.toBe(b);
    // Both must still verify — the salt is stored alongside each hash.
    await expect(verifyPassword("same password", a)).resolves.toBe(true);
    await expect(verifyPassword("same password", b)).resolves.toBe(true);
  });

  it("rejects malformed stored hashes instead of throwing", async () => {
    for (const malformed of ["", "not-a-hash", "pbkdf2$abc$salt$hash", "bcrypt$1$2$3", "pbkdf2$1$$"]) {
      await expect(verifyPassword("anything", malformed)).resolves.toBe(false);
    }
  });
});

describe("session tokens", () => {
  const payload = { userId: "user-1", email: "a@example.com", exp: Date.now() + 60_000 };

  it("round-trips a valid token", async () => {
    const token = await createSessionToken(payload, SECRET);
    await expect(verifySessionToken(token, SECRET)).resolves.toMatchObject({
      userId: "user-1",
      email: "a@example.com",
    });
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken(payload, SECRET);
    await expect(
      verifySessionToken(token, "another-secret-that-is-also-32-characters")
    ).resolves.toBeNull();
  });

  it("rejects a tampered payload — the whole point of signing it", async () => {
    const token = await createSessionToken(payload, SECRET);
    const [body, signature] = token.split(".");

    // Re-encode the payload as a different user, keeping the original
    // signature. This is the attack the HMAC exists to stop.
    const forgedBody = Buffer.from(JSON.stringify({ ...payload, userId: "someone-else" }))
      .toString("base64url");
    await expect(verifySessionToken(`${forgedBody}.${signature}`, SECRET)).resolves.toBeNull();

    // And a mangled signature against the real payload.
    await expect(verifySessionToken(`${body}.${"A".repeat(signature.length)}`, SECRET)).resolves.toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await createSessionToken({ ...payload, exp: Date.now() + 1000 }, SECRET);
    await expect(verifySessionToken(token, SECRET)).resolves.not.toBeNull();

    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + 2000);
      await expect(verifySessionToken(token, SECRET)).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects garbage instead of throwing", async () => {
    for (const junk of ["", ".", "no-dot", "a.b", "....."]) {
      await expect(verifySessionToken(junk, SECRET)).resolves.toBeNull();
    }
  });
});
