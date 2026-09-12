// server/config/seedData.js
// Default IFRS-compliant Chart of Accounts — seeded into every new tenant, and
// available as an additive "sync" top-up for existing tenants (adds missing
// accounts by code; never modifies or removes existing ones).
//
// Structure (code ranges):
//   1000–1999  Assets            (current, then non-current)
//   2000–2999  Liabilities       (current, then non-current)
//   3000–3999  Equity
//   4000–4999  Revenue / Income
//   5000–5999  Cost of Sales (COGS)
//   6000–6999  Operating Expenses
//   7000–7999  Finance & Other (non-operating) income/expense & tax

const defaultChartOfAccounts = [
  // ── ASSETS (1000–1999) ─────────────────────────────────────────────────────
  // Current assets
  { code: '1000', name: 'Cash', type: 'asset', category: 'Current Asset', normalBalance: 'debit', isSystemAccount: true, description: 'Cash on hand' },
  { code: '1010', name: 'Petty Cash', type: 'asset', category: 'Current Asset', normalBalance: 'debit', isSystemAccount: true, description: 'Petty cash fund' },
  { code: '1020', name: 'Bank Accounts', type: 'asset', category: 'Current Asset', normalBalance: 'debit', isSystemAccount: true, description: 'Bank account balances' },
  { code: '1030', name: 'Mobile Money', type: 'asset', category: 'Current Asset', normalBalance: 'debit', isSystemAccount: true, description: 'Mobile money float and wallets' },
  { code: '1100', name: 'Accounts Receivable', type: 'asset', category: 'Current Asset', normalBalance: 'debit', isSystemAccount: true, description: 'Amounts owed by customers' },
  { code: '1110', name: 'Allowance for Doubtful Debts', type: 'asset', category: 'Current Asset', normalBalance: 'credit', isSystemAccount: true, description: 'Provision against uncollectible receivables' },
  { code: '1120', name: 'Staff Advances & Loans', type: 'asset', category: 'Current Asset', normalBalance: 'debit', isSystemAccount: true, description: 'Advances and loans to employees' },
  { code: '1200', name: 'Inventory', type: 'asset', category: 'Current Asset', normalBalance: 'debit', isSystemAccount: true, description: 'Goods held for sale' },
  { code: '1210', name: 'Raw Materials', type: 'asset', category: 'Current Asset', normalBalance: 'debit', parentCode: '1200', isSystemAccount: true, description: 'Raw materials inventory' },
  { code: '1220', name: 'Work in Progress', type: 'asset', category: 'Current Asset', normalBalance: 'debit', parentCode: '1200', isSystemAccount: true, description: 'Partially completed goods' },
  { code: '1230', name: 'Finished Goods', type: 'asset', category: 'Current Asset', normalBalance: 'debit', parentCode: '1200', isSystemAccount: true, description: 'Completed goods ready for sale' },
  { code: '1300', name: 'Prepaid Expenses', type: 'asset', category: 'Current Asset', normalBalance: 'debit', isSystemAccount: true, description: 'Expenses paid in advance' },
  { code: '1310', name: 'Input VAT Recoverable', type: 'asset', category: 'Current Asset', normalBalance: 'debit', isSystemAccount: true, description: 'VAT paid on purchases, recoverable' },
  { code: '1320', name: 'Withholding Tax Receivable', type: 'asset', category: 'Current Asset', normalBalance: 'debit', isSystemAccount: true, description: 'WHT credits recoverable' },
  // Non-current assets
  { code: '1400', name: 'Property, Plant & Equipment', type: 'asset', category: 'Non-Current Asset', normalBalance: 'debit', isSystemAccount: true, description: 'Long-term tangible assets (at cost)' },
  { code: '1405', name: 'Land & Buildings', type: 'asset', category: 'Non-Current Asset', normalBalance: 'debit', parentCode: '1400', isSystemAccount: true, description: 'Land and buildings' },
  { code: '1410', name: 'Equipment & Machinery', type: 'asset', category: 'Non-Current Asset', normalBalance: 'debit', parentCode: '1400', isSystemAccount: true, description: 'Machinery and equipment' },
  { code: '1420', name: 'Furniture & Fittings', type: 'asset', category: 'Non-Current Asset', normalBalance: 'debit', parentCode: '1400', isSystemAccount: true, description: 'Office furniture and fittings' },
  { code: '1430', name: 'Motor Vehicles', type: 'asset', category: 'Non-Current Asset', normalBalance: 'debit', parentCode: '1400', isSystemAccount: true, description: 'Company vehicles' },
  { code: '1440', name: 'Computers & IT Equipment', type: 'asset', category: 'Non-Current Asset', normalBalance: 'debit', parentCode: '1400', isSystemAccount: true, description: 'Computers, servers, IT hardware' },
  { code: '1500', name: 'Accumulated Depreciation', type: 'asset', category: 'Non-Current Asset', normalBalance: 'credit', isSystemAccount: true, description: 'Total depreciation on PPE (contra-asset)' },
  { code: '1600', name: 'Intangible Assets', type: 'asset', category: 'Non-Current Asset', normalBalance: 'debit', isSystemAccount: true, description: 'Software, goodwill, licences' },
  { code: '1700', name: 'Long-Term Investments', type: 'asset', category: 'Non-Current Asset', normalBalance: 'debit', isSystemAccount: true, description: 'Investments held long-term' },

  // ── LIABILITIES (2000–2999) ────────────────────────────────────────────────
  // Current liabilities
  { code: '2000', name: 'Accounts Payable (Trade)', type: 'liability', category: 'Current Liability', normalBalance: 'credit', isSystemAccount: true, description: 'Amounts owed to suppliers' },
  { code: '2100', name: 'Accrued Expenses', type: 'liability', category: 'Current Liability', normalBalance: 'credit', isSystemAccount: true, description: 'Expenses incurred but not yet paid' },
  { code: '2200', name: 'Other Accounts Payable', type: 'liability', category: 'Current Liability', normalBalance: 'credit', isSystemAccount: true, description: 'Non-trade payables' },
  { code: '2250', name: 'Customer Deposits / Unearned Revenue', type: 'liability', category: 'Current Liability', normalBalance: 'credit', isSystemAccount: true, description: 'Advance payments from customers' },
  { code: '2400', name: 'Taxes Payable', type: 'liability', category: 'Current Liability', normalBalance: 'credit', isSystemAccount: true, description: 'General tax obligations' },
  { code: '2410', name: 'VAT Payable (Output VAT)', type: 'liability', category: 'Current Liability', normalBalance: 'credit', parentCode: '2400', isSystemAccount: true, description: 'VAT charged on sales, payable to GRA' },
  { code: '2420', name: 'PAYE Payable', type: 'liability', category: 'Current Liability', normalBalance: 'credit', parentCode: '2400', isSystemAccount: true, description: 'Employee income tax withheld, payable to GRA' },
  { code: '2430', name: 'Withholding Tax Payable', type: 'liability', category: 'Current Liability', normalBalance: 'credit', parentCode: '2400', isSystemAccount: true, description: 'WHT withheld from suppliers, payable to GRA' },
  { code: '2440', name: 'Corporate Tax Payable', type: 'liability', category: 'Current Liability', normalBalance: 'credit', parentCode: '2400', isSystemAccount: true, description: 'Company income tax payable' },
  { code: '2500', name: 'Payroll Liabilities', type: 'liability', category: 'Current Liability', normalBalance: 'credit', isSystemAccount: true, description: 'Payroll deductions payable' },
  { code: '2510', name: 'SSNIT Payable (Tier 1)', type: 'liability', category: 'Current Liability', normalBalance: 'credit', parentCode: '2500', isSystemAccount: true, description: 'SSNIT Tier 1 contributions payable' },
  { code: '2520', name: 'SSNIT Payable (Tier 2)', type: 'liability', category: 'Current Liability', normalBalance: 'credit', parentCode: '2500', isSystemAccount: true, description: 'SSNIT Tier 2 contributions payable' },
  { code: '2530', name: 'Provident Fund Payable (Tier 3)', type: 'liability', category: 'Current Liability', normalBalance: 'credit', parentCode: '2500', isSystemAccount: true, description: 'Provident fund contributions payable' },
  // Non-current liabilities
  { code: '2600', name: 'Loans Payable (Long-Term)', type: 'liability', category: 'Non-Current Liability', normalBalance: 'credit', isSystemAccount: true, description: 'Long-term loan obligations' },
  { code: '2700', name: 'Lease Liabilities', type: 'liability', category: 'Non-Current Liability', normalBalance: 'credit', isSystemAccount: true, description: 'Long-term lease obligations' },

  // ── EQUITY (3000–3999) ─────────────────────────────────────────────────────
  { code: '3000', name: "Owner's Capital / Share Capital", type: 'equity', category: 'Equity', normalBalance: 'credit', isSystemAccount: true, description: 'Capital invested by owners' },
  { code: '3100', name: 'Retained Earnings', type: 'equity', category: 'Equity', normalBalance: 'credit', isSystemAccount: true, description: 'Accumulated net income' },
  { code: '3150', name: 'Current Year Earnings', type: 'equity', category: 'Equity', normalBalance: 'credit', isSystemAccount: true, description: 'Net profit/loss for the current period' },
  { code: '3200', name: "Owner's Drawings / Dividends", type: 'equity', category: 'Equity', normalBalance: 'debit', isSystemAccount: true, description: 'Withdrawals / distributions to owners' },
  { code: '3300', name: 'Reserves', type: 'equity', category: 'Equity', normalBalance: 'credit', isSystemAccount: true, description: 'Revaluation and other reserves' },

  // ── REVENUE / INCOME (4000–4999) ───────────────────────────────────────────
  { code: '4000', name: 'Sales Revenue', type: 'revenue', category: 'Operating Revenue', normalBalance: 'credit', isSystemAccount: true, description: 'Revenue from goods sold' },
  { code: '4010', name: 'Service Revenue', type: 'revenue', category: 'Operating Revenue', normalBalance: 'credit', isSystemAccount: true, description: 'Revenue from services rendered' },
  { code: '4020', name: 'Sales Returns & Allowances', type: 'revenue', category: 'Operating Revenue', normalBalance: 'debit', isSystemAccount: true, description: 'Returns and allowances (contra-revenue)' },
  { code: '4030', name: 'Sales Discounts', type: 'revenue', category: 'Operating Revenue', normalBalance: 'debit', isSystemAccount: true, description: 'Discounts given (contra-revenue)' },
  { code: '4100', name: 'Interest Income', type: 'revenue', category: 'Other Income', normalBalance: 'credit', isSystemAccount: true, description: 'Interest earned on deposits' },
  { code: '4200', name: 'Other Income', type: 'revenue', category: 'Other Income', normalBalance: 'credit', isSystemAccount: true, description: 'Miscellaneous income' },
  { code: '4300', name: 'Foreign Exchange Gain/Loss', type: 'revenue', category: 'Other Income', normalBalance: 'credit', isSystemAccount: true, description: 'Realised FX gains and losses' },
  { code: '4400', name: 'Gain on Disposal of Assets', type: 'revenue', category: 'Other Income', normalBalance: 'credit', isSystemAccount: true, description: 'Profit on sale of fixed assets' },

  // ── COST OF SALES (5000–5999) ──────────────────────────────────────────────
  { code: '5000', name: 'Cost of Goods Sold', type: 'cogs', category: 'Cost of Goods Sold', normalBalance: 'debit', isSystemAccount: true, description: 'Cost of goods sold' },
  { code: '5010', name: 'Purchases', type: 'cogs', category: 'Cost of Goods Sold', normalBalance: 'debit', parentCode: '5000', isSystemAccount: true, description: 'Purchases of goods for resale' },
  { code: '5020', name: 'Purchase Returns', type: 'cogs', category: 'Cost of Goods Sold', normalBalance: 'credit', parentCode: '5000', isSystemAccount: true, description: 'Returns to suppliers (contra)' },
  { code: '5030', name: 'Freight & Carriage Inwards', type: 'cogs', category: 'Cost of Goods Sold', normalBalance: 'debit', parentCode: '5000', isSystemAccount: true, description: 'Delivery costs on purchases' },
  { code: '5100', name: 'Direct Labour', type: 'cogs', category: 'Cost of Goods Sold', normalBalance: 'debit', isSystemAccount: true, description: 'Direct labour costs' },
  { code: '5200', name: 'Manufacturing Overhead', type: 'cogs', category: 'Cost of Goods Sold', normalBalance: 'debit', isSystemAccount: true, description: 'Factory overhead costs' },

  // ── OPERATING EXPENSES (6000–6999) ─────────────────────────────────────────
  // Staff costs
  { code: '6000', name: 'Salaries & Wages', type: 'expense', category: 'Staff Costs', normalBalance: 'debit', isSystemAccount: true, description: 'Employee salaries and wages' },
  { code: '6010', name: 'Employer SSNIT Contribution', type: 'expense', category: 'Staff Costs', normalBalance: 'debit', isSystemAccount: true, description: "Employer's SSNIT contribution" },
  { code: '6020', name: 'Staff Bonuses & Allowances', type: 'expense', category: 'Staff Costs', normalBalance: 'debit', isSystemAccount: true, description: 'Bonuses, allowances and benefits' },
  { code: '6030', name: 'Staff Training & Welfare', type: 'expense', category: 'Staff Costs', normalBalance: 'debit', isSystemAccount: true, description: 'Training, welfare and staff development' },
  // Occupancy
  { code: '6100', name: 'Rent Expense', type: 'expense', category: 'Occupancy', normalBalance: 'debit', isSystemAccount: true, description: 'Office and facility rent' },
  { code: '6110', name: 'Rates & Property Taxes', type: 'expense', category: 'Occupancy', normalBalance: 'debit', isSystemAccount: true, description: 'Property rates and local taxes' },
  { code: '6200', name: 'Utilities', type: 'expense', category: 'Occupancy', normalBalance: 'debit', isSystemAccount: true, description: 'Electricity, water, internet' },
  { code: '6210', name: 'Repairs & Maintenance', type: 'expense', category: 'Occupancy', normalBalance: 'debit', isSystemAccount: true, description: 'Repairs and maintenance' },
  // Administrative
  { code: '6300', name: 'Office Supplies & Stationery', type: 'expense', category: 'Administrative', normalBalance: 'debit', isSystemAccount: true, description: 'Stationery and office materials' },
  { code: '6310', name: 'Printing & Postage', type: 'expense', category: 'Administrative', normalBalance: 'debit', isSystemAccount: true, description: 'Printing, postage and courier' },
  { code: '6320', name: 'Telephone & Communication', type: 'expense', category: 'Administrative', normalBalance: 'debit', isSystemAccount: true, description: 'Phone, airtime, data' },
  { code: '6330', name: 'Subscriptions & Software', type: 'expense', category: 'Administrative', normalBalance: 'debit', isSystemAccount: true, description: 'Software licences and subscriptions' },
  { code: '6340', name: 'Travel & Transport', type: 'expense', category: 'Administrative', normalBalance: 'debit', isSystemAccount: true, description: 'Business travel and transport' },
  { code: '6350', name: 'Fuel & Vehicle Running', type: 'expense', category: 'Administrative', normalBalance: 'debit', isSystemAccount: true, description: 'Fuel and vehicle running costs' },
  // Selling & distribution
  { code: '6400', name: 'Marketing & Advertising', type: 'expense', category: 'Selling & Distribution', normalBalance: 'debit', isSystemAccount: true, description: 'Advertising and promotional costs' },
  { code: '6410', name: 'Freight & Carriage Outwards', type: 'expense', category: 'Selling & Distribution', normalBalance: 'debit', isSystemAccount: true, description: 'Delivery costs on sales' },
  { code: '6420', name: 'Entertainment & Hospitality', type: 'expense', category: 'Selling & Distribution', normalBalance: 'debit', isSystemAccount: true, description: 'Client entertainment' },
  // Professional & compliance
  { code: '6500', name: 'Insurance', type: 'expense', category: 'Professional & Compliance', normalBalance: 'debit', isSystemAccount: true, description: 'Business insurance premiums' },
  { code: '6700', name: 'Professional Fees', type: 'expense', category: 'Professional & Compliance', normalBalance: 'debit', isSystemAccount: true, description: 'Legal, accounting, consulting fees' },
  { code: '6710', name: 'Audit Fees', type: 'expense', category: 'Professional & Compliance', normalBalance: 'debit', isSystemAccount: true, description: 'External audit fees' },
  { code: '6720', name: 'Licences & Permits', type: 'expense', category: 'Professional & Compliance', normalBalance: 'debit', isSystemAccount: true, description: 'Business licences and permits' },
  // Other operating
  { code: '6600', name: 'Depreciation Expense', type: 'expense', category: 'Operating Expense', normalBalance: 'debit', isSystemAccount: true, description: 'Depreciation on fixed assets' },
  { code: '6610', name: 'Amortisation Expense', type: 'expense', category: 'Operating Expense', normalBalance: 'debit', isSystemAccount: true, description: 'Amortisation of intangibles' },
  { code: '6620', name: 'Bad Debt Expense', type: 'expense', category: 'Operating Expense', normalBalance: 'debit', isSystemAccount: true, description: 'Receivables written off / provided' },
  { code: '6800', name: 'Bank & Mobile Money Charges', type: 'expense', category: 'Operating Expense', normalBalance: 'debit', isSystemAccount: true, description: 'Bank fees and MoMo charges' },
  { code: '6900', name: 'Miscellaneous Expenses', type: 'expense', category: 'Operating Expense', normalBalance: 'debit', isSystemAccount: true, description: 'Other uncategorised expenses' },

  // ── FINANCE, OTHER & TAX (7000–7999) ───────────────────────────────────────
  { code: '7000', name: 'Interest Expense', type: 'expense', category: 'Finance Cost', normalBalance: 'debit', isSystemAccount: true, description: 'Interest on loans and financing' },
  { code: '7100', name: 'Loss on Disposal of Assets', type: 'expense', category: 'Other Expense', normalBalance: 'debit', isSystemAccount: true, description: 'Loss on sale of fixed assets' },
  { code: '7900', name: 'Corporate Income Tax Expense', type: 'expense', category: 'Tax', normalBalance: 'debit', isSystemAccount: true, description: 'Company income tax charge for the period' },
];

module.exports = { defaultChartOfAccounts };
