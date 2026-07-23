import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { TenantProvider, useTenant } from './context/TenantContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import HomeScreen from './pages/HomeScreen';
import ModuleShell from './components/layout/ModuleShell';
import AuditLogPage from './modules/audit/AuditLogPage';
import { FiShield } from 'react-icons/fi';

import FinancialAnalyticsPage from './modules/accounts/FinancialAnalyticsPage';


// Icons
import {
  FiList, FiFileText, FiPlusCircle, FiDollarSign, FiBookOpen,
  FiTrendingUp, FiTrendingDown, FiUsers, FiSend,
  FiCreditCard, FiShoppingBag, FiPieChart, FiBarChart2, FiZap,
} from 'react-icons/fi';

// Phase 2
import AccountListPage from './modules/accounts/AccountListPage';
import AccountTypePage from './modules/accounts/AccountTypePage';
import JournalListPage from './modules/journals/JournalListPage';
import JournalFormPage from './modules/journals/JournalFormPage';

// Phase 3
import CustomerListPage from './modules/invoicing/CustomerListPage';
import InvoiceListPage from './modules/invoicing/InvoiceListPage';
import InvoiceFormPage from './modules/invoicing/InvoiceFormPage';
import ReceivePaymentPage from './modules/invoicing/ReceivePaymentPage';
import VendorListPage from './modules/bills/VendorListPage';
import BillListPage from './modules/bills/BillListPage';
import BillFormPage from './modules/bills/BillFormPage';
import MakePaymentPage from './modules/bills/MakePaymentPage';
import InventoryPage from './modules/inventory/InventoryPage';
import FixedAssetsPage from './modules/fixed-assets/FixedAssetsPage';
import PayrollPage from './modules/payroll/PayrollPage';
import BankingPage from './modules/banking/BankingPage';
import BudgetPage from './modules/budget/BudgetPage';
import TaxPage from './modules/tax/TaxPage';

// Phase 4
import TrialBalancePage from './modules/reports/TrialBalancePage';
import ProfitLossPage from './modules/reports/ProfitLossPage';
import BalanceSheetPage from './modules/reports/BalanceSheetPage';
import CashFlowPage from './modules/reports/CashFlowPage';
import GeneralLedgerPage from './modules/reports/GeneralLedgerPage';

// Phase 5
import DashboardFullPage from './modules/dashboard/DashboardPage';
import NotesPage from './modules/notes/NotesPage';
import TodosPage from './modules/todos/TodosPage';
import SettingsPage from './modules/settings/SettingsPage';

// Phase 6
import AIPage from './modules/ai/AIPage';
// master page 
import RegisterPage from './pages/RegisterPage';
import MasterAdminPage from './pages/MasterAdminPage';

import UpgradePage from './pages/UpgradePage';
import PaymentVerifyPage from './pages/PaymentVerifyPage';

// ─── Sidebar configs ───────────────────────────────────────────────
const journalsSidebar = [
  { path: '/journals',              label: 'All Entries',          icon: FiList,       exact: true },
  { path: '/journals/general',      label: 'General',              icon: FiBookOpen },
  { path: '/journals/sales',        label: 'Sales',                icon: FiTrendingUp },
  { path: '/journals/purchases',    label: 'Purchases',            icon: FiTrendingDown },
  { path: '/journals/cash-receipts',label: 'Cash Receipts',        icon: FiDollarSign },
  { path: '/journals/cash-payments',label: 'Cash Payments',        icon: FiFileText },
  { path: '/journals/new',          label: '+ New Entry',          icon: FiPlusCircle },
];

const invoicingSidebar = [
  { path: '/invoicing/customers',       label: 'Customers',        icon: FiUsers },
  { path: '/invoicing/invoices',        label: 'Invoices',         icon: FiSend },
  { path: '/invoicing/new',             label: '+ New Invoice',    icon: FiPlusCircle },
  { path: '/invoicing/receive-payment', label: 'Receive Payment',  icon: FiDollarSign },
];

