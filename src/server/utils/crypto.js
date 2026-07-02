const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

// Derive a static 32-byte key from environment key or fallback passphrase
const ENCRYPTION_KEY_RAW = process.env.ENCRYPTION_KEY || 'default_ai_qa_assistant_passphrase_32_bytes';
const KEY = crypto.createHash('sha256').update(ENCRYPTION_KEY_RAW).digest();

function encrypt(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  if (!text) return '';
  try {
    const parts = text.split(':');
    if (parts.length !== 2) return '';
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    console.error('[Crypto Utility] Decryption failed:', e.message);
    return '';
  }
}

module.exports = {
  encrypt,
  decrypt
};
