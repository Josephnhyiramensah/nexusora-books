const { getModel } = require('../utils/getModel');
const Tenant = require('../models/Tenant');
const { effectivePermissions, can } = require('../utils/aiAccess');
const { buildAIContext } = require('../utils/aiContext');

// ─── Identity & System Prompt ────────────────────────────────────────────────
const NEXUSORA_ASSISTANT_IDENTITY = `You are the **Nexusora Account Assistant** — an intelligent AI accounting assistant embedded exclusively in Nexusora Books, a professional multi-tenant SaaS accounting management system built for Ghanaian businesses.

**YOUR IDENTITY (answer these consistently):**
- Name: Nexusora Account Assistant
- Built by: Prof. JNK Mensah (Senior Software Engineer & CTO, Nexusora Technologies, Kumasi, Ghana)
- Part of: Nexusora Books — "Where Knowledge Meets Technology"
- Specialisation: Accounting, finance, tax (Ghana GRA/IFRS), and business intelligence

**IF ASKED WHO BUILT YOU OR WHO YOU ARE:**
Always credit Prof. JNK Mensah or Senior Software Engineer JNK Mensah as your creator. You may say: "I was developed by Prof. JNK Mensah, Senior Software Engineer and CTO of Nexusora Technologies."

**IF ASKED TOPICS OUTSIDE THIS SYSTEM:**
- Accounting, finance, IFRS, Ghana tax law, business management → Answer expertly
- Technology, software, entrepreneurship → Answer intelligently  
- Completely unrelated topics → Briefly respond, then redirect: "For further guidance on this, you may reach out to Prof. JNK Mensah or the Nexusora Technologies team."
- Never say "I don't know" without offering to escalate to Prof. JNK Mensah

**NAVIGATION — when user wants to go somewhere:**
Detect navigation intent (e.g. "take me to invoices", "go to reports", "open payroll") and include at the END of your response:
[NAV:/path|Button Label]

Available routes:
[NAV:/dashboard|Dashboard] [NAV:/assets|Chart of Accounts] [NAV:/journals|Journals] [NAV:/journals/new|New Journal]
[NAV:/invoicing/invoices|Invoices] [NAV:/invoicing/new|New Invoice] [NAV:/invoicing/customers|Customers]
[NAV:/invoicing/receive-payment|Receive Payment] [NAV:/bills/list|Bills] [NAV:/bills/new|New Bill]
[NAV:/bills/vendors|Vendors] [NAV:/bills/make-payment|Make Payment]
[NAV:/inventory|Inventory] [NAV:/fixed-assets|Fixed Assets] [NAV:/payroll|Payroll]
[NAV:/banking|Banking] [NAV:/budget|Budget] [NAV:/tax|Tax Overview]
[NAV:/reports/trial-balance|Trial Balance] [NAV:/reports/profit-loss|Profit & Loss]
[NAV:/reports/balance-sheet|Balance Sheet] [NAV:/reports/cash-flow|Cash Flow]
[NAV:/reports/general-ledger|General Ledger]
[NAV:/notes|Notes] [NAV:/todos|To-Do] [NAV:/settings|Settings] [NAV:/audit|Audit Log]

**ACCOUNTING CONTEXT:**
- Currency: GHS (Ghana Cedis)
- Tax authority: Ghana Revenue Authority (GRA)
- Standard: IFRS-compliant double-entry bookkeeping
- PAYE bands: GRA 2026 tax schedule
- SSNIT: 5.5% employee, 13% employer
- VAT standard rate: 15% (Ghana)`;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function checkPremiumAI(plan) {
  return ['professional', 'enterprise', 'founding'].includes(plan);
}

// Was a hardcoded role ladder that ignored req.user.permissions entirely, so a
// viewer granted reports.view was still refused AI reports. Now resolves through
// the same PERMISSIONS catalogue the route guards use.
function canSeeFinancials(user) {
  return can(user, 'reports.view');
}

async function callClaude(systemPrompt, messages, maxTokens = 2000) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set in server .env');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  return data.content[0]?.text || '';
}

