/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

/**
 * 复制纯文本。在非安全上下文（如 http://192.168.x.x）下 Clipboard API 不可用，
 * 会降级为 document.execCommand('copy')。
 */
export async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('copyTextToClipboard requires a browser environment')
  }

  if (window.isSecureContext && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  textarea.setSelectionRange(0, text.length)

  try {
    const ok = document.execCommand('copy')
    if (!ok) {
      throw new Error('execCommand(copy) returned false')
    }
  } finally {
    document.body.removeChild(textarea)
  }
}
