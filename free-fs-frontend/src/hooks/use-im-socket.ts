/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect, useRef } from 'react'
import { Client, type IMessage } from '@stomp/stompjs'
import type { ImPush } from '@/types/im'

export type LanSocketEvent = {
  type: string
  sessionId?: string
  fromUserId?: string
  signalType?: string
  payload?: string
  session?: {
    id: string
    fromUserId: string
    fromName?: string
    toUserId: string
    toName?: string
    files: { name: string; relativePath: string; size: number }[]
    status: string
    createdAt?: string
  }
}

type UseImSocketOptions = {
  enabled: boolean
  onPush: (push: ImPush) => void
  onLanEvent?: (event: LanSocketEvent) => void
  onConnected?: () => void
}

function accessToken() {
  const raw = document.cookie.match(/(?:^|; )Authorization=([^;]+)/)
  return raw ? decodeURIComponent(raw[1]).replace(/^Bearer\s+/i, '') : ''
}

function withAccessToken(url: string) {
  const token = accessToken()
  if (!token) return url
  const join = url.includes('?') ? '&' : '?'
  return `${url}${join}access_token=${encodeURIComponent(token)}`
}

function resolveWsUrl() {
  const configured = import.meta.env.VITE_WS_URL as string | undefined
  if (configured) return withAccessToken(configured)
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return withAccessToken(`${protocol}//${window.location.host}/ws/conversation`)
}

export function useImSocket({ enabled, onPush, onLanEvent, onConnected }: UseImSocketOptions) {
  const onPushRef = useRef(onPush)
  const onLanEventRef = useRef(onLanEvent)
  const onConnectedRef = useRef(onConnected)

  useEffect(() => {
    onPushRef.current = onPush
  }, [onPush])

  useEffect(() => {
    onLanEventRef.current = onLanEvent
  }, [onLanEvent])

  useEffect(() => {
    onConnectedRef.current = onConnected
  }, [onConnected])

  useEffect(() => {
    if (!enabled) return undefined

    const client = new Client({
      brokerURL: resolveWsUrl(),
      reconnectDelay: 3000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        client.subscribe('/user/queue/conversation', (message: IMessage) => {
          try {
            onPushRef.current(JSON.parse(message.body) as ImPush)
          } catch {
            // ignore malformed push
          }
        })
        client.subscribe('/user/queue/lan', (message: IMessage) => {
          try {
            onLanEventRef.current?.(JSON.parse(message.body) as LanSocketEvent)
          } catch {
            // ignore malformed lan event
          }
        })
        onConnectedRef.current?.()
      },
      onStompError: () => {
        client.deactivate().then(() => client.activate())
      },
      onWebSocketClose: () => {
        client.deactivate().then(() => client.activate())
      },
    })

    client.activate()
    return () => {
      client.deactivate()
    }
  }, [enabled])
}
