// Encryption layer: a single AES-GCM key derived from the parent's
// passphrase (PBKDF2). The key lives only in memory while unlocked.
import { db, type EncPayload } from './db'

export type { EncPayload }

const VERIFY_PLAINTEXT = 'purple-monitor-ok'
const ITERATIONS = 310000

let key: CryptoKey | null = null

const textEnc = new TextEncoder()
const textDec = new TextDecoder()

async function deriveKey(pass: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', textEnc.encode(pass), 'PBKDF2', false, [
    'deriveKey'
  ])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

async function encryptWith(k: CryptoKey, data: Uint8Array): Promise<EncPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, data)
  return { iv, data: new Uint8Array(ct) }
}

async function decryptWith(k: CryptoKey, p: EncPayload): Promise<Uint8Array> {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: p.iv }, k, p.data)
  return new Uint8Array(pt)
}

async function verifyKey(k: CryptoKey): Promise<boolean> {
  const verRec = await db.meta.get('verifier')
  if (!verRec) return false
  try {
    const pt = await decryptWith(k, verRec.value as EncPayload)
    return textDec.decode(pt) === VERIFY_PLAINTEXT
  } catch {
    return false
  }
}

export async function isInitialized(): Promise<boolean> {
  return !!(await db.meta.get('salt'))
}

export async function setup(pass: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const k = await deriveKey(pass, salt)
  const verifier = await encryptWith(k, textEnc.encode(VERIFY_PLAINTEXT))
  await db.meta.bulkPut([
    { key: 'salt', value: salt },
    { key: 'verifier', value: verifier }
  ])
  key = k
}

export async function unlock(pass: string): Promise<boolean> {
  const saltRec = await db.meta.get('salt')
  if (!saltRec) return false
  const k = await deriveKey(pass, saltRec.value as Uint8Array)
  if (!(await verifyKey(k))) return false
  key = k
  return true
}

export function lock(): void {
  key = null
}

export function isUnlocked(): boolean {
  return key !== null
}

export async function encryptBytes(data: Uint8Array): Promise<EncPayload> {
  if (!key) throw new Error('vault locked')
  return encryptWith(key, data)
}

export async function decryptBytes(p: EncPayload): Promise<Uint8Array> {
  if (!key) throw new Error('vault locked')
  return decryptWith(key, p)
}

export async function encryptBlob(b: Blob): Promise<EncPayload> {
  return encryptBytes(new Uint8Array(await b.arrayBuffer()))
}

export async function decryptToBlob(p: EncPayload, type = 'image/jpeg'): Promise<Blob> {
  const bytes = await decryptBytes(p)
  return new Blob([bytes.buffer as ArrayBuffer], { type })
}

export async function encryptJSON(obj: unknown): Promise<EncPayload> {
  return encryptBytes(textEnc.encode(JSON.stringify(obj)))
}

export async function decryptJSON<T>(p: EncPayload): Promise<T> {
  return JSON.parse(textDec.decode(await decryptBytes(p))) as T
}

// Re-encrypts every record with a key derived from the new passphrase.
export async function changePassphrase(oldPass: string, newPass: string): Promise<boolean> {
  const saltRec = await db.meta.get('salt')
  if (!saltRec) return false
  const oldKey = await deriveKey(oldPass, saltRec.value as Uint8Array)
  if (!(await verifyKey(oldKey))) return false

  const newSalt = crypto.getRandomValues(new Uint8Array(16))
  const newKey = await deriveKey(newPass, newSalt)
  const reenc = async (p: EncPayload) => encryptWith(newKey, await decryptWith(oldKey, p))

  const photos = await db.photos.toArray()
  for (const ph of photos) {
    ph.enc = await reenc(ph.enc)
    ph.thumbEnc = await reenc(ph.thumbEnc)
  }
  const diary = await db.diary.toArray()
  for (const d of diary) {
    d.enc = await reenc(d.enc)
  }
  const verifier = await encryptWith(newKey, textEnc.encode(VERIFY_PLAINTEXT))

  await db.photos.bulkPut(photos)
  await db.diary.bulkPut(diary)
  await db.meta.bulkPut([
    { key: 'salt', value: newSalt },
    { key: 'verifier', value: verifier }
  ])
  key = newKey
  return true
}
