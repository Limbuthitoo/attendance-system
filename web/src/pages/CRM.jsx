import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, X, Users, Target, DollarSign, ArrowRight, Phone, Mail, Building2,
  Search, Filter, MoreVertical, Calendar, Clock, MessageSquare, PhoneCall,
  Video, FileText, CheckCircle2, Circle, ChevronRight, TrendingUp, Trophy,
  AlertCircle, BarChart3, Eye, Edit3, Trash2, Star, Globe, Briefcase,
  UserPlus, ArrowUpRight, ChevronDown, Megaphone, Send, MousePointerClick,
  Zap, Hash, Percent, Play, Pause, Ban
} from 'lucide-react';
import { api } from '../lib/api';
import { formatDate as _fmtDate } from '../lib/format-date';
import { useSettings } from '../context/SettingsContext';
import DatePicker from '../components/DatePicker';

const LEAD_SOURCES = ['Website', 'Referral', 'Cold Call', 'Social Media', 'Email Campaign', 'Trade Show', 'Partner', 'Other'];
const LEAD_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const ACTIVITY_TYPES = ['CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK', 'FOLLOW_UP'];
const INDUSTRIES = ['Technology', 'Finance', 'Healthcare', 'Education', 'Manufacturing', 'Retail', 'Real Estate', 'Consulting', 'Construction', 'Other'];

const CAMPAIGN_TYPES = [
  { value: 'TELEMARKETING', label: 'Telemarketing', icon: Phone },
  { value: 'EMAIL_MARKETING', label: 'Email Marketing', icon: Mail },
  { value: 'DIGITAL_MARKETING', label: 'Digital Marketing', icon: Globe },
  { value: 'SOCIAL_MEDIA', label: 'Social Media', icon: Users },
  { value: 'CONTENT_MARKETING', label: 'Content Marketing', icon: FileText },
  { value: 'EVENT', label: 'Event', icon: Calendar },
  { value: 'DIRECT_MAIL', label: 'Direct Mail', icon: Send },
  { value: 'SMS', label: 'SMS', icon: MessageSquare },
  { value: 'REFERRAL_PROGRAM', label: 'Referral Program', icon: UserPlus },
  { value: 'OTHER', label: 'Other', icon: Zap },
];

const CAMPAIGN_STATUS_COLORS = {
  DRAFT: 'bg-gray-100 text-gray-700 ring-1 ring-gray-500/20',
  SCHEDULED: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/20',
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20',
  PAUSED: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20',
  COMPLETED: 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20',
  CANCELLED: 'bg-red-50 text-red-700 ring-1 ring-red-600/20',
};

const MEMBER_STATUS_COLORS = {
  TARGETED: 'bg-gray-100 text-gray-600',
  SENT: 'bg-blue-50 text-blue-700',
  DELIVERED: 'bg-indigo-50 text-indigo-700',
  OPENED: 'bg-cyan-50 text-cyan-700',
  CLICKED: 'bg-purple-50 text-purple-700',
  RESPONDED: 'bg-emerald-50 text-emerald-700',
  CONVERTED: 'bg-green-50 text-green-700',
  OPTED_OUT: 'bg-red-50 text-red-700',
  BOUNCED: 'bg-orange-50 text-orange-700',
};

const BUSINESS_CATEGORIES = ['Technology', 'Finance & Banking', 'Healthcare', 'Education', 'E-commerce', 'Real Estate', 'Manufacturing', 'Hospitality', 'Automotive', 'Food & Beverage', 'Retail', 'Professional Services', 'Non-Profit', 'Other'];

const STATUS_COLORS = {
  NEW: 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20',
  CONTACTED: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/20',
  QUALIFIED: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20',
  UNQUALIFIED: 'bg-gray-100 text-gray-500 ring-1 ring-gray-500/20',
  CONVERTED: 'bg-purple-50 text-purple-700 ring-1 ring-purple-600/20',
  LOST: 'bg-red-50 text-red-700 ring-1 ring-red-600/20',
  OPEN: 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20',
  WON: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20',
  STALE: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20',
};

const PRIORITY_COLORS = {
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-blue-50 text-blue-700',
  HIGH: 'bg-orange-50 text-orange-700',
  URGENT: 'bg-red-50 text-red-700',
};

const ACTIVITY_ICONS = {
  CALL: PhoneCall, EMAIL: Mail, MEETING: Video, NOTE: FileText, TASK: CheckCircle2, FOLLOW_UP: Clock,
};

const ACTIVITY_COLORS = {
  CALL: 'bg-green-100 text-green-700', EMAIL: 'bg-blue-100 text-blue-700', MEETING: 'bg-purple-100 text-purple-700',
  NOTE: 'bg-gray-100 text-gray-700', TASK: 'bg-amber-100 text-amber-700', FOLLOW_UP: 'bg-indigo-100 text-indigo-700',
};

