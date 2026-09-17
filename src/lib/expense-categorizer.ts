// Keyword-based auto-categorizer — suggests a chart-of-accounts expense
// code from a bank transaction description. Always a suggestion, never
// final: nothing posts to the ledger until it's confirmed on the Expenses
// screen, and any row can be recategorized before confirming.
const RULES: { keywords: string[]; accountCode: string }[] = [
  { keywords: ["GOOGLE", "ADOBE", "FIGMA", "MICROSOFT", "DROPBOX", "ZOOM", "CANVA", "CLICKUP", "NOTION", "SIGN.COM", "INSTANT INK", "HP *", "APPLE.COM", "GITHUB", "OPENAI", "ANTHROPIC"], accountCode: "6000" },
  { keywords: ["USPS", "FEDEX", "UPS ", "OFFICE DEPOT", "STAPLES", "AMAZON"], accountCode: "6400" },
  { keywords: ["DELTA", "UNITED AIR", "AIRLINE", "MARRIOTT", "HILTON", "AIRBNB", "UBER", "LYFT"], accountCode: "6500" },
  { keywords: ["RESTAURANT", "STARBUCKS", "DOORDASH", "GRUBHUB", "UBER EATS", "CAFE"], accountCode: "6600" },
  { keywords: ["FPL", "COMCAST", "XFINITY", "AT&T", "VERIZON", "T-MOBILE", "WATER "], accountCode: "6700" },
  { keywords: ["MONTHLY SERVICE FEE", "OVERDRAFT", "ATM FEE", "WIRE FEE", "MAINTENANCE FEE"], accountCode: "6800" },
  { keywords: ["INSURANCE", "GEICO", "STATE FARM", "PROGRESSIVE", "HISCOX"], accountCode: "6200" },
  { keywords: ["ATTORNEY", "LAW OFFICE", "CPA ", "ACCOUNTANT", "LEGALZOOM"], accountCode: "6300" },
  { keywords: ["RENT", "LANDLORD", "PROPERTY MGMT"], accountCode: "6100" },
];

export function suggestAccountCode(description: string): string {
  const upper = description.toUpperCase();
  for (const rule of RULES) {
    if (rule.keywords.some((k) => upper.includes(k))) return rule.accountCode;
  }
  return "6900"; // Other Expense
}
