// ─────────────────────────────────────────────────────────────────────────────
// Billing Service — Parties, Invoices, Payments (Nepal VAT/PAN context)
// ─────────────────────────────────────────────────────────────────────────────
const { getPrisma } = require('../lib/prisma');
const { auditLog } = require('../lib/audit');
const { eventBus } = require('../lib/eventBus');

// Only used for getCurrentFiscalYear (shared query, not a side-effect)
const accountingService = require('./accounting.service');

// ═══════════════════════════════════════════════════════════════════════════════
// BILLING SETTINGS (per-org, cached in-memory)
// ═══════════════════════════════════════════════════════════════════════════════

const settingsCache = new Map();
const SETTINGS_TTL = 2 * 60 * 1000; // 2 minutes

async function getBillingSettings(orgId) {
  const cached = settingsCache.get(orgId);
  if (cached && Date.now() - cached.ts < SETTINGS_TTL) return cached.data;

  const prisma = getPrisma();
  let settings = await prisma.billingSettings.findUnique({ where: { orgId } });
  if (!settings) {
    // Auto-create with defaults on first access
    settings = await prisma.billingSettings.create({ data: { orgId } });
  }
  settingsCache.set(orgId, { data: settings, ts: Date.now() });
  return settings;
}

async function updateBillingSettings({ orgId, data, adminId, req }) {
  const prisma = getPrisma();
  const allowedFields = [
    'defaultVatRate', 'currency',
    'salesPrefix', 'purchasePrefix', 'creditNotePrefix', 'debitNotePrefix',
    'receiptPrefix', 'paymentVoucherPrefix', 'invoiceSeqPadding', 'receiptSeqPadding',
    'cashAccountCode', 'bankAccountCode', 'receivableAccountCode', 'payableAccountCode',
    'salesRevenueCode', 'purchaseExpenseCode', 'vatPayableCode', 'vatReceivableCode',
    'tdsReceivableCode', 'tdsPayableCode', 'customPaymentMethods',
  ];
  const updateData = {};
  for (const key of allowedFields) {
    if (data[key] !== undefined) updateData[key] = data[key];
  }

  // Validate account codes exist if changed
  const codeFields = ['cashAccountCode', 'bankAccountCode', 'receivableAccountCode', 'payableAccountCode',
    'salesRevenueCode', 'purchaseExpenseCode', 'vatPayableCode', 'vatReceivableCode', 'tdsReceivableCode', 'tdsPayableCode'];
  for (const field of codeFields) {
    if (updateData[field]) {
      const account = await prisma.chartOfAccount.findFirst({ where: { orgId, code: updateData[field] } });
      if (!account) throw Object.assign(new Error(`Account code "${updateData[field]}" not found in chart of accounts`), { status: 400 });
    }
  }

  const settings = await prisma.billingSettings.upsert({
    where: { orgId },
    update: updateData,
    create: { orgId, ...updateData },
  });

  settingsCache.delete(orgId); // invalidate cache
  await auditLog({ orgId, action: 'billing_settings.update', performedBy: adminId, entityType: 'BillingSettings', entityId: settings.id, details: updateData, req });
  return settings;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BILLING PARTIES (Customers / Vendors)
// ═══════════════════════════════════════════════════════════════════════════════

async function listParties({ orgId, type, search }) {
  const prisma = getPrisma();
  const where = { orgId, isActive: true };
  if (type) where.type = type;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { panNumber: { contains: search } },
      { phone: { contains: search } },
    ];
  }
  return prisma.billingParty.findMany({
    where,
    include: { _count: { select: { invoices: true, payments: true } } },
    orderBy: { name: 'asc' },
  });
}

async function getParty(orgId, partyId) {
  const prisma = getPrisma();
  const party = await prisma.billingParty.findFirst({
    where: { id: partyId, orgId },
    include: {
      invoices: { orderBy: { date: 'desc' }, take: 20, select: { id: true, invoiceNumber: true, type: true, totalAmount: true, dueAmount: true, status: true, date: true } },
      payments: { orderBy: { date: 'desc' }, take: 20, select: { id: true, receiptNumber: true, amount: true, method: true, date: true } },
    },
  });
  if (!party) throw Object.assign(new Error('Party not found'), { status: 404 });
  return party;
}

