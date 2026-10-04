const crypto = require('crypto');
const repository = require('../repositories/aiRepository');
const { getScopedAuditRows } = require('./clinicalAccessPolicy');

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function featureVector(logs) {
  const times = logs.map(log => new Date(log.timestamp).getTime()).filter(Number.isFinite);
  const spanHours = times.length > 1 ? Math.max(1, (Math.max(...times) - Math.min(...times)) / 3600000) : 1;
  return {
    patient_record_accesses: logs.filter(log => ['PATIENT_VIEW', 'DATA_ACCESSED'].includes(log.action)).length,
    access_frequency_per_hour: Number((logs.length / spanHours).toFixed(3)),
    downloads: logs.filter(log => ['DATA_DOWNLOADED', 'TRANSFER_SENT'].includes(log.action)).length,
    off_hours_events: logs.filter(log => { const hour = new Date(log.timestamp).getHours(); return hour < 6 || hour >= 22; }).length,
    emergency_events: logs.filter(log => String(log.action).includes('EMERGENCY')).length,
    transfer_events: logs.filter(log => String(log.action).includes('TRANSFER')).length,
    denied_attempts: logs.filter(log => log.result === 'DENIED' || log.action === 'UNAUTHORIZED_ACCESS_ATTEMPT').length
  };
}

async function analyze(hospitalId = null) {
  const logs = await getScopedAuditRows(hospitalId);
  const groups = new Map();
  for (const log of logs) {
    const key = log.user_id || 'anonymous';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(log);
  }
  const actors = [...groups.entries()].map(([actorId, actorLogs]) => ({ actorId: actorId === 'anonymous' ? null : Number(actorId), hospitalId: actorLogs[0]?.actor_hospital_id || null, features: featureVector(actorLogs) }));
  const featureNames = actors.length ? Object.keys(actors[0].features) : [];
  const baselines = {};
  for (const name of featureNames) {
    const values = actors.map(actor => actor.features[name]);
    const center = median(values);
    const mad = median(values.map(value => Math.abs(value - center)));
    baselines[name] = { median: center, mad };
  }
  const runId = `SEC-${new Date().toISOString().slice(0, 10)}-${crypto.createHash('sha256').update(JSON.stringify(actors)).digest('hex').slice(0, 10)}`;
  const created = [];
  for (const actor of actors) {
    const contributions = featureNames.map(name => {
      const { median: center, mad } = baselines[name];
      const scale = mad || Math.max(1, center * 0.5);
      return { name, distance: Math.abs(actor.features[name] - center) / scale };
    });
    const deniedBoost = actor.features.denied_attempts > 0 ? Math.min(3, actor.features.denied_attempts) : 0;
    const score = Number((contributions.reduce((sum, item) => sum + Math.min(item.distance, 5), 0) / Math.max(1, contributions.length) + deniedBoost).toFixed(4));
    if (score < 2.5) continue;
    const notable = contributions.filter(item => item.distance >= 1.5).sort((a, b) => b.distance - a.distance).slice(0, 3).map(item => item.name);
    const explanation = `Review suggested because robust feature-distance score was ${score}. Notable aggregate features: ${notable.join(', ') || 'denied attempts'}. This prototype does not establish wrongdoing and does not block access.`;
    created.push(await repository.insert('security_anomalies', { hospital_id: actor.hospitalId, actor_id: actor.actorId, analysis_run_id: runId, score, severity: score >= 5 ? 'HIGH' : score >= 3.5 ? 'MODERATE' : 'LOW', explanation, feature_values: actor.features, review_status: 'OPEN' }));
  }
  return { run_id: runId, records_analyzed: logs.length, actors_analyzed: actors.length, anomalies_created: created.length, anomalies: created, method: 'DEMO explainable robust feature-distance prototype inspired by unsupervised outlier detection; review-only, no auto-blocking or accusation.', features: featureNames };
}

async function analytics(hospitalId = null) {
  const rows = await repository.find('security_anomalies', hospitalId === null ? {} : { hospital_id: hospitalId });
  return {
    total: rows.length,
    by_severity: ['LOW', 'MODERATE', 'HIGH'].reduce((result, level) => ({ ...result, [level]: rows.filter(row => row.severity === level).length }), {}),
    by_status: ['OPEN', 'REVIEWED', 'DISMISSED', 'ESCALATED'].reduce((result, status) => ({ ...result, [status]: rows.filter(row => row.review_status === status).length }), {}),
    notice: 'Aggregate security metadata only; no clinical PHI is returned. Anomalies require human review.'
  };
}

module.exports = { analyze, analytics };
