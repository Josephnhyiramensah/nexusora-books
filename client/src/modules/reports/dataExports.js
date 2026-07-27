// client/src/modules/reports/dataExports.js
// Branded Excel exporters for core datasets. Each reuses the professional
// workbook builder in ReportShared (navy/gold header, frozen headers, money
// formatting, bold totals) so every export looks like proper accounting software.
import { exportToExcelStyled } from './ReportShared';

const money = (v) => Number(v || 0);
const dstr = (d) => (d ? new Date(d).toLocaleDateString('en-GB') : '');
const nameOf = (u) => (u ? ((u.firstName || '') + ' ' + (u.lastName || '')).trim() : '');
const cap = (s) => (s ? String(s).replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()) : '');
const today = () => new Date().toLocaleDateString('en-GB');
const sum = (rows, key) => rows.reduce((s, x) => s + (x[key] || 0), 0);

export async function exportJournals(entries, companyName) {
  const columns = [
    { header: 'Entry #', key: 'no', width: 14 },
    { header: 'Date', key: 'date', width: 13 },
    { header: 'Type', key: 'type', width: 14 },
    { header: 'Description', key: 'desc', width: 40 },
    { header: 'Debit (GHS)', key: 'debit', width: 15, money: true },
    { header: 'Credit (GHS)', key: 'credit', width: 15, money: true },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Created By', key: 'by', width: 20 },
  ];
  const rows = entries.map((e) => ({
    no: e.entryNumber, date: dstr(e.date), type: cap(e.journalType),
    desc: e.description || '', debit: money(e.totalDebit), credit: money(e.totalCredit),
    status: cap(e.status), by: nameOf(e.createdBy),
  }));
  await exportToExcelStyled({
    filename: 'Journal_Entries', companyName, title: 'Journal Entries',
    subtitle: `${entries.length} entries \u00b7 Generated ${today()}`,
    columns,
    sections: [{ rows, totalLabel: 'TOTAL', totalLabelKey: 'desc',
      totalValues: { debit: sum(rows, 'debit'), credit: sum(rows, 'credit') } }],
  });
}

export async function exportInvoices(invoices, companyName) {
  const columns = [
    { header: 'Invoice #', key: 'no', width: 14 },
    { header: 'Customer', key: 'cust', width: 28 },
    { header: 'Date', key: 'date', width: 13 },
    { header: 'Due Date', key: 'due', width: 13 },
    { header: 'Total (GHS)', key: 'total', width: 15, money: true },
    { header: 'Paid (GHS)', key: 'paid', width: 15, money: true },
    { header: 'Balance (GHS)', key: 'bal', width: 15, money: true },
    { header: 'Status', key: 'status', width: 14 },
  ];
  const rows = invoices.map((v) => ({
    no: v.invoiceNumber, cust: v.customer?.name || '', date: dstr(v.date), due: dstr(v.dueDate),
    total: money(v.total), paid: money(v.amountPaid), bal: money(v.balance), status: cap(v.status),
  }));
  await exportToExcelStyled({
    filename: 'Invoices', companyName, title: 'Invoices',
    subtitle: `${invoices.length} invoices \u00b7 Generated ${today()}`,
    columns,
    sections: [{ rows, totalLabel: 'TOTAL', totalLabelKey: 'due',
      totalValues: { total: sum(rows, 'total'), paid: sum(rows, 'paid'), bal: sum(rows, 'bal') } }],
  });
}

export async function exportBills(bills, companyName) {
  const columns = [
    { header: 'Bill #', key: 'no', width: 14 },
    { header: 'Vendor', key: 'vendor', width: 28 },
    { header: 'Date', key: 'date', width: 13 },
    { header: 'Due Date', key: 'due', width: 13 },
    { header: 'Total (GHS)', key: 'total', width: 15, money: true },
    { header: 'Paid (GHS)', key: 'paid', width: 15, money: true },
    { header: 'Balance (GHS)', key: 'bal', width: 15, money: true },
    { header: 'Status', key: 'status', width: 14 },
  ];
  const rows = bills.map((b) => ({
    no: b.billNumber, vendor: b.vendor?.name || '', date: dstr(b.date), due: dstr(b.dueDate),
    total: money(b.total), paid: money(b.amountPaid), bal: money(b.balance), status: cap(b.status),
  }));
  await exportToExcelStyled({
    filename: 'Bills', companyName, title: 'Bills',
    subtitle: `${bills.length} bills \u00b7 Generated ${today()}`,
    columns,
    sections: [{ rows, totalLabel: 'TOTAL', totalLabelKey: 'due',
      totalValues: { total: sum(rows, 'total'), paid: sum(rows, 'paid'), bal: sum(rows, 'bal') } }],
  });
}

export async function exportCustomers(customers, companyName) {
  const columns = [
    { header: 'Name', key: 'name', width: 26 },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'Phone', key: 'phone', width: 16 },
    { header: 'Tax ID', key: 'tax', width: 16 },
    { header: 'Outstanding (GHS)', key: 'out', width: 18, money: true },
    { header: 'Status', key: 'status', width: 12 },
  ];
  const rows = customers.map((c) => ({
    name: c.name, email: c.email || '', phone: c.phone || '', tax: c.taxId || '',
    out: money(c.outstandingBalance), status: c.isActive ? 'Active' : 'Inactive',
  }));
  await exportToExcelStyled({
    filename: 'Customers', companyName, title: 'Customers',
    subtitle: `${customers.length} customers \u00b7 Generated ${today()}`,
    columns,
    sections: [{ rows, totalLabel: 'TOTAL', totalLabelKey: 'tax',
      totalValues: { out: sum(rows, 'out') } }],
  });
}

export async function exportVendors(vendors, companyName) {
  const columns = [
    { header: 'Name', key: 'name', width: 26 },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'Phone', key: 'phone', width: 16 },
    { header: 'Tax ID', key: 'tax', width: 16 },
    { header: 'Outstanding (GHS)', key: 'out', width: 18, money: true },
  ];
  const rows = vendors.map((v) => ({
    name: v.name, email: v.email || '', phone: v.phone || '', tax: v.taxId || '',
    out: money(v.outstandingBalance),
  }));
  await exportToExcelStyled({
    filename: 'Vendors', companyName, title: 'Vendors',
    subtitle: `${vendors.length} vendors \u00b7 Generated ${today()}`,
    columns,
    sections: [{ rows, totalLabel: 'TOTAL', totalLabelKey: 'tax',
      totalValues: { out: sum(rows, 'out') } }],
  });
}
