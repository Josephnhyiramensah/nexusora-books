const { getModel } = require('../utils/getModel');
const { logAudit } = require('../middleware/auditMiddleware');

async function generateAssetCode(FixedAsset) {
  const last = await FixedAsset.findOne({}).sort({ createdAt: -1 }).select('assetCode').lean();
  if (!last || !last.assetCode) return 'FA-000001';
  const num = parseInt(last.assetCode.replace('FA-', ''), 10);
  return `FA-${(num + 1).toString().padStart(6, '0')}`;
}

const getFixedAssets = async (req, res) => {
  try {
    const FixedAsset = getModel(req.tenantDb, 'FixedAsset');
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.category = req.query.category;
    const assets = await FixedAsset.find(filter).sort({ assetCode: 1 }).lean();
    res.json({ success: true, data: assets, count: assets.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch assets.' });
  }
};

const getFixedAsset = async (req, res) => {
  try {
    const FixedAsset = getModel(req.tenantDb, 'FixedAsset');
    const asset = await FixedAsset.findById(req.params.id);
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found.' });
    res.json({ success: true, data: asset });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch asset.' });
  }
};

const createFixedAsset = async (req, res) => {
  try {
    const FixedAsset = getModel(req.tenantDb, 'FixedAsset');
    const { description, category, location, purchaseDate, cost, residualValue, usefulLifeYears, depreciationMethod } = req.body;

    if (!description || !purchaseDate || !cost || !usefulLifeYears) {
      return res.status(400).json({ success: false, message: 'Required: description, purchaseDate, cost, usefulLifeYears.' });
    }

    const assetCode = await generateAssetCode(FixedAsset);
    const netBookValue = Number(cost) - 0;

    const asset = await FixedAsset.create({
      assetCode, description, category: category || 'other', location,
      purchaseDate, cost: Number(cost),
      residualValue: Number(residualValue) || 0,
      usefulLifeYears: Number(usefulLifeYears),
      depreciationMethod: depreciationMethod || 'straight_line',
      accumulatedDepreciation: 0, netBookValue,
      status: 'active', createdBy: req.user._id,
    });

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'create', module: 'fixed_assets',
      entityId: asset._id, entityType: 'FixedAsset',
      description: `Created asset: ${assetCode} — ${description}`,
    }, req);

    res.status(201).json({ success: true, message: `Asset ${assetCode} created.`, data: asset });
  } catch (error) {
    console.error('[FixedAssets] Create error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to create asset.' });
  }
};

const updateFixedAsset = async (req, res) => {
  try {
    const FixedAsset = getModel(req.tenantDb, 'FixedAsset');
    const asset = await FixedAsset.findById(req.params.id);
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found.' });

    const fields = ['description', 'category', 'location', 'residualValue', 'usefulLifeYears', 'depreciationMethod'];
    fields.forEach((f) => { if (req.body[f] !== undefined) asset[f] = req.body[f]; });
    asset.netBookValue = asset.cost - asset.accumulatedDepreciation;
    await asset.save();

    res.json({ success: true, message: 'Asset updated.', data: asset });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update asset.' });
  }
};

const depreciateAsset = async (req, res) => {
  try {
    const FixedAsset = getModel(req.tenantDb, 'FixedAsset');
    const Account = getModel(req.tenantDb, 'Account');
    const JournalEntry = getModel(req.tenantDb, 'JournalEntry');
    const { generateEntryNumber, calculateBalanceChange } = require('../utils/accountingHelpers');

    const asset = await FixedAsset.findById(req.params.id);
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found.' });
    if (asset.status !== 'active') return res.status(400).json({ success: false, message: 'Only active assets can be depreciated.' });

    let depAmount = 0;
    const depBase = asset.cost - asset.residualValue;

    if (asset.depreciationMethod === 'straight_line') {
      depAmount = Math.round((depBase / asset.usefulLifeYears / 12) * 100) / 100;
    } else if (asset.depreciationMethod === 'declining_balance') {
      const rate = 2 / asset.usefulLifeYears;
      depAmount = Math.round((asset.netBookValue * rate / 12) * 100) / 100;
    }

    if (depAmount <= 0 || asset.netBookValue <= asset.residualValue) {
      return res.status(400).json({ success: false, message: 'Asset is fully depreciated.' });
    }

    // Cap depreciation so NBV doesn't go below residual
    if (asset.netBookValue - depAmount < asset.residualValue) {
      depAmount = Math.round((asset.netBookValue - asset.residualValue) * 100) / 100;
    }

    // Create journal: DR Depreciation Expense (6600), CR Accumulated Depreciation (1500)
    const depExpAcct = await Account.findOne({ code: '6600' });
    const accumDepAcct = await Account.findOne({ code: '1500' });
    if (!depExpAcct || !accumDepAcct) return res.status(500).json({ success: false, message: 'Depreciation accounts not found.' });

    const entryNumber = await generateEntryNumber(JournalEntry);
    const journalLines = [
      { account: depExpAcct._id, accountCode: '6600', accountName: depExpAcct.name, debit: depAmount, credit: 0, description: `Depreciation: ${asset.assetCode} — ${asset.description}` },
      { account: accumDepAcct._id, accountCode: '1500', accountName: accumDepAcct.name, debit: 0, credit: depAmount, description: `Accum. depreciation: ${asset.assetCode}` },
    ];

    await JournalEntry.create({
      entryNumber, date: new Date(), journalType: 'general',
      description: `Monthly depreciation for ${asset.assetCode}`,
      reference: asset.assetCode, lines: journalLines,
      totalDebit: depAmount, totalCredit: depAmount,
      status: 'posted', postedBy: req.user._id, postedAt: new Date(), createdBy: req.user._id,
    });

    for (const line of journalLines) {
      const acct = await Account.findById(line.account);
      if (acct) {
        const change = calculateBalanceChange(acct.normalBalance, line.debit, line.credit);
        acct.balance = Math.round((acct.balance + change) * 100) / 100;
        await acct.save();
      }
    }

    asset.accumulatedDepreciation = Math.round((asset.accumulatedDepreciation + depAmount) * 100) / 100;
    asset.netBookValue = Math.round((asset.cost - asset.accumulatedDepreciation) * 100) / 100;
    await asset.save();

    res.json({ success: true, message: `Depreciation of ${depAmount} recorded for ${asset.assetCode}. Journal ${entryNumber} posted.`, data: asset });
  } catch (error) {
    console.error('[FixedAssets] Depreciate error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to depreciate asset.' });
  }
};

const disposeAsset = async (req, res) => {
  try {
    const FixedAsset = getModel(req.tenantDb, 'FixedAsset');
    const asset = await FixedAsset.findById(req.params.id);
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found.' });

    asset.status = 'disposed';
    asset.disposalDate = new Date();
    asset.disposalAmount = Number(req.body.disposalAmount) || 0;
    await asset.save();

    res.json({ success: true, message: `Asset ${asset.assetCode} disposed.`, data: asset });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to dispose asset.' });
  }

  const deleteFixedAsset = async (req, res) => {
  try {
    const FixedAsset = getModel(req.tenantDb, 'FixedAsset');
    const asset = await FixedAsset.findById(req.params.id);
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found.' });
    if (asset.accumulatedDepreciation > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete asset with depreciation history. Use dispose instead.' });
    }
    await FixedAsset.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Asset deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete asset.' });
  }
};
};

module.exports = { getFixedAssets, getFixedAsset, createFixedAsset, updateFixedAsset, depreciateAsset, disposeAsset };