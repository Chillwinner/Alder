/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

/** 线性扫描，避免对整段 base64 跑正则卡住预览。 */
export function shieldDataImagesInMarkdown(source: string) {
  const store: string[] = []
  const md = source || ''
  if (!md.includes('](data:')) return { md, store }
  let out = ''
  let i = 0
  while (i < md.length) {
    const data = md.indexOf('](data:', i)
    if (data < 0) {
      out += md.slice(i)
      break
    }
    const bang = md.lastIndexOf('![', data)
    if (bang < i) {
      out += md.slice(i, data + 2)
      i = data + 2
      continue
    }
    const nl = md.indexOf('\n', bang)
    if (nl >= 0 && nl < data) {
      out += md.slice(i, data + 2)
      i = data + 2
      continue
    }
    const comma = md.indexOf(',', data + 2)
    const close = comma < 0 ? -1 : md.indexOf(')', comma)
    if (comma < 0 || close < 0) {
      out += md.slice(i, data + 2)
      i = data + 2
      continue
    }
    out += md.slice(i, bang)
    const alt = md.slice(bang + 2, data)
    store.push(md.slice(data + 2, close).replace(/\s+/g, ''))
    out += `![${alt}](alder-data-image:${store.length - 1})`
    i = close + 1
  }
  return { md: out, store }
}

export function resolveShieldedImageSrc(src: string, store: string[]) {
  const m = src.trim().match(/^alder-data-image:(\d+)$/)
  if (!m) return src
  return store[Number(m[1])] || src
}

export function restoreDataImagesInHtml(html: string, store: string[]) {
  return html.replace(/alder-data-image:(\d+)/g, (all, index: string) => {
    return store[Number(index)] || all
  })
}

export function restoreDataImagesInMarkdown(source: string, store: string[]) {
  if (!store.length) return source
  return (source || '').replace(/\]\(alder-data-image:(\d+)\)/g, (all, index: string) => {
    const src = store[Number(index)]
    return src ? `](${src})` : all
  })
}

function dataUrlToObjectUrl(dataUrl: string): string | null {
  try {
    const comma = dataUrl.indexOf(',')
    if (comma < 0) return null
    const mime = dataUrl.slice(5, dataUrl.indexOf(';') === -1 ? comma : dataUrl.indexOf(';')) || 'image/png'
    const binary = atob(dataUrl.slice(comma + 1))
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return URL.createObjectURL(new Blob([bytes], { type: mime || 'image/png' }))
  } catch {
    return null
  }
}

/** 预览用：data URL 换成短 blob 地址，避免把整段 base64 塞进 DOM。 */
export function hydrateDataImagesForPreview(source: string) {
  const { md, store } = shieldDataImagesInMarkdown(source)
  const urls: string[] = []
  let out = md
  store.forEach((dataUrl, index) => {
    const blobUrl = dataUrlToObjectUrl(dataUrl)
    if (!blobUrl) {
      out = out.replace(`](alder-data-image:${index})`, ']()')
      return
    }
    urls.push(blobUrl)
    out = out.split(`](alder-data-image:${index})`).join(`](${blobUrl})`)
  })
  return { markdown: out, revoke: () => urls.forEach((url) => URL.revokeObjectURL(url)) }
}

/** 把新插入的 data URL 并进已有图库，编辑区只留下短占位。 */
export function absorbDataImagesIntoStore(incoming: string, store: string[]) {
  const { md, store: added } = shieldDataImagesInMarkdown(incoming)
  if (!added.length) return incoming
  const offset = store.length
  const remapped = md.replace(/alder-data-image:(\d+)/g, (_, index: string) => {
    return `alder-data-image:${offset + Number(index)}`
  })
  store.push(...added)
  return remapped
}