async function createParty({ orgId, data, adminId, req }) {
  const prisma = getPrisma();
  const party = await prisma.billingParty.create({
    data: {
      orgId, name: data.name, nameNp: data.nameNp || null, type: data.type || 'CUSTOMER',
      panNumber: data.panNumber || null, vatNumber: data.vatNumber || null,
      address: data.address || null, city: data.city || null,
      phone: data.phone || null, email: data.email || null,
      bankName: data.bankName || null, bankAccount: data.bankAccount || null,
      creditLimit: data.creditLimit || null, creditDays: data.creditDays || 0,
      openingBalance: data.openingBalance || 0,
    },
  });
  await auditLog({ orgId, action: 'party.create', performedBy: adminId, entityType: 'BillingParty', entityId: party.id, details: { name: party.name, type: party.type }, req });
  return party;
}

async function updateParty({ orgId, partyId, data, adminId, req }) {
  const prisma = getPrisma();
  const existing = await prisma.billingParty.findFirst({ where: { id: partyId, orgId } });
  if (!existing) throw Object.assign(new Error('Party not found'), { status: 404 });
  const updateData = {};
  for (const f of ['name', 'nameNp', 'type', 'panNumber', 'vatNumber', 'address', 'city', 'phone', 'email', 'bankName', 'bankAccount', 'creditLimit', 'creditDays', 'openingBalance', 'isActive']) {
    if (data[f] !== undefined) updateData[f] = data[f];
  }
  const party = await prisma.billingParty.update({ where: { id: partyId }, data: updateData });
  await auditLog({ orgId, action: 'party.update', performedBy: adminId, entityType: 'BillingParty', entityId: partyId, details: updateData, req });
  return party;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICES (Sales / Purchase with Nepal VAT)
// ═══════════════════════════════════════════════════════════════════════════════

async function listInvoices({ orgId, type, status, partyId, startDate, endDate, limit }) {
  const prisma = getPrisma();
  const where = { orgId };
  if (type) where.type = type;
  if (status) where.status = status;
  if (partyId) where.partyId = partyId;
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);
  }
  return prisma.billingInvoice.findMany({
    where,
    include: {
      party: { select: { name: true, panNumber: true } },
      items: true,
      fiscalYear: { select: { name: true } },
    },
    orderBy: { date: 'desc' },
    take: limit ? Number(limit) : 100,
  });
}

async function getInvoice(orgId, invoiceId) {
  const prisma = getPrisma();
  const invoice = await prisma.billingInvoice.findFirst({
    where: { id: invoiceId, orgId },
    include: {
      party: true,
      items: true,
      fiscalYear: { select: { name: true } },
      journalEntry: { include: { lines: { include: { account: { select: { code: true, name: true } } } } } },
      payments: { orderBy: { date: 'desc' } },
    },
  });
  if (!invoice) throw Object.assign(new Error('Invoice not found'), { status: 404 });
  return invoice;
}

