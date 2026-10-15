<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getIceServers, type IceServer } from '../api/room'
import type { ScreenQuality, ScreenShareState } from './ScreenSharePanel.vue'
import { lang, t } from '../i18n'
import { MatomoTracker } from '../lib/analytics'
import { randomIdentity, takePrefetch } from '../composables/useVoicePrefetch'
import './VoicePanel.css'

const props = defineProps<{
  roomId: string
  identity?: string
  /** STOMP 已连接且房间 ACTIVE 后才为 true，避免 VOICE_JOIN 被丢弃 */
  ready?: boolean
  sendSignal: (payload: Record<string, unknown>) => void
  /** 摄像头座位信令（/app/camera），与语音媒体协商分离 */
  sendCameraSignal: (payload: Record<string, unknown>) => void
  screen?: ScreenShareState
  screenFrozen?: boolean
  boardOpen?: boolean
  screenOpen?: boolean
  isAdmin?: boolean
}>()

export type CameraTile = {
  peerId: string
  name: string
  isLocal: boolean
  stream: MediaStream | null
}

const emit = defineEmits<{
  'update:identity': [name: string]
  'camera-tiles': [tiles: CameraTile[]]
  'screen-quality': [quality: ScreenQuality]
  'toggle-board': []
  'toggle-screen': []
  hangup: []
  'exit-tab': []
}>()

const cardTab = ref<'voice' | 'screen'>('voice')
const SCREEN_QUALITIES: ScreenQuality[] = ['1080p', '720p', '360p']

function qualityLabel(q: ScreenQuality) {
  return t(`room.screenQuality${q.slice(0, -1)}`)
}

type Phase = 'idle' | 'connecting' | 'live' | 'error'

type VoiceSignal = {
  type: string
  from?: string
  to?: string
  name?: string
  joinedAt?: number
  sdp?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit | null
  maxCameras?: number
  names?: string[]
  cameras?: { peerId: string; name: string }[]
}

type PeerState = {
  id: string
  name: string
  pc: RTCPeerConnection
  speaking: boolean
  audioEl?: HTMLAudioElement
  analyser?: AnalyserNode
  raf?: number
  videoStream?: MediaStream
}

const expanded = ref(false)
const phase = ref<Phase>('idle')
const nickname = ref(props.identity || randomIdentity())

watch(
  () => props.identity,
  (next) => {
    if (next && next !== nickname.value) nickname.value = next
  },
)

watch(nickname, (next) => {
  emit('update:identity', next)
})
const muted = ref(false)
const micLevel = ref(0)
const errorText = ref('')
const participants = ref<{ id: string; name: string; speaking: boolean; isLocal: boolean }[]>([])
const cameraOn = ref(false)
const cameraStarting = ref(false)
const cameraError = ref('')
const pendingCamera = ref(false)
/** 悬浮窗用：本地 + 远端开摄像头的 tile */
const cameraTiles = ref<CameraTile[]>([])

/** 每条对端上行目标码率：约 20kbps，语音可懂，8 人 mesh 约 140kbps 总上行 */
const VOICE_MAX_BITRATE = 20_000
/** 摄像头：低清低帧，mesh 多路上行可控 */
const CAMERA_MAX_BITRATE = 250_000
const CAMERA_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 480, max: 640 },
  height: { ideal: 270, max: 360 },
  frameRate: { ideal: 15, max: 20 },
  facingMode: 'user',
}

const VOICE_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  channelCount: { ideal: 1 },
  sampleRate: { ideal: 16000 },
  sampleSize: { ideal: 16 },
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
}

let peerId = ''
let joinedAt = 0
let localStream: MediaStream | null = null
let localVideoStream: MediaStream | null = null
let localVideoTrack: MediaStreamTrack | null = null
let iceServers: IceServer[] = []
let localAnalyser: AnalyserNode | null = null
let localAudioCtx: AudioContext | null = null
let localSpeakingRaf = 0
let localSpeaking = false
const peers = new Map<string, PeerState>()
/** peerId → 已声明开摄像头（含尚无流的占位） */
const cameraPublishers = new Map<string, string>()

type SeatWaiter = {
  resolve: () => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}
let cameraSeatWait: SeatWaiter | null = null

const liveCount = computed(() => participants.value.length)
const speakingCount = computed(() => participants.value.filter((p) => p.speaking).length)
const micOn = computed(() => phase.value === 'live' && !muted.value)
const micFail = computed(() => phase.value !== 'live' && (phase.value === 'error' || !!errorText.value))
const camFail = computed(() => !!cameraError.value && !cameraOn.value)

function refreshParticipants() {
  const list = [
    {
      id: peerId || 'local',
      name: nickname.value,
      speaking: localSpeaking && !muted.value,
      isLocal: true,
    },
  ]
  for (const p of peers.values()) {
    list.push({
      id: p.id,
      name: p.name,
      speaking: p.speaking,
      isLocal: false,
    })
  }
  participants.value = list
}

