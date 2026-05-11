import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { formatDate } from '../lib/format-date';
import { useSettings } from '../context/SettingsContext';
import { Plus, Briefcase, Users, Calendar, Search } from 'lucide-react';
import DatePicker from '../components/DatePicker';

const STATUS_COLORS = {
  OPEN: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-800',
  ON_HOLD: 'bg-yellow-100 text-yellow-800',
  DRAFT: 'bg-blue-100 text-blue-800',
  NEW: 'bg-blue-100 text-blue-800',
  SCREENING: 'bg-yellow-100 text-yellow-800',
  INTERVIEW: 'bg-purple-100 text-purple-800',
  OFFERED: 'bg-green-100 text-green-800',
  HIRED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
};

export default function Recruitment() {
  const { dateFormat } = useSettings();
  const [tab, setTab] = useState('jobs');
  const [jobs, setJobs] = useState([]);
  const [applicants, setApplicants] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});

  useEffect(() => { loadData(); }, [tab]);

  async function loadData() {
    setLoading(true);
    try {
      if (tab === 'jobs') { const d = await api.getJobs({}); setJobs(d.jobs || []); }
      else if (tab === 'applicants') { const d = await api.getApplicants({}); setApplicants(d.applicants || []); }
      else { const d = await api.getInterviews({}); setInterviews(d.interviews || []); }
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  async function handleSaveJob(e) {
    e.preventDefault();
    try {
      await api.createJob({
        title: form.title,
        department: form.department,
        description: form.description,
        location: form.location,
        employmentType: form.employmentType || 'FULL_TIME',
        openings: parseInt(form.openings) || 1,
        deadline: form.deadline || null,
      });
      setShowForm(false); setForm({});
      loadData();
    } catch (err) { alert(err.message); }
  }

  async function handleSaveApplicant(e) {
    e.preventDefault();
    try {
      await api.createApplicant({ name: form.name, email: form.email, phone: form.phone, jobPostingId: form.jobPostingId || null, source: form.source });
      setShowForm(false); setForm({});
      loadData();
    } catch (err) { alert(err.message); }
  }

  async function handleUpdateStatus(type, id, status) {
    try {
      if (type === 'job') await api.updateJob(id, { status });
      else if (type === 'applicant') await api.updateApplicant(id, { status });
      else await api.updateInterview(id, { status });
      loadData();
    } catch (err) { alert(err.message); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Recruitment</h1>
        <button onClick={() => { setShowForm(true); setForm({}); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus size={16} /> {tab === 'jobs' ? 'New Job Posting' : tab === 'applicants' ? 'Add Applicant' : 'Schedule Interview'}
        </button>
      </div>

      <div className="flex gap-2 border-b">
        {[{ id: 'jobs', label: 'Job Postings', icon: Briefcase }, { id: 'applicants', label: 'Applicants', icon: Users }, { id: 'interviews', label: 'Interviews', icon: Calendar }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {loading ? <div className="text-center py-8 text-gray-500">Loading...</div> : tab === 'jobs' ? (
        <div className="grid gap-4">
          {jobs.map(job => (
            <div key={job.id} className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{job.title}</h3>
                <p className="text-sm text-gray-500">{job.department || 'General'} · {job.employmentType?.replace('_', ' ')} · {job.openings} opening(s)</p>
                <p className="text-xs text-gray-400 mt-1">{job._count?.applicants || 0} applicants · Posted {formatDate(job.createdAt, dateFormat)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[job.status] || 'bg-gray-100'}`}>{job.status}</span>
                {job.status === 'OPEN' && <button onClick={() => handleUpdateStatus('job', job.id, 'CLOSED')} className="text-xs text-red-600 hover:underline">Close</button>}
              </div>
            </div>
          ))}
          {jobs.length === 0 && <div className="text-center py-8 text-gray-500 bg-white rounded-lg shadow">No job postings yet</div>}
        </div>
      ) : tab === 'applicants' ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Applied</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {applicants.map(a => (
                <tr key={a.id}>
                  <td className="px-4 py-3"><div className="font-medium">{a.name}</div><div className="text-xs text-gray-500">{a.email}</div></td>
                  <td className="px-4 py-3 text-sm">{a.jobPosting?.title || '—'}</td>
                  <td className="px-4 py-3 text-sm">{formatDate(a.appliedAt, dateFormat)}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[a.status] || 'bg-gray-100'}`}>{a.status}</span></td>
                  <td className="px-4 py-3 text-right">
                    <select onChange={e => handleUpdateStatus('applicant', a.id, e.target.value)} value={a.status} className="text-xs border rounded px-2 py-1">
                      {['NEW','SCREENING','INTERVIEW','OFFERED','HIRED','REJECTED'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
              {applicants.length === 0 && <tr><td colSpan="5" className="px-4 py-8 text-center text-gray-500">No applicants</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Applicant</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Interviewer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scheduled</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {interviews.map(i => (
                <tr key={i.id}>
                  <td className="px-4 py-3">{i.applicant?.name || '—'}</td>
                  <td className="px-4 py-3">{i.interviewer?.name || '—'}</td>
                  <td className="px-4 py-3 text-sm">{formatDate(i.scheduledAt, dateFormat)}</td>
                  <td className="px-4 py-3 text-sm">{i.type}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[i.status] || 'bg-gray-100'}`}>{i.status}</span></td>
                </tr>
              ))}
              {interviews.length === 0 && <tr><td colSpan="5" className="px-4 py-8 text-center text-gray-500">No interviews scheduled</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">{tab === 'jobs' ? 'New Job Posting' : 'Add Applicant'}</h2>
            <form onSubmit={tab === 'jobs' ? handleSaveJob : handleSaveApplicant} className="space-y-3">
              {tab === 'jobs' ? <>
                <input placeholder="Job Title" value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full border rounded px-3 py-2" required />
                <input placeholder="Department" value={form.department || ''} onChange={e => setForm({ ...form, department: e.target.value })} className="w-full border rounded px-3 py-2" />
                <textarea placeholder="Description" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full border rounded px-3 py-2" rows="3" />
                <input placeholder="Location" value={form.location || ''} onChange={e => setForm({ ...form, location: e.target.value })} className="w-full border rounded px-3 py-2" />
                <select value={form.employmentType || 'FULL_TIME'} onChange={e => setForm({ ...form, employmentType: e.target.value })} className="w-full border rounded px-3 py-2">
                  <option value="FULL_TIME">Full Time</option><option value="PART_TIME">Part Time</option><option value="CONTRACT">Contract</option><option value="INTERN">Intern</option>
                </select>
                <input placeholder="Openings" type="number" min="1" value={form.openings || ''} onChange={e => setForm({ ...form, openings: e.target.value })} className="w-full border rounded px-3 py-2" />
                <DatePicker value={form.deadline || ''} onChange={v => setForm({ ...form, deadline: v })} placeholder="Deadline" />
              </> : <>
                <input placeholder="Name" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border rounded px-3 py-2" required />
                <input placeholder="Email" type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full border rounded px-3 py-2" required />
                <input placeholder="Phone" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full border rounded px-3 py-2" />
                <input placeholder="Source" value={form.source || ''} onChange={e => setForm({ ...form, source: e.target.value })} className="w-full border rounded px-3 py-2" />
              </>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
