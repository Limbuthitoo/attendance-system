import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, LogIn, LogOut, AlertTriangle, CreditCard, X } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const STATUS_CONFIG = {
  CHECKED_IN: { icon: LogIn, color: 'text-green-600', bg: 'bg-green-50', badge: 'bg-green-500' },
  CHECKED_OUT: { icon: LogOut, color: 'text-blue-600', bg: 'bg-blue-50', badge: 'bg-blue-500' },
  UNKNOWN_CARD: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', badge: 'bg-red-500' },
  INACTIVE_CARD: { icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50', badge: 'bg-orange-500' },
  DUPLICATE_IGNORED: { icon: CreditCard, color: 'text-slate-500', bg: 'bg-slate-50', badge: 'bg-slate-400' },
};

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

export default function NotificationBell() {
  const [alerts, setAlerts] = useState([]);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const dropdownRef = useRef(null);
  const eventSourceRef = useRef(null);

  // Connect to SSE
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const url = `${API_BASE}/nfc/events`;
    const es = new EventSource(url, { withCredentials: false });

    // EventSource doesn't support custom headers, so we use a workaround:
    // Close the native EventSource and use fetch-based SSE instead.
    es.close();

    let controller = new AbortController();

    async function connectSSE() {
      try {
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (!response.ok) return;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                const alert = { ...data, id: Date.now() + Math.random() };
                setAlerts((prev) => [alert, ...prev].slice(0, 50));
                setUnread((prev) => prev + 1);

                // Browser notification for check-in/out
                if (data.status === 'CHECKED_IN' || data.status === 'CHECKED_OUT') {
                  if (Notification.permission === 'granted') {
                    new Notification('Archisys Attendance', { body: data.message, icon: '/favicon.ico' });
                  } else if (Notification.permission !== 'denied') {
                    Notification.requestPermission();
                  }
                }
              } catch {
                // ignore non-JSON data lines
              }
            }
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          // Reconnect after 5s on error
          setTimeout(connectSSE, 5000);
        }
      }
    }

    connectSSE();
    eventSourceRef.current = controller;

    return () => {
      controller.abort();
    };
  }, []);

  // Close dropdown on outside click
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
    setOpen((prev) => {
      if (!prev) setUnread(0);
      return !prev;
    });
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
    setUnread(0);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={handleToggle}
        className="relative p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        title="NFC Tap Alerts"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 animate-pulse">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-96 max-h-[480px] bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700">NFC Tap Alerts</h3>
            <div className="flex items-center gap-2">
              {alerts.length > 0 && (
                <button
                  onClick={clearAlerts}
                  className="text-xs text-slate-500 hover:text-red-600 transition-colors"
                >
                  Clear all
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Alert list */}
          <div className="overflow-y-auto max-h-[420px] divide-y divide-slate-100">
            {alerts.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                <Bell size={32} className="mx-auto mb-2 opacity-30" />
                <p>No tap alerts yet</p>
                <p className="text-xs mt-1">Alerts appear here in real-time when employees tap their NFC cards</p>
              </div>
            ) : (
              alerts.map((alert) => {
                const config = STATUS_CONFIG[alert.status] || STATUS_CONFIG.DUPLICATE_IGNORED;
                const Icon = config.icon;
                return (
                  <div key={alert.id} className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors`}>
                    <div className={`mt-0.5 p-1.5 rounded-lg ${config.bg}`}>
                      <Icon size={16} className={config.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${config.badge}`} />
                        <span className="text-sm font-medium text-slate-800 truncate">
                          {alert.employee || 'Unknown'}
                        </span>
                        {alert.empCode && (
                          <span className="text-xs text-slate-400">{alert.empCode}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">{alert.message}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-slate-400">{formatTime(alert.time)}</span>
                        {alert.late && (
                          <span className="text-[10px] font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">LATE</span>
                        )}
                        {alert.workHours && (
                          <span className="text-[10px] text-slate-400">{alert.workHours}h worked</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
