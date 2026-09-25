import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { ensurePdfAssetsLoaded } from "./brand";

const styles = StyleSheet.create({
  page: { padding: 44, fontFamily: "Montserrat", fontSize: 9, color: "#2B2926", display: "flex", flexDirection: "column" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottomWidth: 2, borderBottomColor: "#242E22", paddingBottom: 18, marginBottom: 22 },
  logo: { width: 170 },
  headerBlock: { width: 220, alignItems: "flex-end" },
  title: { fontSize: 20, fontWeight: 700, color: "#242E22", textAlign: "right" },
  companyName: { fontSize: 10, fontWeight: 700, color: "#242E22", textAlign: "right", marginTop: 9 },
  companyBlock: { fontSize: 8, color: "#63625A", textAlign: "right", marginTop: 4, lineHeight: 1.6 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  metaLabel: { fontSize: 8, letterSpacing: 1, color: "#63625A", marginBottom: 3 },
  metaValue: { fontSize: 10, marginBottom: 6 },
  sectionTitle: { fontSize: 9, fontWeight: 700, color: "#242E22", marginBottom: 6, marginTop: 14 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#E8E8E3" },
  earningsRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#E8E8E3" },
  earningsDesc: { flex: 1, color: "#63625A" },
  earningsRate: { width: 56, textAlign: "right", color: "#63625A" },
  earningsAmount: { width: 64, textAlign: "right", fontWeight: 600 },
  label: { color: "#63625A" },
  value: { fontWeight: 600 },
  netBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#242E22", padding: 12, marginTop: 14 },
  netLabel: { fontSize: 9, letterSpacing: 1, color: "#EDF2EA" },
  netValue: { fontSize: 16, fontWeight: 700, color: "#FFFFFF" },
  depositLine: { fontSize: 9, color: "#63625A", marginTop: 8, textAlign: "right" },
  footer: { marginTop: 24, borderTopWidth: 1, borderTopColor: "#D4D4CC", paddingTop: 10 },
  footerText: { fontSize: 7, color: "#63625A", marginBottom: 2, textAlign: "center" },
  twoCol: { flexDirection: "row", gap: 24 },
  col: { flex: 1 },
});

export interface PaystubPdfData {
  employeeName: string;
  roleTitle: string | null;
  employeeAddress: string | null;
  hourlyRate: number | null;
  bankName: string | null;
  bankAccountLast4: string | null;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  regularHours: number;
  overtimeHours: number;
  ptoHoursUsed: number;
  grossPay: number;
  pretax401k: number;
  pretaxSection125: number;
  federalIncomeTax: number;
  socialSecurityEmployee: number;
  medicareEmployee: number;
  additionalMedicareEmployee: number;
  posttaxDeductions: number;
  netPay: number;
  employerTaxTotal: number;
  ytdGross: number;
  ytdFederalTax: number;
  ytdSsEmployee: number;
  ytdMedicareEmployee: number;
  ytdNet: number;
}

function fmtDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

export default function PaystubDocument({ data }: { data: PaystubPdfData }) {
  const logoBuffer = ensurePdfAssetsLoaded();
  const totalDeductions =
    data.pretax401k + data.pretaxSection125 + data.federalIncomeTax + data.socialSecurityEmployee + data.medicareEmployee + data.additionalMedicareEmployee + data.posttaxDeductions;

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Image src={logoBuffer} style={styles.logo} />
          <View style={styles.headerBlock}>
            <Text style={styles.title}>PAY STATEMENT</Text>
            <Text style={styles.companyName}>Bogat Architecture &amp; Design LLC</Text>
            <Text style={styles.companyBlock}>
              Fort Lauderdale, FL{"\n"}
              maria@bogatarchitecture.com{"\n"}
              (331) 431-2511
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View>
            <Text style={styles.metaLabel}>EMPLOYEE</Text>
            <Text style={styles.metaValue}>{data.employeeName}</Text>
            {data.roleTitle && <Text style={{ fontSize: 9, color: "#63625A" }}>{data.roleTitle}</Text>}
            {data.employeeAddress && <Text style={{ fontSize: 9, color: "#63625A", marginTop: 2 }}>{data.employeeAddress}</Text>}
          </View>
          <View>
            <Text style={styles.metaLabel}>PAY PERIOD</Text>
            <Text style={styles.metaValue}>
              {fmtDate(data.periodStart)} – {fmtDate(data.periodEnd)}
            </Text>
            <Text style={styles.metaLabel}>PAY DATE</Text>
            <Text style={styles.metaValue}>{fmtDate(data.payDate)}</Text>
          </View>
        </View>

        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>EARNINGS</Text>
            <View style={styles.earningsRow}>
              <Text style={styles.earningsDesc}>Regular ({data.regularHours.toFixed(1)} hrs)</Text>
              <Text style={styles.earningsRate}>{data.hourlyRate ? `$${data.hourlyRate.toFixed(2)}` : ""}</Text>
              <Text style={styles.earningsAmount}>{data.hourlyRate ? money(data.regularHours * data.hourlyRate) : ""}</Text>
            </View>
            <View style={styles.earningsRow}>
              <Text style={styles.earningsDesc}>Overtime ({data.overtimeHours.toFixed(1)} hrs)</Text>
              <Text style={styles.earningsRate}>{data.hourlyRate ? `$${(data.hourlyRate * 1.5).toFixed(2)}` : ""}</Text>
              <Text style={styles.earningsAmount}>{data.hourlyRate ? money(data.overtimeHours * data.hourlyRate * 1.5) : ""}</Text>
            </View>
            <View style={styles.earningsRow}>
              <Text style={styles.earningsDesc}>PTO used ({data.ptoHoursUsed.toFixed(1)} hrs)</Text>
              <Text style={styles.earningsRate}>{data.hourlyRate ? `$${data.hourlyRate.toFixed(2)}` : ""}</Text>
              <Text style={styles.earningsAmount}>{data.hourlyRate ? money(data.ptoHoursUsed * data.hourlyRate) : ""}</Text>
            </View>
            <View style={[styles.row, { borderBottomWidth: 0, marginTop: 4 }]}>
              <Text style={[styles.label, { fontWeight: 700, color: "#2B2926" }]}>Gross Pay</Text>
              <Text style={styles.value}>{money(data.grossPay)}</Text>
            </View>

            <Text style={styles.sectionTitle}>YEAR-TO-DATE</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Gross</Text>
              <Text style={styles.value}>{money(data.ytdGross)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Federal tax</Text>
              <Text style={styles.value}>{money(data.ytdFederalTax)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Social Security</Text>
              <Text style={styles.value}>{money(data.ytdSsEmployee)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Medicare</Text>
              <Text style={styles.value}>{money(data.ytdMedicareEmployee)}</Text>
            </View>
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <Text style={[styles.label, { fontWeight: 700, color: "#2B2926" }]}>Net</Text>
              <Text style={styles.value}>{money(data.ytdNet)}</Text>
            </View>
          </View>

          <View style={styles.col}>
            <Text style={styles.sectionTitle}>DEDUCTIONS</Text>
            {data.pretax401k > 0 && (
              <View style={styles.row}>
                <Text style={styles.label}>401(k) (pre-tax)</Text>
                <Text style={styles.value}>{money(data.pretax401k)}</Text>
              </View>
            )}
            {data.pretaxSection125 > 0 && (
              <View style={styles.row}>
                <Text style={styles.label}>Health/dental (pre-tax)</Text>
                <Text style={styles.value}>{money(data.pretaxSection125)}</Text>
              </View>
            )}
            <View style={styles.row}>
              <Text style={styles.label}>Federal income tax</Text>
              <Text style={styles.value}>{money(data.federalIncomeTax)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Social Security</Text>
              <Text style={styles.value}>{money(data.socialSecurityEmployee)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Medicare</Text>
              <Text style={styles.value}>{money(data.medicareEmployee)}</Text>
            </View>
            {data.additionalMedicareEmployee > 0 && (
              <View style={styles.row}>
                <Text style={styles.label}>Additional Medicare</Text>
                <Text style={styles.value}>{money(data.additionalMedicareEmployee)}</Text>
              </View>
            )}
            {data.posttaxDeductions > 0 && (
              <View style={styles.row}>
                <Text style={styles.label}>Other (post-tax)</Text>
                <Text style={styles.value}>{money(data.posttaxDeductions)}</Text>
              </View>
            )}
            <View style={[styles.row, { borderBottomWidth: 0, marginTop: 4 }]}>
              <Text style={[styles.label, { fontWeight: 700, color: "#2B2926" }]}>Total Deductions</Text>
              <Text style={styles.value}>{money(totalDeductions)}</Text>
            </View>

            <Text style={styles.sectionTitle}>EMPLOYER COST (for records — not deducted from pay)</Text>
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <Text style={styles.label}>Employer taxes (SS/Medicare/FUTA/FL RT)</Text>
              <Text style={styles.value}>{money(data.employerTaxTotal)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.netBar}>
          <Text style={styles.netLabel}>NET PAY</Text>
          <Text style={styles.netValue}>{money(data.netPay)}</Text>
        </View>
        {data.bankAccountLast4 && (
          <Text style={styles.depositLine}>
            Deposited to: {data.bankName ? `${data.bankName} ` : ""}••••{data.bankAccountLast4}
          </Text>
        )}

        <View style={{ flexGrow: 1 }} />

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            This is a payroll calculation for internal record-keeping. Verify figures against current IRS/SSA/FL
            DOR published tables and consult a CPA before relying on this for tax filings.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
