function positiveInt(value, field) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new ValidationError(`${field} must be a positive integer.`);
  return parsed;
}

function boundedText(value, field, { required = true, min = 1, max = 2000 } = {}) {
  const text = String(value ?? '').trim();
  if (required && text.length < min) throw new ValidationError(`${field} is required and must contain at least ${min} character(s).`);
  if (text.length > max) throw new ValidationError(`${field} must not exceed ${max} characters.`);
  return text;
}

function enumValue(value, field, allowed) {
  const normalized = String(value || '').toUpperCase();
  if (!allowed.includes(normalized)) throw new ValidationError(`${field} must be one of: ${allowed.join(', ')}.`);
  return normalized;
}

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
  }
}

module.exports = { ValidationError, positiveInt, boundedText, enumValue };
