/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { getAvatarFallback } from '@/utils/avatar'

function hashString(value: string) {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash)
}

export function getAvatarColorPair(seed: string) {
  const hue = hashString(seed) % 360
  return {
    background: `hsl(${hue} 70% 90%)`,
    color: `hsl(${hue} 55% 36%)`,
  }
}

export function getDisplayInitials(name: string) {
  return getAvatarFallback(name)
}