function toRtcIceServers(servers: IceServer[]): RTCIceServer[] {
  return servers.map((s) => {
    const entry: RTCIceServer = { urls: s.urls }
    if (s.username) entry.username = s.username
    if (s.credential) entry.credential = s.credential
    return entry
  })
}

function signal(payload: Record<string, unknown>) {
  props.sendSignal(payload)
}

function cameraSignal(payload: Record<string, unknown>) {
  props.sendCameraSignal(payload)
}

function refreshCameraTiles() {
  const tiles: CameraTile[] = []
  if (cameraOn.value && peerId) {
    tiles.push({
      peerId,
      name: nickname.value,
      isLocal: true,
      stream: localVideoStream,
    })
  }
  for (const [id, name] of cameraPublishers) {
    if (id === peerId) continue
    const peer = peers.get(id)
    tiles.push({
      peerId: id,
      name: peer?.name || name,
      isLocal: false,
      stream: peer?.videoStream ?? null,
    })
  }
  cameraTiles.value = tiles
  emit('camera-tiles', tiles)
}

function upsertCameraPublisher(id: string, name: string) {
  if (!id) return
  cameraPublishers.set(id, name || id)
  refreshCameraTiles()
}

function removeCameraPublisher(id: string) {
  if (!id) return
  cameraPublishers.delete(id)
  const peer = peers.get(id)
  if (peer) peer.videoStream = undefined
  refreshCameraTiles()
}

function rejectCameraSeat(err: Error) {
  if (!cameraSeatWait) return
  clearTimeout(cameraSeatWait.timer)
  cameraSeatWait.reject(err)
  cameraSeatWait = null
}

function resolveCameraSeat() {
  if (!cameraSeatWait) return
  clearTimeout(cameraSeatWait.timer)
  cameraSeatWait.resolve()
  cameraSeatWait = null
}

function waitForCameraSeat(timeoutMs = 2500): Promise<void> {
  return new Promise((resolve, reject) => {
    if (cameraSeatWait) {
      rejectCameraSeat(new Error('camera seat pending'))
    }
    const timer = setTimeout(() => {
      if (cameraSeatWait) {
        cameraSeatWait = null
        reject(new Error(t('voice.cameraFail')))
      }
    }, timeoutMs)
    cameraSeatWait = { resolve, reject, timer }
  })
}

async function applyVideoEncoding(pc: RTCPeerConnection) {
  for (const sender of pc.getSenders()) {
    if (sender.track?.kind !== 'video') continue
    try {
      sender.track.contentHint = 'motion'
    } catch {
      /* ignore */
    }
    try {
      const params = sender.getParameters()
      if (!params.encodings?.length) params.encodings = [{}]
      params.encodings[0].maxBitrate = CAMERA_MAX_BITRATE
      params.encodings[0].maxFramerate = 15
      params.encodings[0].priority = 'low'
      params.encodings[0].networkPriority = 'low'
      await sender.setParameters(params)
    } catch (e) {
      console.warn('[P2P] video setParameters failed', e)
    }
  }
}

function findVideoTransceiver(pc: RTCPeerConnection) {
  return pc.getTransceivers().find((t) => {
    const sk = t.sender.track?.kind
    const rk = t.receiver.track?.kind
    return sk === 'video' || rk === 'video'
  })
}

async function attachLocalVideoToPeer(pc: RTCPeerConnection) {
  if (!localVideoTrack || !localVideoStream) {
    if (!findVideoTransceiver(pc)) {
      pc.addTransceiver('video', { direction: 'recvonly' })
    }
    return
  }
  try {
    localVideoTrack.contentHint = 'motion'
  } catch {
    /* ignore */
  }
  const vt = findVideoTransceiver(pc)
  if (vt) {
    try {
      await vt.sender.replaceTrack(localVideoTrack)
      vt.direction = 'sendrecv'
    } catch {
      pc.addTrack(localVideoTrack, localVideoStream)
    }
    return
  }
  try {
    pc.addTransceiver(localVideoTrack, {
      direction: 'sendrecv',
      streams: [localVideoStream],
      sendEncodings: [
        { maxBitrate: CAMERA_MAX_BITRATE, maxFramerate: 15, priority: 'low', networkPriority: 'low' },
      ],
    })
  } catch {
    pc.addTrack(localVideoTrack, localVideoStream)
  }
}

async function detachLocalVideoFromPeer(pc: RTCPeerConnection) {
  const vt = findVideoTransceiver(pc)
  if (vt?.sender.track) {
    try {
      await vt.sender.replaceTrack(null)
      vt.direction = 'recvonly'
      return
    } catch {
      /* fall through */
    }
  }
  for (const s of pc.getSenders()) {
    if (s.track?.kind === 'video') {
      try {
        pc.removeTrack(s)
      } catch {
        await s.replaceTrack(null)
      }
    }
  }
}

