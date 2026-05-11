import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { formatDateTime } from '../lib/format-date';
import { useSettings } from '../context/SettingsContext';
import {
  Megaphone, Plus, Trash2, Send, X, AlertTriangle, FileText, PartyPopper, Shield,
  Clock, ChevronDown, Users, User
} from 'lucide-react';

const TYPE_CONFIG = {
  general: { label: 'General', icon: Megaphone, color: 'blue', emoji: '📢' },
  official: { label: 'Official', icon: FileText, color: 'slate', emoji: '📋' },
  event: { label: 'Event', icon: PartyPopper, color: 'purple', emoji: '🎉' },
  urgent: { label: 'Urgent', icon: AlertTriangle, color: 'red', emoji: '🚨' },
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Notices() {
  const { user } = useAuth();
  const { dateFormat } = useSettings();
  const isAdmin = user?.role === 'admin';
  const [notices, setNotices] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [form, setForm] = useState({ title: '', body: '', type: 'general', target: 'all' });
  const [publishing, setPublishing] = useState(false);
  const [employees, setEmployees] = useState([]);

  const fetchNotices = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getNotices(100);
      setNotices(data.notices);
      setTotal(data.total);
    } catch (err) {
      console.error('Fetch notices error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotices();
    if (isAdmin) {
      api.getEmployees().then(data => setEmployees(data.employees || data)).catch(() => {});
    }
  }, [fetchNotices, isAdmin]);

  const handlePublish = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return;
    try {
      setPublishing(true);
      await api.publishNotice(form);
      setShowForm(false);
      setForm({ title: '', body: '', type: 'general', target: 'all' });
      fetchNotices();
    } catch (err) {
      alert(err.message);
    } finally {
      setPublishing(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this notice? All related notifications will also be removed.')) return;
    try {
      await api.deleteNotice(id);
      if (selectedNotice?.id === id) setSelectedNotice(null);
      fetchNotices();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notices</h1>
          <p className="text-sm text-slate-500 mt-1">
            {isAdmin ? 'Publish and manage official notices' : 'Official notices and announcements'}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition"
          >
            <Plus size={16} />
            Publish Notice
          </button>
        )}
      </div>

      {/* Publish Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Publish Notice</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handlePublish} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="Notice title..."
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
                  required
                  maxLength={200}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Message</label>
                <textarea
                  value={form.body}
                  onChange={e => setForm({ ...form, body: e.target.value })}
                  placeholder="Write your notice..."
                  rows={4}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition resize-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Type</label>
                  <select
                    value={form.type}
                    onChange={e => setForm({ ...form, type: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
                  >
                    {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                      <option key={key} value={key}>{cfg.emoji} {cfg.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Audience</label>
                  <select
                    value={form.target}
                    onChange={e => setForm({ ...form, target: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
                  >
                    <option value="all">All Employees</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={String(emp.id)}>{emp.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {form.type === 'urgent' && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg text-sm text-red-700">
                  <AlertTriangle size={16} />
                  Urgent notices will be highlighted and sent immediately
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={publishing}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition"
                >
                  {publishing ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  ) : (
                    <Send size={16} />
                  )}
                  Publish & Notify
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notice Detail Modal */}
      {selectedNotice && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedNotice(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                  ${selectedNotice.type === 'urgent' ? 'bg-red-100 text-red-700' :
                    selectedNotice.type === 'event' ? 'bg-purple-100 text-purple-700' :
                    selectedNotice.type === 'official' ? 'bg-slate-100 text-slate-700' :
                    'bg-blue-100 text-blue-700'}`}>
                  {TYPE_CONFIG[selectedNotice.type]?.emoji} {TYPE_CONFIG[selectedNotice.type]?.label}
                </span>
              </div>
              <button onClick={() => setSelectedNotice(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-2">{selectedNotice.title}</h2>
              <div className="flex items-center gap-3 text-xs text-slate-500 mb-4">
                <span className="flex items-center gap-1"><User size={12} /> {selectedNotice.published_by_name || 'Admin'}</span>
                <span className="flex items-center gap-1"><Clock size={12} /> {formatDateTime(selectedNotice.created_at, dateFormat)}</span>
              </div>
              <div className="prose prose-sm text-slate-700 whitespace-pre-wrap">{selectedNotice.body}</div>
            </div>
          </div>
        </div>
      )}

      {/* Notice List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
        </div>
      ) : notices.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <Megaphone size={48} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 font-medium">No notices yet</p>
          {isAdmin && <p className="text-sm text-slate-400 mt-1">Publish your first notice to notify all employees</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {notices.map(notice => {
            const cfg = TYPE_CONFIG[notice.type] || TYPE_CONFIG.general;
            return (
              <div
                key={notice.id}
                onClick={() => {
                  setSelectedNotice(notice);
                }}
                className={`bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-all cursor-pointer group
                  ${notice.type === 'urgent' ? 'border-l-4 border-l-red-500' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 p-2 rounded-lg
                    ${notice.type === 'urgent' ? 'bg-red-50' :
                      notice.type === 'event' ? 'bg-purple-50' :
                      notice.type === 'official' ? 'bg-slate-50' :
                      'bg-blue-50'}`}>
                    <cfg.icon size={18} className={
                      notice.type === 'urgent' ? 'text-red-600' :
                      notice.type === 'event' ? 'text-purple-600' :
                      notice.type === 'official' ? 'text-slate-600' :
                      'text-blue-600'
                    } />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-900 text-sm group-hover:text-primary-600 transition truncate">
                        {notice.title}
                      </h3>
                      <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium
                        ${notice.type === 'urgent' ? 'bg-red-100 text-red-700' :
                          notice.type === 'event' ? 'bg-purple-100 text-purple-700' :
                          notice.type === 'official' ? 'bg-slate-100 text-slate-600' :
                          'bg-blue-100 text-blue-700'}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 line-clamp-2">{notice.body}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                      <span>{notice.published_by_name || 'Admin'}</span>
                      <span>{timeAgo(notice.created_at)}</span>
                      {notice.target !== 'all' && (
                        <span className="flex items-center gap-1 text-amber-600">
                          <User size={10} /> Specific
                        </span>
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(notice.id); }}
                      className="shrink-0 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition opacity-0 group-hover:opacity-100"
                      title="Delete notice"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
