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
  lines: JournalLineInput[],
  isTest = false
): Promise<string> {
  const totalDebit = Math.round(lines.reduce((s, l) => s + (l.debit || 0), 0) * 100) / 100;
  const totalCredit = Math.round(lines.reduce((s, l) => s + (l.credit || 0), 0) * 100) / 100;
  if (totalDebit !== totalCredit) {
    throw new Error(`Unbalanced journal entry: debits ${totalDebit} !== credits ${totalCredit} (${description})`);
  }

  const accountIds = await getAccountIdMap();

  const { data: entry, error: entryError } = await supabaseAdmin
    .from("journal_entries")
    .insert({ entry_date: entryDate, description, source_type: sourceType, source_id: sourceId, is_test: isTest })
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

export interface JournalLineRow {
  account_id: string;
  debit: number;
  credit: number;
}

// A plain `.select()` on journal_lines silently caps at Supabase/PostgREST's
// default 1000-row response limit — invisible until an account crosses that
// many postings, at which point every report reading this table (Balance
// Sheet, P&L, Budget) undercounts without any error. Confirmed live: this
// account's real balance was off by ~$124,900 once journal_lines passed
// 2,000 rows. Every financial report must page through the full result set
// instead of a single unbounded `.select()`.
// Test/simulated entries (payroll and invoice runs generated while exercising
// the app, before real money moves) are excluded by default so every report
// reflects only what's actually happened — pass includeTest to opt in.
export async function fetchAllJournalLines(
  opts: { gte?: string; lte?: string; includeTest?: boolean } = {}
): Promise<JournalLineRow[]> {
  const pageSize = 1000;
  const rows: JournalLineRow[] = [];
  let from = 0;
  for (;;) {
    let query = supabaseAdmin
      .from("journal_lines")
      .select("account_id, debit, credit, journal_entries!inner(entry_date, is_test)")
      .range(from, from + pageSize - 1);
    if (!opts.includeTest) query = query.eq("journal_entries.is_test", false);
    if (opts.gte) query = query.gte("journal_entries.entry_date", opts.gte);
    if (opts.lte) query = query.lte("journal_entries.entry_date", opts.lte);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    rows.push(...((data || []) as unknown as JournalLineRow[]));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}
