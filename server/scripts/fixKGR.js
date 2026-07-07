require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');

async function fixKGR() {
  try {
    await mongoose.connect(process.env.MASTER_DB_URI);
    console.log('Connected to MongoDB...');

    const tenant = await Tenant.findOne({ subdomain: 'kgr' });
    if (!tenant) {
      console.log('❌ KGR tenant not found. Check subdomain name.');
      process.exit(1);
    }

    console.log(`Found: ${tenant.companyName} — current plan: ${tenant.plan}, status: ${tenant.status}`);

    // Set to founding — never expires
    tenant.plan   = 'founding';
    tenant.status = 'founding';
    tenant.subscription = {
      plan: 'founding',
      billingCycle: 'annual',
      startDate: new Date(),
      expiryDate: new Date('2099-12-31'), // effectively never
      maxUsers: 9999,
      maxAccountants: 9999,
      amountPaid: 0,
      currency: 'GHS',
      autoRenew: false,
    };

    await tenant.save();

    console.log('');
    console.log('✅ KGR updated successfully:');
    console.log(`   Plan    : ${tenant.plan}`);
    console.log(`   Status  : ${tenant.status}`);
    console.log(`   Expires : ${tenant.subscription.expiryDate}`);
    console.log(`   Users   : Unlimited`);
    console.log('');
    console.log('KGR will never be blocked by subscription enforcement.');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

fixKGR();