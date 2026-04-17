import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, CheckCheck, Megaphone, ClipboardCheck, Calendar, Settings2 } from 'lucide-react';
import { api } from '../lib/api';

const TYPE_ICON = {
  notice: Megaphone,
  leave: ClipboardCheck,
  design_task: Calendar,
  system: Settings2,
};

const TYPE_COLOR = {
  notice: { text: 'text-blue-600', bg: 'bg-blue-50' },
  leave: { text: 'text-amber-600', bg: 'bg-amber-50' },
  design_task: { text: 'text-purple-600', bg: 'bg-purple-50' },
  system: { text: 'text-slate-600', bg: 'bg-slate-50' },
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

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await api.getUnreadCount();
      setUnreadCount(data.count);
    } catch {
      // ignore
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getNotifications(30);
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll unread count every 30 seconds
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Fetch full list when dropdown opens
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = useCallback(() => {
    setOpen(prev => !prev);
  }, []);

  const handleNotificationClick = async (notif) => {
    if (!notif.is_read) {
      await api.markNotificationRead(notif.id).catch(() => {});
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: 1 } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    if (notif.reference_type === 'notice') {
      navigate('/notices');
    } else if (notif.type === 'leave') {
      navigate('/leaves');
    } else if (notif.type === 'design_task') {
      navigate('/leave-calendar');
    }
    setOpen(false);
  };

  const handleMarkAllRead = async () => {
    await api.markAllNotificationsRead().catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    setUnreadCount(0);
  };

  const handleClearAll = async () => {
    await api.clearAllNotifications().catch(() => {});
    setNotifications([]);
    setUnreadCount(0);
  };

  const handleClearOne = async (e, id) => {
    e.stopPropagation();
    await api.clearNotification(id).catch(() => {});
    const removed = notifications.find(n => n.id === id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (removed && !removed.is_read) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleToggle}
        className="relative p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        title="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-h-[520px] bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700">Notifications</h3>
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <>
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs text-slate-500 hover:text-primary-600 transition-colors flex items-center gap-1"
                    title="Mark all as read"
                  >
                    <CheckCheck size={12} /> Read all
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={handleClearAll}
                    className="text-xs text-slate-500 hover:text-red-600 transition-colors"
                  >
                    Clear all
                  </button>
                </>
              )}
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 ml-1">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-[460px] divide-y divide-slate-100">
            {loading && notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-600 border-t-transparent mx-auto" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                <Bell size={32} className="mx-auto mb-2 opacity-30" />
                <p>No notifications</p>
                <p className="text-xs mt-1">You're all caught up!</p>
              </div>
            ) : (
              notifications.map(notif => {
                const Icon = TYPE_ICON[notif.type] || Bell;
                const color = TYPE_COLOR[notif.type] || TYPE_COLOR.system;
                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors group
                      ${notif.is_read ? 'hover:bg-slate-50' : 'bg-primary-50/40 hover:bg-primary-50/60'}`}
                  >
                    <div className={`mt-0.5 p-1.5 rounded-lg ${color.bg}`}>
                      <Icon size={16} className={color.text} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {!notif.is_read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0" />
                        )}
                        <p className={`text-sm truncate ${notif.is_read ? 'text-slate-700' : 'text-slate-900 font-medium'}`}>
                          {notif.title}
                        </p>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notif.body}</p>
                      <span className="text-[10px] text-slate-400 mt-1 block">{timeAgo(notif.created_at)}</span>
                    </div>
                    <button
                      onClick={(e) => handleClearOne(e, notif.id)}
                      className="shrink-0 p-1 text-slate-300 hover:text-red-500 rounded transition opacity-0 group-hover:opacity-100"
                      title="Clear"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-slate-200 px-4 py-2 bg-slate-50">
              <button
                onClick={() => { navigate('/notices'); setOpen(false); }}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                View all notices →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
