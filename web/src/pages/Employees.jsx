import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Plus, X, UserCog, CreditCard, Trash2, KeyRound, UserX, Edit, Wifi, LockOpen, Building2, Briefcase, Search } from 'lucide-react';
import DatePicker from '../components/DatePicker';
import NfcModal from '../components/employees/NfcModal';
import ResetPasswordModal from '../components/employees/ResetPasswordModal';
import EditEmployeeModal from '../components/employees/EditEmployeeModal';
import DeleteConfirmModal from '../components/employees/DeleteConfirmModal';

// Fallback lists used when org has no custom departments/designations yet
const DEFAULT_DEPARTMENTS = [
  'Engineering', 'Design', 'Digital Marketing', 'Content & Media', 'SEO',
  'Sales', 'Human Resources', 'Finance', 'Operations', 'Quality Assurance',
  'DevOps', 'Product', 'Customer Support', 'Administration', 'Data & Analytics',
];

const DEFAULT_DESIGNATIONS = [
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
  const [nfcModal, setNfcModal] = useState(null);
  const [nfcCards, setNfcCards] = useState([]);
  const [nfcForm, setNfcForm] = useState({ card_uid: '', label: '' });
  const [nfcSubmitting, setNfcSubmitting] = useState(false);

  const [sseConnected, setSseConnected] = useState(false);
  const [readerOnline, setReaderOnline] = useState(null);
  const [detectedUid, setDetectedUid] = useState(null);
  const sseRef = useRef(null);
  const sseConnectedRef = useRef(false);
  const [resetModal, setResetModal] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', department: '', designation: '', role: '', phone: '' });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [deleteModal, setDeleteModal] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Master data
  const [deptList, setDeptList] = useState([]);
  const [desigList, setDesigList] = useState([]);
  const [branches, setBranches] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [roles, setRoles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDept, setFilterDept] = useState('');

  // Add new dept/desig inline
  const [newDeptName, setNewDeptName] = useState('');
  const [newDesigName, setNewDesigName] = useState('');
  const [addingDept, setAddingDept] = useState(false);
  const [addingDesig, setAddingDesig] = useState(false);

  const [form, setForm] = useState({
    employee_id: '', name: '', email: '', password: '',
    department: '', designation: '', role: 'employee', phone: '',
    branchId: '', shiftId: '', workScheduleId: '',
    gender: '', joinDate: '', contractType: '',
  });

  // Computed department & designation lists (DB records or fallback defaults)
  const departmentNames = deptList.length > 0
    ? deptList.filter(d => d.isActive !== false).map(d => d.name)
    : DEFAULT_DEPARTMENTS;
  const designationNames = desigList.length > 0
    ? desigList.filter(d => d.isActive !== false).map(d => d.name)
    : DEFAULT_DESIGNATIONS;

  const loadMasterData = useCallback(async () => {
    try {
      const [deptRes, desigRes, brRes, shRes, scRes, roleRes] = await Promise.all([
        api.getDepartments().catch(() => ({ departments: [] })),
        api.getDesignations().catch(() => ({ designations: [] })),
        api._request('/branches').catch(() => ({ branches: [] })),
        api._request('/settings/shifts').catch(() => ({ shifts: [] })),
        api._request('/settings/work-schedules').catch(() => ({ schedules: [] })),
        api._request('/roles').catch(() => ({ roles: [] })),
      ]);
      setDeptList(deptRes.departments || []);
      setDesigList(desigRes.designations || []);
      setBranches(brRes.branches || brRes.data || []);
      setShifts(shRes.shifts || shRes.data || []);
      setSchedules(scRes.schedules || scRes.data || []);
      setRoles(roleRes.roles || roleRes.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadEmployees();
    loadMasterData();
  }, [loadMasterData]);

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
      const payload = { ...form };
      // Clean empty optional fields
      if (!payload.branchId) delete payload.branchId;
      if (!payload.shiftId) delete payload.shiftId;
      if (!payload.workScheduleId) delete payload.workScheduleId;
      if (!payload.gender) delete payload.gender;
      if (!payload.joinDate) delete payload.joinDate;
      if (!payload.contractType) delete payload.contractType;
      await api.createEmployee(payload);
      setShowForm(false);
      setForm({
        employee_id: '', name: '', email: '', password: '',
        department: '', designation: '', role: 'employee', phone: '',
        branchId: '', shiftId: '', workScheduleId: '',
        gender: '', joinDate: '', contractType: '',
      });
      loadEmployees();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddDepartment = async () => {
    if (!newDeptName.trim()) return;
    setAddingDept(true);
    try {
      await api.createDepartment({ name: newDeptName.trim() });
      setNewDeptName('');
      setForm(f => ({ ...f, department: newDeptName.trim() }));
      const res = await api.getDepartments();
      setDeptList(res.departments || []);
    } catch (err) {
      alert(err.message);
    } finally {
      setAddingDept(false);
    }
  };

  const handleAddDesignation = async () => {
    if (!newDesigName.trim()) return;
    setAddingDesig(true);
    try {
      await api.createDesignation({ name: newDesigName.trim() });
      setNewDesigName('');
      setForm(f => ({ ...f, designation: newDesigName.trim() }));
      const res = await api.getDesignations();
      setDesigList(res.designations || []);
    } catch (err) {
      alert(err.message);
    } finally {
      setAddingDesig(false);
    }
  };

  const toggleActive = async (emp) => {
    const action = emp.is_active ? 'deactivate' : 'activate';
    if (emp.is_active && !confirm(`Are you sure you want to deactivate ${emp.name}? They will lose access immediately.`)) return;
    try {
      if (emp.is_active) {
        await api.deactivateEmployee(emp.id);
      } else {
        await api.activateEmployee(emp.id);
      }
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

  // Poll reader status while modal is open
  useEffect(() => {
    if (!nfcModal) {
      setReaderOnline(null);
      return;
    }
    const checkReader = async () => {
      try {
        const data = await api.getReaderStatus();
        setReaderOnline(data.anyReaderConnected);
      } catch {
        setReaderOnline(null);
      }
    };
    checkReader();
    const timer = setInterval(checkReader, 5000);
    return () => clearInterval(timer);
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
    // Client-side password validation (mirrors server requirements)
    const pw = resetPassword;
    const failures = [];
    if (pw.length < 8) failures.push('at least 8 characters');
    if (!/[A-Z]/.test(pw)) failures.push('one uppercase letter');
    if (!/[a-z]/.test(pw)) failures.push('one lowercase letter');
    if (!/[0-9]/.test(pw)) failures.push('one digit');
    if (!/[^A-Za-z0-9]/.test(pw)) failures.push('one special character (!@#$%^&*)');
    if (failures.length > 0) {
      alert(`Password must contain: ${failures.join(', ')}`);
      return;
    }
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

  const handleUnlock = async (emp) => {
    if (!confirm(`Unlock account for ${emp.name}?`)) return;
    try {
      await api.unlockAccount(emp.id);
      loadEmployees();
      alert(`Account for ${emp.name} has been unlocked.`);
    } catch (err) {
      alert(err.message);
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

          {/* Section 1: Basic Info */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Basic Information</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Employee ID <span className="text-red-500">*</span></label>
                <input type="text" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                  placeholder="ARC-007" required className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Full Name <span className="text-red-500">*</span></label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="John Doe" required className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Email <span className="text-red-500">*</span></label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="john@archisys.com" required className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Password <span className="text-red-500">*</span></label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="e.g. Temp@1234" required className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Phone</label>
                <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="9800000000" className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Gender</label>
                <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Department & Designation */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Department & Role</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Department</label>
                <div className="flex gap-2">
                  <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                    <option value="">Select Department</option>
                    {departmentNames.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                {/* Inline add */}
                <div className="flex gap-1.5 mt-1.5">
                  <input type="text" value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)}
                    placeholder="+ New department" className="flex-1 px-2 py-1 rounded border border-dashed border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-primary-400"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddDepartment())} />
                  {newDeptName && (
                    <button type="button" onClick={handleAddDepartment} disabled={addingDept}
                      className="px-2 py-1 rounded bg-primary-50 text-primary-600 text-xs font-medium hover:bg-primary-100 transition disabled:opacity-50">
                      {addingDept ? '...' : 'Add'}
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Designation</label>
                <div className="flex gap-2">
                  <select value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                    <option value="">Select Designation</option>
                    {designationNames.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="flex gap-1.5 mt-1.5">
                  <input type="text" value={newDesigName} onChange={(e) => setNewDesigName(e.target.value)}
                    placeholder="+ New designation" className="flex-1 px-2 py-1 rounded border border-dashed border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-primary-400"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddDesignation())} />
                  {newDesigName && (
                    <button type="button" onClick={handleAddDesignation} disabled={addingDesig}
                      className="px-2 py-1 rounded bg-primary-50 text-primary-600 text-xs font-medium hover:bg-primary-100 transition disabled:opacity-50">
                      {addingDesig ? '...' : 'Add'}
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                  {roles.filter(r => !['org_admin', 'employee'].includes(r.name)).map(r => (
                    <option key={r.id} value={r.id}>{r.displayName || r.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Assignment (Branch/Shift/Schedule) */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Assignment <span className="text-slate-400 font-normal normal-case">(optional)</span></p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Branch</label>
                <select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="">Select Branch</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Shift</label>
                <select value={form.shiftId} onChange={(e) => setForm({ ...form, shiftId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="">Select Shift</option>
                  {shifts.map(s => <option key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Work Schedule</label>
                <select value={form.workScheduleId} onChange={(e) => setForm({ ...form, workScheduleId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="">Select Schedule</option>
                  {schedules.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Join Date</label>
                <DatePicker value={form.joinDate} onChange={v => setForm({ ...form, joinDate: v })} placeholder="Join Date" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={submitting}
              className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
              {submitting ? 'Creating...' : 'Create Employee'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-slate-200">
        {/* Search & Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-slate-100">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, ID..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">All Departments</option>
            {[...new Set(employees.map(e => e.department).filter(Boolean))].sort().map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <span className="text-xs text-slate-400">
            {employees.length} employee{employees.length !== 1 ? 's' : ''}
          </span>
        </div>
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
                {employees
                  .filter(emp => {
                    if (filterDept && emp.department !== filterDept) return false;
                    if (searchQuery) {
                      const q = searchQuery.toLowerCase();
                      return emp.name.toLowerCase().includes(q) ||
                        emp.email.toLowerCase().includes(q) ||
                        (emp.employee_id || '').toLowerCase().includes(q) ||
                        (emp.designation || '').toLowerCase().includes(q);
                    }
                    return true;
                  })
                  .map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-semibold">
                          {emp.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Link to={`/employees/${emp.id}`} className="font-medium text-slate-900 hover:text-primary-600 transition">{emp.name}</Link>
                            {emp.lockedUntil && new Date(emp.lockedUntil) > new Date() && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700">LOCKED</span>
                            )}
                          </div>
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
                        {emp.lockedUntil && new Date(emp.lockedUntil) > new Date() && (
                          <button
                            onClick={() => handleUnlock(emp)}
                            className="text-xs text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1"
                            title="Unlock Account"
                          >
                            <LockOpen size={12} /> Unlock
                          </button>
                        )}
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
                          onClick={() => setDeleteModal(emp)}
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
      <NfcModal
        nfcModal={nfcModal} setNfcModal={setNfcModal}
        nfcCards={nfcCards} nfcForm={nfcForm} setNfcForm={setNfcForm}
        nfcSubmitting={nfcSubmitting} handleAssignCard={handleAssignCard}
        toggleCardActive={toggleCardActive} deleteCard={deleteCard}
        sseConnected={sseConnected} readerOnline={readerOnline}
        detectedUid={detectedUid} setDetectedUid={setDetectedUid}
      />

      {/* Reset Password Modal */}
      <ResetPasswordModal
        resetModal={resetModal} setResetModal={setResetModal}
        resetPassword={resetPassword} setResetPassword={setResetPassword}
        resetSubmitting={resetSubmitting} handleResetPassword={handleResetPassword}
      />

      {/* Edit Employee Modal */}
      <EditEmployeeModal
        editModal={editModal} setEditModal={setEditModal}
        editForm={editForm} setEditForm={setEditForm}
        editSubmitting={editSubmitting} handleEditSubmit={handleEditSubmit}
        departments={departmentNames} designations={designationNames}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        deleteModal={deleteModal} setDeleteModal={setDeleteModal}
        deleteSubmitting={deleteSubmitting}
        onConfirm={async () => {
          setDeleteSubmitting(true);
          try {
            await api.deleteEmployee(deleteModal.id);
            setDeleteModal(null);
            loadEmployees();
          } catch (err) {
            alert(err.message);
          } finally {
            setDeleteSubmitting(false);
          }
        }}
      />
    </div>
  );
}
