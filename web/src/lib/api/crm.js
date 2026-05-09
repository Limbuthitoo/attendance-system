import { request } from './client';

export const crm = {
  // Dashboard
  getDashboard: () => request('/v1/crm/dashboard'),

  // Pipelines
  getPipelines: () => request('/v1/crm/pipelines'),
  getPipeline: (id) => request(`/v1/crm/pipelines/${id}`),
  createPipeline: (data) => request('/v1/crm/pipelines', { method: 'POST', body: JSON.stringify(data) }),
  updatePipeline: (id, data) => request(`/v1/crm/pipelines/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePipeline: (id) => request(`/v1/crm/pipelines/${id}`, { method: 'DELETE' }),

  // Clients
  getClients: (params) => request(`/v1/crm/clients${params ? '?' + new URLSearchParams(params) : ''}`),
  getClient: (id) => request(`/v1/crm/clients/${id}`),
  createClient: (data) => request('/v1/crm/clients', { method: 'POST', body: JSON.stringify(data) }),
  updateClient: (id, data) => request(`/v1/crm/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteClient: (id) => request(`/v1/crm/clients/${id}`, { method: 'DELETE' }),

  // Contacts
  getContacts: (params) => request(`/v1/crm/contacts${params ? '?' + new URLSearchParams(params) : ''}`),
  createContact: (data) => request('/v1/crm/contacts', { method: 'POST', body: JSON.stringify(data) }),
  updateContact: (id, data) => request(`/v1/crm/contacts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteContact: (id) => request(`/v1/crm/contacts/${id}`, { method: 'DELETE' }),

  // Leads
  getLeads: (params) => request(`/v1/crm/leads${params ? '?' + new URLSearchParams(params) : ''}`),
  getLead: (id) => request(`/v1/crm/leads/${id}`),
  createLead: (data) => request('/v1/crm/leads', { method: 'POST', body: JSON.stringify(data) }),
  updateLead: (id, data) => request(`/v1/crm/leads/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLead: (id) => request(`/v1/crm/leads/${id}`, { method: 'DELETE' }),
  convertLead: (id, data) => request(`/v1/crm/leads/${id}/convert`, { method: 'POST', body: JSON.stringify(data) }),

  // Deals
  getDeals: (params) => request(`/v1/crm/deals${params ? '?' + new URLSearchParams(params) : ''}`),
  getDeal: (id) => request(`/v1/crm/deals/${id}`),
  createDeal: (data) => request('/v1/crm/deals', { method: 'POST', body: JSON.stringify(data) }),
  updateDeal: (id, data) => request(`/v1/crm/deals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDeal: (id) => request(`/v1/crm/deals/${id}`, { method: 'DELETE' }),

  // Activities
  getActivities: (params) => request(`/v1/crm/activities${params ? '?' + new URLSearchParams(params) : ''}`),
  createActivity: (data) => request('/v1/crm/activities', { method: 'POST', body: JSON.stringify(data) }),
  updateActivity: (id, data) => request(`/v1/crm/activities/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteActivity: (id) => request(`/v1/crm/activities/${id}`, { method: 'DELETE' }),

  // Campaigns
  getCampaigns: (params) => request(`/v1/crm/campaigns${params ? '?' + new URLSearchParams(params) : ''}`),
  getCampaignStats: () => request('/v1/crm/campaigns/stats'),
  getCampaign: (id) => request(`/v1/crm/campaigns/${id}`),
  createCampaign: (data) => request('/v1/crm/campaigns', { method: 'POST', body: JSON.stringify(data) }),
  updateCampaign: (id, data) => request(`/v1/crm/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCampaign: (id) => request(`/v1/crm/campaigns/${id}`, { method: 'DELETE' }),
  getCampaignMembers: (id) => request(`/v1/crm/campaigns/${id}/members`),
  addCampaignMembers: (id, members) => request(`/v1/crm/campaigns/${id}/members`, { method: 'POST', body: JSON.stringify({ members }) }),
  updateCampaignMember: (id, data) => request(`/v1/crm/campaigns/members/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  removeCampaignMember: (id) => request(`/v1/crm/campaigns/members/${id}`, { method: 'DELETE' }),
};
