/** tldraw document records we persist / broadcast over STOMP */
export type SyncTypeName = 'shape' | 'binding' | 'asset' | 'page'

export function isSyncRecord(record: any): boolean {
  if (!record?.id || !record?.typeName) return false
  return (
    record.typeName === 'shape' ||
    record.typeName === 'binding' ||
    record.typeName === 'asset' ||
    record.typeName === 'page'
  )
}

/** 清板只去掉图元，保留分页 */
export function isClearableRecord(record: any): boolean {
  return isSyncRecord(record) && record.typeName !== 'page'
}

/** Attach sync version; strip asset binary (lives in FILE messages). */
export function packRecord(record: any, version: number) {
  if (record.typeName === 'asset') {
    return {
      ...record,
      props: { ...record.props, src: '' },
      version,
    }
  }
  return { ...record, version }
}

export function unpackRecord(data: any, fileSrc?: string | null) {
  if (!data || typeof data !== 'object') return null
  const { version: _v, ...record } = data
  if (!isSyncRecord(record)) return null
  if (record.typeName === 'asset' && fileSrc) {
    return {
      ...record,
      props: { ...record.props, src: fileSrc },
    }
  }
  return record
}

export function assetToFilePayload(asset: any) {
  const src = asset?.props?.src
  if (!src || typeof src !== 'string' || !src.startsWith('data:')) return null
  return {
    id: asset.id,
    dataURL: src,
    mimeType: asset.props?.mimeType || 'image/png',
  }
}
