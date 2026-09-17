"use client";

import { useCallback, useEffect, useState } from "react";
import ScreenHeader from "../../../components/ScreenHeader";

interface Employee {
  id: string;
  name: string;
  email: string | null;
  role_title: string | null;
  employee_type: "w2_hourly" | "w2_salary" | "1099" | "owner_draw";
  pay_frequency: "weekly" | "biweekly" | "monthly";
  clickup_user_id: string | null;
  hourly_rate: number | null;
  billing_rate: number | null;
  annual_salary: number | null;
  filing_status: string;
  dependents_amount_annual: number;
  pretax_401k_percent: number;
  pretax_section125_per_period: number;
  pto_accrual_hours_per_period: number;
  pto_balance_hours: number;
  is_active: boolean;
}

interface PayRun {
  id: string;
  period_start: string;
  period_end: string;
  pay_date: string;
  status: "draft" | "finalized";
}

interface Paystub {
  id: string;
  employee_id: string;
  regular_hours: number;
  overtime_hours: number;
  pto_hours_used: number;
  gross_pay: number;
  federal_income_tax: number;
  social_security_employee: number;
  medicare_employee: number;
  net_pay: number;
  employees: { name: string; role_title: string | null; employee_type: string };
}

const EMPLOYEE_TYPE_LABEL: Record<string, string> = {
  w2_hourly: "W-2 Hourly",
  w2_salary: "W-2 Salary",
  "1099": "1099 Contractor",
  owner_draw: "Owner (Draws)",
};

const PAY_FREQUENCY_LABEL: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
};

function emptyEmployeeForm() {
  return {
    name: "",
    email: "",
    roleTitle: "",
    employeeType: "w2_salary" as Employee["employee_type"],
    payFrequency: "weekly" as Employee["pay_frequency"],
    clickupUserId: "",
    hourlyRate: "",
    billingRate: "",
    annualSalary: "",
    filingStatus: "single",
    dependentsAmountAnnual: "0",
    pretax401kPercent: "0",
    pretaxSection125PerPeriod: "0",
    ptoAccrualHoursPerPeriod: "0",
  };
}

function employeeToForm(e: Employee): ReturnType<typeof emptyEmployeeForm> {
  return {
    name: e.name,
    email: e.email ?? "",
    roleTitle: e.role_title ?? "",
    employeeType: e.employee_type,
    payFrequency: e.pay_frequency ?? "weekly",
    clickupUserId: e.clickup_user_id ?? "",
    hourlyRate: e.hourly_rate?.toString() ?? "",
    billingRate: e.billing_rate?.toString() ?? "",
    annualSalary: e.annual_salary?.toString() ?? "",
    filingStatus: e.filing_status,
    dependentsAmountAnnual: e.dependents_amount_annual?.toString() ?? "0",
    pretax401kPercent: e.pretax_401k_percent?.toString() ?? "0",
    pretaxSection125PerPeriod: e.pretax_section125_per_period?.toString() ?? "0",
    ptoAccrualHoursPerPeriod: e.pto_accrual_hours_per_period?.toString() ?? "0",
  };
}

