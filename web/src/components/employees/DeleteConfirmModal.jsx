import { UserX } from 'lucide-react';

export default function DeleteConfirmModal({
  deleteModal, setDeleteModal, deleteSubmitting, onConfirm,
}) {
  if (!deleteModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <UserX size={20} className="text-red-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Delete Employee</h3>
        </div>
        <p className="text-sm text-slate-600 mb-2">
          Are you sure you want to permanently delete <span className="font-semibold text-slate-900">{deleteModal.name}</span>?
        </p>
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-5">
          This action cannot be undone. All attendance records, leaves, NFC cards, and other data associated with this employee will be permanently removed.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setDeleteModal(null)}
            disabled={deleteSubmitting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleteSubmitting}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            {deleteSubmitting ? 'Deleting...' : 'Delete Permanently'}
          </button>
        </div>
      </div>
    </div>
  );
}