async function createInvoice({ orgId, data, adminId, req }) {
  const prisma = getPrisma();
  const settings = await getBillingSettings(orgId);
  const fy = data.fiscalYearId
    ? await prisma.fiscalYear.findFirst({ where: { id: data.fiscalYearId, orgId } })
    : await accountingService.getCurrentFiscalYear(orgId);
  if (!fy) throw Object.assign(new Error('Fiscal year not found'), { status: 400 });

  // Generate invoice number using configurable prefixes
  const prefixMap = {
    SALES: settings.salesPrefix,
    PURCHASE: settings.purchasePrefix,
    SALES_RETURN: settings.creditNotePrefix,
    PURCHASE_RETURN: settings.debitNotePrefix,
  };
  const prefix = prefixMap[data.type] || settings.salesPrefix;
  const lastInv = await prisma.billingInvoice.findFirst({
    where: { orgId, fiscalYearId: fy.id, type: data.type },
    orderBy: { createdAt: 'desc' },
    select: { invoiceNumber: true },
  });
  let seq = 1;
  if (lastInv) {
    const parts = lastInv.invoiceNumber.split('-');
    seq = (parseInt(parts[parts.length - 1]) || 0) + 1;
  }
  const invoiceNumber = `${prefix}-${fy.name}-${String(seq).padStart(settings.invoiceSeqPadding, '0')}`;

  // Calculate items using configurable default VAT rate
  const defaultVat = Number(settings.defaultVatRate) || 13;
  const items = (data.items || []).map(item => {
    const qty = Number(item.quantity) || 1;
    const rate = Number(item.rate) || 0;
    const discount = Number(item.discount) || 0;
    const amount = (qty * rate) - discount;
    const taxRate = data.isVatBill !== false ? (Number(item.taxRate) || defaultVat) : 0;
    const taxAmount = (amount * taxRate) / 100;
    return {
      description: item.description, hsnCode: item.hsnCode || null,
      quantity: qty, unit: item.unit || 'pcs', rate, discount,
      amount, taxRate, taxAmount, totalAmount: amount + taxAmount,
    };
  });

  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const discountAmount = Number(data.discountAmount) || 0;
  const taxableAmount = subtotal - discountAmount;
  const vatRate = data.isVatBill !== false ? (Number(data.vatRate) || defaultVat) : 0;
  const vatAmount = (taxableAmount * vatRate) / 100;
  const tdsRate = Number(data.tdsRate) || 0;
  const tdsAmount = (taxableAmount * tdsRate) / 100;
  const totalAmount = taxableAmount + vatAmount - tdsAmount;

  const invoice = await prisma.billingInvoice.create({
    data: {
      orgId, fiscalYearId: fy.id, invoiceNumber, type: data.type || 'SALES',
      partyId: data.partyId, date: new Date(data.date),
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      referenceNumber: data.referenceNumber || null,
      subtotal, discountAmount, taxableAmount, vatAmount, tdsAmount, totalAmount,
      paidAmount: 0, dueAmount: totalAmount,
      vatRate, tdsRate, isVatBill: data.isVatBill !== false,
      panOfBuyer: data.panOfBuyer || null,
      status: 'DRAFT', createdBy: adminId,
      receivableAccountId: data.receivableAccountId || null,
      payableAccountId: data.payableAccountId || null,
      notes: data.notes || null,
      items: { create: items },
    },
    include: { items: true, party: { select: { name: true } } },
  });

  await auditLog({ orgId, action: 'invoice.create', performedBy: adminId, entityType: 'Invoice', entityId: invoice.id, details: { invoiceNumber, type: invoice.type, totalAmount }, req });
  return invoice;
}

async function updateInvoice({ orgId, invoiceId, data, adminId, req }) {
  const prisma = getPrisma();
  const settings = await getBillingSettings(orgId);
  const defaultVat = Number(settings.defaultVatRate) || 13;
  const existing = await prisma.billingInvoice.findFirst({ where: { id: invoiceId, orgId } });
  if (!existing) throw Object.assign(new Error('Invoice not found'), { status: 404 });
  if (existing.status !== 'DRAFT') throw Object.assign(new Error('Only draft invoices can be edited'), { status: 400 });

  const updateData = {};
  for (const f of ['partyId', 'referenceNumber', 'panOfBuyer', 'notes', 'receivableAccountId', 'payableAccountId']) {
    if (data[f] !== undefined) updateData[f] = data[f];
  }
  if (data.date) updateData.date = new Date(data.date);
  if (data.dueDate) updateData.dueDate = new Date(data.dueDate);

  // Recalculate if items provided
  if (data.items) {
    await prisma.billingInvoiceItem.deleteMany({ where: { invoiceId } });
    const items = data.items.map(item => {
      const qty = Number(item.quantity) || 1;
      const rate = Number(item.rate) || 0;
      const discount = Number(item.discount) || 0;
      const amount = (qty * rate) - discount;
      const taxRate = data.isVatBill !== false ? (Number(item.taxRate) || defaultVat) : 0;
      const taxAmount = (amount * taxRate) / 100;
      return { invoiceId, description: item.description, hsnCode: item.hsnCode || null, quantity: qty, unit: item.unit || 'pcs', rate, discount, amount, taxRate, taxAmount, totalAmount: amount + taxAmount };
    });
    await prisma.billingInvoiceItem.createMany({ data: items });

    const subtotal = items.reduce((s, i) => s + i.amount, 0);
    const discountAmount = Number(data.discountAmount) || 0;
    const taxableAmount = subtotal - discountAmount;
    const vatRate = data.isVatBill !== false ? (Number(data.vatRate) || defaultVat) : 0;
    const vatAmount = (taxableAmount * vatRate) / 100;
    const tdsRate = Number(data.tdsRate) || 0;
    const tdsAmount = (taxableAmount * tdsRate) / 100;
    const totalAmount = taxableAmount + vatAmount - tdsAmount;
    Object.assign(updateData, { subtotal, discountAmount, taxableAmount, vatAmount, tdsAmount, totalAmount, vatRate, tdsRate, dueAmount: totalAmount - Number(existing.paidAmount) });
    if (data.isVatBill !== undefined) updateData.isVatBill = data.isVatBill;
  }

  const invoice = await prisma.billingInvoice.update({ where: { id: invoiceId }, data: updateData, include: { items: true, party: { select: { name: true } } } });
  await auditLog({ orgId, action: 'invoice.update', performedBy: adminId, entityType: 'Invoice', entityId: invoiceId, details: updateData, req });
  return invoice;
}

