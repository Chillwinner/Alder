/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect, useRef, useState } from 'react'
import { Client, type IMessage } from '@stomp/stompjs'
import type { IceServer } from '@/api/meeting'

export type CameraTile = {
  peerId: string
  name: string
  isLocal: boolean
  stream: MediaStream | null
}

type Signal = {
  type: string
  from?: string
  to?: string
  name?: string
  sdp?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
  snapshot?: string
  sharerName?: string
}

function boardWsUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws/workspace-board`
}

export function useMeetingMedia(options: {
  roomId: string | null
  selfId: string
  selfName: string
  iceServers: IceServer[]
  onBoardSnapshot: (raw: string) => void
}) {
  const { roomId, selfId, selfName, iceServers, onBoardSnapshot } = options
  const clientRef = useRef<Client | null>(null)
  const peersRef = useRef(new Map<string, RTCPeerConnection>())
  const namesRef = useRef(new Map<string, string>())
  const cameraOnRef = useRef(new Set<string>())
  const localAudioRef = useRef<MediaStream | null>(null)
  const localCameraRef = useRef<MediaStream | null>(null)
  const localScreenRef = useRef<MediaStream | null>(null)
  const remoteVideoRef = useRef(new Map<string, MediaStream>())
  const [tiles, setTiles] = useState<CameraTile[]>([])
  const [micOn, setMicOn] = useState(false)
  const [cameraOn, setCameraOn] = useState(false)
  const [screenOn, setScreenOn] = useState(false)
  const [remoteScreen, setRemoteScreen] = useState<MediaStream | null>(null)
  const [localScreen, setLocalScreen] = useState<MediaStream | null>(null)
  const [screenBusyName, setScreenBusyName] = useState<string | null>(null)
  const onBoardRef = useRef(onBoardSnapshot)
  onBoardRef.current = onBoardSnapshot

  const publish = (channel: 'voice' | 'camera' | 'screen' | 'board', body: Signal) => {
    const client = clientRef.current
    if (!client?.connected || !roomId) return
    client.publish({
      destination: `/app/meeting/${roomId}/${channel}`,
      body: JSON.stringify({ ...body, from: selfId, name: selfName }),
    })
  }

  const refreshTiles = () => {
    const next: CameraTile[] = []
    if (cameraOnRef.current.has(selfId)) {
      next.push({
        peerId: selfId,
        name: selfName,
        isLocal: true,
        stream: localCameraRef.current,
      })
    }
    for (const peerId of cameraOnRef.current) {
      if (peerId === selfId) continue
      next.push({
        peerId,
        name: namesRef.current.get(peerId) || peerId,
        isLocal: false,
        stream: remoteVideoRef.current.get(peerId) ?? null,
      })
    }
    setTiles(next)
  }

  const iceConfig = (): RTCConfiguration => ({
    iceServers: iceServers.map((server) => ({
      urls: server.urls,
      username: server.username || undefined,
      credential: server.credential || undefined,
    })),
    iceTransportPolicy: 'all',
  })

  const ensurePeer = (remoteId: string) => {
    const existing = peersRef.current.get(remoteId)
    if (existing) return existing
    const pc = new RTCPeerConnection(iceConfig())
    peersRef.current.set(remoteId, pc)
    localAudioRef.current?.getTracks().forEach((track) => pc.addTrack(track, localAudioRef.current!))
    localCameraRef.current?.getVideoTracks().forEach((track) => pc.addTrack(track, localCameraRef.current!))
    localScreenRef.current?.getVideoTracks().forEach((track) => pc.addTrack(track, localScreenRef.current!))
    pc.onicecandidate = (event) => {
      if (!event.candidate) return
      publish('voice', {
        type: 'VOICE_ICE',
        to: remoteId,
        candidate: event.candidate.toJSON(),
      })
    }
    pc.ontrack = (event) => {
      const incoming = event.streams[0] ?? new MediaStream([event.track])
      if (event.track.kind === 'video' && /screen|display|monitor/i.test(event.track.label)) {
        setRemoteScreen(incoming)
        return
      }
      if (event.track.kind === 'video') {
        remoteVideoRef.current.set(remoteId, incoming)
        cameraOnRef.current.add(remoteId)
        refreshTiles()
      }
    }
    return pc
  }

  const offerTo = async (remoteId: string) => {
    const pc = ensurePeer(remoteId)
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    publish('voice', { type: 'VOICE_OFFER', to: remoteId, sdp: offer })
  }

  useEffect(() => {
    if (!roomId || !selfId) return undefined
    const client = new Client({
      brokerURL: boardWsUrl(),
      reconnectDelay: 2000,
      onConnect: () => {
        client.subscribe(`/topic/meeting/${roomId}`, (message: IMessage) => {
          void handle(JSON.parse(message.body) as Signal)
        })
        client.subscribe('/user/queue/meeting', (message: IMessage) => {
          void handle(JSON.parse(message.body) as Signal)
        })
        publishJoin()
      },
    })
    clientRef.current = client
    client.activate()

    const publishJoin = () => {
      client.publish({
        destination: `/app/meeting/${roomId}/voice`,
        body: JSON.stringify({ type: 'VOICE_JOIN', from: selfId, name: selfName }),
      })
    }

    const handle = async (signal: Signal) => {
      if (signal.type === 'BOARD_INIT' || signal.type === 'BOARD_SNAPSHOT') {
        const raw = signal.type === 'BOARD_INIT' ? signal.snapshot : JSON.stringify(signal)
        if (raw) onBoardRef.current(raw)
        return
      }
      if (signal.type === 'SCREEN_BUSY') {
        setScreenBusyName(signal.sharerName || '')
        setScreenOn(false)
        localScreenRef.current?.getTracks().forEach((track) => track.stop())
        localScreenRef.current = null
        setLocalScreen(null)
        return
      }
      if (!signal.from || signal.from === selfId) return
      if (signal.name) namesRef.current.set(signal.from, signal.name)
      if (signal.to && signal.to !== selfId) return
      if (signal.type === 'VOICE_JOIN') {
        if (selfId < signal.from) await offerTo(signal.from)
        return
      }
      if (signal.type === 'CAMERA_START') {
        cameraOnRef.current.add(signal.from)
        refreshTiles()
        return
      }
      if (signal.type === 'CAMERA_STOP') {
        cameraOnRef.current.delete(signal.from)
        refreshTiles()
        return
      }
      if (signal.type === 'SCREEN_STOP') {
        setRemoteScreen(null)
        return
      }
      const pc = ensurePeer(signal.from)
      if (signal.type === 'VOICE_OFFER' && signal.sdp) {
        await pc.setRemoteDescription(signal.sdp)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        publish('voice', { type: 'VOICE_ANSWER', to: signal.from, sdp: answer })
        return
      }
      if (signal.type === 'VOICE_ANSWER' && signal.sdp) {
        await pc.setRemoteDescription(signal.sdp)
        return
      }
      if (signal.type === 'VOICE_ICE' && signal.candidate) {
        await pc.addIceCandidate(signal.candidate)
      }
    }

    return () => {
      client.deactivate()
      peersRef.current.forEach((pc) => pc.close())
      peersRef.current.clear()
      localAudioRef.current?.getTracks().forEach((track) => track.stop())
      localCameraRef.current?.getTracks().forEach((track) => track.stop())
      localScreenRef.current?.getTracks().forEach((track) => track.stop())
    }
    // iceServers identity is stable enough for the session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, selfId, selfName])

  const renegotiate = async () => {
    for (const remoteId of peersRef.current.keys()) {
      if (selfId < remoteId) await offerTo(remoteId)
    }
  }

  const toggleMic = async () => {
    if (micOn) {
      localAudioRef.current?.getTracks().forEach((track) => track.stop())
      localAudioRef.current = null
      setMicOn(false)
      return
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    localAudioRef.current = stream
    for (const pc of peersRef.current.values()) {
      stream.getAudioTracks().forEach((track) => pc.addTrack(track, stream))
    }
    setMicOn(true)
    await renegotiate()
  }

  const toggleCamera = async () => {
    if (cameraOn) {
      localCameraRef.current?.getTracks().forEach((track) => track.stop())
      localCameraRef.current = null
      cameraOnRef.current.delete(selfId)
      setCameraOn(false)
      publish('camera', { type: 'CAMERA_STOP' })
      refreshTiles()
      return
    }
    const stream = await navigator.mediaDevices.getUserMedia({ video: true })
    localCameraRef.current = stream
    for (const pc of peersRef.current.values()) {
      stream.getVideoTracks().forEach((track) => pc.addTrack(track, stream))
    }
    cameraOnRef.current.add(selfId)
    setCameraOn(true)
    publish('camera', { type: 'CAMERA_START' })
    refreshTiles()
    await renegotiate()
  }

  const toggleScreen = async () => {
    if (screenOn) {
      localScreenRef.current?.getTracks().forEach((track) => track.stop())
      localScreenRef.current = null
      setLocalScreen(null)
      setScreenOn(false)
      publish('screen', { type: 'SCREEN_STOP' })
      return
    }
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
    localScreenRef.current = stream
    setLocalScreen(stream)
    stream.getVideoTracks()[0]?.addEventListener('ended', () => {
      setScreenOn(false)
      publish('screen', { type: 'SCREEN_STOP' })
    })
    for (const pc of peersRef.current.values()) {
      stream.getVideoTracks().forEach((track) => pc.addTrack(track, stream))
    }
    setScreenOn(true)
    setScreenBusyName(null)
    publish('screen', { type: 'SCREEN_START' })
    await renegotiate()
  }

  const publishBoard = (snapshot: string) => {
    publish('board', { type: 'BOARD_SNAPSHOT', snapshot })
  }

  return {
    tiles,
    micOn,
    cameraOn,
    screenOn,
    remoteScreen,
    localScreen,
    screenBusyName,
    toggleMic,
    toggleCamera,
    toggleScreen,
    publishBoard,
  }
}
