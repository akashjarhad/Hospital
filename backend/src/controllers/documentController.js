const { query } = require('../config/db');
const { recordAuditLog, extractReqMeta } = require('../utils/auditLogger');
const { authorizePatientAccess } = require('../services/clinicalAccessPolicy');
const { normalizeCategories } = require('../services/patientAggregateService');
const { positiveInt, boundedText } = require('../utils/validation');

function allowedDocument(document, categories) {
  const codes = new Set(normalizeCategories(categories));
  const type = String(document.document_type || '').toLowerCase();
  if (type.includes('lab')) return codes.has('LAB_REPORTS');
  if (/(imag|radio|scan)/.test(type)) return codes.has('IMAGING_REPORTS');
  if (type.includes('summary')) return codes.has('TRANSFER_SUMMARY');
  return codes.has('DIAGNOSTIC_REPORTS');
}

function metadata(document) {
  const { storage_reference, ...safe } = document;
  return { ...safe, content_available: false, content_notice: 'Only verified metadata is available in this prototype; no public or synthetic content URL is exposed.' };
}

function safeError(res, error, fallback) {
  const status = error.status || 500;
  if (status === 500) console.error(fallback, error);
  return res.status(status).json({ success: false, message: status === 500 ? fallback : error.message });
}

const getPatientDocuments = async (req, res) => {
  try {
    const patientId = positiveInt(req.params.patientId, 'patientId');
    const transferId = req.query.transfer_id ? positiveInt(req.query.transfer_id, 'transfer_id') : null;
    const access = await authorizePatientAccess(req.user, patientId, { transferId, allowEmergency: true });
    const rows = (await query('SELECT * FROM documents WHERE patient_id = $1', [patientId])).rows.filter(document => !access.recordScope?.hospitalId || Number(document.hospital_id) === Number(access.recordScope.hospitalId)).filter(document => allowedDocument(document, access.categories)).map(metadata);
    return res.json({ success: true, total: rows.length, access_mode: access.accessMode, data: rows });
  } catch (error) { return safeError(res, error, 'Failed to retrieve patient documents.'); }
};

const downloadDocument = async (req, res) => {
  const { ipAddress, userAgent } = extractReqMeta(req);
  try {
    const documentId = positiveInt(req.params.id, 'document id');
    const document = (await query('SELECT * FROM documents WHERE id = $1', [documentId])).rows[0];
    if (!document) return res.status(404).json({ success: false, message: 'Document not found.' });
    const transferId = req.query.transfer_id ? positiveInt(req.query.transfer_id, 'transfer_id') : null;
    const access = await authorizePatientAccess(req.user, document.patient_id, { transferId, allowEmergency: true });
    if (access.recordScope?.hospitalId && Number(document.hospital_id) !== Number(access.recordScope.hospitalId)) return res.status(403).json({ success: false, message: 'This document was created outside the authorized hospital record scope.' });
    if (!allowedDocument(document, access.categories)) return res.status(403).json({ success: false, message: 'This document category is outside the authorized data scope.' });
    await recordAuditLog({ userId: req.user.id, role: req.user.role, action: 'DATA_DOWNLOADED', patientId: document.patient_id, transferId, purpose: 'Secure document metadata retrieval', result: 'SUCCESS', ipAddress, userAgent, metadata: { document_id: document.id, document_type: document.document_type, access_mode: access.accessMode } });
    return res.json({ success: true, message: 'Verified document metadata retrieved. Binary content is not exposed by this prototype.', document: metadata(document) });
  } catch (error) { return safeError(res, error, 'Failed to access document.'); }
};

const uploadDocument = async (req, res) => {
  const { ipAddress, userAgent } = extractReqMeta(req);
  try {
    const patientId = positiveInt(req.body.patient_id, 'patient_id');
    await authorizePatientAccess(req.user, patientId, { allowEmergency: false });
    const documentType = boundedText(req.body.document_type, 'document_type', { max: 100 });
    const title = boundedText(req.body.title, 'title', { max: 255 });
    const fileName = boundedText(req.body.file_name, 'file_name', { max: 255 });
    const mimeType = boundedText(req.body.mime_type || 'application/pdf', 'mime_type', { max: 100 });
    const fileSize = Math.max(0, Math.min(Number(req.body.file_size_bytes) || 0, 100000000));
    const storageReference = `vault_${Date.now()}_${require('crypto').randomBytes(8).toString('hex')}`;
    const hash = require('crypto').createHash('sha256').update(`${patientId}:${title}:${fileName}:${Date.now()}`).digest('hex');
    const record = (await query(`INSERT INTO documents (patient_id, hospital_id, uploaded_by, document_type, title, file_name, file_size_bytes, mime_type, storage_reference, content_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [patientId, req.user.hospital_id, req.user.id, documentType, title, fileName, fileSize, mimeType, storageReference, hash])).rows[0];
    await recordAuditLog({ userId: req.user.id, role: req.user.role, action: 'DOCUMENT_UPLOADED', patientId, purpose: 'Clinical document metadata attachment', result: 'SUCCESS', ipAddress, userAgent, metadata: { document_id: record.id, document_type: documentType } });
    return res.status(201).json({ success: true, message: 'Medical document metadata attached securely.', data: metadata(record) });
  } catch (error) { return safeError(res, error, 'Failed to upload document metadata.'); }
};

module.exports = { getPatientDocuments, downloadDocument, uploadDocument };