async function issueInvoice({ orgId, invoiceId, adminId, req }) {
  const prisma = getPrisma();
  const settings = await getBillingSettings(orgId);
  const invoice = await prisma.billingInvoice.findFirst({
    where: { id: invoiceId, orgId },
    include: { party: true, items: true },
  });
  if (!invoice) throw Object.assign(new Error('Invoice not found'), { status: 404 });
  if (invoice.status !== 'DRAFT') throw Object.assign(new Error('Only draft invoices can be issued'), { status: 400 });

  // Auto-create journal entry using configurable account codes
  const lines = [];
  const isSales = ['SALES', 'PURCHASE_RETURN'].includes(invoice.type);

  if (isSales) {
    // Debit: Accounts Receivable, Credit: Sales + VAT Payable
    const receivableAccount = invoice.receivableAccountId || await getAccountByCode(orgId, settings.receivableAccountCode);
    lines.push({ accountId: receivableAccount, debit: Number(invoice.totalAmount), credit: 0 });
    const salesAccount = await getAccountByCode(orgId, settings.salesRevenueCode);
    lines.push({ accountId: salesAccount, debit: 0, credit: Number(invoice.taxableAmount) });
    if (Number(invoice.vatAmount) > 0) {
      const vatAccount = await getAccountByCode(orgId, settings.vatPayableCode);
      lines.push({ accountId: vatAccount, debit: 0, credit: Number(invoice.vatAmount) });
    }
    if (Number(invoice.tdsAmount) > 0) {
      const tdsAccount = await getAccountByCode(orgId, settings.tdsReceivableCode);
      lines.push({ accountId: tdsAccount, debit: Number(invoice.tdsAmount), credit: 0 });
    }
  } else {
    // Purchase: Debit: Purchase Expense + VAT Receivable, Credit: Accounts Payable
    const payableAccount = invoice.payableAccountId || await getAccountByCode(orgId, settings.payableAccountCode);
    lines.push({ accountId: payableAccount, debit: 0, credit: Number(invoice.totalAmount) });
    const purchaseAccount = await getAccountByCode(orgId, settings.purchaseExpenseCode);
    lines.push({ accountId: purchaseAccount, debit: Number(invoice.taxableAmount), credit: 0 });
    if (Number(invoice.vatAmount) > 0) {
      const vatAccount = await getAccountByCode(orgId, settings.vatReceivableCode);
      lines.push({ accountId: vatAccount, debit: Number(invoice.vatAmount), credit: 0 });
    }
    if (Number(invoice.tdsAmount) > 0) {
      const tdsAccount = await getAccountByCode(orgId, settings.tdsPayableCode);
      lines.push({ accountId: tdsAccount, debit: 0, credit: Number(invoice.tdsAmount) });
    }
  }

  eventBus.publish('invoice.issued', {
    orgId,
    invoiceId,
    invoiceNumber: invoice.invoiceNumber,
    type: invoice.type,
    partyName: invoice.party.name,
    date: invoice.date.toISOString(),
    voucherType: isSales ? 'SALES' : 'PURCHASE',
    lines,
    adminId,
    req,
    // callback to link journal entry back to invoice
    async onJournalCreated(journalEntryId) {
      await prisma.billingInvoice.update({ where: { id: invoiceId }, data: { journalEntryId } });
    },
  });

  const updated = await prisma.billingInvoice.update({
    where: { id: invoiceId },
    data: { status: 'ISSUED' },
    include: { items: true, party: { select: { name: true } } },
  });

  await auditLog({ orgId, action: 'invoice.issue', performedBy: adminId, entityType: 'Invoice', entityId: invoiceId, details: { invoiceNumber: invoice.invoiceNumber, journalEntryId: journalEntry.id }, req });
  return updated;
}

