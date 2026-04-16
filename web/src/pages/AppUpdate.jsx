import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { Upload, Smartphone, Trash2, Download, AlertTriangle, CheckCircle, FileText } from 'lucide-react';

export default function AppUpdate() {
  const [release, setRelease] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [version, setVersion] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [isMandatory, setIsMandatory] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchRelease();
  }, []);

  async function fetchRelease() {
    setLoading(true);
    try {
      const data = await api._request('/app-update/current');
      setRelease(data.release);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.endsWith('.apk')) {
        setError('Only .apk files are allowed');
        return;
      }
      if (file.size > 100 * 1024 * 1024) {
        setError('File too large. Maximum size is 100MB.');
        return;
      }
      setSelectedFile(file);
      setError('');
    }
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!selectedFile || !version) {
      setError('APK file and version are required');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('apk', selectedFile);
      formData.append('version', version);
      formData.append('release_notes', releaseNotes);
      formData.append('is_mandatory', isMandatory ? '1' : '0');

      await api._request('/app-update/upload', {
        method: 'POST',
        body: formData,
        headers: {}, // Let browser set content-type with boundary
      });

      setSuccess('APK uploaded successfully! Android devices will be notified on next app launch.');
      setSelectedFile(null);
      setVersion('');
      setReleaseNotes('');
      setIsMandatory(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchRelease();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete current release? Users will no longer be prompted to update.')) return;
    try {
      await api._request('/app-update/current', { method: 'DELETE' });
      setRelease(null);
      setSuccess('Release deleted');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  }

  function formatSize(bytes) {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">App Update Manager</h1>
        <p className="text-sm text-slate-500 mt-1">Upload APK files to push updates to Android devices. Users will be prompted to update on next app launch.</p>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">{error}</div>}
      {success && <div className="bg-emerald-50 text-emerald-700 text-sm px-4 py-3 rounded-lg border border-emerald-200 flex items-center gap-2"><CheckCircle size={16} />{success}</div>}

      {/* Current Release */}
      {release && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-lg bg-green-50">
                <Smartphone size={22} className="text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Current Release</h2>
                <p className="text-xs text-slate-400">Live on server — users will see this version</p>
              </div>
            </div>
            <button
              onClick={handleDelete}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
              title="Delete release"
            >
              <Trash2 size={18} />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 rounded-lg p-4">
            <div>
              <p className="text-xs text-slate-500 mb-1">Version</p>
              <p className="text-lg font-bold text-slate-900">{release.version}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">File Size</p>
              <p className="text-lg font-bold text-slate-900">{formatSize(release.file_size)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Type</p>
              <p className={`text-sm font-semibold ${release.is_mandatory ? 'text-red-600' : 'text-blue-600'}`}>
                {release.is_mandatory ? 'Mandatory' : 'Optional'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Uploaded</p>
              <p className="text-sm font-medium text-slate-700">
                {new Date(release.uploaded_at + 'Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>

          {release.release_notes && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs font-semibold text-blue-700 mb-1">Release Notes</p>
              <p className="text-sm text-blue-800 whitespace-pre-wrap">{release.release_notes}</p>
            </div>
          )}

          {release.uploaded_by_name && (
            <p className="text-xs text-slate-400 mt-3">Uploaded by {release.uploaded_by_name}</p>
          )}
        </div>
      )}

      {/* Upload New APK */}
      <form onSubmit={handleUpload} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-lg bg-blue-50">
            <Upload size={22} className="text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{release ? 'Upload New Version' : 'Upload APK'}</h2>
            <p className="text-xs text-slate-400">{release ? 'This will replace the current release' : 'Upload your first release'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Version *</label>
            <input
              type="text"
              value={version}
              onChange={e => setVersion(e.target.value)}
              placeholder="e.g. 1.0.1"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
            <p className="text-xs text-slate-400 mt-1">Must match the version in app.json</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">APK File *</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".apk"
              onChange={handleFileSelect}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700"
            />
            {selectedFile && (
              <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                <FileText size={12} /> {selectedFile.name} ({formatSize(selectedFile.size)})
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Release Notes</label>
          <textarea
            value={releaseNotes}
            onChange={e => setReleaseNotes(e.target.value)}
            placeholder="What's new in this version..."
            rows={3}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isMandatory}
            onChange={e => setIsMandatory(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          />
          <div>
            <span className="text-sm font-medium text-slate-700">Mandatory Update</span>
            <p className="text-xs text-slate-400">Users cannot skip this update and must install it to continue using the app</p>
          </div>
        </label>

        {isMandatory && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <AlertTriangle size={16} className="text-amber-600 shrink-0" />
            <p className="text-xs text-amber-700">Mandatory updates will force users to update before they can use the app. Use this only for critical fixes.</p>
          </div>
        )}

        <button
          type="submit"
          disabled={uploading || !selectedFile || !version}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {uploading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
          ) : (
            <Upload size={16} />
          )}
          {uploading ? 'Uploading...' : 'Upload APK'}
        </button>
      </form>

      {/* How it works */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">How It Works</h3>
        <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
          <li>Build the APK from Expo/EAS (<code className="text-xs bg-slate-200 px-1 py-0.5 rounded">eas build --platform android</code>)</li>
          <li>Upload the APK file here with version number</li>
          <li>When users open the app, it checks for updates</li>
          <li>If a new version is available, users see an update prompt</li>
          <li>They tap "Update" and the APK downloads & installs automatically</li>
        </ol>
      </div>
    </div>
  );
}
