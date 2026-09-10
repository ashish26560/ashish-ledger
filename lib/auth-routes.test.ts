// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE, createSessionToken, hashPassword, verifySessionToken } from "@/lib/auth";

const SECRET = "test-secret-that-is-at-least-32-characters-long";

// The routes talk to Postgres through a tagged-template `sql`. This stands in
// for it: each test queues the rows the next query should return, so the route
// logic can be exercised without a database.
const { sqlMock, queue } = vi.hoisted(() => {
  const queue: unknown[][] = [];
  const sqlMock = vi.fn(async () => queue.shift() ?? []);
  return { sqlMock, queue };
});

vi.mock("@/lib/db", () => ({ sql: sqlMock }));

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function sessionCookieFrom(response: Response): string | undefined {
  return response.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));
}

beforeEach(() => {
  queue.length = 0;
  sqlMock.mockClear();
  process.env.AUTH_SECRET = SECRET;
});

afterEach(() => {
  delete process.env.AUTH_SECRET;
  delete process.env.SIGNUP_INVITE_CODE;
});

describe("POST /api/auth/login", () => {
  it("issues a signed, httpOnly session cookie for correct credentials", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    queue.push([{ id: "u1", email: "a@example.com", password_hash: await hashPassword("a good password") }]);

    const response = await POST(jsonRequest("http://localhost/api/auth/login", {
      email: "a@example.com",
      password: "a good password",
    }));

    expect(response.status).toBe(200);

    const cookie = sessionCookieFrom(response);
    expect(cookie).toBeDefined();
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=lax");

    const token = cookie!.slice(cookie!.indexOf("=") + 1).split(";")[0];
    await expect(verifySessionToken(decodeURIComponent(token), SECRET)).resolves.toMatchObject({
      userId: "u1",
      email: "a@example.com",
    });
  });

  it("rejects a wrong password without issuing a cookie", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    queue.push([{ id: "u1", email: "a@example.com", password_hash: await hashPassword("a good password") }]);

    const response = await POST(jsonRequest("http://localhost/api/auth/login", {
      email: "a@example.com",
      password: "the wrong password",
    }));

    expect(response.status).toBe(401);
    expect(sessionCookieFrom(response)).toBeUndefined();
  });

  it("gives the same answer for an unknown email, so accounts can't be enumerated", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    queue.push([]); // no such user

    const response = await POST(jsonRequest("http://localhost/api/auth/login", {
      email: "nobody@example.com",
      password: "a good password",
    }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Incorrect email or password." });
    expect(sessionCookieFrom(response)).toBeUndefined();
  });
});

describe("POST /api/auth/register", () => {
  const VALID_CODE = "let-me-in-please";

  it("creates an account when the invite code matches", async () => {
    process.env.SIGNUP_INVITE_CODE = VALID_CODE;
    const { POST } = await import("@/app/api/auth/register/route");
    queue.push([{ id: "u1", email: "a@example.com" }]);

    const response = await POST(jsonRequest("http://localhost/api/auth/register", {
      email: "a@example.com",
      password: "a good password",
      inviteCode: VALID_CODE,
    }));

    expect(response.status).toBe(201);
    expect(sessionCookieFrom(response)).toBeDefined();
  });

  it("refuses a wrong invite code without touching the database", async () => {
    process.env.SIGNUP_INVITE_CODE = VALID_CODE;
    const { POST } = await import("@/app/api/auth/register/route");

    const response = await POST(jsonRequest("http://localhost/api/auth/register", {
      email: "intruder@example.com",
      password: "a good password",
      inviteCode: "guessing",
    }));

    expect(response.status).toBe(403);
    expect(sqlMock).not.toHaveBeenCalled();
    expect(sessionCookieFrom(response)).toBeUndefined();
  });

  it("is closed entirely when no invite code is configured — open by default would be wrong", async () => {
    delete process.env.SIGNUP_INVITE_CODE;
    const { POST } = await import("@/app/api/auth/register/route");

    const response = await POST(jsonRequest("http://localhost/api/auth/register", {
      email: "anyone@example.com",
      password: "a good password",
      inviteCode: "anything",
    }));

    expect(response.status).toBe(403);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("reports a duplicate email as a conflict rather than a server error", async () => {
    process.env.SIGNUP_INVITE_CODE = VALID_CODE;
    const { POST } = await import("@/app/api/auth/register/route");
    queue.push([]); // ON CONFLICT DO NOTHING returned no row

    const response = await POST(jsonRequest("http://localhost/api/auth/register", {
      email: "taken@example.com",
      password: "a good password",
      inviteCode: VALID_CODE,
    }));

    expect(response.status).toBe(409);
  });

  it("rejects a too-short password before it ever reaches the database", async () => {
    process.env.SIGNUP_INVITE_CODE = VALID_CODE;
    const { POST } = await import("@/app/api/auth/register/route");

    const response = await POST(jsonRequest("http://localhost/api/auth/register", {
      email: "a@example.com",
      password: "short",
      inviteCode: VALID_CODE,
    }));

    expect(response.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/password", () => {
  const { cookieStore } = vi.hoisted(() => ({ cookieStore: { value: undefined as string | undefined } }));
  vi.mock("next/headers", () => ({
    cookies: () => ({
      get: (name: string) =>
        name === SESSION_COOKIE && cookieStore.value ? { value: cookieStore.value } : undefined,
    }),
  }));

  async function signIn() {
    cookieStore.value = await createSessionToken(
      { userId: "u1", email: "a@example.com", exp: Date.now() + 60_000 },
      SECRET
    );
  }

  it("refuses an anonymous caller", async () => {
    cookieStore.value = undefined;
    const { POST } = await import("@/app/api/auth/password/route");

    const response = await POST(jsonRequest("http://localhost/api/auth/password", {
      currentPassword: "whatever",
      newPassword: "a brand new password",
    }));

    expect(response.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("refuses when the current password is wrong, and leaves the stored one alone", async () => {
    await signIn();
    queue.push([{ password_hash: await hashPassword("the real password") }]);

    const { POST } = await import("@/app/api/auth/password/route");
    const response = await POST(jsonRequest("http://localhost/api/auth/password", {
      currentPassword: "not the real password",
      newPassword: "a brand new password",
    }));

    expect(response.status).toBe(401);
    // Only the SELECT ran — no UPDATE followed.
    expect(sqlMock).toHaveBeenCalledTimes(1);
  });

  it("updates the hash and re-issues the session when the current password is right", async () => {
    await signIn();
    queue.push([{ password_hash: await hashPassword("the real password") }]);
    queue.push([]); // the UPDATE

    const { POST } = await import("@/app/api/auth/password/route");
    const response = await POST(jsonRequest("http://localhost/api/auth/password", {
      currentPassword: "the real password",
      newPassword: "a brand new password",
    }));

    expect(response.status).toBe(200);
    expect(sqlMock).toHaveBeenCalledTimes(2);
    // Re-issued so changing your password doesn't sign you out of this device.
    expect(sessionCookieFrom(response)).toBeDefined();
  });
});
