// server/controllers/currencyController.js
const { getModel } = require('../utils/getModel');
const { logAudit } = require('../middleware/auditMiddleware');

const baseOf = (req) => (req.tenant?.settings?.baseCurrency || 'GHS').toUpperCase();
const enabledOf = (req) => (req.tenant?.settings?.currencies || []).map((c) => String(c).toUpperCase());

// Latest rate per currency — manual wins over live for the same (or newer) date.
const getRates = async (req, res) => {
  try {
    const ExchangeRate = getModel(req.tenantDb, 'ExchangeRate');
    const base = baseOf(req);
    const currencies = enabledOf(req);
    const out = [];
    for (const cur of currencies) {
      // newest manual first; if none, newest live
      const manual = await ExchangeRate.findOne({ currency: cur, source: 'manual' }).sort({ asOf: -1 }).lean();
      const live = await ExchangeRate.findOne({ currency: cur, source: 'live' }).sort({ asOf: -1 }).lean();
      let chosen = manual;
      if (live && (!manual || new Date(live.asOf) > new Date(manual.asOf))) chosen = manual || live;
      // manual always wins when present regardless of live date (accountant's control)
      if (manual) chosen = manual;
      else chosen = live;
      out.push({
        currency: cur, base,
        rate: chosen ? chosen.rate : null,
        asOf: chosen ? chosen.asOf : null,
        source: chosen ? chosen.source : null,
        hasManual: !!manual, hasLive: !!live,
      });
    }
    res.json({ success: true, data: { base, rates: out } });
  } catch (error) {
    console.error('[Currency] getRates error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch rates.' });
  }
};

// Admin sets a manual rate (takes precedence).
const setManualRate = async (req, res) => {
  try {
    const ExchangeRate = getModel(req.tenantDb, 'ExchangeRate');
    const base = baseOf(req);
    const currency = String(req.body.currency || '').toUpperCase();
    const rate = Number(req.body.rate);
    if (!currency || !(rate > 0)) {
      return res.status(400).json({ success: false, message: 'A currency and a positive rate are required.' });
    }
    const asOf = req.body.asOf ? new Date(req.body.asOf) : new Date();
    const doc = await ExchangeRate.create({ base, currency, rate, asOf, source: 'manual', setBy: req.user._id });
    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'update', module: 'settings',
      entityId: doc._id, entityType: 'ExchangeRate',
      description: 'Set manual rate 1 ' + currency + ' = ' + rate + ' ' + base,
    }, req);
    res.status(201).json({ success: true, message: 'Rate saved.', data: doc });
  } catch (error) {
    console.error('[Currency] setManualRate error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to save rate.' });
  }
};

// Fetch live rates from the free open.er-api.com endpoint. Stores a 'live' row
// for each enabled currency. Does NOT overwrite a manual rate set today.
const fetchLiveRates = async (req, res) => {
  try {
    const ExchangeRate = getModel(req.tenantDb, 'ExchangeRate');
    const base = baseOf(req);
    const currencies = enabledOf(req);
    if (currencies.length === 0) {
      return res.json({ success: true, message: 'No currencies enabled. Add currencies in Settings first.', data: { fetched: [] } });
    }
    // API returns rates with a chosen base; we query base = tenant base so that
    // result.rates[CUR] = how many CUR per 1 base. We invert to base-per-CUR.
    const resp = await fetch('https://open.er-api.com/v6/latest/' + base);
    const data = await resp.json();
    if (!data || data.result !== 'success' || !data.rates) {
      return res.status(502).json({ success: false, message: 'Live rate service unavailable. You can set rates manually.' });
    }
    const asOf = new Date();
    const fetched = [];
    for (const cur of currencies) {
      const perBase = data.rates[cur]; // CUR per 1 base
      if (!perBase || perBase <= 0) continue;
      const rate = Math.round((1 / perBase) * 1e6) / 1e6; // base per 1 CUR
      await ExchangeRate.create({ base, currency: cur, rate, asOf, source: 'live' });
      fetched.push({ currency: cur, rate });
    }
    await logAudit(req.tenantDb, {
      userId: req.user._id, action: 'update', module: 'settings',
      entityType: 'ExchangeRate',
      description: 'Fetched live rates for ' + fetched.map((x) => x.currency).join(', '),
    }, req);
    res.json({ success: true, message: 'Fetched ' + fetched.length + ' live rate(s).', data: { fetched } });
  } catch (error) {
    console.error('[Currency] fetchLiveRates error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch live rates. You can set rates manually.' });
  }
};

// Helper for later stages: the applicable rate for a currency on a given date
// (manual preferred, else live, the most recent on-or-before the date).
const getRateForDate = async (tenantDb, base, currency, date) => {
  if (String(currency).toUpperCase() === String(base).toUpperCase()) return 1;
  const ExchangeRate = getModel(tenantDb, 'ExchangeRate');
  const d = new Date(date);
  const manual = await ExchangeRate.findOne({ currency: currency.toUpperCase(), source: 'manual', asOf: { $lte: d } }).sort({ asOf: -1 }).lean();
  if (manual) return manual.rate;
  const live = await ExchangeRate.findOne({ currency: currency.toUpperCase(), asOf: { $lte: d } }).sort({ asOf: -1 }).lean();
  return live ? live.rate : null;
};

module.exports = { getRates, setManualRate, fetchLiveRates, getRateForDate };
