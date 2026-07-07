// server/config/db.js
// MongoDB multi-tenant connection manager

const mongoose = require('mongoose');

const tenantConnections = new Map();

const connectMasterDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MASTER_DB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4,
      maxPoolSize: 10,
      retryWrites: true,
    });
    console.log(`[DB] Master database connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[DB] Master database connection failed: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Build the full URI for a tenant database.
 * Handles both SRV format (mongodb+srv://.../) and standard format with query params.
 */
const buildTenantUri = (databaseName) => {
  const base = process.env.TENANT_DB_URI_BASE;

  // If base has query params like ?ssl=true&..., insert DB name before the ?
  const qIndex = base.indexOf('?');
  if (qIndex !== -1) {
    const beforeQuery = base.substring(0, qIndex);
    const query = base.substring(qIndex);
    // Ensure there's a / before the DB name
    const cleanBase = beforeQuery.endsWith('/') ? beforeQuery : beforeQuery + '/';
    return `${cleanBase}${databaseName}${query}`;
  }

  // Simple format: just append
  const cleanBase = base.endsWith('/') ? base : base + '/';
  return `${cleanBase}${databaseName}`;
};

const getTenantConnection = async (databaseName) => {
  if (tenantConnections.has(databaseName)) {
    const cached = tenantConnections.get(databaseName);
    if (cached.readyState === 1) {
      return cached;
    }
    tenantConnections.delete(databaseName);
  }

  try {
    const tenantUri = buildTenantUri(databaseName);

    const connection = mongoose.createConnection(tenantUri);

    await new Promise((resolve, reject) => {
      connection.on('connected', resolve);
      connection.on('error', reject);
    });

    tenantConnections.set(databaseName, connection);
    console.log(`[DB] Tenant connection established: ${databaseName}`);

    return connection;
  } catch (error) {
    console.error(`[DB] Tenant connection failed for ${databaseName}: ${error.message}`);
    throw error;
  }
};

const closeAllConnections = async () => {
  for (const [name, conn] of tenantConnections) {
    await conn.close();
    console.log(`[DB] Closed tenant connection: ${name}`);
  }
  tenantConnections.clear();
  await mongoose.disconnect();
  console.log('[DB] Master database disconnected');
};

module.exports = {
  connectMasterDB,
  getTenantConnection,
  closeAllConnections,
  tenantConnections,
};