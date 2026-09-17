"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ScreenHeader from "../../../components/ScreenHeader";

interface AccountOption {
  id: string;
  code: string;
  name: string;
}

interface Expense {
  id: string;
  expense_date: string;
  description: string;
  amount: number;
  status: "uncategorized" | "categorized";
  account_id: string | null;
  accounts: { code: string; name: string } | null;
}

interface ParseResult {
  headers: string[];
  previewRows: string[][];
  rowCount: number;
  detectedMapping: { dateCol: string; descCol: string; amountCol: string; detailsCol?: string } | null;
  detectedFormat: string | null;
}

export default function ExpensesPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [mapping, setMapping] = useState({ dateCol: "", descCol: "", amountCol: "", detailsCol: "" });
  const [importing, setImporting] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [expRes, acctRes] = await Promise.all([
      fetch("/api/expenses").then((r) => r.json()),
      fetch("/api/accounts").then((r) => r.json()),
    ]);
    setExpenses(expRes.expenses || []);
    setAccounts((acctRes.accounts || []).filter((a: any) => a.type === "expense"));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    const res = await fetch("/api/expenses/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csvText: text }),
    });
    const data = await res.json();
    setParseResult(data);
    if (data.detectedMapping) {
      setMapping({
        dateCol: data.detectedMapping.dateCol,
        descCol: data.detectedMapping.descCol,
        amountCol: data.detectedMapping.amountCol,
        detailsCol: data.detectedMapping.detailsCol || "",
      });
    }
  }

  async function handleImport() {
    if (!csvText) return;
    setImporting(true);
    await fetch("/api/expenses/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csvText, mapping }),
    });
    setImporting(false);
    setCsvText(null);
    setParseResult(null);
    if (fileInput.current) fileInput.current.value = "";
    await load();
  }

  async function handleRecategorize(expenseId: string, accountId: string) {
    await fetch(`/api/expenses/${expenseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId }),
    });
    await load();
  }

  async function handleConfirm(expenseId: string) {
    await fetch(`/api/expenses/${expenseId}/confirm`, { method: "POST" });
    await load();
  }

  async function handleConfirmAll() {
    await fetch("/api/expenses/confirm-all", { method: "POST" });
    await load();
  }

  const pending = expenses.filter((e) => e.status === "uncategorized");
  const posted = expenses.filter((e) => e.status === "categorized");

  return (
    <main>
      <ScreenHeader
        sheetCode="EXP-07"
        contextLabel="Imported from your bank"
        title="Expenses"
        actions={
          <>
            <input ref={fileInput} type="file" accept=".csv" onChange={handleFile} style={{ display: "none" }} id="csv-upload" />
            <label htmlFor="csv-upload" className="btn-secondary" style={{ cursor: "pointer" }}>
              Upload CSV
            </label>
            {pending.length > 0 && (
              <button className="btn-primary" onClick={handleConfirmAll}>
                Confirm All ({pending.length})
              </button>
            )}
          </>
        }
      />

      {parseResult && (
        <div className="panel" style={{ padding: 20, marginBottom: "var(--space-group)" }}>
          <div className="panel-title" style={{ marginBottom: 8 }}>
            {parseResult.detectedFormat === "chase" ? "Chase format detected" : "Map your columns"}
          </div>
          <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 0 }}>
            {parseResult.rowCount} rows found. {parseResult.detectedFormat === "chase" ? "Columns matched automatically — confirm below." : "Pick which column is which."}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            {(["dateCol", "descCol", "amountCol"] as const).map((key) => (
              <div key={key}>
                <label className="label">{key === "dateCol" ? "Date column" : key === "descCol" ? "Description column" : "Amount column"}</label>
                <select
                  value={mapping[key]}
                  onChange={(e) => setMapping((m) => ({ ...m, [key]: e.target.value }))}
                  style={{ padding: 8, background: "var(--floor)", color: "var(--text)", border: "1px solid var(--line)", width: "100%" }}
                >
                  <option value="">Select…</option>
                  {parseResult.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <button className="btn-primary" onClick={handleImport} disabled={importing || !mapping.dateCol || !mapping.descCol || !mapping.amountCol}>
            {importing ? "Importing…" : "Import & Categorize"}
          </button>
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--text-dim)" }}>Loading…</p>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="panel" style={{ marginBottom: "var(--space-group)" }}>
              <div className="panel-title" style={{ padding: "16px 20px 0" }}>
                Pending review ({pending.length})
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th className="money">Amount</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((exp) => (
                    <tr key={exp.id}>
                      <td style={{ color: "var(--text-dim)" }}>{exp.expense_date}</td>
                      <td className="table-value">{exp.description}</td>
                      <td>
                        <select
                          value={exp.account_id ?? ""}
                          onChange={(e) => handleRecategorize(exp.id, e.target.value)}
                          style={{ padding: 6, background: "var(--floor)", color: "var(--text)", border: "1px solid var(--line)" }}
                        >
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="money table-value figure">${Number(exp.amount).toFixed(2)}</td>
                      <td>
                        <button className="btn-secondary" onClick={() => handleConfirm(exp.id)} style={{ padding: "6px 12px" }}>
                          Confirm
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="panel">
            <div className="panel-title" style={{ padding: "16px 20px 0" }}>
              Posted ({posted.length})
            </div>
            {posted.length === 0 ? (
              <p style={{ padding: 20, color: "var(--text-dim)" }}>No expenses posted yet.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th className="money">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {posted.map((exp) => (
                    <tr key={exp.id}>
                      <td style={{ color: "var(--text-dim)" }}>{exp.expense_date}</td>
                      <td className="table-value">{exp.description}</td>
                      <td style={{ color: "var(--text-dim)" }}>{exp.accounts?.name ?? "—"}</td>
                      <td className="money table-value figure">${Number(exp.amount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </main>
  );
}