const billsSidebar = [
  { path: '/bills/vendors',      label: 'Vendors',       icon: FiShoppingBag },
  { path: '/bills/list',         label: 'Bills',         icon: FiCreditCard },
  { path: '/bills/new',          label: '+ New Bill',    icon: FiPlusCircle },
  { path: '/bills/make-payment', label: 'Make Payment',  icon: FiDollarSign },
];

const reportsSidebar = [
  { path: '/reports/trial-balance',  label: 'Trial Balance',   icon: FiList },
  { path: '/reports/profit-loss',    label: 'Profit & Loss',   icon: FiTrendingUp },
  { path: '/reports/balance-sheet',  label: 'Balance Sheet',   icon: FiPieChart },
  { path: '/reports/cash-flow',      label: 'Cash Flow',       icon: FiDollarSign },
  { path: '/reports/general-ledger', label: 'General Ledger',  icon: FiBookOpen },
];



const g = (path, label) => [{ path, label: `All ${label}`, icon: FiList, exact: true }];

// ─── Root redirect ────────────────────────────────────────────────────────────
// Tenant subdomain (kgr.nexusorabooks.com) → "/" opens the workspace.
// Apex domain (nexusorabooks.com) → NO tenant → public registration page.
// Never route an apex visitor into    client's workspace.
function RootRedirect() {
  const { loading, isPublic } = useTenant();
  if (loading) return null;
  return <Navigate to={isPublic ? '/register' : '/home'} replace />;
}

