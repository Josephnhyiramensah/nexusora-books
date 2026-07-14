// server/scripts/createPlatformAdmin.js
// One-off: create the first platform owner.
// Usage: node scripts/createPlatformAdmin.js "First" "Last" "email@x.com" "password"

require('dotenv').config();
const mongoose = require('mongoose');
const PlatformAdmin = require('../models/PlatformAdmin');

(async () => {
  const [firstName, lastName, email, password] = process.argv.slice(2);

  if (!firstName || !lastName || !email || !password) {
    console.error('Usage: node scripts/createPlatformAdmin.js "First" "Last" "email" "password"');
    process.exit(1);
  }

  if (password.length < 12) {
    console.error('Password must be at least 12 characters.');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MASTER_DB_URI);
    console.log('Connected to master database.');

    const existing = await PlatformAdmin.findOne({ email: email.toLowerCase() });
    if (existing) {
      console.error(`A platform admin with email ${email} already exists.`);
      process.exit(1);
    }

    const isFirst = (await PlatformAdmin.countDocuments()) === 0;

    const admin = await PlatformAdmin.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password,
      role: isFirst ? 'platform_owner' : 'platform_admin',
    });

    console.log(`Created ${admin.role}: ${admin.email}`);
    process.exit(0);
  } catch (error) {
    console.error('Failed:', error.message);
    process.exit(1);
  }
})();