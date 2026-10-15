/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import {
  decryptWithAesGcm,
  deriveSingleConversationKey,
  encryptWithAesGcm,
  parseEncryptedPayload,
  serializeEncryptedPayload,
} from '@/lib/im-crypto'
import { fetchImUserPublicKey } from '@/api/im-crypto'
import { useImCryptoStore } from '@/store/im-crypto'

export const IM_MSG_ENCRYPTED = 'ENCRYPTED_TEXT'

export async function encryptImTextMessage(options: {
  plaintext: string
  conversationId: string
  convType: 'single' | 'group'
  peerUserId?: string | null
  groupId?: string | null
}): Promise<string> {
  const privateKey = useImCryptoStore.getState().privateKey
  if (!privateKey) {
    throw new Error('im.crypto.locked')
  }
  if (options.convType === 'single') {
    const peerId = options.peerUserId
    if (!peerId) throw new Error('im.crypto.peer.missing')
    const { publicKeySpki } = await fetchImUserPublicKey(peerId)
    const aesKey = await deriveSingleConversationKey(
      privateKey,
      publicKeySpki,
      options.conversationId
    )
    const payload = await encryptWithAesGcm(aesKey, options.plaintext)
    return serializeEncryptedPayload(payload)
  }
  const groupId = options.groupId
  if (!groupId) throw new Error('im.crypto.group.missing')
  const groupKey = useImCryptoStore.getState().groupKeys[groupId]
  if (!groupKey) throw new Error('im.crypto.group.key.missing')
  const payload = await encryptWithAesGcm(groupKey, options.plaintext)
  return serializeEncryptedPayload(payload)
}

export async function decryptImTextMessage(options: {
  content: string
  conversationId: string
  convType: 'single' | 'group'
  peerUserId?: string | null
  senderId: string
  groupId?: string | null
}): Promise<string | null> {
  const payload = parseEncryptedPayload(options.content)
  if (!payload) return null
  const privateKey = useImCryptoStore.getState().privateKey
  if (!privateKey) return null
  try {
    if (options.convType === 'single') {
      const peerId = options.peerUserId
      if (!peerId) return null
      const { publicKeySpki } = await fetchImUserPublicKey(peerId)
      const aesKey = await deriveSingleConversationKey(
        privateKey,
        publicKeySpki,
        options.conversationId
      )
      return await decryptWithAesGcm(aesKey, payload)
    }
    const groupId = options.groupId
    if (!groupId) return null
    const groupKey = useImCryptoStore.getState().groupKeys[groupId]
    if (!groupKey) return null
    return await decryptWithAesGcm(groupKey, payload)
  } catch {
    return null
  }
}
