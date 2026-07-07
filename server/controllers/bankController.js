const { getModel } = require('../utils/getModel');
const { logAudit } = require('../middleware/auditMiddleware');

const getBankAccounts = async (req, res) => {
  try {
    const BankAccount = getModel(req.tenantDb, 'BankAccount');
    const accounts = await BankAccount.find({}).sort({ accountName: 1 }).lean();
    res.json({ success: true, data: accounts, count: accounts.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch bank accounts.' });
  }
};

const createBankAccount = async (req, res) => {
  try {
    const BankAccount = getModel(req.tenantDb, 'BankAccount');
    const Account = getModel(req.tenantDb, 'Account');
    const { accountName, bankName, accountNumber, accountType, currency } = req.body;

    if (!accountName || !bankName) return res.status(400).json({ success: false, message: 'Account name and bank name required.' });

    const ledgerAccount = await Account.findOne({ code: '1020' });

    const bankAcct = await BankAccount.create({
      accountName, bankName, accountNumber,
      accountType: accountType || 'checking',
      currency: currency || 'GHS',
      currentBalance: 0,
      ledgerAccount: ledgerAccount?._id,
      createdBy: req.user._id,
    });

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'create', module: 'bank',
      entityId: bankAcct._id, entityType: 'BankAccount',
      description: `Created bank account: ${accountName} at ${bankName}`,
    }, req);

    res.status(201).json({ success: true, message: 'Bank account created.', data: bankAcct });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create bank account.' });
  }
};

const updateBankAccount = async (req, res) => {
  try {
    const BankAccount = getModel(req.tenantDb, 'BankAccount');
    const acct = await BankAccount.findById(req.params.id);
    if (!acct) return res.status(404).json({ success: false, message: 'Bank account not found.' });

    const fields = ['accountName', 'bankName', 'accountNumber', 'accountType', 'currency'];
    fields.forEach((f) => { if (req.body[f] !== undefined) acct[f] = req.body[f]; });
    await acct.save();

    res.json({ success: true, message: 'Bank account updated.', data: acct });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update bank account.' });
  }
};

module.exports = { getBankAccounts, createBankAccount, updateBankAccount };