/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { MediaPlayer, MediaProvider } from '@vidstack/react'
import { defaultLayoutIcons, DefaultAudioLayout } from '@vidstack/react/player/layouts/default'
import '@vidstack/react/player/styles/default/theme.css'
import '@vidstack/react/player/styles/default/layouts/audio.css'

type AudioPreviewProps = {
  src: string
  title: string
  onError?: () => void
}

export function AudioPreview({ src, title, onError }: AudioPreviewProps) {
  return (
    <div className='flex h-full items-center justify-center px-8'>
      <MediaPlayer
        className='w-full max-w-2xl'
        src={src}
        title={title}
        viewType='audio'
        onError={onError}
      >
        <MediaProvider />
        <DefaultAudioLayout icons={defaultLayoutIcons} />
      </MediaPlayer>
    </div>
  )
}