async function renegotiateOffers() {
  for (const peer of peers.values()) {
    try {
      if (localVideoTrack && localVideoStream) {
        await attachLocalVideoToPeer(peer.pc)
      } else {
        await detachLocalVideoFromPeer(peer.pc)
      }
      if (peer.pc.signalingState !== 'stable') continue
      preferOpusCodec(peer.pc)
      const offer = await peer.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      })
      await setLocalDescOptimized(peer.pc, offer)
      await applyVideoEncoding(peer.pc)
      signal({
        type: 'VOICE_OFFER',
        from: peerId,
        to: peer.id,
        name: nickname.value,
        sdp: descPayload(peer.pc.localDescription) ?? offer,
      })
    } catch (e) {
      console.warn('[P2P] camera renegotiate failed', peer.id, e)
    }
  }
}

/** Opus：单声道 + DTX + FEC + 封顶码率，压低 mesh 上行 */
function optimizeAudioSdp(sdp: string): string {
  const opusPts: string[] = []
  for (const line of sdp.split(/\r?\n/)) {
    const m = line.match(/^a=rtpmap:(\d+)\s+opus\/\d+/i)
    if (m) opusPts.push(m[1])
  }
  if (!opusPts.length) return sdp

  let out = sdp
  for (const pt of opusPts) {
    const fmtpRe = new RegExp(`a=fmtp:${pt} ([^\\r\\n]*)`)
    const extras =
      `maxaveragebitrate=${VOICE_MAX_BITRATE};maxplaybackrate=16000;` +
      `stereo=0;sprop-stereo=0;useinbandfec=1;usedtx=1;minptime=20`
    if (fmtpRe.test(out)) {
      out = out.replace(fmtpRe, (_full, params: string) => {
        let p = String(params)
          .replace(/maxaveragebitrate=\d+/gi, '')
          .replace(/maxplaybackrate=\d+/gi, '')
          .replace(/stereo=\d/gi, '')
          .replace(/sprop-stereo=\d/gi, '')
          .replace(/useinbandfec=\d/gi, '')
          .replace(/usedtx=\d/gi, '')
          .replace(/minptime=\d+/gi, '')
          .replace(/;{2,}/g, ';')
          .replace(/^;|;$/g, '')
        p = p ? `${p};${extras}` : extras
        return `a=fmtp:${pt} ${p}`
      })
    } else {
      out = out.replace(
        new RegExp(`(a=rtpmap:${pt}\\s+opus\\/\\d+[^\\r\\n]*)`, 'i'),
        `$1\r\na=fmtp:${pt} ${extras}`,
      )
    }
  }
  // 40ms 打包，降低发包频率（静音时 DTX 再进一步省带宽）
  if (/a=ptime:/i.test(out)) {
    out = out.replace(/a=ptime:\d+/gi, 'a=ptime:40')
  } else {
    out = out.replace(/(m=audio[^\r\n]*\r?\n)/i, '$1a=ptime:40\r\n')
  }
  return out
}

function preferOpusCodec(pc: RTCPeerConnection) {
  try {
    const caps = RTCRtpReceiver.getCapabilities?.('audio')
    if (!caps?.codecs?.length) return
    const opus = caps.codecs.filter((c) => /opus/i.test(c.mimeType))
    if (!opus.length) return
    const others = caps.codecs.filter(
      (c) => !/opus/i.test(c.mimeType) && !/telephone-event|cn/i.test(c.mimeType),
    )
    for (const t of pc.getTransceivers()) {
      const kind = t.sender.track?.kind || t.receiver.track?.kind
      if (kind && kind !== 'audio') continue
      try {
        t.setCodecPreferences?.([...opus, ...others])
      } catch {
        /* ignore unsupported */
      }
    }
  } catch {
    /* ignore */
  }
}

async function applyLowUplinkEncoding(pc: RTCPeerConnection) {
  for (const sender of pc.getSenders()) {
    if (sender.track?.kind !== 'audio') continue
    try {
      sender.track.contentHint = 'speech'
    } catch {
      /* ignore */
    }
    try {
      const params = sender.getParameters()
      if (!params.encodings?.length) params.encodings = [{}]
      params.encodings[0].maxBitrate = VOICE_MAX_BITRATE
      params.encodings[0].priority = 'high'
      params.encodings[0].networkPriority = 'low'
      await sender.setParameters(params)
    } catch (e) {
      console.warn('[P2P] setParameters bitrate failed', e)
    }
  }
}

async function setLocalDescOptimized(pc: RTCPeerConnection, desc: RTCSessionDescriptionInit) {
  const next = { ...desc }
  if (next.sdp) next.sdp = optimizeAudioSdp(next.sdp)
  await pc.setLocalDescription(next)
  await applyLowUplinkEncoding(pc)
}

function attachSpeakingMeter(stream: MediaStream, onLevel: (speaking: boolean, level: number) => void) {
  const ctx = new AudioContext()
  const source = ctx.createMediaStreamSource(stream)
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 512
  source.connect(analyser)
  const data = new Uint8Array(analyser.frequencyBinCount)
  let raf = 0
  const tick = () => {
    analyser.getByteFrequencyData(data)
    let sum = 0
    for (let i = 0; i < data.length; i++) sum += data[i]
    const avg = sum / data.length
    onLevel(avg > 18, Math.min(1, Math.max(0, (avg - 4) / 52)))
    raf = requestAnimationFrame(tick)
  }
  tick()
  return {
    analyser,
    ctx,
    stop: () => {
      cancelAnimationFrame(raf)
      try {
        source.disconnect()
        analyser.disconnect()
        void ctx.close()
      } catch {
        /* ignore */
      }
    },
  }
}

