const { query, memoryStore } = require('../config/db');

/**
 * Log a security, clinical access, transfer or consent event to the append-only audit trail
 * @param {object} params
 * @param {number|null} params.userId - Authenticated user ID (or null for failed auth)
 * @param {string} params.role - User role (DOCTOR, PATIENT, HOSPITAL_ADMIN, SYSTEM_ADMIN, ANONYMOUS)
 * @param {string} params.action - Audit action constant
 * @param {number|null} params.patientId - Associated patient ID if applicable
 * @param {number|null} params.transferId - Associated transfer request ID if applicable
 * @param {string} params.purpose - Clinical or administrative purpose
 * @param {string} params.result - 'SUCCESS' | 'DENIED' | 'FAILED'
 * @param {string} params.ipAddress - Client IP address
 * @param {string} params.userAgent - Client User Agent
 * @param {object} params.metadata - Additional contextual JSON metadata
 */
async function recordAuditLog({
  userId = null,
  role = 'ANONYMOUS',
  action,
  patientId = null,
  transferId = null,
  purpose = 'Clinical Care',
  result = 'SUCCESS',
  ipAddress = '127.0.0.1',
  userAgent = 'MedTransfer-Client/1.0',
  metadata = {}
}) {
  try {
    const timestamp = new Date();
    const sql = `
      INSERT INTO audit_logs (
        user_id, role, action, patient_id, transfer_id,
        timestamp, ip_address, user_agent, purpose, result, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const metadataStr = typeof metadata === 'object' ? JSON.stringify(metadata) : metadata;
    const dbRes = await query(sql, [
      userId,
      role.toUpperCase(),
      action.toUpperCase(),
      patientId,
      transferId,
      timestamp,
      ipAddress,
      userAgent,
      purpose,
      result.toUpperCase(),
      metadataStr
    ]);

    return dbRes.rows[0];
  } catch (err) {
    console.error('CRITICAL: Failed to write to audit store:', err.message);
    // Ensure memory store fallback is updated if db query fails
    if (memoryStore && memoryStore.audit_logs) {
      const fallbackLog = {
        id: memoryStore.audit_logs.length + 1,
        user_id: userId,
        role: (role || 'ANONYMOUS').toUpperCase(),
        action: (action || 'UNKNOWN').toUpperCase(),
        patient_id: patientId,
        transfer_id: transferId,
        timestamp: new Date(),
        ip_address: ipAddress,
        user_agent: userAgent,
        purpose,
        result: (result || 'SUCCESS').toUpperCase(),
        metadata
      };
      memoryStore.audit_logs.push(fallbackLog);
      return fallbackLog;
    }
  }
}

/**
 * Helper to extract IP and User-Agent from Express request
 */
function extractReqMeta(req) {
  const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || 'MedTransfer Client';
  return { ipAddress, userAgent };
}

module.exports = {
  recordAuditLog,
  extractReqMeta
};
