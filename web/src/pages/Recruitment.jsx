import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { formatDate } from '../lib/format-date';
import { useSettings } from '../context/SettingsContext';
import { Plus, Briefcase, Users, Calendar, ArrowLeft, MapPin, Clock, FileText } from 'lucide-react';
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
  SCHEDULED: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
  NO_SHOW: 'bg-red-100 text-red-800',
};

const JOB_STATUSES = ['OPEN', 'ON_HOLD', 'CLOSED', 'DRAFT'];
const APPLICANT_STATUSES = ['NEW', 'SCREENING', 'INTERVIEW', 'OFFERED', 'HIRED', 'REJECTED'];
const INTERVIEW_STATUSES = ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

function StatusBadge({ status }) {
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}`}>
      {String(status || 'UNKNOWN').replace('_', ' ')}
    </span>
  );
}

function EmptyRow({ colSpan, children }) {
  return <tr><td colSpan={colSpan} className="px-4 py-8 text-center text-gray-500">{children}</td></tr>;
}

export default function Recruitment() {
  const { dateFormat } = useSettings();
  const navigate = useNavigate();
  const { jobId } = useParams();
  const [tab, setTab] = useState('jobs');
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState('job');
  const [form, setForm] = useState({});

  useEffect(() => {
    if (jobId) loadJobDetail();
    else loadData();
  }, [tab, jobId]);

  async function loadJobDetail() {
    setLoading(true);
    try {
      const [jobData, employeeData] = await Promise.all([
        api.getJob(jobId),
        api.getEmployees().catch(() => ({ employees: [] })),
      ]);
      const job = jobData.job;
      setSelectedJob(job);
      setJobs([job]);
      setApplicants(job.applicants || []);
      setEmployees(employeeData.employees || []);
      setInterviews((job.applicants || []).flatMap(a => (a.interviews || []).map(i => ({ ...i, applicant: { id: a.id, name: a.name } }))));
    } catch (err) {
      alert(err.message);
      navigate('/recruitment');
    } finally {
      setLoading(false);
    }
  }

  async function loadData() {
    setLoading(true);
    setSelectedJob(null);
    try {
      if (tab === 'jobs') {
        const d = await api.getJobs({});
        setJobs(d.jobs || []);
      } else if (tab === 'applicants') {
        const [applicantData, jobData] = await Promise.all([
          api.getApplicants({}),
          api.getJobs({}),
        ]);
        setApplicants(applicantData.applicants || []);
        setJobs(jobData.jobs || []);
      } else {
        const [interviewData, applicantData, employeeData] = await Promise.all([
          api.getInterviews({}),
          api.getApplicants({}),
          api.getEmployees().catch(() => ({ employees: [] })),
        ]);
        setInterviews(interviewData.interviews || []);
        setApplicants(applicantData.applicants || []);
        setEmployees(employeeData.employees || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function openForm(type, defaults = {}) {
    setFormType(type);
    setForm(defaults);
    setShowForm(true);
  }

  async function reloadCurrentView() {
    if (jobId) await loadJobDetail();
    else await loadData();
  }

  async function handleSaveJob(e) {
    e.preventDefault();
    try {
      await api.createJob({
        title: form.title,
        department: form.department,
        description: form.description,
        requirements: form.requirements,
        location: form.location,
        employmentType: form.employmentType || 'FULL_TIME',
        openings: parseInt(form.openings, 10) || 1,
        deadline: form.deadline || null,
        status: form.status || 'OPEN',
      });
      setShowForm(false);
      setForm({});
      await reloadCurrentView();
    } catch (err) { alert(err.message); }
  }

  async function handleSaveApplicant(e) {
    e.preventDefault();
    try {
      await api.createApplicant({
        jobPostingId: form.jobPostingId || selectedJob?.id,
        name: form.name,
        email: form.email,
        phone: form.phone,
        resumeUrl: form.resumeUrl,
        coverLetter: form.coverLetter,
        source: form.source,
        status: form.status || 'NEW',
        rating: form.rating,
        notes: form.notes,
      });
      setShowForm(false);
      setForm({});
      await reloadCurrentView();
    } catch (err) { alert(err.message); }
  }

  async function handleSaveInterview(e) {
    e.preventDefault();
    try {
      await api.createInterview({
        applicantId: form.applicantId,
        interviewerId: form.interviewerId,
        scheduledAt: form.scheduledAt,
        type: form.type || 'IN_PERSON',
        location: form.location,
        duration: parseInt(form.duration, 10) || 60,
        status: form.status || 'SCHEDULED',
        rating: form.rating,
        notes: form.notes,
        feedback: form.feedback,
      });
      setShowForm(false);
      setForm({});
      await reloadCurrentView();
    } catch (err) { alert(err.message); }
  }

  async function handleUpdateStatus(type, id, status) {
    try {
      if (type === 'job') await api.updateJob(id, { status });
      else if (type === 'applicant') await api.updateApplicant(id, { status });
      else await api.updateInterview(id, { status });
      await reloadCurrentView();
    } catch (err) { alert(err.message); }
  }

  function renderHeader() {
    if (jobId) {
      return (
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/recruitment')} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft size={16} /> Job postings
          </button>
          <div className="flex gap-2">
            <button onClick={() => openForm('applicant', { jobPostingId: selectedJob?.id })} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus size={16} /> Add Applicant
            </button>
            <button onClick={() => openForm('interview')} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              <Calendar size={16} /> Schedule Interview
            </button>
          </div>
        </div>
      );
    }

    const label = tab === 'jobs' ? 'New Job Posting' : tab === 'applicants' ? 'Add Applicant' : 'Schedule Interview';
    const type = tab === 'jobs' ? 'job' : tab === 'applicants' ? 'applicant' : 'interview';
    return (
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Recruitment</h1>
        <button onClick={() => openForm(type)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus size={16} /> {label}
        </button>
      </div>
    );
  }

  function renderTabs() {
    if (jobId) return null;
    return (
      <div className="flex gap-2 border-b">
        {[{ id: 'jobs', label: 'Job Postings', icon: Briefcase }, { id: 'applicants', label: 'Applicants', icon: Users }, { id: 'interviews', label: 'Interviews', icon: Calendar }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>
    );
  }

  function renderJobs() {
    return (
      <div className="grid gap-4">
        {jobs.map(job => (
          <button key={job.id} onClick={() => navigate(`/recruitment/jobs/${job.id}`)} className="bg-white rounded-lg shadow p-4 text-left flex items-center justify-between hover:shadow-md hover:border-blue-200 border border-transparent transition">
            <div>
              <h3 className="font-semibold text-gray-900">{job.title}</h3>
              <p className="text-sm text-gray-500">{job.department || 'General'} · {job.employmentType?.replace('_', ' ')} · {job.vacancies ?? job.openings ?? 1} opening(s)</p>
              <p className="text-xs text-gray-400 mt-1">{job._count?.applicants || 0} applicants · Posted {formatDate(job.createdAt, dateFormat)}</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={job.status} />
              <span className="text-xs text-blue-600">View</span>
            </div>
          </button>
        ))}
        {jobs.length === 0 && <div className="text-center py-8 text-gray-500 bg-white rounded-lg shadow">No job postings yet</div>}
      </div>
    );
  }

  function renderApplicantsTable(items = applicants) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Applied</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map(a => (
              <tr key={a.id}>
                <td className="px-4 py-3"><div className="font-medium">{a.name}</div><div className="text-xs text-gray-500">{a.source || 'Direct'}</div></td>
                <td className="px-4 py-3 text-sm">{a.jobPosting?.title || selectedJob?.title || '—'}</td>
                <td className="px-4 py-3 text-sm"><div>{a.email}</div><div className="text-xs text-gray-500">{a.phone || '—'}</div></td>
                <td className="px-4 py-3 text-sm">{formatDate(a.createdAt || a.appliedAt, dateFormat)}</td>
                <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                <td className="px-4 py-3 text-right">
                  <select onChange={e => handleUpdateStatus('applicant', a.id, e.target.value)} value={a.status} className="text-xs border rounded px-2 py-1">
                    {APPLICANT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {items.length === 0 && <EmptyRow colSpan="6">No applicants</EmptyRow>}
          </tbody>
        </table>
      </div>
    );
  }

  function renderInterviewsTable(items = interviews) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Applicant</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Interviewer</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scheduled</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map(i => (
              <tr key={i.id}>
                <td className="px-4 py-3">{i.applicant?.name || '—'}</td>
                <td className="px-4 py-3">{i.interviewer?.name || '—'}</td>
                <td className="px-4 py-3 text-sm">{formatDate(i.scheduledAt, dateFormat)}</td>
                <td className="px-4 py-3 text-sm">{i.type?.replace('_', ' ')}</td>
                <td className="px-4 py-3"><StatusBadge status={i.status} /></td>
                <td className="px-4 py-3 text-right">
                  <select onChange={e => handleUpdateStatus('interview', i.id, e.target.value)} value={i.status} className="text-xs border rounded px-2 py-1">
                    {INTERVIEW_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {items.length === 0 && <EmptyRow colSpan="6">No interviews scheduled</EmptyRow>}
          </tbody>
        </table>
      </div>
    );
  }

  function renderJobDetail() {
    if (!selectedJob) return null;
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-900">{selectedJob.title}</h1>
                <StatusBadge status={selectedJob.status} />
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1"><Briefcase size={14} /> {selectedJob.department || 'General'}</span>
                <span className="flex items-center gap-1"><MapPin size={14} /> {selectedJob.location || 'Not specified'}</span>
                <span className="flex items-center gap-1"><Users size={14} /> {selectedJob.vacancies || 1} opening(s)</span>
                {selectedJob.closingDate && <span className="flex items-center gap-1"><Clock size={14} /> Closes {formatDate(selectedJob.closingDate, dateFormat)}</span>}
              </div>
            </div>
            <select onChange={e => handleUpdateStatus('job', selectedJob.id, e.target.value)} value={selectedJob.status} className="text-sm border rounded px-3 py-2">
              {JOB_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"><FileText size={16} /> Description</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{selectedJob.description || 'No description added.'}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Requirements</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{selectedJob.requirements || 'No requirements added.'}</p>
            </div>
          </div>
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Applicants</h2>
            <button onClick={() => openForm('applicant', { jobPostingId: selectedJob.id })} className="text-sm text-blue-600 hover:underline">Add applicant</button>
          </div>
          {renderApplicantsTable(selectedJob.applicants || [])}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Interviews</h2>
            <button onClick={() => openForm('interview')} className="text-sm text-blue-600 hover:underline">Schedule interview</button>
          </div>
          {renderInterviewsTable(interviews)}
        </section>
      </div>
    );
  }

  function renderForm() {
    if (!showForm) return null;
    const onSubmit = formType === 'job' ? handleSaveJob : formType === 'applicant' ? handleSaveApplicant : handleSaveInterview;
    const title = formType === 'job' ? 'New Job Posting' : formType === 'applicant' ? 'Add Applicant' : 'Schedule Interview';

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <h2 className="text-lg font-semibold mb-4">{title}</h2>
          <form onSubmit={onSubmit} className="space-y-3">
            {formType === 'job' ? <>
              <input placeholder="Job Title" value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full border rounded px-3 py-2" required />
              <input placeholder="Department" value={form.department || ''} onChange={e => setForm({ ...form, department: e.target.value })} className="w-full border rounded px-3 py-2" />
              <textarea placeholder="Description" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full border rounded px-3 py-2" rows="3" />
              <textarea placeholder="Requirements" value={form.requirements || ''} onChange={e => setForm({ ...form, requirements: e.target.value })} className="w-full border rounded px-3 py-2" rows="3" />
              <input placeholder="Location" value={form.location || ''} onChange={e => setForm({ ...form, location: e.target.value })} className="w-full border rounded px-3 py-2" />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.employmentType || 'FULL_TIME'} onChange={e => setForm({ ...form, employmentType: e.target.value })} className="w-full border rounded px-3 py-2">
                  <option value="FULL_TIME">Full Time</option><option value="PART_TIME">Part Time</option><option value="CONTRACT">Contract</option><option value="INTERN">Intern</option>
                </select>
                <select value={form.status || 'OPEN'} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full border rounded px-3 py-2">
                  {JOB_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <input placeholder="Openings" type="number" min="1" value={form.openings || ''} onChange={e => setForm({ ...form, openings: e.target.value })} className="w-full border rounded px-3 py-2" />
              <DatePicker value={form.deadline || ''} onChange={v => setForm({ ...form, deadline: v })} placeholder="Deadline" />
            </> : formType === 'applicant' ? <>
              <select value={form.jobPostingId || selectedJob?.id || ''} onChange={e => setForm({ ...form, jobPostingId: e.target.value })} className="w-full border rounded px-3 py-2" required>
                <option value="">Select Job Posting</option>
                {(selectedJob ? [selectedJob] : jobs).map(job => <option key={job.id} value={job.id}>{job.title}</option>)}
              </select>
              <input placeholder="Name" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border rounded px-3 py-2" required />
              <input placeholder="Email" type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full border rounded px-3 py-2" required />
              <input placeholder="Phone" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full border rounded px-3 py-2" />
              <input placeholder="Resume URL" value={form.resumeUrl || ''} onChange={e => setForm({ ...form, resumeUrl: e.target.value })} className="w-full border rounded px-3 py-2" />
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Source" value={form.source || ''} onChange={e => setForm({ ...form, source: e.target.value })} className="w-full border rounded px-3 py-2" />
                <select value={form.status || 'NEW'} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full border rounded px-3 py-2">
                  {APPLICANT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <textarea placeholder="Cover Letter" value={form.coverLetter || ''} onChange={e => setForm({ ...form, coverLetter: e.target.value })} className="w-full border rounded px-3 py-2" rows="2" />
              <textarea placeholder="Notes" value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full border rounded px-3 py-2" rows="2" />
            </> : <>
              <select value={form.applicantId || ''} onChange={e => setForm({ ...form, applicantId: e.target.value })} className="w-full border rounded px-3 py-2" required>
                <option value="">Select Applicant</option>
                {applicants.map(applicant => <option key={applicant.id} value={applicant.id}>{applicant.name} - {applicant.jobPosting?.title || selectedJob?.title || 'Unassigned'}</option>)}
              </select>
              <select value={form.interviewerId || ''} onChange={e => setForm({ ...form, interviewerId: e.target.value })} className="w-full border rounded px-3 py-2" required>
                <option value="">Select Interviewer</option>
                {employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name} ({employee.employeeCode})</option>)}
              </select>
              <input type="datetime-local" value={form.scheduledAt || ''} onChange={e => setForm({ ...form, scheduledAt: e.target.value })} className="w-full border rounded px-3 py-2" required />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.type || 'IN_PERSON'} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full border rounded px-3 py-2">
                  <option value="IN_PERSON">In Person</option>
                  <option value="VIDEO">Video</option>
                  <option value="PHONE">Phone</option>
                  <option value="TECHNICAL">Technical</option>
                  <option value="HR">HR</option>
                </select>
                <select value={form.status || 'SCHEDULED'} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full border rounded px-3 py-2">
                  {INTERVIEW_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <input placeholder="Location or meeting link" value={form.location || ''} onChange={e => setForm({ ...form, location: e.target.value })} className="w-full border rounded px-3 py-2" />
              <input placeholder="Duration (minutes)" type="number" min="15" value={form.duration || ''} onChange={e => setForm({ ...form, duration: e.target.value })} className="w-full border rounded px-3 py-2" />
              <textarea placeholder="Notes" value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full border rounded px-3 py-2" rows="2" />
              <textarea placeholder="Feedback" value={form.feedback || ''} onChange={e => setForm({ ...form, feedback: e.target.value })} className="w-full border rounded px-3 py-2" rows="2" />
            </>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {renderHeader()}
      {renderTabs()}
      {loading ? <div className="text-center py-8 text-gray-500">Loading...</div> : jobId ? renderJobDetail() : tab === 'jobs' ? renderJobs() : tab === 'applicants' ? renderApplicantsTable() : renderInterviewsTable()}
      {renderForm()}
    </div>
  );
}