let stopLocalMeterFn: (() => void) | null = null

function startLocalMeter() {
  stopLocalMeter()
  if (!localStream) return
  const meter = attachSpeakingMeter(localStream, (speaking, level) => {
    micLevel.value = muted.value ? 0 : level
    if (localSpeaking !== speaking) {
      localSpeaking = speaking
      refreshParticipants()
    }
  })
  localAnalyser = meter.analyser
  localAudioCtx = meter.ctx
  localSpeakingRaf = 1
  stopLocalMeterFn = meter.stop
}

function stopLocalMeter() {
  stopLocalMeterFn?.()
  stopLocalMeterFn = null
  localAnalyser = null
  localAudioCtx = null
  localSpeakingRaf = 0
  localSpeaking = false
  micLevel.value = 0
}

function descPayload(desc: RTCSessionDescription | RTCSessionDescriptionInit | null | undefined) {
  if (!desc) return undefined
  return { type: desc.type, sdp: desc.sdp }
}

function startPeerMeter(peer: PeerState, stream: MediaStream) {
  if (peer.raf) cancelAnimationFrame(peer.raf)
  const ctx = new AudioContext()
  const source = ctx.createMediaStreamSource(stream)
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 512
  source.connect(analyser)
  peer.analyser = analyser
  const data = new Uint8Array(analyser.frequencyBinCount)
  const tick = () => {
    analyser.getByteFrequencyData(data)
    let sum = 0
    for (let i = 0; i < data.length; i++) sum += data[i]
    const speaking = sum / data.length > 18
    if (peer.speaking !== speaking) {
      peer.speaking = speaking
      refreshParticipants()
    }
    peer.raf = requestAnimationFrame(tick)
  }
  tick()
  ;(peer as { _audioCtx?: AudioContext; _source?: MediaStreamAudioSourceNode })._audioCtx = ctx
  ;(peer as { _source?: MediaStreamAudioSourceNode })._source = source
}

function stopPeerMeter(peer: PeerState) {
  if (peer.raf) cancelAnimationFrame(peer.raf)
  peer.raf = undefined
  const ext = peer as { _audioCtx?: AudioContext; _source?: MediaStreamAudioSourceNode }
  try {
    ext._source?.disconnect()
    peer.analyser?.disconnect()
    void ext._audioCtx?.close()
  } catch {
    /* ignore */
  }
}

async function createPeerConnection(remoteId: string, remoteName: string): Promise<PeerState> {
  const pc = new RTCPeerConnection({
    iceServers: toRtcIceServers(iceServers),
    iceTransportPolicy: 'all',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
  })

  if (localStream) {
    for (const track of localStream.getAudioTracks()) {
      try {
        track.contentHint = 'speech'
      } catch {
        /* ignore */
      }
      // sendEncodings 在支持的浏览器里可直接限制上行
      try {
        pc.addTransceiver(track, {
          direction: 'sendrecv',
          streams: [localStream],
          sendEncodings: [{ maxBitrate: VOICE_MAX_BITRATE, priority: 'high', networkPriority: 'low' }],
        })
      } catch {
        pc.addTrack(track, localStream)
      }
    }
  } else {
    pc.addTransceiver('audio', { direction: 'recvonly' })
  }

  await attachLocalVideoToPeer(pc)
  preferOpusCodec(pc)

  const peer: PeerState = {
    id: remoteId,
    name: remoteName || remoteId,
    pc,
    speaking: false,
  }

  pc.onicecandidate = (ev) => {
    signal({
      type: 'VOICE_ICE',
      from: peerId,
      to: remoteId,
      candidate: ev.candidate ? ev.candidate.toJSON() : null,
    })
  }

  pc.ontrack = (ev) => {
    const stream = ev.streams[0] || new MediaStream([ev.track])
    if (ev.track.kind === 'video') {
      peer.videoStream = stream
      upsertCameraPublisher(remoteId, peer.name)
      ev.track.addEventListener('ended', () => {
        if (peer.videoStream === stream) peer.videoStream = undefined
        refreshCameraTiles()
      })
      refreshCameraTiles()
      return
    }
    let audio = peer.audioEl
    if (!audio) {
      audio = new Audio()
      audio.autoplay = true
      audio.setAttribute('playsinline', 'true')
      peer.audioEl = audio
    }
    audio.srcObject = stream
    void audio.play().catch(() => {
      /* autoplay may need user gesture; join already has one */
    })
    startPeerMeter(peer, stream)
  }

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'connected') {
      void applyLowUplinkEncoding(pc)
      void applyVideoEncoding(pc)
    }
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
      console.warn('[P2P] peer connection', pc.connectionState, remoteId)
    }
  }

  peers.set(remoteId, peer)
  refreshParticipants()
  return peer
}