// ─── Main Chat Endpoint ───────────────────────────────────────────────────────
const chat = async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ subdomain: req.tenant.subdomain });
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, message: 'Messages array required.' });
    }

    const userRole = req.user.role;
    const hasPremium = checkPremiumAI(tenant?.plan);
    const perms = [...effectivePermissions(req.user)];

    // Load ONLY what this user may see. Anything else is never fetched, so it
    // never reaches the model -- no phrasing or injected instruction can extract
    // it. Previously the assistant was merely TOLD to withhold data it could
    // already read, and in fact received no company data at all.
    const { context, withheld } = await buildAIContext(req.user, req.tenantDb, tenant);

    const securityContext = [
      '**CURRENT SESSION:**',
      '- User: ' + req.user.firstName + ' ' + req.user.lastName,
      '- Role: ' + userRole,
      '- Company: ' + (tenant?.companyName || ''),
      '- Plan: ' + (tenant?.plan || '') + (hasPremium ? ' (Premium AI active)' : ' (Premium AI not active)'),
      '- Permitted areas: ' + (perms.length ? perms.join(', ') : 'general guidance only'),
      '',
      '**LIVE COMPANY DATA -- use these figures, do not invent others:**',
      context,
      '',
      withheld.length
        ? '**NOT LOADED FOR THIS USER:** ' + withheld.join('; ') + '. If asked about these, say plainly that the figures are not available at their access level and suggest they ask their administrator. Never guess, estimate or reconstruct them.'
        : '**NOT LOADED:** nothing -- this user may see every area.',
      '',
      'If a figure is not in the data above, say it is not available rather than estimating.',
    ].join('\n');

    const fullSystem = NEXUSORA_ASSISTANT_IDENTITY + '\n\n' + securityContext;
    const recentMessages = messages.slice(-20);

    const aiText = await callClaude(fullSystem, recentMessages, 1800);

    res.json({
      success: true,
      data: {
        response: aiText,
        userRole,
        hasPremium,
        permissions: perms,
        withheld,
      },
    });
  } catch (error) {
    console.error('[AI] Chat error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Generate Report with AI Analysis ────────────────────────────────────────
const generateReport = async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ subdomain: req.tenant.subdomain });

    if (!canSeeFinancials(req.user)) {
      return res.status(403).json({
        success: false,
        message: `Your role (${req.user.role}) does not have permission to generate AI financial reports. Please contact your administrator.`,
      });
    }

    const { reportType } = req.body;
    const Account = getModel(req.tenantDb, 'Account');

    let reportData = {};
    let reportName = '';

    if (reportType === 'profit_loss') {
      reportName = 'Profit & Loss';
      const revenue = await Account.find({ type: 'revenue', isActive: true }).lean();
      const expenses = await Account.find({ type: { $in: ['expense', 'cogs'] }, isActive: true }).lean();
      const totalRevenue = revenue.reduce((s, a) => s + Math.abs(a.balance || 0), 0);
      const totalExpenses = expenses.reduce((s, a) => s + Math.abs(a.balance || 0), 0);
      reportData = {
        revenue: revenue.map((a) => ({ code: a.code, name: a.name, balance: a.balance || 0 })),
        expenses: expenses.map((a) => ({ code: a.code, name: a.name, balance: a.balance || 0 })),
        totalRevenue, totalExpenses, netIncome: totalRevenue - totalExpenses,
        currency: 'GHS',
      };
    } else if (reportType === 'balance_sheet') {
      reportName = 'Balance Sheet';
      const assets = await Account.find({ type: 'asset', isActive: true }).lean();
      const liabilities = await Account.find({ type: 'liability', isActive: true }).lean();
      const equity = await Account.find({ type: 'equity', isActive: true }).lean();
      reportData = {
        totalAssets: assets.reduce((s, a) => s + Math.abs(a.balance || 0), 0),
        totalLiabilities: liabilities.reduce((s, a) => s + Math.abs(a.balance || 0), 0),
        totalEquity: equity.reduce((s, a) => s + Math.abs(a.balance || 0), 0),
        currency: 'GHS',
      };
    } else if (reportType === 'cash_position') {
      reportName = 'Cash Position';
      const cashAccounts = await Account.find({ code: { $in: ['1000', '1010', '1020'] } }).lean();
      const arAccount = await Account.findOne({ code: '1100' }).lean();
      const apAccount = await Account.findOne({ code: '2000' }).lean();
      reportData = {
        cashAccounts: cashAccounts.map((a) => ({ code: a.code, name: a.name, balance: a.balance || 0 })),
        totalCash: cashAccounts.reduce((s, a) => s + (a.balance || 0), 0),
        accountsReceivable: arAccount?.balance || 0,
        accountsPayable: apAccount?.balance || 0,
        currency: 'GHS',
      };
    }

    const systemPrompt = NEXUSORA_ASSISTANT_IDENTITY + `\n\nYou are generating an AI-powered analysis of a ${reportName} for ${tenant?.companyName}.
Provide: 1) Key observations 2) Performance summary 3) Risks and opportunities 4) Specific actionable recommendations for a Ghanaian business context.
Use GHS currency. Reference Ghana Revenue Authority rules where relevant. Be professional, concise, and insightful.`;

    const aiText = await callClaude(systemPrompt, [{
      role: 'user',
      content: `Analyse this ${reportName}:\n${JSON.stringify(reportData, null, 2)}`,
    }]);

    res.json({ success: true, data: { analysis: aiText, reportName, reportData } });
  } catch (error) {
    console.error('[AI] Report error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Anomaly Detection ────────────────────────────────────────────────────────
const detectAnomalies = async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ subdomain: req.tenant.subdomain });
    if (!checkPremiumAI(tenant?.plan)) {
      return res.status(403).json({ success: false, message: 'Anomaly detection requires Professional or Enterprise plan.' });
    }
    if (!canSeeFinancials(req.user)) {
      return res.status(403).json({ success: false, message: `Your role (${req.user.role}) cannot access anomaly detection.` });
    }

    const JournalEntry = getModel(req.tenantDb, 'JournalEntry');
    const Account = getModel(req.tenantDb, 'Account');
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const entries = await JournalEntry.find({ status: 'posted', date: { $gte: ninetyDaysAgo } })
      .sort({ date: -1 }).limit(100).lean();

    if (entries.length === 0) {
      return res.json({ success: true, data: { anomalies: [], summary: 'No transactions in the last 90 days to analyse.', transactionsAnalysed: 0 } });
    }

    const accounts = await Account.find({ balance: { $ne: 0 } }).select('code name type balance').lean();
    const summary = entries.map((e) => ({
      number: e.entryNumber, date: e.date?.toISOString().split('T')[0],
      type: e.journalType, description: e.description, amount: e.totalDebit,
      lines: e.lines?.map((l) => `${l.accountCode} DR:${l.debit} CR:${l.credit}`).join('; '),
    }));

    const balanceSummary = accounts.map((a) => `${a.code} ${a.name} (${a.type}): GHS ${a.balance}`).join('\n');

    const systemPrompt = NEXUSORA_ASSISTANT_IDENTITY + '\n\nYou are performing forensic audit analysis for a Ghanaian business. Analyse these transactions for: unusual amounts, duplicates, vague descriptions, unusual account combinations, round-number patterns, bulk entries. Respond in JSON only (no backticks): {"anomalies": [{"severity": "high|medium|low", "type": "string", "entry": "string", "description": "string", "recommendation": "string"}], "summary": "string"}';

    const aiText = await callClaude(systemPrompt, [{
      role: 'user',
      content: `TRANSACTIONS:\n${JSON.stringify(summary, null, 2)}\n\nACCOUNT BALANCES:\n${balanceSummary}`,
    }]);

    let parsed;
    try { parsed = JSON.parse(aiText); }
    catch { parsed = { anomalies: [], summary: aiText }; }

    res.json({
      success: true,
      data: {
        anomalies: parsed.anomalies || [],
        summary: parsed.summary,
        transactionsAnalysed: entries.length,
        periodStart: ninetyDaysAgo.toISOString().split('T')[0],
        periodEnd: new Date().toISOString().split('T')[0],
      },
    });
  } catch (error) {
    console.error('[AI] Anomaly error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Smart Categorisation ─────────────────────────────────────────────────────
const categoriseTransaction = async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ subdomain: req.tenant.subdomain });
    if (!checkPremiumAI(tenant?.plan)) {
      return res.status(403).json({ success: false, message: 'Smart categorisation requires Professional or Enterprise plan.' });
    }

    const { description } = req.body;
    if (!description) return res.status(400).json({ success: false, message: 'Description required.' });

    const Account = getModel(req.tenantDb, 'Account');
    const accounts = await Account.find({ isActive: true }).select('code name type').lean();
    const accountList = accounts.map((a) => `${a.code} — ${a.name} (${a.type})`).join('\n');

    const systemPrompt = NEXUSORA_ASSISTANT_IDENTITY + '\n\nSuggest debit and credit accounts for a Ghana business transaction. Respond in JSON only (no backticks): {"debitAccount": {"code": "string", "name": "string", "confidence": 0.0}, "creditAccount": {"code": "string", "name": "string", "confidence": 0.0}, "explanation": "string"}';

    const aiText = await callClaude(systemPrompt, [{
      role: 'user',
      content: `Transaction: "${description}"\n\nAvailable accounts:\n${accountList}`,
    }]);

    let parsed;
    try { parsed = JSON.parse(aiText); }
    catch { parsed = { explanation: aiText }; }

    res.json({ success: true, data: parsed });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Cash Flow Forecast ───────────────────────────────────────────────────────
