// ─────────────────────────────────────────────────────────────────────────────
// Accounting Service — Chart of Accounts, Journal Entries, Ledger, Reports
// Double-entry bookkeeping (Tally-like) with Nepal fiscal year support
// ─────────────────────────────────────────────────────────────────────────────
const { getPrisma } = require('../lib/prisma');
const { auditLog } = require('../lib/audit');
const { eventBus } = require('../lib/eventBus');

// ═══════════════════════════════════════════════════════════════════════════════
// FISCAL YEAR
// ═══════════════════════════════════════════════════════════════════════════════

async function listFiscalYears(orgId) {
  const prisma = getPrisma();
  return prisma.fiscalYear.findMany({ where: { orgId }, orderBy: { startDate: 'desc' } });
}

async function createFiscalYear({ orgId, data, adminId, req }) {
  const prisma = getPrisma();
  // If setting as current, unset all others
  if (data.isCurrent) {
    await prisma.fiscalYear.updateMany({ where: { orgId, isCurrent: true }, data: { isCurrent: false } });
  }
  const fy = await prisma.fiscalYear.create({
    data: {
      orgId, name: data.name,
      startDate: new Date(data.startDate), endDate: new Date(data.endDate),
      isCurrent: data.isCurrent || false, status: data.status || 'OPEN',
    },
  });
  await auditLog({ orgId, action: 'fiscal_year.create', performedBy: adminId, entityType: 'FiscalYear', entityId: fy.id, details: { name: fy.name }, req });
  return fy;
}

async function updateFiscalYear({ orgId, fyId, data, adminId, req }) {
  const prisma = getPrisma();
  const existing = await prisma.fiscalYear.findFirst({ where: { id: fyId, orgId } });
  if (!existing) throw Object.assign(new Error('Fiscal year not found'), { status: 404 });
  if (data.isCurrent) {
    await prisma.fiscalYear.updateMany({ where: { orgId, isCurrent: true }, data: { isCurrent: false } });
  }
  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
  if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);
  if (data.isCurrent !== undefined) updateData.isCurrent = data.isCurrent;
  if (data.status !== undefined) updateData.status = data.status;
  const fy = await prisma.fiscalYear.update({ where: { id: fyId }, data: updateData });
  await auditLog({ orgId, action: 'fiscal_year.update', performedBy: adminId, entityType: 'FiscalYear', entityId: fyId, details: updateData, req });
  return fy;
}

