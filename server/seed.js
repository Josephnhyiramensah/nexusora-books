// server/seed.js
// Provisions the founding client tenant (KGR) with default Chart of Accounts
// Run once: cd server && node seed.js
//
// IMPORTANT: KGR (Koinonia Gold Refinery / Koinonia Minerals Investment Ltd)
// is a CLIENT company. Nexusora Technologies is the software provider.
// The owner fields below belong to KGR's actual company owner.
// The adminUser is the system administrator account for managing the platform.

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const Tenant = require('./models/Tenant');
const { getTenantConnection } = require('./config/db');
const { getModel } = require('./utils/getModel');
const { defaultChartOfAccounts } = require('./config/seedData');

// ============================================
// CONFIGURATION — Edit these before running
// ============================================

const KGR_TENANT = {
  subdomain: 'kgr',
  companyName: 'Koinonia Minerals Investment Ltd',
  plan: 'founding',      // Founding client — free, pays only hosting/server/DB costs
  owner: {
    // This is the KGR company owner — NOT you (the developer)
    name: 'Mr. Daneil Mensah',          // Replace with actual KGR owner name
    email: 'admin@koinoniagold.com',    // Replace with actual KGR owner email
    phone: '',                          // Replace with actual KGR owner phone
  },
  settings: {
    fiscalYearStart: 1,       // January
    baseCurrency: 'GHS',
    dateFormat: 'DD/MM/YYYY',
    address: 'Kumasi, Ghana', // Replace with actual KGR address
    taxId: '',                // Replace with actual KGR TIN
  },
};

// System admin account — this is the Nexusora Technologies admin
// who manages the platform on behalf of the client
const ADMIN_USER = {
  firstName: 'System',
  lastName: 'Admin',
  email: 'admin@kgr.nexusorabooks.com',  // System admin email
  password: 'Admin@2026',                 // CHANGE THIS after first login!
  role: 'super_admin',
};

// ============================================
// SEED FUNCTION
// ============================================

async function seed() {
  try {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║       NEXUSORA BOOKS — TENANT SEED SCRIPT       ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');

    // 1. Connect to master database
    console.log('[1/5] Connecting to master database...');
    await mongoose.connect(process.env.MASTER_DB_URI);
    console.log('       ✓ Master database connected');

    // 2. Check if tenant already exists
    console.log('[2/5] Checking if KGR tenant already exists...');
    const existing = await Tenant.findOne({ subdomain: KGR_TENANT.subdomain });

    if (existing) {
      console.log('       ⚠ KGR tenant already exists!');
      console.log(`       Database: ${existing.databaseName}`);
      console.log(`       Status: ${existing.status}`);
      console.log('');
      console.log('       To re-seed, first drop the tenant:');
      console.log('       db.tenants.deleteOne({ subdomain: "kgr" })');
      console.log('       Then drop the tenant database:');
      console.log('       use nexusora_tenant_kgr; db.dropDatabase()');
      console.log('');
      await mongoose.disconnect();
      process.exit(0);
    }

    // 3. Create tenant record in master database
    console.log('[3/5] Creating KGR tenant record...');
    const tenant = await Tenant.create({
      subdomain: KGR_TENANT.subdomain,
      companyName: KGR_TENANT.companyName,
      plan: KGR_TENANT.plan,
      status: 'founding',
      owner: KGR_TENANT.owner,
      settings: KGR_TENANT.settings,
    });
    console.log(`       ✓ Tenant created: ${tenant.subdomain} → ${tenant.databaseName}`);

    // 4. Connect to tenant database and seed Chart of Accounts
    console.log('[4/5] Seeding default Chart of Accounts...');
    const tenantDb = await getTenantConnection(tenant.databaseName);

    const Account = getModel(tenantDb, 'Account');
    const seedAccounts = defaultChartOfAccounts.map((acct) => ({
      ...acct,
      balance: 0,
    }));
    await Account.insertMany(seedAccounts);
    console.log(`       ✓ ${seedAccounts.length} accounts seeded`);

    // List the accounts
    console.log('');
    console.log('       Seeded accounts:');
    console.log('       ────────────────────────────────────────');
    seedAccounts.forEach((a) => {
      console.log(`       ${a.code.padEnd(6)} ${a.name.padEnd(35)} ${a.type.padEnd(12)} ${a.normalBalance}`);
    });
    console.log('');

    // 5. Create system admin user
    console.log('[5/5] Creating system admin user...');
    const User = getModel(tenantDb, 'User');
    const adminUser = await User.create({
      firstName: ADMIN_USER.firstName,
      lastName: ADMIN_USER.lastName,
      email: ADMIN_USER.email,
      password: ADMIN_USER.password,
      role: ADMIN_USER.role,
    });
    console.log(`       ✓ Admin user created: ${adminUser.email} (${adminUser.role})`);

    // Done
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║              SEED COMPLETE ✓                    ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  Tenant     : ${tenant.companyName}`.padEnd(51) + '║');
    console.log(`║  Subdomain  : ${tenant.subdomain}.nexusorabooks.com`.padEnd(51) + '║');
    console.log(`║  Database   : ${tenant.databaseName}`.padEnd(51) + '║');
    console.log(`║  Plan       : ${tenant.plan}`.padEnd(51) + '║');
    console.log(`║  Accounts   : ${seedAccounts.length} IFRS-compliant accounts`.padEnd(51) + '║');
    console.log(`║  Admin      : ${adminUser.email}`.padEnd(51) + '║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log('║  Dev login  : http://kgr.localhost:5173         ║');
    console.log(`║  Email      : ${ADMIN_USER.email}`.padEnd(51) + '║');
    console.log(`║  Password   : ${ADMIN_USER.password}`.padEnd(51) + '║');
    console.log('║  ⚠ CHANGE PASSWORD AFTER FIRST LOGIN!          ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');

    // Cleanup
    await tenantDb.close();
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('✗ Seed failed:', error.message);
    console.error('');

    if (error.message.includes('ECONNREFUSED') || error.message.includes('getaddrinfo')) {
      console.error('  Could not connect to MongoDB.');
      console.error('  Check your MASTER_DB_URI in .env');
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      console.error('  Validation errors:', messages.join(', '));
    }

    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

seed();