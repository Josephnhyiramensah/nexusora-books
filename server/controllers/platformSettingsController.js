const PlatformSettings = require('../models/PlatformSettings');

// GET /api/platform/settings — public (needed by RegisterPage)
const getPublicSettings = async (req, res) => {
  try {
    let settings = await PlatformSettings.findById('platform');
    if (!settings) {
      settings = await PlatformSettings.create({ _id: 'platform' });
    }

    // Only return safe public fields — never expose SMTP password
    res.json({
      success: true,
      data: {
        company: settings.company,
        subscription: settings.subscription,
        branding: settings.branding,
        platformName: settings.branding.platformName,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch platform settings.' });
  }
};

// GET /api/platform/settings/admin — master admin only (full settings)
const getAdminSettings = async (req, res) => {
  try {
    let settings = await PlatformSettings.findById('platform');
    if (!settings) {
      settings = await PlatformSettings.create({ _id: 'platform' });
    }
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch settings.' });
  }
};

// PUT /api/platform/settings — master admin only
const updateSettings = async (req, res) => {
  try {
    const { company, smtp, subscription, branding } = req.body;

    const settings = await PlatformSettings.findByIdAndUpdate(
      'platform',
      {
        $set: {
          ...(company      && { company }),
          ...(smtp         && { smtp }),
          ...(subscription && { subscription }),
          ...(branding     && { branding }),
          lastUpdatedBy: 'master_admin',
        },
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({ success: true, message: 'Platform settings updated.', data: settings });
  } catch (error) {
    console.error('[Platform] Update error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to update settings.' });
  }
};

module.exports = { getPublicSettings, getAdminSettings, updateSettings };