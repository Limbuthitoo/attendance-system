import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Plus, BookOpen, Users, Award } from 'lucide-react';

const STATUS_COLORS = {
  SCHEDULED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  ENROLLED: 'bg-blue-100 text-blue-800',
  ATTENDED: 'bg-purple-100 text-purple-800',
  ACTIVE: 'bg-green-100 text-green-800',
  EXPIRED: 'bg-red-100 text-red-800',
};

export default function Training() {
  const [tab, setTab] = useState('courses');
  const [courses, setCourses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [certifications, setCertifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});

  useEffect(() => { loadData(); }, [tab]);

  async function loadData() {
    setLoading(true);
    try {
      if (tab === 'courses') { const d = await api.getCourses(); setCourses(d.courses || []); }
      else if (tab === 'sessions') { const d = await api.getSessions({}); setSessions(d.sessions || []); }
      else { const d = await api.getCertifications({}); setCertifications(d.certifications || []); }
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  async function handleSaveCourse(e) {
    e.preventDefault();
    try {
      await api.createCourse({
        name: form.name,
        category: form.category || 'general',
        description: form.description,
        duration: form.duration,
        isExternal: form.isExternal === 'true',
        provider: form.provider,
        isMandatory: form.isMandatory === 'true',
      });
      setShowForm(false); setForm({});
      loadData();
    } catch (err) { alert(err.message); }
  }

  async function handleSaveSession(e) {
    e.preventDefault();
    try {
      await api.createSession({
        courseId: form.courseId,
        title: form.title,
        startDate: form.startDate,
        endDate: form.endDate,
        location: form.location,
        maxParticipants: parseInt(form.maxParticipants) || null,
      });
      setShowForm(false); setForm({});
      loadData();
    } catch (err) { alert(err.message); }
  }

  async function handleSaveCert(e) {
    e.preventDefault();
    try {
      await api.createCertification({
        name: form.name,
        issuingAuthority: form.issuingAuthority,
        issueDate: form.issueDate,
        expiryDate: form.expiryDate || null,
        credentialId: form.credentialId,
      });
      setShowForm(false); setForm({});
      loadData();
    } catch (err) { alert(err.message); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Training & Development</h1>
        <button onClick={() => { setShowForm(true); setForm({}); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus size={16} /> Add {tab === 'courses' ? 'Course' : tab === 'sessions' ? 'Session' : 'Certification'}
        </button>
      </div>

      <div className="flex gap-2 border-b">
        {[{ id: 'courses', label: 'Courses', icon: BookOpen }, { id: 'sessions', label: 'Sessions', icon: Users }, { id: 'certs', label: 'Certifications', icon: Award }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {loading ? <div className="text-center py-8 text-gray-500">Loading...</div> : tab === 'courses' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courses.map(c => (
            <div key={c.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-gray-900">{c.name}</h3>
                {c.isMandatory && <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">Mandatory</span>}
              </div>
              <p className="text-sm text-gray-500 mt-1">{c.category} · {c.duration || 'Flexible'}</p>
              <p className="text-xs text-gray-400 mt-1">{c.isExternal ? `External (${c.provider || 'TBD'})` : 'Internal'} · {c._count?.sessions || 0} sessions</p>
            </div>
          ))}
          {courses.length === 0 && <div className="col-span-full text-center py-8 text-gray-500 bg-white rounded-lg shadow">No courses yet</div>}
        </div>
      ) : tab === 'sessions' ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Course</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trainer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dates</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Enrolled</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sessions.map(s => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-medium">{s.title}</td>
                  <td className="px-4 py-3 text-sm">{s.course?.name}</td>
                  <td className="px-4 py-3 text-sm">{s.trainer?.name || '—'}</td>
                  <td className="px-4 py-3 text-sm">{new Date(s.startDate).toLocaleDateString()} - {new Date(s.endDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm">{s._count?.enrollments || 0}{s.maxParticipants ? `/${s.maxParticipants}` : ''}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[s.status] || 'bg-gray-100'}`}>{s.status}</span></td>
                </tr>
              ))}
              {sessions.length === 0 && <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-500">No training sessions</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Certification</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issuing Authority</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issue Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {certifications.map(c => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-sm">{c.employee?.name}</td>
                  <td className="px-4 py-3 text-sm">{c.issuingAuthority}</td>
                  <td className="px-4 py-3 text-sm">{new Date(c.issueDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm">{c.expiryDate ? new Date(c.expiryDate).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[c.status] || 'bg-gray-100'}`}>{c.status}</span></td>
                </tr>
              ))}
              {certifications.length === 0 && <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-500">No certifications</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Add {tab === 'courses' ? 'Course' : tab === 'sessions' ? 'Session' : 'Certification'}</h2>
            <form onSubmit={tab === 'courses' ? handleSaveCourse : tab === 'sessions' ? handleSaveSession : handleSaveCert} className="space-y-3">
              {tab === 'courses' ? <>
                <input placeholder="Course Name" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border rounded px-3 py-2" required />
                <input placeholder="Category" value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full border rounded px-3 py-2" />
                <textarea placeholder="Description" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full border rounded px-3 py-2" rows="2" />
                <input placeholder="Duration (e.g. 2 days)" value={form.duration || ''} onChange={e => setForm({ ...form, duration: e.target.value })} className="w-full border rounded px-3 py-2" />
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isExternal === 'true'} onChange={e => setForm({ ...form, isExternal: e.target.checked ? 'true' : 'false' })} /> External</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isMandatory === 'true'} onChange={e => setForm({ ...form, isMandatory: e.target.checked ? 'true' : 'false' })} /> Mandatory</label>
                </div>
                {form.isExternal === 'true' && <input placeholder="Provider" value={form.provider || ''} onChange={e => setForm({ ...form, provider: e.target.value })} className="w-full border rounded px-3 py-2" />}
              </> : tab === 'sessions' ? <>
                <select value={form.courseId || ''} onChange={e => setForm({ ...form, courseId: e.target.value })} className="w-full border rounded px-3 py-2" required>
                  <option value="">Select Course</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input placeholder="Session Title" value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full border rounded px-3 py-2" required />
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" value={form.startDate || ''} onChange={e => setForm({ ...form, startDate: e.target.value })} className="border rounded px-3 py-2" required />
                  <input type="date" value={form.endDate || ''} onChange={e => setForm({ ...form, endDate: e.target.value })} className="border rounded px-3 py-2" required />
                </div>
                <input placeholder="Location" value={form.location || ''} onChange={e => setForm({ ...form, location: e.target.value })} className="w-full border rounded px-3 py-2" />
                <input placeholder="Max Participants" type="number" value={form.maxParticipants || ''} onChange={e => setForm({ ...form, maxParticipants: e.target.value })} className="w-full border rounded px-3 py-2" />
              </> : <>
                <input placeholder="Certification Name" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border rounded px-3 py-2" required />
                <input placeholder="Issuing Authority" value={form.issuingAuthority || ''} onChange={e => setForm({ ...form, issuingAuthority: e.target.value })} className="w-full border rounded px-3 py-2" required />
                <input type="date" placeholder="Issue Date" value={form.issueDate || ''} onChange={e => setForm({ ...form, issueDate: e.target.value })} className="w-full border rounded px-3 py-2" required />
                <input type="date" placeholder="Expiry Date" value={form.expiryDate || ''} onChange={e => setForm({ ...form, expiryDate: e.target.value })} className="w-full border rounded px-3 py-2" />
                <input placeholder="Credential ID" value={form.credentialId || ''} onChange={e => setForm({ ...form, credentialId: e.target.value })} className="w-full border rounded px-3 py-2" />
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
