import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  adToBs, bsToAd, getBsMonthDays, getBsDayOfWeek, getTodayBs,
  formatBsDate, toNepaliNumeral, BS_MONTHS, BS_MONTHS_NP, WEEKDAYS_SHORT, WEEKDAYS_SHORT_NP
} from '../lib/bs-date';
import { getEventForDate } from '../lib/nepal-events';
import { ChevronLeft, ChevronRight, Calendar, Filter, X, Star, Printer, Palette } from 'lucide-react';

export default function LeaveCalendar() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const todayBs = getTodayBs();
  const [currentYear, setCurrentYear] = useState(2083);
  const [currentMonth, setCurrentMonth] = useState(todayBs.year === 2083 ? todayBs.month : 1);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('monthly'); // monthly, notice
  const [selectedDay, setSelectedDay] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [apiHolidays, setApiHolidays] = useState([]);
  const [designEvents, setDesignEvents] = useState([]);

  // Load holidays from API
  useEffect(() => {
    api.getHolidays(currentYear).then(data => setApiHolidays(data.holidays || [])).catch(() => {});
  }, [currentYear]);

  // Load design task events
  useEffect(() => {
    api.getDesignEvents(currentYear).then(data => setDesignEvents(data.events || [])).catch(() => {});
  }, [currentYear]);

  // Build holiday lookup from API data
  const holidayMap = useMemo(() => {
    const map = {};
    apiHolidays.forEach(h => {
      // Single-day holiday
      if (!h.bs_day_end) {
        const key = `${h.bs_month}-${h.bs_day}`;
        map[key] = { name: h.name, nameNp: h.name_np || h.name };
      } else {
        // Multi-day: expand all days
        const endMonth = h.bs_month_end || h.bs_month;
        if (h.bs_month === endMonth) {
          for (let d = h.bs_day; d <= h.bs_day_end; d++) {
            map[`${h.bs_month}-${d}`] = { name: h.name, nameNp: h.name_np || h.name };
          }
        } else {
          // Spans two months
          const daysInStartMonth = getBsMonthDays(currentYear, h.bs_month);
          for (let d = h.bs_day; d <= daysInStartMonth; d++) {
            map[`${h.bs_month}-${d}`] = { name: h.name, nameNp: h.name_np || h.name };
          }
          for (let d = 1; d <= h.bs_day_end; d++) {
            map[`${endMonth}-${d}`] = { name: h.name, nameNp: h.name_np || h.name };
          }
        }
      }
    });
    return map;
  }, [apiHolidays, currentYear]);

  // Load all leaves for the visible range
  useEffect(() => {
    loadLeaves();
  }, [currentYear, currentMonth, filterStatus]);

  const loadLeaves = async () => {
    setLoading(true);
    try {
      let data;
      if (isAdmin) {
        data = await api.getAllLeaves(filterStatus || undefined);
      } else {
        data = await api.getMyLeaves(filterStatus || undefined);
      }
      setLeaves(data.leaves || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Build design event lookup by AD date
  const designEventMap = useMemo(() => {
    const map = {};
    designEvents.forEach(e => {
      if (e.event_date) {
        if (!map[e.event_date]) map[e.event_date] = [];
        map[e.event_date].push(e);
      }
    });
    return map;
  }, [designEvents]);

  // Build calendar grid for current BS month
  const calendarGrid = useMemo(() => {
    const daysInMonth = getBsMonthDays(currentYear, currentMonth);
    const firstDayOfWeek = getBsDayOfWeek(currentYear, currentMonth, 1);
    const grid = [];

    // Empty cells for days before the 1st
    for (let i = 0; i < firstDayOfWeek; i++) {
      grid.push(null);
    }

    const AD_MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let d = 1; d <= daysInMonth; d++) {
      const adDate = bsToAd(currentYear, currentMonth, d);
      const adStr = adDate.toISOString().split('T')[0];
      const adDay = adDate.getDate();
      const adMonth = adDate.getMonth(); // 0-indexed
      const adMonthName = AD_MONTH_ABBR[adMonth];
      const adYear = adDate.getFullYear();
      const holiday = holidayMap[`${currentMonth}-${d}`] || null;
      const event = getEventForDate(currentYear, currentMonth, d);
      const dayOfWeek = (firstDayOfWeek + d - 1) % 7;
      const isSaturday = dayOfWeek === 6;
      const isToday = currentYear === todayBs.year && currentMonth === todayBs.month && d === todayBs.day;
      const designTasks = designEventMap[adStr] || [];

      grid.push({ day: d, adDate: adStr, adDay, adMonth, adMonthName, adYear, holiday, event, isSaturday, isToday, dayOfWeek, designTasks });
    }

    return grid;
  }, [currentYear, currentMonth, holidayMap, designEventMap]);

  // Map leaves to AD dates for lookup
  const leaveDateMap = useMemo(() => {
    const map = {};
    leaves.forEach(leave => {
      const start = new Date(leave.start_date + 'T00:00:00');
      const end = new Date(leave.end_date + 'T00:00:00');
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().split('T')[0];
        if (!map[key]) map[key] = [];
        map[key].push(leave);
      }
    });
    return map;
  }, [leaves]);

  // Get leaves for a specific AD date string
  const getLeavesForDate = (adDateStr) => leaveDateMap[adDateStr] || [];

  // Employee filter (admin only)
  const filteredLeaves = useMemo(() => {
    if (!filterEmployee) return leaves;
    return leaves.filter(l =>
      (l.name || '').toLowerCase().includes(filterEmployee.toLowerCase()) ||
      (l.emp_code || '').toLowerCase().includes(filterEmployee.toLowerCase())
    );
  }, [leaves, filterEmployee]);

  // Navigation
  const goToPrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentYear(y => y - 1);
      setCurrentMonth(12);
    } else {
      setCurrentMonth(m => m - 1);
    }
    setSelectedWeek(null);
    setSelectedDay(null);
  };

  const goToNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentYear(y => y + 1);
      setCurrentMonth(1);
    } else {
      setCurrentMonth(m => m + 1);
    }
    setSelectedWeek(null);
    setSelectedDay(null);
  };

  const goToToday = () => {
    setCurrentYear(todayBs.year);
    setCurrentMonth(todayBs.month);
    setSelectedWeek(null);
    setSelectedDay(null);
  };

  // Status colors
  const leaveStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'bg-emerald-500';
      case 'pending': return 'bg-amber-400';
      case 'rejected': return 'bg-red-400';
      default: return 'bg-slate-400';
    }
  };

  const leaveTypeBadge = (type) => {
    const colors = {
      sick: 'bg-red-100 text-red-700',
      casual: 'bg-blue-100 text-blue-700',
      earned: 'bg-purple-100 text-purple-700',
      unpaid: 'bg-slate-100 text-slate-700',
      other: 'bg-teal-100 text-teal-700',
    };
    return colors[type] || 'bg-slate-100 text-slate-700';
  };

  const statusBadge = (status) => {
    const styles = {
      pending: 'bg-amber-100 text-amber-700',
      approved: 'bg-emerald-100 text-emerald-700',
      rejected: 'bg-red-100 text-red-700',
    };
    return (
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${styles[status]}`}>
        {status}
      </span>
    );
  };

  const holidays = useMemo(() => {
    return apiHolidays.filter(h => {
      if (h.bs_month === currentMonth) return true;
      // Multi-day spanning into this month
      if (h.bs_month_end === currentMonth && h.bs_day_end) return true;
      return false;
    }).map(h => ({
      day: h.bs_month === currentMonth ? h.bs_day : 1,
      name: h.name,
      nameNp: h.name_np || h.name,
    }));
  }, [apiHolidays, currentMonth]);

  // Compute AD date range for the current BS month
  const adRangeStr = useMemo(() => {
    const AD_MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const firstAd = bsToAd(currentYear, currentMonth, 1);
    const lastAd = bsToAd(currentYear, currentMonth, getBsMonthDays(currentYear, currentMonth));
    const fm = AD_MONTHS_FULL[firstAd.getMonth()];
    const lm = AD_MONTHS_FULL[lastAd.getMonth()];
    if (firstAd.getFullYear() !== lastAd.getFullYear()) {
      return `${fm} ${firstAd.getFullYear()} – ${lm} ${lastAd.getFullYear()}`;
    }
    if (fm === lm) return `${fm} ${firstAd.getFullYear()}`;
    return `${fm} – ${lm} ${firstAd.getFullYear()}`;
  }, [currentYear, currentMonth]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Monthly Calendar</h1>
          <p className="text-sm text-slate-500 mt-1">
            बि.सं. {toNepaliNumeral(currentYear)} • {BS_MONTHS_NP[currentMonth - 1]} ({BS_MONTHS[currentMonth - 1]})
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-2">
          {['monthly', 'notice'].map(mode => (
            <button
              key={mode}
              onClick={() => { setViewMode(mode); setSelectedDay(null); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                viewMode === mode
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {mode === 'notice' ? 'Holiday Notice' : 'Monthly'}
            </button>
          ))}
        </div>
      </div>

      {/* Holiday Notice View */}
      {viewMode === 'notice' && (
        <div>
          <style>{`
            @media print {
              /* Hide sidebar, header, and non-notice content */
              aside, nav, header, .no-print { display: none !important; }
              /* Reset the layout container */
              body, #root, #root > * { 
                margin: 0 !important; 
                padding: 0 !important; 
                width: 100% !important;
                max-width: 100% !important;
              }
              /* Make the notice fill the page */
              .print-notice {
                box-shadow: none !important;
                border: none !important;
                border-radius: 0 !important;
                max-width: 100% !important;
                margin: 0 !important;
              }
              @page { margin: 15mm; }
            }
          `}</style>

          <div className="no-print mb-4 flex justify-end gap-3">
            <button
              onClick={() => {
                const notice = document.querySelector('.print-notice');
                if (!notice) return;
                const win = window.open('', '_blank');
                win.document.write(`
                  <!DOCTYPE html>
                  <html>
                  <head>
                    <title>Holiday Notice - FY ${currentYear} BS</title>
                    <style>
                      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 10mm 12mm; color: #0f172a; font-size: 11px; }
                      table { width: 100%; border-collapse: collapse; font-size: 11px; }
                      th { background: #0f172a; color: white; padding: 5px 8px; text-align: center; border: 1px solid #cbd5e1; font-size: 11px; }
                      td { padding: 5px 8px; text-align: center; border: 1px solid #cbd5e1; }
                      tr:nth-child(even) { background: #f8fafc; }
                      .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 12px; }
                      .header h1 { font-size: 18px; letter-spacing: 1px; text-transform: uppercase; margin: 0; }
                      .header p { color: #64748b; font-size: 11px; margin: 2px 0 0; }
                      h2 { text-align: center; font-size: 15px; letter-spacing: 1px; margin: 12px 0 8px; }
                      .subject { font-size: 12px; margin-bottom: 6px; }
                      .body-text { font-size: 11px; line-height: 1.5; color: #334155; margin-bottom: 12px; }
                      .notes { margin: 12px 0; }
                      .notes p { font-weight: bold; font-size: 11px; margin-bottom: 4px; }
                      .notes li { font-size: 11px; color: #334155; margin-bottom: 2px; }
                      .signature { text-align: right; margin-top: 30px; }
                      .signature .line { display: inline-block; width: 180px; border-top: 1px solid #94a3b8; padding-top: 6px; text-align: center; }
                      .signature .name { font-size: 12px; font-weight: 600; }
                      .signature .dept { font-size: 10px; color: #64748b; }
                      .no-print { display: none !important; }
                      @page { size: A4; margin: 10mm; }
                      @media print { body { margin: 0; } }
                    </style>
                  </head>
                  <body>
                    ${notice.innerHTML}
                    <script>window.onload = function() { window.print(); }<\/script>
                  </body>
                  </html>
                `);
                win.document.close();
              }}
              className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition"
            >
              <Printer size={18} />
              Print / Save as PDF
            </button>
          </div>

          <div className="print-notice bg-white max-w-4xl mx-auto rounded-xl shadow-sm border border-slate-200">
            <div className="p-10 md:p-14">
              <div className="header text-center mb-8 border-b-2 border-slate-800 pb-6">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <img src="/favicon.svg" alt="Logo" className="w-10 h-10 rounded-lg no-print" />
                  <h1 className="text-2xl font-bold text-slate-900 tracking-wide uppercase">Archisys Innovations</h1>
                </div>
                <p className="text-sm text-slate-500">Attendance Management System</p>
              </div>

              <h2 className="text-xl font-bold text-center text-slate-900 mb-6 tracking-wide">OFFICIAL NOTICE</h2>

              <p className="subject text-sm text-slate-800 mb-4">
                <span className="font-bold">Subject:</span> Public Holiday Schedule for Fiscal Year {currentYear} B.S.
              </p>

              <p className="body-text text-sm text-slate-700 leading-relaxed mb-8">
                This is to inform all employees that the following public holidays have been approved for the
                fiscal year {currentYear} B.S. The schedule reflects major national, cultural, and religious observances
                while ensuring continuity of business operations. All employees are requested to plan their
                responsibilities accordingly and coordinate with their respective teams to maintain smooth
                workflow during these periods.
              </p>

              <div className="overflow-x-auto mb-8">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-900 text-white">
                      <th className="border border-slate-300 px-4 py-3 text-center font-semibold w-14">S.N.</th>
                      <th className="border border-slate-300 px-4 py-3 text-center font-semibold">Holiday</th>
                      <th className="border border-slate-300 px-4 py-3 text-center font-semibold">BS Date</th>
                      <th className="border border-slate-300 px-4 py-3 text-center font-semibold">AD Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apiHolidays.map((h, i) => {
                      const bsDate = h.bs_day_end
                        ? `${h.bs_year}-${String(h.bs_month).padStart(2, '0')}-${String(h.bs_day).padStart(2, '0')} to ${h.bs_year}-${String(h.bs_month_end || h.bs_month).padStart(2, '0')}-${String(h.bs_day_end).padStart(2, '0')}`
                        : `${h.bs_year}-${String(h.bs_month).padStart(2, '0')}-${String(h.bs_day).padStart(2, '0')}`;
                      const adDate = h.ad_date_end
                        ? `${h.ad_date} – ${h.ad_date_end}`
                        : h.ad_date || '—';
                      return (
                        <tr key={h.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="border border-slate-300 px-4 py-3 text-center font-medium text-slate-700">{i + 1}</td>
                          <td className="border border-slate-300 px-4 py-3 text-center font-medium text-slate-900">{h.name}</td>
                          <td className="border border-slate-300 px-4 py-3 text-center text-slate-700">{bsDate}</td>
                          <td className="border border-slate-300 px-4 py-3 text-center text-slate-700">{adDate}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="notes mb-10">
                <p className="text-sm font-bold text-slate-900 mb-2">Notes:</p>
                <ul className="text-sm text-slate-700 space-y-1.5 list-disc list-inside">
                  <li>Saturdays shall remain weekly holidays.</li>
                  <li>Holidays falling on weekends shall not be substituted unless otherwise notified.</li>
                  <li>Festival dates are subject to change as per official lunar calendar confirmations.</li>
                  <li>The management reserves the right to make necessary amendments if required.</li>
                </ul>
              </div>

              <div className="signature flex justify-end mt-16">
                <div className="text-center">
                  <div className="line w-48 border-t border-slate-400 pt-2">
                    <p className="name text-sm font-semibold text-slate-900">Authorized Signatory</p>
                    <p className="dept text-xs text-slate-500">Human Resources Department</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      {viewMode !== 'notice' && <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Status filter */}
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* Employee search (admin) */}
          {isAdmin && (
            <input
              type="text"
              placeholder="Search employee..."
              value={filterEmployee}
              onChange={e => setFilterEmployee(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 w-48"
            />
          )}

          {filterEmployee && (
            <button onClick={() => setFilterEmployee('')} className="text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          )}
        </div>
      </div>}

      {/* Calendar + Sidebar layout */}
      {viewMode !== 'notice' && <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Calendar */}
        <div className="xl:col-span-3 bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Month navigation */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <button onClick={goToPrevMonth} className="p-2.5 rounded-lg hover:bg-slate-100 transition">
                <ChevronLeft size={22} className="text-slate-600" />
              </button>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-slate-900">
                  {BS_MONTHS_NP[currentMonth - 1]} {toNepaliNumeral(currentYear)}
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">{BS_MONTHS[currentMonth - 1]} {currentYear} • {adRangeStr}</p>
                <button onClick={goToToday} className="text-xs text-primary-600 hover:underline mt-1">
                  Go to Today
                </button>
              </div>
              <button onClick={goToNextMonth} className="p-2.5 rounded-lg hover:bg-slate-100 transition">
                <ChevronRight size={22} className="text-slate-600" />
              </button>
            </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
              {WEEKDAYS_SHORT.map((day, i) => (
                <div
                  key={day}
                  className={`text-center py-3 ${
                    i === 6 ? 'text-red-500' : 'text-slate-600'
                  }`}
                >
                  <div className="text-base font-bold">{WEEKDAYS_SHORT_NP[i]}</div>
                  <div className="text-xs text-slate-400">{day}</div>
                </div>
              ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
              {calendarGrid.map((cell, idx) => {
                if (!cell) {
                  return <div key={`empty-${idx}`} className="min-h-[120px] border-b border-r border-slate-100 bg-slate-50/30" />;
                }

                const dayLeaves = getLeavesForDate(cell.adDate);
                const filtered = filterEmployee
                  ? dayLeaves.filter(l => (l.name || '').toLowerCase().includes(filterEmployee.toLowerCase()) || (l.emp_code || '').toLowerCase().includes(filterEmployee.toLowerCase()))
                  : dayLeaves;

                return (
                  <div
                    key={cell.day}
                    onClick={() => setSelectedDay(selectedDay === cell.day ? null : cell.day)}
                    className={`min-h-[120px] border-b border-r border-slate-100 p-2 cursor-pointer transition-colors hover:bg-blue-50/40 ${
                      cell.isToday ? 'bg-primary-50/60' : ''
                    } ${cell.isSaturday ? 'bg-red-50/30' : ''}
                    ${selectedDay === cell.day ? 'ring-2 ring-primary-500 ring-inset bg-primary-50/40' : ''}`}
                  >
                    {/* Day numbers — BS in Nepali (prominent), AD small */}
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="flex flex-col">
                        <span className={`text-2xl font-bold leading-none ${
                          cell.isToday
                            ? 'bg-primary-600 text-white w-9 h-9 rounded-full flex items-center justify-center text-xl'
                            : cell.isSaturday ? 'text-red-500'
                            : cell.holiday ? 'text-red-500'
                            : 'text-slate-900'
                        }`}>
                          {toNepaliNumeral(cell.day)}
                        </span>
                        <span className="text-[11px] text-slate-400 mt-0.5 leading-none">
                          {cell.adMonthName} {cell.adDay}
                        </span>
                      </div>
                      {cell.holiday && (
                        <Star size={14} className="text-amber-500 fill-amber-500 mt-0.5" />
                      )}
                    </div>

                    {/* Holiday label */}
                    {cell.holiday && (
                      <div className="text-xs text-red-500 font-medium truncate mb-0.5" title={cell.holiday.name}>
                        {cell.holiday.nameNp}
                      </div>
                    )}

                    {/* Event label (from hamropatro) */}
                    {cell.event && !cell.holiday && (
                      <div className="text-[10px] text-blue-600 truncate mb-0.5" title={cell.event}>
                        {cell.event}
                      </div>
                    )}

                    {/* Design task events */}
                    {cell.designTasks.length > 0 && (
                      <div className="space-y-0.5 mb-0.5">
                        {cell.designTasks.slice(0, 1).map(dt => (
                          <div key={dt.id} className="flex items-center gap-1 text-[10px] text-purple-700 bg-purple-50 rounded px-1 py-0.5 truncate" title={dt.event_name}>
                            <span className="shrink-0">🎨</span>
                            <span className="truncate">{dt.event_name}</span>
                          </div>
                        ))}
                        {cell.designTasks.length > 1 && (
                          <div className="text-[9px] text-purple-500 pl-1">+{cell.designTasks.length - 1} more</div>
                        )}
                      </div>
                    )}

                    {/* Leave indicators */}
                    <div className="space-y-1">
                      {filtered.slice(0, 2).map((leave, i) => (
                        <div
                          key={leave.id || i}
                          className={`text-xs px-1.5 py-1 rounded-md truncate font-medium ${
                            leave.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : leave.status === 'pending'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                          title={`${isAdmin ? (leave.name || '') + ' — ' : ''}${leave.leave_type} (${leave.status})`}
                        >
                          {isAdmin ? leave.name?.split(' ')[0] : leave.leave_type}
                        </div>
                      ))}
                      {filtered.length > 2 && (
                        <div className="text-xs text-slate-500 font-medium pl-1">+{filtered.length - 2} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-5 px-6 py-3.5 border-t border-slate-200 bg-slate-50">
            <span className="text-sm text-slate-500 font-medium">Legend:</span>
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded bg-emerald-100 border border-emerald-300" />
              <span className="text-sm text-slate-600">Approved</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded bg-amber-100 border border-amber-300" />
              <span className="text-sm text-slate-600">Pending</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3.5 h-3.5 rounded bg-red-100 border border-red-300" />
              <span className="text-sm text-slate-600">Rejected</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Star size={13} className="text-amber-500 fill-amber-500" />
              <span className="text-sm text-slate-600">Holiday</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-red-500 font-semibold">Sat</span>
              <span className="text-sm text-slate-600">= Weekend</span>
            </div>
            {designEvents.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 rounded bg-purple-100 border border-purple-300 flex items-center justify-center text-[8px]">🎨</div>
                <span className="text-sm text-slate-600">Design Task</span>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar — Day detail + Holidays */}
        <div className="space-y-5">
          {/* Selected day detail */}
          {selectedDay && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-bold text-slate-900 text-lg mb-1">
                {toNepaliNumeral(selectedDay)} {BS_MONTHS_NP[currentMonth - 1]} {toNepaliNumeral(currentYear)}
              </h3>
              <p className="text-xs text-slate-400 mb-1">{selectedDay} {BS_MONTHS[currentMonth - 1]} {currentYear}</p>
              {(() => {
                const cell = calendarGrid.find(c => c && c.day === selectedDay);
                if (!cell) return null;
                const adDateObj = new Date(cell.adDate + 'T00:00:00');
                const adFormatted = adDateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                return <p className="text-sm text-slate-400 mb-4">{adFormatted}</p>;
              })()}
              {(() => {
                const cell = calendarGrid.find(c => c && c.day === selectedDay);
                if (!cell) return null;
                const dayLeaves = getLeavesForDate(cell.adDate);
                const filtered = filterEmployee
                  ? dayLeaves.filter(l => (l.name || '').toLowerCase().includes(filterEmployee.toLowerCase()))
                  : dayLeaves;

                return (
                  <>
                    {cell.holiday && (
                      <div className="flex items-center gap-3 mb-3 p-3 bg-amber-50 rounded-lg">
                        <Star size={18} className="text-amber-500 fill-amber-500 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-amber-700">{cell.holiday.name}</p>
                          <p className="text-sm text-amber-600">{cell.holiday.nameNp}</p>
                        </div>
                      </div>
                    )}
                    {cell.event && !cell.holiday && (
                      <div className="mb-3 p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm font-medium text-blue-700">{cell.event}</p>
                      </div>
                    )}
                    {cell.designTasks && cell.designTasks.length > 0 && (
                      <div className="mb-3 space-y-2">
                        {cell.designTasks.map(dt => (
                          <div key={dt.id} className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg">
                            <Palette size={18} className="text-purple-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-semibold text-purple-700">{dt.event_name}</p>
                              <p className="text-xs text-purple-500 capitalize">{dt.category} • {dt.status || 'pending'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {cell.isSaturday && (
                      <p className="text-sm text-red-500 font-medium mb-3">Saturday — Weekend</p>
                    )}
                    {filtered.length === 0 ? (
                      <p className="text-sm text-slate-400">No leaves on this day</p>
                    ) : (
                      <div className="space-y-3">
                        {filtered.map(leave => (
                          <div key={leave.id} className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                            {isAdmin && <p className="text-sm font-semibold text-slate-800">{leave.name}</p>}
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${leaveTypeBadge(leave.leave_type)}`}>
                                {leave.leave_type}
                              </span>
                              {statusBadge(leave.status)}
                            </div>
                            <p className="text-sm text-slate-500 mt-2 line-clamp-2">{leave.reason}</p>
                            <p className="text-xs text-slate-400 mt-1">
                              {formatBsDate(adToBs(leave.start_date))} — {formatBsDate(adToBs(leave.end_date))}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* Holidays this month */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-bold text-slate-900 text-base mb-4 flex items-center gap-2">
              <Calendar size={18} className="text-primary-600" />
              बिदाहरू — {BS_MONTHS_NP[currentMonth - 1]}
            </h3>
            {holidays.length === 0 ? (
              <p className="text-sm text-slate-400">No public holidays this month</p>
            ) : (
              <div className="space-y-2.5">
                {holidays.map((h, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition cursor-pointer"
                    onClick={() => setSelectedDay(h.day)}
                  >
                    <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                      <span className="text-base font-bold text-red-600">{toNepaliNumeral(h.day)}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">{h.name}</p>
                      <p className="text-sm text-slate-400">{h.nameNp}</p>
                      <p className="text-xs text-slate-300">
                        {(() => {
                          const ad = bsToAd(currentYear, currentMonth, h.day);
                          return ad.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                        })()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Monthly summary */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-bold text-slate-900 text-base mb-4">मासिक सारांश</h3>
            {(() => {
              const monthLeaves = leaves.filter(l => {
                const adFirst = bsToAd(currentYear, currentMonth, 1).toISOString().split('T')[0];
                const adLast = bsToAd(currentYear, currentMonth, getBsMonthDays(currentYear, currentMonth)).toISOString().split('T')[0];
                return l.start_date <= adLast && l.end_date >= adFirst;
              });
              const approved = monthLeaves.filter(l => l.status === 'approved').length;
              const pending = monthLeaves.filter(l => l.status === 'pending').length;
              const rejected = monthLeaves.filter(l => l.status === 'rejected').length;

              return (
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 rounded-lg bg-emerald-50">
                    <p className="text-2xl font-bold text-emerald-700">{approved}</p>
                    <p className="text-xs font-medium text-emerald-600 mt-1">Approved</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-amber-50">
                    <p className="text-2xl font-bold text-amber-700">{pending}</p>
                    <p className="text-xs font-medium text-amber-600 mt-1">Pending</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-red-50">
                    <p className="text-2xl font-bold text-red-700">{rejected}</p>
                    <p className="text-xs font-medium text-red-600 mt-1">Rejected</p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>}
    </div>
  );
}
