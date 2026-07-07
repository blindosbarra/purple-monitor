import Dexie, { type Table } from 'dexie'

export interface EncPayload {
  iv: Uint8Array
  data: Uint8Array
}

// Photo pixels are encrypted; only region and date stay indexable.
export interface PhotoRec {
  id?: number
  region: string
  dateISO: string
  w: number
  h: number
  enc: EncPayload
  thumbEnc: EncPayload
  analysisEnc?: EncPayload // encrypted Analysis JSON, set after "Analyze"
}

// The diary entry body is an encrypted JSON payload; date stays indexable.
export interface DiaryRec {
  id?: number
  dateISO: string
  enc: EncPayload
}

export interface MetaRec {
  key: string
  value: unknown
}

class PurpleMonitorDB extends Dexie {
  photos!: Table<PhotoRec, number>
  diary!: Table<DiaryRec, number>
  meta!: Table<MetaRec, string>

  constructor() {
    super('purple-monitor')
    this.version(1).stores({
      photos: '++id, region, dateISO',
      diary: '++id, dateISO',
      meta: 'key'
    })
  }
}

export const db = new PurpleMonitorDB()
