import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { Plus, X, UserCog, CreditCard, Trash2, Pencil, KeyRound, UserX, Edit, Wifi } from 'lucide-react';

const DEPARTMENTS = [
  'Engineering', 'Design', 'Digital Marketing', 'Content & Media', 'SEO',
  'Sales', 'Human Resources', 'Finance', 'Operations', 'Quality Assurance',
  'DevOps', 'Product', 'Customer Support', 'Administration', 'Data & Analytics',
];

const DESIGNATIONS = [
  'CEO', 'CTO', 'COO', 'CFO', 'Director', 'Vice President',
  'Senior Manager', 'Manager', 'Assistant Manager', 'Team Lead',
  'Principal Engineer', 'Senior Software Engineer', 'Software Engineer', 'Junior Software Engineer',
  'Full Stack Developer', 'Frontend Developer', 'Backend Developer', 'Mobile App Developer',
  'UI/UX Designer', 'Senior Designer', 'Graphic Designer', 'Motion Designer',
  'Digital Marketing Manager', 'Digital Marketing Executive',
  'SEO Manager', 'SEO Specialist', 'SEO Analyst',
  'Content Strategist', 'Senior Content Writer', 'Content Writer', 'Copywriter',
  'Social Media Manager', 'Social Media Executive',
  'PPC Specialist', 'Performance Marketing Manager', 'Email Marketing Specialist',
  'Business Development Manager', 'Business Development Executive',
  'Sales Manager', 'Sales Executive', 'Account Manager',
  'HR Manager', 'HR Executive', 'Recruiter',
  'Finance Manager', 'Accountant',
  'QA Lead', 'Senior QA Engineer', 'QA Engineer',
  'DevOps Engineer', 'System Administrator', 'Cloud Engineer',
  'Product Manager', 'Project Manager', 'Scrum Master',
  'Data Analyst', 'Data Scientist', 'Data Engineer',
  'Customer Support Manager', 'Customer Support Executive',
  'Office Administrator', 'Intern', 'Trainee',
];

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [nfcModal, setNfcModal] = useState(null); // employee object or null
  const [nfcCards, setNfcCards] = useState([]);
  const [nfcForm, setNfcForm] = useState({ card_uid: '', label: '' });
  const [nfcSubmitting, setNfcSubmitting] = useState(false);
  const [writeJobs, setWriteJobs] = useState([]);
  const [writeSubmitting, setWriteSubmitting] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const [detectedUid, setDetectedUid] = useState(null);
  const sseRef = useRef(null);
  const sseConnectedRef = useRef(false);
  const [resetModal, setResetModal] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', department: '', designation: '', role: '', phone: '' });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [form, setForm] = useState({
    employee_id: '', name: '', email: '', password: '',
    department: '', designation: '', role: 'employee', phone: ''
  });

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const data = await api.getEmployees();
      setEmployees(data.employees);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.createEmployee(form);
      setShowForm(false);
      setForm({ employee_id: '', name: '', email: '', password: '', department: '', designation: '', role: 'employee', phone: '' });
      loadEmployees();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (emp) => {
    try {
      await api.updateEmployee(emp.id, { is_active: emp.is_active ? 0 : 1 });
      loadEmployees();
    } catch (err) {
      alert(err.message);
    }
  };

  // SSE listener for auto-detecting NFC card taps (with polling fallback)
  useEffect(() => {
    if (!nfcModal) {
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
        setSseConnected(false);
        setDetectedUid(null);
      }
      return;
    }

    const token = localStorage.getItem('token');
    const API_BASE = import.meta.env.VITE_API_URL
      ? `${import.meta.env.VITE_API_URL}/api`
      : '/api';

    let pollTimer = null;
    let pollSince = new Date().toISOString();

    // Polling fallback: poll /api/nfc/recent-tap every 2s
    const startPolling = () => {
      if (pollTimer) return;
      setSseConnected(true); // show as connected via polling
      pollTimer = setInterval(async () => {
        try {
          const res = await fetch(`${API_BASE}/nfc/recent-tap?since=${encodeURIComponent(pollSince)}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const { tap } = await res.json();
            if (tap && tap.card_uid) {
              setDetectedUid(tap.card_uid);
              setNfcForm(prev => ({ ...prev, card_uid: tap.card_uid }));
              pollSince = tap.tap_time; // don't re-detect same tap
            }
          }
        } catch {}
      }, 2000);
    };

    // Try SSE first
    const url = `${API_BASE}/nfc/events?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    sseRef.current = es;

    // If SSE doesn't connect in 3s, fall back to polling
    const sseFallbackTimer = setTimeout(() => {
      if (!sseConnectedRef.current) {
        es.close();
        sseRef.current = null;
        startPolling();
      }
    }, 3000);

    es.onopen = () => {
      setSseConnected(true);
      sseConnectedRef.current = true;
    };
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.cardUid) {
          setDetectedUid(data.cardUid);
          setNfcForm(prev => ({ ...prev, card_uid: data.cardUid }));
        }
      } catch {}
    };
    es.onerror = () => {
      setSseConnected(false);
      sseConnectedRef.current = false;
      // If SSE fails, switch to polling
      es.close();
      sseRef.current = null;
      startPolling();
    };

    return () => {
      clearTimeout(sseFallbackTimer);
      if (pollTimer) clearInterval(pollTimer);
      if (sseRef.current) sseRef.current.close();
      sseRef.current = null;
      sseConnectedRef.current = false;
      setSseConnected(false);
      setDetectedUid(null);
    };
  }, [nfcModal]);

  const openNfcModal = async (emp) => {
    setNfcModal(emp);
    setNfcForm({ card_uid: '', label: '' });
    setDetectedUid(null);
    try {
      const data = await api.getEmployeeNfcCards(emp.id);
      setNfcCards(data.cards);
    } catch (err) {
      console.error(err);
      setNfcCards([]);
    }
    try {
      const data = await api.getWriteJobs();
      setWriteJobs(data.jobs.filter(j => j.employee_id === emp.id));
    } catch {
      setWriteJobs([]);
    }
  };

  const handleWriteCard = async () => {
    setWriteSubmitting(true);
    try {
      await api.createWriteJob({ employee_id: nfcModal.id });
      const data = await api.getWriteJobs();
      setWriteJobs(data.jobs.filter(j => j.employee_id === nfcModal.id));
    } catch (err) {
      alert(err.message);
    } finally {
      setWriteSubmitting(false);
    }
  };

  const cancelWriteJob = async (jobId) => {
    try {
      await api.cancelWriteJob(jobId);
      const data = await api.getWriteJobs();
      setWriteJobs(data.jobs.filter(j => j.employee_id === nfcModal.id));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAssignCard = async (e) => {
    e.preventDefault();
    setNfcSubmitting(true);
    try {
      await api.assignNfcCard({ card_uid: nfcForm.card_uid, employee_id: nfcModal.id, label: nfcForm.label || undefined });
      setNfcForm({ card_uid: '', label: '' });
      const data = await api.getEmployeeNfcCards(nfcModal.id);
      setNfcCards(data.cards);
    } catch (err) {
      alert(err.message);
    } finally {
      setNfcSubmitting(false);
    }
  };

  const toggleCardActive = async (card) => {
    try {
      if (card.is_active) {
        await api.deactivateNfcCard(card.id);
      } else {
        await api.activateNfcCard(card.id);
      }
      const data = await api.getEmployeeNfcCards(nfcModal.id);
      setNfcCards(data.cards);
    } catch (err) {
      alert(err.message);
    }
  };

  const deleteCard = async (card) => {
    if (!confirm('Remove this NFC card?')) return;
    try {
      await api.deleteNfcCard(card.id);
      const data = await api.getEmployeeNfcCards(nfcModal.id);
      setNfcCards(data.cards);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetSubmitting(true);
    try {
      await api.resetPassword(resetModal.id, resetPassword);
      setResetModal(null);
      setResetPassword('');
      alert('Password reset successfully. Employee will be required to change it on next login.');
    } catch (err) {
      alert(err.message);
    } finally {
      setResetSubmitting(false);
    }
  };

  const openEditModal = (emp) => {
    setEditModal(emp);
    setEditForm({
      name: emp.name,
      email: emp.email,
      department: emp.department || '',
      designation: emp.designation || '',
      role: emp.role,
      phone: emp.phone || ''
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditSubmitting(true);
    try {
      await api.updateEmployee(editModal.id, editForm);
      setEditModal(null);
      loadEmployees();
    } catch (err) {
      alert(err.message);
    } finally {
      setEditSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Employees</h2>
          <p className="text-sm text-slate-500 mt-1">Manage company employees</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Add Employee'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">New Employee</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {[
              { key: 'employee_id', label: 'Employee ID', placeholder: 'ARC-006', required: true },
              { key: 'name', label: 'Full Name', placeholder: 'John Doe', required: true },
              { key: 'email', label: 'Email', placeholder: 'john@archisys.com', required: true, type: 'email' },
              { key: 'password', label: 'Password', placeholder: 'Min 6 characters', required: true, type: 'password' },
              { key: 'phone', label: 'Phone', placeholder: '9800000000' },
            ].map((field) => (
              <div key={field.key}>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">{field.label}</label>
                <input
                  type={field.type || 'text'}
                  value={form[field.key]}
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                  required={field.required}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Department</label>
              <select
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select Department</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Designation</label>
              <select
                value={form.designation}
                onChange={(e) => setForm({ ...form, designation: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select Designation</option>
                {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create Employee'}
          </button>
        </form>
      )}

      <div className="bg-white rounded-xl border border-slate-200">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-600 border-t-transparent" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 bg-slate-50">
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 font-medium">Designation</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-semibold">
                          {emp.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{emp.name}</p>
                          <p className="text-xs text-slate-500">{emp.employee_id} &middot; {emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{emp.department}</td>
                    <td className="px-4 py-3 text-slate-600">{emp.designation}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full capitalize bg-slate-100 text-slate-700">
                        {emp.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${emp.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {emp.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(emp)}
                          className="text-xs text-slate-600 hover:text-slate-800 font-medium flex items-center gap-1"
                          title="Edit Employee"
                        >
                          <Edit size={12} /> Edit
                        </button>
                        <button
                          onClick={() => toggleActive(emp)}
                          className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                        >
                          {emp.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => { setResetModal(emp); setResetPassword(''); }}
                          className="text-xs text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1"
                          title="Reset Password"
                        >
                          <KeyRound size={12} /> Reset
                        </button>
                        <span className="w-px h-4 bg-slate-200" />
                        <button
                          onClick={() => openNfcModal(emp)}
                          className="text-xs font-medium flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition"
                          title="Manage NFC Cards"
                        >
                          <CreditCard size={12} /> NFC
                        </button>
                        <span className="w-px h-4 bg-slate-200" />
                        <button
                          onClick={async () => {
                            if (!confirm(`Are you sure you want to permanently delete ${emp.name}? This will remove all their attendance records, leaves, and NFC cards.`)) return;
                            try {
                              await api.deleteEmployee(emp.id);
                              loadEmployees();
                            } catch (err) {
                              alert(err.message);
                            }
                          }}
                          className="text-xs text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
                          title="Delete Employee"
                        >
                          <UserX size={12} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* NFC Card Management Modal */}
      {nfcModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setNfcModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h3 className="text-base font-semibold text-slate-900">NFC Cards</h3>
                <p className="text-xs text-slate-500">{nfcModal.name} ({nfcModal.employee_id})</p>
              </div>
              <button onClick={() => setNfcModal(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>

            <div className="p-5">
              {/* SSE Status */}
              <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-lg text-xs font-medium ${sseConnected ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                <Wifi size={14} className={sseConnected ? 'animate-pulse' : ''} />
                {sseConnected
                  ? detectedUid
                    ? `Card detected: ${detectedUid} — click Assign to link it`
                    : 'Listening... Tap a card on the NFC reader'
                  : 'Connecting to NFC reader...'}
              </div>

              {/* Assign new card */}
              <form onSubmit={handleAssignCard} className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={nfcForm.card_uid}
                  onChange={(e) => { setNfcForm({ ...nfcForm, card_uid: e.target.value }); setDetectedUid(null); }}
                  placeholder={sseConnected ? 'Tap card or type UID...' : 'Card UID (hex)'}
                  required
                  className={`flex-1 px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${detectedUid ? 'border-emerald-400 bg-emerald-50 font-mono' : 'border-slate-300'}`}
                />
                <input
                  type="text"
                  value={nfcForm.label}
                  onChange={(e) => setNfcForm({ ...nfcForm, label: e.target.value })}
                  placeholder="Label (optional)"
                  className="w-32 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  type="submit"
                  disabled={nfcSubmitting}
                  className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {nfcSubmitting ? '...' : 'Assign'}
                </button>
              </form>

              {/* Write Card */}
              <div className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Pencil size={14} className="text-purple-600" />
                    <span className="text-sm font-medium text-purple-800">Write Card</span>
                  </div>
                  <button
                    onClick={handleWriteCard}
                    disabled={writeSubmitting || writeJobs.some(j => j.status === 'pending')}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50"
                  >
                    {writeSubmitting ? '...' : 'Queue Write Job'}
                  </button>
                </div>
                <p className="text-xs text-purple-600 mb-2">Place a card on the NFC reader to write the employee ID to it. The card will be auto-assigned.</p>
                {writeJobs.length > 0 && (
                  <div className="space-y-1.5">
                    {writeJobs.map((job) => (
                      <div key={job.id} className="flex items-center justify-between bg-white rounded px-3 py-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`inline-block w-2 h-2 rounded-full ${
                            job.status === 'pending' ? 'bg-amber-400 animate-pulse' :
                            job.status === 'completed' ? 'bg-emerald-500' :
                            job.status === 'failed' ? 'bg-red-500' : 'bg-slate-400'
                          }`} />
                          <span className="capitalize text-slate-700">{job.status}</span>
                          {job.result_card_uid && <span className="font-mono text-slate-500">({job.result_card_uid})</span>}
                        </div>
                        {job.status === 'pending' && (
                          <button onClick={() => cancelWriteJob(job.id)} className="text-red-500 hover:text-red-700 font-medium">Cancel</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Card list */}
              {nfcCards.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No NFC cards assigned</p>
              ) : (
                <div className="space-y-2">
                  {nfcCards.map((card) => (
                    <div key={card.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3">
                      <div>
                        <p className="text-sm font-mono font-medium text-slate-800">{card.card_uid}</p>
                        <p className="text-xs text-slate-500">{card.label || 'No label'} &middot; {new Date(card.assigned_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${card.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {card.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <button onClick={() => toggleCardActive(card)} className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                          {card.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button onClick={() => deleteCard(card)} className="text-slate-400 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setResetModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Reset Password</h3>
                <p className="text-xs text-slate-500">{resetModal.name} ({resetModal.employee_id})</p>
              </div>
              <button onClick={() => setResetModal(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleResetPassword} className="p-5 space-y-4">
              <p className="text-sm text-slate-600">
                Set a new temporary password. The employee will be required to change it on their next login.
              </p>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">New Password</label>
                <input
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  required
                  minLength={8}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setResetModal(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetSubmitting}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {resetSubmitting ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setEditModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Edit Employee</h3>
                <p className="text-xs text-slate-500">{editModal.employee_id}</p>
              </div>
              <button onClick={() => setEditModal(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Department</label>
                  <select
                    value={editForm.department}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Select Department</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Designation</label>
                  <select
                    value={editForm.designation}
                    onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Select Designation</option>
                    {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Role</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="employee">Employee</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Phone</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="9800000000"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setEditModal(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
