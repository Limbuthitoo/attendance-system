import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn, Eye, EyeOff, Building2 } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [orgOptions, setOrgOptions] = useState(null); // org selection mode
  const [selectedOrg, setSelectedOrg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password, selectedOrg || undefined);
    } catch (err) {
      // If 409 with organizations, show org picker
      if (err.organizations) {
        setOrgOptions(err.organizations);
        setSelectedOrg(err.organizations[0]?.slug || '');
        setError('');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/favicon.svg" alt="Logo" className="h-20 mx-auto mb-3 object-contain" />
          <p className="text-sm text-slate-500">Attendance Management System</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2.5">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 rounded-lg text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <>
                <LogIn size={16} />
                {orgOptions ? 'Sign In to Organization' : 'Sign In'}
              </>
            )}
          </button>

          {orgOptions && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <label className="block text-sm font-medium text-amber-800 mb-2">
                <Building2 size={14} className="inline mr-1" />
                Select your organization
              </label>
              <select
                value={selectedOrg}
                onChange={(e) => setSelectedOrg(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-amber-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {orgOptions.map(org => (
                  <option key={org.slug} value={org.slug}>{org.name}</option>
                ))}
              </select>
              <p className="text-xs text-amber-600 mt-1.5">Your email exists in multiple organizations. Please select one and sign in again.</p>
            </div>
          )}
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          &copy; {new Date().getFullYear()} Archisys Innovations. All rights reserved.
        </p>
      </div>
    </div>
  );
}
