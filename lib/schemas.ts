// Runtime validation for everything that arrives over HTTP. TypeScript
// types (lib/types.ts) only check the code that *produces* a request body;
// they say nothing about what an API route actually receives on the wire —
// a malformed client, a stale cached bundle, or a deliberately crafted
// request can send anything. These zod schemas are the actual gate.

import { z } from "zod";
import { CATEGORY_ORDER } from "@/lib/categories";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO date (YYYY-MM-DD).");

const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected a 24-hour time (HH:MM).")
  .or(z.literal(""));

const category = z.enum(CATEGORY_ORDER);
const transactionType = z.enum(["Debit", "Credit"]);

// Balance arrives as `""` (unknown) from parts of the UI that predate a
// stricter type, so both `""`, `null`, and a finite number are accepted and
// normalized to `number | null` for the database layer.
const balanceAmount = z
  .union([z.number().finite(), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === "" || v == null ? null : v));

// The full, untruncated bank narration for a statement-imported row (empty
// for manual entries). Capped well above anything a real bank narration
// runs to, just as a sanity bound on the request body.
const fullDescription = z.string().trim().max(500).optional().default("");

// A pot name is typed by hand and used as the join key between transactions,
// so it is trimmed to stop " Goa trip" and "Goa trip" becoming two pots, and
// bounded because it is a label rather than a note. "" means "not in a pot".
const potName = z.string().trim().max(80).optional().default("");

export const newTransactionSchema = z.object({
  Date: isoDate,
  Time: timeString.optional().default(""),
  Account: z.string().trim().min(1, "Account is required."),
  Description: z.string().trim().min(1, "Description is required."),
  FullDescription: fullDescription,
  Category: category.optional().default("Other / Personal Transfer"),
  Subcategory: z.string().trim().optional().default(""),
  Pot: potName,
  Type: transactionType,
  Amount: z.number().finite().positive("Amount must be a positive number."),
  Balance: balanceAmount,
});

export type NewTransactionInput = z.infer<typeof newTransactionSchema>;

export const postTransactionsBodySchema = z.object({
  transactions: z.array(newTransactionSchema).min(1, "Expected a non-empty `transactions` array."),
});

// Only these fields are ever edited from the UI (category correction being
// the common case) — whitelisted here too, on top of the DB layer's own
// column whitelist, so a malformed/extra field is rejected before it gets
// anywhere near SQL.
export const patchTransactionBodySchema = z
  .object({
    Date: isoDate,
    Time: timeString,
    Account: z.string().trim().min(1),
    Description: z.string().trim().min(1),
    FullDescription: z.string().trim().max(500),
    Category: category,
    Subcategory: z.string().trim(),
    Pot: z.string().trim().max(80),
    Type: transactionType,
    Amount: z.number().finite().positive(),
    Balance: balanceAmount,
  })
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "No editable fields in request body.",
  });

export type PatchTransactionInput = z.infer<typeof patchTransactionBodySchema>;

export const putBalanceBodySchema = z.object({
  account: z.string().trim().min(1),
  balance: z.number().finite(),
  asOf: isoDate,
});

export type PutBalanceInput = z.infer<typeof putBalanceBodySchema>;

// Sign-in / first-user setup. The password floor is deliberately modest —
// this gate exists to keep strangers out of one person's ledger, and a rule
// strict enough to be annoying just pushes people toward reuse.
export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(10, "Use at least 10 characters.").max(200),
});

export type CredentialsInput = z.infer<typeof credentialsSchema>;

// Registration additionally carries the invite code. It's checked against the
// server's SIGNUP_INVITE_CODE — this schema only guarantees one was supplied.
export const registerSchema = credentialsSchema.extend({
  inviteCode: z.string().min(1, "An invite code is required."),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: z.string().min(10, "Use at least 10 characters.").max(200),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
