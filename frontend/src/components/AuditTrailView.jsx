import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { 
  Shield, Search, Filter, RefreshCw, CheckCircle2, 
  XCircle, AlertTriangle, Clock, Lock, FileText, Download 
} from 'lucide-react';

export const AuditTrailView = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/audit-logs?limit=100');
      if (res.data.success) {
        setLogs(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const filteredLogs = logs.filter(log => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      log.action?.toLowerCase().includes(q) ||
      log.user_name?.toLowerCase().includes(q) ||
      log.purpose?.toLowerCase().includes(q) ||
      log.ip_address?.toLowerCase().includes(q) ||
      log.patient_unique_health_id?.toLowerCase().includes(q) ||
      log.transfer_code?.toLowerCase().includes(q);

    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    const matchesRole = roleFilter === 'all' || log.role === roleFilter;

    return matchesSearch && matchesAction && matchesRole;
  });

  const getActionBadge = (action, result) => {
    if (result === 'DENIED' || action === 'UNAUTHORIZED_ACCESS_ATTEMPT') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300 text-[10px] font-extrabold font-mono">
          <XCircle className="h-3 w-3 text-red-600" /> {action}
        </span>
      );
    }
    if (action.includes('EMERGENCY')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-extrabold font-mono">
          <AlertTriangle className="h-3 w-3 text-amber-600" /> {action}
        </span>
      );
    }
    if (action.includes('CONSENT')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300 text-[10px] font-extrabold font-mono">
          <Shield className="h-3 w-3 text-purple-600" /> {action}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-300 text-[10px] font-extrabold font-mono">
        <CheckCircle2 className="h-3 w-3 text-emerald-600" /> {action}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4">
      
      {/* Header */}
      <div className="p-6 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-brand-100 text-brand-800 border border-brand-200 text-xs font-bold uppercase tracking-wider">
              Auditable Access Log
            </span>
            <span className="text-xs text-slate-500">• Audit Event Store</span>
          </div>
          <h3 className="text-lg font-extrabold text-slate-900">
            System & Clinical Access Audit Trail
          </h3>
        </div>

        <button
          onClick={fetchAuditLogs}
          className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Logs
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="px-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Action, User, Patient ID, IP, or Purpose..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="all">All Actions ({logs.length})</option>
            <option value="LOGIN">LOGIN</option>
            <option value="PATIENT_VIEW">PATIENT_VIEW</option>
            <option value="TRANSFER_CREATED">TRANSFER_CREATED</option>
            <option value="CONSENT_REQUESTED">CONSENT_REQUESTED</option>
            <option value="CONSENT_GRANTED">CONSENT_GRANTED</option>
            <option value="CONSENT_REJECTED">CONSENT_REJECTED</option>
            <option value="CONSENT_REVOKED">CONSENT_REVOKED</option>
            <option value="TRANSFER_SENT">TRANSFER_SENT</option>
            <option value="TRANSFER_RECEIVED">TRANSFER_RECEIVED</option>
            <option value="DATA_ACCESSED">DATA_ACCESSED</option>
            <option value="EMERGENCY_ACCESS_GRANTED">EMERGENCY_ACCESS_GRANTED</option>
            <option value="UNAUTHORIZED_ACCESS_ATTEMPT">UNAUTHORIZED_ACCESS_ATTEMPT</option>
          </select>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="all">All Roles</option>
            <option value="DOCTOR">DOCTOR</option>
            <option value="PATIENT">PATIENT</option>
            <option value="HOSPITAL_ADMIN">HOSPITAL_ADMIN</option>
            <option value="SYSTEM_ADMIN">SYSTEM_ADMIN</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-extrabold tracking-wider border-y border-slate-200">
            <tr>
              <th className="py-3 px-4">Timestamp</th>
              <th className="py-3 px-4">Action Event</th>
              <th className="py-3 px-4">User & Role</th>
              <th className="py-3 px-4">Target Entity</th>
              <th className="py-3 px-4">Purpose & Clinical Context</th>
              <th className="py-3 px-4">IP & Network</th>
              <th className="py-3 px-4">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan="7" className="py-12 text-center text-slate-400">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-brand-600 mb-2" />
                  <span>Loading audit records from the event store...</span>
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan="7" className="py-12 text-center text-slate-400">
                  No matching audit logs found.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' })}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    {getActionBadge(log.action, log.result)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900">{log.user_name || 'System'}</div>
                    <div className="text-[10px] text-slate-500 uppercase">{log.role}</div>
                  </td>
                  <td className="py-3 px-4">
                    {log.patient_unique_health_id ? (
                      <span className="font-mono text-xs font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                        {log.patient_unique_health_id}
                      </span>
                    ) : log.transfer_code ? (
                      <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        {log.transfer_code}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[11px]">System Scope</span>
                    )}
                  </td>
                  <td className="py-3 px-4 max-w-xs">
                    <p className="line-clamp-2 text-[11px] text-slate-700">{log.purpose || 'Clinical Exchange Workflow'}</p>
                  </td>
                  <td className="py-3 px-4 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                    {log.ip_address || '127.0.0.1'}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                      log.result === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {log.result}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};
