// server/controllers/vendorController.js

const { getModel } = require('../utils/getModel');
const { logAudit } = require('../middleware/auditMiddleware');

const getVendors = async (req, res) => {
  try {
    const Vendor = getModel(req.tenantDb, 'Vendor');
    const filter = {};
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
    const vendors = await Vendor.find(filter).sort({ name: 1 }).lean();
    res.json({ success: true, data: vendors, count: vendors.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch vendors.' });
  }
};

const getVendor = async (req, res) => {
  try {
    const Vendor = getModel(req.tenantDb, 'Vendor');
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found.' });
    res.json({ success: true, data: vendor });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch vendor.' });
  }
};

const createVendor = async (req, res) => {
  try {
    const Vendor = getModel(req.tenantDb, 'Vendor');
    const Account = getModel(req.tenantDb, 'Account');

    const { name, email, phone, address, taxId } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Vendor name is required.' });

    const apAccount = await Account.findOne({ code: '2000' });

    const vendor = await Vendor.create({
      name, email, phone, address, taxId,
      payableAccount: apAccount?._id,
      createdBy: req.user._id,
    });

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'create', module: 'vendors',
      entityId: vendor._id, entityType: 'Vendor',
      description: `Created vendor: ${name}`,
    }, req);

    res.status(201).json({ success: true, message: 'Vendor created.', data: vendor });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create vendor.' });
  }
};

const updateVendor = async (req, res) => {
  try {
    const Vendor = getModel(req.tenantDb, 'Vendor');
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found.' });

    const fields = ['name', 'email', 'phone', 'address', 'taxId'];
    fields.forEach((f) => { if (req.body[f] !== undefined) vendor[f] = req.body[f]; });
    await vendor.save();

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'update', module: 'vendors',
      entityId: vendor._id, entityType: 'Vendor',
      description: `Updated vendor: ${vendor.name}`,
    }, req);

    res.json({ success: true, message: 'Vendor updated.', data: vendor });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update vendor.' });
  }
};

const deactivateVendor = async (req, res) => {
  try {
    const Vendor = getModel(req.tenantDb, 'Vendor');
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found.' });
    vendor.isActive = false;
    await vendor.save();
    res.json({ success: true, message: 'Vendor deactivated.', data: vendor });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to deactivate vendor.' });
  }
};

module.exports = { getVendors, getVendor, createVendor, updateVendor, deactivateVendor };