async function ensurePeer(remoteId: string, remoteName?: string): Promise<PeerState> {
  const existing = peers.get(remoteId)
  if (existing) {
    if (remoteName) existing.name = remoteName
    return existing
  }
  return await createPeerConnection(remoteId, remoteName || remoteId)
}

async function createOfferTo(remoteId: string, remoteName?: string) {
  const peer = await ensurePeer(remoteId, remoteName)
  preferOpusCodec(peer.pc)
  const offer = await peer.pc.createOffer({
    offerToReceiveAudio: true,
    offerToReceiveVideo: true,
  })
  await setLocalDescOptimized(peer.pc, offer)
  await applyVideoEncoding(peer.pc)
  signal({
    type: 'VOICE_OFFER',
    from: peerId,
    to: remoteId,
    name: nickname.value,
    sdp: descPayload(peer.pc.localDescription) ?? offer,
  })
}

async function handleOffer(msg: VoiceSignal) {
  if (!msg.from || !msg.sdp || msg.to !== peerId) return
  const peer = await ensurePeer(msg.from, msg.name)
  preferOpusCodec(peer.pc)
  await peer.pc.setRemoteDescription(msg.sdp)
  const answer = await peer.pc.createAnswer()
  await setLocalDescOptimized(peer.pc, answer)
  await applyVideoEncoding(peer.pc)
  signal({
    type: 'VOICE_ANSWER',
    from: peerId,
    to: msg.from,
    name: nickname.value,
    sdp: descPayload(peer.pc.localDescription) ?? answer,
  })
}

async function handleAnswer(msg: VoiceSignal) {
  if (!msg.from || !msg.sdp || msg.to !== peerId) return
  const peer = peers.get(msg.from)
  if (!peer) return
  if (peer.pc.signalingState === 'have-local-offer') {
    await peer.pc.setRemoteDescription(msg.sdp)
  }
}

async function handleIce(msg: VoiceSignal) {
  if (!msg.from || msg.to !== peerId) return
  const peer = peers.get(msg.from)
  if (!peer || !msg.candidate) return
  try {
    await peer.pc.addIceCandidate(msg.candidate)
  } catch (e) {
    console.warn('[P2P] addIceCandidate failed', e)
  }
}

function closePeer(remoteId: string) {
  const peer = peers.get(remoteId)
  if (!peer) return
  stopPeerMeter(peer)
  try {
    peer.pc.close()
  } catch {
    /* ignore */
  }
  if (peer.audioEl) {
    peer.audioEl.srcObject = null
    peer.audioEl = undefined
  }
  peers.delete(remoteId)
  removeCameraPublisher(remoteId)
  refreshParticipants()
}

function closeAllPeers() {
  for (const id of [...peers.keys()]) closePeer(id)
}

function shouldOfferTo(remoteId: string, remoteJoinedAt?: number) {
  const theirs = remoteJoinedAt ?? Number.MAX_SAFE_INTEGER
  // 先加入的一方发起 offer；同时加入时用 peerId 打破平局，避免 glare
  if (joinedAt < theirs) return true
  if (joinedAt > theirs) return false
  return peerId < remoteId
}

async function handleJoin(msg: VoiceSignal) {
  if (!msg.from || msg.from === peerId) return
  if (shouldOfferTo(msg.from, msg.joinedAt)) {
    await createOfferTo(msg.from, msg.name)
  } else {
    await ensurePeer(msg.from, msg.name)
  }
}

function handleLeave(msg: VoiceSignal) {
  if (!msg.from || msg.from === peerId) return
  closePeer(msg.from)
}

function handleCameraBusy(body: VoiceSignal) {
  const names = (body.names || []).filter(Boolean).join(', ')
  const max = body.maxCameras ?? 4
  const err = new Error(
    t('voice.cameraBusy', { max, names: names ? ` (${names})` : '' }),
  )
  cameraError.value = err.message
  rejectCameraSeat(err)
}

function handleCameraStartMsg(body: VoiceSignal) {
  if (!body.from) return
  upsertCameraPublisher(body.from, body.name || body.from)
  if (body.from === peerId) {
    resolveCameraSeat()
  }
}

function handleCameraStopMsg(body: VoiceSignal) {
  if (!body.from) return
  if (body.from === peerId) {
    // 远端强制停（如断线广播自己的 stop）时本地也应清理
    if (cameraOn.value) {
      void stopCameraTracksOnly()
    }
  }
  removeCameraPublisher(body.from)
}

function applyInitialCameras(list: { peerId: string; name: string }[] | undefined) {
  if (!list?.length) return
  for (const c of list) {
    if (c?.peerId) upsertCameraPublisher(c.peerId, c.name || c.peerId)
  }
}

