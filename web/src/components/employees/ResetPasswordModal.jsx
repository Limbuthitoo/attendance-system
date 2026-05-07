import { X } from 'lucide-react';

export default function ResetPasswordModal({
  resetModal, setResetModal, resetPassword, setResetPassword,
  resetSubmitting, handleResetPassword,
}) {
  if (!resetModal) return null;

  return (
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
              placeholder="e.g. Temp@1234"
              required
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-slate-400 mt-1">Min 8 chars, uppercase, lowercase, digit, and special character</p>
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
  );
}
