import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

export interface InvoiceLineItem {
  taskTitle: string;
  hours: number;
  description: string;
  loggedAt: string;
}

export interface InvoiceData {
  workspaceName: string;
  projectName: string;
  clientName?: string;
  invoiceNumber: string;
  issueDate: string;
  hourlyRate: number;
  lineItems: InvoiceLineItem[];
  periodStart?: string;
  periodEnd?: string;
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#1e293b' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  fromBlock: { flexDirection: 'column' },
  brandName: { fontSize: 18, fontWeight: 700, marginBottom: 2 },
  metaBlock: { flexDirection: 'column', alignItems: 'flex-end' },
  invoiceTitle: { fontSize: 20, fontWeight: 700, marginBottom: 6, color: '#4f46e5' },
  metaRow: { flexDirection: 'row', gap: 6, marginBottom: 2 },
  metaLabel: { color: '#64748b' },
  section: { marginBottom: 20 },
  sectionLabel: { fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.5, color: '#94a3b8', marginBottom: 4 },
  projectName: { fontSize: 13, fontWeight: 700 },
  table: { marginTop: 10, borderTop: '1 solid #e2e8f0' },
  tableRow: { flexDirection: 'row', paddingVertical: 8, borderBottom: '1 solid #f1f5f9' },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    backgroundColor: '#f8fafc',
    fontWeight: 700,
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#64748b',
  },
  colDate: { width: '15%' },
  colDesc: { width: '50%' },
  colHours: { width: '15%', textAlign: 'right' },
  colAmount: { width: '20%', textAlign: 'right' },
  totalsBlock: { marginTop: 16, alignItems: 'flex-end' },
  totalsRow: { flexDirection: 'row', gap: 30, marginBottom: 4 },
  totalsLabel: { color: '#64748b' },
  grandTotalRow: { flexDirection: 'row', gap: 30, marginTop: 6, paddingTop: 6, borderTop: '1 solid #1e293b' },
  grandTotalLabel: { fontSize: 12, fontWeight: 700 },
  grandTotalValue: { fontSize: 12, fontWeight: 700, color: '#4f46e5' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 8, color: '#94a3b8', textAlign: 'center' },
});

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

function formatMoney(amount: number): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function InvoiceDocument({ data }: { data: InvoiceData }) {
  const totalHours = data.lineItems.reduce((sum, item) => sum + item.hours, 0);
  const totalAmount = totalHours * data.hourlyRate;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.fromBlock}>
            <Text style={styles.brandName}>{data.workspaceName}</Text>
            {data.clientName && <Text style={{ color: '#64748b' }}>Billed to: {data.clientName}</Text>}
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>No.</Text>
              <Text>{data.invoiceNumber}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Date</Text>
              <Text>{formatDate(data.issueDate)}</Text>
            </View>
            {data.periodStart && data.periodEnd && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Period</Text>
                <Text>
                  {formatDate(data.periodStart)} – {formatDate(data.periodEnd)}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Project</Text>
          <Text style={styles.projectName}>{data.projectName}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={styles.colDate}>Date</Text>
            <Text style={styles.colDesc}>Description</Text>
            <Text style={styles.colHours}>Hours</Text>
            <Text style={styles.colAmount}>Amount</Text>
          </View>
          {data.lineItems.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.colDate}>{formatDate(item.loggedAt)}</Text>
              <Text style={styles.colDesc}>{item.description || item.taskTitle}</Text>
              <Text style={styles.colHours}>{item.hours.toFixed(1)}</Text>
              <Text style={styles.colAmount}>{formatMoney(item.hours * data.hourlyRate)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Total hours</Text>
            <Text>{totalHours.toFixed(1)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Rate</Text>
            <Text>{formatMoney(data.hourlyRate)} / hr</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total due</Text>
            <Text style={styles.grandTotalValue}>{formatMoney(totalAmount)}</Text>
          </View>
        </View>

        <Text style={styles.footer}>Generated by Syncora</Text>
      </Page>
    </Document>
  );
}
