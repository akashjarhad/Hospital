import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bot, Check, CheckCircle2, Database, FileSearch, Loader2, RefreshCw, Save, Search, ShieldCheck, Sparkles, X } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { ClinicalRAGAssistant } from './ClinicalRAGAssistant';

const SAFETY = 'AI-generated draft — Review and verify before clinical use.';

function ResultCard({ title, children, action, actionLabel, loading }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">{title}</h3>
        {action && <button onClick={action} disabled={loading} className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-[11px] font-bold disabled:opacity-50 flex items-center gap-1.5">{loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}{actionLabel}</button>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Sources({ ids = [], onSelect }) {
  if (!ids.length) return <span className="text-[11px] text-slate-400">No authorized source reference available.</span>;
  return <div className="flex flex-wrap gap-1.5">{ids.map(id => <button key={id} onClick={() => onSelect?.(id)} className="px-2 py-1 rounded-md bg-brand-50 border border-brand-200 text-brand-700 font-mono text-[10px] hover:bg-brand-100">{id}</button>)}</div>;
}

export const AITransferWorkspace = ({ transfer, onSourceSelect }) => {
  const { user } = useAuth();
  const isDoctor = user?.role === 'DOCTOR';
  const [handover, setHandover] = useState(null);
  const [relevance, setRelevance] = useState([]);
  const [critical, setCritical] = useState([]);
  const [quality, setQuality] = useState([]);
  const [complexity, setComplexity] = useState([]);
  const [draftSections, setDraftSections] = useState({});
  const [question, setQuestion] = useState('What allergies are documented?');
  const [answer, setAnswer] = useState(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState(null);

  const transferId = transfer?.id;
  const patientId = transfer?.patient_id;
  const handoverContent = handover?.edited_content || handover?.original_content;

  const load = async () => {
    if (!transferId || !patientId) return;
    const calls = [
      api.get(`/transfers/${transferId}/ai/handover`),
      api.get(`/transfers/${transferId}/ai/relevance`),
      api.get(`/transfers/${transferId}/ai/critical-information`),
      api.get(`/transfers/${transferId}/ai/complexity`),
      api.get(`/patients/${patientId}/data-quality?transfer_id=${transferId}`)
    ];
    const [h, r, c, x, q] = await Promise.allSettled(calls);
    if (h.status === 'fulfilled') setHandover(h.value.data.data);
    if (r.status === 'fulfilled') setRelevance(r.value.data.data || []);
    if (c.status === 'fulfilled') setCritical(c.value.data.data || []);
    if (x.status === 'fulfilled') setComplexity(x.value.data.data || []);
    if (q.status === 'fulfilled') setQuality(q.value.data.data || []);
  };

  useEffect(() => { load(); }, [transferId, patientId]);
  useEffect(() => { setDraftSections(handoverContent?.sections || {}); }, [handover?.id, handover?.status]);

  const run = async (key, callback) => {
    setBusy(key); setMessage(null);
    try { await callback(); await load(); }
    catch (error) { setMessage({ type: 'error', text: error.response?.data?.message || 'AI service is temporarily unavailable. Continue with manual transfer preparation.' }); }
    finally { setBusy(''); }
  };

  const generate = (kind) => run(kind, async () => {
    if (kind === 'handover') setHandover((await api.post(`/transfers/${transferId}/ai/handover`)).data.data);
    if (kind === 'relevance') setRelevance((await api.post(`/transfers/${transferId}/ai/relevance`)).data.data || []);
    if (kind === 'critical') setCritical((await api.post(`/transfers/${transferId}/ai/critical-information`)).data.data || []);
    if (kind === 'quality') await api.post(`/patients/${patientId}/data-quality/check`, { transfer_id: transferId });
    if (kind === 'complexity') await api.post(`/transfers/${transferId}/ai/complexity`);
  });

  const saveHandover = () => run('save', async () => {
    const edited = { ...(handoverContent || {}), sections: draftSections, safety: SAFETY };
    setHandover((await api.put(`/transfers/${transferId}/ai/handover`, { edited_content: edited })).data.data);
  });

  const approveHandover = () => run('approve', async () => {
    setHandover((await api.post(`/transfers/${transferId}/ai/handover/approve`, { accuracy_confirmed: true })).data.data);
  });

  const reviewRelevance = (id, selected) => run(`rel-${id}`, async () => {
    await api.put(`/transfers/${transferId}/ai/relevance`, { items: [{ id, selected, review_status: 'REVIEWED' }] });
  });

  const reviewCritical = (id, status) => run(`critical-${id}`, async () => {
    await api.put(`/transfers/${transferId}/ai/critical-information`, { items: [{ id, status }] });
  });

  const ask = () => run('search', async () => {
    setAnswer((await api.post(`/patients/${patientId}/ai/search`, { transfer_id: transferId, question })).data.data);
  });

  const latestComplexity = useMemo(() => complexity[0] || null, [complexity]);
  const qualityScore = quality[0]?.score_breakdown?.total;

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-xs text-amber-950">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
        <div><strong>{SAFETY}</strong><p className="mt-1 text-[11px]">AI recommends → Human verifies → System executes. Only server-authorized records enter this workspace.</p></div>
      </div>
      {message && <div className={`p-3 rounded-xl text-xs border ${message.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>{message.text}</div>}

      <ResultCard title="AI Clinical Handover" action={isDoctor && !handover ? () => generate('handover') : null} actionLabel="Generate Summary" loading={busy === 'handover'}>
        {!handover ? <p className="text-xs text-slate-500">No draft generated. Manual transfer preparation remains available.</p> : <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2"><span className={`px-2 py-1 rounded-full text-[10px] font-bold ${handover.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{handover.status === 'APPROVED' ? 'VERIFIED BY DOCTOR' : handover.status}</span><span className="text-[10px] text-slate-500">{handover.model} · {handover.model_version} · {handover.source_ids?.length || 0} sources</span></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{Object.entries(draftSections).map(([key, value]) => <label key={key} className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{key.replaceAll('_', ' ')}<textarea disabled={!isDoctor || handover.status === 'APPROVED'} value={Array.isArray(value) ? value.join('\n') : value || ''} onChange={event => setDraftSections(current => ({ ...current, [key]: event.target.value }))} rows={3} className="mt-1 w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-normal normal-case text-slate-800 disabled:opacity-70" /></label>)}</div>
          <Sources ids={handover.source_ids} onSelect={onSourceSelect} />
          {isDoctor && handover.status !== 'APPROVED' && <div className="flex justify-end gap-2"><button onClick={saveHandover} disabled={busy} className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold flex items-center gap-1"><Save className="h-3.5 w-3.5" /> Save Reviewed Draft</button><button onClick={approveHandover} disabled={busy} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Confirm Accuracy & Approve</button></div>}
        </div>}
      </ResultCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ResultCard title="AI Suggested Relevant Records" action={isDoctor ? () => generate('relevance') : null} actionLabel="Analyze Relevance" loading={busy === 'relevance'}>
          <p className="text-[11px] text-slate-500 mb-3">Suggestions are potentially relevant to the transfer reason, not clinically or legally definitive.</p>
          <div className="space-y-2 max-h-64 overflow-auto">{relevance.length ? relevance.map(item => <div key={item.id} className="p-2.5 rounded-lg border border-slate-200 text-xs"><div className="flex items-start justify-between gap-2"><div><strong>{item.source_id}</strong><p className="text-[11px] text-slate-500 mt-1">{item.reason}</p></div><div className="flex gap-1"><button onClick={() => reviewRelevance(item.id, true)} className="p-1.5 rounded bg-emerald-50 text-emerald-700"><Check className="h-3.5 w-3.5" /></button><button onClick={() => reviewRelevance(item.id, false)} className="p-1.5 rounded bg-red-50 text-red-700"><X className="h-3.5 w-3.5" /></button></div></div><span className="text-[10px] text-slate-400">{item.review_status}{item.selected !== null ? ` · ${item.selected ? 'Selected' : 'Not selected'}` : ''}</span></div>) : <p className="text-xs text-slate-400">No suggestions generated.</p>}</div>
        </ResultCard>

        <ResultCard title="AI-Detected Important Information" action={isDoctor ? () => generate('critical') : null} actionLabel="Extract Information" loading={busy === 'critical'}>
          <div className="space-y-2 max-h-72 overflow-auto">{critical.length ? critical.map(item => <div key={item.id} className="p-2.5 rounded-lg border border-red-100 bg-red-50/40 text-xs"><strong className="text-red-900">{item.label}</strong><p className="mt-1 text-slate-800">{item.edited_value || item.value}</p><div className="mt-2 flex items-center justify-between gap-2"><button onClick={() => onSourceSelect?.(item.source_id)} className="text-[10px] font-mono text-brand-700">{item.source_id}</button><span className="text-[9px] text-slate-500">{item.confidence_descriptor}</span><div className="flex gap-1"><button onClick={() => reviewCritical(item.id, 'CONFIRMED')} className="px-2 py-1 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">Confirm</button><button onClick={() => reviewCritical(item.id, 'DISMISSED')} className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-[10px]">Dismiss</button></div></div></div>) : <p className="text-xs text-slate-400">No extracted items generated.</p>}</div>
        </ResultCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ResultCard title="Data Quality" action={isDoctor ? () => generate('quality') : null} actionLabel="Run Check" loading={busy === 'quality'}>
          <div className="flex items-center gap-3 mb-3"><div className="text-3xl font-extrabold text-brand-700">{Number.isFinite(qualityScore) ? qualityScore : '—'}<span className="text-sm">/100</span></div><p className="text-[11px] text-slate-500">Transparent rule-based prototype score. Not clinically validated.</p></div>
          <div className="space-y-2">{quality.slice(0, 6).map(item => <div key={item.id} className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px]"><strong>{item.issue_type} · {item.severity}</strong><p>{item.description}</p><Sources ids={item.source_ids} onSelect={onSourceSelect} /></div>)}</div>
        </ResultCard>

        <ResultCard title="Transfer Complexity Indicator" action={isDoctor ? () => generate('complexity') : null} actionLabel="Analyze" loading={busy === 'complexity'}>
          {latestComplexity ? <div className="space-y-3"><span className={`inline-flex px-3 py-1 rounded-full text-xs font-extrabold ${latestComplexity.level === 'HIGH' ? 'bg-red-100 text-red-800' : latestComplexity.level === 'MODERATE' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{latestComplexity.level}</span><ul className="space-y-1 text-xs text-slate-700">{(latestComplexity.factors || []).map((factor, index) => <li key={index}>• {factor.factor}: <strong>{String(factor.value)}</strong> <button onClick={() => onSourceSelect?.(factor.source_id)} className="text-brand-600 font-mono text-[10px]">{factor.source_id}</button></li>)}</ul><p className="text-[11px] text-slate-500">Workflow assistance only. This is not a diagnosis, survival prediction, or transfer-priority decision.</p></div> : <p className="text-xs text-slate-400">No complexity analysis generated.</p>}
        </ResultCard>
      </div>

      <div className="pt-2">
        <ClinicalRAGAssistant
          patientId={patientId}
          transferId={transferId}
          patientName={transfer?.patient_name || 'Patient'}
          onSourceSelect={onSourceSelect}
          compact={true}
        />
      </div>
    </div>
  );
};
