import { useState, useEffect } from 'react';
import { getModules } from '../api';
import { Boxes } from 'lucide-react';

export default function PlatformModules() {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getModules()
      .then((data) => setModules(data.modules || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Available Modules</h1>
      <p className="text-sm text-gray-500 mb-6">Manage feature modules for organizations</p>
      <p className="text-gray-500 mb-6">
        These are the modules available on the platform. Modules can be enabled or disabled per organization.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((mod) => (
          <div key={mod.id} className="bg-white rounded-lg shadow p-5">
            <div className="flex items-start gap-3">
              <div className="bg-indigo-100 p-2 rounded-lg">
                <Boxes className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{mod.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{mod.code}</p>
                {mod.description && (
                  <p className="text-sm text-gray-600 mt-2">{mod.description}</p>
                )}
                <div className="mt-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      mod.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {mod.isActive ? 'Available' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
