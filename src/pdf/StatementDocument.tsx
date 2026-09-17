import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: "Helvetica", fontSize: 10, color: "#2B2926" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottomWidth: 2, borderBottomColor: "#242E22", paddingBottom: 14, marginBottom: 20 },
  logo: { width: 110 },
  title: { fontSize: 16, fontWeight: 700, color: "#242E22", textAlign: "right" },
  subtitle: { fontSize: 9, color: "#63625A", textAlign: "right", marginTop: 4 },
  sectionTitle: { fontSize: 10, fontWeight: 700, color: "#242E22", marginTop: 16, marginBottom: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: "#E8E8E3" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderTopWidth: 1, borderTopColor: "#D4D4CC", marginTop: 2 },
  label: { color: "#2B2926" },
  bold: { fontWeight: 700 },
  value: { fontWeight: 600 },
  bigBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#242E22", padding: 12, marginTop: 16 },
  bigLabel: { fontSize: 9, letterSpacing: 1, color: "#EDF2EA" },
  bigValue: { fontSize: 16, fontWeight: 700, color: "#FFFFFF" },
  footer: { marginTop: 24, borderTopWidth: 1, borderTopColor: "#D4D4CC", paddingTop: 10 },
  footerText: { fontSize: 7, color: "#63625A" },
});

export interface StatementSection {
  title: string;
  rows: { label: string; value: number }[];
  total: { label: string; value: number };
}

export interface StatementPdfData {
  title: string;
  subtitle: string;
  sections: StatementSection[];
  grandTotal?: { label: string; value: number };
}

function money(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

export default function StatementDocument({ data }: { data: StatementPdfData }) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Image src={process.cwd() + "/public/brand/logo-forest.png"} style={styles.logo} />
          <View>
            <Text style={styles.title}>{data.title.toUpperCase()}</Text>
            <Text style={styles.subtitle}>{data.subtitle}</Text>
            <Text style={styles.subtitle}>Bogat Architecture &amp; Design LLC</Text>
          </View>
        </View>

        {data.sections.map((section) => (
          <View key={section.title}>
            <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
            {section.rows.map((row, i) => (
              <View style={styles.row} key={i}>
                <Text style={styles.label}>{row.label}</Text>
                <Text style={styles.value}>{money(row.value)}</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.bold}>{section.total.label}</Text>
              <Text style={styles.bold}>{money(section.total.value)}</Text>
            </View>
          </View>
        ))}

        {data.grandTotal && (
          <View style={styles.bigBar}>
            <Text style={styles.bigLabel}>{data.grandTotal.label.toUpperCase()}</Text>
            <Text style={styles.bigValue}>{money(data.grandTotal.value)}</Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Generated from Bogat OS's internal ledger. Not a substitute for a CPA-reviewed financial statement.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