async function getCurrentFiscalYear(orgId) {
  const prisma = getPrisma();
  const fy = await prisma.fiscalYear.findFirst({ where: { orgId, isCurrent: true } });
  if (!fy) throw Object.assign(new Error('No active fiscal year. Please create one first.'), { status: 400 });
  return fy;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHART OF ACCOUNTS
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_ACCOUNTS = [
  // Assets
  { code: '1000', name: 'Assets', nameNp: 'सम्पत्ति', type: 'ASSET', isGroup: true },
  { code: '1100', name: 'Cash & Bank', nameNp: 'नगद तथा बैंक', type: 'ASSET', isGroup: true, parentCode: '1000' },
  { code: '1101', name: 'Cash in Hand', nameNp: 'हातमा नगद', type: 'ASSET', parentCode: '1100' },
  { code: '1102', name: 'Bank Account', nameNp: 'बैंक खाता', type: 'ASSET', parentCode: '1100' },
  { code: '1200', name: 'Accounts Receivable', nameNp: 'प्राप्य रकम', type: 'ASSET', isGroup: true, parentCode: '1000' },
  { code: '1201', name: 'Trade Receivables', nameNp: 'व्यापार प्राप्य', type: 'ASSET', parentCode: '1200' },
  { code: '1300', name: 'Inventory', nameNp: 'सामग्री', type: 'ASSET', parentCode: '1000' },
  { code: '1400', name: 'Fixed Assets', nameNp: 'स्थिर सम्पत्ति', type: 'ASSET', isGroup: true, parentCode: '1000' },
  { code: '1401', name: 'Furniture & Fixtures', nameNp: 'फर्निचर', type: 'ASSET', parentCode: '1400' },
  { code: '1402', name: 'Computer & Equipment', nameNp: 'कम्प्युटर तथा उपकरण', type: 'ASSET', parentCode: '1400' },
  { code: '1500', name: 'TDS Receivable', nameNp: 'अग्रिम कर', type: 'ASSET', parentCode: '1000' },
  // Liabilities
  { code: '2000', name: 'Liabilities', nameNp: 'दायित्व', type: 'LIABILITY', isGroup: true },
  { code: '2100', name: 'Accounts Payable', nameNp: 'देय रकम', type: 'LIABILITY', isGroup: true, parentCode: '2000' },
  { code: '2101', name: 'Trade Payables', nameNp: 'व्यापार देय', type: 'LIABILITY', parentCode: '2100' },
  { code: '2200', name: 'Tax Payable', nameNp: 'कर देय', type: 'LIABILITY', isGroup: true, parentCode: '2000' },
  { code: '2201', name: 'VAT Payable', nameNp: 'मूल्य अभिवृद्धि कर देय', type: 'LIABILITY', parentCode: '2200' },
  { code: '2202', name: 'TDS Payable', nameNp: 'स्रोतमा कर कट्टी देय', type: 'LIABILITY', parentCode: '2200' },
  { code: '2203', name: 'Income Tax Payable', nameNp: 'आयकर देय', type: 'LIABILITY', parentCode: '2200' },
  { code: '2300', name: 'Salary Payable', nameNp: 'तलब देय', type: 'LIABILITY', parentCode: '2000' },
  { code: '2400', name: 'SSF Payable', nameNp: 'सामाजिक सुरक्षा कोष देय', type: 'LIABILITY', parentCode: '2000' },
  // Equity
  { code: '3000', name: 'Equity', nameNp: 'पूँजी', type: 'EQUITY', isGroup: true },
  { code: '3100', name: 'Capital', nameNp: 'पूँजी', type: 'EQUITY', parentCode: '3000' },
  { code: '3200', name: 'Retained Earnings', nameNp: 'संचित मुनाफा', type: 'EQUITY', parentCode: '3000' },
  // Income
  { code: '4000', name: 'Income', nameNp: 'आय', type: 'INCOME', isGroup: true },
  { code: '4100', name: 'Sales Revenue', nameNp: 'बिक्री आय', type: 'INCOME', parentCode: '4000' },
  { code: '4200', name: 'Service Revenue', nameNp: 'सेवा आय', type: 'INCOME', parentCode: '4000' },
  { code: '4300', name: 'Other Income', nameNp: 'अन्य आय', type: 'INCOME', parentCode: '4000' },
  // Expenses
  { code: '5000', name: 'Expenses', nameNp: 'खर्च', type: 'EXPENSE', isGroup: true },
  { code: '5100', name: 'Salary & Wages', nameNp: 'तलब तथा ज्याला', type: 'EXPENSE', parentCode: '5000' },
  { code: '5200', name: 'Rent Expense', nameNp: 'भाडा खर्च', type: 'EXPENSE', parentCode: '5000' },
  { code: '5300', name: 'Utilities', nameNp: 'उपयोगिता खर्च', type: 'EXPENSE', parentCode: '5000' },
  { code: '5400', name: 'Office Supplies', nameNp: 'कार्यालय सामग्री', type: 'EXPENSE', parentCode: '5000' },
  { code: '5500', name: 'Professional Fees', nameNp: 'व्यावसायिक शुल्क', type: 'EXPENSE', parentCode: '5000' },
  { code: '5600', name: 'Depreciation', nameNp: 'मूल्यह्रास', type: 'EXPENSE', parentCode: '5000' },
  { code: '5700', name: 'Purchase Expense', nameNp: 'खरिद खर्च', type: 'EXPENSE', parentCode: '5000' },
  { code: '5800', name: 'Bonus & Incentives', nameNp: 'बोनस तथा प्रोत्साहन', type: 'EXPENSE', parentCode: '5000' },
  { code: '5900', name: 'Miscellaneous Expense', nameNp: 'विविध खर्च', type: 'EXPENSE', parentCode: '5000' },
];

async function seedDefaultAccounts(orgId) {
  const prisma = getPrisma();
  const existing = await prisma.chartOfAccount.count({ where: { orgId } });
  if (existing > 0) return;

  // First pass: create all accounts without parent links
  const accountMap = {};
  for (const acc of DEFAULT_ACCOUNTS) {
    const created = await prisma.chartOfAccount.create({
      data: { orgId, code: acc.code, name: acc.name, nameNp: acc.nameNp, type: acc.type, isGroup: acc.isGroup || false, isSystem: true },
    });
    accountMap[acc.code] = created.id;
  }
  // Second pass: set parent links
  for (const acc of DEFAULT_ACCOUNTS) {
    if (acc.parentCode && accountMap[acc.parentCode]) {
      await prisma.chartOfAccount.update({ where: { id: accountMap[acc.code] }, data: { parentId: accountMap[acc.parentCode] } });
    }
  }
}

async function listAccounts({ orgId, type, isGroup, parentId }) {
  const prisma = getPrisma();
  const where = { orgId, isActive: true };
  if (type) where.type = type;
  if (isGroup !== undefined) where.isGroup = isGroup === 'true' || isGroup === true;
  if (parentId) where.parentId = parentId;
  return prisma.chartOfAccount.findMany({
    where,
    include: { parent: { select: { code: true, name: true } }, _count: { select: { children: true, journalLines: true } } },
    orderBy: { code: 'asc' },
  });
}

async function createAccount({ orgId, data, adminId, req }) {
  const prisma = getPrisma();
  const account = await prisma.chartOfAccount.create({
    data: {
      orgId, code: data.code, name: data.name, nameNp: data.nameNp || null,
      type: data.type, parentId: data.parentId || null, isGroup: data.isGroup || false,
      description: data.description || null, openingBalance: data.openingBalance || 0,
    },
  });
  await auditLog({ orgId, action: 'account.create', performedBy: adminId, entityType: 'ChartOfAccount', entityId: account.id, details: { code: account.code, name: account.name }, req });
  return account;
}

async function updateAccount({ orgId, accountId, data, adminId, req }) {
  const prisma = getPrisma();
  const existing = await prisma.chartOfAccount.findFirst({ where: { id: accountId, orgId } });
  if (!existing) throw Object.assign(new Error('Account not found'), { status: 404 });
  if (existing.isSystem && data.code) throw Object.assign(new Error('Cannot change code of system account'), { status: 400 });

  const updateData = {};
  for (const f of ['name', 'nameNp', 'description', 'parentId', 'isGroup', 'isActive', 'openingBalance']) {
    if (data[f] !== undefined) updateData[f] = data[f];
  }
  if (data.code !== undefined) updateData.code = data.code;
  const account = await prisma.chartOfAccount.update({ where: { id: accountId }, data: updateData });
  await auditLog({ orgId, action: 'account.update', performedBy: adminId, entityType: 'ChartOfAccount', entityId: accountId, details: updateData, req });
  return account;
}

async function deleteAccount({ orgId, accountId, adminId, req }) {
  const prisma = getPrisma();
  const existing = await prisma.chartOfAccount.findFirst({ where: { id: accountId, orgId } });
  if (!existing) throw Object.assign(new Error('Account not found'), { status: 404 });
  if (existing.isSystem) throw Object.assign(new Error('Cannot delete system account'), { status: 400 });
  const lineCount = await prisma.journalLine.count({ where: { accountId } });
  if (lineCount > 0) throw Object.assign(new Error('Cannot delete account with journal entries'), { status: 400 });
  await prisma.chartOfAccount.delete({ where: { id: accountId } });
  await auditLog({ orgId, action: 'account.delete', performedBy: adminId, entityType: 'ChartOfAccount', entityId: accountId, details: { code: existing.code }, req });
}

// ═══════════════════════════════════════════════════════════════════════════════
// JOURNAL ENTRIES (double-entry)
// ═══════════════════════════════════════════════════════════════════════════════

async function listJournalEntries({ orgId, fiscalYearId, voucherType, status, startDate, endDate, limit }) {
  const prisma = getPrisma();
  const where = { orgId };
  if (fiscalYearId) where.fiscalYearId = fiscalYearId;
  if (voucherType) where.voucherType = voucherType;
  if (status) where.status = status;
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);
  }
  return prisma.journalEntry.findMany({
    where,
    include: {
      lines: { include: { account: { select: { code: true, name: true, type: true } } } },
      creator: { select: { name: true } },
      fiscalYear: { select: { name: true } },
    },
    orderBy: { date: 'desc' },
    take: limit ? Number(limit) : 100,
  });
}

