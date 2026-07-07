// Backup = all records exactly as stored (still encrypted) plus the KDF
// salt, serialized to JSON. Restoring needs the passphrase that was in
// use when the backup was made.
import { db, type EncPayload } from './db'

const FORMAT = 'purple-monitor-backup'

function u8ToB64(u8: Uint8Array): string {
  let s = ''
  const CHUNK = 0x8000
  for (let i = 0; i < u8.length; i += CHUNK) {
    s += String.fromCharCode(...u8.subarray(i, i + CHUNK))
  }
  return btoa(s)
}

function b64ToU8(b64: string): Uint8Array {
  const s = atob(b64)
  const u8 = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i)
  return u8
}

interface SerPayload {
  iv: string
  data: string
}

function ser(p: EncPayload): SerPayload {
  return { iv: u8ToB64(p.iv), data: u8ToB64(p.data) }
}

function deser(p: SerPayload): EncPayload {
  return { iv: b64ToU8(p.iv), data: b64ToU8(p.data) }
}

type SerMeta =
  | { key: string; kind: 'bytes'; value: string }
  | { key: string; kind: 'enc'; value: SerPayload }
  | { key: string; kind: 'json'; value: unknown }

interface BackupFile {
  format: string
  version: number
  exportedAt: string
  meta: SerMeta[]
  photos: { region: string; dateISO: string; w: number; h: number; enc: SerPayload; thumbEnc: SerPayload }[]
  diary: { dateISO: string; enc: SerPayload }[]
}

export async function exportBackup(): Promise<Blob> {
  const meta: SerMeta[] = (await db.meta.toArray()).map((m) => {
    if (m.value instanceof Uint8Array) return { key: m.key, kind: 'bytes', value: u8ToB64(m.value) }
    if (m.value && typeof m.value === 'object' && 'iv' in (m.value as object)) {
      return { key: m.key, kind: 'enc', value: ser(m.value as EncPayload) }
    }
    return { key: m.key, kind: 'json', value: m.value }
  })
  const out: BackupFile = {
    format: FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    meta,
    photos: (await db.photos.toArray()).map((p) => ({
      region: p.region,
      dateISO: p.dateISO,
      w: p.w,
      h: p.h,
      enc: ser(p.enc),
      thumbEnc: ser(p.thumbEnc)
    })),
    diary: (await db.diary.toArray()).map((d) => ({ dateISO: d.dateISO, enc: ser(d.enc) }))
  }
  return new Blob([JSON.stringify(out)], { type: 'application/json' })
}

export async function importBackup(text: string): Promise<void> {
  const data = JSON.parse(text) as BackupFile
  if (data.format !== FORMAT || !Array.isArray(data.photos) || !Array.isArray(data.diary)) {
    throw new Error('invalid backup')
  }
  await db.transaction('rw', db.photos, db.diary, db.meta, async () => {
    await db.photos.clear()
    await db.diary.clear()
    await db.meta.clear()
    await db.meta.bulkPut(
      data.meta.map((m) => ({
        key: m.key,
        value: m.kind === 'bytes' ? b64ToU8(m.value) : m.kind === 'enc' ? deser(m.value) : m.value
      }))
    )
    await db.photos.bulkAdd(
      data.photos.map((p) => ({
        region: p.region,
        dateISO: p.dateISO,
        w: p.w,
        h: p.h,
        enc: deser(p.enc),
        thumbEnc: deser(p.thumbEnc)
      }))
    )
    await db.diary.bulkAdd(data.diary.map((d) => ({ dateISO: d.dateISO, enc: deser(d.enc) })))
  })
}
