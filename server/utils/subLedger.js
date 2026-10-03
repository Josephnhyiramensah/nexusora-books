'use strict';

/**
 * Per-person subsidiary ledger provisioning.
 *
 * One dynamic ledger per party, keyed by the external person/ledger ID. The
 * ledger lives under a control account (parentCode, default 1100) and is
 * debit-normal:
 *   • debit balance  → the party owes us        (receivable)
 *   • credit balance → we owe the party         (payable)
 * The Ledgers area splits parties into Receivables / Payables by that sign,
 * so a single person's whole story lives in one statement that can flip side
 * over time — matching how the accountant described it.
 *
 * Classification is driven by the transaction TYPE (see ExternalMapping
 * typeMap.partySide): the type decides whether the party ledger is the debit
 * or the credit leg; the other leg is the mapped contra (Cash, Inventory, …).
 */

/**
 * Find or create the ledger account for an external party.
 *
 * @param {Model}  Account   the tenant's Account model
 * @param {object} opts
 *   partyId      – REQUIRED external person/ledger id (the unique key)
 *   partyName    – display name (names may duplicate; id stays the key)
 *   controlCode  – parent control account code (default '1100')
 *   prefix       – code prefix for the generated account (default 'SL-')
 *   createdBy    – optional User id
 * @returns {Promise<Account|null>} the ledger account, or null if no partyId
 */
async function getOrCreatePartyLedger(Account, { partyId, partyName, controlCode = '1100', prefix = 'SL-', createdBy = null } = {}) {
  const pid = partyId == null ? '' : String(partyId).trim();
  if (!pid) return null;

  // Existing ledger for this party → reuse it (and refresh the display name if
  // the upstream name changed; the id, not the name, is the identity).
  const existing = await Account.findOne({ externalPartyId: pid });
  if (existing) {
    if (partyName && String(partyName).trim() && existing.name !== String(partyName).trim()) {
      existing.name = String(partyName).trim();
      await existing.save();
    }
    return existing;
  }

  // New ledger. Code is deterministic from the party id so it is stable and
  // readable; if that code somehow clashes with a hand-made account, fall back
  // to a suffixed one rather than throwing.
  const baseCode = `${prefix}${pid}`;
  const clash = await Account.findOne({ code: baseCode });
  const code = clash ? `${prefix}${pid}-${Date.now().toString().slice(-4)}` : baseCode;

  return Account.create({
    code,
    name: (partyName && String(partyName).trim()) || `Party ${pid}`,
    type: 'asset',                         // debit-normal; sign carries receivable/payable
    category: 'Trade Receivables / Payables',
    parentCode: String(controlCode || '1100'),
    normalBalance: 'debit',
    isActive: true,
    isSystemAccount: false,
    isSubLedger: true,
    externalPartyId: pid,
    balance: 0,
    createdBy,
  });
}

module.exports = { getOrCreatePartyLedger };
