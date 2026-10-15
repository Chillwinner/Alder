const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

export function isPngBytes(bytes: Uint8Array) {
  return bytes.length >= 8 && PNG_MAGIC.every((b, i) => bytes[i] === b)
}

export async function asPngBlob(blob: Blob): Promise<Blob> {
  const head = new Uint8Array(await blob.slice(0, 8).arrayBuffer())
  if (!isPngBytes(head)) {
    throw new Error('NOT_PNG')
  }
  if (blob.type === 'image/png') return blob
  return new Blob([blob], { type: 'image/png' })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}
