// Typed client for the app's own API routes. Centralizing the fetch/error
// handling here means DataContext.tsx only has to decide *what* to
// optimistically update, never *how* to parse a response or shape an error
// message — every call site gets the same behavior for free.

import type { ApiErrorBody } from "@/lib/api-response";
import type { AccountBalance, BalancesByAccount, EditableTransactionFields, NewTransaction, Transaction } from "@/lib/types";

export class ApiError extends Error {
  status: number;
  issues?: ApiErrorBody["issues"];

  constructor(message: string, status: number, issues?: ApiErrorBody["issues"]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.issues = issues;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body: ApiErrorBody | null = await res.json().catch(() => null);
    throw new ApiError(body?.error || `Request failed (${res.status}).`, res.status, body?.issues);
  }
  // A 204 or empty body would break `.json()`; none of this app's routes
  // return one today, but this keeps the helper honest if that changes.
  return (await res.json()) as T;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

export function fetchTransactions(): Promise<Transaction[]> {
  return request<Transaction[]>("/api/transactions");
}

export function fetchBalances(): Promise<BalancesByAccount> {
  return request<BalancesByAccount>("/api/balances");
}

export function fetchCurrentUser(): Promise<{ email: string }> {
  return request<{ email: string }>("/api/auth/me");
}

export function createTransactions(transactions: NewTransaction[]): Promise<{ inserted: Transaction[] }> {
  return request("/api/transactions", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ transactions }),
  });
}

export function patchTransaction(id: string, patch: EditableTransactionFields): Promise<{ ok: true }> {
  return request(`/api/transactions/${id}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify(patch),
  });
}

export function deleteTransaction(id: string): Promise<{ ok: true }> {
  return request(`/api/transactions/${id}`, { method: "DELETE" });
}

export function putBalance(account: string, balance: number, asOf: string): Promise<{ ok: true }> {
  const payload: { account: string } & AccountBalance = { account, balance, asOf };
  return request("/api/balances", {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
}
