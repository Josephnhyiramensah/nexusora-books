const crypto = require('crypto');
const { getModel } = require('../utils/getModel');
const { logAudit } = require('../middleware/auditMiddleware');

// Generate a secure API key
function generateApiKey() {
  const prefix = 'nbk';
  const secret = crypto.randomBytes(32).toString('hex');
  return `${prefix}_live_${secret}`;
}

// Hash the key for storage (never store raw keys)
function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

const getApiKeys = async (req, res) => {
  try {
    const ApiKey = getModel(req.tenantDb, 'ApiKey');
    const keys = await ApiKey.find({ isActive: true })
      .select('-hashedKey') // never return the hash
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: keys });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch API keys.' });
  }
};

const createApiKey = async (req, res) => {
  try {
    const ApiKey = getModel(req.tenantDb, 'ApiKey');
    const { name, permissions = ['read'], expiresInDays } = req.body;

    if (!name) return res.status(400).json({ success: false, message: 'Key name is required.' });

    // Check plan
    const Tenant = require('../models/Tenant');
    const tenant = await Tenant.findOne({ subdomain: req.tenant.subdomain });
    if (!['enterprise', 'founding'].includes(tenant?.plan)) {
      return res.status(403).json({
        success: false,
        message: 'API key access requires Enterprise plan.',
      });
    }

    // Check key limit (max 10 active keys)
    const existing = await ApiKey.countDocuments({ isActive: true });
    if (existing >= 10) {
      return res.status(400).json({ success: false, message: 'Maximum of 10 active API keys allowed.' });
    }

    const rawKey = generateApiKey();
    const hashedKey = hashKey(rawKey);

    const expiryDate = expiresInDays
      ? new Date(Date.now() + Number(expiresInDays) * 24 * 60 * 60 * 1000)
      : null;

    const apiKey = await ApiKey.create({
      name,
      hashedKey,
      keyPrefix: rawKey.substring(0, 20) + '...',
      permissions,
      expiresAt: expiryDate,
      createdBy: req.user._id,
      lastUsed: null,
      requestCount: 0,
    });

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'create', module: 'settings',
      entityId: apiKey._id, entityType: 'ApiKey',
      description: `Created API key: ${name}`,
    }, req);

    res.status(201).json({
      success: true,
      message: 'API key created. Copy it now — it will not be shown again.',
      data: {
        _id: apiKey._id,
        name: apiKey.name,
        key: rawKey, // Only shown ONCE at creation
        keyPrefix: apiKey.keyPrefix,
        permissions: apiKey.permissions,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
      },
    });
  } catch (error) {
    console.error('[ApiKey] Create error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to create API key.' });
  }
};

const revokeApiKey = async (req, res) => {
  try {
    const ApiKey = getModel(req.tenantDb, 'ApiKey');
    const key = await ApiKey.findById(req.params.id);
    if (!key) return res.status(404).json({ success: false, message: 'API key not found.' });

    key.isActive = false;
    key.revokedAt = new Date();
    key.revokedBy = req.user._id;
    await key.save();

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'delete', module: 'settings',
      entityId: key._id, entityType: 'ApiKey',
      description: `Revoked API key: ${key.name}`,
    }, req);

    res.json({ success: true, message: `API key "${key.name}" revoked.` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to revoke API key.' });
  }
};

// Middleware: authenticate external requests using API key
const authenticateApiKey = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer nbk_')) {
      return res.status(401).json({ success: false, message: 'Invalid or missing API key.' });
    }

    const rawKey = authHeader.substring(7);
    const hashedKey = hashKey(rawKey);

    const ApiKey = getModel(req.tenantDb, 'ApiKey');
    const apiKey = await ApiKey.findOne({ hashedKey, isActive: true });

    if (!apiKey) {
      return res.status(401).json({ success: false, message: 'API key not found or revoked.' });
    }

    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
      return res.status(401).json({ success: false, message: 'API key has expired.' });
    }

    // Update last used
    apiKey.lastUsed = new Date();
    apiKey.requestCount += 1;
    await apiKey.save();

    req.apiKey = apiKey;
    req.apiPermissions = apiKey.permissions;
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: 'API key authentication failed.' });
  }
};

module.exports = { getApiKeys, createApiKey, revokeApiKey, authenticateApiKey };