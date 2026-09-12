// server/controllers/externalMappingController.js
const { getModel } = require('../utils/getModel');
const { logAudit } = require('../middleware/auditMiddleware');

const listMappings = async (req, res) => {
  try {
    const ExternalMapping = getModel(req.tenantDb, 'ExternalMapping');
    const mappings = await ExternalMapping.find({}).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: mappings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load mappings.' });
  }
};

const getMapping = async (req, res) => {
  try {
    const ExternalMapping = getModel(req.tenantDb, 'ExternalMapping');
    const mapping = await ExternalMapping.findById(req.params.id).lean();
    if (!mapping) return res.status(404).json({ success: false, message: 'Mapping not found.' });
    res.json({ success: true, data: mapping });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load mapping.' });
  }
};

// Create or update a mapping by source (upsert-style, but explicit).
const saveMapping = async (req, res) => {
  try {
    const ExternalMapping = getModel(req.tenantDb, 'ExternalMapping');
    const { _id, source, label, fieldMap, accountMap, typeMap, fixedVoucherType, autopost, active } = req.body;
    if (!source) return res.status(400).json({ success: false, message: 'source is required.' });

    let mapping;
    if (_id) {
      mapping = await ExternalMapping.findById(_id);
      if (!mapping) return res.status(404).json({ success: false, message: 'Mapping not found.' });
    } else {
      // prevent duplicate source
      const clash = await ExternalMapping.findOne({ source });
      if (clash) { mapping = clash; }
      else mapping = new ExternalMapping({ source, createdBy: req.user._id });
    }

    if (source !== undefined) mapping.source = source;
    if (label !== undefined) mapping.label = label;
    if (fieldMap !== undefined) mapping.fieldMap = fieldMap;
    if (accountMap !== undefined) mapping.accountMap = accountMap;
    if (typeMap !== undefined) mapping.typeMap = typeMap;
    if (fixedVoucherType !== undefined) mapping.fixedVoucherType = fixedVoucherType || null;
    if (autopost !== undefined) mapping.autopost = autopost;
    if (active !== undefined) mapping.active = active;
    await mapping.save();

    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'update', module: 'settings',
      entityId: mapping._id, entityType: 'ExternalMapping',
      description: 'Saved external mapping for source: ' + mapping.source,
    }, req);

    res.json({ success: true, message: 'Mapping saved.', data: mapping });
  } catch (error) {
    console.error('[ExternalMapping] Save error:', error.message);
    res.status(500).json({ success: false, message: error.message || 'Failed to save mapping.' });
  }
};

const deleteMapping = async (req, res) => {
  try {
    const ExternalMapping = getModel(req.tenantDb, 'ExternalMapping');
    const mapping = await ExternalMapping.findById(req.params.id);
    if (!mapping) return res.status(404).json({ success: false, message: 'Mapping not found.' });
    await ExternalMapping.findByIdAndDelete(mapping._id);
    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'delete', module: 'settings',
      entityId: mapping._id, entityType: 'ExternalMapping',
      description: 'Deleted external mapping: ' + mapping.source,
    }, req);
    res.json({ success: true, message: 'Mapping deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete mapping.' });
  }
};

module.exports = { listMappings, getMapping, saveMapping, deleteMapping };
