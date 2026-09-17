// Named constants for the ClickUp list/folder/status/field IDs this app reads
// and writes. Every ID below was read directly from the live workspace via
// clickup_get_custom_fields — none are guessed. Re-verify with that tool if
// a field is ever renamed/recreated in ClickUp (recreating a field changes
// its ID even if the name is unchanged).

export const CLICKUP_TEAM_ID = process.env.CLICKUP_TEAM_ID || "9006080499";

export const LISTS = {
  invoices: process.env.CLICKUP_INVOICES_LIST_ID || "901317966819",
  projects: process.env.CLICKUP_PROJECTS_LIST_ID || "901307244510",
  crm: process.env.CLICKUP_CRM_LIST_ID || "901314847597",
  leads: process.env.CLICKUP_LEADS_LIST_ID || "901326738812",
};

export const FOLDERS = {
  activeProjects: process.env.CLICKUP_ACTIVE_PROJECTS_FOLDER_ID || "901311447111",
  completedProjects: process.env.CLICKUP_COMPLETED_PROJECTS_FOLDER_ID || "90130302578",
};

// A task in an Active/Completed Projects list is a billing candidate once
// it's moved to this status (confirmed with Maria — not "complete").
export const BILLING_READY_STATUS = "bill";

// Custom field IDs on the Invoices list (901317966819).
export const INVOICE_FIELDS = {
  paymentStatus: "031972ab-aff3-4968-acc8-74a942df02a4", // drop_down
  relatedProject: "a0cb2c2f-c0d7-4698-9dad-96043c89cd82", // list_relationship -> Projects list
  client: "0bfbb62b-1fc7-4136-a35b-74941be2592f", // type "url" — NOT a name field, see note below
  contactName: "06a59637-85e2-48d4-b449-1a15e2ad49df", // short_text
  companyName: "28202d1c-add5-424b-a008-df4c2ac27394", // short_text
  totalAmount: "3c313991-bbb5-4377-9b70-47c9bc408a83", // currency — canonical amount field (default choice; see plan open item)
  invoiceAmount: "5c5bd7a8-789c-40d2-9ddc-6bb58bab215f", // currency, unused by default
  invoiceAmountPreTax: "7cfc0a80-270d-4baf-a273-52392653b1bb", // currency, unused by default
  invoiceDate: "71767666-406b-4bfc-9da5-18e843108deb", // date
  dueDate: "81f4b91a-9ab5-4db3-857b-83f4a4440b16", // date
  sentDate: "53544d48-7bf2-49e7-867b-dcf1ac219134", // date
  paymentDate: "4f93ec5e-d7c5-42c8-809a-3a241c746604", // date
  billingType: "69b0fdc1-0c56-49cb-93b1-7ddbc8f752d6", // drop_down
  waveInvoiceId: "2f710595-038a-42a6-88c5-49c51b5ccca8", // legacy — never written by this app
} as const;

// NOTE: the "Client" field (0bfbb62b-...) is typed "url" in ClickUp, not a
// relationship or text field — it looks like it was meant to hold a link
// (e.g. to the client's CRM task) rather than the client's name. Use
// contactName/companyName for the human-readable identity; only populate
// `client` if you have an actual ClickUp URL to point it at.

// Payment Status dropdown option IDs (required to PATCH the field — ClickUp
// custom-field writes need the option UUID, not its label).
export const PAYMENT_STATUS_OPTIONS = {
  draft: "d4e8fd70-e7f2-409c-8ff1-9354369a0d00", // "Draft — not sent"
  sent: "c712ea6e-3cdf-4fb3-81af-10fb01b874b8", // "Sent — awaiting payment"
  viewed: "023b8c0a-50e3-49b8-8761-a105a00c8410", // "Viewed — client opened"
  partiallyPaid: "7c5bdaba-d09e-4a0c-b26f-8b79d0eb5933", // "Partially Paid"
  paidInFull: "73afd679-2b85-4df2-83af-4a25149561f2", // "Paid in Full"
  overdue: "471ebe0b-5a39-478f-9582-cc465e264a27", // "Overdue — past due date"
  disputed: "f7c35fc5-9c8e-406e-a06a-6439006d6052", // "Disputed — client contest"
  void: "2f1e0416-8e2c-4881-850b-75a3722a9fff", // "Void — cancelled"
} as const;

