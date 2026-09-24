// server/config/db.js
// MongoDB multi-tenant connection manager
//
// Tenant connections are cached and reused. To keep memory and Atlas connection
// counts bounded as the number of tenants grows, idle connections are evicted:
//   • each connection tracks when it was last used,
//   • a periodic sweep closes connections idle longer than IDLE_MS,
//   • if the cache exceeds MAX_CONNECTIONS, the least-recently-used are closed.
// Evicting a connection is safe: the next request for that tenant simply
// reconnects (getTenantConnection already handles a missing/dead connection).
// The master connection is separate and never evicted.

const mongoose = require('mongoose');

// name -> { conn, lastUsed }  (lastUsed = epoch ms of the most recent use)
const tenantConnections = new Map();

// Tunables. Conservative defaults; safe to adjust as the platform grows.
const MAX_CONNECTIONS = Number(process.env.TENANT_MAX_CONNECTIONS) || 25;   // hard cap on open tenant connections
const IDLE_MS = Number(process.env.TENANT_IDLE_MS) || 15 * 60 * 1000;       // close after 15 min idle
const SWEEP_MS = Number(process.env.TENANT_SWEEP_MS) || 5 * 60 * 1000;      // check every 5 min

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
    startSweeper();
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

// Close and forget a single tenant connection. Never throws.
const evict = async (databaseName, reason) => {
  const entry = tenantConnections.get(databaseName);
  if (!entry) return;
  tenantConnections.delete(databaseName);
  try {
    await entry.conn.close();
    console.log(`[DB] Evicted tenant connection: ${databaseName} (${reason})`);
  } catch (e) {
    console.warn(`[DB] Error closing ${databaseName}: ${e.message}`);
  }
};

// Enforce the hard cap: if over MAX_CONNECTIONS, close the least-recently-used
// until back at the cap. Called after adding a new connection.
const enforceCap = async () => {
  if (tenantConnections.size <= MAX_CONNECTIONS) return;
  // Sort by lastUsed ascending (oldest first).
  const sorted = [...tenantConnections.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed);
  const overflow = tenantConnections.size - MAX_CONNECTIONS;
  for (let i = 0; i < overflow; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await evict(sorted[i][0], 'over cap (LRU)');
  }
};

const getTenantConnection = async (databaseName) => {
  if (tenantConnections.has(databaseName)) {
    const entry = tenantConnections.get(databaseName);
    if (entry.conn.readyState === 1) {
      entry.lastUsed = Date.now();   // mark as recently used
      return entry.conn;
    }
    // Dead/broken — drop it and fall through to reconnect.
    tenantConnections.delete(databaseName);
  }

  try {
    const tenantUri = buildTenantUri(databaseName);

    const connection = mongoose.createConnection(tenantUri);

    await new Promise((resolve, reject) => {
      connection.on('connected', resolve);
      connection.on('error', reject);
    });

    // Register all tenant schemas up-front so .populate() always resolves.
    // Lazy require avoids any circular-import risk at module load time.
    // eslint-disable-next-line global-require
    require('../utils/getModel').registerAllModels(connection);

    tenantConnections.set(databaseName, { conn: connection, lastUsed: Date.now() });
    console.log(`[DB] Tenant connection established: ${databaseName}`);

    await enforceCap();

    return connection;
  } catch (error) {
    console.error(`[DB] Tenant connection failed for ${databaseName}: ${error.message}`);
    throw error;
  }
};

// Periodic sweep: close connections idle longer than IDLE_MS. Runs unref'd so it
// never keeps the process alive on its own.
let sweeper = null;
const startSweeper = () => {
  if (sweeper) return;
  sweeper = setInterval(async () => {
    const now = Date.now();
    for (const [name, entry] of [...tenantConnections.entries()]) {
      if (now - entry.lastUsed > IDLE_MS) {
        // eslint-disable-next-line no-await-in-loop
        await evict(name, 'idle');
      }
    }
  }, SWEEP_MS);
  if (sweeper.unref) sweeper.unref();
};

const closeAllConnections = async () => {
  if (sweeper) { clearInterval(sweeper); sweeper = null; }
  for (const [name, entry] of tenantConnections) {
    await entry.conn.close();
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