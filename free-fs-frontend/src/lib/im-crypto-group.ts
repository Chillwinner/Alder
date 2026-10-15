/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import {
  fetchImGroupKeyWrap,
  fetchImUserPublicKey,
  publishImGroupKeyWraps,
} from '@/api/im-crypto'
import {
  generateGroupKeyMaterial,
  importGroupAesKey,
  unwrapGroupKeyForMember,
  wrapGroupKeyForMember,
} from '@/lib/im-crypto'
import { useImCryptoStore } from '@/store/im-crypto'
import { fetchImGroupMembers } from '@/api/im'

export async function ensureGroupConversationKey(groupId: string): Promise<CryptoKey | null> {
  const cached = useImCryptoStore.getState().groupKeys[groupId]
  if (cached) return cached

  const privateKey = useImCryptoStore.getState().privateKey
  if (!privateKey) return null

  const wrap = await fetchImGroupKeyWrap(groupId).catch(() => null)
  if (wrap?.wrappedKey) {
    try {
      const raw = await unwrapGroupKeyForMember(privateKey, wrap.wrappedKey)
      const aesKey = await importGroupAesKey(raw)
      useImCryptoStore.getState().setGroupKey(groupId, aesKey)
      return aesKey
    } catch {
      return null
    }
  }
  return null
}

export async function bootstrapGroupKeysAsAdmin(groupId: string): Promise<boolean> {
  const privateKey = useImCryptoStore.getState().privateKey
  if (!privateKey) return false

  const members = await fetchImGroupMembers(groupId).catch(() => null)
  if (!members?.length) return false

  const material = generateGroupKeyMaterial()
  const wraps: { userId: string; wrappedKey: string }[] = []
  for (const member of members) {
    const { publicKeySpki } = await fetchImUserPublicKey(member.userId).catch(() => ({
      publicKeySpki: '',
    }))
    if (!publicKeySpki) continue
    const wrappedKey = await wrapGroupKeyForMember(material, publicKeySpki)
    wraps.push({ userId: member.userId, wrappedKey })
  }
  if (wraps.length === 0) return false
  await publishImGroupKeyWraps(groupId, 1, wraps)
  const aesKey = await importGroupAesKey(material)
  useImCryptoStore.getState().setGroupKey(groupId, aesKey)
  return true
}
