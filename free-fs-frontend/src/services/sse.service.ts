/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type {
  SSECompleteData,
  SSEErrorData,
  SSEMessage,
  SSEMessageType,
  SSEProgressData,
  SSEStatusData,
} from '@/types/transfer'
import { redirectToLoginDueToUnauthorized } from '@/api/request'
import { getCurrentWorkspaceId } from '@/store/workspace'

export type SSEMessageHandler = (message: SSEMessage) => void
export type SSEConnectionHandler = (connected: boolean) => void
export type SSERawEventHandler = (type: string, data: Record<string, unknown>) => void

interface SSEServiceConfig {
  baseUrl: string
  endpoint: string
  syncOnReconnect: boolean
}

const DEFAULT_CONFIG: SSEServiceConfig = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || '',
  endpoint: '/apis/transfer/sse',
  syncOnReconnect: true,
}

function parseProgressData(data: Record<string, unknown>): SSEProgressData {
  return {
    uploadedBytes: Number(data.uploadedBytes) || 0,
    totalBytes: Number(data.totalBytes) || 0,
    uploadedChunks: Number(data.uploadedChunks) || 0,
    totalChunks: Number(data.totalChunks) || 0,
  }
}

function parseStatusData(data: Record<string, unknown>): SSEStatusData {
  return {
    status: (data.status as string) || 'idle',
    message: (data.message as string | undefined) || undefined,
  } as SSEStatusData
}

function parseCompleteData(data: Record<string, unknown>): SSECompleteData {
  return {
    fileId: (data.fileId as string) || '',
    fileName: (data.fileName as string) || '',
    fileSize: Number(data.fileSize) || 0,
  }
}

function parseErrorData(data: Record<string, unknown>): SSEErrorData {
  return {
    code: (data.code as string) || 'UNKNOWN_ERROR',
    message: (data.message as string) || '',
  }
}

class SSEService {
  private static instance: SSEService | null = null
  private abortController: AbortController | null = null
  private reconnectTimer: number | null = null
  private messageHandlers: Set<SSEMessageHandler> = new Set()
  private connectionHandlers: Set<SSEConnectionHandler> = new Set()
  private rawEventHandlers: Set<SSERawEventHandler> = new Set()
  private config: SSEServiceConfig
  private connected = false
  private shouldReconnect = false
  private connectionGeneration = 0
  private onReconnectSync: (() => Promise<void>) | null = null
  private reconnectAttempts = 0
  private readonly MAX_RECONNECT_ATTEMPTS = 5
  private readonly RECONNECT_BASE_DELAY = 2000

  private constructor(config: Partial<SSEServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  public static getInstance(config?: Partial<SSEServiceConfig>): SSEService {
    if (!SSEService.instance) {
      SSEService.instance = new SSEService(config)
    }
    return SSEService.instance
  }

  public connect(): void {
    if (this.abortController) return

    this.shouldReconnect = true
    this.connectionGeneration += 1
    void this.openConnection(this.connectionGeneration)
  }

  public disconnect(): void {
    this.shouldReconnect = false
    this.connectionGeneration += 1

    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.abortController?.abort()
    this.abortController = null
    this.reconnectAttempts = 0
    this.setConnected(false)
  }

  public isConnected(): boolean {
    return this.connected
  }

  public onMessage(handler: SSEMessageHandler): () => void {
    this.messageHandlers.add(handler)
    return () => {
      this.messageHandlers.delete(handler)
    }
  }

  public onConnectionChange(handler: SSEConnectionHandler): () => void {
    this.connectionHandlers.add(handler)
    return () => {
      this.connectionHandlers.delete(handler)
    }
  }

  public onRawEvent(handler: SSERawEventHandler): () => void {
    this.rawEventHandlers.add(handler)
    return () => {
      this.rawEventHandlers.delete(handler)
    }
  }

  public setReconnectSyncCallback(callback: () => Promise<void>): void {
    this.onReconnectSync = callback
  }

  private async openConnection(generation: number): Promise<void> {
    const workspaceId = getCurrentWorkspaceId()
    if (!workspaceId || generation !== this.connectionGeneration) return

    const controller = new AbortController()
    this.abortController = controller

    try {
      const response = await fetch(
        `${this.config.baseUrl}${this.config.endpoint}`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            Accept: 'text/event-stream',
            'X-Workspace-Id': workspaceId,
          },
          cache: 'no-store',
          signal: controller.signal,
        }
      )

      if (response.status === 401) {
        this.shouldReconnect = false
        redirectToLoginDueToUnauthorized()
        return
      }
      if (!response.ok || !response.body) {
        throw new Error(`SSE request failed with status ${response.status}`)
      }

      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('text/event-stream')) {
        if (contentType.includes('application/json')) {
          const result = (await response.json()) as { code?: number }
          if (result.code === 401) {
            this.shouldReconnect = false
            redirectToLoginDueToUnauthorized()
            return
          }
        }
        throw new Error(`Unexpected SSE content type: ${contentType || 'unknown'}`)
      }

