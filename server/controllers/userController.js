const { getModel } = require('../utils/getModel');
const { logAudit } = require('../middleware/auditMiddleware');

const getUsers = async (req, res) => {
  try {
    const User = getModel(req.tenantDb, 'User');
    const users = await User.find({}).select('-password -refreshToken -twoFactorSecret').sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: users, count: users.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch users.' });
  }
};

const createUser = async (req, res) => {
  try {
    const User = getModel(req.tenantDb, 'User');
    const Tenant = require('../models/Tenant');

    const { firstName, lastName, email, password, role, phone } = req.body;
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ success: false, message: 'First name, last name, email, and password required.' });
    }

    // Check user limit
    const tenant = await Tenant.findOne({ subdomain: req.tenant.subdomain });
    const currentCount = await User.countDocuments({ isActive: true });
    if (tenant && tenant.subscription?.maxUsers && currentCount >= tenant.subscription.maxUsers) {
      return res.status(403).json({
        success: false,
        message: `User limit reached (${tenant.subscription.maxUsers} for ${tenant.plan} plan). Upgrade your plan to add more users.`,
      });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ success: false, message: 'Email already in use.' });

    const user = await User.create({
      firstName, lastName, email, password,
      role: role || 'staff', phone,
    });

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'create', module: 'settings',
      entityId: user._id, entityType: 'User',
      description: `Created user: ${firstName} ${lastName} (${role || 'staff'})`,
    }, req);

    res.status(201).json({
      success: true,
      message: `User ${firstName} ${lastName} created. They can log in with email: ${email}`,
      data: { _id: user._id, firstName, lastName, email, role: user.role },
    });
  } catch (error) {
    console.error('[Users] Create error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to create user.' });
  }
};

const updateUser = async (req, res) => {
  try {
    const User = getModel(req.tenantDb, 'User');
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const fields = ['firstName', 'lastName', 'phone', 'role'];
    fields.forEach((f) => { if (req.body[f] !== undefined) user[f] = req.body[f]; });
    await user.save();

    res.json({ success: true, message: 'User updated.', data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update user.' });
  }
};

const deactivateUser = async (req, res) => {
  try {
    const User = getModel(req.tenantDb, 'User');
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (user.role === 'super_admin') {
      return res.status(400).json({ success: false, message: 'Cannot deactivate the super admin.' });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({ success: true, message: `User ${user.isActive ? 'activated' : 'deactivated'}.`, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update user status.' });
  }
};

module.exports = { getUsers, createUser, updateUser, deactivateUser };