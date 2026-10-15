import { getIceServers, type IceConfigResponse } from '../api/room'

export interface PrefetchedVoice {
  roomId: string
  identity: string
  ice: Promise<IceConfigResponse>
}

let cache: PrefetchedVoice | null = null

export function randomIdentity() {
  const adjectives = ['Swift', 'Bright', 'Calm', 'Lucky', 'Cosmic', 'Neon', 'Quiet', 'Bold']
  const animals = ['Fox', 'Panda', 'Owl', 'Tiger', 'Koala', 'Otter', 'Hawk', 'Wolf']
  const a = adjectives[Math.floor(Math.random() * adjectives.length)]
  const b = animals[Math.floor(Math.random() * animals.length)]
  const n = Math.floor(Math.random() * 90) + 10
  return `${a}${b}${n}`
}

export function prefetchVoice(roomId: string, identity = randomIdentity()) {
  const ice = getIceServers(roomId, identity)
  ice.catch((e) => console.warn('[语音] 预取 ICE 配置失败:', e))
  cache = { roomId, identity, ice }
  return cache
}

export function peekPrefetch(roomId: string): PrefetchedVoice | null {
  if (cache && cache.roomId === roomId) return cache
  return null
}

export function takePrefetch(roomId: string): PrefetchedVoice | null {
  if (cache && cache.roomId === roomId) {
    const hit = cache
    cache = null
    return hit
  }
  return null
}