// Custom field IDs on the Projects list (901307244510) summary tasks —
// task_type "Project", one task per engagement.
export const PROJECT_SUMMARY_FIELDS = {
  clientRelationship: "a9be5810-77c3-4f6e-a7a7-ed736c701cb1", // list_relationship -> CRM list 901314847597
  hourlyRate: "280c8f26-b672-492a-afcf-55cfdb25ce38", // currency
  currentPhase: "37df25ed-29f8-42a2-b783-c82e856a1147", // drop_down
  billingModel: "a220da7a-375b-4ed9-8389-9785726d007f", // drop_down
  contractValue: "9bfc010c-591a-4311-987e-f43673f2a336", // currency
} as const;

// "Billing Model" dropdown option IDs (PROJECT_SUMMARY_FIELDS.billingModel) —
// mapped to this app's internal `projects.billing_type` values. Percentage of
// Construction Cost and Hybrid Phase-Based both map to percentage_phase;
// fixed_fee/retainer/pro_bono sync and display but don't get Billing Board
// treatment yet (only hourly and percentage_phase have real logic so far).
export const BILLING_MODEL_OPTIONS: Record<string, string> = {
  "673d4bec-ecd0-4f91-a919-4a56799ccc97": "hourly", // Hourly
  "36b9dea8-f8f4-4ec2-948c-e2f6327d2dad": "fixed_fee", // Fixed Fee Lump Sum
  "aac7d309-57c5-4fae-86df-10064217bd89": "percentage_phase", // Percentage of Construction Cost
  "0ae33715-8021-4e45-8e3a-4b5c4e03d505": "percentage_phase", // Hybrid Phase-Based Fixed Plus Hourly CA
  "d2fc87a8-eb14-4db1-b1f5-209a191cadb4": "retainer", // Retainer
  "35a69505-8ec3-435e-9fe2-db00bbf03a75": "pro_bono", // Pro Bono
  "b2603325-3db2-4e23-9a22-35adfc713d3e": "pro_bono", // Speculative / No Fee
};

// Default AIA-style phase breakdown seeded onto a project the moment it's
// set to percentage_phase — edited per-project to match the actual signed
// fee agreement, since real contracts vary.
export const DEFAULT_PHASE_BREAKDOWN: { phaseName: string; percentOfContract: number }[] = [
  { phaseName: "Pre-Design", percentOfContract: 5 },
  { phaseName: "Schematic Design", percentOfContract: 15 },
  { phaseName: "Design Development", percentOfContract: 20 },
  { phaseName: "Construction Documents", percentOfContract: 30 },
  { phaseName: "Permitting", percentOfContract: 5 },
  { phaseName: "Bidding", percentOfContract: 5 },
  { phaseName: "Construction Administration", percentOfContract: 20 },
];

// Custom field IDs on the CRM list (901314847597) — task_type "Client Account".
export const CRM_FIELDS = {
  clientStatus: "e2ef60f1-51b5-4c1b-9a4f-ea4e40d5ceb5", // drop_down
  clientType: "93ae047f-93fa-4276-ba15-4a4f56b336bc", // drop_down
  companyName: "28202d1c-add5-424b-a008-df4c2ac27394", // short_text
  primaryContact: "65f021b0-76cd-4a87-a980-b24c9cf48b02", // short_text
  totalRevenueLifetime: "035d7577-5231-41e9-b937-aa687d874d47", // currency
} as const;

// Custom field IDs on the Leads list (901326738812) — task_type "Lead".
export const LEADS_FIELDS = {
  companyClientName: "e6e3fa63-2d9d-4c9b-8c5c-bb26fb66dd57", // short_text
  contactName: "06a59637-85e2-48d4-b449-1a15e2ad49df", // short_text
  estimatedBudget: "e2e21b1b-3314-4003-a0f5-798553da1b5e", // currency
  leadSource: "e8161012-8083-4a2d-a54c-150e08474eda", // drop_down
} as const;

// New Folder-level fields this app adds in Phase D so every task in both
// project folders — present and future — carries a billing marker without
// per-project setup. Empty until created in ClickUp (see plan Phase D);
// creating them assigns real IDs to fill in here.
export const PROJECT_TASK_FIELDS = {
  invoiced: "", // checkbox field, to be created on Active/Completed Projects folders
  invoiceNumber: "", // text field, to be created on the same two folders
};
