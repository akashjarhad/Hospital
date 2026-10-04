import React, { useEffect, useState } from 'react';
import { BarChart3, Download, FlaskConical, Loader2, Plus, RefreshCw, Sparkles } from 'lucide-react';
import api from '../api/axios';

const METRICS = [
  ['manual_preparation_time_minutes', 'Manual preparation time', 'minutes'],
  ['ai_assisted_preparation_time_minutes', 'AI-assisted preparation time', 'minutes'],
  ['summary_generation_time_ms', 'Summary generation time', 'ms'],
  ['handover_factual_accuracy', 'Handover factual accuracy', '%'],
  ['handover_completeness', 'Handover completeness', '%'],
  ['handover_unsupported_statement_rate', 'Unsupported statement rate', '%'],
  ['relevance_precision', 'Record relevance precision', '%'], ['relevance_recall', 'Record relevance recall', '%'], ['relevance_f1', 'Record relevance F1', '%'],
  ['data_quality_precision', 'Data-quality precision', '%'], ['data_quality_recall', 'Data-quality recall', '%'],
  ['anomaly_detection_rate', 'Anomaly detection rate', '%'], ['anomaly_false_positive_rate', 'Anomaly false-positive rate', '%'],
  ['rag_retrieval_precision', 'RAG retrieval precision', '%'], ['rag_source_grounded_answer_rate', 'Source-grounded answer rate', '%'],
  ['sus_score', 'System Usability Scale', 'score']
];

