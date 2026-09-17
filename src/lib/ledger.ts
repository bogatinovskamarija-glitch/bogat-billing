import { supabaseAdmin } from "./supabase";

export interface JournalLineInput {
  accountCode: string;
  debit?: number;
  credit?: number;
  memo?: string;
}

let accountIdCache: Map<string, string> | null = null;

async function getAccountIdMap(): Promise<Map<string, string>> {
  if (accountIdCache) return accountIdCache;
  const { data } = await supabaseAdmin.from("accounts").select("id, code");
  accountIdCache = new Map((data || []).map((a) => [a.code, a.id]));
  return accountIdCache;
}

// The one real correctness guarantee a ledger gives you: debits must equal
// credits, checked here before anything is written, not assumed by callers.
export async function postJournalEntry(
  entryDate: string,
  description: string,
  sourceType: string,
  sourceId: string | null,
  lines: JournalLineInput[]
): Promise<string> {
  const totalDebit = Math.round(lines.reduce((s, l) => s + (l.debit || 0), 0) * 100) / 100;
  const totalCredit = Math.round(lines.reduce((s, l) => s + (l.credit || 0), 0) * 100) / 100;
  if (totalDebit !== totalCredit) {
    throw new Error(`Unbalanced journal entry: debits ${totalDebit} !== credits ${totalCredit} (${description})`);
  }

  const accountIds = await getAccountIdMap();

  const { data: entry, error: entryError } = await supabaseAdmin
    .from("journal_entries")
    .insert({ entry_date: entryDate, description, source_type: sourceType, source_id: sourceId })
    .select("id")
    .single();
  if (entryError || !entry) throw new Error(entryError?.message || "Failed to create journal entry");

  const rows = lines.map((l) => {
    const accountId = accountIds.get(l.accountCode);
    if (!accountId) throw new Error(`Unknown account code: ${l.accountCode}`);
    return {
      journal_entry_id: entry.id,
      account_id: accountId,
      debit: l.debit || 0,
      credit: l.credit || 0,
      memo: l.memo || null,
    };
  });

  const { error: linesError } = await supabaseAdmin.from("journal_lines").insert(rows);
  if (linesError) throw new Error(linesError.message);

  return entry.id as string;
}
