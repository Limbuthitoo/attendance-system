import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Users, ChevronRight, ChevronDown } from 'lucide-react';

function OrgNode({ node, level = 0 }) {
  const [expanded, setExpanded] = useState(level < 2);
  const hasChildren = node.children?.length > 0;

  return (
    <div>
      <div className={`flex items-center gap-3 py-2 px-3 hover:bg-gray-50 rounded-lg cursor-pointer`} style={{ paddingLeft: `${level * 24 + 12}px` }} onClick={() => hasChildren && setExpanded(!expanded)}>
        {hasChildren ? (expanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />) : <div className="w-4" />}
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">
          {node.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{node.name}</p>
          <p className="text-xs text-gray-500">{node.designation || node.department || ''}</p>
        </div>
        {hasChildren && <span className="text-xs text-gray-400">{node.children.length} reports</span>}
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map(child => <OrgNode key={child.id} node={child} level={level + 1} />)}
        </div>
      )}
    </div>
  );
}

export default function OrgChart() {
  const [tree, setTree] = useState([]);
  const [flat, setFlat] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('tree');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const data = await api.getOrgChart();
      setTree(data.tree || []);
      setFlat(data.flat || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  // Group flat list by department
  const byDept = {};
  flat.forEach(emp => {
    const dept = emp.department || 'Unassigned';
    if (!byDept[dept]) byDept[dept] = [];
    byDept[dept].push(emp);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Organization Chart</h1>
        <div className="flex gap-2">
          <button onClick={() => setView('tree')} className={`px-3 py-1.5 rounded text-sm font-medium ${view === 'tree' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>Hierarchy</button>
          <button onClick={() => setView('dept')} className={`px-3 py-1.5 rounded text-sm font-medium ${view === 'dept' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}>By Department</button>
        </div>
      </div>

      {loading ? <div className="text-center py-8 text-gray-500">Loading...</div> : view === 'tree' ? (
        <div className="bg-white rounded-lg shadow p-4">
          {tree.length > 0 ? tree.map(node => <OrgNode key={node.id} node={node} />) : (
            <div className="text-center py-8 text-gray-500">
              <Users className="mx-auto mb-2 text-gray-400" size={32} />
              <p>No reporting structure configured.</p>
              <p className="text-sm mt-1">Set reporting managers in the Employees section to build the hierarchy.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(byDept).sort(([a], [b]) => a.localeCompare(b)).map(([dept, emps]) => (
            <div key={dept} className="bg-white rounded-lg shadow">
              <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">{dept}</h3>
                <span className="text-xs text-gray-500">{emps.length} members</span>
              </div>
              <div className="divide-y">
                {emps.map(emp => (
                  <div key={emp.id} className="px-4 py-2 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">
                      {emp.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{emp.name}</p>
                      <p className="text-xs text-gray-500">{emp.designation} · {emp.employeeCode}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