export const ResearchDashboard = () => {
  const [view, setView] = useState('evaluation');
  const [runs, setRuns] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [summary, setSummary] = useState(null);
  const [newName, setNewName] = useState('Synthetic AI-assisted transfer evaluation');
  const [metric, setMetric] = useState(METRICS[0][0]);
  const [baseline, setBaseline] = useState('');
  const [actual, setActual] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const loadRuns = async () => {
    const response = await api.get('/research/runs');
    setRuns(response.data.data || []);
    if (!selectedRun && response.data.data?.length) setSelectedRun(response.data.data[0]);
  };
  const loadSummary = async run => { if (run) setSummary((await api.get(`/research/runs/${run.id}/summary`)).data.data); };
  useEffect(() => { loadRuns().catch(() => setMessage('Research API is unavailable.')); }, []);
  useEffect(() => { loadSummary(selectedRun).catch(() => setSummary(null)); }, [selectedRun?.id]);

  const createRun = async () => {
    setBusy(true); setMessage('');
    try { const run = (await api.post('/research/runs', { name: newName, description: 'Non-sensitive measurements entered by researchers; no results are fabricated.' })).data.data; await loadRuns(); setSelectedRun(run); }
    catch (error) { setMessage(error.response?.data?.message || 'Could not create evaluation run.'); }
    finally { setBusy(false); }
  };

  const addMeasurement = async () => {
    if (!selectedRun || actual === '') return;
    setBusy(true); setMessage('');
    try {
      const definition = METRICS.find(item => item[0] === metric);
      await api.post(`/research/runs/${selectedRun.id}/entries`, { metric_name: metric, baseline_value: baseline === '' ? null : Number(baseline), actual_value: Number(actual), unit: definition?.[2], notes: 'User-entered measured synthetic evaluation result.' });
      setActual(''); setBaseline(''); await loadSummary(selectedRun);
    } catch (error) { setMessage(error.response?.data?.message || 'Could not store measurement.'); }
    finally { setBusy(false); }
  };

  const exportCsv = async () => {
    if (!selectedRun) return;
    const response = await api.get(`/research/runs/${selectedRun.id}/export.csv`, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data); const link = document.createElement('a'); link.href = url; link.download = `research-evaluation-${selectedRun.id}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  return <div className="space-y-6">
    <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-wrap justify-between gap-4">
      <div><span className="text-[10px] uppercase font-bold tracking-wider text-purple-300">Academic / Research Prototype</span><h2 className="text-2xl font-extrabold">Research & Evaluation</h2><p className="text-xs text-slate-300 mt-1">Enter actual synthetic experiment measurements. The system never fabricates evaluation results.</p></div>
      <div className="flex gap-2"><button onClick={() => setView('evaluation')} className={`px-3 py-2 rounded-xl text-xs font-bold ${view === 'evaluation' ? 'bg-purple-600' : 'bg-white/10'}`}>Evaluation Dashboard</button><button onClick={() => setView('contribution')} className={`px-3 py-2 rounded-xl text-xs font-bold ${view === 'contribution' ? 'bg-purple-600' : 'bg-white/10'}`}>Research Contribution</button></div>
    </div>
    {view === 'contribution' ? <Contribution /> : <>
      {message && <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">{message}</div>}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3"><h3 className="font-bold text-sm flex items-center gap-2"><FlaskConical className="h-4 w-4 text-purple-600" /> Experiment Runs</h3><div className="flex gap-2"><input value={newName} onChange={e => setNewName(e.target.value)} maxLength={255} className="min-w-0 flex-1 px-3 py-2 border rounded-lg text-xs" /><button onClick={createRun} disabled={busy || !newName.trim()} className="p-2 rounded-lg bg-purple-600 text-white"><Plus className="h-4 w-4" /></button></div><div className="space-y-2 max-h-52 overflow-auto">{runs.map(run => <button key={run.id} onClick={() => setSelectedRun(run)} className={`w-full p-3 rounded-xl border text-left text-xs ${selectedRun?.id === run.id ? 'bg-purple-50 border-purple-300' : 'bg-slate-50 border-slate-200'}`}><strong>{run.name}</strong><span className="block text-[10px] text-slate-500 mt-1">Run #{run.id} · {new Date(run.created_at).toLocaleDateString()}</span></button>)}</div></div>
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 space-y-4"><div className="flex justify-between"><h3 className="font-bold text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4 text-brand-600" /> Enter Measured Result</h3>{selectedRun && <button onClick={exportCsv} className="text-xs font-bold text-brand-600 flex items-center gap-1"><Download className="h-3.5 w-3.5" /> Export non-sensitive CSV</button>}</div><div className="grid grid-cols-1 sm:grid-cols-4 gap-2"><select value={metric} onChange={e => setMetric(e.target.value)} className="sm:col-span-2 px-3 py-2 border rounded-lg text-xs">{METRICS.map(item => <option key={item[0]} value={item[0]}>{item[1]}</option>)}</select><input type="number" value={baseline} onChange={e => setBaseline(e.target.value)} placeholder="Baseline (optional)" className="px-3 py-2 border rounded-lg text-xs" /><input type="number" value={actual} onChange={e => setActual(e.target.value)} placeholder="Actual measured" className="px-3 py-2 border rounded-lg text-xs" /></div><button onClick={addMeasurement} disabled={busy || !selectedRun || actual === ''} className="px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add Actual Measurement</button><p className="text-[10px] text-slate-500">Baseline comparisons are calculated only from values entered here. Preparation-time improvements use (baseline − actual) ÷ baseline.</p></div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden"><div className="p-4 border-b bg-slate-50 flex justify-between"><h3 className="text-xs font-extrabold uppercase tracking-wider">Calculated Results — {selectedRun?.name || 'Select a run'}</h3><button onClick={() => loadSummary(selectedRun)} className="text-slate-500"><RefreshCw className="h-4 w-4" /></button></div><div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-slate-100 text-[10px] uppercase text-slate-500"><tr><th className="p-3 text-left">Metric</th><th>Samples</th><th>Baseline avg.</th><th>Actual avg.</th><th>Difference</th><th>Measured improvement</th></tr></thead><tbody>{(summary?.metrics || []).map(row => <tr key={row.metric} className="border-t"><td className="p-3 font-bold">{row.metric.replaceAll('_', ' ')}</td><td className="text-center">{row.samples}</td><td className="text-center">{row.baseline_average ?? '—'}</td><td className="text-center">{row.actual_average}</td><td className="text-center">{row.delta ?? '—'}</td><td className="text-center font-bold text-emerald-700">{row.improvement_percent === null ? 'Not inferred' : `${row.improvement_percent}%`}</td></tr>)}</tbody></table>{!summary?.metrics?.length && <div className="p-10 text-center text-xs text-slate-400">No measured results entered. Empty values are intentional—this prototype does not invent results.</div>}</div></div>
    </>}
  </div>;
};

const Contribution = () => <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
  <Info title="Problem">Inter-hospital transfer can involve fragmented, incomplete, and difficult-to-prioritize patient information.</Info>
  <Info title="Existing approaches"><ul className="list-disc pl-5 space-y-1"><li>Health information exchange and FHIR-oriented interoperability</li><li>Consent management and clinical handover systems</li><li>AI-assisted healthcare workflows and security monitoring</li></ul></Info>
  <Info title="Proposed integrated approach">A consent-aware AI + interoperability + security + clinical handover academic prototype. It combines established technologies; it does not claim the individual techniques are novel.</Info>
  <Info title="Research contributions"><ol className="list-decimal pl-5 space-y-1"><li>Evidence-grounded AI handover drafts</li><li>Record relevance and data-quality assistance</li><li>Authorization-before-retrieval record search</li><li>Explainable anomaly and complexity prototypes</li><li>Human verification and complete AI provenance</li></ol></Info>
  <div className="lg:col-span-2 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900"><strong>Limitations:</strong> Synthetic demo data only. Not clinically validated, production-ready, certified, or formally assessed for HIPAA, DPDP, ABDM, or FHIR conformance.</div>
</div>;

const Info = ({ title, children }) => <section className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm text-xs text-slate-700"><h3 className="text-sm font-extrabold text-slate-900 mb-2 flex items-center gap-2"><Sparkles className="h-4 w-4 text-purple-600" />{title}</h3>{children}</section>;
