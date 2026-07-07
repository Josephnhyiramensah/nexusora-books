const Tenant = require('../models/Tenant');
const { sendTrialExpiryEmail } = require('./emailService');

async function sendTrialReminders() {
  console.log('[Cron] Checking for expiring trials...');
  const now = new Date();

  // Find tenants whose trial expires in 1 or 3 days
  const targets = [1, 3];

  for (const daysLeft of targets) {
    const start = new Date(now.getTime() + (daysLeft - 0.5) * 24 * 60 * 60 * 1000);
    const end = new Date(now.getTime() + (daysLeft + 0.5) * 24 * 60 * 60 * 1000);

    const tenants = await Tenant.find({
      plan: 'trial',
      status: { $in: ['trial', 'active'] },
      'subscription.expiryDate': { $gte: start, $lt: end },
    });

    for (const tenant of tenants) {
      try {
        await sendTrialExpiryEmail({
          to: tenant.owner.email,
          companyName: tenant.companyName,
          adminName: tenant.owner.name?.split(' ')[0] || 'there',
          subdomain: tenant.subdomain,
          daysLeft,
          expiryDate: tenant.subscription.expiryDate,
        });
        console.log(`[Cron] Reminder sent to ${tenant.subdomain} (${daysLeft} days left)`);
      } catch (err) {
        console.warn(`[Cron] Failed to send reminder to ${tenant.subdomain}:`, err.message);
      }
    }
  }
}

module.exports = { sendTrialReminders };