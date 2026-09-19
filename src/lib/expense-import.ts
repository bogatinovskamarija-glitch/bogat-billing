// Pure helpers pulled out of the CSV import route so the two decisions that
// actually caused the original balance-sheet corruption — which way money
// moved, and whether a row has already been imported — are unit-testable
// on their own, not just exercised by hand through the UI.

export function parseImportDate(raw: string): string | null {
  // Handles M/D/YYYY (Chase) and YYYY-MM-DD alike.
  const mdY = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdY) return `${mdY[3]}-${mdY[1].padStart(2, "0")}-${mdY[2].padStart(2, "0")}`;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return raw.slice(0, 10);
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

// The sign of the amount is the only trustworthy signal for direction — a
// bank's own DEBIT/CREDIT label has been observed to disagree with it
// (refunds posted as "DEBIT" with a positive amount). Never take a
// direction hint from anything but this.
export function directionFromAmount(amount: number): "in" | "out" {
  return amount < 0 ? "out" : "in";
}

export function dedupeKey(expenseDate: string, description: string, absAmount: number): string {
  return `${expenseDate}|${description}|${absAmount.toFixed(2)}`;
}
