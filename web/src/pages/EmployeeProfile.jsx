import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import DatePicker from '../components/DatePicker';
import {
  ArrowLeft, User, Mail, Phone, Building2, Briefcase, Shield, Clock,
  Calendar, CheckCircle, AlertTriangle, MinusCircle, TrendingUp,
  Heart, FileText, Upload, Trash2, Download, Plus, Save, Edit2, X,
  MapPin, Droplets, Users, BadgeCheck, Hash, Landmark
} from 'lucide-react';

import { STATUS_BADGE_STYLES, STATUS_LABELS } from '../lib/status-config';

const STATUS_BADGE = Object.fromEntries(
  Object.entries(STATUS_BADGE_STYLES).map(([k, v]) => [k, { label: STATUS_LABELS[k], class: v }])
);

const DOC_TYPES = [
  { value: 'citizenship', label: 'Citizenship' },
  { value: 'pan_card', label: 'PAN Card' },
  { value: 'contract', label: 'Employment Contract' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'other', label: 'Other' },
];

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function toDateInput(d) {
  if (!d) return '';
  return new Date(d).toISOString().split('T')[0];
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

export default function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Attendance state
  const [attendance, setAttendance] = useState([]);
  const [summary, setSummary] = useState(null);
  const [attLoading, setAttLoading] = useState(true);
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Emergency contacts
  const [contacts, setContacts] = useState([]);
  const [contactForm, setContactForm] = useState(null);
  const [contactSaving, setContactSaving] = useState(false);

  // Documents
  const [documents, setDocuments] = useState([]);
  const [docUploading, setDocUploading] = useState(false);
  const [docForm, setDocForm] = useState({ name: '', type: 'citizenship' });
  const fileInputRef = useRef(null);

  // Load employee
  useEffect(() => {
    async function load() {
      try {
        const data = await api._request(`/employees/${id}`);
        setEmployee(data.employee);
        setContacts(data.employee.emergencyContacts || []);
        setDocuments(data.employee.documents || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  // Attendance fetch
  const fetchAttendance = useCallback(async () => {
    setAttLoading(true);
    try {
      const data = await api.getEmployeeAttendance(id, startDate, endDate);
      setAttendance(data.attendance || []);
      setSummary(data.summary || null);
    } catch (err) {
      console.error(err);
    } finally {
      setAttLoading(false);
    }
  }, [id, startDate, endDate]);

  useEffect(() => {
    if (activeTab === 'overview') fetchAttendance();
  }, [fetchAttendance, activeTab]);

  // Start editing
  function startEdit() {
    setEditData({
      name: employee.name || '',
      email: employee.email || '',
      phone: employee.phone || '',
      gender: employee.gender || '',
      dateOfBirth: toDateInput(employee.dateOfBirth),
      bloodGroup: employee.bloodGroup || '',
      maritalStatus: employee.maritalStatus || '',
      address: employee.address || '',
      city: employee.city || '',
      state: employee.state || '',
      country: employee.country || '',
      zipCode: employee.zipCode || '',
      department: employee.department || '',
      designation: employee.designation || '',
      joinDate: toDateInput(employee.joinDate),
      employmentStatus: employee.employmentStatus || 'active',
      contractType: employee.contractType || '',
      probationEndDate: toDateInput(employee.probationEndDate),
      panNumber: employee.panNumber || '',
      ssfNumber: employee.ssfNumber || '',
      bankName: employee.bankName || '',
      bankBranch: employee.bankBranch || '',
      bankAccountNumber: employee.bankAccountNumber || '',
      bankAccountName: employee.bankAccountName || '',
    });
    setEditing(true);
    setSaveMsg('');
  }

  async function saveProfile() {
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await api._request(`/employees/${id}`, {
        method: 'PUT',
        body: JSON.stringify(editData),
      });
      setEmployee(prev => ({ ...prev, ...res.employee }));
      setEditing(false);
      setSaveMsg('Profile updated successfully');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setSaveMsg(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Emergency contacts
  async function addContact() {
    if (!contactForm.name || !contactForm.relationship || !contactForm.phone) return;
    setContactSaving(true);
    try {
      const res = await api._request(`/employees/${id}/emergency-contacts`, {
        method: 'POST',
        body: JSON.stringify(contactForm),
      });
      setContacts(prev => [...prev, res.contact]);
      setContactForm(null);
    } catch (err) {
      console.error(err);
    } finally {
      setContactSaving(false);
    }
  }

  async function deleteContact(contactId) {
    try {
      await api._request(`/employees/${id}/emergency-contacts/${contactId}`, { method: 'DELETE' });
      setContacts(prev => prev.filter(c => c.id !== contactId));
    } catch (err) {
      console.error(err);
    }
  }

  // Documents
  async function uploadDocument(file) {
    if (!file || !docForm.name || !docForm.type) return;
    setDocUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', docForm.name);
      formData.append('type', docForm.type);

      const token = localStorage.getItem('token');
      const apiBase = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiBase}/api/v1/employees/${id}/documents`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setDocuments(prev => [data.document, ...prev]);
      setDocForm({ name: '', type: 'citizenship' });
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error(err);
    } finally {
      setDocUploading(false);
    }
  }

  async function deleteDocument(docId) {
    try {
      await api._request(`/employees/${id}/documents/${docId}`, { method: 'DELETE' });
      setDocuments(prev => prev.filter(d => d.id !== docId));
    } catch (err) {
      console.error(err);
    }
  }

  function downloadDocument(docId, name) {
    const token = localStorage.getItem('token');
    const apiBase = import.meta.env.VITE_API_URL || '';
    const url = `${apiBase}/api/v1/employees/${id}/documents/${docId}/download`;
    fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        URL.revokeObjectURL(a.href);
      });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Employee not found</p>
        <button onClick={() => navigate('/employees')} className="text-primary-600 text-sm mt-2">← Back to Employees</button>
      </div>
    );
  }

  const tabs = [
    { key: 'overview', label: 'Overview', icon: TrendingUp },
    { key: 'personal', label: 'Personal', icon: User },
    { key: 'employment', label: 'Employment', icon: Briefcase },
    { key: 'bank', label: 'Bank & Tax', icon: Landmark },
    { key: 'emergency', label: 'Emergency Contacts', icon: Heart },
    { key: 'documents', label: 'Documents', icon: FileText },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/employees')} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-slate-900">Employee Profile</h1>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-2xl font-bold shrink-0">
            {employee.name?.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-slate-900">{employee.name}</h2>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full capitalize bg-slate-100 text-slate-700">{employee.role}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${employee.isActive || employee.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {employee.isActive || employee.is_active ? 'Active' : 'Inactive'}
              </span>
              {employee.employmentStatus && employee.employmentStatus !== 'active' && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 capitalize">
                  {employee.employmentStatus.replace('_', ' ')}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-1">{employee.employeeCode || employee.employee_id}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Mail size={14} className="text-slate-400" /> {employee.email}
              </div>
              {employee.phone && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Phone size={14} className="text-slate-400" /> {employee.phone}
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Building2 size={14} className="text-slate-400" /> {employee.department}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Briefcase size={14} className="text-slate-400" /> {employee.designation}
              </div>
            </div>
          </div>
          {!editing && (
            <button
              onClick={startEdit}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50 transition"
            >
              <Edit2 size={14} /> Edit
            </button>
          )}
        </div>
      </div>

      {saveMsg && (
        <div className={`text-sm px-4 py-3 rounded-lg border ${saveMsg.includes('success') ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          {saveMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === t.key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* ===== Overview Tab ===== */}
      {activeTab === 'overview' && (
        <>
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: 'Total Days', value: summary.totalDays, icon: Calendar, color: 'text-slate-600', bg: 'bg-slate-50' },
                { label: 'Present', value: summary.presentDays, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Late', value: summary.lateDays, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
                { label: 'Half Day', value: summary.halfDays, icon: MinusCircle, color: 'text-orange-600', bg: 'bg-orange-50' },
                { label: 'Avg Hours', value: summary.avgHours + 'h', icon: TrendingUp, color: 'text-primary-600', bg: 'bg-primary-50' },
              ].map(s => (
                <div key={s.label} className={`flex items-center gap-3 p-3 rounded-xl border border-slate-200 ${s.bg}`}>
                  <s.icon size={20} className={s.color} />
                  <div>
                    <p className="text-lg font-bold text-slate-900">{s.value}</p>
                    <p className="text-[10px] text-slate-500">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Date Range Filter */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <span className="text-sm font-medium text-slate-700">Date Range:</span>
              <div className="flex items-center gap-2">
                <div className="w-44">
                  <DatePicker value={startDate} onChange={setStartDate} placeholder="Start date" />
                </div>
                <span className="text-slate-400 text-sm">to</span>
                <div className="w-44">
                  <DatePicker value={endDate} onChange={setEndDate} placeholder="End date" />
                </div>
              </div>
              <div className="flex gap-2">
                {[{ label: '7D', days: 7 }, { label: '30D', days: 30 }, { label: '90D', days: 90 }].map(p => (
                  <button
                    key={p.label}
                    onClick={() => { setStartDate(new Date(Date.now() - p.days * 86400000).toISOString().split('T')[0]); setEndDate(today); }}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Attendance Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Attendance History</h3>
              <span className="text-xs text-slate-400">{attendance.length} records</span>
            </div>
            {attLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-600 border-t-transparent" />
              </div>
            ) : attendance.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <Clock size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No attendance records</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 bg-slate-50">
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Check In</th>
                      <th className="px-4 py-3 font-medium">Check Out</th>
                      <th className="px-4 py-3 font-medium">Hours</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {attendance.map(a => {
                      const badge = STATUS_BADGE[a.status] || STATUS_BADGE.present;
                      return (
                        <tr key={a.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-800">{formatDate(a.date)}</td>
                          <td className="px-4 py-3 text-slate-600">{formatTime(a.check_in)}</td>
                          <td className="px-4 py-3 text-slate-600">{formatTime(a.check_out)}</td>
                          <td className="px-4 py-3 text-slate-600">{a.work_hours ? `${a.work_hours}h` : '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.class}`}>{badge.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== Personal Info Tab ===== */}
      {activeTab === 'personal' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <User size={18} className="text-blue-600" />
            </div>
            <h2 className="text-base font-semibold text-slate-900">Personal Information</h2>
          </div>

          {editing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Full Name" value={editData.name} onChange={v => setEditData(p => ({ ...p, name: v }))} />
              <Field label="Email" type="email" value={editData.email} onChange={v => setEditData(p => ({ ...p, email: v }))} />
              <Field label="Phone" value={editData.phone} onChange={v => setEditData(p => ({ ...p, phone: v }))} />
              <SelectField label="Gender" value={editData.gender} onChange={v => setEditData(p => ({ ...p, gender: v }))} options={[{ value: '', label: 'Select' }, { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }]} />
              <Field label="Date of Birth" type="date" value={editData.dateOfBirth} onChange={v => setEditData(p => ({ ...p, dateOfBirth: v }))} />
              <SelectField label="Blood Group" value={editData.bloodGroup} onChange={v => setEditData(p => ({ ...p, bloodGroup: v }))} options={[{ value: '', label: 'Select' }, ...['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(v => ({ value: v, label: v }))]} />
              <SelectField label="Marital Status" value={editData.maritalStatus} onChange={v => setEditData(p => ({ ...p, maritalStatus: v }))} options={[{ value: '', label: 'Select' }, { value: 'single', label: 'Single' }, { value: 'married', label: 'Married' }, { value: 'divorced', label: 'Divorced' }, { value: 'widowed', label: 'Widowed' }]} />
              <Field label="Address" value={editData.address} onChange={v => setEditData(p => ({ ...p, address: v }))} />
              <Field label="City" value={editData.city} onChange={v => setEditData(p => ({ ...p, city: v }))} />
              <Field label="State/Province" value={editData.state} onChange={v => setEditData(p => ({ ...p, state: v }))} />
              <Field label="Country" value={editData.country} onChange={v => setEditData(p => ({ ...p, country: v }))} />
              <Field label="Zip Code" value={editData.zipCode} onChange={v => setEditData(p => ({ ...p, zipCode: v }))} />

              <div className="col-span-full flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
                  <X size={14} className="inline mr-1" /> Cancel
                </button>
                <button onClick={saveProfile} disabled={saving} className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
                  {saving ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <Save size={14} />}
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
              <InfoRow icon={User} label="Full Name" value={employee.name} />
              <InfoRow icon={Mail} label="Email" value={employee.email} />
              <InfoRow icon={Phone} label="Phone" value={employee.phone} />
              <InfoRow icon={User} label="Gender" value={employee.gender} capitalize />
              <InfoRow icon={Calendar} label="Date of Birth" value={toDateInput(employee.dateOfBirth) ? formatDate(toDateInput(employee.dateOfBirth)) : null} />
              <InfoRow icon={Droplets} label="Blood Group" value={employee.bloodGroup} />
              <InfoRow icon={Heart} label="Marital Status" value={employee.maritalStatus} capitalize />
              <InfoRow icon={MapPin} label="Address" value={[employee.address, employee.city, employee.state].filter(Boolean).join(', ')} />
              <InfoRow icon={MapPin} label="Country" value={employee.country} />
              <InfoRow icon={Hash} label="Zip Code" value={employee.zipCode} />
            </div>
          )}
        </div>
      )}

      {/* ===== Employment Tab ===== */}
      {activeTab === 'employment' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Briefcase size={18} className="text-indigo-600" />
            </div>
            <h2 className="text-base font-semibold text-slate-900">Employment Information</h2>
          </div>

          {editing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Department" value={editData.department} onChange={v => setEditData(p => ({ ...p, department: v }))} />
              <Field label="Designation" value={editData.designation} onChange={v => setEditData(p => ({ ...p, designation: v }))} />
              <Field label="Join Date" type="date" value={editData.joinDate} onChange={v => setEditData(p => ({ ...p, joinDate: v }))} />
              <SelectField label="Employment Status" value={editData.employmentStatus} onChange={v => setEditData(p => ({ ...p, employmentStatus: v }))} options={[{ value: 'active', label: 'Active' }, { value: 'probation', label: 'Probation' }, { value: 'notice_period', label: 'Notice Period' }]} />
              <SelectField label="Contract Type" value={editData.contractType} onChange={v => setEditData(p => ({ ...p, contractType: v }))} options={[{ value: '', label: 'Select' }, { value: 'permanent', label: 'Permanent' }, { value: 'contract', label: 'Contract' }, { value: 'part_time', label: 'Part Time' }, { value: 'intern', label: 'Intern' }]} />
              <Field label="Probation End Date" type="date" value={editData.probationEndDate} onChange={v => setEditData(p => ({ ...p, probationEndDate: v }))} />

              <div className="col-span-full flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
                  <X size={14} className="inline mr-1" /> Cancel
                </button>
                <button onClick={saveProfile} disabled={saving} className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
                  {saving ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <Save size={14} />}
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
              <InfoRow icon={Building2} label="Department" value={employee.department} />
              <InfoRow icon={Briefcase} label="Designation" value={employee.designation} />
              <InfoRow icon={Calendar} label="Join Date" value={toDateInput(employee.joinDate) ? formatDate(toDateInput(employee.joinDate)) : null} />
              <InfoRow icon={BadgeCheck} label="Employment Status" value={employee.employmentStatus} capitalize />
              <InfoRow icon={FileText} label="Contract Type" value={employee.contractType?.replace('_', ' ')} capitalize />
              <InfoRow icon={Calendar} label="Probation End" value={toDateInput(employee.probationEndDate) ? formatDate(toDateInput(employee.probationEndDate)) : null} />
              {employee.currentAssignment && (
                <>
                  <InfoRow icon={Building2} label="Branch" value={employee.currentAssignment.branch?.name} />
                  <InfoRow icon={Clock} label="Shift" value={employee.currentAssignment.shift ? `${employee.currentAssignment.shift.name} (${employee.currentAssignment.shift.startTime}–${employee.currentAssignment.shift.endTime})` : null} />
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===== Bank & Tax Tab ===== */}
      {activeTab === 'bank' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Landmark size={18} className="text-emerald-600" />
            </div>
            <h2 className="text-base font-semibold text-slate-900">Bank & Tax Details</h2>
          </div>

          {editing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Bank Name" value={editData.bankName} onChange={v => setEditData(p => ({ ...p, bankName: v }))} />
              <Field label="Bank Branch" value={editData.bankBranch} onChange={v => setEditData(p => ({ ...p, bankBranch: v }))} />
              <Field label="Account Number" value={editData.bankAccountNumber} onChange={v => setEditData(p => ({ ...p, bankAccountNumber: v }))} />
              <Field label="Account Holder Name" value={editData.bankAccountName} onChange={v => setEditData(p => ({ ...p, bankAccountName: v }))} />
              <Field label="PAN Number" value={editData.panNumber} onChange={v => setEditData(p => ({ ...p, panNumber: v }))} />
              <Field label="SSF Number" value={editData.ssfNumber} onChange={v => setEditData(p => ({ ...p, ssfNumber: v }))} />

              <div className="col-span-full flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
                  <X size={14} className="inline mr-1" /> Cancel
                </button>
                <button onClick={saveProfile} disabled={saving} className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
                  {saving ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <Save size={14} />}
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
              <InfoRow icon={Landmark} label="Bank Name" value={employee.bankName} />
              <InfoRow icon={Building2} label="Bank Branch" value={employee.bankBranch} />
              <InfoRow icon={Hash} label="Account Number" value={employee.bankAccountNumber} />
              <InfoRow icon={User} label="Account Holder" value={employee.bankAccountName} />
              <InfoRow icon={Hash} label="PAN Number" value={employee.panNumber} />
              <InfoRow icon={Hash} label="SSF Number" value={employee.ssfNumber} />
            </div>
          )}
        </div>
      )}

      {/* ===== Emergency Contacts Tab ===== */}
      {activeTab === 'emergency' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
                  <Heart size={18} className="text-red-600" />
                </div>
                <h2 className="text-base font-semibold text-slate-900">Emergency Contacts</h2>
              </div>
              {!contactForm && (
                <button onClick={() => setContactForm({ name: '', relationship: '', phone: '', email: '', isPrimary: false })} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50">
                  <Plus size={14} /> Add Contact
                </button>
              )}
            </div>

            {contacts.length === 0 && !contactForm && (
              <div className="text-center py-10 text-slate-400">
                <Users size={36} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No emergency contacts added</p>
              </div>
            )}

            {contacts.length > 0 && (
              <div className="divide-y divide-slate-100 mt-4">
                {contacts.map(c => (
                  <div key={c.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {c.name}
                        {c.isPrimary && <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary-100 text-primary-700">Primary</span>}
                      </p>
                      <p className="text-xs text-slate-500">{c.relationship} · {c.phone}{c.email ? ` · ${c.email}` : ''}</p>
                    </div>
                    <button onClick={() => deleteContact(c.id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {contactForm && (
              <div className="mt-4 p-4 bg-slate-50 rounded-lg space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input type="text" placeholder="Name *" value={contactForm.name} onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  <input type="text" placeholder="Relationship *" value={contactForm.relationship} onChange={e => setContactForm(p => ({ ...p, relationship: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  <input type="text" placeholder="Phone *" value={contactForm.phone} onChange={e => setContactForm(p => ({ ...p, phone: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  <input type="email" placeholder="Email (optional)" value={contactForm.email} onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))} className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={contactForm.isPrimary} onChange={e => setContactForm(p => ({ ...p, isPrimary: e.target.checked }))} className="rounded" />
                  Primary contact
                </label>
                <div className="flex gap-2">
                  <button onClick={() => setContactForm(null)} className="px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100">Cancel</button>
                  <button onClick={addContact} disabled={contactSaving || !contactForm.name || !contactForm.phone || !contactForm.relationship} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
                    {contactSaving ? <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" /> : <Plus size={14} />}
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== Documents Tab ===== */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          {/* Upload Form */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center">
                <Upload size={18} className="text-violet-600" />
              </div>
              <h2 className="text-base font-semibold text-slate-900">Upload Document</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              <input
                type="text"
                placeholder="Document Name *"
                value={docForm.name}
                onChange={e => setDocForm(p => ({ ...p, name: e.target.value }))}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <select
                value={docForm.type}
                onChange={e => setDocForm(p => ({ ...p, type: e.target.value }))}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.webp"
                  onChange={e => { if (e.target.files[0]) uploadDocument(e.target.files[0]); }}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={docUploading || !docForm.name}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {docUploading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <Upload size={14} />}
                  {docUploading ? 'Uploading...' : 'Choose & Upload'}
                </button>
              </div>
            </div>
          </div>

          {/* Document List */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-700">Documents ({documents.length})</h3>
            </div>
            {documents.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <FileText size={36} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No documents uploaded</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {documents.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                        <FileText size={16} className="text-slate-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{doc.name}</p>
                        <p className="text-xs text-slate-400">
                          {DOC_TYPES.find(t => t.value === doc.type)?.label || doc.type}
                          {doc.fileSize ? ` · ${formatFileSize(doc.fileSize)}` : ''}
                          {doc.uploadedAt ? ` · ${new Date(doc.uploadedAt).toLocaleDateString()}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => downloadDocument(doc.id, doc.name)} className="p-2 rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600">
                        <Download size={14} />
                      </button>
                      <button onClick={() => deleteDocument(doc.id)} className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helper Components ─────────────────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value, capitalize }) {
  return (
    <div className="flex items-start gap-3 py-1">
      <Icon size={15} className="text-slate-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className={`text-sm font-medium text-slate-800 ${capitalize ? 'capitalize' : ''}`}>{value || '—'}</p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
