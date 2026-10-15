/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect, useState } from 'react'
import { decryptImTextMessage, IM_MSG_ENCRYPTED } from '@/lib/im-crypto-message'
import { normalizeImMsgType } from '@/utils/im-message-content'
import type { ImInboxItem, ImMessage } from '@/types/im'
import { useImCryptoStore } from '@/store/im-crypto'

export function useImMessagePlaintext(message: ImMessage, meta: ImInboxItem | null) {
  const unlocked = useImCryptoStore((s) => s.unlocked)
  const msgType = normalizeImMsgType(message.msgType)
  const [plaintext, setPlaintext] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (msgType !== IM_MSG_ENCRYPTED) {
      setPlaintext(null)
      setFailed(false)
      return
    }
    if (!unlocked || !meta?.conversationId) {
      setPlaintext(null)
      setFailed(true)
      return
    }
    let cancelled = false
    void decryptImTextMessage({
      content: message.content,
      conversationId: meta.conversationId,
      convType: meta.convType,
      peerUserId: meta.peerUserId,
      senderId: message.senderId,
      groupId: meta.groupId,
    }).then((text) => {
      if (cancelled) return
      if (text == null) {
        setPlaintext(null)
        setFailed(true)
      } else {
        setPlaintext(text)
        setFailed(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [
    message.content,
    message.senderId,
    meta?.conversationId,
    meta?.convType,
    meta?.groupId,
    meta?.peerUserId,
    msgType,
    unlocked,
  ])

  return { msgType, plaintext, failed, isEncrypted: msgType === IM_MSG_ENCRYPTED }
}
