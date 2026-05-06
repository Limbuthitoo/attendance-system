import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import {
  Eye, EyeOff, KeyRound, User, Mail, Building, Briefcase, Phone,
  Edit3, Save, X, MapPin, CreditCard, Heart, Plus, Trash2,
} from 'lucide-react';

export default function Profile() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('personal');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  // Emergency contact form
  const [contactForm, setContactForm] = useState({ name: '', relationship: '', phone: '', email: '' });
  const [showContactForm, setShowContactForm] = useState(false);

  useEffect(() => { loadProfile(); }, []);

  async function loadProfile() {
    try {
      const data = await api.getMyProfile();
      setProfile(data.profile);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function startEdit() {
    setEditData({
      phone: profile?.phone || '',
      dateOfBirth: profile?.dateOfBirth ? profile.dateOfBirth.split('T')[0] : '',
      bloodGroup: profile?.bloodGroup || '',
      maritalStatus: profile?.maritalStatus || '',
      gender: profile?.gender || '',
      address: profile?.address || '',
      city: profile?.city || '',
      state: profile?.state || '',
      country: profile?.country || '',
      zipCode: profile?.zipCode || '',
      bankName: profile?.bankName || '',
      bankBranch: profile?.bankBranch || '',
      bankAccountNumber: profile?.bankAccountNumber || '',
      bankAccountName: profile?.bankAccountName || '',
      panNumber: profile?.panNumber || '',
      ssfNumber: profile?.ssfNumber || '',
    });
    setEditMode(true);
    setError('');
    setSuccess('');
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await api.updateMyProfile(editData);
      setEditMode(false);
      setSuccess('Profile updated successfully');
      loadProfile();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddContact(e) {
    e.preventDefault();
    if (!contactForm.name || !contactForm.relationship || !contactForm.phone) return;
    try {
      await api.addEmergencyContact(contactForm);
      setContactForm({ name: '', relationship: '', phone: '', email: '' });
      setShowContactForm(false);
      loadProfile();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteContact(id) {
    if (!confirm('Remove this emergency contact?')) return;
    try {
      await api.deleteEmergencyContact(id);
      loadProfile();
    } catch (err) {
      setError(err.message);
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    if (newPassword.length < 8) { setPwError('New password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { setPwError('Passwords do not match'); return; }
    setPwLoading(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setPwSuccess('Password changed successfully');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err) { setPwError(err.message); }
    finally { setPwLoading(false); }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

  const tabs = [
    { key: 'personal', label: 'Personal Info' },
    { key: 'bank', label: 'Bank & Tax' },
    { key: 'emergency', label: 'Emergency Contacts' },
    { key: 'password', label: 'Security' },
  ];

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-2xl font-bold">
            {user?.name?.charAt(0)}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-slate-900">{user?.name}</h2>
            <p className="text-sm text-slate-500">{user?.email}</p>
            <div className="flex gap-2 mt-1">
              <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-primary-100 text-primary-700 capitalize">{user?.role}</span>
              {profile?.employee_id && <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">{profile.employee_id}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === t.key ? 'bg-primary-50 text-primary-700' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">{error}</div>}
      {success && <div className="text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5">{success}</div>}

      {/* Personal Info Tab */}
      {activeTab === 'personal' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Personal Details</h3>
            {!editMode ? (
              <button onClick={startEdit} className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700">
                <Edit3 size={14} /> Edit
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setEditMode(false)} className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 px-3 py-1.5 border border-slate-300 rounded-lg">
                  <X size={14} /> Cancel
                </button>
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 px-3 py-1.5 rounded-lg disabled:opacity-50">
                  <Save size={14} /> {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            )}
          </div>

          {editMode ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Phone" value={editData.phone} onChange={(v) => setEditData({...editData, phone: v})} />
              <InputField label="Date of Birth" value={editData.dateOfBirth} onChange={(v) => setEditData({...editData, dateOfBirth: v})} type="date" />
              <InputField label="Gender" value={editData.gender} onChange={(v) => setEditData({...editData, gender: v})} />
              <InputField label="Blood Group" value={editData.bloodGroup} onChange={(v) => setEditData({...editData, bloodGroup: v})} />
              <InputField label="Marital Status" value={editData.maritalStatus} onChange={(v) => setEditData({...editData, maritalStatus: v})} />
              <InputField label="Address" value={editData.address} onChange={(v) => setEditData({...editData, address: v})} />
              <InputField label="City" value={editData.city} onChange={(v) => setEditData({...editData, city: v})} />
              <InputField label="State" value={editData.state} onChange={(v) => setEditData({...editData, state: v})} />
              <InputField label="Country" value={editData.country} onChange={(v) => setEditData({...editData, country: v})} />
              <InputField label="Zip Code" value={editData.zipCode} onChange={(v) => setEditData({...editData, zipCode: v})} />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoItem icon={Building} label="Department" value={profile?.department} />
              <InfoItem icon={Briefcase} label="Designation" value={profile?.designation} />
              <InfoItem icon={Phone} label="Phone" value={profile?.phone} />
              <InfoItem icon={User} label="Gender" value={profile?.gender} />
              <InfoItem icon={Heart} label="Date of Birth" value={formatDate(profile?.dateOfBirth)} />
              <InfoItem icon={Heart} label="Blood Group" value={profile?.bloodGroup} />
              <InfoItem icon={Heart} label="Marital Status" value={profile?.maritalStatus} />
              <InfoItem icon={MapPin} label="Address" value={profile?.address} />
              <InfoItem icon={MapPin} label="City / State" value={[profile?.city, profile?.state].filter(Boolean).join(', ')} />
              <InfoItem icon={MapPin} label="Country" value={profile?.country} />
            </div>
          )}
        </div>
      )}

      {/* Bank & Tax Tab */}
      {activeTab === 'bank' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Bank & Tax Details</h3>
            {!editMode ? (
              <button onClick={startEdit} className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700">
                <Edit3 size={14} /> Edit
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setEditMode(false)} className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 px-3 py-1.5 border border-slate-300 rounded-lg">
                  <X size={14} /> Cancel
                </button>
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 px-3 py-1.5 rounded-lg disabled:opacity-50">
                  <Save size={14} /> {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            )}
          </div>

          {editMode ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Bank Name" value={editData.bankName} onChange={(v) => setEditData({...editData, bankName: v})} />
              <InputField label="Bank Branch" value={editData.bankBranch} onChange={(v) => setEditData({...editData, bankBranch: v})} />
              <InputField label="Account Number" value={editData.bankAccountNumber} onChange={(v) => setEditData({...editData, bankAccountNumber: v})} />
              <InputField label="Account Name" value={editData.bankAccountName} onChange={(v) => setEditData({...editData, bankAccountName: v})} />
              <InputField label="PAN Number" value={editData.panNumber} onChange={(v) => setEditData({...editData, panNumber: v})} />
              <InputField label="SSF Number" value={editData.ssfNumber} onChange={(v) => setEditData({...editData, ssfNumber: v})} />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoItem icon={CreditCard} label="Bank Name" value={profile?.bankName} />
                <InfoItem icon={CreditCard} label="Branch" value={profile?.bankBranch} />
                <InfoItem icon={CreditCard} label="Account Number" value={profile?.bankAccountNumber} />
                <InfoItem icon={CreditCard} label="Account Name" value={profile?.bankAccountName} />
              </div>
              <hr className="border-slate-100" />
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tax Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoItem icon={CreditCard} label="PAN Number" value={profile?.panNumber} />
                <InfoItem icon={CreditCard} label="SSF Number" value={profile?.ssfNumber} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Emergency Contacts Tab */}
      {activeTab === 'emergency' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Emergency Contacts</h3>
            <button onClick={() => setShowContactForm(true)} className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700">
              <Plus size={14} /> Add Contact
            </button>
          </div>

          {showContactForm && (
            <form onSubmit={handleAddContact} className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <InputField label="Name *" value={contactForm.name} onChange={(v) => setContactForm({...contactForm, name: v})} />
                <InputField label="Relationship *" value={contactForm.relationship} onChange={(v) => setContactForm({...contactForm, relationship: v})} placeholder="e.g. Father, Spouse" />
                <InputField label="Phone *" value={contactForm.phone} onChange={(v) => setContactForm({...contactForm, phone: v})} />
                <InputField label="Email" value={contactForm.email} onChange={(v) => setContactForm({...contactForm, email: v})} />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 px-4 py-2 rounded-lg">Add</button>
                <button type="button" onClick={() => setShowContactForm(false)} className="text-xs font-medium text-slate-500 hover:text-slate-700 px-4 py-2 border border-slate-300 rounded-lg">Cancel</button>
              </div>
            </form>
          )}

          {profile?.emergencyContacts?.length > 0 ? (
            <div className="space-y-3">
              {profile.emergencyContacts.map(c => (
                <div key={c.id} className="flex items-start gap-3 p-4 rounded-lg border border-slate-200">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800">{c.name}</p>
                      {c.isPrimary && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">PRIMARY</span>}
                    </div>
                    <p className="text-xs text-slate-500">{c.relationship}</p>
                    <div className="flex gap-4 mt-1">
                      {c.phone && <span className="text-xs text-slate-600">{c.phone}</span>}
                      {c.email && <span className="text-xs text-slate-600">{c.email}</span>}
                    </div>
                  </div>
                  <button onClick={() => handleDeleteContact(c.id)} className="text-slate-400 hover:text-red-600">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">No emergency contacts added yet</p>
          )}
        </div>
      )}

      {/* Security / Password Tab */}
      {activeTab === 'password' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound size={18} className="text-slate-600" />
            <h3 className="text-sm font-semibold text-slate-700">Change Password</h3>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            {pwError && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2.5">{pwError}</div>}
            {pwSuccess && <div className="text-sm text-emerald-600 bg-emerald-50 rounded-lg px-4 py-2.5">{pwSuccess}</div>}

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Current Password</label>
              <div className="relative">
                <input type={showCurrent ? 'text' : 'password'} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password" required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 pr-10" />
                <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">New Password</label>
              <div className="relative">
                <input type={showNew ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 8 characters" required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 pr-10" />
                <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Confirm New Password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" required
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>

            <button type="submit" disabled={pwLoading} className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
              {pwLoading ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function InfoItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
      <Icon size={16} className="text-slate-400 mt-0.5" />
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-medium text-slate-800">{value || '—'}</p>
      </div>
    </div>
  );
}

function InputField({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || label}
        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
    </div>
  );
}
