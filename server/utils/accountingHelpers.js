// server/utils/accountingHelpers.js

function validateDoubleEntry(lines) {
  let totalDebit = 0;
  let totalCredit = 0;

  for (const line of lines) {
    totalDebit += Number(line.debit) || 0;
    totalCredit += Number(line.credit) || 0;

    if ((line.debit > 0) && (line.credit > 0)) {
      return {
        valid: false,
        totalDebit,
        totalCredit,
        difference: 0,
        error: `Line for account ${line.accountCode || line.account} has both debit and credit values. Each line must be one or the other.`,
      };
    }

    if ((!line.debit || line.debit === 0) && (!line.credit || line.credit === 0)) {
      return {
        valid: false,
        totalDebit,
        totalCredit,
        difference: 0,
        error: `Line for account ${line.accountCode || line.account} has no debit or credit value.`,
      };
    }
  }

  totalDebit = Math.round(totalDebit * 100) / 100;
  totalCredit = Math.round(totalCredit * 100) / 100;
  const difference = Math.round((totalDebit - totalCredit) * 100) / 100;

  return {
    valid: difference === 0,
    totalDebit,
    totalCredit,
    difference,
    error: difference !== 0
      ? `Debits (${totalDebit}) do not equal Credits (${totalCredit}). Difference: ${difference}`
      : null,
  };
}

async function generateEntryNumber(JournalEntry) {
  const lastEntry = await JournalEntry
    .findOne({})
    .sort({ createdAt: -1 })
    .select('entryNumber')
    .lean();

  if (!lastEntry || !lastEntry.entryNumber) {
    return 'JE-000001';
  }

  const lastNum = parseInt(lastEntry.entryNumber.replace('JE-', ''), 10);
  const nextNum = (lastNum + 1).toString().padStart(6, '0');
  return `JE-${nextNum}`;
}

function calculateBalanceChange(normalBalance, debit, credit) {
  if (normalBalance === 'debit') {
    return (Number(debit) || 0) - (Number(credit) || 0);
  }
  return (Number(credit) || 0) - (Number(debit) || 0);
}

module.exports = {
  validateDoubleEntry,
  generateEntryNumber,
  calculateBalanceChange,
};