export default function PayrollPage() {
  const [tab, setTab] = useState<"runs" | "employees">("runs");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [runs, setRuns] = useState<PayRun[]>([]);
  const [activeRun, setActiveRun] = useState<{ run: PayRun; paystubs: Paystub[] } | null>(null);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyEmployeeForm());
  const [creatingRun, setCreatingRun] = useState(false);
  const [showNewRun, setShowNewRun] = useState(false);
  const [runForm, setRunForm] = useState(() => {
    const today = new Date().toISOString().slice(0, 10);
    return { payFrequency: "weekly" as "weekly" | "biweekly" | "monthly", periodStart: today, periodEnd: today, payDate: today };
  });

  const loadEmployees = useCallback(async () => {
    const res = await fetch("/api/employees");
    const data = await res.json();
    setEmployees(data.employees || []);
  }, []);

  const loadRuns = useCallback(async () => {
    const res = await fetch("/api/payroll/runs");
    const data = await res.json();
    setRuns(data.runs || []);
  }, []);

  useEffect(() => {
    loadEmployees();
    loadRuns();
  }, [loadEmployees, loadRuns]);

  async function openRun(runId: string) {
    const res = await fetch(`/api/payroll/runs/${runId}`);
    const data = await res.json();
    setActiveRun(data);
  }

  async function handleCreateRun() {
    setCreatingRun(true);
    const res = await fetch("/api/payroll/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(runForm),
    });
    const data = await res.json();
    setCreatingRun(false);
    setShowNewRun(false);
    await loadRuns();
    if (data.run) openRun(data.run.id);
  }

  const PRESET_DAYS: Record<"weekly" | "biweekly" | "monthly", number> = { weekly: 7, biweekly: 14, monthly: 30 };

  function applyFrequency(freq: "weekly" | "biweekly" | "monthly") {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (PRESET_DAYS[freq] - 1));
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    setRunForm({ payFrequency: freq, periodStart: fmt(start), periodEnd: fmt(end), payDate: fmt(end) });
  }

  async function handleUpdatePto(stubId: string, hours: number) {
    await fetch(`/api/paystubs/${stubId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ptoHoursUsed: hours }),
    });
    if (activeRun) openRun(activeRun.run.id);
  }

  async function handleFinalize() {
    if (!activeRun) return;
    if (!confirm(`Finalize this pay run? ${activeRun.paystubs.length} paystub(s) will be locked and posted to the ledger.`)) return;
    await fetch(`/api/payroll/runs/${activeRun.run.id}/finalize`, { method: "POST" });
    await Promise.all([loadRuns(), openRun(activeRun.run.id)]);
  }

  async function handleSaveEmployee(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...form,
      hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : null,
      billingRate: form.billingRate ? Number(form.billingRate) : null,
      annualSalary: form.annualSalary ? Number(form.annualSalary) : null,
      dependentsAmountAnnual: Number(form.dependentsAmountAnnual),
      pretax401kPercent: Number(form.pretax401kPercent),
      pretaxSection125PerPeriod: Number(form.pretaxSection125PerPeriod),
      ptoAccrualHoursPerPeriod: Number(form.ptoAccrualHoursPerPeriod),
    };
    if (editingId) {
      await fetch(`/api/employees/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setForm(emptyEmployeeForm());
    setShowAddEmployee(false);
    setEditingId(null);
    await loadEmployees();
  }

  function startEdit(emp: Employee) {
    setForm(employeeToForm(emp));
    setEditingId(emp.id);
    setShowAddEmployee(true);
  }

  function startAdd() {
    setForm(emptyEmployeeForm());
    setEditingId(null);
    setShowAddEmployee((s) => !s);
  }

  const inputStyle = { padding: 8, background: "var(--floor)", color: "var(--text)", border: "1px solid var(--line)", width: "100%" };

  return (
    <main>
      <ScreenHeader
        sheetCode="PPL-10"
        contextLabel="Time tracked in ClickUp"
        title="Payroll"
        actions={
          <>
            <button className={`btn-secondary ${tab === "runs" ? "active" : ""}`} onClick={() => setTab("runs")}>
              Pay Runs
            </button>
            <button className={`btn-secondary ${tab === "employees" ? "active" : ""}`} onClick={() => setTab("employees")}>
              Employees
            </button>
          </>
        }
      />

      {tab === "employees" && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <button className="btn-primary" onClick={startAdd}>
              {showAddEmployee ? "Cancel" : "+ Add Employee"}
            </button>
          </div>

          {showAddEmployee && (
            <form onSubmit={handleSaveEmployee} className="panel" style={{ padding: 20, marginBottom: 20, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <label className="label">Name</label>
                <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label className="label">Role / title</label>
                <input value={form.roleTitle} onChange={(e) => setForm((f) => ({ ...f, roleTitle: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label className="label">Employee type</label>
                <select value={form.employeeType} onChange={(e) => setForm((f) => ({ ...f, employeeType: e.target.value as any }))} style={inputStyle}>
                  <option value="w2_salary">W-2 Salary</option>
                  <option value="w2_hourly">W-2 Hourly</option>
                  <option value="1099">1099 Contractor</option>
                  <option value="owner_draw">Owner (Draws) — no paystub</option>
                </select>
                {form.employeeType === "owner_draw" && (
                  <p style={{ fontSize: 11, color: "var(--oxide)", marginTop: 4, marginBottom: 0 }}>
                    This profile is skipped by Pay Runs entirely — no tax withholding, no paystub. Use W-2
                    Hourly or W-2 Salary if you want a real paystub generated.
                  </p>
                )}
              </div>
              <div>
                <label className="label">Pay frequency</label>
                <select value={form.payFrequency} onChange={(e) => setForm((f) => ({ ...f, payFrequency: e.target.value as any }))} style={inputStyle}>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="label">ClickUp user ID (for hourly)</label>
                <input value={form.clickupUserId} onChange={(e) => setForm((f) => ({ ...f, clickupUserId: e.target.value }))} style={inputStyle} placeholder="e.g. 57266783" />
              </div>
              <div>
                <label className="label">Payroll pay rate ($/hr)</label>
                <input type="number" step="0.01" value={form.hourlyRate} onChange={(e) => setForm((f) => ({ ...f, hourlyRate: e.target.value }))} style={inputStyle} />
                <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4, marginBottom: 0 }}>What you pay this employee — used by Payroll.</p>
              </div>
              <div>
                <label className="label">Client billing rate ($/hr)</label>
                <input type="number" step="0.01" value={form.billingRate} onChange={(e) => setForm((f) => ({ ...f, billingRate: e.target.value }))} style={inputStyle} />
                <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4, marginBottom: 0 }}>What clients are charged for this employee's time — used by the Billing Board.</p>
              </div>
              <div>
                <label className="label">Annual salary</label>
                <input type="number" step="0.01" value={form.annualSalary} onChange={(e) => setForm((f) => ({ ...f, annualSalary: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label className="label">Filing status (W-4)</label>
                <select value={form.filingStatus} onChange={(e) => setForm((f) => ({ ...f, filingStatus: e.target.value }))} style={inputStyle}>
                  <option value="single">Single</option>
                  <option value="married_jointly">Married filing jointly</option>
                  <option value="head_of_household">Head of household</option>
                </select>
              </div>
              <div>
                <label className="label">Dependents credit ($/yr, W-4 Step 3)</label>
                <input type="number" step="0.01" value={form.dependentsAmountAnnual} onChange={(e) => setForm((f) => ({ ...f, dependentsAmountAnnual: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label className="label">PTO accrual (hrs/pay period)</label>
                <input type="number" step="0.1" value={form.ptoAccrualHoursPerPeriod} onChange={(e) => setForm((f) => ({ ...f, ptoAccrualHoursPerPeriod: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label className="label">401(k) (% of gross, pre-tax)</label>
                <input type="number" step="0.1" value={form.pretax401kPercent} onChange={(e) => setForm((f) => ({ ...f, pretax401kPercent: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label className="label">Health/dental premium ($/period, pre-tax)</label>
                <input type="number" step="0.01" value={form.pretaxSection125PerPeriod} onChange={(e) => setForm((f) => ({ ...f, pretaxSection125PerPeriod: e.target.value }))} style={inputStyle} />
              </div>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button type="submit" className="btn-primary" style={{ width: "100%" }}>
                  {editingId ? "Save changes" : "Save employee"}
                </button>
              </div>
            </form>
          )}

          <div className="panel">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Pay frequency</th>
                  <th>Filing status</th>
                  <th className="money">Rate</th>
                  <th className="money">PTO balance</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <div className="table-value">{e.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{e.role_title}</div>
                    </td>
                    <td>{EMPLOYEE_TYPE_LABEL[e.employee_type]}</td>
                    <td style={{ color: "var(--text-dim)" }}>{e.employee_type.startsWith("w2") ? PAY_FREQUENCY_LABEL[e.pay_frequency] : "—"}</td>
                    <td style={{ color: "var(--text-dim)" }}>{e.employee_type.startsWith("w2") ? e.filing_status : "—"}</td>
                    <td className="money table-value figure">
                      {e.employee_type === "w2_hourly" && e.hourly_rate ? `$${e.hourly_rate}/hr` : ""}
                      {e.employee_type === "w2_salary" && e.annual_salary ? `$${e.annual_salary}/yr` : ""}
                    </td>
                    <td className="money table-value figure">{e.pto_balance_hours.toFixed(1)}</td>
                    <td>
                      <button className="btn-secondary" onClick={() => startEdit(e)} style={{ padding: "6px 12px" }}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "runs" && !activeRun && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <button className="btn-primary" onClick={() => setShowNewRun((s) => !s)}>
              {showNewRun ? "Cancel" : "+ New Pay Run"}
            </button>
          </div>

          {showNewRun && (
            <div className="panel" style={{ padding: 20, marginBottom: 20 }}>
              <div className="panel-title" style={{ marginBottom: 12 }}>
                Pick the pay frequency
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <button className={`btn-secondary ${runForm.payFrequency === "weekly" ? "active" : ""}`} onClick={() => applyFrequency("weekly")}>
                  Weekly (last 7 days)
                </button>
                <button className={`btn-secondary ${runForm.payFrequency === "biweekly" ? "active" : ""}`} onClick={() => applyFrequency("biweekly")}>
                  Biweekly (last 14 days)
                </button>
                <button className={`btn-secondary ${runForm.payFrequency === "monthly" ? "active" : ""}`} onClick={() => applyFrequency("monthly")}>
                  Monthly (last 30 days)
                </button>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 0, marginBottom: 16 }}>
                Only active employees whose own profile is set to this pay frequency will be included in this run.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label className="label">Period start</label>
                  <input
                    type="date"
                    value={runForm.periodStart}
                    onChange={(e) => setRunForm((f) => ({ ...f, periodStart: e.target.value }))}
                    style={{ padding: 8, background: "var(--floor)", color: "var(--text)", border: "1px solid var(--line)", width: "100%" }}
                  />
                </div>
                <div>
                  <label className="label">Period end</label>
                  <input
                    type="date"
                    value={runForm.periodEnd}
                    onChange={(e) => setRunForm((f) => ({ ...f, periodEnd: e.target.value }))}
                    style={{ padding: 8, background: "var(--floor)", color: "var(--text)", border: "1px solid var(--line)", width: "100%" }}
                  />
                </div>
                <div>
                  <label className="label">Pay date</label>
                  <input
                    type="date"
                    value={runForm.payDate}
                    onChange={(e) => setRunForm((f) => ({ ...f, payDate: e.target.value }))}
                    style={{ padding: 8, background: "var(--floor)", color: "var(--text)", border: "1px solid var(--line)", width: "100%" }}
                  />
                </div>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 0, marginBottom: 16 }}>
                Hourly pay pulls real ClickUp time tracked between these two dates. Tax withholding is
                annualized based on the pay frequency selected above, so make sure it matches — dates alone
                don't control it anymore.
              </p>
              <button className="btn-primary" onClick={handleCreateRun} disabled={creatingRun}>
                {creatingRun ? "Creating…" : "Create Pay Run"}
              </button>
            </div>
          )}

          <div className="panel">
            <table>
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Pay date</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td className="table-value">
                      {r.period_start} – {r.period_end}
                    </td>
                    <td style={{ color: "var(--text-dim)" }}>{r.pay_date}</td>
                    <td>
                      <span className="badge" style={r.status === "finalized" ? { borderColor: "var(--moss-lite)", color: "var(--moss-lite)" } : {}}>
                        {r.status}
                      </span>
                    </td>
                    <td>
                      <button className="btn-secondary" onClick={() => openRun(r.id)} style={{ padding: "6px 12px" }}>
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "runs" && activeRun && (
        <div>
          <button className="btn-secondary" onClick={() => setActiveRun(null)} style={{ marginBottom: 16 }}>
            ← All runs
          </button>
          <div className="panel" style={{ padding: 20, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div className="panel-title">
                  {activeRun.run.period_start} – {activeRun.run.period_end}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-dim)" }}>Pay date {activeRun.run.pay_date}</div>
              </div>
              {activeRun.run.status === "draft" ? (
                <button className="btn-primary" onClick={handleFinalize}>
                  Finalize &amp; Post to Ledger
                </button>
              ) : (
                <span className="badge" style={{ borderColor: "var(--moss-lite)", color: "var(--moss-lite)" }}>
                  Finalized
                </span>
              )}
            </div>
          </div>

          {activeRun.paystubs.length === 0 && (
            <div className="panel" style={{ padding: 20 }}>
              <p style={{ color: "var(--text-dim)", margin: 0 }}>
                No paystubs on this run. Pay Runs only generate paystubs for active W-2 or 1099 employees —
                anyone set to "Owner (Draws)" is skipped on purpose (no withholding, no paystub). Check your
                employee types on the Employees tab.
              </p>
            </div>
          )}

          {activeRun.paystubs.map((stub) => (
            <div key={stub.id} className="panel" style={{ padding: 20, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <div className="table-value" style={{ fontSize: 15 }}>
                    {stub.employees.name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{EMPLOYEE_TYPE_LABEL[stub.employees.employee_type]}</div>
                </div>
                <a href={`/api/paystubs/${stub.id}/pdf`} target="_blank" className="btn-secondary" style={{ display: "inline-block" }}>
                  View Paystub PDF
                </a>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, fontSize: 13 }}>
                <div>
                  <div className="label">Regular</div>
                  <div className="figure">{stub.regular_hours.toFixed(1)}h</div>
                </div>
                <div>
                  <div className="label">OT</div>
                  <div className="figure">{stub.overtime_hours.toFixed(1)}h</div>
                </div>
                <div>
                  <div className="label">PTO used</div>
                  {activeRun.run.status === "draft" ? (
                    <input
                      type="number"
                      step="0.5"
                      defaultValue={stub.pto_hours_used}
                      onBlur={(e) => handleUpdatePto(stub.id, Number(e.target.value))}
                      style={{ width: 60, padding: 4, background: "var(--floor)", color: "var(--text)", border: "1px solid var(--line)" }}
                    />
                  ) : (
                    <div className="figure">{stub.pto_hours_used.toFixed(1)}h</div>
                  )}
                </div>
                <div>
                  <div className="label">Gross</div>
                  <div className="figure">${stub.gross_pay.toFixed(2)}</div>
                </div>
                <div>
                  <div className="label">Taxes</div>
                  <div className="figure">
                    ${(stub.federal_income_tax + stub.social_security_employee + stub.medicare_employee).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="label">Net Pay</div>
                  <div className="figure" style={{ color: "var(--moss-lite)", fontWeight: 700 }}>
                    ${stub.net_pay.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
