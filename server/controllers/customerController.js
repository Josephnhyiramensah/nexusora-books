// server/controllers/customerController.js

const { getModel } = require('../utils/getModel');
const { logAudit } = require('../middleware/auditMiddleware');

const getCustomers = async (req, res) => {
  try {
    const Customer = getModel(req.tenantDb, 'Customer');
    const filter = {};
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
    const customers = await Customer.find(filter).sort({ name: 1 }).lean();
    res.json({ success: true, data: customers, count: customers.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch customers.' });
  }
};

const getCustomer = async (req, res) => {
  try {
    const Customer = getModel(req.tenantDb, 'Customer');
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });
    res.json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch customer.' });
  }
};

const createCustomer = async (req, res) => {
  try {
    const Customer = getModel(req.tenantDb, 'Customer');
    const Account = getModel(req.tenantDb, 'Account');

    const { name, email, phone, address, taxId, creditLimit } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Customer name is required.' });

    // Default receivable account = 1100
    const arAccount = await Account.findOne({ code: '1100' });

    const customer = await Customer.create({
      name, email, phone, address, taxId,
      creditLimit: creditLimit || 0,
      receivableAccount: arAccount?._id,
      createdBy: req.user._id,
    });

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'create', module: 'customers',
      entityId: customer._id, entityType: 'Customer',
      description: `Created customer: ${name}`,
    }, req);

    res.status(201).json({ success: true, message: 'Customer created.', data: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create customer.' });
  }
};

const updateCustomer = async (req, res) => {
  try {
    const Customer = getModel(req.tenantDb, 'Customer');
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });

    const fields = ['name', 'email', 'phone', 'address', 'taxId', 'creditLimit'];
    fields.forEach((f) => { if (req.body[f] !== undefined) customer[f] = req.body[f]; });
    await customer.save();

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'update', module: 'customers',
      entityId: customer._id, entityType: 'Customer',
      description: `Updated customer: ${customer.name}`,
    }, req);

    res.json({ success: true, message: 'Customer updated.', data: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update customer.' });
  }
};

const deactivateCustomer = async (req, res) => {
  try {
    const Customer = getModel(req.tenantDb, 'Customer');
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });
    customer.isActive = false;
    await customer.save();
    res.json({ success: true, message: 'Customer deactivated.', data: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to deactivate customer.' });
  }
};
const printStatement = async (req, res) => {
  try {
    const { generateCustomerStatement } = require('../utils/pdfGenerator');
    const Customer = getModel(req.tenantDb, 'Customer');
    const Invoice  = getModel(req.tenantDb, 'Invoice');

    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });

    const invoices = await Invoice.find({ customer: customer._id }).sort({ date: -1 });

    const pdfBuffer = await generateCustomerStatement({
      customer,
      invoices,
      payments: [],
      tenantSettings: req.tenant?.settings || {},
      companyName: req.tenant?.companyName || '',
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="statement-${customer.name.replace(/\s+/g,'-')}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('[PDF] Statement error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to generate statement.' });
  }
};

const toggleCustomerActive = async (req, res) => {
  try {
    const Customer = getModel(req.tenantDb, 'Customer');
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });

    customer.isActive = !customer.isActive;
    await customer.save();

    res.json({
      success: true,
      message: `Customer ${customer.isActive ? 'activated' : 'deactivated'} successfully.`,
      data: customer,
    });
  } catch (error) {
    console.error('[Customer] Toggle error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to toggle customer status.' });
  }
};
module.exports = { getCustomers, getCustomer, createCustomer, updateCustomer, printStatement, toggleCustomerActive };