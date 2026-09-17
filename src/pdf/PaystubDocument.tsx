import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { LOGO_BUFFER } from "./brand";

const styles = StyleSheet.create({
  page: { padding: 44, fontFamily: "Montserrat", fontSize: 9, color: "#2B2926" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottomWidth: 2, borderBottomColor: "#242E22", paddingBottom: 14, marginBottom: 18 },
  logo: { width: 110 },
  title: { fontSize: 16, fontWeight: 700, color: "#242E22", textAlign: "right" },
  companyBlock: { fontSize: 8, color: "#63625A", textAlign: "right", marginTop: 6, lineHeight: 1.5 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  metaLabel: { fontSize: 8, letterSpacing: 1, color: "#63625A", marginBottom: 3 },
  metaValue: { fontSize: 10, marginBottom: 6 },
  sectionTitle: { fontSize: 9, fontWeight: 700, color: "#242E22", marginBottom: 6, marginTop: 14 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#E8E8E3" },
  label: { color: "#63625A" },
  value: { fontWeight: 600 },
  netBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#242E22", padding: 12, marginTop: 14 },
  netLabel: { fontSize: 9, letterSpacing: 1, color: "#EDF2EA" },
  netValue: { fontSize: 16, fontWeight: 700, color: "#FFFFFF" },
  footer: { marginTop: 24, borderTopWidth: 1, borderTopColor: "#D4D4CC", paddingTop: 10 },
  footerText: { fontSize: 7, color: "#63625A", marginBottom: 2 },
  twoCol: { flexDirection: "row", gap: 24 },
  col: { flex: 1 },
});

export interface PaystubPdfData {
  employeeName: string;
  roleTitle: string | null;
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
  const totalDeductions =
    data.pretax401k + data.pretaxSection125 + data.federalIncomeTax + data.socialSecurityEmployee + data.medicareEmployee + data.additionalMedicareEmployee + data.posttaxDeductions;

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Image src={LOGO_BUFFER} style={styles.logo} />
          <View>
            <Text style={styles.title}>PAY STATEMENT</Text>
            <Text style={styles.companyBlock}>
              BOGAT ARCHITECTURE &amp; DESIGN LLC{"\n"}FORT LAUDERDALE, FLORIDA
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View>
            <Text style={styles.metaLabel}>EMPLOYEE</Text>
            <Text style={styles.metaValue}>{data.employeeName}</Text>
            {data.roleTitle && <Text style={{ fontSize: 9, color: "#63625A" }}>{data.roleTitle}</Text>}
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
            <View style={styles.row}>
              <Text style={styles.label}>Regular ({data.regularHours.toFixed(1)} hrs)</Text>
              <Text style={styles.value} />
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Overtime ({data.overtimeHours.toFixed(1)} hrs)</Text>
              <Text style={styles.value} />
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>PTO used ({data.ptoHoursUsed.toFixed(1)} hrs)</Text>
              <Text style={styles.value} />
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
