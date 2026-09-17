"use client";

import { useCallback, useEffect, useState } from "react";
import ScreenHeader from "@/components/ScreenHeader";

interface Employee {
  id: string;
  name: string;
  email: string | null;
  role_title: string | null;
  employee_type: "w2_hourly" | "w2_salary" | "1099" | "owner_draw";
  clickup_user_id: string | null;
  hourly_rate: number | null;
  annual_salary: number | null;
  filing_status: string;
  dependents_amount_annual: number;
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

function emptyEmployeeForm() {
  return {
    name: "",
    email: "",
    roleTitle: "",
    employeeType: "w2_salary" as Employee["employee_type"],
    clickupUserId: "",
    hourlyRate: "",
    annualSalary: "",
    filingStatus: "single",
    dependentsAmountAnnual: "0",
    pretax401kPercent: "0",
    pretaxSection125PerPeriod: "0",
    ptoAccrualHoursPerPeriod: "0",
  };
}

export default function PayrollPage() {
  const [tab, setTab] = useState<"runs" | "employees">("runs");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [runs, setRuns] = useState<PayRun[]>([]);
  const [activeRun, setActiveRun] = useState<{ run: PayRun; paystubs: Paystub[] } | null>(null);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [form, setForm] = useState(emptyEmployeeForm());
  const [creatingRun, setCreatingRun] = useState(false);

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
    const now = new Date();
    const day = now.getDate();
    const periodStart = day <= 15 ? new Date(now.getFullYear(), now.getMonth(), 1) : new Date(now.getFullYear(), now.getMonth(), 16);
    const periodEnd = day <= 15 ? new Date(now.getFullYear(), now.getMonth(), 15) : new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const res = await fetch("/api/payroll/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodStart: fmt(periodStart), periodEnd: fmt(periodEnd), payDate: fmt(now) }),
    });
    const data = await res.json();
    setCreatingRun(false);
    await loadRuns();
    if (data.run) openRun(data.run.id);
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

  async function handleAddEmployee(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : null,
        annualSalary: form.annualSalary ? Number(form.annualSalary) : null,
        dependentsAmountAnnual: Number(form.dependentsAmountAnnual),
        pretax401kPercent: Number(form.pretax401kPercent),
        pretaxSection125PerPeriod: Number(form.pretaxSection125PerPeriod),
        ptoAccrualHoursPerPeriod: Number(form.ptoAccrualHoursPerPeriod),
      }),
    });
    setForm(emptyEmployeeForm());
    setShowAddEmployee(false);
    await loadEmployees();
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
            <button className="btn-primary" onClick={() => setShowAddEmployee((s) => !s)}>
              {showAddEmployee ? "Cancel" : "+ Add Employee"}
            </button>
          </div>

          {showAddEmployee && (
            <form onSubmit={handleAddEmployee} className="panel" style={{ padding: 20, marginBottom: 20, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
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
                  <option value="owner_draw">Owner (Draws)</option>
                </select>
              </div>
              <div>
                <label className="label">ClickUp user ID (for hourly)</label>
                <input value={form.clickupUserId} onChange={(e) => setForm((f) => ({ ...f, clickupUserId: e.target.value }))} style={inputStyle} placeholder="e.g. 57266783" />
              </div>
              <div>
                <label className="label">Hourly rate</label>
                <input type="number" step="0.01" value={form.hourlyRate} onChange={(e) => setForm((f) => ({ ...f, hourlyRate: e.target.value }))} style={inputStyle} />
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
                  Save employee
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
                  <th>Filing status</th>
                  <th className="money">Rate</th>
                  <th className="money">PTO balance</th>
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
                    <td style={{ color: "var(--text-dim)" }}>{e.employee_type.startsWith("w2") ? e.filing_status : "—"}</td>
                    <td className="money table-value figure">
                      {e.employee_type === "w2_hourly" && e.hourly_rate ? `$${e.hourly_rate}/hr` : ""}
                      {e.employee_type === "w2_salary" && e.annual_salary ? `$${e.annual_salary}/yr` : ""}
                    </td>
                    <td className="money table-value figure">{e.pto_balance_hours.toFixed(1)}</td>
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
            <button className="btn-primary" onClick={handleCreateRun} disabled={creatingRun}>
              {creatingRun ? "Creating…" : "+ New Pay Run (current period)"}
            </button>
          </div>
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