async function createJournalEntry({ orgId, data, adminId, req }) {
  const prisma = getPrisma();
  const fy = data.fiscalYearId
    ? await prisma.fiscalYear.findFirst({ where: { id: data.fiscalYearId, orgId } })
    : await getCurrentFiscalYear(orgId);
  if (!fy) throw Object.assign(new Error('Fiscal year not found'), { status: 400 });
  if (fy.status !== 'OPEN') throw Object.assign(new Error('Fiscal year is closed'), { status: 400 });

  // Validate lines — debits must equal credits
  const lines = data.lines || [];
  if (lines.length < 2) throw Object.assign(new Error('Journal entry needs at least 2 lines'), { status: 400 });
  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw Object.assign(new Error(`Debit (${totalDebit}) ≠ Credit (${totalCredit}). Entry must balance.`), { status: 400 });
  }

  // Get next entry number
  const lastEntry = await prisma.journalEntry.findFirst({
    where: { orgId, fiscalYearId: fy.id },
    orderBy: { entryNumber: 'desc' },
    select: { entryNumber: true },
  });
  const entryNumber = (lastEntry?.entryNumber || 0) + 1;

  const entry = await prisma.journalEntry.create({
    data: {
      orgId, fiscalYearId: fy.id, entryNumber,
      date: new Date(data.date), narration: data.narration, reference: data.reference || null,
      voucherType: data.voucherType || 'JOURNAL',
      status: data.status || 'DRAFT',
      totalDebit, totalCredit,
      createdBy: adminId,
      lines: {
        create: lines.map(l => ({
          accountId: l.accountId, debit: l.debit || 0, credit: l.credit || 0,
          narration: l.narration || null, costCenter: l.costCenter || null,
        })),
      },
    },
    include: { lines: { include: { account: { select: { code: true, name: true } } } } },
  });

  await auditLog({ orgId, action: 'journal.create', performedBy: adminId, entityType: 'JournalEntry', entityId: entry.id, details: { entryNumber, totalDebit, voucherType: entry.voucherType }, req });
  return entry;
}

