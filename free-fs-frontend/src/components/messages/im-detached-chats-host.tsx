/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { ImDetachedChatWindow } from '@/components/messages/im-detached-chat-window'
import { useImStore } from '@/store/im'

export function ImDetachedChatsHost() {
  const detachedChats = useImStore((state) => state.detachedChats)

  if (detachedChats.length === 0) return null

  return (
    <>
      {detachedChats.map((chat) => (
        <ImDetachedChatWindow key={chat.id} chat={chat} />
      ))}
    </>
  )
}