// ─── App ───────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <TenantProvider>
        <AuthProvider>
          <Routes>

            {/* ── Public ── */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/"      element={<RootRedirect />} />

            {/* ── Home Screen (tile grid) ── */}
            <Route path="/home" element={
              <ProtectedRoute><HomeScreen /></ProtectedRoute>
            } />

            {/* ── Dashboard ── */}
            <Route element={<ProtectedRoute><ModuleShell moduleTitle="Dashboard" sidebarItems={g('/dashboard','Dashboard')} /></ProtectedRoute>}>
              <Route path="/dashboard" element={<DashboardFullPage />} />
            </Route>

            {/* ── AI Assistant ── */}
            <Route element={<ProtectedRoute><ModuleShell moduleTitle="AI Assistant" sidebarItems={[{ path: '/ai', label: 'AI Tools', icon: FiZap, exact: true }]} /></ProtectedRoute>}>
              <Route path="/ai" element={<AIPage />} />
            </Route>

            {/* ── Assets (Chart of Accounts) ── */}
            <Route element={<ProtectedRoute><ModuleShell moduleTitle="Assets" sidebarItems={g('/assets','Accounts')} /></ProtectedRoute>}>
              <Route path="/assets"   element={<AccountListPage />} />
              <Route path="/assets/*" element={<AccountListPage />} />
            </Route>

            {/* ── Liabilities ── */}
            <Route element={<ProtectedRoute><ModuleShell moduleTitle="Liabilities" sidebarItems={[{ path: '/liabilities', label: 'All Liabilities', icon: FiList, exact: true }]} /></ProtectedRoute>}>
              <Route path="/liabilities" element={<AccountTypePage accountType="liability" title="Liabilities" codeRange="2000–2999" />} />
            </Route>

            {/* ── Equity ── */}
            <Route element={<ProtectedRoute><ModuleShell moduleTitle="Equity" sidebarItems={[{ path: '/equity', label: 'All Equity', icon: FiList, exact: true }]} /></ProtectedRoute>}>
              <Route path="/equity" element={<AccountTypePage accountType="equity" title="Equity" codeRange="3000–3999" />} />
            </Route>

            {/* ── Revenue ── */}
            <Route element={<ProtectedRoute><ModuleShell moduleTitle="Revenue" sidebarItems={[{ path: '/revenue', label: 'All Revenue', icon: FiList, exact: true }]} /></ProtectedRoute>}>
              <Route path="/revenue" element={<AccountTypePage accountType="revenue" title="Revenue" codeRange="4000–4999" />} />
            </Route>

            {/* ── Expenses ── */}
            <Route element={<ProtectedRoute><ModuleShell moduleTitle="Expenses" sidebarItems={[{ path: '/expenses', label: 'All Expenses', icon: FiList, exact: true }]} /></ProtectedRoute>}>
              <Route path="/expenses" element={<AccountTypePage accountType="expense" title="Expenses & COGS" codeRange="5000–6999" />} />
            </Route>

            {/* ── Journals ── */}
            <Route element={<ProtectedRoute><ModuleShell moduleTitle="Journals" sidebarItems={journalsSidebar} /></ProtectedRoute>}>
              <Route path="/journals"               element={<JournalListPage />} />
              <Route path="/journals/general"       element={<JournalListPage />} />
              <Route path="/journals/sales"         element={<JournalListPage />} />
              <Route path="/journals/purchases"     element={<JournalListPage />} />
              <Route path="/journals/cash-receipts" element={<JournalListPage />} />
              <Route path="/journals/cash-payments" element={<JournalListPage />} />
              <Route path="/journals/new"           element={<JournalFormPage />} />
            </Route>

            {/* ── Invoicing ── */}
            <Route element={<ProtectedRoute><ModuleShell moduleTitle="Invoicing" sidebarItems={invoicingSidebar} /></ProtectedRoute>}>
              <Route path="/invoicing"                    element={<Navigate to="/invoicing/invoices" replace />} />
              <Route path="/invoicing/customers"          element={<CustomerListPage />} />
              <Route path="/invoicing/invoices"           element={<InvoiceListPage />} />
              <Route path="/invoicing/new"                element={<InvoiceFormPage />} />
              <Route path="/invoicing/receive-payment"    element={<ReceivePaymentPage />} />
            </Route>

            {/* ── Bills & Payments ── */}
            <Route element={<ProtectedRoute><ModuleShell moduleTitle="Bills & Payments" sidebarItems={billsSidebar} /></ProtectedRoute>}>
              <Route path="/bills"               element={<Navigate to="/bills/list" replace />} />
              <Route path="/bills/vendors"       element={<VendorListPage />} />
              <Route path="/bills/list"          element={<BillListPage />} />
              <Route path="/bills/new"           element={<BillFormPage />} />
              <Route path="/bills/make-payment"  element={<MakePaymentPage />} />
            </Route>

            {/* ── Inventory ── */}
            <Route element={<ProtectedRoute><ModuleShell moduleTitle="Inventory" sidebarItems={g('/inventory','Items')} /></ProtectedRoute>}>
              <Route path="/inventory" element={<InventoryPage />} />
            </Route>

            {/* ── Fixed Assets ── */}
            <Route element={<ProtectedRoute><ModuleShell moduleTitle="Fixed Assets" sidebarItems={g('/fixed-assets','Assets')} /></ProtectedRoute>}>
              <Route path="/fixed-assets" element={<FixedAssetsPage />} />
            </Route>

            {/* ── Payroll ── */}
            <Route element={<ProtectedRoute permission="payroll.view" roles={['super_admin','admin','accountant']}><ModuleShell moduleTitle="Payroll" sidebarItems={g('/payroll','Payroll')} /></ProtectedRoute>}>
              <Route path="/payroll" element={<PayrollPage />} />
            </Route>

            {/* ── Banking ── */}
            <Route element={<ProtectedRoute permission="banking.view" roles={['super_admin','admin','accountant']}><ModuleShell moduleTitle="Banking" sidebarItems={g('/banking','Bank Accounts')} /></ProtectedRoute>}>
              <Route path="/banking" element={<BankingPage />} />
            </Route>

            {/* ── Budget ── */}
            <Route element={<ProtectedRoute permission="budget.view" roles={['super_admin','admin','accountant']}><ModuleShell moduleTitle="Budget" sidebarItems={g('/budget','Budgets')} /></ProtectedRoute>}>
              <Route path="/budget" element={<BudgetPage />} />
            </Route>

            {/* ── Tax ── */}
            <Route element={<ProtectedRoute permission="tax.view" roles={['super_admin','admin','accountant']}><ModuleShell moduleTitle="Tax" sidebarItems={g('/tax','Tax')} /></ProtectedRoute>}>
              <Route path="/tax" element={<TaxPage />} />
            </Route>

            {/* ── Reports ── */}
            <Route element={<ProtectedRoute permission="reports.view" roles={['super_admin','admin','accountant']}><ModuleShell moduleTitle="Reports" sidebarItems={reportsSidebar} /></ProtectedRoute>}>
              <Route path="/reports"                   element={<TrialBalancePage />} />
              <Route path="/reports/trial-balance"     element={<TrialBalancePage />} />
              <Route path="/reports/profit-loss"       element={<ProfitLossPage />} />
              <Route path="/reports/balance-sheet"     element={<BalanceSheetPage />} />
              <Route path="/reports/cash-flow"         element={<CashFlowPage />} />
              <Route path="/reports/general-ledger"    element={<GeneralLedgerPage />} />
            </Route>

            {/* ── Notes ── */}
            <Route element={<ProtectedRoute><ModuleShell moduleTitle="Notes" sidebarItems={g('/notes','Notes')} /></ProtectedRoute>}>
              <Route path="/notes" element={<NotesPage />} />
            </Route>

            {/* ── To-Do ── */}
            <Route element={<ProtectedRoute><ModuleShell moduleTitle="To-Do" sidebarItems={g('/todos','Tasks')} /></ProtectedRoute>}>
              <Route path="/todos" element={<TodosPage />} />
            </Route>

            {/* ── Settings ── */}
            <Route element={<ProtectedRoute><ModuleShell moduleTitle="Settings" sidebarItems={g('/settings','Settings')} /></ProtectedRoute>}>
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            {/* Audit Log */}
<Route element={<ProtectedRoute permission="audit.view" roles={['super_admin','admin']}><ModuleShell moduleTitle="Audit Log" sidebarItems={[{ path: '/audit', label: 'Audit Trail', icon: FiShield, exact: true }]} /></ProtectedRoute>}>
  <Route path="/audit" element={<AuditLogPage />} />
</Route>

{/* ── Public Registration ── */}
<Route path="/register" element={<RegisterPage />} />
<Route path="/pricing" element={<RegisterPage />} />

{/* ── Developer Console ── */}
<Route path="/master-admin" element={<MasterAdminPage />} />
<Route path="/nexusora-admin" element={<MasterAdminPage />} />

{/* ── Subscription ── */}
<Route path="/upgrade" element={<UpgradePage />} />
<Route path="/payment/verify" element={<PaymentVerifyPage />} />

{/* Assets — Chart of Accounts + Analytics */}
            <Route element={<ProtectedRoute><ModuleShell moduleTitle="Assets" sidebarItems={[
              { path: '/assets', label: 'Chart of Accounts', icon: FiList, exact: true },
              { path: '/assets/analytics', label: '📊 Analytics', icon: FiBarChart2 },
            ]} /></ProtectedRoute>}>
              <Route path="/assets"           element={<AccountListPage />} />
            <Route path="/assets/analytics" element={<ProtectedRoute permission="analytics.view" roles={['super_admin','admin','accountant']}><FinancialAnalyticsPage /></ProtectedRoute>} />
              </Route>
            
            {/* ── 404 ── */}
            <Route path="*" element={
              <div style={{ padding: 40, textAlign: 'center' }}>
                <h2 style={{ color: 'var(--text-primary)' }}>404 — Page Not Found</h2>
              </div>
            } />

          </Routes>
        </AuthProvider>
      </TenantProvider>
    </BrowserRouter>
  );
}