// ─────────────────────────────────────────────────────────────────────────────
// CRM Service — Pipelines, Clients, Contacts, Leads, Deals, Activities, Campaigns
// ─────────────────────────────────────────────────────────────────────────────
const { getPrisma } = require('../lib/prisma');

// ── Pipelines ────────────────────────────────────────────────────────────────

async function listPipelines({ orgId }) {
  const prisma = getPrisma();
  return prisma.crmPipeline.findMany({
    where: { orgId },
    include: {
      _count: { select: { deals: true } },
      deals: {
        where: { status: 'OPEN' },
        select: { id: true, stage: true, value: true },
      },
    },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });
}

async function getPipeline({ orgId, id }) {
  const prisma = getPrisma();
  const pipeline = await prisma.crmPipeline.findFirst({
    where: { id, orgId },
    include: {
      _count: { select: { deals: true } },
      deals: {
        include: {
          client: { select: { id: true, name: true, company: true } },
          assignee: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!pipeline) throw Object.assign(new Error('Pipeline not found'), { status: 404 });
  return pipeline;
}

async function createPipeline({ orgId, data }) {
  const prisma = getPrisma();
  return prisma.crmPipeline.create({
    data: {
      orgId,
      name: data.name,
      description: data.description || null,
      stages: data.stages || [
        { name: 'Qualification', order: 1, probability: 10 },
        { name: 'Needs Analysis', order: 2, probability: 25 },
        { name: 'Proposal', order: 3, probability: 50 },
        { name: 'Negotiation', order: 4, probability: 75 },
        { name: 'Closed Won', order: 5, probability: 100 },
      ],
      isDefault: data.isDefault || false,
    },
  });
}

async function updatePipeline({ orgId, id, data }) {
  const prisma = getPrisma();
  await verifyOwnership(prisma.crmPipeline, id, orgId);
  return prisma.crmPipeline.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.stages && { stages: data.stages }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
    },
  });
}

async function deletePipeline({ orgId, id }) {
  const prisma = getPrisma();
  const pipeline = await prisma.crmPipeline.findFirst({
    where: { id, orgId },
    include: { _count: { select: { deals: true } } },
  });
  if (!pipeline) throw Object.assign(new Error('Pipeline not found'), { status: 404 });
  if (pipeline._count.deals > 0) throw Object.assign(new Error('Cannot delete pipeline with existing deals'), { status: 400 });
  return prisma.crmPipeline.delete({ where: { id } });
}

// ── Clients ──────────────────────────────────────────────────────────────────

async function listClients({ orgId, search, type }) {
  const prisma = getPrisma();
  const where = { orgId };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { company: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (type) where.type = type;
  return prisma.crmClient.findMany({
    where,
    include: {
      _count: { select: { deals: true, leads: true, contacts: true, activities: true } },
      contacts: { where: { isPrimary: true }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function getClient({ orgId, id }) {
  const prisma = getPrisma();
  const client = await prisma.crmClient.findFirst({
    where: { id, orgId },
    include: {
      _count: { select: { deals: true, leads: true, contacts: true } },
      contacts: { orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }] },
      deals: {
        include: {
          pipeline: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      leads: {
        include: { assignee: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      activities: {
        include: { creator: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      creator: { select: { id: true, name: true } },
    },
  });
  if (!client) throw Object.assign(new Error('Client not found'), { status: 404 });
  return client;
}

async function createClient({ orgId, data, userId }) {
  const prisma = getPrisma();
  return prisma.crmClient.create({
    data: {
      orgId,
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      company: data.company || null,
      address: data.address || null,
      website: data.website || null,
      industry: data.industry || null,
      type: data.type || 'COMPANY',
      notes: data.notes || null,
      tags: data.tags || [],
      createdBy: userId,
    },
  });
}

async function updateClient({ orgId, id, data }) {
  const prisma = getPrisma();
  await verifyOwnership(prisma.crmClient, id, orgId);
  return prisma.crmClient.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.company !== undefined && { company: data.company }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.website !== undefined && { website: data.website }),
      ...(data.industry !== undefined && { industry: data.industry }),
      ...(data.type && { type: data.type }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.tags && { tags: data.tags }),
    },
  });
}

async function deleteClient({ orgId, id }) {
  const prisma = getPrisma();
  const client = await prisma.crmClient.findFirst({
    where: { id, orgId },
    include: { _count: { select: { deals: true, leads: true } } },
  });
  if (!client) throw Object.assign(new Error('Client not found'), { status: 404 });
  if (client._count.deals > 0 || client._count.leads > 0) {
    throw Object.assign(new Error('Cannot delete client with existing deals or leads'), { status: 400 });
  }
  return prisma.crmClient.delete({ where: { id } });
}

// ── Contacts ─────────────────────────────────────────────────────────────────

async function listContacts({ orgId, clientId }) {
  const prisma = getPrisma();
  const where = { orgId };
  if (clientId) where.clientId = clientId;
  return prisma.crmContact.findMany({
    where,
    include: { client: { select: { id: true, name: true, company: true } } },
    orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
  });
}

async function createContact({ orgId, data }) {
  const prisma = getPrisma();
  if (data.isPrimary) {
    await prisma.crmContact.updateMany({
      where: { orgId, clientId: data.clientId, isPrimary: true },
      data: { isPrimary: false },
    });
  }
  return prisma.crmContact.create({
    data: {
      orgId,
      clientId: data.clientId,
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      designation: data.designation || null,
      isPrimary: data.isPrimary || false,
      notes: data.notes || null,
    },
  });
}

async function updateContact({ orgId, id, data }) {
  const prisma = getPrisma();
  const contact = await prisma.crmContact.findFirst({ where: { id, orgId } });
  if (!contact) throw Object.assign(new Error('Contact not found'), { status: 404 });

  if (data.isPrimary) {
    await prisma.crmContact.updateMany({
      where: { orgId, clientId: contact.clientId, isPrimary: true, id: { not: id } },
      data: { isPrimary: false },
    });
  }

  return prisma.crmContact.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.designation !== undefined && { designation: data.designation }),
      ...(data.isPrimary !== undefined && { isPrimary: data.isPrimary }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
  });
}

async function deleteContact({ orgId, id }) {
  const prisma = getPrisma();
  await verifyOwnership(prisma.crmContact, id, orgId);
  return prisma.crmContact.delete({ where: { id } });
}

// ── Leads ────────────────────────────────────────────────────────────────────

async function listLeads({ orgId, status, assignedTo, priority, search }) {
  const prisma = getPrisma();
  const where = { orgId };
  if (status) where.status = status;
  if (assignedTo) where.assignedTo = assignedTo;
  if (priority) where.priority = priority;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { client: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }
  return prisma.crmLead.findMany({
    where,
    include: {
      client: { select: { id: true, name: true, company: true } },
      assignee: { select: { id: true, name: true } },
      _count: { select: { activities: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function getLead({ orgId, id }) {
  const prisma = getPrisma();
  const lead = await prisma.crmLead.findFirst({
    where: { id, orgId },
    include: {
      client: { select: { id: true, name: true, company: true, email: true, phone: true } },
      assignee: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true } },
      activities: {
        include: { creator: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });
  if (!lead) throw Object.assign(new Error('Lead not found'), { status: 404 });
  return lead;
}

async function createLead({ orgId, data, userId }) {
  const prisma = getPrisma();
  return prisma.crmLead.create({
    data: {
      orgId,
      title: data.title,
      source: data.source || null,
      value: data.value || null,
      priority: data.priority || 'MEDIUM',
      clientId: data.clientId || null,
      assignedTo: data.assignedTo || null,
      notes: data.notes || null,
      nextFollowUp: data.nextFollowUp ? new Date(data.nextFollowUp) : null,
      createdBy: userId,
    },
  });
}

async function updateLead({ orgId, id, data }) {
  const prisma = getPrisma();
  await verifyOwnership(prisma.crmLead, id, orgId);
  const updateData = {};
  if (data.title) updateData.title = data.title;
  if (data.status) updateData.status = data.status;
  if (data.source !== undefined) updateData.source = data.source;
  if (data.value !== undefined) updateData.value = data.value;
  if (data.priority) updateData.priority = data.priority;
  if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.clientId !== undefined) updateData.clientId = data.clientId;
  if (data.nextFollowUp !== undefined) updateData.nextFollowUp = data.nextFollowUp ? new Date(data.nextFollowUp) : null;
  if (data.lastContactedAt !== undefined) updateData.lastContactedAt = data.lastContactedAt ? new Date(data.lastContactedAt) : null;
  return prisma.crmLead.update({ where: { id }, data: updateData });
}

async function deleteLead({ orgId, id }) {
  const prisma = getPrisma();
  await verifyOwnership(prisma.crmLead, id, orgId);
  return prisma.crmLead.delete({ where: { id } });
}

async function convertLead({ orgId, id, dealData, userId }) {
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    const lead = await tx.crmLead.findFirst({ where: { id, orgId } });
    if (!lead) throw Object.assign(new Error('Lead not found'), { status: 404 });
    if (lead.status === 'CONVERTED') throw Object.assign(new Error('Lead already converted'), { status: 400 });

    const pipeline = await tx.crmPipeline.findFirst({
      where: { orgId, isActive: true },
      orderBy: { isDefault: 'desc' },
    });
    if (!pipeline) throw Object.assign(new Error('No active pipeline found'), { status: 400 });

    const stages = Array.isArray(pipeline.stages) ? pipeline.stages : [];
    const firstStage = stages.length > 0 ? stages[0].name : 'Qualification';

    const deal = await tx.crmDeal.create({
      data: {
        orgId,
        pipelineId: dealData.pipelineId || pipeline.id,
        clientId: lead.clientId,
        title: dealData.title || lead.title,
        value: dealData.value || lead.value || 0,
        stage: firstStage,
        assignedTo: dealData.assignedTo || lead.assignedTo,
        notes: lead.notes,
        createdBy: userId,
      },
    });

    await tx.crmLead.update({
      where: { id },
      data: { status: 'CONVERTED', convertedDealId: deal.id },
    });

    await tx.crmActivity.create({
      data: {
        orgId,
        type: 'NOTE',
        subject: `Lead converted to deal: ${deal.title}`,
        description: `Lead "${lead.title}" was converted to deal with value ${Number(deal.value).toLocaleString()}`,
        clientId: lead.clientId,
        dealId: deal.id,
        createdBy: userId,
      },
    });

    return deal;
  });
}

// ── Deals ────────────────────────────────────────────────────────────────────

async function listDeals({ orgId, status, pipelineId, assignedTo, search }) {
  const prisma = getPrisma();
  const where = { orgId };
  if (status) where.status = status;
  if (pipelineId) where.pipelineId = pipelineId;
  if (assignedTo) where.assignedTo = assignedTo;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { client: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }
  return prisma.crmDeal.findMany({
    where,
    include: {
      pipeline: { select: { id: true, name: true, stages: true } },
      client: { select: { id: true, name: true, company: true } },
      assignee: { select: { id: true, name: true } },
      _count: { select: { activities: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function getDeal({ orgId, id }) {
  const prisma = getPrisma();
  const deal = await prisma.crmDeal.findFirst({
    where: { id, orgId },
    include: {
      pipeline: true,
      client: {
        include: {
          contacts: { orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }] },
        },
      },
      assignee: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true } },
      activities: {
        include: { creator: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 30,
      },
    },
  });
  if (!deal) throw Object.assign(new Error('Deal not found'), { status: 404 });
  return deal;
}

async function createDeal({ orgId, data, userId }) {
  const prisma = getPrisma();

  if (data.pipelineId) {
    const pipeline = await prisma.crmPipeline.findFirst({ where: { id: data.pipelineId, orgId } });
    if (!pipeline) throw Object.assign(new Error('Pipeline not found'), { status: 400 });
  }

  return prisma.crmDeal.create({
    data: {
      orgId,
      pipelineId: data.pipelineId,
      clientId: data.clientId || null,
      title: data.title,
      value: data.value || 0,
      stage: data.stage || 'Qualification',
      probability: data.probability || 0,
      assignedTo: data.assignedTo || null,
      expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null,
      notes: data.notes || null,
      tags: data.tags || [],
      createdBy: userId,
    },
    include: {
      pipeline: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
    },
  });
}

async function updateDeal({ orgId, id, data, userId }) {
  const prisma = getPrisma();
  await verifyOwnership(prisma.crmDeal, id, orgId);

  const updateData = {};
  if (data.title) updateData.title = data.title;
  if (data.value !== undefined) updateData.value = data.value;
  if (data.stage) updateData.stage = data.stage;
  if (data.probability !== undefined) updateData.probability = data.probability;
  if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo;
  if (data.expectedCloseDate !== undefined) updateData.expectedCloseDate = data.expectedCloseDate ? new Date(data.expectedCloseDate) : null;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.clientId !== undefined) updateData.clientId = data.clientId;
  if (data.pipelineId) updateData.pipelineId = data.pipelineId;
  if (data.tags) updateData.tags = data.tags;

  if (data.status === 'WON') {
    updateData.status = 'WON';
    updateData.actualCloseDate = new Date();
    updateData.wonAmount = data.wonAmount || data.value;
    updateData.probability = 100;
  } else if (data.status === 'LOST') {
    updateData.status = 'LOST';
    updateData.actualCloseDate = new Date();
    updateData.probability = 0;
    updateData.lostReason = data.lostReason || null;
  } else if (data.status === 'OPEN') {
    updateData.status = 'OPEN';
    updateData.actualCloseDate = null;
    updateData.wonAmount = null;
    updateData.lostReason = null;
  } else if (data.status) {
    updateData.status = data.status;
  }

  const deal = await prisma.crmDeal.update({
    where: { id },
    data: updateData,
    include: {
      pipeline: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
    },
  });

  if (userId && (data.stage || data.status)) {
    const subject = data.status
      ? `Deal marked as ${data.status}`
      : `Deal moved to ${data.stage}`;
    await prisma.crmActivity.create({
      data: {
        orgId, type: 'NOTE', subject,
        dealId: id, clientId: deal.clientId,
        createdBy: userId,
      },
    }).catch(() => {});
  }

  return deal;
}

async function deleteDeal({ orgId, id }) {
  const prisma = getPrisma();
  await verifyOwnership(prisma.crmDeal, id, orgId);
  await prisma.crmActivity.deleteMany({ where: { dealId: id, orgId } });
  return prisma.crmDeal.delete({ where: { id } });
}

// ── Activities ───────────────────────────────────────────────────────────────

async function listActivities({ orgId, clientId, dealId, leadId, type, limit = 50 }) {
  const prisma = getPrisma();
  const where = { orgId };
  if (clientId) where.clientId = clientId;
  if (dealId) where.dealId = dealId;
  if (leadId) where.leadId = leadId;
  if (type) where.type = type;
  return prisma.crmActivity.findMany({
    where,
    include: {
      client: { select: { id: true, name: true } },
      lead: { select: { id: true, title: true } },
      deal: { select: { id: true, title: true, value: true } },
      creator: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 100),
  });
}

async function createActivity({ orgId, data, userId }) {
  const prisma = getPrisma();

  const activity = await prisma.crmActivity.create({
    data: {
      orgId,
      type: data.type || 'NOTE',
      subject: data.subject,
      description: data.description || null,
      clientId: data.clientId || null,
      leadId: data.leadId || null,
      dealId: data.dealId || null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      completed: data.completed || false,
      createdBy: userId,
    },
    include: {
      client: { select: { id: true, name: true } },
      lead: { select: { id: true, title: true } },
      deal: { select: { id: true, title: true } },
      creator: { select: { id: true, name: true } },
    },
  });

  if (data.leadId && ['CALL', 'EMAIL', 'MEETING'].includes(data.type)) {
    await prisma.crmLead.update({
      where: { id: data.leadId },
      data: { lastContactedAt: new Date() },
    }).catch(() => {});
  }

  return activity;
}

async function updateActivity({ orgId, id, data }) {
  const prisma = getPrisma();
  await verifyOwnership(prisma.crmActivity, id, orgId);
  const updateData = {};
  if (data.subject) updateData.subject = data.subject;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.type) updateData.type = data.type;
  if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
  if (data.completed !== undefined) {
    updateData.completed = data.completed;
    updateData.completedAt = data.completed ? new Date() : null;
  }
  return prisma.crmActivity.update({
    where: { id },
    data: updateData,
    include: {
      client: { select: { id: true, name: true } },
      deal: { select: { id: true, title: true } },
      creator: { select: { id: true, name: true } },
    },
  });
}

async function deleteActivity({ orgId, id }) {
  const prisma = getPrisma();
  await verifyOwnership(prisma.crmActivity, id, orgId);
  return prisma.crmActivity.delete({ where: { id } });
}

// ── Dashboard / Stats ────────────────────────────────────────────────────────

async function getDashboard({ orgId }) {
  const prisma = getPrisma();

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalClients,
    totalLeads,
    openDeals,
    wonDealsThisMonth,
    lostDealsThisMonth,
    recentActivities,
    leadsByStatus,
    dealsByStage,
    topDeals,
  ] = await Promise.all([
    prisma.crmClient.count({ where: { orgId } }),
    prisma.crmLead.count({ where: { orgId, status: { notIn: ['CONVERTED', 'LOST'] } } }),
    prisma.crmDeal.findMany({ where: { orgId, status: 'OPEN' }, select: { value: true, stage: true, probability: true } }),
    prisma.crmDeal.findMany({ where: { orgId, status: 'WON', actualCloseDate: { gte: thirtyDaysAgo } }, select: { wonAmount: true, value: true } }),
    prisma.crmDeal.count({ where: { orgId, status: 'LOST', actualCloseDate: { gte: thirtyDaysAgo } } }),
    prisma.crmActivity.findMany({
      where: { orgId },
      include: {
        client: { select: { id: true, name: true } },
        deal: { select: { id: true, title: true } },
        lead: { select: { id: true, title: true } },
        creator: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.crmLead.groupBy({ by: ['status'], where: { orgId }, _count: true }),
    prisma.crmDeal.groupBy({ by: ['stage'], where: { orgId, status: 'OPEN' }, _count: true, _sum: { value: true } }),
    prisma.crmDeal.findMany({
      where: { orgId, status: 'OPEN' },
      include: {
        client: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
      orderBy: { value: 'desc' },
      take: 5,
    }),
  ]);

  const pipelineValue = openDeals.reduce((sum, d) => sum + Number(d.value), 0);
  const weightedValue = openDeals.reduce((sum, d) => sum + (Number(d.value) * d.probability / 100), 0);
  const wonValue = wonDealsThisMonth.reduce((sum, d) => sum + Number(d.wonAmount || d.value), 0);
  const wonCount = wonDealsThisMonth.length;
  const winRate = wonCount + lostDealsThisMonth > 0
    ? Math.round((wonCount / (wonCount + lostDealsThisMonth)) * 100)
    : 0;

  return {
    summary: {
      totalClients,
      activeLeads: totalLeads,
      openDeals: openDeals.length,
      pipelineValue,
      weightedValue,
      wonValueThisMonth: wonValue,
      wonCountThisMonth: wonCount,
      lostCountThisMonth: lostDealsThisMonth,
      winRate,
    },
    leadsByStatus: leadsByStatus.reduce((acc, l) => { acc[l.status] = l._count; return acc; }, {}),
    dealsByStage: dealsByStage.map(d => ({ stage: d.stage, count: d._count, value: Number(d._sum.value || 0) })),
    topDeals,
    recentActivities,
  };
}

// ── Sales Stats (for incentive calculator) ───────────────────────────────────

async function getSalesStats({ orgId, employeeId, year, month }) {
  const prisma = getPrisma();
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const deals = await prisma.crmDeal.findMany({
    where: {
      orgId,
      OR: [
        { assignedTo: employeeId },
        { createdBy: employeeId },
      ],
      status: 'WON',
      actualCloseDate: { gte: startDate, lte: endDate },
    },
  });

  return {
    totalDeals: deals.length,
    totalValue: deals.reduce((sum, d) => sum + Number(d.wonAmount || d.value), 0),
  };
}

// ── Campaigns ────────────────────────────────────────────────────────────────

async function listCampaigns(orgId, query = {}) {
  const prisma = getPrisma();
  const where = { orgId };
  if (query.type) where.type = query.type;
  if (query.status) where.status = query.status;
  if (query.search) where.name = { contains: query.search, mode: 'insensitive' };
  if (query.businessCategory) where.businessCategory = { contains: query.businessCategory, mode: 'insensitive' };
  return prisma.crmCampaign.findMany({
    where,
    include: {
      creator: { select: { id: true, name: true } },
      _count: { select: { leads: true, members: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function getCampaign(orgId, id) {
  const prisma = getPrisma();
  const campaign = await prisma.crmCampaign.findFirst({
    where: { id, orgId },
    include: {
      creator: { select: { id: true, name: true } },
      leads: {
        include: {
          assignee: { select: { id: true, name: true } },
          client: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      members: {
        include: {
          client: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!campaign) throw Object.assign(new Error('Not found'), { status: 404 });
  return campaign;
}

async function createCampaign(orgId, data, userId) {
  const prisma = getPrisma();
  return prisma.crmCampaign.create({
    data: {
      orgId,
      name: data.name,
      type: data.type,
      channel: data.channel || null,
      status: data.status || 'DRAFT',
      description: data.description || null,
      targetAudience: data.targetAudience || null,
      businessCategory: data.businessCategory || null,
      budget: data.budget || null,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      tags: data.tags || [],
      createdBy: userId,
    },
    include: {
      creator: { select: { id: true, name: true } },
      _count: { select: { leads: true, members: true } },
    },
  });
}

async function updateCampaign(orgId, id, data) {
  const prisma = getPrisma();
  await verifyOwnership(prisma.crmCampaign, id, orgId);
  const update = {};
  const fields = ['name', 'type', 'channel', 'status', 'description', 'targetAudience',
    'businessCategory', 'budget', 'actualCost', 'tags',
    'sentCount', 'deliveredCount', 'openedCount', 'clickedCount',
    'respondedCount', 'convertedCount', 'revenue'];
  fields.forEach(f => { if (data[f] !== undefined) update[f] = data[f]; });
  if (data.startDate !== undefined) update.startDate = data.startDate ? new Date(data.startDate) : null;
  if (data.endDate !== undefined) update.endDate = data.endDate ? new Date(data.endDate) : null;
  return prisma.crmCampaign.update({
    where: { id },
    data: update,
    include: {
      creator: { select: { id: true, name: true } },
      _count: { select: { leads: true, members: true } },
    },
  });
}

async function deleteCampaign(orgId, id) {
  const prisma = getPrisma();
  await verifyOwnership(prisma.crmCampaign, id, orgId);
  await prisma.crmCampaign.delete({ where: { id } });
}

// ── Campaign Members ─────────────────────────────────────────────────────────

async function listCampaignMembers(orgId, campaignId) {
  const prisma = getPrisma();
  await verifyOwnership(prisma.crmCampaign, campaignId, orgId);
  return prisma.crmCampaignMember.findMany({
    where: { orgId, campaignId },
    include: {
      client: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function addCampaignMembers(orgId, campaignId, members, userId) {
  const prisma = getPrisma();
  await verifyOwnership(prisma.crmCampaign, campaignId, orgId);
  const created = await prisma.crmCampaignMember.createMany({
    data: members.map(m => ({
      orgId,
      campaignId,
      clientId: m.clientId || null,
      contactName: m.contactName || null,
      contactEmail: m.contactEmail || null,
      contactPhone: m.contactPhone || null,
      status: 'TARGETED',
    })),
    skipDuplicates: true,
  });
  return created;
}

async function updateCampaignMember(orgId, id, data) {
  const prisma = getPrisma();
  const member = await prisma.crmCampaignMember.findFirst({ where: { id, orgId } });
  if (!member) throw Object.assign(new Error('Not found'), { status: 404 });
  const update = {};
  if (data.status) {
    update.status = data.status;
    if (data.status === 'RESPONDED' && !member.respondedAt) update.respondedAt = new Date();
    if (data.status === 'CONVERTED' && !member.convertedAt) update.convertedAt = new Date();
  }
  if (data.notes !== undefined) update.notes = data.notes;
  return prisma.crmCampaignMember.update({
    where: { id },
    data: update,
    include: { client: { select: { id: true, name: true } } },
  });
}

async function removeCampaignMember(orgId, id) {
  const prisma = getPrisma();
  const member = await prisma.crmCampaignMember.findFirst({ where: { id, orgId } });
  if (!member) throw Object.assign(new Error('Not found'), { status: 404 });
  await prisma.crmCampaignMember.delete({ where: { id } });
}

async function getCampaignStats(orgId) {
  const prisma = getPrisma();
  const [campaigns, byType, byStatus] = await Promise.all([
    prisma.crmCampaign.findMany({
      where: { orgId },
      select: {
        id: true, name: true, type: true, status: true,
        budget: true, actualCost: true, revenue: true,
        sentCount: true, deliveredCount: true, openedCount: true,
        clickedCount: true, respondedCount: true, convertedCount: true,
        startDate: true, endDate: true,
        _count: { select: { leads: true, members: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.crmCampaign.groupBy({
      by: ['type'],
      where: { orgId },
      _count: true,
      _sum: { revenue: true, budget: true },
    }),
    prisma.crmCampaign.groupBy({
      by: ['status'],
      where: { orgId },
      _count: true,
    }),
  ]);

  const totalBudget = campaigns.reduce((s, c) => s + Number(c.budget || 0), 0);
  const totalRevenue = campaigns.reduce((s, c) => s + Number(c.revenue || 0), 0);
  const totalSent = campaigns.reduce((s, c) => s + c.sentCount, 0);
  const totalConverted = campaigns.reduce((s, c) => s + c.convertedCount, 0);

  return {
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter(c => c.status === 'ACTIVE').length,
    totalBudget,
    totalRevenue,
    roi: totalBudget > 0 ? ((totalRevenue - totalBudget) / totalBudget * 100).toFixed(1) : 0,
    conversionRate: totalSent > 0 ? ((totalConverted / totalSent) * 100).toFixed(1) : 0,
    byType,
    byStatus,
    campaigns,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function verifyOwnership(model, id, orgId) {
  const record = await model.findFirst({ where: { id, orgId } });
  if (!record) throw Object.assign(new Error('Not found'), { status: 404 });
  return record;
}

module.exports = {
  listPipelines, getPipeline, createPipeline, updatePipeline, deletePipeline,
  listClients, getClient, createClient, updateClient, deleteClient,
  listContacts, createContact, updateContact, deleteContact,
  listLeads, getLead, createLead, updateLead, deleteLead, convertLead,
  listDeals, getDeal, createDeal, updateDeal, deleteDeal,
  listActivities, createActivity, updateActivity, deleteActivity,
  getDashboard, getSalesStats,
  listCampaigns, getCampaign, createCampaign, updateCampaign, deleteCampaign,
  listCampaignMembers, addCampaignMembers, updateCampaignMember, removeCampaignMember,
  getCampaignStats,
};
