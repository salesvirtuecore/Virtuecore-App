import crypto from 'crypto'

const ALGO = 'aes-256-gcm'

function getKey() {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY
  if (!raw) throw new Error('Server not configured: missing CREDENTIALS_ENCRYPTION_KEY')
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error('CREDENTIALS_ENCRYPTION_KEY must decode to 32 bytes')
  return key
}

// Packs iv/authTag/ciphertext into a single '.'-joined base64 string for storage in a text column.
export function encryptSecret(plaintext) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join('.')
}

export function decryptSecret(packed) {
  const [ivB64, tagB64, dataB64] = packed.split('.')
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  const plaintext = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()])
  return plaintext.toString('utf8')
}

// Safe to return to the browser — never the real key.
export function maskSecret(plaintext) {
  if (!plaintext) return null
  const tail = plaintext.slice(-4)
  const prefix = plaintext.startsWith('sk_live_') ? 'sk_live_' : plaintext.startsWith('sk_test_') ? 'sk_test_' : ''
  return `${prefix}••••${tail}`
}
