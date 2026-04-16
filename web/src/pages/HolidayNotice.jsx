import { Printer } from 'lucide-react';

const holidays = [
  { sn: 1, name: 'Nepali New Year', bsDate: '2083-01-01', adDate: 'Apr 14, 2026' },
  { sn: 2, name: 'International Labour Day', bsDate: '2083-01-18', adDate: 'May 1, 2026' },
  { sn: 3, name: 'Buddha Jayanti', bsDate: '2083-01-18', adDate: 'May 1, 2026' },
  { sn: 4, name: 'Republic Day', bsDate: '2083-02-15', adDate: 'May 29, 2026' },
  { sn: 5, name: 'Teej (Women Only)', bsDate: '2083-05-22', adDate: 'Sep 7, 2026' },
  { sn: 6, name: 'Constitution Day', bsDate: '2083-06-03', adDate: 'Sep 19, 2026' },
  { sn: 7, name: 'Dashain Festival (6 Days)', bsDate: '2083-06-31 to 2083-07-05', adDate: 'Oct 17 – Oct 22, 2026' },
  { sn: 8, name: 'Tihar Festival (4 Days)', bsDate: '2083-07-22 to 2083-07-25', adDate: 'Nov 8 – Nov 11, 2026' },
  { sn: 9, name: 'Maghe Sankranti', bsDate: '2083-10-01', adDate: 'Jan 15, 2027' },
  { sn: 10, name: 'Maha Shivaratri', bsDate: '2083-11-22', adDate: 'Mar 6, 2027' },
  { sn: 11, name: 'Holi (Fagu Purnima)', bsDate: '2083-11-30', adDate: 'Mar 14, 2027' },
];

export default function HolidayNotice() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      <style>{`
        @media print {
          aside, nav, header, .no-print { display: none !important; }
          body, #root, #root > * {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
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

      {/* Screen header with print button */}
      <div className="no-print mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Holiday Notice</h1>
          <p className="text-sm text-slate-500 mt-1">Official public holiday schedule for FY 2083 B.S.</p>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition"
        >
          <Printer size={18} />
          Print / Save as PDF
        </button>
      </div>

      {/* Formal Notice Document */}
      <div className="print-notice bg-white max-w-4xl mx-auto rounded-xl shadow-sm border border-slate-200">
        <div className="p-10 md:p-14">
          {/* Company Header */}
          <div className="text-center mb-8 border-b-2 border-slate-800 pb-6">
            <div className="flex items-center justify-center gap-3 mb-2">
              <img src="/favicon.svg" alt="Logo" className="w-10 h-10 rounded-lg no-print" />
              <h1 className="text-2xl font-bold text-slate-900 tracking-wide uppercase">Archisys Innovations</h1>
            </div>
            <p className="text-sm text-slate-500">Attendance Management System</p>
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-center text-slate-900 mb-6 tracking-wide">OFFICIAL NOTICE</h2>

          {/* Subject */}
          <p className="text-sm text-slate-800 mb-4">
            <span className="font-bold">Subject:</span> Public Holiday Schedule for Fiscal Year 2083 B.S.
          </p>

          {/* Body */}
          <p className="text-sm text-slate-700 leading-relaxed mb-8">
            This is to inform all employees that the following public holidays have been approved for the
            fiscal year 2083 B.S. The schedule reflects major national, cultural, and religious observances
            while ensuring continuity of business operations. All employees are requested to plan their
            responsibilities accordingly and coordinate with their respective teams to maintain smooth
            workflow during these periods.
          </p>

          {/* Holiday Table */}
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
                {holidays.map((h, i) => (
                  <tr key={h.sn} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="border border-slate-300 px-4 py-3 text-center font-medium text-slate-700">{h.sn}</td>
                    <td className="border border-slate-300 px-4 py-3 text-center font-medium text-slate-900">{h.name}</td>
                    <td className="border border-slate-300 px-4 py-3 text-center text-slate-700">{h.bsDate}</td>
                    <td className="border border-slate-300 px-4 py-3 text-center text-slate-700">{h.adDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Notes */}
          <div className="mb-10">
            <p className="text-sm font-bold text-slate-900 mb-2">Notes:</p>
            <ul className="text-sm text-slate-700 space-y-1.5 list-disc list-inside">
              <li>Saturdays shall remain weekly holidays.</li>
              <li>Holidays falling on weekends shall not be substituted unless otherwise notified.</li>
              <li>Festival dates are subject to change as per official lunar calendar confirmations.</li>
              <li>The management reserves the right to make necessary amendments if required.</li>
            </ul>
          </div>

          {/* Signature Area */}
          <div className="flex justify-end mt-16">
            <div className="text-center">
              <div className="w-48 border-t border-slate-400 pt-2">
                <p className="text-sm font-semibold text-slate-900">Authorized Signatory</p>
                <p className="text-xs text-slate-500">Human Resources Department</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
