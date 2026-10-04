// server/utils/externalMappingHelper.js
//
// Translates a RAW external payload into a Books-format voucher using a saved
// ExternalMapping. Pure function (no DB) so it is easy to test; the caller
// resolves account codes against the real chart of accounts afterwards.

// Read a possibly-dotted path from an object: get(obj, 'a.b') -> obj.a.b
function getPath(obj, path) {
  if (!path) return undefined;
  return String(path).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/**
 * Apply a mapping to a raw payload.
 * @returns { ok, voucher?, error? }
 *   voucher is in Books format but with debitAccountCode/creditAccountCode
 *   already translated via accountMap. The caller still validates the codes
 *   exist in the chart of accounts.
 */
function applyMapping(mapping, raw) {
  if (!mapping || !mapping.active) return { ok: false, error: 'No active mapping for this source.' };
  const fm = mapping.fieldMap || {};

  // 1. Resolve each Books field from the mapped external field.
  const val = (field) => (fm[field] ? getPath(raw, fm[field]) : undefined);

  // 2. Voucher type: fixed, or mapped from an external type value.
  //    The matched typeMap entry also carries the per-person sub-ledger side
  //    (partySide), so look it up even when the voucher type itself is fixed.
  const extType = val('voucherType');
  const typeHit = extType != null
    ? (mapping.typeMap || []).find((t) => String(t.externalType) === String(extType))
    : null;
  let voucherType = mapping.fixedVoucherType || (typeHit ? typeHit.voucherType : null);
  if (!voucherType) return { ok: false, error: 'Could not determine voucherType (check fixedVoucherType or typeMap).' };
  const partySide = typeHit && (typeHit.partySide === 'debit' || typeHit.partySide === 'credit')
    ? typeHit.partySide
    : null;

  // 2c. Company guard. When the source is restricted to one company, reject any
  //     record that belongs to a different one (keeps another company's data out
  //     of this tenant's books).
  const companyId = val('companyId');
  const allowedCompany = mapping.sourceCompanyId != null && String(mapping.sourceCompanyId).trim() !== ''
    ? String(mapping.sourceCompanyId).trim() : null;
  if (allowedCompany && String(companyId == null ? '' : companyId) !== allowedCompany) {
    return { ok: false, error: `Record company "${companyId}" is not the allowed company "${allowedCompany}" for this source.` };
  }

  // 3. Translate external account ids -> Books account codes via accountMap.
  const mapAccount = (extVal) => {
    if (extVal == null || extVal === '') return null;
    const hit = (mapping.accountMap || []).find((a) => String(a.externalAccount) === String(extVal));
    return hit ? hit.booksCode : null;
  };
  const extDebit = val('debitAccount');
  const extCredit = val('creditAccount');

  // 3a. Group-driven classification (preferred). When the leg's GROUP fields are
  //     mapped, each leg is classified by its ledger group: a group in
  //     partyGroups is a person ledger (auto-created downstream), everything else
  //     is a GL account looked up in accountMap. The person's side (receivable vs
  //     payable) simply follows whichever leg they sit on.
  const groupDriven = !!(fm.debitGroup || fm.creditGroup);
  const toSet = (s, dflt) => new Set(String(s == null || s === '' ? dflt : s).split(',').map((x) => x.trim()).filter(Boolean));
  const partyGroupSet = toSet(mapping.partyGroups, '4,7');
  const payableGroupSet = toSet(mapping.partyPayableGroups, '7');

  let legs = null;
  let debitAccountCode = null;
  let creditAccountCode = null;

  if (groupDriven) {
    const buildLeg = (side) => {
      const extLedger = side === 'debit' ? extDebit : extCredit;
      const grpRaw = side === 'debit' ? val('debitGroup') : val('creditGroup');
      const nm = side === 'debit' ? val('debitName') : val('creditName');
      const group = grpRaw == null || grpRaw === '' ? null : String(grpRaw);
      const isParty = group != null && partyGroupSet.has(group);
      const isPayable = isParty && payableGroupSet.has(group);
      let booksCode = null;
      if (!isParty) booksCode = mapAccount(extLedger);
      return {
        externalLedger: extLedger == null ? null : String(extLedger),
        group, isParty, isPayable,
        name: (nm == null ? '' : String(nm)) || (val('partyName') || ''),
        booksCode,
      };
    };
    const debit = buildLeg('debit');
    const credit = buildLeg('credit');
    for (const [side, leg] of [['debit', debit], ['credit', credit]]) {
      if (leg.isParty) {
        if (!leg.externalLedger) return { ok: false, error: `Missing ${side} ledger id for a party (group ${leg.group}) leg.` };
      } else if (leg.booksCode == null) {
        return { ok: false, error: `No account mapping for external ${side} ledger "${leg.externalLedger}" (group ${leg.group == null ? 'n/a' : leg.group}). Map it, or mark its group as a party group.` };
      }
    }
    legs = { debit, credit };
  } else {
    // Legacy path: both legs come straight from accountMap; a party (if any) is
    // flagged by partyId + typeMap.partySide and overridden downstream.
    debitAccountCode = mapAccount(extDebit);
    creditAccountCode = mapAccount(extCredit);
    if (debitAccountCode == null) return { ok: false, error: `No account mapping for external debit account "${extDebit}".` };
    if (creditAccountCode == null) return { ok: false, error: `No account mapping for external credit account "${extCredit}".` };
  }

  // 3b. Translate external branch -> Books branch code via branchMap.
  //     If the record carries a branch value, it MUST map (an unmapped branch is
  //     rejected rather than silently mis-filed). If no branch value is sent, fall
  //     back to fixedBranch (may be null — the caller then applies the write-branch
  //     rule for single- vs multi-branch tenants).
  let branchCode = null;
  const extBranch = val('branch');
  if (extBranch != null && extBranch !== '') {
    const hit = (mapping.branchMap || []).find((b) => String(b.externalBranch) === String(extBranch));
    if (!hit) return { ok: false, error: `No branch mapping for external branch "${extBranch}".` };
    branchCode = hit.booksBranchCode;
  } else if (mapping.fixedBranch) {
    branchCode = mapping.fixedBranch;
  }

  // 4. externalId is required for dedup.
  const externalId = val('externalId');
  if (externalId == null || externalId === '') return { ok: false, error: 'externalId mapping is required (dedup).' };

  const amount = Number(val('amount'));
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Amount is missing or not positive after mapping.' };

  const voucher = {
    voucherType,
    date: val('date') || new Date(),
    amount,
    narration: val('narration') || '',
    reference: val('reference') || '',
    externalId: String(externalId),
    partyName: val('partyName') || '',
    mode: val('mode') || 'other',
    // Legacy path provides the two codes directly; group-driven path provides
    // `legs` and the caller resolves each (provisioning party ledgers).
    debitAccountCode: debitAccountCode == null ? null : String(debitAccountCode),
    creditAccountCode: creditAccountCode == null ? null : String(creditAccountCode),
    legs,
    companyId: companyId == null ? null : String(companyId),
    branchCode: branchCode == null ? null : String(branchCode),
    autopost: mapping.autopost !== false,
    // Per-person sub-ledger config (used by both paths).
    partyId: (() => { const v = val('partyId'); return v == null || v === '' ? null : String(v); })(),
    partySide,
    partyControlCode: mapping.partyControlCode || '1100',
    partyPayableControlCode: mapping.partyPayableControlCode || '2000',
    partyCodePrefix: mapping.partyCodePrefix || 'SL-',
  };
  return { ok: true, voucher };
}

module.exports = { applyMapping, getPath };