async function postJournalEntry({ orgId, entryId, adminId, req }) {
  const prisma = getPrisma();
  const entry = await prisma.journalEntry.findFirst({ where: { id: entryId, orgId } });
  if (!entry) throw Object.assign(new Error('Entry not found'), { status: 404 });
  if (entry.status !== 'DRAFT') throw Object.assign(new Error('Only draft entries can be posted'), { status: 400 });

  const updated = await prisma.journalEntry.update({
    where: { id: entryId },
    data: { status: 'POSTED', approvedBy: adminId, approvedAt: new Date() },
  });
  await auditLog({ orgId, action: 'journal.post', performedBy: adminId, entityType: 'JournalEntry', entityId: entryId, details: { entryNumber: entry.entryNumber }, req });
  return updated;
}

async function voidJournalEntry({ orgId, entryId, adminId, req }) {
  const prisma = getPrisma();
  const entry = await prisma.journalEntry.findFirst({ where: { id: entryId, orgId } });
  if (!entry) throw Object.assign(new Error('Entry not found'), { status: 404 });
  if (entry.status !== 'POSTED') throw Object.assign(new Error('Only POSTED entries can be voided'), { status: 400 });
  const updated = await prisma.journalEntry.update({ where: { id: entryId }, data: { status: 'VOID' } });
  await auditLog({ orgId, action: 'journal.void', performedBy: adminId, entityType: 'JournalEntry', entityId: entryId, req });
  return updated;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEDGER & REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

async function getLedger({ orgId, accountId, fiscalYearId, startDate, endDate }) {
  const prisma = getPrisma();
  const account = await prisma.chartOfAccount.findFirst({ where: { id: accountId, orgId } });
  if (!account) throw Object.assign(new Error('Account not found'), { status: 404 });

  const where = { accountId, entry: { orgId, status: 'POSTED' } };
  if (fiscalYearId) where.entry.fiscalYearId = fiscalYearId;
  if (startDate || endDate) {
    where.entry.date = {};
    if (startDate) where.entry.date.gte = new Date(startDate);
    if (endDate) where.entry.date.lte = new Date(endDate);
  }

  const lines = await prisma.journalLine.findMany({
    where,
    include: { entry: { select: { entryNumber: true, date: true, narration: true, voucherType: true, reference: true } } },
    orderBy: { entry: { date: 'asc' } },
  });

  let runningBalance = Number(account.openingBalance);
  const isDebitNormal = ['ASSET', 'EXPENSE'].includes(account.type);
  const entries = lines.map(l => {
    const debit = Number(l.debit);
    const credit = Number(l.credit);
    runningBalance += isDebitNormal ? (debit - credit) : (credit - debit);
    return {
      date: l.entry.date, entryNumber: l.entry.entryNumber, narration: l.entry.narration,
      voucherType: l.entry.voucherType, reference: l.entry.reference,
      debit, credit, balance: runningBalance, lineNarration: l.narration,
    };
  });

  return { account, openingBalance: Number(account.openingBalance), entries, closingBalance: runningBalance };
}

async function getTrialBalance({ orgId, fiscalYearId }) {
  const prisma = getPrisma();
  const fy = fiscalYearId
    ? await prisma.fiscalYear.findFirst({ where: { id: fiscalYearId, orgId } })
    : await getCurrentFiscalYear(orgId);

  const accounts = await prisma.chartOfAccount.findMany({
    where: { orgId, isActive: true, isGroup: false },
    orderBy: { code: 'asc' },
  });

  const lines = await prisma.journalLine.groupBy({
    by: ['accountId'],
    where: { entry: { orgId, fiscalYearId: fy.id, status: 'POSTED' } },
    _sum: { debit: true, credit: true },
  });

  const lineMap = {};
  for (const l of lines) lineMap[l.accountId] = l._sum;

  let totalDebit = 0, totalCredit = 0;
  const rows = accounts.map(acc => {
    const sums = lineMap[acc.id] || { debit: 0, credit: 0 };
    const debit = Number(sums.debit || 0) + (['ASSET', 'EXPENSE'].includes(acc.type) ? Number(acc.openingBalance) : 0);
    const credit = Number(sums.credit || 0) + (['LIABILITY', 'EQUITY', 'INCOME'].includes(acc.type) ? Number(acc.openingBalance) : 0);
    const netDebit = debit > credit ? debit - credit : 0;
    const netCredit = credit > debit ? credit - debit : 0;
    totalDebit += netDebit;
    totalCredit += netCredit;
    return { code: acc.code, name: acc.name, type: acc.type, debit: netDebit, credit: netCredit };
  }).filter(r => r.debit > 0 || r.credit > 0);

  return { fiscalYear: fy.name, rows, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 };
}

async function getProfitAndLoss({ orgId, fiscalYearId }) {
  const prisma = getPrisma();
  const fy = fiscalYearId
    ? await prisma.fiscalYear.findFirst({ where: { id: fiscalYearId, orgId } })
    : await getCurrentFiscalYear(orgId);

  const lines = await prisma.journalLine.findMany({
    where: { entry: { orgId, fiscalYearId: fy.id, status: 'POSTED' }, account: { type: { in: ['INCOME', 'EXPENSE'] } } },
    include: { account: { select: { code: true, name: true, type: true } } },
  });

  const accountTotals = {};
  for (const l of lines) {
    const key = l.account.code;
    if (!accountTotals[key]) accountTotals[key] = { code: l.account.code, name: l.account.name, type: l.account.type, total: 0 };
    if (l.account.type === 'INCOME') accountTotals[key].total += Number(l.credit) - Number(l.debit);
    else accountTotals[key].total += Number(l.debit) - Number(l.credit);
  }

  const incomeAccounts = Object.values(accountTotals).filter(a => a.type === 'INCOME').sort((a, b) => a.code.localeCompare(b.code));
  const expenseAccounts = Object.values(accountTotals).filter(a => a.type === 'EXPENSE').sort((a, b) => a.code.localeCompare(b.code));
  const totalIncome = incomeAccounts.reduce((s, a) => s + a.total, 0);
  const totalExpense = expenseAccounts.reduce((s, a) => s + a.total, 0);

  return { fiscalYear: fy.name, incomeAccounts, expenseAccounts, totalIncome, totalExpense, netProfit: totalIncome - totalExpense };
}

async function getBalanceSheet({ orgId, fiscalYearId }) {
  const prisma = getPrisma();
  const fy = fiscalYearId
    ? await prisma.fiscalYear.findFirst({ where: { id: fiscalYearId, orgId } })
    : await getCurrentFiscalYear(orgId);

  const lines = await prisma.journalLine.findMany({
    where: { entry: { orgId, fiscalYearId: fy.id, status: 'POSTED' }, account: { type: { in: ['ASSET', 'LIABILITY', 'EQUITY'] } } },
    include: { account: { select: { code: true, name: true, type: true, openingBalance: true } } },
  });

  const accountTotals = {};
  for (const l of lines) {
    const key = l.account.code;
    if (!accountTotals[key]) accountTotals[key] = { code: l.account.code, name: l.account.name, type: l.account.type, total: Number(l.account.openingBalance) };
    if (l.account.type === 'ASSET') accountTotals[key].total += Number(l.debit) - Number(l.credit);
    else accountTotals[key].total += Number(l.credit) - Number(l.debit);
  }

  const assets = Object.values(accountTotals).filter(a => a.type === 'ASSET' && a.total !== 0);
  const liabilities = Object.values(accountTotals).filter(a => a.type === 'LIABILITY' && a.total !== 0);
  const equity = Object.values(accountTotals).filter(a => a.type === 'EQUITY' && a.total !== 0);
  const totalAssets = assets.reduce((s, a) => s + a.total, 0);
  const totalLiabilities = liabilities.reduce((s, a) => s + a.total, 0);

  // Include current period P&L (Net Profit) in equity
  const pnl = await getProfitAndLoss({ orgId, fiscalYearId: fy.id });
  const netProfit = pnl.netProfit || 0;
  if (Math.abs(netProfit) > 0.01) {
    equity.push({ code: 'NET_PL', name: 'Current Period Profit/Loss', type: 'EQUITY', total: netProfit });
  }
  const totalEquity = equity.reduce((s, a) => s + a.total, 0);

  return { fiscalYear: fy.name, assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity, netProfit, balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// YEAR-END CLOSE
// ═══════════════════════════════════════════════════════════════════════════════

async function closeFiscalYear({ orgId, fyId, adminId, req }) {
  const prisma = getPrisma();
  const fy = await prisma.fiscalYear.findFirst({ where: { id: fyId, orgId } });
  if (!fy) throw Object.assign(new Error('Fiscal year not found'), { status: 404 });
  if (fy.status !== 'OPEN') throw Object.assign(new Error('Fiscal year is not OPEN'), { status: 400 });

  // Calculate net P&L for the year
  const pnl = await getProfitAndLoss({ orgId, fiscalYearId: fy.id });
  const netProfit = pnl.netProfit || 0;

  // Find retained earnings account (code 3200)
  const retainedEarnings = await prisma.chartOfAccount.findFirst({ where: { orgId, code: '3200' } });
  if (!retainedEarnings) throw Object.assign(new Error('Retained Earnings account (3200) not found. Seed default accounts first.'), { status: 400 });

  // Find a revenue/expense summary account or use retained earnings
  // Transfer net P&L to retained earnings via closing journal entry
  if (Math.abs(netProfit) > 0.01) {
    const lines = [];
    // Get all revenue accounts with balances
    const revenueLines = await prisma.journalLine.findMany({
      where: { entry: { orgId, fiscalYearId: fy.id, status: 'POSTED' }, account: { type: { equals: 'INCOME' } } },
      include: { account: { select: { id: true, code: true } } },
    });
    const revAccTotals = {};
    for (const l of revenueLines) {
      if (!revAccTotals[l.accountId]) revAccTotals[l.accountId] = 0;
      revAccTotals[l.accountId] += Number(l.credit) - Number(l.debit);
    }
    // Close revenue accounts (debit to zero them out)
    for (const [accId, total] of Object.entries(revAccTotals)) {
      if (Math.abs(total) > 0.01) {
        lines.push({ accountId: accId, debit: total > 0 ? total : 0, credit: total < 0 ? Math.abs(total) : 0, narration: 'Year-end close: income' });
      }
    }

    // Get all expense accounts with balances
    const expenseLines = await prisma.journalLine.findMany({
      where: { entry: { orgId, fiscalYearId: fy.id, status: 'POSTED' }, account: { type: { equals: 'EXPENSE' } } },
      include: { account: { select: { id: true, code: true } } },
    });
    const expAccTotals = {};
    for (const l of expenseLines) {
      if (!expAccTotals[l.accountId]) expAccTotals[l.accountId] = 0;
      expAccTotals[l.accountId] += Number(l.debit) - Number(l.credit);
    }
    // Close expense accounts (credit to zero them out)
    for (const [accId, total] of Object.entries(expAccTotals)) {
      if (Math.abs(total) > 0.01) {
        lines.push({ accountId: accId, debit: total < 0 ? Math.abs(total) : 0, credit: total > 0 ? total : 0, narration: 'Year-end close: expense' });
      }
    }

    // Transfer net to retained earnings
    if (netProfit > 0) {
      lines.push({ accountId: retainedEarnings.id, debit: 0, credit: netProfit, narration: 'Year-end close: net profit to retained earnings' });
    } else {
      lines.push({ accountId: retainedEarnings.id, debit: Math.abs(netProfit), credit: 0, narration: 'Year-end close: net loss to retained earnings' });
    }

    await createJournalEntry({
      orgId,
      data: {
        date: fy.endDate.toISOString().split('T')[0],
        narration: `Year-end closing entry — ${fy.name}`,
        reference: `CLOSE-${fy.name}`,
        voucherType: 'JOURNAL',
        status: 'POSTED',
        lines,
      },
      adminId,
      req,
    });
  }

  // Lock the fiscal year
  await prisma.fiscalYear.update({ where: { id: fyId }, data: { status: 'CLOSED' } });

  // Carry forward opening balances to balance sheet accounts
  const bsAccounts = await prisma.chartOfAccount.findMany({ where: { orgId, type: { in: ['ASSET', 'LIABILITY', 'EQUITY'] } } });
  for (const acc of bsAccounts) {
    const accLines = await prisma.journalLine.findMany({
      where: { accountId: acc.id, entry: { orgId, fiscalYearId: fy.id, status: 'POSTED' } },
    });
    let balance = Number(acc.openingBalance);
    for (const l of accLines) {
      if (acc.type === 'ASSET') balance += Number(l.debit) - Number(l.credit);
      else balance += Number(l.credit) - Number(l.debit);
    }
    await prisma.chartOfAccount.update({ where: { id: acc.id }, data: { openingBalance: balance } });
  }

  await auditLog({ orgId, action: 'fiscal_year.close', performedBy: adminId, entityType: 'FiscalYear', entityId: fyId, details: { name: fy.name, netProfit }, req });
  return { success: true, name: fy.name, netProfit };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT SUBSCRIPTIONS — Listens for events from other modules
// When accounting is extracted to its own service, these become message handlers
// ═══════════════════════════════════════════════════════════════════════════════

eventBus.subscribe('invoice.issued', 'accounting', async (data) => {
  const entry = await createJournalEntry({
    orgId: data.orgId,
    data: {
      date: data.date,
      narration: `${data.type} Invoice ${data.invoiceNumber} — ${data.partyName}`,
      reference: data.invoiceNumber,
      voucherType: data.voucherType,
      status: 'POSTED',
      lines: data.lines,
    },
    adminId: data.adminId,
    req: data.req,
  });
  if (data.onJournalCreated) await data.onJournalCreated(entry.id);
});

eventBus.subscribe('payment.recorded', 'accounting', async (data) => {
  const entry = await createJournalEntry({
    orgId: data.orgId,
    data: {
      date: data.date,
      narration: `Payment ${data.receiptNumber} — ${data.partyName}`,
      reference: data.receiptNumber,
      voucherType: data.voucherType,
      status: 'POSTED',
      lines: data.lines,
    },
    adminId: data.adminId,
    req: data.req,
  });
  if (data.onJournalCreated) await data.onJournalCreated(entry.id);
});

eventBus.subscribe('journal.void.requested', 'accounting', async (data) => {
  await voidJournalEntry({ orgId: data.orgId, entryId: data.entryId, adminId: data.adminId, req: data.req });
});

module.exports = {
  listFiscalYears, createFiscalYear, updateFiscalYear, getCurrentFiscalYear,
  seedDefaultAccounts, listAccounts, createAccount, updateAccount, deleteAccount,
  listJournalEntries, createJournalEntry, postJournalEntry, voidJournalEntry,
  getLedger, getTrialBalance, getProfitAndLoss, getBalanceSheet,
  closeFiscalYear,
};