async function cancelInvoice({ orgId, invoiceId, adminId, req }) {
  const prisma = getPrisma();
  const invoice = await prisma.billingInvoice.findFirst({ where: { id: invoiceId, orgId } });
  if (!invoice) throw Object.assign(new Error('Invoice not found'), { status: 404 });
  if (Number(invoice.paidAmount) > 0) throw Object.assign(new Error('Cannot cancel invoice with payments'), { status: 400 });

  // Void the journal entry if exists
  if (invoice.journalEntryId) {
    eventBus.publish('journal.void.requested', { orgId, entryId: invoice.journalEntryId, adminId, req });
  }
  const updated = await prisma.billingInvoice.update({ where: { id: invoiceId }, data: { status: 'CANCELLED', journalEntryId: null } });
  await auditLog({ orgId, action: 'invoice.cancel', performedBy: adminId, entityType: 'Invoice', entityId: invoiceId, req });
  return updated;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENTS
// ═══════════════════════════════════════════════════════════════════════════════

async function listPayments({ orgId, type, partyId, startDate, endDate, limit }) {
  const prisma = getPrisma();
  const where = { orgId };
  if (type) where.type = type;
  if (partyId) where.partyId = partyId;
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);
  }
  return prisma.billingPayment.findMany({
    where,
    include: {
      party: { select: { name: true } },
      invoice: { select: { invoiceNumber: true, totalAmount: true, dueAmount: true } },
    },
    orderBy: { date: 'desc' },
    take: limit ? Number(limit) : 100,
  });
}

async function recordPayment({ orgId, data, adminId, req }) {
  const prisma = getPrisma();
  const settings = await getBillingSettings(orgId);

  // Auto-derive type and partyId from invoice if not provided
  if (data.invoiceId && (!data.type || !data.partyId)) {
    const inv = await prisma.billingInvoice.findFirst({ where: { id: data.invoiceId, orgId } });
    if (inv) {
      if (!data.type) data.type = (inv.type === 'SALES' || inv.type === 'PURCHASE_RETURN') ? 'RECEIVED' : 'MADE';
      if (!data.partyId) data.partyId = inv.partyId;
    }
  }
  if (!data.type) throw Object.assign(new Error('Payment type is required'), { status: 400 });

  // Generate receipt number using configurable prefixes
  const lastPayment = await prisma.billingPayment.findFirst({
    where: { orgId, type: data.type },
    orderBy: { createdAt: 'desc' },
    select: { receiptNumber: true },
  });
  let seq = 1;
  if (lastPayment?.receiptNumber) {
    const parts = lastPayment.receiptNumber.split('-');
    seq = (parseInt(parts[parts.length - 1]) || 0) + 1;
  }
  const prefix = data.type === 'RECEIVED' ? settings.receiptPrefix : settings.paymentVoucherPrefix;
  const receiptNumber = `${prefix}-${String(seq).padStart(settings.receiptSeqPadding, '0')}`;

  const payment = await prisma.$transaction(async (tx) => {
    // Overpayment guard
    if (data.invoiceId) {
      const inv = await tx.billingInvoice.findUnique({ where: { id: data.invoiceId } });
      if (inv && Number(data.amount) > Number(inv.dueAmount) + 0.01) {
        throw Object.assign(new Error(`Payment amount (${data.amount}) exceeds due amount (${inv.dueAmount})`), { status: 400 });
      }
    }

    const pmt = await tx.billingPayment.create({
      data: {
        orgId, type: data.type, partyId: data.partyId,
        invoiceId: data.invoiceId || null,
        receiptNumber, date: new Date(data.date),
        amount: Number(data.amount), method: data.method || 'CASH',
        bankName: data.bankName || null, chequeNumber: data.chequeNumber || null,
        referenceId: data.referenceId || null, notes: data.notes || null,
        createdBy: adminId,
      },
      include: { party: { select: { name: true } }, invoice: { select: { invoiceNumber: true } } },
    });

    // Update invoice paid amount if linked
    if (data.invoiceId) {
      const invoice = await tx.billingInvoice.findUnique({ where: { id: data.invoiceId } });
      if (invoice) {
        const newPaidAmount = Number(invoice.paidAmount) + Number(data.amount);
        const newDueAmount = Number(invoice.totalAmount) - newPaidAmount;
        let newStatus = invoice.status;
        if (newDueAmount <= 0.01) newStatus = 'PAID';
        else if (newPaidAmount > 0) newStatus = 'PARTIALLY_PAID';
        await tx.billingInvoice.update({ where: { id: data.invoiceId }, data: { paidAmount: newPaidAmount, dueAmount: Math.max(0, newDueAmount), status: newStatus } });
      }
    }

    return pmt;
  });

  // Auto-create journal entry for payment using configurable account codes
  const lines = [];
  const isReceived = data.type === 'RECEIVED';
  const cashBankAccount = await getAccountByCode(orgId, data.method === 'CASH' ? settings.cashAccountCode : settings.bankAccountCode);

  if (isReceived) {
    const receivableAccount = await getAccountByCode(orgId, settings.receivableAccountCode);
    lines.push({ accountId: cashBankAccount, debit: Number(data.amount), credit: 0 });
    lines.push({ accountId: receivableAccount, debit: 0, credit: Number(data.amount) });
  } else {
    const payableAccount = await getAccountByCode(orgId, settings.payableAccountCode);
    lines.push({ accountId: payableAccount, debit: Number(data.amount), credit: 0 });
    lines.push({ accountId: cashBankAccount, debit: 0, credit: Number(data.amount) });
  }

  eventBus.publish('payment.recorded', {
    orgId,
    paymentId: payment.id,
    receiptNumber,
    partyName: payment.party.name,
    date: data.date,
    voucherType: isReceived ? 'RECEIPT' : 'PAYMENT',
    lines,
    adminId,
    req,
    // callback to link journal entry back to payment
    async onJournalCreated(journalEntryId) {
      await prisma.billingPayment.update({ where: { id: payment.id }, data: { journalEntryId } });
    },
  });

  await auditLog({ orgId, action: 'payment.record', performedBy: adminId, entityType: 'Payment', entityId: payment.id, details: { receiptNumber, amount: data.amount, method: data.method }, req });
  return payment;
}

