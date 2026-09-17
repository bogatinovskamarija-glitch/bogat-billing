import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import { LOGO_BUFFER } from "./brand";

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: "Montserrat", fontSize: 10, color: "#2B2926" },
  letterheadRule: { borderBottomWidth: 2, borderBottomColor: "#242E22", paddingBottom: 16, marginBottom: 20 },
  letterheadRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logo: { width: 120 },
  invoiceLabel: { fontSize: 9, letterSpacing: 1, color: "#63625A", textAlign: "right" },
  invoiceNumber: { fontSize: 16, fontWeight: 700, color: "#242E22", textAlign: "right", marginTop: 2 },
  companyBlock: { fontSize: 9, color: "#63625A", textAlign: "right", marginTop: 8, lineHeight: 1.5 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  metaCol: { width: "30%" },
  metaLabel: { fontSize: 8, letterSpacing: 1, color: "#63625A", marginBottom: 3 },
  metaValue: { fontSize: 10, color: "#2B2926", marginBottom: 6 },
  table: { marginTop: 8, marginBottom: 20 },
  tableHeaderRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#D4D4CC", paddingBottom: 6 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#E8E8E3", paddingVertical: 8 },
  colDesc: { width: "52%" },
  colHours: { width: "14%", textAlign: "right" },
  colRate: { width: "16%", textAlign: "right" },
  colAmount: { width: "18%", textAlign: "right" },
  headerText: { fontSize: 8, letterSpacing: 1, color: "#63625A" },
  rateBreakdown: { fontSize: 8, color: "#8A897F", marginTop: 3 },
  totalsBlock: { alignItems: "flex-end", marginTop: 8 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", width: 220, marginBottom: 6 },
  totalsLabel: { fontSize: 10, color: "#63625A" },
  totalsValue: { fontSize: 10, color: "#2B2926" },
  balanceBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: 220,
    backgroundColor: "#242E22",
    padding: 12,
    marginTop: 6,
  },
  balanceLabel: { fontSize: 9, letterSpacing: 1, color: "#EDF2EA" },
  balanceValue: { fontSize: 16, fontWeight: 700, color: "#FFFFFF" },
  footer: { marginTop: 32, borderTopWidth: 1, borderTopColor: "#D4D4CC", paddingTop: 12 },
  footerText: { fontSize: 8, color: "#63625A", marginBottom: 3 },
});

export interface InvoicePdfData {
  invoiceNumber: string;
  issuedDate: string | null;
  dueDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  clientName: string;
  contactName: string | null;
  contactPhone: string | null;
  billingAddress: string | null;
  projectNames: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  lineItems: { taskName: string; hours: number | null; hourlyRate: number | null; amount: number; rateBreakdown: string | null }[];
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function InvoiceDocument({ data }: { data: InvoicePdfData }) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.letterheadRule}>
          <View style={styles.letterheadRow}>
            <Image src={LOGO_BUFFER} style={styles.logo} />
            <View>
              <Text style={styles.invoiceLabel}>INVOICE</Text>
              <Text style={styles.invoiceNumber}>{data.invoiceNumber}</Text>
              <Text style={styles.companyBlock}>
                BOGAT ARCHITECTURE & DESIGN LLC{"\n"}
                FORT LAUDERDALE, FLORIDA{"\n"}
                MARIA@BOGATARCHITECTURE.COM
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>BILLED TO</Text>
            <Text style={styles.metaValue}>{data.clientName}</Text>
            {data.contactName && <Text style={styles.metaValue}>{data.contactName}</Text>}
            {data.billingAddress && <Text style={styles.metaValue}>{data.billingAddress}</Text>}
            {data.contactPhone && <Text style={styles.metaValue}>{data.contactPhone}</Text>}
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>ISSUED</Text>
            <Text style={styles.metaValue}>{fmtDate(data.issuedDate)}</Text>
            <Text style={styles.metaLabel}>DUE</Text>
            <Text style={styles.metaValue}>{fmtDate(data.dueDate)}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>PROJECT</Text>
            <Text style={styles.metaValue}>{data.projectNames}</Text>
            <Text style={styles.metaLabel}>PERIOD</Text>
            <Text style={styles.metaValue}>
              {fmtDate(data.periodStart)} – {fmtDate(data.periodEnd)}
            </Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.colDesc, styles.headerText]}>DESCRIPTION</Text>
            <Text style={[styles.colHours, styles.headerText]}>HOURS</Text>
            <Text style={[styles.colRate, styles.headerText]}>RATE</Text>
            <Text style={[styles.colAmount, styles.headerText]}>AMOUNT</Text>
          </View>
          {data.lineItems.map((item, i) => (
            <View style={styles.tableRow} key={i}>
              <View style={styles.colDesc}>
                <Text>{item.taskName}</Text>
                {item.rateBreakdown && <Text style={styles.rateBreakdown}>{item.rateBreakdown}</Text>}
              </View>
              <Text style={styles.colHours}>{item.hours === null ? "—" : item.hours.toFixed(2)}</Text>
              <Text style={styles.colRate}>{item.hourlyRate === null ? "—" : `$${item.hourlyRate.toFixed(2)}`}</Text>
              <Text style={styles.colAmount}>${item.amount.toFixed(2)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>${data.subtotal.toFixed(2)}</Text>
          </View>
          {data.taxAmount > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Tax</Text>
              <Text style={styles.totalsValue}>${data.taxAmount.toFixed(2)}</Text>
            </View>
          )}
          <View style={styles.balanceBar}>
            <Text style={styles.balanceLabel}>BALANCE DUE</Text>
            <Text style={styles.balanceValue}>${data.totalAmount.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>PAYABLE BY ACH OR CHECK · REMITTANCE DETAIL ON FILE</Text>
          <Text style={styles.footerText}>LATE BALANCES ACCRUE PER THE EXECUTED AGREEMENT</Text>
        </View>
      </Page>
    </Document>
  );
}
