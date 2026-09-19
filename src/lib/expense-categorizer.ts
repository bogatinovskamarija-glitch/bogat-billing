// Keyword-based auto-categorizer — suggests a chart-of-accounts code from a
// bank transaction description, separately for money-out and money-in rows
// (direction itself always comes from the sign of the amount, never from
// this categorizer or the bank's own DEBIT/CREDIT label — see import/route.ts).
// Always a suggestion, never final: nothing posts to the ledger until it's
// confirmed on the Expenses screen, and any row can be recategorized first.
const OUT_RULES: { keywords: string[]; accountCode: string }[] = [
  {
    keywords: [
      "GOOGLE", "ADOBE", "FIGMA", "MICROSOFT", "DROPBOX", "ZOOM", "CANVA", "CLICKUP", "NOTION", "SIGN.COM",
      "INSTANT INK", "HP *", "APPLE.COM", "GITHUB", "OPENAI", "ANTHROPIC", "AUTODESK", "TOGGL.COM", "PICTORY",
      "NETFLIX", "KINDLE SVCS", "PRIME VIDEO", "MINDSIGHTST", "WEARE* MEMBERSHIP", "LEXISNEXIS", "DAT SOLUTIONS",
      "BYTEDANCE", "INTSIG",
    ],
    accountCode: "6000",
  },
  { keywords: ["USPS", "FEDEX", "UPS ", "OFFICE DEPOT", "STAPLES"], accountCode: "6400" },
  { keywords: ["AMAZON"], accountCode: "6410" }, // matches the "Amazon - Supplies & Equipment" split used in the real bank reconciliation
  { keywords: ["DELTA", "UNITED AIR", "AIRLINE", "MARRIOTT", "HILTON", "AIRBNB", "UBER", "LYFT"], accountCode: "6500" },
  { keywords: ["RESTAURANT", "STARBUCKS", "DOORDASH", "GRUBHUB", "UBER EATS", "CAFE", "NESPRESSO", "PARTHENONFO", "ICEBOX", "EDDIE V"], accountCode: "6600" },
  { keywords: ["FPL", "COMCAST", "XFINITY", "AT&T", "VERIZON", "T-MOBILE", "WATER "], accountCode: "6700" },
  { keywords: ["MONTHLY SERVICE FEE", "ATM FEE", "WIRE FEE", "MAINTENANCE FEE"], accountCode: "6800" },
  { keywords: ["OVERDRAFT"], accountCode: "6810" },
  { keywords: ["FOREIGN EXCHANGE"], accountCode: "6820" },
  { keywords: ["INSURANCE", "GEICO", "STATE FARM", "PROGRESSIVE", "HISCOX"], accountCode: "6200" },
  { keywords: ["ATTORNEY", "LAW OFFICE", "CPA ", "ACCOUNTANT", "LEGALZOOM"], accountCode: "6300" },
  { keywords: ["NCARB", "SUNBIZ", "BUILDNER"], accountCode: "6310" },
  { keywords: ["FACEBOOK", "METAPLATFOR", "FACEBK"], accountCode: "6150" },
  { keywords: ["TRUCK UNLOAD", "A1LUMPERS"], accountCode: "6450" },
  { keywords: ["RENT", "LANDLORD", "PROPERTY MGMT"], accountCode: "6100" },
  { keywords: ["SHEIN", "MACYS", "FASHIONNOVA", "BABYBOO", "ETSY", "MEDSTOP"], accountCode: "3100" }, // Personal spend on the business card — treated as owner draw, not an expense
  { keywords: ["ZELLE PAYMENT TO", "ZELLE TO"], accountCode: "3100" }, // Member Draws
];

// A description matching one of these while amount > 0 is a refund of an
// earlier charge (e.g. "Autodesk ... $336" coming back) — crediting the
// same expense account it would have debited is the correct contra-expense
// treatment, so refunds share the OUT_RULES keyword set rather than getting
// their own.
const IN_RULES: { keywords: string[]; accountCode: string }[] = [
  { keywords: ["ZELLE PAYMENT FROM", "ZELLE FROM"], accountCode: "3000" }, // Member Equity (contribution)
  { keywords: ["UPWORK"], accountCode: "4200" },
];

export function suggestAccountCode(description: string, direction: "in" | "out" = "out"): string {
  const upper = description.toUpperCase();
  if (direction === "in") {
    for (const rule of IN_RULES) {
      if (rule.keywords.some((k) => upper.includes(k))) return rule.accountCode;
    }
    for (const rule of OUT_RULES) {
      if (rule.keywords.some((k) => upper.includes(k))) return rule.accountCode; // likely a refund
    }
    return "4900"; // Other Income — needs a human to confirm what this actually is
  }
  for (const rule of OUT_RULES) {
    if (rule.keywords.some((k) => upper.includes(k))) return rule.accountCode;
  }
  return "6900"; // Other Expense
}
