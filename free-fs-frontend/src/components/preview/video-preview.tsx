/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { MediaPlayer, MediaProvider } from '@vidstack/react'
import { defaultLayoutIcons, DefaultVideoLayout } from '@vidstack/react/player/layouts/default'
import '@vidstack/react/player/styles/default/theme.css'
import '@vidstack/react/player/styles/default/layouts/video.css'

type VideoPreviewProps = {
  src: string
  title: string
  onError?: () => void
}

export function VideoPreview({ src, title, onError }: VideoPreviewProps) {
  return (
    <div className='flex h-full items-center justify-center bg-workspace-bg'>
      <MediaPlayer
        className='h-full w-full'
        src={src}
        title={title}
        viewType='video'
        onError={onError}
      >
        <MediaProvider />
        <DefaultVideoLayout icons={defaultLayoutIcons} />
      </MediaPlayer>
    </div>
  )
}