async function handleSignal(body: VoiceSignal) {
  if (!body?.type) return

  if (body.type.startsWith('CAMERA_')) {
    try {
      switch (body.type) {
        case 'CAMERA_BUSY':
          handleCameraBusy(body)
          break
        case 'CAMERA_START':
          handleCameraStartMsg(body)
          break
        case 'CAMERA_STOP':
          handleCameraStopMsg(body)
          break
        case 'CAMERA_STATE':
          applyInitialCameras(body.cameras)
          break
        default:
          break
      }
    } catch (e) {
      console.error('[P2P] camera signal error', body.type, e)
    }
    return
  }

  if (phase.value !== 'live' && phase.value !== 'connecting') return
  if (!body.type.startsWith('VOICE_')) return
  try {
    switch (body.type) {
      case 'VOICE_JOIN':
        await handleJoin(body)
        break
      case 'VOICE_LEAVE':
        handleLeave(body)
        break
      case 'VOICE_OFFER':
        await handleOffer(body)
        break
      case 'VOICE_ANSWER':
        await handleAnswer(body)
        break
      case 'VOICE_ICE':
        await handleIce(body)
        break
      default:
        break
    }
  } catch (e) {
    console.error('[P2P] signal error', body.type, e)
  }
}

async function stopCameraTracksOnly() {
  cameraOn.value = false
  if (localVideoTrack) {
    try {
      localVideoTrack.stop()
    } catch {
      /* ignore */
    }
    localVideoTrack = null
  }
  if (localVideoStream) {
    for (const t of localVideoStream.getTracks()) t.stop()
    localVideoStream = null
  }
  if (peerId) cameraPublishers.delete(peerId)
  refreshCameraTiles()
}

async function startCamera() {
  if (phase.value !== 'live' || cameraOn.value || cameraStarting.value || !peerId) return
  cameraStarting.value = true
  cameraError.value = ''
  try {
    const seatPromise = waitForCameraSeat()
    cameraSignal({ type: 'CAMERA_START', from: peerId, name: nickname.value })
    await seatPromise

    localVideoStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: CAMERA_CONSTRAINTS,
    })
    localVideoTrack = localVideoStream.getVideoTracks()[0] || null
    if (!localVideoTrack) {
      throw new Error('no video track')
    }
    try {
      localVideoTrack.contentHint = 'motion'
      await localVideoTrack.applyConstraints(CAMERA_CONSTRAINTS)
    } catch {
      /* ignore */
    }
    localVideoTrack.addEventListener('ended', () => {
      void stopCamera(true)
    })
    cameraOn.value = true
    upsertCameraPublisher(peerId, nickname.value)
    await renegotiateOffers()
    MatomoTracker.trackEvent('Camera', 'Start')
  } catch (e) {
    console.error('[Camera] start failed', e)
    const msg = e instanceof Error ? e.message : ''
    MatomoTracker.trackEvent('Camera', 'StartFail', msg || 'unknown')
    if (!cameraError.value) {
      cameraError.value =
        msg.includes('cameraBusy') ||
        /\bfull\b/i.test(msg) ||
        /\bbusy\b/i.test(msg)
        ? msg
        : t('voice.cameraFail')
    }
    cameraSignal({ type: 'CAMERA_STOP', from: peerId, name: nickname.value })
    await stopCameraTracksOnly()
    await renegotiateOffers()
  } finally {
    cameraStarting.value = false
  }
}

async function stopCamera(sendSignalStop = true) {
  if (!cameraOn.value && !localVideoTrack) return
  await stopCameraTracksOnly()
  if (sendSignalStop && peerId) {
    cameraSignal({ type: 'CAMERA_STOP', from: peerId, name: nickname.value })
  }
  await renegotiateOffers()
}

async function toggleCamera() {
  if (cameraOn.value) {
    await stopCamera(true)
    MatomoTracker.trackEvent('Camera', 'Stop')
  } else await startCamera()
}

function isMicPermissionError(e: unknown): boolean {
  const name = e instanceof DOMException ? e.name : e instanceof Error ? e.name : ''
  return name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError'
}

function micErrorText(e: unknown): string {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return t('voice.micUnsupported')
  }
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return t('voice.micUnsupported')
  }
  const name = e instanceof DOMException ? e.name : e instanceof Error ? e.name : ''
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return t('voice.micNotFound')
  if (isMicPermissionError(e)) return t('voice.micDenied')
  return t('voice.connectFail')
}

/** 先用语音优化约束，失败再回退到 audio:true（避免部分环境无提示直接 Overconstrained） */
async function acquireLocalAudio(): Promise<MediaStream> {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    throw new DOMException('Insecure context', 'SecurityError')
  }
  const media = navigator.mediaDevices
  if (!media?.getUserMedia) {
    throw new DOMException('mediaDevices unavailable', 'NotSupportedError')
  }
  try {
    return await media.getUserMedia({ audio: VOICE_AUDIO_CONSTRAINTS, video: false })
  } catch (e) {
    if (isMicPermissionError(e)) throw e
    console.warn('[语音] 约束取麦失败，回退 audio:true', e)
    return await media.getUserMedia({ audio: true, video: false })
  }
}