async function voidPayment({ orgId, paymentId, adminId, req }) {
  const prisma = getPrisma();
  const payment = await prisma.billingPayment.findFirst({ where: { id: paymentId, orgId } });
  if (!payment) throw Object.assign(new Error('Payment not found'), { status: 404 });
  if (payment.isVoided) throw Object.assign(new Error('Payment is already voided'), { status: 400 });

  await prisma.$transaction(async (tx) => {
    // Void the payment
    await tx.billingPayment.update({
      where: { id: paymentId },
      data: { isVoided: true, voidedAt: new Date(), voidedBy: adminId },
    });

    // Reverse invoice amounts if linked
    if (payment.invoiceId) {
      const invoice = await tx.billingInvoice.findUnique({ where: { id: payment.invoiceId } });
      if (invoice) {
        const newPaidAmount = Math.max(0, Number(invoice.paidAmount) - Number(payment.amount));
        const newDueAmount = Number(invoice.totalAmount) - newPaidAmount;
        let newStatus = invoice.status;
        if (newPaidAmount <= 0.01) newStatus = 'ISSUED';
        else if (newDueAmount > 0.01) newStatus = 'PARTIALLY_PAID';
        await tx.billingInvoice.update({ where: { id: payment.invoiceId }, data: { paidAmount: newPaidAmount, dueAmount: Math.max(0, newDueAmount), status: newStatus } });
      }
    }

    // Void the journal entry if linked
    if (payment.journalEntryId) {
      eventBus.publish('journal.void.requested', { orgId, entryId: payment.journalEntryId, adminId, req });
    }
  });

  await auditLog({ orgId, action: 'payment.void', performedBy: adminId, entityType: 'Payment', entityId: paymentId, details: { receiptNumber: payment.receiptNumber, amount: Number(payment.amount) }, req });
  return { success: true, receiptNumber: payment.receiptNumber };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARTY STATEMENT
// ═══════════════════════════════════════════════════════════════════════════════

async function getPartyStatement({ orgId, partyId, startDate, endDate }) {
  const prisma = getPrisma();
  const party = await prisma.billingParty.findFirst({ where: { id: partyId, orgId } });
  if (!party) throw Object.assign(new Error('Party not found'), { status: 404 });

  const dateFilter = {};
  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) dateFilter.lte = new Date(endDate);

  const invoices = await prisma.billingInvoice.findMany({
    where: { orgId, partyId, status: { not: 'CANCELLED' }, ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}) },
    select: { id: true, invoiceNumber: true, type: true, date: true, totalAmount: true, paidAmount: true, dueAmount: true, status: true },
    orderBy: { date: 'asc' },
  });

  const payments = await prisma.billingPayment.findMany({
    where: { orgId, partyId, isVoided: false, ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}) },
    select: { id: true, receiptNumber: true, type: true, date: true, amount: true, method: true, invoiceId: true },
    orderBy: { date: 'asc' },
  });

  // Build chronological ledger
  const entries = [];
  for (const inv of invoices) {
    const isDebit = ['SALES', 'PURCHASE_RETURN'].includes(inv.type);
    entries.push({
      date: inv.date, ref: inv.invoiceNumber, type: 'invoice', subType: inv.type,
      debit: isDebit ? Number(inv.totalAmount) : 0,
      credit: isDebit ? 0 : Number(inv.totalAmount),
    });
  }
  for (const pmt of payments) {
    const isDebit = pmt.type === 'MADE';
    entries.push({
      date: pmt.date, ref: pmt.receiptNumber, type: 'payment', subType: pmt.type,
      debit: isDebit ? Number(pmt.amount) : 0,
      credit: isDebit ? 0 : Number(pmt.amount),
    });
  }
  entries.sort((a, b) => new Date(a.date) - new Date(b.date));

  let balance = Number(party.openingBalance) || 0;
  const ledger = entries.map(e => {
    balance += e.debit - e.credit;
    return { ...e, balance };
  });

  const totalInvoiced = invoices.reduce((s, i) => s + Number(i.totalAmount), 0);
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);

  return {
    party: { id: party.id, name: party.name, panNumber: party.panNumber, type: party.type },
    openingBalance: Number(party.openingBalance) || 0,
    ledger,
    closingBalance: balance,
    totalInvoiced,
    totalPaid,
    totalOutstanding: totalInvoiced - totalPaid + (Number(party.openingBalance) || 0),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DAY BOOK
// ═══════════════════════════════════════════════════════════════════════════════

async function getDayBook({ orgId, date, startDate, endDate }) {
  const prisma = getPrisma();
  const dateFilter = {};
  if (date) {
    dateFilter.gte = new Date(date);
    dateFilter.lte = new Date(date);
  } else {
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
  }
  if (!Object.keys(dateFilter).length) {
    // Default to today
    const today = new Date();
    dateFilter.gte = new Date(today.toISOString().split('T')[0]);
    dateFilter.lte = new Date(today.toISOString().split('T')[0]);
  }

  const [invoices, payments, journals] = await Promise.all([
    prisma.billingInvoice.findMany({
      where: { orgId, date: dateFilter, status: { not: 'CANCELLED' } },
      select: { id: true, invoiceNumber: true, type: true, date: true, totalAmount: true, status: true, party: { select: { name: true } } },
      orderBy: { date: 'asc' },
    }),
    prisma.billingPayment.findMany({
      where: { orgId, date: dateFilter, isVoided: false },
      select: { id: true, receiptNumber: true, type: true, date: true, amount: true, method: true, party: { select: { name: true } } },
      orderBy: { date: 'asc' },
    }),
    prisma.journalEntry.findMany({
      where: { orgId, date: dateFilter, status: 'POSTED', voucherType: { in: ['JOURNAL', 'CONTRA'] } },
      select: { id: true, entryNumber: true, date: true, narration: true, voucherType: true, totalDebit: true },
      orderBy: { date: 'asc' },
    }),
  ]);

  const entries = [];
  for (const inv of invoices) {
    entries.push({ date: inv.date, ref: inv.invoiceNumber, type: inv.type, party: inv.party?.name, amount: Number(inv.totalAmount), category: 'invoice', status: inv.status });
  }
  for (const pmt of payments) {
    entries.push({ date: pmt.date, ref: pmt.receiptNumber, type: pmt.type, party: pmt.party?.name, amount: Number(pmt.amount), category: 'payment', method: pmt.method });
  }
  for (const j of journals) {
    entries.push({ date: j.date, ref: `JV-${j.entryNumber}`, type: j.voucherType, party: null, amount: Number(j.totalDebit), category: 'journal', narration: j.narration });
  }
  entries.sort((a, b) => new Date(a.date) - new Date(b.date));

  return {
    dateRange: dateFilter,
    entries,
    summary: {
      totalInvoices: invoices.length,
      totalInvoiceAmount: invoices.reduce((s, i) => s + Number(i.totalAmount), 0),
      totalPayments: payments.length,
      totalPaymentAmount: payments.reduce((s, p) => s + Number(p.amount), 0),
      totalJournals: journals.length,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════════════════════════

async function getAgingReport({ orgId, type }) {
  const prisma = getPrisma();
  const invoiceType = type === 'payable' ? { in: ['PURCHASE'] } : { in: ['SALES'] };
  const invoices = await prisma.billingInvoice.findMany({
    where: { orgId, type: invoiceType, dueAmount: { gt: 0 }, status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] } },
    include: { party: { select: { name: true, panNumber: true } } },
    orderBy: { date: 'asc' },
  });

  const now = new Date();
  const buckets = { current: [], '1_30': [], '31_60': [], '61_90': [], over90: [] };
  for (const inv of invoices) {
    const dueDate = inv.dueDate || inv.date;
    const days = Math.floor((now - new Date(dueDate)) / (1000 * 60 * 60 * 24));
    const entry = { invoiceNumber: inv.invoiceNumber, party: inv.party.name, amount: Number(inv.dueAmount), daysOverdue: Math.max(0, days), date: inv.date };
    if (days <= 0) buckets.current.push(entry);
    else if (days <= 30) buckets['1_30'].push(entry);
    else if (days <= 60) buckets['31_60'].push(entry);
    else if (days <= 90) buckets['61_90'].push(entry);
    else buckets.over90.push(entry);
  }

  const totals = {};
  for (const [k, v] of Object.entries(buckets)) totals[k] = v.reduce((s, e) => s + e.amount, 0);
  return { buckets, totals, totalOutstanding: Object.values(totals).reduce((s, v) => s + v, 0) };
}

async function getVatSummary({ orgId, startDate, endDate }) {
  const prisma = getPrisma();
  const where = { orgId, status: { not: 'CANCELLED' }, isVatBill: true };
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) where.date.lte = new Date(endDate);
  }

  const invoices = await prisma.billingInvoice.findMany({
    where,
    select: { type: true, invoiceNumber: true, date: true, taxableAmount: true, vatAmount: true, totalAmount: true, panOfBuyer: true, party: { select: { name: true, panNumber: true } } },
    orderBy: { date: 'asc' },
  });

  const sales = invoices.filter(i => i.type === 'SALES');
  const purchases = invoices.filter(i => i.type === 'PURCHASE');
  const salesReturns = invoices.filter(i => i.type === 'SALES_RETURN');
  const purchaseReturns = invoices.filter(i => i.type === 'PURCHASE_RETURN');

  const sum = (arr, field) => arr.reduce((s, i) => s + Number(i[field]), 0);

  return {
    sales: { count: sales.length, taxable: sum(sales, 'taxableAmount'), vat: sum(sales, 'vatAmount'), total: sum(sales, 'totalAmount'), items: sales },
    purchases: { count: purchases.length, taxable: sum(purchases, 'taxableAmount'), vat: sum(purchases, 'vatAmount'), total: sum(purchases, 'totalAmount'), items: purchases },
    salesReturns: { count: salesReturns.length, taxable: sum(salesReturns, 'taxableAmount'), vat: sum(salesReturns, 'vatAmount'), total: sum(salesReturns, 'totalAmount') },
    purchaseReturns: { count: purchaseReturns.length, taxable: sum(purchaseReturns, 'taxableAmount'), vat: sum(purchaseReturns, 'vatAmount'), total: sum(purchaseReturns, 'totalAmount') },
    netVatPayable: sum(sales, 'vatAmount') - sum(purchases, 'vatAmount') - sum(salesReturns, 'vatAmount') + sum(purchaseReturns, 'vatAmount'),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

async function getAccountByCode(orgId, code) {
  const prisma = getPrisma();
  const account = await prisma.chartOfAccount.findFirst({ where: { orgId, code } });
  if (!account) throw Object.assign(new Error(`Account ${code} not found. Run "Seed Default Accounts" first.`), { status: 400 });
  return account.id;
}

module.exports = {
  getBillingSettings, updateBillingSettings,
  listParties, getParty, createParty, updateParty,
  listInvoices, getInvoice, createInvoice, updateInvoice, issueInvoice, cancelInvoice,
  listPayments, recordPayment, voidPayment,
  getPartyStatement, getDayBook,
  getAgingReport, getVatSummary,
};
