require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');

async function cleanTestData() {
  await mongoose.connect(process.env.MASTER_DB_URI);
  console.log('Connected to master DB...');

  // List all tenants
  const tenants = await Tenant.find({});
  console.log('\nCurrent tenants:');
  tenants.forEach((t) => console.log(`  - ${t.subdomain} (${t.plan}) [${t.status}]`));

  // Delete test tenants — keep only KGR
  const testTenants = tenants.filter((t) => t.subdomain !== 'kgr');

  for (const tenant of testTenants) {
    // Delete tenant database
    const tenantConn = await mongoose.createConnection(
      `${process.env.TENANT_DB_URI_BASE}${tenant.databaseName}`
    );
    await tenantConn.dropDatabase();
    console.log(`✅ Dropped database: ${tenant.databaseName}`);
    await tenantConn.close();

    // Delete tenant master record
    await Tenant.findByIdAndDelete(tenant._id);
    console.log(`✅ Deleted tenant record: ${tenant.subdomain}`);
  }

  // Clean KGR test data (customers, invoices etc) but keep accounts and users
  const kgr = tenants.find((t) => t.subdomain === 'kgr');
  if (kgr) {
    const kgrConn = await mongoose.createConnection(
      `${process.env.TENANT_DB_URI_BASE}${kgr.databaseName}`
    );

    const collections = ['customers', 'vendors', 'invoices', 'bills', 'payments',
      'journalentries', 'inventoryitems', 'fixedassets', 'payrollruns',
      'employees', 'bankaccounts', 'budgets', 'notes', 'todos', 'auditlogs'];

    for (const col of collections) {
      try {
        await kgrConn.collection(col).deleteMany({});
        console.log(`✅ Cleared KGR collection: ${col}`);
      } catch (e) {
        console.log(`  Skipped: ${col}`);
      }
    }

    await kgrConn.close();
  }

  console.log('\n✅ All test data cleaned. KGR accounts and users preserved.');
  await mongoose.disconnect();
  process.exit(0);
}

cleanTestData().catch(console.error);