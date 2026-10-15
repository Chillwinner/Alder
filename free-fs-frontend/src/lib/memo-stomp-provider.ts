/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { Client } from '@stomp/stompjs'
import * as Y from 'yjs'
import {
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  Awareness,
} from 'y-protocols/awareness'
import type { MemoSyncPayload } from '@/types/workspace-board'
import { base64ToBytes, bytesToBase64 } from '@/lib/base64-bytes'

function resolveBoardWsUrl() {
  const configured = import.meta.env.VITE_WS_BOARD_URL as string | undefined
  if (configured) return configured
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const raw = document.cookie.match(/(?:^|; )Authorization=([^;]+)/)
  const token = raw ? decodeURIComponent(raw[1]).replace(/^Bearer\s+/i, '') : ''
  const qs = token ? `?access_token=${encodeURIComponent(token)}` : ''
  return `${protocol}//${window.location.host}/ws/workspace-board${qs}`
}

export type MemoCollabStatus = 'connecting' | 'connected' | 'disconnected'

export class MemoStompProvider {
  readonly doc: Y.Doc
  readonly awareness: Awareness
  private client: Client | null = null
  private snapshotTimer: ReturnType<typeof setInterval> | null = null
  private destroyed = false

  constructor(
    private memoId: string,
    private onStatus?: (status: MemoCollabStatus) => void
  ) {
    this.doc = new Y.Doc()
    this.awareness = new Awareness(this.doc)
  }

  applyInitialState(payloadBase64?: string | null) {
    if (!payloadBase64) return
    const bytes = base64ToBytes(payloadBase64)
    if (bytes.length > 0) {
      Y.applyUpdate(this.doc, bytes, 'server')
    }
  }

  connect() {
    if (this.destroyed) return
    this.onStatus?.('connecting')

    this.doc.on('update', (update: Uint8Array, origin) => {
      if (origin === 'remote' || origin === 'server') return
      this.publishSync('UPDATE', update)
    })

    this.awareness.on('update', ({ added, updated, removed }, origin) => {
      if (origin === 'remote') return
      const changed = [...added, ...updated, ...removed]
      if (changed.length === 0) return
      const encoded = encodeAwarenessUpdate(this.awareness, changed)
      this.publishSync('AWARENESS', encoded)
    })

    this.client = new Client({
      brokerURL: resolveBoardWsUrl(),
      reconnectDelay: 3000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        this.client?.subscribe(`/topic/memo.${this.memoId}`, (message) => {
          try {
            this.handleRemote(JSON.parse(message.body) as MemoSyncPayload)
          } catch {
            // ignore malformed frame
          }
        })
        this.client?.publish({
          destination: '/app/memo/join',
          body: JSON.stringify({ memoId: this.memoId, type: 'JOIN' }),
        })
        this.onStatus?.('connected')
      },
      onWebSocketClose: () => {
        if (!this.destroyed) {
          this.onStatus?.('disconnected')
        }
      },
      onStompError: () => {
        if (!this.destroyed) {
          this.onStatus?.('disconnected')
        }
      },
      onDisconnect: () => {
        if (!this.destroyed) {
          this.onStatus?.('disconnected')
        }
      },
    })

    this.client.activate()

    this.snapshotTimer = setInterval(() => {
      this.publishSnapshot()
    }, 8000)
  }

  private handleRemote(payload: MemoSyncPayload) {
    if (!payload.payloadBase64) return
    const bytes = base64ToBytes(payload.payloadBase64)
    const type = (payload.type || '').toUpperCase()
    if (type === 'SNAPSHOT' || type === 'UPDATE') {
      Y.applyUpdate(this.doc, bytes, 'remote')
      return
    }
    if (type === 'AWARENESS') {
      applyAwarenessUpdate(this.awareness, bytes, 'remote')
    }
  }

  private publishSync(type: string, data: Uint8Array) {
    if (!this.client?.connected) return
    this.client.publish({
      destination: '/app/memo/sync',
      body: JSON.stringify({
        memoId: this.memoId,
        type,
        payloadBase64: bytesToBase64(data),
      }),
    })
  }

  publishSnapshot() {
    if (!this.client?.connected) return
    const state = Y.encodeStateAsUpdate(this.doc)
    if (state.length === 0) return
    this.publishSync('SNAPSHOT', state)
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer)
      this.snapshotTimer = null
    }
    this.publishSnapshot()
    if (this.client?.connected) {
      this.client.publish({
        destination: '/app/memo/leave',
        body: JSON.stringify({ memoId: this.memoId, type: 'LEAVE' }),
      })
    }
    void this.client?.deactivate()
    this.awareness.destroy()
    this.doc.destroy()
  }
}
