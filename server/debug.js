// server/debug.js — Quick diagnostic script, delete after use
// Run: cd server && node debug.js

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { getTenantConnection } = require('./config/db');
const { getModel } = require('./utils/getModel');
const Tenant = require('./models/Tenant');

async function debug() {
  try {
    console.log('');
    console.log('=== NEXUSORA BOOKS DEBUG ===');
    console.log('');

    // 1. Connect to master
    console.log('[1] Connecting to master database...');
    await mongoose.connect(process.env.MASTER_DB_URI);
    console.log('    ✓ Connected');

    // 2. Find KGR tenant
    console.log('[2] Looking up KGR tenant...');
    const tenant = await Tenant.findOne({ subdomain: 'kgr' });
    if (!tenant) {
      console.log('    ✗ KGR tenant NOT FOUND in master database!');
      console.log('    → Run: npm run seed');
      await mongoose.disconnect();
      process.exit(1);
    }
    console.log(`    ✓ Found: ${tenant.companyName}`);
    console.log(`    Database: ${tenant.databaseName}`);
    console.log(`    Status: ${tenant.status}`);
    console.log(`    Plan: ${tenant.plan}`);

    // 3. Connect to tenant DB
    console.log('[3] Connecting to tenant database...');
    const tenantDb = await getTenantConnection(tenant.databaseName);
    console.log('    ✓ Connected');

    // 4. List all users
    console.log('[4] Listing users in tenant database...');
    const User = getModel(tenantDb, 'User');
    const users = await User.find({}).select('+password');

    if (users.length === 0) {
      console.log('    ✗ NO USERS FOUND in tenant database!');
      console.log('    → Something went wrong with seed. Re-run after dropping.');
      await tenantDb.close();
      await mongoose.disconnect();
      process.exit(1);
    }

    for (const user of users) {
      console.log(`    ─────────────────────────────────`);
      console.log(`    Name: ${user.firstName} ${user.lastName}`);
      console.log(`    Email: ${user.email}`);
      console.log(`    Role: ${user.role}`);
      console.log(`    Active: ${user.isActive}`);
      console.log(`    Has password hash: ${!!user.password}`);
      console.log(`    Password hash starts: ${user.password?.substring(0, 20)}...`);

      // 5. Test password
      console.log('    Testing password "Admin@2026"...');
      const isMatch = await bcrypt.compare('Admin@2026', user.password);
      console.log(`    Password match: ${isMatch ? '✓ YES' : '✗ NO'}`);
    }

    // 6. Check accounts
    console.log('');
    console.log('[5] Checking seeded accounts...');
    const Account = getModel(tenantDb, 'Account');
    const accountCount = await Account.countDocuments();
    console.log(`    Accounts in database: ${accountCount}`);

    console.log('');
    console.log('=== DEBUG COMPLETE ===');
    console.log('');

    await tenantDb.close();
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Debug error:', error.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

debug();