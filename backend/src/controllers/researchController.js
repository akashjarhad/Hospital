const repository = require('../repositories/aiRepository');
const { recordAuditLog, extractReqMeta } = require('../utils/auditLogger');
const { positiveInt, boundedText } = require('../utils/validation');

const METRICS = new Set([
  'handover_factual_accuracy', 'handover_completeness', 'handover_omission_rate',
  'handover_unsupported_statement_rate', 'summary_generation_time_ms',
  'relevance_precision', 'relevance_recall', 'relevance_f1',
  'data_quality_precision', 'data_quality_recall',
  'anomaly_detection_rate', 'anomaly_false_positive_rate', 'anomaly_detection_latency_ms',
  'rag_retrieval_precision', 'rag_source_grounded_answer_rate', 'rag_unsupported_answer_rate',
  'sus_score', 'manual_preparation_time_minutes', 'ai_assisted_preparation_time_minutes'
]);

function fail(res, error) {
  const status = error.status || 500;
  if (status === 500) console.error('Research evaluation error:', error);
  return res.status(status).json({ success: false, message: status === 500 ? 'Research evaluation operation failed safely.' : error.message });
}

function scoped(req, run) {
  return req.user.role === 'SYSTEM_ADMIN' || Number(run.hospital_id) === Number(req.user.hospital_id);
}

function number(value, field, required = true) {
  if ((value === null || value === undefined || value === '') && !required) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    const error = new Error(`${field} must be a finite number.`);
    error.status = 400;
    throw error;
  }
  return parsed;
}

function summarize(run, entries) {
  const byMetric = entries.reduce((result, entry) => {
    if (!result[entry.metric_name]) result[entry.metric_name] = [];
    result[entry.metric_name].push(entry);
    return result;
  }, {});
  const metrics = Object.entries(byMetric).map(([metric, values]) => {
    const actual = values.reduce((sum, item) => sum + Number(item.actual_value), 0) / values.length;
    const baselines = values.filter(item => item.baseline_value !== null && item.baseline_value !== undefined);
    const baseline = baselines.length ? baselines.reduce((sum, item) => sum + Number(item.baseline_value), 0) / baselines.length : null;
    const isTimeMetric = /time|latency/.test(metric);
    return {
      metric,
      samples: values.length,
      unit: values[0].unit || null,
      actual_average: Number(actual.toFixed(4)),
      baseline_average: baseline === null ? null : Number(baseline.toFixed(4)),
      delta: baseline === null ? null : Number((actual - baseline).toFixed(4)),
      improvement_percent: baseline !== null && baseline !== 0 && isTimeMetric
        ? Number((((baseline - actual) / Math.abs(baseline)) * 100).toFixed(2))
        : null,
      interpretation: isTimeMetric ? 'For time/latency metrics, positive improvement means the measured actual workflow was faster.' : 'No automatic improvement claim is made for this metric.'
    };
  });
  return { run, measurements_entered: entries.length, metrics, notice: 'Only user-entered measurements are calculated. No clinical or experimental result is fabricated.' };
}

const listRuns = async (req, res) => {
  try {
    const criteria = req.user.role === 'SYSTEM_ADMIN' ? {} : { hospital_id: req.user.hospital_id };
    return res.json({ success: true, data: await repository.find('research_evaluation_runs', criteria), notice: 'Synthetic/non-sensitive aggregate evaluation metadata only.' });
  } catch (error) { return fail(res, error); }
};

const createRun = async (req, res) => {
  try {
    const name = boundedText(req.body.name, 'name', { max: 255 });
    const description = boundedText(req.body.description, 'description', { required: false, max: 2000 });
    const hospitalId = req.user.role === 'SYSTEM_ADMIN'
      ? (req.body.hospital_id ? positiveInt(req.body.hospital_id, 'hospital_id') : null)
      : req.user.hospital_id;
    const run = await repository.insert('research_evaluation_runs', { name, description: description || null, created_by: req.user.id, hospital_id: hospitalId, created_at: new Date() });
    const { ipAddress, userAgent } = extractReqMeta(req);
    await recordAuditLog({ userId: req.user.id, role: req.user.role, action: 'RESEARCH_EVALUATION_RUN_CREATED', purpose: 'Create non-sensitive research evaluation run', result: 'SUCCESS', ipAddress, userAgent, metadata: { run_id: run.id } });
    return res.status(201).json({ success: true, data: run });
  } catch (error) { return fail(res, error); }
};

const addEntry = async (req, res) => {
  try {
    const runId = positiveInt(req.params.id, 'run id');
    const run = await repository.findOne('research_evaluation_runs', { id: runId });
    if (!run) return res.status(404).json({ success: false, message: 'Evaluation run not found.' });
    if (!scoped(req, run)) return res.status(403).json({ success: false, message: 'This evaluation run is outside your hospital scope.' });
    const metricName = boundedText(req.body.metric_name, 'metric_name', { max: 160 }).toLowerCase();
    if (!METRICS.has(metricName)) return res.status(400).json({ success: false, message: `Unsupported metric. Allowed metrics: ${[...METRICS].join(', ')}` });
    const actualValue = number(req.body.actual_value, 'actual_value');
    const baselineValue = number(req.body.baseline_value, 'baseline_value', false);
    const unit = boundedText(req.body.unit, 'unit', { required: false, max: 80 });
    const notes = boundedText(req.body.notes, 'notes', { required: false, max: 1000 });
    const entry = await repository.insert('research_evaluation_entries', { run_id: runId, metric_name: metricName, baseline_value: baselineValue, actual_value: actualValue, unit: unit || null, notes: notes || null, entered_by: req.user.id, created_at: new Date() });
    return res.status(201).json({ success: true, data: entry, notice: 'Measurement stored as user-entered experimental data; it is not a fabricated or clinically validated result.' });
  } catch (error) { return fail(res, error); }
};

const getSummary = async (req, res) => {
  try {
    const runId = positiveInt(req.params.id, 'run id');
    const run = await repository.findOne('research_evaluation_runs', { id: runId });
    if (!run) return res.status(404).json({ success: false, message: 'Evaluation run not found.' });
    if (!scoped(req, run)) return res.status(403).json({ success: false, message: 'This evaluation run is outside your hospital scope.' });
    return res.json({ success: true, data: summarize(run, await repository.find('research_evaluation_entries', { run_id: runId })) });
  } catch (error) { return fail(res, error); }
};

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

const exportCsv = async (req, res) => {
  try {
    const runId = positiveInt(req.params.id, 'run id');
    const run = await repository.findOne('research_evaluation_runs', { id: runId });
    if (!run) return res.status(404).json({ success: false, message: 'Evaluation run not found.' });
    if (!scoped(req, run)) return res.status(403).json({ success: false, message: 'This evaluation run is outside your hospital scope.' });
    const entries = await repository.find('research_evaluation_entries', { run_id: runId });
    const lines = [
      ['run_id', 'run_name', 'metric_name', 'baseline_value', 'actual_value', 'unit', 'recorded_at'].map(csvCell).join(','),
      ...entries.map(entry => [run.id, run.name, entry.metric_name, entry.baseline_value, entry.actual_value, entry.unit, new Date(entry.created_at).toISOString()].map(csvCell).join(','))
    ];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="research-evaluation-${runId}.csv"`);
    return res.send(lines.join('\n'));
  } catch (error) { return fail(res, error); }
};

module.exports = { listRuns, createRun, addEntry, getSummary, exportCsv, METRICS };