async function join(prefetchedIce?: IceServer[], opts?: { fromAuto?: boolean }) {
  const name = (props.identity || nickname.value).trim() || randomIdentity()
  if (!props.identity) nickname.value = name
  peerId = `${name}-${Math.random().toString(36).slice(2, 8)}`
  phase.value = 'connecting'
  try {
    if (prefetchedIce?.length) {
      iceServers = prefetchedIce
    } else {
      const cfg = await getIceServers(props.roomId, peerId)
      iceServers = cfg.iceServers || []
    }
    localStream = await acquireLocalAudio()
    for (const track of localStream.getAudioTracks()) {
      try {
        track.contentHint = 'speech'
      } catch {
        /* ignore */
      }
      // 再收紧一次实际约束（部分浏览器 ideal 不够）
      try {
        await track.applyConstraints({
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        })
      } catch {
        /* sampleRate 可能被忽略，码率仍由 Opus 限制 */
      }
    }
    muted.value = false
    startLocalMeter()
    joinedAt = Date.now()
    errorText.value = ''
    phase.value = 'live'
    refreshParticipants()
    signal({ type: 'VOICE_JOIN', from: peerId, name, joinedAt })
    MatomoTracker.trackEvent('Voice', 'Join', opts?.fromAuto ? 'auto' : 'manual')
    if (pendingCamera.value) {
      pendingCamera.value = false
      void startCamera()
    }
  } catch (e) {
    console.error('[语音] join 失败', e)
    // 自动加入时权限/安全错误：不锁死 error，回到可点击「加入语音」（需用户手势才能弹权限框）
    if (opts?.fromAuto && isMicPermissionError(e)) {
      errorText.value = micErrorText(e)
      MatomoTracker.trackEvent('Voice', 'JoinFail', 'auto_denied')
      phase.value = 'idle'
      peerId = ''
      if (localStream) {
        for (const t of localStream.getTracks()) t.stop()
        localStream = null
      }
      return
    }
    errorText.value = micErrorText(e)
    MatomoTracker.trackEvent('Voice', 'JoinFail', errorText.value)
    phase.value = 'error'
    await leave(false)
  }
}

async function leave(collapse = true) {
  const wasLive = phase.value === 'live'
  if (cameraOn.value || localVideoTrack) {
    await stopCamera(true)
  }
  if (peerId && phase.value === 'live') {
    signal({ type: 'VOICE_LEAVE', from: peerId, name: nickname.value })
  }
  rejectCameraSeat(new Error('left'))
  closeAllPeers()
  stopLocalMeter()
  if (localStream) {
    for (const t of localStream.getTracks()) t.stop()
    localStream = null
  }
  cameraPublishers.clear()
  cameraTiles.value = []
  if (phase.value !== 'error') cameraError.value = ''
  peerId = ''
  joinedAt = 0
  iceServers = []
  participants.value = []
  phase.value = phase.value === 'error' ? 'error' : 'idle'
  if (collapse) expanded.value = false
  if (wasLive) MatomoTracker.trackEvent('Voice', 'Leave')
}

function toggleMute() {
  if (!localStream) return
  muted.value = !muted.value
  for (const t of localStream.getAudioTracks()) {
    t.enabled = !muted.value
  }
  refreshParticipants()
  MatomoTracker.trackEvent('Voice', muted.value ? 'Mute' : 'Unmute')
}

const moreOpen = ref(false)

async function onMicClick() {
  if (phase.value === 'connecting') return
  if (phase.value !== 'live') {
    await join()
    return
  }
  toggleMute()
}

async function onCamClick() {
  if (cameraStarting.value) return
  if (cameraOn.value) {
    pendingCamera.value = false
    await stopCamera(true)
    MatomoTracker.trackEvent('Camera', 'Stop')
    return
  }
  if (phase.value === 'live') {
    cameraError.value = ''
    await startCamera()
    return
  }
  pendingCamera.value = true
  if (phase.value === 'connecting') return
  await join()
  const afterJoin = phase.value as Phase
  if (afterJoin === 'live') {
    pendingCamera.value = false
    await startCamera()
    return
  }
  pendingCamera.value = false
  cameraError.value = errorText.value || t('voice.cameraFail')
}

function onScreenClick() {
  emit('toggle-screen')
}

function reroll() {
  nickname.value = randomIdentity()
}

let pendingPrefetch: ReturnType<typeof takePrefetch> = null
let autoJoined = false

async function tryAutoJoin() {
  if (autoJoined || !props.ready || !pendingPrefetch) return
  autoJoined = true
  const pref = pendingPrefetch
  pendingPrefetch = null
  if (!props.identity) nickname.value = pref.identity
  try {
    const cfg = await pref.ice
    await join(cfg.iceServers || [], { fromAuto: true })
    // 自动取麦被拒时保持可手动加入
    if (phase.value !== 'live') autoJoined = false
  } catch {
    autoJoined = false
  }
}

onMounted(() => {
  pendingPrefetch = takePrefetch(props.roomId)
  void tryAutoJoin()
})

watch(
  () => props.ready,
  (ok) => {
    if (ok) void tryAutoJoin()
  },
)

onBeforeUnmount(() => {
  void leave(false)
})

defineExpose({
  handleSignal,
  leave,
  join,
  toggleMute,
  toggleCamera,
  startCamera,
  stopCamera,
  applyInitialCameras,
  cameraOn,
  cameraTiles,
  cameraError,
  muted,
  phase,
})
</script>

