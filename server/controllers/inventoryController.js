const { getModel } = require('../utils/getModel');
const { logAudit } = require('../middleware/auditMiddleware');
const { scopedFilter, resolveBranchScope } = require('../utils/branchScope');
const {
  recordMovement, getOnHand, getOnHandAllBranches, weightedAvgCost, branchValuation,
} = require('../utils/inventoryService');

// Head Office fallback so a movement always has a branch even if none is active.
async function headOfficeId(req) {
  const Branch = getModel(req.tenantDb, 'Branch');
  const ho = await Branch.findOne({ isHeadOffice: true }).select('_id').lean();
  return ho ? ho._id : null;
}
async function resolveMovementBranch(req, bodyBranch) {
  if (bodyBranch) return bodyBranch;                 // explicit wins
  const scope = resolveBranchScope(req);
  if (scope.activeBranch) return scope.activeBranch; // the selected branch
  return headOfficeId(req);                          // default
}

// ─── Item CRUD (kept; getItems now returns DERIVED per-branch on-hand) ────────
const getItems = async (req, res) => {
  try {
    const Item = getModel(req.tenantDb, 'InventoryItem');
    const items = await Item.find({}).sort({ code: 1 }).lean();

    // Attach derived on-hand. If the request is branch-scoped (X-Branch), show
    // that branch's on-hand; otherwise show the company-wide total. The stored
    // quantityOnHand field is left in the payload for reference but is no longer
    // the source of truth.
    const scope = resolveBranchScope(req);
    const branchScoped = scope.mode !== 'all' && scope.activeBranch;

    const withStock = await Promise.all(items.map(async (it) => {
      if (branchScoped) {
        const qty = await getOnHand(req.tenantDb, it._id, scope.activeBranch);
        return { ...it, onHand: qty, onHandScope: 'branch' };
      }
      const all = await getOnHandAllBranches(req.tenantDb, it._id);
      return { ...it, onHand: all.total, onHandByBranch: all.byBranch, onHandScope: 'all' };
    }));

    res.json({ success: true, data: withStock, count: withStock.length });
  } catch (error) {
    console.error('[Inventory] List error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch items.' });
  }
};

const createItem = async (req, res) => {
  try {
    const Item = getModel(req.tenantDb, 'InventoryItem');
    // Accept an optional openingQuantity + branch → seed as an opening movement,
    // rather than the old hand-set quantityOnHand. quantityOnHand is no longer
    // trusted for stock, so we ignore it on create.
    const { openingQuantity, openingBranch, ...itemData } = req.body;
    delete itemData.quantityOnHand;

    const item = await Item.create({ ...itemData, createdBy: req.user._id });

    if (openingQuantity && Number(openingQuantity) > 0) {
      const branch = await resolveMovementBranch(req, openingBranch);
      if (branch) {
        await recordMovement(req.tenantDb, {
          item: item._id, branch, type: 'opening_balance',
          quantity: Number(openingQuantity), unitCost: item.unitCost || 0,
          reference: 'Opening balance', sourceType: 'manual',
          notes: 'Opening stock set at item creation.', createdBy: req.user._id,
        });
      }
    }

    res.status(201).json({ success: true, message: 'Item created.', data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Failed to create item.' });
  }
};

const updateItem = async (req, res) => {
  try {
    const Item = getModel(req.tenantDb, 'InventoryItem');
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });
    // NOTE: quantityOnHand is intentionally NOT editable here anymore — stock only
    // changes through movements (receipt/issue/adjustment/transfer). Editing the
    // catalogue fields is fine.
    const fields = ['code', 'name', 'description', 'category', 'unitCost', 'sellingPrice', 'reorderLevel', 'costingMethod', 'isActive'];
    fields.forEach((f) => { if (req.body[f] !== undefined) item[f] = req.body[f]; });
    await item.save();
    res.json({ success: true, message: 'Item updated.', data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update item.' });
  }
};

const deleteItem = async (req, res) => {
  try {
    const Item = getModel(req.tenantDb, 'InventoryItem');
    const StockMovement = getModel(req.tenantDb, 'StockMovement');
    // Guard: don't delete an item that has stock history — it would orphan the
    // ledger. Deactivate instead (isActive:false via updateItem).
    const moves = await StockMovement.countDocuments({ item: req.params.id });
    if (moves > 0) {
      return res.status(400).json({
        success: false,
        message: `This item has ${moves} stock movement(s) and can't be deleted. Set it inactive instead to keep its history.`,
      });
    }
    await Item.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Item deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete item.' });
  }
};

// ─── Movements ────────────────────────────────────────────────────────────────

// Generic recorder for receipt / issue / adjustment. Transfers have their own
// endpoint (two-sided). type comes from the route.
const makeMovement = (type) => async (req, res) => {
  try {
    const { item, quantity, unitCost, date, reference, notes, branch: bodyBranch } = req.body;
    if (!item) return res.status(400).json({ success: false, message: 'item is required.' });
    if (quantity === undefined || Number(quantity) === 0) {
      return res.status(400).json({ success: false, message: 'quantity is required and must be non-zero.' });
    }

    const Item = getModel(req.tenantDb, 'InventoryItem');
    const exists = await Item.findById(item).select('_id name').lean();
    if (!exists) return res.status(404).json({ success: false, message: 'Item not found.' });

    const branch = await resolveMovementBranch(req, bodyBranch);
    if (!branch) return res.status(400).json({ success: false, message: 'No branch resolved for this movement.' });

    // For an issue, prevent driving on-hand negative (a business safety net).
    if (type === 'issue') {
      const onHand = await getOnHand(req.tenantDb, item, branch);
      if (Math.abs(Number(quantity)) > onHand) {
        return res.status(400).json({ success: false, message: `Only ${onHand} in stock at this branch; can't issue ${Math.abs(Number(quantity))}.` });
      }
    }

    const move = await recordMovement(req.tenantDb, {
      item, branch, type, quantity, unitCost, date, reference, notes,
      sourceType: 'manual', createdBy: req.user._id,
    });

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'create', module: 'inventory',
      entityId: move._id, entityType: 'StockMovement',
      description: `Stock ${type}: ${Math.abs(move.quantity)} of ${exists.name}`,
    }, req);

    const onHand = await getOnHand(req.tenantDb, item, branch);
    res.status(201).json({ success: true, message: `Stock ${type} recorded.`, data: { movement: move, onHand } });
  } catch (error) {
    console.error('[Inventory] Movement error:', error.message);
    res.status(500).json({ success: false, message: error.message || 'Failed to record movement.' });
  }
};

