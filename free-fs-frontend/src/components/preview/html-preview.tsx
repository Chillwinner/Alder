/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect, useState } from 'react'

type HtmlPreviewProps = {
  blob: Blob
  title: string
}

const COLOR_SCHEME_META = '<meta name="color-scheme" content="light dark">'

const NAV_GUARD = `<script>
(function () {
  document.addEventListener('click', function (event) {
    var node = event.target;
    while (node && node.tagName !== 'A') node = node.parentElement;
    if (!node) return;
    var href = node.getAttribute('href');
    if (!href) return;
    var trimmed = href.trim();
    if (trimmed.charAt(0) === '#') {
      event.preventDefault();
      event.stopPropagation();
      var id = decodeURIComponent(trimmed.slice(1));
      var el = (id && document.getElementById(id)) || document.getElementsByName(id)[0];
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start' });
      return;
    }
    if (/^(https?:|mailto:|tel:)/i.test(trimmed)) {
      event.preventDefault();
      event.stopPropagation();
      window.open(trimmed, '_blank', 'noopener,noreferrer');
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  }, true);
})();
</script>`

function isolatePreviewHtml(html: string): string {
  let next = html
  if (/<head[\s>]/i.test(next)) {
    next = next.replace(/<head([^>]*)>/i, `<head$1>${COLOR_SCHEME_META}`)
  } else if (/<html[\s>]/i.test(next)) {
    next = next.replace(/<html([^>]*)>/i, `<html$1><head>${COLOR_SCHEME_META}</head>`)
  } else {
    next = `${COLOR_SCHEME_META}${next}`
  }
  if (/<\/body>/i.test(next)) {
    return next.replace(/<\/body>/i, `${NAV_GUARD}</body>`)
  }
  return `${next}${NAV_GUARD}`
}

export function HtmlPreview({ blob, title }: HtmlPreviewProps) {
  const [src, setSrc] = useState('')

  useEffect(() => {
    let objectUrl = ''
    let cancelled = false
    void blob.text().then((html) => {
      if (cancelled) return
      const doc = new Blob([isolatePreviewHtml(html)], { type: 'text/html;charset=utf-8' })
      objectUrl = URL.createObjectURL(doc)
      setSrc(objectUrl)
    })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [blob])

  if (!src) return null

  return (
    <iframe
      title={title}
      src={src}
      sandbox='allow-scripts allow-same-origin allow-popups allow-forms allow-modals'
      className='pointer-events-auto relative z-[1] h-full w-full rounded-md border-0 bg-surface'
    />
  )
}
