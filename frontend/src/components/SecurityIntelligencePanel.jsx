import React, { useEffect, useState } from 'react';
import { AlertTriangle, BrainCircuit, CheckCircle2, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import api from '../api/axios';

export const SecurityIntelligencePanel = () => {
  const [analytics, setAnalytics] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    const [analyticsResponse, anomaliesResponse] = await Promise.all([api.get('/security/analytics'), api.get('/security/anomalies')]);
    setAnalytics(analyticsResponse.data.data);
    setAnomalies(anomaliesResponse.data.data || []);
  };

  useEffect(() => { load().catch(() => setMessage('Security intelligence is temporarily unavailable.')); }, []);

  const analyze = async () => {
    setBusy(true); setMessage('');
    try {
      const response = await api.post('/security/anomalies/analyze');
      setMessage(`Analyzed ${response.data.data.records_analyzed} synthetic/current audit events. ${response.data.data.anomalies_created} review event(s) created.`);
      await load();
    } catch (error) { setMessage(error.response?.data?.message || 'Anomaly analysis failed safely.'); }
    finally { setBusy(false); }
  };

  const review = async (id, reviewStatus) => {
    setBusy(true);
    try { await api.put(`/security/anomalies/${id}`, { review_status: reviewStatus, review_note: 'Reviewed in Security Intelligence Dashboard.' }); await load(); }
    catch (error) { setMessage(error.response?.data?.message || 'Review update failed.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="font-extrabold flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-purple-300" /> Security Intelligence Dashboard</h3><p className="text-[11px] text-slate-300 mt-1">Explainable unsupervised-style prototype. Potential anomalies require human review and never automatically block emergency care.</p></div>
        <button onClick={analyze} disabled={busy} className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Analyze Access Patterns</button>
      </div>
      <div className="p-5 space-y-5">
        {message && <div className="p-3 rounded-xl bg-brand-50 border border-brand-200 text-xs text-brand-800">{message}</div>}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[['Total anomalies', analytics?.total || 0], ['High risk', analytics?.by_severity?.HIGH || 0], ['Open review', analytics?.by_status?.OPEN || 0], ['Escalated', analytics?.by_status?.ESCALATED || 0]].map(([label, value]) => <div key={label} className="p-3 rounded-xl bg-slate-50 border border-slate-200"><span className="text-[10px] uppercase font-bold text-slate-500">{label}</span><div className="text-2xl font-extrabold text-slate-900">{value}</div></div>)}
        </div>
        <div className="space-y-3">
          {anomalies.map(anomaly => <article key={anomaly.id} className={`p-4 rounded-xl border ${anomaly.severity === 'HIGH' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-red-600" /><strong className="text-xs">Potentially anomalous activity detected</strong><span className="px-2 py-0.5 rounded-full bg-white text-[10px] font-bold">{anomaly.severity}</span></div><p className="text-[11px] text-slate-700 mt-2 max-w-3xl">{anomaly.explanation}</p></div><span className="font-mono text-[10px] text-slate-500">Score {anomaly.score} · Actor #{anomaly.actor_id || 'unknown'}</span></div>
            <div className="mt-3 flex flex-wrap gap-2">{Object.entries(anomaly.feature_values || {}).map(([name, value]) => <span key={name} className="px-2 py-1 rounded bg-white/80 border border-slate-200 text-[10px]">{name.replaceAll('_', ' ')}: <strong>{value}</strong></span>)}</div>
            <div className="mt-3 flex items-center justify-between"><span className="text-[10px] font-bold text-slate-600">Status: {anomaly.review_status}</span>{anomaly.review_status === 'OPEN' && <div className="flex gap-2"><button onClick={() => review(anomaly.id, 'DISMISSED')} className="px-2 py-1 rounded bg-white border border-slate-300 text-[10px]">Dismiss</button><button onClick={() => review(anomaly.id, 'REVIEWED')} className="px-2 py-1 rounded bg-emerald-600 text-white text-[10px] font-bold">Mark Reviewed</button><button onClick={() => review(anomaly.id, 'ESCALATED')} className="px-2 py-1 rounded bg-red-600 text-white text-[10px] font-bold">Escalate</button></div>}</div>
          </article>)}
          {!anomalies.length && <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-300 rounded-xl"><CheckCircle2 className="h-7 w-7 mx-auto text-emerald-500 mb-2" />No anomaly review events exist yet. Run analysis against synthetic/current audit activity.</div>}
        </div>
        <p className="text-[10px] text-slate-500 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Security controls implemented in this academic prototype; this display does not establish malicious intent or regulatory compliance.</p>
      </div>
    </div>
  );
};
