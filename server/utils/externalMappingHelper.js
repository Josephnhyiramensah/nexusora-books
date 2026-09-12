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
  let voucherType = mapping.fixedVoucherType || null;
  if (!voucherType) {
    const extType = val('voucherType');
    if (extType != null) {
      const hit = (mapping.typeMap || []).find((t) => String(t.externalType) === String(extType));
      voucherType = hit ? hit.voucherType : null;
    }
  }
  if (!voucherType) return { ok: false, error: 'Could not determine voucherType (check fixedVoucherType or typeMap).' };

  // 3. Translate external account ids -> Books account codes via accountMap.
  const mapAccount = (extVal) => {
    if (extVal == null || extVal === '') return null;
    const hit = (mapping.accountMap || []).find((a) => String(a.externalAccount) === String(extVal));
    return hit ? hit.booksCode : null;
  };
  const extDebit = val('debitAccount');
  const extCredit = val('creditAccount');
  const debitAccountCode = mapAccount(extDebit);
  const creditAccountCode = mapAccount(extCredit);

  if (debitAccountCode == null) return { ok: false, error: `No account mapping for external debit account "${extDebit}".` };
  if (creditAccountCode == null) return { ok: false, error: `No account mapping for external credit account "${extCredit}".` };

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
    debitAccountCode: String(debitAccountCode),
    creditAccountCode: String(creditAccountCode),
    autopost: mapping.autopost !== false,
  };
  return { ok: true, voucher };
}

module.exports = { applyMapping, getPath };
