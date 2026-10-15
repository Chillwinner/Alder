/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

type ImagePreviewProps = {
  src: string
  alt: string
  onError?: () => void
}

export function ImagePreview({ src, alt, onError }: ImagePreviewProps) {
  return (
    <div className='flex h-full items-center justify-center overflow-auto rounded-md bg-workspace-bg'>
      <img
        src={src}
        alt={alt}
        className='max-h-full max-w-full object-contain'
        onError={onError}
      />
    </div>
  )
}
