import { X, Wifi, Trash2, CreditCard } from 'lucide-react';

export default function NfcModal({
  nfcModal, setNfcModal, nfcCards, nfcForm, setNfcForm,
  nfcSubmitting, handleAssignCard, toggleCardActive, deleteCard,
  sseConnected, readerOnline, detectedUid, setDetectedUid,
}) {
  if (!nfcModal) return null;

  return (
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
          {/* Reader Status */}
          <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-lg text-xs font-medium ${
            readerOnline === false
              ? 'bg-red-50 text-red-700 border border-red-200'
              : sseConnected
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}>
            <Wifi size={14} className={sseConnected && readerOnline !== false ? 'animate-pulse' : ''} />
            {readerOnline === false
              ? 'NFC reader device is disconnected'
              : sseConnected
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
  );
}