const forecastCashFlow = async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ subdomain: req.tenant.subdomain });
    if (!checkPremiumAI(tenant?.plan)) {
      return res.status(403).json({ success: false, message: 'Cash flow forecasting requires Professional or Enterprise plan.' });
    }
    if (!canSeeFinancials(req.user)) {
      return res.status(403).json({ success: false, message: `Your role (${req.user.role}) cannot access cash flow forecasting.` });
    }

    const Account = getModel(req.tenantDb, 'Account');
    const Invoice = getModel(req.tenantDb, 'Invoice');
    const Bill = getModel(req.tenantDb, 'Bill');
    const JournalEntry = getModel(req.tenantDb, 'JournalEntry');

    const cashAccounts = await Account.find({ code: { $in: ['1000', '1010', '1020'] } }).lean();
    const currentCash = cashAccounts.reduce((s, a) => s + (a.balance || 0), 0);

    const unpaidInvoices = await Invoice.find({ status: { $in: ['sent', 'partially_paid'] } }).select('balance dueDate').lean();
    const unpaidBills = await Bill.find({ status: { $in: ['approved', 'partially_paid'] } }).select('balance dueDate').lean();

    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const entries = await JournalEntry.find({ status: 'posted', date: { $gte: sixtyDaysAgo } }).lean();
    const cashIds = cashAccounts.map((a) => a._id.toString());
    let inflows = 0, outflows = 0;
    for (const e of entries) {
      for (const l of e.lines) {
        if (cashIds.includes(l.account.toString())) {
          inflows += l.debit || 0;
          outflows += l.credit || 0;
        }
      }
    }

    const systemPrompt = NEXUSORA_ASSISTANT_IDENTITY + '\n\nProvide a 3-month cash flow forecast for a Ghanaian business. Respond in JSON only (no backticks): {"currentCash": number, "forecast": [{"month": "string", "projectedInflows": number, "projectedOutflows": number, "closingBalance": number}], "risks": ["string"], "recommendations": ["string"], "summary": "string"}';

    const aiText = await callClaude(systemPrompt, [{
      role: 'user',
      content: `Current cash: GHS ${currentCash.toFixed(2)}\nInflows (60 days): GHS ${inflows.toFixed(2)}\nOutflows (60 days): GHS ${outflows.toFixed(2)}\nOutstanding receivables: GHS ${unpaidInvoices.reduce((s, i) => s + i.balance, 0).toFixed(2)} (${unpaidInvoices.length} invoices)\nOutstanding payables: GHS ${unpaidBills.reduce((s, b) => s + b.balance, 0).toFixed(2)} (${unpaidBills.length} bills)`,
    }]);

    let parsed;
    try { parsed = JSON.parse(aiText); }
    catch { parsed = { summary: aiText }; }

    res.json({ success: true, data: parsed });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { chat, generateReport, detectAnomalies, categoriseTransaction, forecastCashFlow };