const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config();

// AES-256-GCM Encryption Key (must be 32 bytes)
const RAW_KEY = process.env.ENCRYPTION_KEY || 'medtransfer_secure_data_exchange_key_2026_32bytes!!';
const ENCRYPTION_KEY = crypto.createHash('sha256').update(String(RAW_KEY)).digest(); // Ensures 32-byte key
const IV_LENGTH = 12; // 12 bytes IV recommended for GCM
const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypt a string or JSON object using AES-256-GCM
 * @param {string|object} data - Data to encrypt
 * @returns {string} Encrypted payload formatted as: iv:authTag:encryptedData (hex encoded)
 */
function encryptData(data) {
  if (data === null || data === undefined) return null;
  const text = typeof data === 'object' ? JSON.stringify(data) : String(data);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt an AES-256-GCM encrypted string
 * @param {string} encryptedString - Format: iv:authTag:encryptedData
 * @param {boolean} parseJSON - Whether to attempt JSON.parse on the result
 * @returns {string|object} Decrypted plain text or JSON
 */
function decryptData(encryptedString, parseJSON = false) {
  if (!encryptedString) return null;
  
  try {
    const parts = encryptedString.split(':');
    if (parts.length !== 3) {
      // If not encrypted in standard format, return raw string
      return encryptedString;
    }
    
    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    if (parseJSON) {
      try {
        return JSON.parse(decrypted);
      } catch (e) {
        return decrypted;
      }
    }
    return decrypted;
  } catch (err) {
    console.error('Decryption failed or data integrity corrupted:', err.message);
    throw new Error('Data integrity verification failed during decryption.');
  }
}

/**
 * Generate cryptographic SHA-256 digest signature for clinical transfer package
 * @param {object} payload - Transfer package payload
 * @returns {string} Hexadecimal HMAC signature
 */
function generatePackageSignature(payload) {
  const serialized = typeof payload === 'object' ? JSON.stringify(payload) : String(payload);
  return crypto.createHmac('sha256', ENCRYPTION_KEY).update(serialized).digest('hex');
}

/**
 * Verify HMAC signature of transfer package
 * @param {object} payload - Transfer package payload
 * @param {string} signature - Hexadecimal HMAC signature
 * @returns {boolean} True if signature matches
 */
function verifyPackageSignature(payload, signature) {
  const expected = generatePackageSignature(payload);
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
}

module.exports = {
  encryptData,
  decryptData,
  generatePackageSignature,
  verifyPackageSignature
};
