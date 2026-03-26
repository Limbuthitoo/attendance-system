import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function DatePicker({ value, onChange, placeholder = 'Select date', required }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const today = new Date();
  const selected = value ? new Date(value + 'T00:00:00') : null;
  const [viewYear, setViewYear] = useState(selected?.getFullYear() || today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? today.getMonth());

  useEffect(() => {
    if (open && selected) {
      setViewYear(selected.getFullYear());
      setViewMonth(selected.getMonth());
    }
  }, [open]);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const selectDate = (day) => {
    const m = String(viewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    onChange(`${viewYear}-${m}-${d}`);
    setOpen(false);
  };

  const isSelected = (day) => {
    if (!selected) return false;
    return selected.getFullYear() === viewYear && selected.getMonth() === viewMonth && selected.getDate() === day;
  };
  const isToday = (day) => {
    return today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;
  };

  const displayValue = selected
    ? selected.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <div className="relative" ref={ref}>
      {/* Hidden native input for form validation */}
      {required && <input type="text" value={value || ''} required tabIndex={-1} className="sr-only" onChange={() => {}} />}

      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full px-3 py-2 rounded-lg border text-sm text-left flex items-center justify-between transition
          ${open ? 'border-primary-500 ring-2 ring-primary-500/20' : 'border-slate-300 hover:border-slate-400'}
          ${displayValue ? 'text-slate-900' : 'text-slate-400'}`}
      >
        <span>{displayValue || placeholder}</span>
        <Calendar size={15} className="text-slate-400" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-white rounded-xl border border-slate-200 shadow-lg p-3 w-[280px] animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Month/Year nav */}
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={prevMonth} className="p-1 rounded-md hover:bg-slate-100 text-slate-500">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-slate-800">{MONTHS[viewMonth]} {viewYear}</span>
            <button type="button" onClick={nextMonth} className="p-1 rounded-md hover:bg-slate-100 text-slate-500">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-[10px] font-medium text-slate-400 py-1">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
              <button
                key={day}
                type="button"
                onClick={() => selectDate(day)}
                className={`h-8 w-8 mx-auto rounded-lg text-xs font-medium transition
                  ${isSelected(day)
                    ? 'bg-primary-600 text-white'
                    : isToday(day)
                      ? 'bg-primary-50 text-primary-700 font-semibold'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
              >
                {day}
              </button>
            ))}
          </div>

          {/* Today shortcut */}
          <div className="mt-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => selectDate(today.getDate()) || setViewMonth(today.getMonth()) || setViewYear(today.getFullYear())}
              className="w-full text-xs text-primary-600 hover:text-primary-700 font-medium py-1"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
