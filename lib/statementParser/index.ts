// Public entry point — re-exports the pure parsing core (parse.ts) plus the
// browser-facing file reader (extract.ts) so existing `@/lib/statementParser`
// imports keep working unchanged after the split.

import { extractRows } from "@/lib/statementParser/extract";
import { extractTransactionsFromRows } from "@/lib/statementParser/parse";
import type { ParsedStatement } from "@/lib/types";

export { cleanDescription, extractTransactionsFromRows, resolveAccountLabel } from "@/lib/statementParser/parse";
export { extractRows } from "@/lib/statementParser/extract";
export type { StatementRow } from "@/lib/statementParser/extract";

export async function parseStatementFile(file: File, existingAccounts: string[] = []): Promise<ParsedStatement> {
  const rows = await extractRows(file);
  return extractTransactionsFromRows(rows, existingAccounts);
}
