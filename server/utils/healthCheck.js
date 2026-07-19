// server/utils/healthCheck.js
// Real system-vitals health report for the operator console.
//
// Reports things that actually indicate trouble: process uptime (a reset to
// near-zero means it crashed & restarted), memory (climbing = leak), CPU,
// master-DB connection state, and how many tenant connections are live right
// now. All read cheaply from the running process — no external calls.

const os = require('os');
const mongoose = require('mongoose');
const { tenantConnections } = require('../config/db');

// mongoose readyState: 0 disconnected, 1 connected, 2 connecting, 3 disconnecting
const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

const bytesToMb = (b) => Math.round((b / 1024 / 1024) * 10) / 10;

const getHealth = () => {
  const mem = process.memoryUsage();
  const uptimeSec = Math.floor(process.uptime());

  // Master DB connection state.
  const dbReady = mongoose.connection?.readyState ?? 0;

  // Live tenant connections (those in readyState 1). The map may hold entries
  // that dropped, so we count only the truly-connected ones.
  let liveTenants = 0;
  try {
    for (const conn of tenantConnections.values()) {
      if (conn.readyState === 1) liveTenants += 1;
    }
  } catch { /* map unavailable — leave at 0 */ }

  // Load average (1-min) as a fraction of CPU count — a rough overload gauge.
  const cpuCount = os.cpus()?.length || 1;
  const load1 = os.loadavg()[0];

  return {
    status: dbReady === 1 ? 'healthy' : 'degraded',
    uptimeSeconds: uptimeSec,
    memory: {
      heapUsedMb: bytesToMb(mem.heapUsed),
      heapTotalMb: bytesToMb(mem.heapTotal),
      rssMb: bytesToMb(mem.rss),
    },
    system: {
      cpuCount,
      loadAvg1: Math.round(load1 * 100) / 100,
      loadPercent: Math.round((load1 / cpuCount) * 100),
      totalMemMb: bytesToMb(os.totalmem()),
      freeMemMb: bytesToMb(os.freemem()),
    },
    database: {
      master: DB_STATES[dbReady] || 'unknown',
      masterConnected: dbReady === 1,
      liveTenantConnections: liveTenants,
    },
    process: {
      pid: process.pid,
      nodeVersion: process.version,
      platform: process.platform,
      env: process.env.NODE_ENV || 'development',
    },
    timestamp: new Date().toISOString(),
  };
};

module.exports = { getHealth };