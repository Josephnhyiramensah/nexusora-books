// server/fix-user.js — Creates the missing admin user. Delete after use.
// Run: cd server && node fix-user.js

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const { getTenantConnection } = require('./config/db');
const { getModel } = require('./utils/getModel');
const Tenant = require('./models/Tenant');

async function fixUser() {
  try {
    console.log('Connecting to master database...');
    await mongoose.connect(process.env.MASTER_DB_URI);

    const tenant = await Tenant.findOne({ subdomain: 'kgr' });
    if (!tenant) {
      console.log('KGR tenant not found!');
      process.exit(1);
    }

    console.log(`Connecting to ${tenant.databaseName}...`);
    const tenantDb = await getTenantConnection(tenant.databaseName);

    const User = getModel(tenantDb, 'User');

    // Check if user exists
    const existing = await User.findOne({ email: 'admin@kgr.nexusorabooks.com' });
    if (existing) {
      console.log('User already exists!');
      await tenantDb.close();
      await mongoose.disconnect();
      process.exit(0);
    }

    // Create user
    console.log('Creating admin user...');
    const user = await User.create({
      firstName: 'System',
      lastName: 'Admin',
      email: 'admin@kgr.nexusorabooks.com',
      password: 'Admin@2026',
      role: 'super_admin',
    });

    console.log('');
    console.log('✓ User created successfully!');
    console.log(`  Email: ${user.email}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  Password: Admin@2026`);
    console.log('');

    // Verify password works
    const bcrypt = require('bcryptjs');
    const savedUser = await User.findById(user._id).select('+password');
    const match = await bcrypt.compare('Admin@2026', savedUser.password);
    console.log(`  Password verification: ${match ? '✓ PASS' : '✗ FAIL'}`);
    console.log('');

    await tenantDb.close();
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    if (error.errors) {
      Object.values(error.errors).forEach((e) => {
        console.error('  →', e.message);
      });
    }
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

fixUser();