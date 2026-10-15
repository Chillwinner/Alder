/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { resolveMediaUrl } from '@/utils/media-url'
import { getAvatarColorPair, getDisplayInitials } from './im-avatar-style'

type ImRailAvatarProps = {
  name: string
  avatar?: string | null
  colorSeed?: string
  size?: 'sm' | 'md'
  active?: boolean
  className?: string
}

export function ImRailAvatar({
  name,
  avatar,
  colorSeed,
  size = 'md',
  active,
  className,
}: ImRailAvatarProps) {
  const colors = getAvatarColorPair(colorSeed || name)
  const dimension = size === 'sm' ? 'size-9' : 'size-10'

  return (
    <Avatar
      className={cn(
        dimension,
        'rounded-[10px]',
        active && 'ring-2 ring-primary/70 ring-offset-1 ring-offset-sidebar',
        className
      )}
    >
      {avatar ? <AvatarImage src={resolveMediaUrl(avatar)} alt={name} className='rounded-[10px]' /> : null}
      <AvatarFallback
        className='rounded-[10px] text-xs font-semibold'
        style={{ backgroundColor: colors.background, color: colors.color }}
      >
        {getDisplayInitials(name)}
      </AvatarFallback>
    </Avatar>
  )
}
