import { useEffect, useState } from 'react'
import * as vault from '../storage/vault'
import type { EncPayload } from '../storage/db'

// Decrypts an encrypted image payload into a temporary object URL.
export function usePhotoUrl(payload: EncPayload | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!payload) {
      setUrl(null)
      return
    }
    let alive = true
    let u: string | null = null
    vault
      .decryptToBlob(payload)
      .then((b) => {
        if (!alive) return
        u = URL.createObjectURL(b)
        setUrl(u)
      })
      .catch(() => {})
    return () => {
      alive = false
      if (u) URL.revokeObjectURL(u)
    }
  }, [payload])
  return url
}

export function EncImage({
  payload,
  className,
  alt
}: {
  payload: EncPayload
  className?: string
  alt?: string
}) {
  const url = usePhotoUrl(payload)
  if (!url) return <div className={`img-loading ${className ?? ''}`} />
  return <img src={url} className={className} alt={alt ?? ''} />
}
