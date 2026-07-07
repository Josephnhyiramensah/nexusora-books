// server/config/seedData.js
// Default IFRS-compliant Chart of Accounts — seeded into every new tenant

const defaultChartOfAccounts = [
  // ASSETS (1000–1999)
  { code: '1000', name: 'Cash', type: 'asset', category: 'Current Asset', normalBalance: 'debit', isSystemAccount: true, description: 'Cash on hand' },
  { code: '1010', name: 'Petty Cash', type: 'asset', category: 'Current Asset', normalBalance: 'debit', isSystemAccount: true, description: 'Petty cash fund' },
  { code: '1020', name: 'Bank Accounts', type: 'asset', category: 'Current Asset', normalBalance: 'debit', isSystemAccount: true, description: 'Bank account balances' },
  { code: '1100', name: 'Accounts Receivable', type: 'asset', category: 'Current Asset', normalBalance: 'debit', isSystemAccount: true, description: 'Amounts owed by customers' },
  { code: '1200', name: 'Inventory', type: 'asset', category: 'Current Asset', normalBalance: 'debit', isSystemAccount: true, description: 'Goods held for sale' },
  { code: '1300', name: 'Prepaid Expenses', type: 'asset', category: 'Current Asset', normalBalance: 'debit', isSystemAccount: true, description: 'Expenses paid in advance' },
  { code: '1400', name: 'Fixed Assets', type: 'asset', category: 'Non-Current Asset', normalBalance: 'debit', isSystemAccount: true, description: 'Long-term tangible assets' },
  { code: '1410', name: 'Equipment', type: 'asset', category: 'Non-Current Asset', normalBalance: 'debit', parentCode: '1400', isSystemAccount: true, description: 'Machinery and equipment' },
  { code: '1420', name: 'Furniture & Fittings', type: 'asset', category: 'Non-Current Asset', normalBalance: 'debit', parentCode: '1400', isSystemAccount: true, description: 'Office furniture and fittings' },
  { code: '1430', name: 'Motor Vehicles', type: 'asset', category: 'Non-Current Asset', normalBalance: 'debit', parentCode: '1400', isSystemAccount: true, description: 'Company vehicles' },
  { code: '1500', name: 'Accumulated Depreciation', type: 'asset', category: 'Non-Current Asset', normalBalance: 'credit', isSystemAccount: true, description: 'Total depreciation on fixed assets' },

  // LIABILITIES (2000–2999)
  { code: '2000', name: 'Accounts Payable (Trade)', type: 'liability', category: 'Current Liability', normalBalance: 'credit', isSystemAccount: true, description: 'Amounts owed to suppliers' },
  { code: '2100', name: 'Accrued Expenses', type: 'liability', category: 'Current Liability', normalBalance: 'credit', isSystemAccount: true, description: 'Expenses incurred but not yet paid' },
  { code: '2200', name: 'Other Accounts Payable', type: 'liability', category: 'Current Liability', normalBalance: 'credit', isSystemAccount: true, description: 'Non-trade payables' },
  { code: '2300', name: 'Loans Payable', type: 'liability', category: 'Non-Current Liability', normalBalance: 'credit', isSystemAccount: true, description: 'Long-term loan obligations' },
  { code: '2400', name: 'Taxes Payable', type: 'liability', category: 'Current Liability', normalBalance: 'credit', isSystemAccount: true, description: 'Tax obligations (VAT, PAYE, etc.)' },
  { code: '2500', name: 'Payroll Liabilities (SSNIT)', type: 'liability', category: 'Current Liability', normalBalance: 'credit', isSystemAccount: true, description: 'SSNIT contributions payable' },

  // EQUITY (3000–3999)
  { code: '3000', name: "Owner's Capital", type: 'equity', category: 'Equity', normalBalance: 'credit', isSystemAccount: true, description: 'Capital invested by owners' },
  { code: '3100', name: 'Retained Earnings', type: 'equity', category: 'Equity', normalBalance: 'credit', isSystemAccount: true, description: 'Accumulated net income' },
  { code: '3200', name: "Owner's Drawings / Dividends", type: 'equity', category: 'Equity', normalBalance: 'debit', isSystemAccount: true, description: 'Withdrawals by owners' },

  // REVENUE (4000–4999)
  { code: '4000', name: 'Sales Revenue', type: 'revenue', category: 'Operating Revenue', normalBalance: 'credit', isSystemAccount: true, description: 'Revenue from goods sold' },
  { code: '4010', name: 'Service Revenue', type: 'revenue', category: 'Operating Revenue', normalBalance: 'credit', isSystemAccount: true, description: 'Revenue from services rendered' },
  { code: '4100', name: 'Interest Income', type: 'revenue', category: 'Other Income', normalBalance: 'credit', isSystemAccount: true, description: 'Interest earned on deposits' },
  { code: '4200', name: 'Other Income', type: 'revenue', category: 'Other Income', normalBalance: 'credit', isSystemAccount: true, description: 'Miscellaneous income' },

  // COST OF GOODS SOLD (5000–5999)
  { code: '5000', name: 'Purchases', type: 'cogs', category: 'Cost of Goods Sold', normalBalance: 'debit', isSystemAccount: true, description: 'Purchases of goods for resale' },
  { code: '5100', name: 'Direct Labour', type: 'cogs', category: 'Cost of Goods Sold', normalBalance: 'debit', isSystemAccount: true, description: 'Direct labour costs' },
  { code: '5200', name: 'Manufacturing Overhead', type: 'cogs', category: 'Cost of Goods Sold', normalBalance: 'debit', isSystemAccount: true, description: 'Factory overhead costs' },

  // EXPENSES (6000–6999)
  { code: '6000', name: 'Salaries & Wages', type: 'expense', category: 'Operating Expense', normalBalance: 'debit', isSystemAccount: true, description: 'Employee salaries and wages' },
  { code: '6100', name: 'Rent Expense', type: 'expense', category: 'Operating Expense', normalBalance: 'debit', isSystemAccount: true, description: 'Office and facility rent' },
  { code: '6200', name: 'Utilities', type: 'expense', category: 'Operating Expense', normalBalance: 'debit', isSystemAccount: true, description: 'Electricity, water, internet' },
  { code: '6300', name: 'Office Supplies', type: 'expense', category: 'Operating Expense', normalBalance: 'debit', isSystemAccount: true, description: 'Stationery and office materials' },
  { code: '6400', name: 'Marketing & Advertising', type: 'expense', category: 'Operating Expense', normalBalance: 'debit', isSystemAccount: true, description: 'Advertising and promotional costs' },
  { code: '6500', name: 'Insurance', type: 'expense', category: 'Operating Expense', normalBalance: 'debit', isSystemAccount: true, description: 'Business insurance premiums' },
  { code: '6600', name: 'Depreciation Expense', type: 'expense', category: 'Operating Expense', normalBalance: 'debit', isSystemAccount: true, description: 'Depreciation on fixed assets' },
  { code: '6700', name: 'Professional Fees', type: 'expense', category: 'Operating Expense', normalBalance: 'debit', isSystemAccount: true, description: 'Legal, accounting, consulting fees' },
  { code: '6800', name: 'Bank / Mobile Money Charges', type: 'expense', category: 'Operating Expense', normalBalance: 'debit', isSystemAccount: true, description: 'Bank fees and MoMo charges' },
  { code: '6900', name: 'Miscellaneous Expenses', type: 'expense', category: 'Operating Expense', normalBalance: 'debit', isSystemAccount: true, description: 'Other uncategorised expenses' },
];

module.exports = { defaultChartOfAccounts };