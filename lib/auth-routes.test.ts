// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE, hashPassword, verifySessionToken } from "@/lib/auth";

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
  it("creates the first account and signs it in", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    queue.push([{ id: "u1", email: "a@example.com" }]); // insert succeeded

    const response = await POST(jsonRequest("http://localhost/api/auth/register", {
      email: "a@example.com",
      password: "a good password",
    }));

    expect(response.status).toBe(201);
    expect(sessionCookieFrom(response)).toBeDefined();
  });

  it("refuses once an account exists — this endpoint is open by necessity", async () => {
    const { POST } = await import("@/app/api/auth/register/route");
    // The INSERT ... WHERE NOT EXISTS returns no rows when a user is present.
    queue.push([]);

    const response = await POST(jsonRequest("http://localhost/api/auth/register", {
      email: "intruder@example.com",
      password: "a good password",
    }));

    expect(response.status).toBe(403);
    expect(sessionCookieFrom(response)).toBeUndefined();
  });

  it("rejects a too-short password before it ever reaches the database", async () => {
    const { POST } = await import("@/app/api/auth/register/route");

    const response = await POST(jsonRequest("http://localhost/api/auth/register", {
      email: "a@example.com",
      password: "short",
    }));

    expect(response.status).toBe(400);
    expect(sqlMock).not.toHaveBeenCalled();
  });
});
