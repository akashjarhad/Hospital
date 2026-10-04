import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { 
  ShieldCheck, ShieldAlert, AlertTriangle, Lock, Activity, 
  CheckCircle2, XCircle, Clock, RefreshCw, FileText, ArrowUpRight 
} from 'lucide-react';
import { AuditTrailView } from './AuditTrailView';
import { SecurityIntelligencePanel } from './SecurityIntelligencePanel';

export const SecurityDashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('overview'); // 'overview' | 'audit'

  const fetchSecurityMetrics = async () => {
    setLoading(true);
    try {
      const res = await api.get('/audit-logs/security-analytics');
      if (res.data.success) {
        setMetrics(res.data.metrics);
      }
    } catch (err) {
      console.error('Error fetching security metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityMetrics();
  }, []);

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold uppercase tracking-wider">
              Security Operations & Compliance
            </span>
            <span className="text-xs text-slate-400">• ABDM Inter-Hospital Node Monitor</span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white">
            Healthcare Data Security & Consent Analytics
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Real-time telemetry on inter-hospital cryptographic transfers, patient consent authorizations, and break-glass emergency overrides.
          </p>
        </div>

        <button
          onClick={fetchSecurityMetrics}
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto transition-colors cursor-pointer border border-white/10"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Telemetry
        </button>
      </div>

      {/* Top 4 Key Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1: Total Audited Events */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Access Events</span>
            <div className="h-9 w-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
              <Activity className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{metrics?.total_access_events || 0}</span>
            <span className="text-xs text-emerald-600 font-bold">100% audited</span>
          </div>
        </div>

        {/* Metric 2: Unauthorized Attempts Blocked */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Denied / Blocked Attempts</span>
            <div className="h-9 w-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-red-600">{metrics?.unauthorized_attempts || 0}</span>
            <span className="text-xs text-slate-500 font-medium">RBAC enforced</span>
          </div>
        </div>

        {/* Metric 3: Emergency Break-Glass Overrides */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Break-Glass Incidents</span>
            <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-600">{metrics?.emergency_break_glass_events || 0}</span>
            <span className="text-xs text-amber-600 font-bold">time-limited access</span>
          </div>
        </div>

        {/* Metric 4: Active Patient Consents */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Granted Consents</span>
            <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-600">{metrics?.consents?.active || 0}</span>
            <span className="text-xs text-slate-500 font-medium">{metrics?.consents?.pending || 0} pending</span>
          </div>
        </div>

      </div>

      {/* Visual Breakdowns: Consents Status + Transfers Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Panel 1: Patient Consent Distribution */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Patient Consent Distribution & Privacy Compliance
            </h3>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span>Granted / Active Authorizations</span>
                <span className="text-emerald-600 font-bold">{metrics?.consents?.active || 0}</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, ((metrics?.consents?.active || 0) + 1) * 35)}%` }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span>Pending Patient Review</span>
                <span className="text-amber-600 font-bold">{metrics?.consents?.pending || 0}</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(100, ((metrics?.consents?.pending || 0) + 1) * 25)}%` }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span>Revoked by Patient</span>
                <span className="text-purple-600 font-bold">{metrics?.consents?.revoked || 0}</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min(100, ((metrics?.consents?.revoked || 0)) * 20)}%` }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span>Rejected Consents</span>
                <span className="text-red-600 font-bold">{metrics?.consents?.rejected || 0}</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-red-500 rounded-full" style={{ width: `${Math.min(100, ((metrics?.consents?.rejected || 0)) * 20)}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Panel 2: Transfer Pipeline Status */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-brand-600" />
              Inter-Hospital Transfer Pipeline Status
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200">
              <span className="text-amber-700 font-bold block text-[10px] uppercase">Pending Consent</span>
              <strong className="text-2xl font-extrabold text-amber-900">{metrics?.transfers?.pending || 0}</strong>
              <span className="text-[10px] text-amber-700 block mt-0.5">Awaiting patient signature</span>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200">
              <span className="text-blue-700 font-bold block text-[10px] uppercase">Authorized & Transit</span>
              <strong className="text-2xl font-extrabold text-blue-900">
                {(metrics?.transfers?.authorized || 0) + (metrics?.transfers?.in_transit || 0)}
              </strong>
              <span className="text-[10px] text-blue-700 block mt-0.5">AES-256 encrypted payload</span>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
              <span className="text-emerald-700 font-bold block text-[10px] uppercase">Received by Hospital B</span>
              <strong className="text-2xl font-extrabold text-emerald-900">{metrics?.transfers?.received || 0}</strong>
              <span className="text-[10px] text-emerald-700 block mt-0.5">Clinical intake complete</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-500 font-bold block text-[10px] uppercase">Cancelled / Revoked</span>
              <strong className="text-2xl font-extrabold text-slate-800">{metrics?.transfers?.cancelled || 0}</strong>
              <span className="text-[10px] text-slate-500 block mt-0.5">Halted by privacy policy</span>
            </div>
          </div>
        </div>

      </div>

      <SecurityIntelligencePanel />

      {/* Embedded Audit Trail Component */}
      <AuditTrailView />

    </div>
  );
};