// Transfer stock between two branches: one transfer_out + one transfer_in, linked
// by a shared transferId, so the pair reconciles to zero net.
const transferStock = async (req, res) => {
  try {
    const { item, quantity, fromBranch, toBranch, date, reference, notes } = req.body;
    if (!item || !fromBranch || !toBranch) {
      return res.status(400).json({ success: false, message: 'item, fromBranch and toBranch are required.' });
    }
    if (String(fromBranch) === String(toBranch)) {
      return res.status(400).json({ success: false, message: 'Source and destination branches must differ.' });
    }
    const mag = Math.abs(Number(quantity) || 0);
    if (mag === 0) return res.status(400).json({ success: false, message: 'quantity must be non-zero.' });

    // Can't transfer more than the source branch holds.
    const available = await getOnHand(req.tenantDb, item, fromBranch);
    if (mag > available) {
      return res.status(400).json({ success: false, message: `Only ${available} at the source branch; can't transfer ${mag}.` });
    }

    // Cost carried with the transfer = source branch's weighted-average, so value
    // moves with the stock and the destination's average stays honest.
    const cost = await weightedAvgCost(req.tenantDb, item, fromBranch);
    const transferId = `TRF-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const out = await recordMovement(req.tenantDb, {
      item, branch: fromBranch, type: 'transfer_out', quantity: mag, unitCost: cost,
      date, reference: reference || `Transfer ${transferId}`, transferId,
      sourceType: 'transfer', notes, createdBy: req.user._id,
    });
    const inn = await recordMovement(req.tenantDb, {
      item, branch: toBranch, type: 'transfer_in', quantity: mag, unitCost: cost,
      date, reference: reference || `Transfer ${transferId}`, transferId,
      sourceType: 'transfer', notes, createdBy: req.user._id,
    });

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'create', module: 'inventory',
      entityId: out._id, entityType: 'StockMovement',
      description: `Stock transfer ${mag} unit(s) between branches (${transferId})`,
    }, req);

    res.status(201).json({
      success: true, message: 'Stock transferred.',
      data: {
        transferId,
        from: { branch: fromBranch, onHand: await getOnHand(req.tenantDb, item, fromBranch) },
        to: { branch: toBranch, onHand: await getOnHand(req.tenantDb, item, toBranch) },
      },
    });
  } catch (error) {
    console.error('[Inventory] Transfer error:', error.message);
    res.status(500).json({ success: false, message: error.message || 'Failed to transfer stock.' });
  }
};

// Movement history — branch-scoped (X-Branch respected via scopedFilter), newest
// first, optional ?item= filter.
const getMovements = async (req, res) => {
  try {
    const StockMovement = getModel(req.tenantDb, 'StockMovement');
    const base = {};
    if (req.query.item) base.item = req.query.item;
    if (req.query.type) base.type = req.query.type;
    const filter = scopedFilter(req, base);

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const [rows, total] = await Promise.all([
      StockMovement.find(filter).sort({ date: -1, createdAt: -1 })
        .skip((page - 1) * limit).limit(limit)
        .populate('item', 'code name').populate('branch', 'name code').lean(),
      StockMovement.countDocuments(filter),
    ]);

    res.json({ success: true, data: rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch movements.' });
  }
};

// On-hand for one item (branch-scoped → that branch; else all branches).
const getItemStock = async (req, res) => {
  try {
    const scope = resolveBranchScope(req);
    if (scope.mode !== 'all' && scope.activeBranch) {
      const qty = await getOnHand(req.tenantDb, req.params.id, scope.activeBranch);
      return res.json({ success: true, data: { onHand: qty, scope: 'branch' } });
    }
    const all = await getOnHandAllBranches(req.tenantDb, req.params.id);
    res.json({ success: true, data: { onHand: all.total, byBranch: all.byBranch, scope: 'all' } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch stock.' });
  }
};

// Per-branch valuation (branch-scoped → that branch; else Head Office as a
// sensible default, since a single consolidated valuation still values each
// branch at its own average).
const getValuation = async (req, res) => {
  try {
    const scope = resolveBranchScope(req);
    const branch = (scope.mode !== 'all' && scope.activeBranch) ? scope.activeBranch : await headOfficeId(req);
    if (!branch) return res.json({ success: true, data: { total: 0, items: [] } });
    const val = await branchValuation(req.tenantDb, branch);
    res.json({ success: true, data: val });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to compute valuation.' });
  }
};

module.exports = {
  getItems, createItem, updateItem, deleteItem,
  receiveStock: makeMovement('receipt'),
  issueStock: makeMovement('issue'),
  adjustStock: makeMovement('adjustment'),
  transferStock,
  getMovements, getItemStock, getValuation,
};