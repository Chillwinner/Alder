/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { signalLanSession } from '@/api/lan'
import type { LanFileMeta } from '@/api/lan'

const CHUNK = 64 * 1024

type Control =
  | { t: 'start'; i: number; name: string; path: string; size: number }
  | { t: 'end'; i: number }
  | { t: 'done' }

export type LanProgress = { sent: number; total: number }

function encodeControl(msg: Control) {
  return new TextEncoder().encode('\u0001' + JSON.stringify(msg))
}

export function createLanPeer(sessionId: string, polite: boolean) {
  const pc = new RTCPeerConnection({ iceServers: [] })
  const pendingIce: string[] = []
  let channel: RTCDataChannel | null = null
  let makingOffer = false

  pc.onicecandidate = (event) => {
    if (!event.candidate || event.candidate.type === 'relay') return
    void signalLanSession(sessionId, 'ice', JSON.stringify(event.candidate))
  }

  const ready = new Promise<RTCDataChannel>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('lan.connect.timeout')), 45_000)
    const onOpen = (next: RTCDataChannel) => {
      window.clearTimeout(timer)
      channel = next
      next.binaryType = 'arraybuffer'
      resolve(next)
    }
    if (!polite) {
      const ch = pc.createDataChannel('lan', { ordered: true })
      ch.onopen = () => onOpen(ch)
    }
    pc.ondatachannel = (event) => onOpen(event.channel)
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        reject(new Error('lan.not.same.network'))
      }
    }
  })

  async function localOffer() {
    makingOffer = true
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    makingOffer = false
    await signalLanSession(sessionId, 'offer', JSON.stringify(pc.localDescription))
  }

  async function handleSignal(type: string, payload: string) {
    if (type === 'offer') {
      const desc = JSON.parse(payload) as RTCSessionDescriptionInit
      if (makingOffer) return
      await pc.setRemoteDescription(desc)
      await flushIce()
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      await signalLanSession(sessionId, 'answer', JSON.stringify(pc.localDescription))
      return
    }
    if (type === 'answer') {
      await pc.setRemoteDescription(JSON.parse(payload) as RTCSessionDescriptionInit)
      await flushIce()
      return
    }
    if (type === 'ice') {
      if (!pc.remoteDescription) {
        pendingIce.push(payload)
        return
      }
      await pc.addIceCandidate(JSON.parse(payload) as RTCIceCandidateInit)
    }
  }

  async function flushIce() {
    const queued = pendingIce.splice(0, pendingIce.length)
    for (const ice of queued) {
      await pc.addIceCandidate(JSON.parse(ice) as RTCIceCandidateInit)
    }
  }

  async function waitChannel() {
    return ready
  }

  function close() {
    channel?.close()
    pc.close()
  }

  return { localOffer, handleSignal, waitChannel, close }
}

export async function sendLanFiles(
  channel: RTCDataChannel,
  files: File[],
  onProgress?: (p: LanProgress) => void
) {
  const total = files.reduce((sum, file) => sum + file.size, 0)
  let sent = 0
  const waitBuffer = () =>
    new Promise<void>((resolve) => {
      if (channel.bufferedAmount < CHUNK * 16) {
        resolve()
        return
      }
      const on = () => {
        if (channel.bufferedAmount < CHUNK * 8) {
          channel.removeEventListener('bufferedamountlow', on)
          resolve()
        }
      }
      channel.bufferedAmountLowThreshold = CHUNK * 8
      channel.addEventListener('bufferedamountlow', on)
    })

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i]
    const path = file.webkitRelativePath || file.name
    channel.send(encodeControl({ t: 'start', i, name: file.name, path, size: file.size }))
    let offset = 0
    while (offset < file.size) {
      const blob = file.slice(offset, offset + CHUNK)
      const buf = await blob.arrayBuffer()
      await waitBuffer()
      channel.send(buf)
      offset += buf.byteLength
      sent += buf.byteLength
      onProgress?.({ sent, total })
    }
    channel.send(encodeControl({ t: 'end', i }))
  }
  channel.send(encodeControl({ t: 'done' }))
  await new Promise<void>((resolve) => {
    if (channel.bufferedAmount === 0) {
      resolve()
      return
    }
    const finish = () => {
      channel.removeEventListener('bufferedamountlow', finish)
      resolve()
    }
    channel.bufferedAmountLowThreshold = 0
    channel.addEventListener('bufferedamountlow', finish)
    window.setTimeout(finish, 8000)
  })
}

export async function receiveLanFiles(
  channel: RTCDataChannel,
  files: LanFileMeta[],
  write: (path: string, chunk: ArrayBuffer, done: boolean) => Promise<void>,
  onProgress?: (p: LanProgress) => void
) {
  const total = files.reduce((sum, file) => sum + file.size, 0)
  let received = 0
  await new Promise<void>((resolve, reject) => {
    let currentPath = ''
    let settled = false
    let chain = Promise.resolve()
    const finish = (error?: unknown) => {
      if (settled) return
      settled = true
      if (error) reject(error)
      else resolve()
    }
    channel.onmessage = (event) => {
      chain = chain
        .then(async () => {
          if (settled) return
          const raw =
            event.data instanceof Blob ? await event.data.arrayBuffer() : event.data
          if (!(raw instanceof ArrayBuffer)) return
          const bytes = new Uint8Array(raw)
          if (bytes[0] === 1) {
            const msg = JSON.parse(new TextDecoder().decode(bytes.slice(1))) as Control
            if (msg.t === 'start') {
              currentPath = msg.path || msg.name
            } else if (msg.t === 'end') {
              await write(currentPath, new ArrayBuffer(0), true)
            } else if (msg.t === 'done') {
              finish()
            }
            return
          }
          await write(currentPath, raw, false)
          received += raw.byteLength
          onProgress?.({ sent: received, total })
        })
        .catch((error) => finish(error))
    }
    channel.onerror = () => finish(new Error('lan.channel.failed'))
    channel.onclose = () => {
      if (!settled) finish(new Error('lan.channel.failed'))
    }
  })
}
