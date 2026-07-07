const { getModel } = require('../utils/getModel');
const { logAudit } = require('../middleware/auditMiddleware');

const getItems = async (req, res) => {
  try {
    const Item = getModel(req.tenantDb, 'InventoryItem');
    const items = await Item.find({}).sort({ code: 1 }).lean();
    res.json({ success: true, data: items, count: items.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch items.' });
  }
};

const createItem = async (req, res) => {
  try {
    const Item = getModel(req.tenantDb, 'InventoryItem');
    const item = await Item.create({ ...req.body, createdBy: req.user._id });
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
    const fields = ['code', 'name', 'description', 'category', 'unitCost', 'sellingPrice', 'quantityOnHand', 'reorderLevel'];
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
    await Item.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Item deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete item.' });
  }
};

module.exports = { getItems, createItem, updateItem, deleteItem };