function formatCurrency(val) { return `NPR ${Number(val || 0).toLocaleString()}`; }
function _formatDateAD(d) { return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'; }
function formatRelative(d) {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return _formatDateAD(d);
}

// ── Modal Shell ──────────────────────────────────────────────────────────────

function Modal({ open, onClose, title, children, width = 'max-w-lg' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${width} max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color = 'blue' }) {
  const colors = { blue: 'bg-blue-50 text-blue-600', emerald: 'bg-emerald-50 text-emerald-600', purple: 'bg-purple-50 text-purple-600', amber: 'bg-amber-50 text-amber-600', red: 'bg-red-50 text-red-600' };
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}><Icon size={20} /></div>
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
          {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN CRM COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function CRM() {
  const { dateFormat } = useSettings();
  const formatDate = (d) => _fmtDate(d, dateFormat);
  const [tab, setTab] = useState('dashboard');
  const [deals, setDeals] = useState([]);
  const [leads, setLeads] = useState([]);
  const [clients, setClients] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [activities, setActivities] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, l, c, p, a, dash, emp, camp] = await Promise.all([
        api.getDeals(), api.getLeads(), api.getClients(), api.getPipelines(),
        api.getActivities(), api.getDashboard().catch(() => null),
        api.getEmployees().catch(() => ({ employees: [] })),
        api.getCampaigns().catch(() => ({ campaigns: [] })),
      ]);
      setDeals(d.deals || []); setLeads(l.leads || []); setClients(c.clients || []);
      setPipelines(p.pipelines || []); setActivities(a.activities || []);
      setDashboard(dash); setEmployees(emp.employees || []);
      setCampaigns(camp.campaigns || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const tabs = [
    { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { key: 'deals', label: 'Deals', icon: Target, count: deals.filter(d => d.status === 'OPEN').length },
    { key: 'leads', label: 'Leads', icon: UserPlus, count: leads.filter(l => !['CONVERTED','LOST'].includes(l.status)).length },
    { key: 'clients', label: 'Clients', icon: Building2, count: clients.length },
    { key: 'campaigns', label: 'Campaigns', icon: Megaphone, count: campaigns.filter(c => c.status === 'ACTIVE').length },
    { key: 'activities', label: 'Activities', icon: Clock, count: activities.filter(a => !a.completed).length },
    { key: 'pipelines', label: 'Pipelines', icon: TrendingUp, count: pipelines.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CRM</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your sales pipeline, leads, and client relationships</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <Icon size={16} />
              {t.label}
              {t.count !== undefined && <span className="ml-1 text-xs bg-gray-100 px-1.5 py-0.5 rounded-full">{t.count}</span>}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full" /></div>
      ) : (
        <>
          {tab === 'dashboard' && <DashboardView dashboard={dashboard} deals={deals} leads={leads} activities={activities} />}
          {tab === 'deals' && <DealsView deals={deals} pipelines={pipelines} clients={clients} employees={employees} onRefresh={load} />}
          {tab === 'leads' && <LeadsView leads={leads} clients={clients} employees={employees} onRefresh={load} />}
          {tab === 'clients' && <ClientsView clients={clients} employees={employees} onRefresh={load} />}
          {tab === 'campaigns' && <CampaignsView campaigns={campaigns} clients={clients} onRefresh={load} />}
          {tab === 'activities' && <ActivitiesView activities={activities} clients={clients} deals={deals} leads={leads} onRefresh={load} />}
          {tab === 'pipelines' && <PipelinesView pipelines={pipelines} onRefresh={load} />}
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════

function DashboardView({ dashboard, deals, leads, activities }) {
  const s = dashboard?.summary || {};
  const upcomingActivities = activities.filter(a => !a.completed && a.dueDate).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).slice(0, 5);
  const recentActs = dashboard?.recentActivities || activities.slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={Building2} label="Total Clients" value={s.totalClients || 0} color="blue" />
        <StatCard icon={UserPlus} label="Active Leads" value={s.activeLeads || 0} color="purple" />
        <StatCard icon={Target} label="Open Deals" value={s.openDeals || 0} sub={formatCurrency(s.pipelineValue)} color="amber" />
        <StatCard icon={Trophy} label="Won (30d)" value={s.wonCountThisMonth || 0} sub={formatCurrency(s.wonValueThisMonth)} color="emerald" />
        <StatCard icon={TrendingUp} label="Win Rate" value={`${s.winRate || 0}%`} sub={`Weighted: ${formatCurrency(s.weightedValue)}`} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline by Stage */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Pipeline by Stage</h3>
          {(dashboard?.dealsByStage || []).length > 0 ? (
            <div className="space-y-3">
              {dashboard.dealsByStage.map((s, i) => {
                const maxVal = Math.max(...dashboard.dealsByStage.map(d => d.value));
                const pct = maxVal > 0 ? (s.value / maxVal) * 100 : 0;
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{s.stage}</span>
                      <span className="text-gray-500">{s.count} deals · {formatCurrency(s.value)}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No open deals yet</p>
          )}
        </div>

        {/* Top Deals */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Top Deals</h3>
          {(dashboard?.topDeals || []).length > 0 ? (
            <div className="space-y-3">
              {dashboard.topDeals.map(deal => (
                <div key={deal.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{deal.title}</p>
                    <p className="text-xs text-gray-500">{deal.client?.name || 'No client'} · {deal.assignee?.name || 'Unassigned'}</p>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{formatCurrency(deal.value)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No deals yet</p>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Recent Activity</h3>
          {recentActs.length > 0 ? (
            <div className="space-y-3">
              {recentActs.map(act => {
                const Icon = ACTIVITY_ICONS[act.type] || FileText;
                return (
                  <div key={act.id} className="flex items-start gap-3">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${ACTIVITY_COLORS[act.type] || 'bg-gray-100 text-gray-600'}`}><Icon size={14} /></div>
                    <div className="min-w-0">
                      <p className="text-sm text-gray-900 truncate">{act.subject}</p>
                      <p className="text-xs text-gray-500">{act.creator?.name} · {formatRelative(act.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No activity yet</p>
          )}
        </div>

        {/* Upcoming Tasks */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Upcoming Tasks</h3>
          {upcomingActivities.length > 0 ? (
            <div className="space-y-3">
              {upcomingActivities.map(act => (
                <div key={act.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <Circle size={16} className="text-gray-300 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900 truncate">{act.subject}</p>
                    <p className="text-xs text-gray-500">{act.deal?.title || act.client?.name || ''} · Due {formatDate(act.dueDate)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No upcoming tasks</p>
          )}
        </div>
      </div>

      {/* Leads by Status */}
      {dashboard?.leadsByStatus && Object.keys(dashboard.leadsByStatus).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Leads by Status</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(dashboard.leadsByStatus).map(([status, count]) => (
              <div key={status} className={`px-4 py-2 rounded-lg text-sm font-medium ${STATUS_COLORS[status]}`}>
                {status}: {count}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DEALS — Kanban Board + List View
// ══════════════════════════════════════════════════════════════════════════════

function DealsView({ deals, pipelines, clients, employees, onRefresh }) {
  const [view, setView] = useState('kanban');
  const [showForm, setShowForm] = useState(false);
  const [editDeal, setEditDeal] = useState(null);
  const [detailDeal, setDetailDeal] = useState(null);
  const [selectedPipeline, setSelectedPipeline] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('OPEN');

  const activePipeline = useMemo(() => {
    if (selectedPipeline) return pipelines.find(p => p.id === selectedPipeline);
    return pipelines.find(p => p.isDefault) || pipelines[0];
  }, [pipelines, selectedPipeline]);

  const stages = useMemo(() => {
    if (!activePipeline) return [];
    return Array.isArray(activePipeline.stages) ? activePipeline.stages : [];
  }, [activePipeline]);

  const filteredDeals = useMemo(() => {
    let d = deals;
    if (statusFilter) d = d.filter(deal => deal.status === statusFilter);
    if (selectedPipeline) d = d.filter(deal => deal.pipelineId === selectedPipeline);
    else if (activePipeline) d = d.filter(deal => deal.pipelineId === activePipeline.id);
    if (search) {
      const s = search.toLowerCase();
      d = d.filter(deal => deal.title.toLowerCase().includes(s) || deal.client?.name?.toLowerCase().includes(s));
    }
    return d;
  }, [deals, statusFilter, selectedPipeline, activePipeline, search]);

  const [form, setForm] = useState({ title: '', value: '', pipelineId: '', clientId: '', assignedTo: '', expectedCloseDate: '', notes: '' });

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await api.createDeal({ ...form, value: Number(form.value) || 0, pipelineId: form.pipelineId || activePipeline?.id });
      setShowForm(false); setForm({ title: '', value: '', pipelineId: '', clientId: '', assignedTo: '', expectedCloseDate: '', notes: '' }); onRefresh();
    } catch (err) { alert(err.message); }
  }

  async function handleStageChange(dealId, stage, probability) {
    try { await api.updateDeal(dealId, { stage, probability }); onRefresh(); } catch (err) { alert(err.message); }
  }

  async function handleStatusChange(dealId, status, extra = {}) {
    try { await api.updateDeal(dealId, { status, ...extra }); onRefresh(); } catch (err) { alert(err.message); }
  }

  async function handleDelete(dealId) {
    if (!confirm('Delete this deal?')) return;
    try { await api.deleteDeal(dealId); onRefresh(); } catch (err) { alert(err.message); }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search deals..." className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-64" />
          </div>
          {pipelines.length > 1 && (
            <select value={selectedPipeline || activePipeline?.id || ''} onChange={e => setSelectedPipeline(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
              {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">All Status</option>
            <option value="OPEN">Open</option>
            <option value="WON">Won</option>
            <option value="LOST">Lost</option>
            <option value="STALE">Stale</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setView('kanban')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${view === 'kanban' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Board</button>
            <button onClick={() => setView('list')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${view === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>List</button>
          </div>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            <Plus size={16} /> New Deal
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      {view === 'kanban' && stages.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map(stage => {
            const stageDeals = filteredDeals.filter(d => d.stage === stage.name);
            const stageValue = stageDeals.reduce((s, d) => s + Number(d.value), 0);
            return (
              <div key={stage.name} className="flex-shrink-0 w-72">
                <div className="bg-gray-50 rounded-xl p-3 mb-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-700">{stage.name}</h3>
                    <span className="text-xs bg-white px-2 py-0.5 rounded-full text-gray-500 font-medium">{stageDeals.length}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{formatCurrency(stageValue)} · {stage.probability}%</p>
                </div>
                <div className="space-y-3 min-h-[200px]">
                  {stageDeals.map(deal => (
                    <div key={deal.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition cursor-pointer" onClick={() => setDetailDeal(deal)}>
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="text-sm font-semibold text-gray-900 leading-tight">{deal.title}</h4>
                        <button onClick={e => { e.stopPropagation(); handleDelete(deal.id); }} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                      </div>
                      <p className="text-lg font-bold text-gray-900 mb-2">{formatCurrency(deal.value)}</p>
                      {deal.client && <p className="text-xs text-gray-500 mb-1"><Building2 size={12} className="inline mr-1" />{deal.client.name}</p>}
                      {deal.assignee && <p className="text-xs text-gray-500 mb-2"><Users size={12} className="inline mr-1" />{deal.assignee.name}</p>}
                      <div className="flex items-center justify-between">
                        {deal.expectedCloseDate && <span className="text-xs text-gray-400"><Calendar size={12} className="inline mr-1" />{formatDate(deal.expectedCloseDate)}</span>}
                        <div className="flex gap-1 ml-auto">
                          {stages.indexOf(stage) < stages.length - 1 && (
                            <button onClick={e => { e.stopPropagation(); const next = stages[stages.indexOf(stage) + 1]; handleStageChange(deal.id, next.name, next.probability); }} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded font-medium hover:bg-blue-100">
                              <ArrowRight size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {/* Won/Lost columns */}
          {!statusFilter && (
            <>
              <div className="flex-shrink-0 w-72">
                <div className="bg-emerald-50 rounded-xl p-3 mb-3">
                  <h3 className="text-sm font-semibold text-emerald-700">Won</h3>
                  <p className="text-xs text-emerald-600 mt-1">{deals.filter(d => d.status === 'WON' && d.pipelineId === activePipeline?.id).length} deals</p>
                </div>
              </div>
              <div className="flex-shrink-0 w-72">
                <div className="bg-red-50 rounded-xl p-3 mb-3">
                  <h3 className="text-sm font-semibold text-red-700">Lost</h3>
                  <p className="text-xs text-red-600 mt-1">{deals.filter(d => d.status === 'LOST' && d.pipelineId === activePipeline?.id).length} deals</p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="bg-gray-50">
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Deal</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Client</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Value</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Stage</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Assigned</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Close Date</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {filteredDeals.map(deal => (
                  <tr key={deal.id} className="hover:bg-blue-50/40 transition-colors cursor-pointer" onClick={() => setDetailDeal(deal)}>
                    <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{deal.title}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{deal.client?.name || '—'}</td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-gray-900">{formatCurrency(deal.value)}</td>
                    <td className="px-5 py-3.5"><span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 font-medium">{deal.stage}</span></td>
                    <td className="px-5 py-3.5"><span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[deal.status]}`}>{deal.status}</span></td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{deal.assignee?.name || '—'}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-500">{formatDate(deal.expectedCloseDate)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                        {deal.status === 'OPEN' && (
                          <>
                            <button onClick={() => handleStatusChange(deal.id, 'WON')} className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded font-medium hover:bg-emerald-100">Won</button>
                            <button onClick={() => handleStatusChange(deal.id, 'LOST')} className="text-xs px-2 py-1 bg-red-50 text-red-700 rounded font-medium hover:bg-red-100">Lost</button>
                          </>
                        )}
                        <button onClick={() => handleDelete(deal.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredDeals.length === 0 && <div className="text-center py-12"><Target size={32} className="mx-auto text-gray-300 mb-3" /><p className="text-gray-500 text-sm">No deals found</p></div>}
          </div>
        </div>
      )}

      {/* Create Deal Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="New Deal" width="max-w-2xl">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Title *</label><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Value (NPR)</label><input type="number" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Pipeline</label>
              <select value={form.pipelineId} onChange={e => setForm({ ...form, pipelineId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">Default Pipeline</option>
                {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Client</label>
              <select value={form.clientId} onChange={e => setForm({ ...form, clientId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">Select client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>)}
              </select>
            </div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Assigned To</label>
              <select value={form.assignedTo} onChange={e => setForm({ ...form, assignedTo: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">Unassigned</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Expected Close</label><DatePicker value={form.expectedCloseDate} onChange={v => setForm({ ...form, expectedCloseDate: v })} placeholder="Expected Close" /></div>
          </div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Notes</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">Cancel</button>
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Create Deal</button>
          </div>
        </form>
      </Modal>

      {/* Deal Detail Modal */}
      <DealDetailModal deal={detailDeal} onClose={() => setDetailDeal(null)} stages={stages} onRefresh={onRefresh} clients={clients} employees={employees} />
    </div>
  );
}

function DealDetailModal({ deal, onClose, stages, onRefresh, clients, employees }) {
  const [actForm, setActForm] = useState({ type: 'NOTE', subject: '', description: '' });
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!deal) return;
    setLoading(true);
    api.getDeal(deal.id).then(r => {
      setActivities(r.deal?.activities || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [deal?.id]);

  if (!deal) return null;

  async function handleAddActivity(e) {
    e.preventDefault();
    try {
      await api.createActivity({ ...actForm, dealId: deal.id, clientId: deal.clientId });
      setActForm({ type: 'NOTE', subject: '', description: '' });
      const r = await api.getDeal(deal.id);
      setActivities(r.deal?.activities || []);
      onRefresh();
    } catch (err) { alert(err.message); }
  }

  return (
    <Modal open={!!deal} onClose={onClose} title={deal.title} width="max-w-3xl">
      <div className="space-y-6">
        {/* Deal Info */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div><p className="text-xs text-gray-500">Value</p><p className="text-lg font-bold">{formatCurrency(deal.value)}</p></div>
          <div><p className="text-xs text-gray-500">Stage</p><p className="text-sm font-medium">{deal.stage}</p></div>
          <div><p className="text-xs text-gray-500">Status</p><span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[deal.status]}`}>{deal.status}</span></div>
          <div><p className="text-xs text-gray-500">Expected Close</p><p className="text-sm">{formatDate(deal.expectedCloseDate)}</p></div>
        </div>

        {deal.client && (
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Client</p>
            <p className="text-sm font-medium">{deal.client.name}</p>
            {deal.client.company && <p className="text-xs text-gray-500">{deal.client.company}</p>}
          </div>
        )}

        {/* Stage Progress */}
        {stages.length > 0 && deal.status === 'OPEN' && (
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Pipeline Progress</p>
            <div className="flex gap-1">
              {stages.map((s, i) => {
                const currentIdx = stages.findIndex(st => st.name === deal.stage);
                const isActive = i <= currentIdx;
                return (
                  <button key={s.name} onClick={() => api.updateDeal(deal.id, { stage: s.name, probability: s.probability }).then(onRefresh)} className={`flex-1 h-2 rounded-full transition ${isActive ? 'bg-blue-500' : 'bg-gray-200 hover:bg-gray-300'}`} title={s.name} />
                );
              })}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-400">{stages[0]?.name}</span>
              <span className="text-xs text-gray-400">{stages[stages.length - 1]?.name}</span>
            </div>
          </div>
        )}

        {/* Quick Log Activity */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Log Activity</h4>
          <form onSubmit={handleAddActivity} className="space-y-3">
            <div className="flex gap-2">
              <select value={actForm.type} onChange={e => setActForm({ ...actForm, type: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
              <input value={actForm.subject} onChange={e => setActForm({ ...actForm, subject: e.target.value })} placeholder="Subject..." required className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Log</button>
            </div>
            <textarea value={actForm.description} onChange={e => setActForm({ ...actForm, description: e.target.value })} placeholder="Details (optional)..." rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </form>
        </div>

        {/* Activity Timeline */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Activity Timeline</h4>
          {loading ? <div className="py-4 text-center text-gray-400 text-sm">Loading...</div> : (
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {activities.map(act => {
                const Icon = ACTIVITY_ICONS[act.type] || FileText;
                return (
                  <div key={act.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${ACTIVITY_COLORS[act.type] || 'bg-gray-100 text-gray-600'}`}><Icon size={14} /></div>
                    <div className="min-w-0">
                      <p className="text-sm text-gray-900">{act.subject}</p>
                      {act.description && <p className="text-xs text-gray-500 mt-0.5">{act.description}</p>}
                      <p className="text-xs text-gray-400 mt-1">{act.creator?.name} · {formatRelative(act.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
              {activities.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No activities yet</p>}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LEADS
// ══════════════════════════════════════════════════════════════════════════════

function LeadsView({ leads, clients, employees, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let l = leads;
    if (statusFilter) l = l.filter(lead => lead.status === statusFilter);
    if (search) {
      const s = search.toLowerCase();
      l = l.filter(lead => lead.title.toLowerCase().includes(s) || lead.client?.name?.toLowerCase().includes(s));
    }
    return l;
  }, [leads, statusFilter, search]);

  const [form, setForm] = useState({ title: '', source: '', value: '', priority: 'MEDIUM', clientId: '', assignedTo: '', notes: '', nextFollowUp: '' });

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await api.createLead({ ...form, value: Number(form.value) || null });
      setShowForm(false); setForm({ title: '', source: '', value: '', priority: 'MEDIUM', clientId: '', assignedTo: '', notes: '', nextFollowUp: '' }); onRefresh();
    } catch (err) { alert(err.message); }
  }

  async function handleUpdate(id, data) {
    try { await api.updateLead(id, data); onRefresh(); } catch (err) { alert(err.message); }
  }

  async function handleConvert(id) {
    if (!confirm('Convert this lead to a deal?')) return;
    try { await api.convertLead(id, {}); onRefresh(); } catch (err) { alert(err.message); }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this lead?')) return;
    try { await api.deleteLead(id); onRefresh(); } catch (err) { alert(err.message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads..." className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-64" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">All Status</option>
            {['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED', 'LOST'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus size={16} /> New Lead
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-gray-50">
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Lead</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Client</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Source</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Value</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Priority</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Assigned</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Follow Up</th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(lead => (
                <tr key={lead.id} className="hover:bg-blue-50/40 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="text-sm font-medium text-gray-900">{lead.title}</p>
                    {lead._count?.activities > 0 && <p className="text-xs text-gray-400">{lead._count.activities} activities</p>}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-600">{lead.client?.name || '—'}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-600">{lead.source || '—'}</td>
                  <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{lead.value ? formatCurrency(lead.value) : '—'}</td>
                  <td className="px-5 py-3.5"><span className={`text-xs px-2 py-1 rounded-full font-medium ${PRIORITY_COLORS[lead.priority]}`}>{lead.priority}</span></td>
                  <td className="px-5 py-3.5">
                    <select value={lead.status} onChange={e => handleUpdate(lead.id, { status: e.target.value })} className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${STATUS_COLORS[lead.status]}`}>
                      {['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'LOST'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-600">{lead.assignee?.name || '—'}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-500">{formatDate(lead.nextFollowUp)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex justify-end gap-1">
                      {!['CONVERTED', 'LOST'].includes(lead.status) && (
                        <button onClick={() => handleConvert(lead.id)} className="flex items-center gap-1 text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded font-medium hover:bg-purple-100">
                          <ArrowRight size={12} /> Convert
                        </button>
                      )}
                      <button onClick={() => handleDelete(lead.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="text-center py-12"><UserPlus size={32} className="mx-auto text-gray-300 mb-3" /><p className="text-gray-500 text-sm">No leads found</p></div>}
        </div>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="New Lead" width="max-w-2xl">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Title *</label><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Source</label>
              <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">Select...</option>
                {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Est. Value (NPR)</label><input type="number" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
              <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                {LEAD_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Client</label>
              <select value={form.clientId} onChange={e => setForm({ ...form, clientId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">Select client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Assigned To</label>
              <select value={form.assignedTo} onChange={e => setForm({ ...form, assignedTo: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">Unassigned</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Next Follow-up</label><DatePicker value={form.nextFollowUp} onChange={v => setForm({ ...form, nextFollowUp: v })} placeholder="Next Follow-up" /></div>
          </div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Notes</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">Cancel</button>
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Create Lead</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CLIENTS + CONTACTS
// ══════════════════════════════════════════════════════════════════════════════

function ClientsView({ clients, employees, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [detailClient, setDetailClient] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const filtered = useMemo(() => {
    let c = clients;
    if (typeFilter) c = c.filter(cl => cl.type === typeFilter);
    if (search) {
      const s = search.toLowerCase();
      c = c.filter(cl => cl.name.toLowerCase().includes(s) || cl.company?.toLowerCase().includes(s) || cl.email?.toLowerCase().includes(s));
    }
    return c;
  }, [clients, typeFilter, search]);

  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', address: '', website: '', industry: '', type: 'COMPANY', notes: '' });

  async function handleCreate(e) {
    e.preventDefault();
    try { await api.createClient(form); setShowForm(false); setForm({ name: '', email: '', phone: '', company: '', address: '', website: '', industry: '', type: 'COMPANY', notes: '' }); onRefresh(); } catch (err) { alert(err.message); }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this client? This will fail if the client has deals or leads.')) return;
    try { await api.deleteClient(id); onRefresh(); } catch (err) { alert(err.message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients..." className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-64" />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">All Types</option>
            <option value="COMPANY">Company</option>
            <option value="INDIVIDUAL">Individual</option>
          </select>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus size={16} /> New Client
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-gray-50">
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Client</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Contact</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Industry</th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
              <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Deals</th>
              <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Leads</th>
              <th className="px-5 py-3.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Contacts</th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(client => {
                const primary = client.contacts?.[0];
                return (
                  <tr key={client.id} className="hover:bg-blue-50/40 transition-colors cursor-pointer" onClick={() => setDetailClient(client)}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-semibold text-sm flex-shrink-0">{client.name[0]}</div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{client.name}</p>
                          {client.company && <p className="text-xs text-gray-500">{client.company}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="text-sm">
                        {client.email && <p className="text-gray-600 flex items-center gap-1"><Mail size={12} className="text-gray-400" />{client.email}</p>}
                        {client.phone && <p className="text-gray-500 flex items-center gap-1"><Phone size={12} className="text-gray-400" />{client.phone}</p>}
                        {primary && <p className="text-xs text-blue-600 mt-0.5"><Star size={10} className="inline" /> {primary.name}{primary.designation ? ` — ${primary.designation}` : ''}</p>}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{client.industry || '—'}</td>
                    <td className="px-5 py-3.5"><span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 font-medium">{client.type}</span></td>
                    <td className="px-5 py-3.5 text-center text-sm font-medium text-gray-900">{client._count?.deals || 0}</td>
                    <td className="px-5 py-3.5 text-center text-sm font-medium text-gray-900">{client._count?.leads || 0}</td>
                    <td className="px-5 py-3.5 text-center text-sm font-medium text-gray-900">{client._count?.contacts || 0}</td>
                    <td className="px-5 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                      <button onClick={() => handleDelete(client.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="text-center py-12"><Building2 size={32} className="mx-auto text-gray-300 mb-3" /><p className="text-gray-500 text-sm">No clients found</p></div>}
        </div>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="New Client" width="max-w-2xl">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Name *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Company</label><input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Email</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Phone</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Website</label><input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="https://..." /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Industry</label>
              <select value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">Select...</option>
                {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="COMPANY">Company</option>
                <option value="INDIVIDUAL">Individual</option>
              </select>
            </div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Address</label><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
          </div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Notes</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">Cancel</button>
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Create Client</button>
          </div>
        </form>
      </Modal>

      {/* Client Detail */}
      <ClientDetailModal client={detailClient} onClose={() => setDetailClient(null)} onRefresh={onRefresh} />
    </div>
  );
}

function ClientDetailModal({ client, onClose, onRefresh }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', designation: '', isPrimary: false });

  useEffect(() => {
    if (!client) { setDetail(null); return; }
    setLoading(true);
    api.getClient(client.id).then(r => setDetail(r.client)).catch(() => {}).finally(() => setLoading(false));
  }, [client?.id]);

  if (!client) return null;

  async function handleAddContact(e) {
    e.preventDefault();
    try {
      await api.createContact({ ...contactForm, clientId: client.id });
      setShowContactForm(false);
      setContactForm({ name: '', email: '', phone: '', designation: '', isPrimary: false });
      const r = await api.getClient(client.id);
      setDetail(r.client);
      onRefresh();
    } catch (err) { alert(err.message); }
  }

  async function handleDeleteContact(id) {
    try {
      await api.deleteContact(id);
      const r = await api.getClient(client.id);
      setDetail(r.client);
    } catch (err) { alert(err.message); }
  }

  const d = detail || client;

  return (
    <Modal open={!!client} onClose={onClose} title={d.name} width="max-w-3xl">
      {loading ? <div className="py-8 text-center"><div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" /></div> : (
        <div className="space-y-6">
          {/* Client Info */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {d.company && <div><p className="text-xs text-gray-500">Company</p><p className="text-sm font-medium">{d.company}</p></div>}
            {d.email && <div><p className="text-xs text-gray-500">Email</p><p className="text-sm text-blue-600">{d.email}</p></div>}
            {d.phone && <div><p className="text-xs text-gray-500">Phone</p><p className="text-sm">{d.phone}</p></div>}
            {d.website && <div><p className="text-xs text-gray-500">Website</p><p className="text-sm text-blue-600">{d.website}</p></div>}
            {d.industry && <div><p className="text-xs text-gray-500">Industry</p><p className="text-sm">{d.industry}</p></div>}
            {d.address && <div><p className="text-xs text-gray-500">Address</p><p className="text-sm">{d.address}</p></div>}
          </div>

          {/* Contacts */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-900">Contacts ({d.contacts?.length || 0})</h4>
              <button onClick={() => setShowContactForm(!showContactForm)} className="text-xs text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1"><Plus size={14} /> Add Contact</button>
            </div>
            {showContactForm && (
              <form onSubmit={handleAddContact} className="bg-gray-50 rounded-lg p-4 mb-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input value={contactForm.name} onChange={e => setContactForm({ ...contactForm, name: e.target.value })} placeholder="Name *" required className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  <input value={contactForm.designation} onChange={e => setContactForm({ ...contactForm, designation: e.target.value })} placeholder="Designation" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  <input value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} placeholder="Email" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  <input value={contactForm.phone} onChange={e => setContactForm({ ...contactForm, phone: e.target.value })} placeholder="Phone" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={contactForm.isPrimary} onChange={e => setContactForm({ ...contactForm, isPrimary: e.target.checked })} className="rounded" /> Primary Contact</label>
                  <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium">Add</button>
                </div>
              </form>
            )}
            <div className="space-y-2">
              {(d.contacts || []).map(c => (
                <div key={c.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-medium text-xs">{c.name[0]}</div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{c.name} {c.isPrimary && <Star size={12} className="inline text-amber-500" />}</p>
                      <p className="text-xs text-gray-500">{[c.designation, c.email, c.phone].filter(Boolean).join(' · ')}</p>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteContact(c.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              ))}
              {(!d.contacts || d.contacts.length === 0) && <p className="text-sm text-gray-400 text-center py-4">No contacts added</p>}
            </div>
          </div>

          {/* Deals */}
          {d.deals && d.deals.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Deals ({d.deals.length})</h4>
              <div className="space-y-2">
                {d.deals.map(deal => (
                  <div key={deal.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{deal.title}</p>
                      <p className="text-xs text-gray-500">{deal.pipeline?.name} · {deal.assignee?.name || 'Unassigned'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{formatCurrency(deal.value)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[deal.status]}`}>{deal.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity Timeline */}
          {d.activities && d.activities.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Recent Activity</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {d.activities.map(act => {
                  const Icon = ACTIVITY_ICONS[act.type] || FileText;
                  return (
                    <div key={act.id} className="flex items-start gap-3 py-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${ACTIVITY_COLORS[act.type]}`}><Icon size={14} /></div>
                      <div>
                        <p className="text-sm text-gray-900">{act.subject}</p>
                        <p className="text-xs text-gray-500">{act.creator?.name} · {formatRelative(act.createdAt)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ACTIVITIES
// ══════════════════════════════════════════════════════════════════════════════

function ActivitiesView({ activities, clients, deals, leads, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [form, setForm] = useState({ type: 'NOTE', subject: '', description: '', clientId: '', dealId: '', leadId: '', dueDate: '' });

  const filtered = typeFilter ? activities.filter(a => a.type === typeFilter) : activities;

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await api.createActivity(form);
      setShowForm(false); setForm({ type: 'NOTE', subject: '', description: '', clientId: '', dealId: '', leadId: '', dueDate: '' }); onRefresh();
    } catch (err) { alert(err.message); }
  }

  async function handleToggle(id, completed) {
    try { await api.updateActivity(id, { completed: !completed }); onRefresh(); } catch (err) { alert(err.message); }
  }

  async function handleDelete(id) {
    try { await api.deleteActivity(id); onRefresh(); } catch (err) { alert(err.message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">All Types</option>
            {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus size={16} /> Log Activity
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="divide-y divide-gray-100">
          {filtered.map(act => {
            const Icon = ACTIVITY_ICONS[act.type] || FileText;
            return (
              <div key={act.id} className="px-5 py-4 flex items-start gap-4 hover:bg-gray-50 transition">
                <button onClick={() => handleToggle(act.id, act.completed)} className="mt-0.5 flex-shrink-0">
                  {act.completed ? <CheckCircle2 size={20} className="text-emerald-500" /> : <Circle size={20} className="text-gray-300 hover:text-blue-400" />}
                </button>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${ACTIVITY_COLORS[act.type]}`}><Icon size={16} /></div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${act.completed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{act.subject}</p>
                  {act.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{act.description}</p>}
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACTIVITY_COLORS[act.type]}`}>{act.type.replace('_', ' ')}</span>
                    {act.deal && <span className="text-xs text-gray-500"><Target size={10} className="inline mr-1" />{act.deal.title}</span>}
                    {act.client && <span className="text-xs text-gray-500"><Building2 size={10} className="inline mr-1" />{act.client.name}</span>}
                    {act.lead && <span className="text-xs text-gray-500"><UserPlus size={10} className="inline mr-1" />{act.lead.title}</span>}
                    <span className="text-xs text-gray-400">{act.creator?.name} · {formatRelative(act.createdAt)}</span>
                    {act.dueDate && <span className="text-xs text-gray-400"><Calendar size={10} className="inline mr-1" />Due {formatDate(act.dueDate)}</span>}
                  </div>
                </div>
                <button onClick={() => handleDelete(act.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 flex-shrink-0"><Trash2 size={14} /></button>
              </div>
            );
          })}
          {filtered.length === 0 && <div className="text-center py-12"><Clock size={32} className="mx-auto text-gray-300 mb-3" /><p className="text-gray-500 text-sm">No activities found</p></div>}
        </div>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Log Activity" width="max-w-lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Due Date</label><DatePicker value={form.dueDate} onChange={v => setForm({ ...form, dueDate: v })} placeholder="Due Date" /></div>
          </div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Subject *</label><input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Description</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Client</label>
              <select value={form.clientId} onChange={e => setForm({ ...form, clientId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">None</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Deal</label>
              <select value={form.dealId} onChange={e => setForm({ ...form, dealId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">None</option>
                {deals.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
            </div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Lead</label>
              <select value={form.leadId} onChange={e => setForm({ ...form, leadId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">None</option>
                {leads.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">Cancel</button>
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Log Activity</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CAMPAIGNS
// ══════════════════════════════════════════════════════════════════════════════

function CampaignsView({ campaigns, clients, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [memberForm, setMemberForm] = useState({ clientId: '', contactName: '', contactEmail: '', contactPhone: '' });

  const emptyForm = { name: '', type: 'EMAIL_MARKETING', status: 'DRAFT', description: '', targetAudience: '', businessCategory: '', budget: '', startDate: '', endDate: '', channel: '', tags: [] };
  const [form, setForm] = useState(emptyForm);

  const filtered = useMemo(() => {
    let list = campaigns;
    if (search) list = list.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
    if (filterType) list = list.filter(c => c.type === filterType);
    if (filterStatus) list = list.filter(c => c.status === filterStatus);
    return list;
  }, [campaigns, search, filterType, filterStatus]);

  const openCreate = () => { setForm(emptyForm); setEditId(null); setShowForm(true); };
  const openEdit = (c) => {
    setForm({
      name: c.name, type: c.type, status: c.status, description: c.description || '',
      targetAudience: c.targetAudience || '', businessCategory: c.businessCategory || '',
      budget: c.budget || '', startDate: c.startDate ? c.startDate.slice(0, 10) : '',
      endDate: c.endDate ? c.endDate.slice(0, 10) : '', channel: c.channel || '', tags: c.tags || [],
    });
    setEditId(c.id); setShowForm(true);
  };

  const handleSave = async () => {
    try {
      if (editId) await api.updateCampaign(editId, form);
      else await api.createCampaign(form);
      setShowForm(false); onRefresh();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this campaign?')) return;
    try { await api.deleteCampaign(id); onRefresh(); if (selectedCampaign === id) setSelectedCampaign(null); }
    catch (err) { console.error(err); }
  };

  const loadDetail = async (id) => {
    try {
      const res = await api.getCampaign(id);
      setDetailData(res.campaign);
      setSelectedCampaign(id);
    } catch (err) { console.error(err); }
  };

  const handleStatusChange = async (id, status) => {
    try { await api.updateCampaign(id, { status }); onRefresh(); if (selectedCampaign === id) loadDetail(id); }
    catch (err) { console.error(err); }
  };

  const handleUpdateMetrics = async (id, metrics) => {
    try { await api.updateCampaign(id, metrics); onRefresh(); loadDetail(id); }
    catch (err) { console.error(err); }
  };

  const handleAddMember = async () => {
    if (!memberForm.contactName && !memberForm.clientId) return;
    try {
      await api.addCampaignMembers(selectedCampaign, [memberForm]);
      setMemberForm({ clientId: '', contactName: '', contactEmail: '', contactPhone: '' });
      setShowAddMembers(false);
      loadDetail(selectedCampaign);
    } catch (err) { console.error(err); }
  };

  const handleMemberStatusChange = async (memberId, status) => {
    try { await api.updateCampaignMember(memberId, { status }); loadDetail(selectedCampaign); }
    catch (err) { console.error(err); }
  };

  const handleRemoveMember = async (memberId) => {
    try { await api.removeCampaignMember(memberId); loadDetail(selectedCampaign); }
    catch (err) { console.error(err); }
  };

  // Stats summary
  const stats = useMemo(() => {
    const active = campaigns.filter(c => c.status === 'ACTIVE').length;
    const totalBudget = campaigns.reduce((s, c) => s + Number(c.budget || 0), 0);
    const totalMembers = campaigns.reduce((s, c) => s + (c._count?.members || 0), 0);
    const totalLeads = campaigns.reduce((s, c) => s + (c._count?.leads || 0), 0);
    return { total: campaigns.length, active, totalBudget, totalMembers, totalLeads };
  }, [campaigns]);

  // ── Detail View ────────────────────────────────────────────────────────────
  if (selectedCampaign && detailData) {
    const c = detailData;
    const typeInfo = CAMPAIGN_TYPES.find(t => t.value === c.type);
    const TypeIcon = typeInfo?.icon || Zap;
    const funnel = [
      { label: 'Sent', count: c.sentCount, color: 'bg-blue-500' },
      { label: 'Delivered', count: c.deliveredCount, color: 'bg-indigo-500' },
      { label: 'Opened', count: c.openedCount, color: 'bg-cyan-500' },
      { label: 'Clicked', count: c.clickedCount, color: 'bg-purple-500' },
      { label: 'Responded', count: c.respondedCount, color: 'bg-emerald-500' },
      { label: 'Converted', count: c.convertedCount, color: 'bg-green-600' },
    ];
    const maxFunnel = Math.max(...funnel.map(f => f.count), 1);

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedCampaign(null)} className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1">
            ← Back to Campaigns
          </button>
        </div>

        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600"><TypeIcon size={24} /></div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{c.name}</h2>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CAMPAIGN_STATUS_COLORS[c.status]}`}>{c.status}</span>
                  <span className="text-sm text-gray-500">{typeInfo?.label || c.type}</span>
                  {c.businessCategory && <span className="text-sm text-gray-500">• {c.businessCategory}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {c.status === 'DRAFT' && <button onClick={() => handleStatusChange(c.id, 'ACTIVE')} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"><Play size={14} /> Launch</button>}
              {c.status === 'ACTIVE' && <button onClick={() => handleStatusChange(c.id, 'PAUSED')} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700"><Pause size={14} /> Pause</button>}
              {c.status === 'PAUSED' && <button onClick={() => handleStatusChange(c.id, 'ACTIVE')} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"><Play size={14} /> Resume</button>}
              {['ACTIVE', 'PAUSED'].includes(c.status) && <button onClick={() => handleStatusChange(c.id, 'COMPLETED')} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"><CheckCircle2 size={14} /> Complete</button>}
              <button onClick={() => openEdit(c)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><Edit3 size={16} /></button>
            </div>
          </div>
          {c.description && <p className="text-sm text-gray-600 mt-3">{c.description}</p>}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div><p className="text-xs text-gray-500">Budget</p><p className="font-semibold">{c.budget ? formatCurrency(c.budget) : '—'}</p></div>
            <div><p className="text-xs text-gray-500">Actual Cost</p><p className="font-semibold">{c.actualCost ? formatCurrency(c.actualCost) : '—'}</p></div>
            <div><p className="text-xs text-gray-500">Revenue</p><p className="font-semibold text-emerald-600">{Number(c.revenue) > 0 ? formatCurrency(c.revenue) : '—'}</p></div>
            <div><p className="text-xs text-gray-500">Duration</p><p className="font-semibold text-sm">{c.startDate ? formatDate(c.startDate) : '—'} → {c.endDate ? formatDate(c.endDate) : '—'}</p></div>
          </div>
          {c.targetAudience && <div className="mt-3"><p className="text-xs text-gray-500">Target Audience</p><p className="text-sm text-gray-700">{c.targetAudience}</p></div>}
        </div>

        {/* Performance Funnel */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Performance Funnel</h3>
            <MetricsEditor campaign={c} onSave={(metrics) => handleUpdateMetrics(c.id, metrics)} />
          </div>
          <div className="space-y-3">
            {funnel.map(f => (
              <div key={f.label} className="flex items-center gap-3">
                <span className="text-sm text-gray-600 w-24">{f.label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                  <div className={`h-full rounded-full ${f.color} transition-all flex items-center justify-end pr-2`} style={{ width: `${Math.max((f.count / maxFunnel) * 100, f.count > 0 ? 8 : 0)}%` }}>
                    {f.count > 0 && <span className="text-xs font-medium text-white">{f.count}</span>}
                  </div>
                </div>
                {c.sentCount > 0 && <span className="text-xs text-gray-500 w-12 text-right">{((f.count / c.sentCount) * 100).toFixed(1)}%</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Members */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Campaign Members ({c.members?.length || 0})</h3>
            <button onClick={() => setShowAddMembers(true)} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"><Plus size={14} /> Add Member</button>
          </div>
          {c.members?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Name</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Email</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Phone</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Client</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Status</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {c.members.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{m.contactName || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{m.contactEmail || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{m.contactPhone || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{m.client?.name || '—'}</td>
                      <td className="px-4 py-3">
                        <select value={m.status} onChange={e => handleMemberStatusChange(m.id, e.target.value)} className={`text-xs px-2 py-1 rounded-full font-medium border-0 ${MEMBER_STATUS_COLORS[m.status]}`}>
                          {Object.keys(MEMBER_STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleRemoveMember(m.id)} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-8 text-center text-gray-500 text-sm">No members added yet</div>
          )}
        </div>

        {/* Associated Leads */}
        {c.leads?.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Generated Leads ({c.leads.length})</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {c.leads.map(l => (
                <div key={l.id} className="px-6 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{l.title}</p>
                    <p className="text-xs text-gray-500">{l.client?.name} • {l.assignee ? l.assignee.name : 'Unassigned'}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[l.status]}`}>{l.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Member Modal */}
        <Modal open={showAddMembers} onClose={() => setShowAddMembers(false)} title="Add Campaign Member">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client (optional)</label>
              <select value={memberForm.clientId} onChange={e => setMemberForm({ ...memberForm, clientId: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">— Select Client —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
              <input value={memberForm.contactName} onChange={e => setMemberForm({ ...memberForm, contactName: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={memberForm.contactEmail} onChange={e => setMemberForm({ ...memberForm, contactEmail: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input value={memberForm.contactPhone} onChange={e => setMemberForm({ ...memberForm, contactPhone: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowAddMembers(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={handleAddMember} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add Member</button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  // ── List View ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard icon={Megaphone} label="Total Campaigns" value={stats.total} color="blue" />
        <StatCard icon={Play} label="Active" value={stats.active} color="emerald" />
        <StatCard icon={DollarSign} label="Total Budget" value={formatCurrency(stats.totalBudget)} color="purple" />
        <StatCard icon={Users} label="Members" value={stats.totalMembers} color="amber" />
        <StatCard icon={Target} label="Leads Generated" value={stats.totalLeads} color="red" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input placeholder="Search campaigns..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">All Types</option>
          {CAMPAIGN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">All Statuses</option>
          {Object.keys(CAMPAIGN_STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"><Plus size={16} /> New Campaign</button>
      </div>

      {/* Campaign Cards */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <Megaphone size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No campaigns found</p>
          <button onClick={openCreate} className="mt-3 text-sm text-blue-600 hover:underline">Create your first campaign</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(c => {
            const typeInfo = CAMPAIGN_TYPES.find(t => t.value === c.type);
            const TypeIcon = typeInfo?.icon || Zap;
            return (
              <div key={c.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer" onClick={() => loadDetail(c.id)}>
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600"><TypeIcon size={20} /></div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{c.name}</h3>
                        <p className="text-xs text-gray-500">{typeInfo?.label || c.type}</p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CAMPAIGN_STATUS_COLORS[c.status]}`}>{c.status}</span>
                  </div>
                  {c.businessCategory && <p className="text-xs text-gray-500 mt-2"><Briefcase size={12} className="inline mr-1" />{c.businessCategory}</p>}
                  {c.description && <p className="text-sm text-gray-600 mt-2 line-clamp-2">{c.description}</p>}
                  <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Users size={12} />{c._count?.members || 0} members</span>
                    <span className="flex items-center gap-1"><Target size={12} />{c._count?.leads || 0} leads</span>
                    {c.budget && <span className="flex items-center gap-1"><DollarSign size={12} />{formatCurrency(c.budget)}</span>}
                  </div>
                  {c.startDate && <p className="text-xs text-gray-400 mt-2">{formatDate(c.startDate)} — {c.endDate ? formatDate(c.endDate) : 'Ongoing'}</p>}
                </div>
                <div className="border-t border-gray-100 px-5 py-2 flex justify-end gap-1">
                  <button onClick={e => { e.stopPropagation(); openEdit(c); }} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><Edit3 size={14} /></button>
                  <button onClick={e => { e.stopPropagation(); handleDelete(c.id); }} className="p-1.5 rounded hover:bg-gray-100 text-red-400"><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editId ? 'Edit Campaign' : 'New Campaign'} width="max-w-2xl">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name *</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="e.g. Q1 2025 Email Outreach" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Type *</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {CAMPAIGN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {Object.keys(CAMPAIGN_STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Category</label>
              <select value={form.businessCategory} onChange={e => setForm({ ...form, businessCategory: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="">— Select —</option>
                {BUSINESS_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
              <input value={form.channel} onChange={e => setForm({ ...form, channel: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="e.g. Facebook Ads, Google Ads" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
            <input value={form.targetAudience} onChange={e => setForm({ ...form, targetAudience: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="e.g. SMBs in tech industry, 50-200 employees" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Budget</label>
              <input type="number" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <DatePicker value={form.startDate} onChange={v => setForm({ ...form, startDate: v })} placeholder="Start Date" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <DatePicker value={form.endDate} onChange={v => setForm({ ...form, endDate: v })} placeholder="End Date" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button onClick={handleSave} disabled={!form.name || !form.type} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{editId ? 'Update' : 'Create'} Campaign</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Metrics Editor (inline) ──────────────────────────────────────────────────

function MetricsEditor({ campaign, onSave }) {
  const [open, setOpen] = useState(false);
  const [metrics, setMetrics] = useState({
    sentCount: campaign.sentCount || 0,
    deliveredCount: campaign.deliveredCount || 0,
    openedCount: campaign.openedCount || 0,
    clickedCount: campaign.clickedCount || 0,
    respondedCount: campaign.respondedCount || 0,
    convertedCount: campaign.convertedCount || 0,
    actualCost: campaign.actualCost || '',
    revenue: campaign.revenue || '',
  });

  if (!open) return <button onClick={() => setOpen(true)} className="text-sm text-blue-600 hover:underline">Update Metrics</button>;

  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {['sentCount', 'deliveredCount', 'openedCount', 'clickedCount', 'respondedCount', 'convertedCount'].map(key => (
          <div key={key}>
            <label className="block text-xs text-gray-500 mb-1 capitalize">{key.replace('Count', '')}</label>
            <input type="number" value={metrics[key]} onChange={e => setMetrics({ ...metrics, [key]: parseInt(e.target.value) || 0 })} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Actual Cost</label>
          <input type="number" value={metrics.actualCost} onChange={e => setMetrics({ ...metrics, actualCost: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Revenue</label>
          <input type="number" value={metrics.revenue} onChange={e => setMetrics({ ...metrics, revenue: e.target.value })} className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={() => setOpen(false)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
        <button onClick={() => { onSave(metrics); setOpen(false); }} className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">Save</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PIPELINES
// ══════════════════════════════════════════════════════════════════════════════

function PipelinesView({ pipelines, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', stages: [] });

  const defaultStages = [
    { name: 'Qualification', order: 1, probability: 10 },
    { name: 'Needs Analysis', order: 2, probability: 25 },
    { name: 'Proposal', order: 3, probability: 50 },
    { name: 'Negotiation', order: 4, probability: 75 },
    { name: 'Closed Won', order: 5, probability: 100 },
  ];

  function openCreate() {
    setEditId(null);
    setForm({ name: '', description: '', stages: defaultStages });
    setShowForm(true);
  }

  function openEdit(p) {
    setEditId(p.id);
    setForm({ name: p.name, description: p.description || '', stages: Array.isArray(p.stages) ? p.stages : defaultStages });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (editId) {
        await api.updatePipeline(editId, form);
      } else {
        await api.createPipeline(form);
      }
      setShowForm(false); onRefresh();
    } catch (err) { alert(err.message); }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this pipeline? This will fail if it has deals.')) return;
    try { await api.deletePipeline(id); onRefresh(); } catch (err) { alert(err.message); }
  }

  function updateStage(idx, field, value) {
    const updated = [...form.stages];
    updated[idx] = { ...updated[idx], [field]: field === 'probability' || field === 'order' ? Number(value) : value };
    setForm({ ...form, stages: updated });
  }

  function addStage() {
    setForm({ ...form, stages: [...form.stages, { name: '', order: form.stages.length + 1, probability: 50 }] });
  }

  function removeStage(idx) {
    setForm({ ...form, stages: form.stages.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 })) });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={openCreate} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus size={16} /> New Pipeline
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {pipelines.map(p => {
          const stages = Array.isArray(p.stages) ? p.stages : [];
          return (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    {p.name}
                    {p.isDefault && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">Default</span>}
                    {!p.isActive && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>}
                  </h3>
                  {p.description && <p className="text-xs text-gray-500 mt-1">{p.description}</p>}
                  <p className="text-xs text-gray-400 mt-1">{p._count?.deals || 0} total deals</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><Edit3 size={14} /></button>
                  <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="space-y-2">
                {stages.map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center text-xs font-semibold text-blue-600">{s.order}</div>
                    <div className="flex-1 flex items-center justify-between">
                      <span className="text-sm text-gray-700">{s.name}</span>
                      <span className="text-xs text-gray-400">{s.probability}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {pipelines.length === 0 && <div className="text-center py-12 col-span-2 bg-white border border-gray-200 rounded-xl"><TrendingUp size={32} className="mx-auto text-gray-300 mb-3" /><p className="text-gray-500 text-sm">No pipelines configured</p></div>}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editId ? 'Edit Pipeline' : 'New Pipeline'} width="max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Name *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Description</label><input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-gray-600">Stages</label>
              <button type="button" onClick={addStage} className="text-xs text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1"><Plus size={12} /> Add Stage</button>
            </div>
            <div className="space-y-2">
              {form.stages.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-5 text-center">{i + 1}</span>
                  <input value={s.name} onChange={e => updateStage(i, 'name', e.target.value)} placeholder="Stage name" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  <input type="number" value={s.probability} onChange={e => updateStage(i, 'probability', e.target.value)} className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm text-center" min={0} max={100} />
                  <span className="text-xs text-gray-400">%</span>
                  {form.stages.length > 1 && <button type="button" onClick={() => removeStage(i)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><X size={14} /></button>}
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">Cancel</button>
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">{editId ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