<template>
  <div class="voice-panel meet-voice" :data-lang="lang">
    <div v-if="moreOpen" class="meet-sheet meet-invite-pop">
      <slot name="invite" />
    </div>

    <div class="meet-dock" role="toolbar" :aria-label="t('voice.title')">
      <div class="meet-mic">
        <div v-if="micOn" class="meet-level" aria-hidden="true">
          <i :style="{ width: `${Math.round(micLevel * 100)}%` }" />
        </div>
        <button
          class="meet-btn"
          :class="{ 'is-on': micOn, 'is-fail': micFail, 'is-wait': phase === 'connecting' }"
          type="button"
          :title="phase === 'live' ? (muted ? t('voice.unmute') : t('voice.mute')) : t('voice.joinVoice')"
          :disabled="phase === 'connecting'"
          @click="onMicClick"
        >
        <svg v-if="!micFail && (phase !== 'live' || !muted)" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11h-2Z" />
        </svg>
        <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M9 9v2a3 3 0 0 0 5.1 2.1M15 9.5V6a3 3 0 0 0-5.8-1" stroke-linecap="round" />
          <path d="M5 11a7 7 0 0 0 11.2 5.6M12 18v3M4 4l16 16" stroke-linecap="round" />
        </svg>
        </button>
      </div>

      <button
        class="meet-btn"
        :class="{ 'is-on': cameraOn, 'is-fail': camFail, 'is-wait': cameraStarting || pendingCamera }"
        type="button"
        :title="cameraOn ? t('voice.cameraOff') : t('voice.cameraOn')"
        @click="onCamClick"
      >
        <svg v-if="cameraOn" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17 10.5V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3.5l4 3.5V7l-4 3.5Z" />
        </svg>
        <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M17 10.5V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3.5l4 3.5V7l-4 3.5Z" stroke-linejoin="round" />
          <path d="M2 2l20 20" stroke-linecap="round" />
        </svg>
      </button>

      <div class="meet-screen">
        <div class="meet-quality-pop" role="group" :aria-label="t('room.screenQuality')">
          <button
            v-for="q in SCREEN_QUALITIES"
            :key="q"
            type="button"
            :class="{ 'is-on': screen?.quality === q }"
            :disabled="screenFrozen || screen?.starting"
            @click="emit('screen-quality', q)"
          >
            {{ qualityLabel(q) }}
          </button>
        </div>
        <button
          class="meet-btn"
          :class="{ 'is-on': screenOpen }"
          type="button"
          :title="screenOpen ? t('voice.screenHide') : t('voice.screenShow')"
          @click="onScreenClick"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="3" y="4" width="18" height="12" rx="2" />
            <path d="M8 20h8M12 16v4" stroke-linecap="round" />
          </svg>
        </button>
      </div>

      <button
        class="meet-btn"
        :class="{ 'is-on': boardOpen }"
        type="button"
        :title="boardOpen ? t('voice.boardHide') : t('voice.boardShow')"
        @click="emit('toggle-board')"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <rect x="3" y="4" width="18" height="14" rx="2" />
          <path d="M3 9h18M8 4v14" stroke-linecap="round" />
        </svg>
      </button>

      <button
        class="meet-btn"
        :class="{ 'is-on': moreOpen }"
        type="button"
        :title="t('room.shareRoom')"
        :aria-expanded="moreOpen"
        @click="moreOpen = !moreOpen"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>

      <button
        class="meet-btn meet-btn--lab is-leave"
        type="button"
        :title="t('room.exitTab')"
        :aria-label="t('room.exitTab')"
        @click="emit('exit-tab')"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <path d="M10 7V5.2A1.2 1.2 0 0 1 11.2 4h7.6A1.2 1.2 0 0 1 20 5.2v13.6a1.2 1.2 0 0 1-1.2 1.2h-7.6A1.2 1.2 0 0 1 10 18.8V17" stroke-linecap="round" />
          <path d="M15 12H4m0 0 3.2-3.2M4 12l3.2 3.2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span class="meet-btn__txt">{{ t('room.exitTab') }}</span>
      </button>

      <button
        class="meet-btn meet-btn--lab is-hang"
        type="button"
        :title="isAdmin ? t('room.closeRoom') : t('room.leaveRoom')"
        :aria-label="isAdmin ? t('room.closeRoom') : t('room.leaveRoom')"
        @click="emit('hangup')"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6.6 10.8c3.7 3.7 7 5.4 10.8 6.6l2.2-2.2c.3-.3.7-.4 1.1-.2 1.2.4 2.5.6 3.8.6.6 0 1 .4 1 1V21c0 .6-.4 1-1 1C11.4 22 2 12.6 2 1c0-.6.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.3.2 2.6.6 3.8.1.4 0 .8-.2 1.1L6.6 10.8Z" />
        </svg>
        <span class="meet-btn__txt">{{ isAdmin ? t('room.closeRoom') : t('room.leaveRoom') }}</span>
      </button>
    </div>
  </div>
</template>
