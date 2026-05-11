import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar, X, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { adToBs, bsToAd, getBsMonthDays, getBsDayOfWeek, BS_MONTHS, BS_CALENDAR_DATA } from '../lib/bs-date';

const AD_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const BS_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const AD_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const BS_YEAR_MIN = 2070;
const BS_YEAR_MAX = 2090;

export default function DatePicker({ value, onChange, placeholder = 'Select date', required, disabled, className = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { dateFormat } = useSettings();
  const mode = dateFormat || 'AD'; // AD | BS | BOTH

  const today = new Date();
  const todayBs = useMemo(() => adToBs(today), []);
  const selected = value ? new Date(value + 'T00:00:00') : null;
  const selectedBs = useMemo(() => selected ? adToBs(selected) : null, [value]);

  // View state — always track both AD and BS view
  const [viewYear, setViewYear] = useState(() => {
    if (mode === 'AD') return selected?.getFullYear() || today.getFullYear();
    const bs = selectedBs || todayBs;
    return bs.year;
  });
  const [viewMonth, setViewMonth] = useState(() => {
    if (mode === 'AD') return selected?.getMonth() ?? today.getMonth();
    const bs = selectedBs || todayBs;
    return bs.month - 1; // 0-indexed for consistency
  });

  // Reset view when opened
  useEffect(() => {
    if (open) {
      if (mode === 'AD') {
        setViewYear(selected?.getFullYear() || today.getFullYear());
        setViewMonth(selected?.getMonth() ?? today.getMonth());
      } else {
        const bs = selectedBs || todayBs;
        setViewYear(bs.year);
        setViewMonth(bs.month - 1);
      }
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ─── AD Calendar helpers ─────────────────────────────────────────────
  const adFirstDay = new Date(viewYear, viewMonth, 1).getDay();
  const adDaysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  // ─── BS Calendar helpers ─────────────────────────────────────────────
  const bsMonth1 = viewMonth + 1; // 1-indexed
  const bsDaysInMonth = (mode !== 'AD' && BS_CALENDAR_DATA[viewYear]) ? getBsMonthDays(viewYear, bsMonth1) : 30;
  const bsFirstDay = (mode !== 'AD' && BS_CALENDAR_DATA[viewYear]) ? getBsDayOfWeek(viewYear, bsMonth1, 1) : 0;

  // Navigation
  const prevMonth = () => {
    if (viewMonth === 0) {
      const prevYear = viewYear - 1;
      if (mode !== 'AD' && prevYear < BS_YEAR_MIN) return;
      setViewMonth(11);
      setViewYear(prevYear);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      const nextYear = viewYear + 1;
      if (mode !== 'AD' && nextYear > BS_YEAR_MAX) return;
      setViewMonth(0);
      setViewYear(nextYear);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };
  const prevYear = () => {
    const py = viewYear - 1;
    if (mode !== 'AD' && py < BS_YEAR_MIN) return;
    setViewYear(py);
  };
  const nextYear = () => {
    const ny = viewYear + 1;
    if (mode !== 'AD' && ny > BS_YEAR_MAX) return;
    setViewYear(ny);
  };

  // Select a day — always outputs AD YYYY-MM-DD
  const selectDay = (day) => {
    if (mode === 'AD') {
      const m = String(viewMonth + 1).padStart(2, '0');
      const d = String(day).padStart(2, '0');
      onChange(`${viewYear}-${m}-${d}`);
    } else {
      // Convert BS to AD
      const ad = bsToAd(viewYear, bsMonth1, day);
      const y = ad.getFullYear();
      const m = String(ad.getMonth() + 1).padStart(2, '0');
      const d = String(ad.getDate()).padStart(2, '0');
      onChange(`${y}-${m}-${d}`);
    }
    setOpen(false);
  };

  const goToday = () => {
    if (mode === 'AD') {
      setViewYear(today.getFullYear());
      setViewMonth(today.getMonth());
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      onChange(`${today.getFullYear()}-${m}-${d}`);
    } else {
      setViewYear(todayBs.year);
      setViewMonth(todayBs.month - 1);
      const ad = today;
      const m = String(ad.getMonth() + 1).padStart(2, '0');
      const d = String(ad.getDate()).padStart(2, '0');
      onChange(`${ad.getFullYear()}-${m}-${d}`);
    }
    setOpen(false);
  };

  // ─── Checked state helpers ───────────────────────────────────────────
  const isSelectedDay = (day) => {
    if (!selected) return false;
    if (mode === 'AD') {
      return selected.getFullYear() === viewYear && selected.getMonth() === viewMonth && selected.getDate() === day;
    }
    return selectedBs && selectedBs.year === viewYear && selectedBs.month === bsMonth1 && selectedBs.day === day;
  };

  const isTodayDay = (day) => {
    if (mode === 'AD') {
      return today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;
    }
    return todayBs.year === viewYear && todayBs.month === bsMonth1 && todayBs.day === day;
  };

  // ─── Display value ──────────────────────────────────────────────────
  const displayValue = useMemo(() => {
    if (!selected) return '';
    if (mode === 'AD') {
      return selected.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    const bs = selectedBs;
    if (!bs) return '';
    const bsStr = `${bs.day} ${BS_MONTHS[bs.month - 1]} ${bs.year}`;
    if (mode === 'BS') return bsStr;
    // BOTH
    const adStr = selected.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${bsStr} / ${adStr}`;
  }, [value, mode]);

  // Sub-label for BOTH mode in calendar cells
  const getAdForBsDay = (day) => {
    if (mode !== 'BOTH') return null;
    try {
      const ad = bsToAd(viewYear, bsMonth1, day);
      return ad.getDate();
    } catch { return null; }
  };

  // Header label for BOTH mode
  const adRangeLabel = useMemo(() => {
    if (mode !== 'BOTH' && mode !== 'BS') return null;
    try {
      const firstAd = bsToAd(viewYear, bsMonth1, 1);
      const lastAd = bsToAd(viewYear, bsMonth1, bsDaysInMonth);
      const f = firstAd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const l = lastAd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `${f} – ${l}`;
    } catch { return null; }
  }, [viewYear, viewMonth, mode]);

  // Current calendar data
  const daysHeader = mode === 'AD' ? AD_DAYS : BS_DAYS;
  const monthLabel = mode === 'AD' ? `${AD_MONTHS[viewMonth]} ${viewYear}` : `${BS_MONTHS[viewMonth]} ${viewYear}`;
  const firstDayOffset = mode === 'AD' ? adFirstDay : bsFirstDay;
  const totalDays = mode === 'AD' ? adDaysInMonth : bsDaysInMonth;

  return (
    <div className={`relative ${className}`} ref={ref}>
      {required && <input type="text" value={value || ''} required tabIndex={-1} className="sr-only" onChange={() => {}} />}

      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`w-full px-3 py-2 rounded-lg border text-sm text-left flex items-center gap-2 transition-all duration-150
          ${disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed border-slate-200' : ''}
          ${!disabled && open ? 'border-primary-500 ring-2 ring-primary-500/20' : !disabled ? 'border-slate-300 hover:border-slate-400' : ''}
          ${displayValue ? 'text-slate-900' : 'text-slate-400'}`}
      >
        <Calendar size={15} className="text-slate-400 shrink-0" />
        <span className="flex-1 truncate">{displayValue || placeholder}</span>
        {value && !disabled && (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
            className="text-slate-400 hover:text-slate-600 shrink-0"
          >
            <X size={14} />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-white rounded-xl border border-slate-200 shadow-xl p-4 w-[300px] animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Month/Year navigation */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-0.5">
              <button type="button" onClick={prevYear} className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600" title="Previous year">
                <ChevronsLeft size={14} />
              </button>
              <button type="button" onClick={prevMonth} className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600" title="Previous month">
                <ChevronLeft size={16} />
              </button>
            </div>
            <div className="text-center">
              <div className="text-sm font-semibold text-slate-800">{monthLabel}</div>
              {adRangeLabel && <div className="text-[10px] text-slate-400 mt-0.5">{adRangeLabel}</div>}
            </div>
            <div className="flex items-center gap-0.5">
              <button type="button" onClick={nextMonth} className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600" title="Next month">
                <ChevronRight size={16} />
              </button>
              <button type="button" onClick={nextYear} className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600" title="Next year">
                <ChevronsRight size={14} />
              </button>
            </div>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {daysHeader.map((d) => (
              <div key={d} className="text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wider py-1">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {Array.from({ length: firstDayOffset }).map((_, i) => <div key={`e-${i}`} />)}
            {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
              const sel = isSelectedDay(day);
              const tod = isTodayDay(day);
              const adSub = getAdForBsDay(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={`relative flex flex-col items-center justify-center mx-auto rounded-lg text-xs font-medium transition-all duration-100
                    ${mode === 'BOTH' ? 'h-10 w-10' : 'h-8 w-8'}
                    ${sel
                      ? 'bg-primary-600 text-white shadow-sm'
                      : tod
                        ? 'bg-primary-50 text-primary-700 ring-1 ring-primary-200 font-bold'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                >
                  <span>{day}</span>
                  {adSub !== null && (
                    <span className={`text-[8px] leading-none ${sel ? 'text-white/70' : 'text-slate-400'}`}>{adSub}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={goToday}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium px-2 py-1 rounded-md hover:bg-primary-50 transition"
            >
              Today
            </button>
            {value && (
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false); }}
                className="text-xs text-slate-400 hover:text-slate-600 font-medium px-2 py-1 rounded-md hover:bg-slate-50 transition"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