      this.reconnectAttempts = 0
      this.setConnected(true)
      await this.consumeStream(response.body, generation)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
    } finally {
      if (this.abortController === controller) {
        this.abortController = null
      }
      if (generation === this.connectionGeneration) {
        this.setConnected(false)
        this.scheduleReconnect(generation)
      }
    }
  }

  private async consumeStream(
    stream: ReadableStream<Uint8Array>,
    generation: number
  ): Promise<void> {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (generation === this.connectionGeneration) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
        let boundary = buffer.indexOf('\n\n')
        while (boundary !== -1) {
          this.handleEventBlock(buffer.slice(0, boundary))
          buffer = buffer.slice(boundary + 2)
          boundary = buffer.indexOf('\n\n')
        }
      }

      buffer += decoder.decode()
      if (buffer.trim()) {
        this.handleEventBlock(buffer)
      }
    } finally {
      reader.releaseLock()
    }
  }

  private handleEventBlock(block: string): void {
    let eventType: string | undefined
    const dataLines: string[] = []

    for (const line of block.split('\n')) {
      if (!line || line.startsWith(':')) continue

      const separator = line.indexOf(':')
      const field = separator === -1 ? line : line.slice(0, separator)
      let value = separator === -1 ? '' : line.slice(separator + 1)
      if (value.startsWith(' ')) value = value.slice(1)

      if (field === 'event') eventType = value
      if (field === 'data') dataLines.push(value)
    }

    if (dataLines.length === 0) return

    try {
      const rawData = JSON.parse(dataLines.join('\n')) as Record<string, unknown>
      const type = (eventType || (rawData.type as string | undefined) || '').trim()
      if (!type) return

      this.rawEventHandlers.forEach((handler) => {
        try {
          handler(type, rawData)
        } catch {
          // Silent
        }
      })

      const message = this.parseMessage(type as SSEMessageType, rawData)
      if (message) this.dispatchMessage(message)
    } catch {
      // Ignore malformed or heartbeat events.
    }
  }

  private scheduleReconnect(generation: number): void {
    if (
      !this.shouldReconnect ||
      generation !== this.connectionGeneration ||
      this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS
    ) {
      return
    }

    this.reconnectAttempts += 1
    const delay = this.RECONNECT_BASE_DELAY * this.reconnectAttempts
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null
      if (this.shouldReconnect && generation === this.connectionGeneration) {
        void this.openConnection(generation)
      }
    }, delay)
  }

  private setConnected(connected: boolean): void {
    const wasConnected = this.connected
    if (wasConnected === connected) return

    this.connected = connected
    this.connectionHandlers.forEach((handler) => {
      try {
        handler(connected)
      } catch {
        // Silent
      }
    })

    if (!wasConnected && connected && this.config.syncOnReconnect) {
      void this.triggerReconnectSync()
    }
  }

  private async triggerReconnectSync(): Promise<void> {
    if (this.onReconnectSync) {
      try {
        await this.onReconnectSync()
      } catch {
        // Silent
      }
    }
  }

  private parseMessage(
    type: SSEMessageType,
    rawData: Record<string, unknown>
  ): SSEMessage | null {
    const taskId = rawData.taskId as string
    if (!taskId) return null

    const data = (rawData.data as Record<string, unknown>) || rawData

    switch (type) {
      case 'progress':
        return { type: 'progress', taskId, data: parseProgressData(data) }
      case 'status':
        return { type: 'status', taskId, data: parseStatusData(data) }
      case 'complete':
        return { type: 'complete', taskId, data: parseCompleteData(data) }
      case 'error':
        return { type: 'error', taskId, data: parseErrorData(data) }
      default:
        return null
    }
  }

  private dispatchMessage(message: SSEMessage): void {
    this.messageHandlers.forEach((handler) => {
      try {
        handler(message)
      } catch {
        // Silent
      }
    })
  }
}

export const sseService = SSEService.getInstance()
export { SSEService }
