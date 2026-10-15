/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

type PdfPreviewProps = {
  src: string
  title: string
  onError?: () => void
}

export function PdfPreview({ src, title, onError }: PdfPreviewProps) {
  return (
    <iframe
      title={title}
      src={src}
      className='h-full w-full rounded-md border-0 bg-workspace-bg'
      onError={onError}
    />
  )
}
