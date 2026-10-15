<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { getIceServers, type IceServer } from '../api/room'
import { t } from '../i18n'
import { MatomoTracker } from '../lib/analytics'

const props = defineProps<{
  roomId: string
  peerId: string
  displayName: string
  sendSignal: (payload: Record<string, unknown>) => void
  active: boolean
  frozen?: boolean
  hideChrome?: boolean
}>()

export type ScreenQuality = '1080p' | '720p' | '360p'

export type ScreenShareState = {
  live: boolean
  sharing: boolean
  starting: boolean
  viewing: boolean
  empty: boolean
  sharerName: string
  quality: ScreenQuality
  error: string
  insecure: boolean
  embedded: boolean
  occupied: boolean
}

const emit = defineEmits<{
  live: [value: boolean]
  state: [value: ScreenShareState]
}>()

type ScreenSignal = {
  type: string
  from?: string
  to?: string
  name?: string
  sdp?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit | null
  sharerName?: string
  peerId?: string
}

type PeerConn = {
  pc: RTCPeerConnection
  makingOffer?: boolean
  /** 远端 description 尚未就绪时暂存 ICE，避免第二次分享丢候选 */
  pendingIce: RTCIceCandidateInit[]
}

/** 星型分享：720p/360p 为每路上限；高码率(1080p) 的 maxBitrate 为总上行预算，按观看人数均分 */
const QUALITY_PRESETS: Record<
  ScreenQuality,
  { width: number; height: number; maxBitrate: number; maxFramerate: number; labelKey: string }
> = {
  // 高码率：1080p，总上行 20Mbps，按观看人数均分（1 人观看则该人收满 20M）
  '1080p': { width: 1920, height: 1080, maxBitrate: 20_000_000, maxFramerate: 30, labelKey: 'room.screenQuality1080' },
  '720p': { width: 1280, height: 720, maxBitrate: 1_200_000, maxFramerate: 30, labelKey: 'room.screenQuality720' },
  '360p': { width: 640, height: 360, maxBitrate: 600_000, maxFramerate: 30, labelKey: 'room.screenQuality360' },
}

const QUALITY_ORDER: ScreenQuality[] = ['1080p', '720p', '360p']

const sharerId = ref<string | null>(null)
const sharerName = ref('')
const sharing = ref(false)
const starting = ref(false)
const errorText = ref('')
const quality = ref<ScreenQuality>('720p')
const isSecure = ref(typeof window !== 'undefined' ? window.isSecureContext : true)
const embedded = ref(typeof window !== 'undefined' ? isEmbeddedBrowser() : false)
const remoteVideoEl = ref<HTMLVideoElement | null>(null)
const localVideoEl = ref<HTMLVideoElement | null>(null)

let localStream: MediaStream | null = null
const remoteStream = ref<MediaStream | null>(null)
let iceServers: IceServer[] = []
const peers = new Map<string, PeerConn>()
/** 每次 START/STOP 递增，用于丢弃过期异步回调 */
let shareEpoch = 0

const isViewer = computed(() => !!sharerId.value && sharerId.value !== props.peerId)
const empty = computed(() => !sharerId.value && !sharing.value)
const live = computed(() => sharing.value || isViewer.value)

watch(live, (v) => emit('live', v), { immediate: true })

function emitState() {
  emit('state', {
    live: live.value,
    sharing: sharing.value,
    starting: starting.value,
    viewing: isViewer.value,
    empty: empty.value,
    sharerName: sharerName.value,
    quality: quality.value,
    error: errorText.value,
    insecure: !isSecure.value,
    embedded: embedded.value,
    occupied: !!sharerId.value && sharerId.value !== props.peerId && !sharing.value,
  })
}

watch(
  [live, sharing, starting, isViewer, empty, sharerName, quality, errorText, sharerId],
  emitState,
  { immediate: true },
)

function signal(payload: Record<string, unknown>) {
  props.sendSignal(payload)
}

function toRtcIceServers(servers: IceServer[]): RTCIceServer[] {
  return servers.map((s) => {
    const entry: RTCIceServer = { urls: s.urls }
    if (s.username) entry.username = s.username
    if (s.credential) entry.credential = s.credential
    return entry
  })
}

async function ensureIce() {
  if (iceServers.length) return
  const cfg = await getIceServers(props.roomId, props.peerId)
  iceServers = cfg.iceServers || []
}

function descPayload(desc: RTCSessionDescription | RTCSessionDescriptionInit | null | undefined) {
  if (!desc) return undefined
  return { type: desc.type, sdp: desc.sdp }
}

function bindRemoteVideo(stream: MediaStream) {
  remoteStream.value = stream
  const el = remoteVideoEl.value
  if (el) {
    el.srcObject = stream
    void el.play().catch(() => {})
  }
}

function bindLocalVideo(stream: MediaStream) {
  const el = localVideoEl.value
  if (el) {
    el.srcObject = stream
    void el.play().catch(() => {})
  }
}

watch([remoteVideoEl, remoteStream], () => {
  const el = remoteVideoEl.value
  const stream = remoteStream.value
  if (!el) return
  if (stream) {
    if (el.srcObject !== stream) el.srcObject = stream
    void el.play().catch(() => {})
  } else {
    el.srcObject = null
  }
})

watch([localVideoEl, () => localStream], () => {
  if (localVideoEl.value && localStream) {
    localVideoEl.value.srcObject = localStream
    void localVideoEl.value.play().catch(() => {})
  }
})

function currentPreset() {
  return QUALITY_PRESETS[quality.value]
}

/**
 * 实际写入每条连接的 maxBitrate。
 * 高码率档：总预算 / 观看人数；其它档：预设每路上限（与人数无关）。
 * @param viewerCount 默认用当前 peers.size；建连尚未 set 进 map 时可传入 size+1
 */
function effectiveScreenBitrate(viewerCount = peers.size): number {
  const preset = currentPreset()
  if (quality.value === '1080p') {
    return Math.floor(preset.maxBitrate / Math.max(1, viewerCount))
  }
  return preset.maxBitrate
}

async function rebalanceScreenBitrates() {
  if (!sharing.value || peers.size === 0) return
  const br = effectiveScreenBitrate()
  console.info('[Screen] rebalance bitrate', {
    quality: quality.value,
    viewers: peers.size,
    perViewer: br,
  })
  await Promise.all([...peers.values()].map((p) => applyScreenEncoding(p.pc)))
}

/** 给 video m-line 写入带宽上限，避免仅靠 setParameters 被浏览器忽略 */
function injectVideoBandwidth(sdp: string, maxBitrateBps: number): string {
  const as = Math.max(1, Math.ceil(maxBitrateBps / 1000))
  const minKbps = quality.value === '1080p' ? Math.min(8000, Math.max(2500, Math.floor(as * 0.35))) : Math.max(200, Math.floor(as * 0.25))
  const startKbps = Math.min(as, Math.max(minKbps, Math.floor((minKbps + as) / 2)))
  const parts = sdp.split(/(m=video[^\r\n]*\r\n)/)
  if (parts.length < 2) return sdp
  let out = parts[0]
  for (let i = 1; i < parts.length; i += 2) {
    const header = parts[i]
    let body = parts[i + 1] ?? ''
    body = body.replace(/^b=(AS|TIAS):[^\r\n]*\r\n/gm, '')
    body = body.replace(/^(a=fmtp:\d+ )([^\r\n]*)/gm, (line, prefix: string, rest: string) => {
      if (/opus|telephone-event|red|ulpfec|flexfec/i.test(rest)) return line
      const cleaned = rest.replace(/;?\s*x-google-(?:min|max|start)-bitrate=\d+/gi, '')
      return `${prefix}${cleaned};x-google-max-bitrate=${as};x-google-min-bitrate=${minKbps};x-google-start-bitrate=${startKbps}`
    })
    out += `${header}b=AS:${as}\r\n` + `b=TIAS:${maxBitrateBps}\r\n` + body
  }
  return out
}

function preferSharpScreenCodecs(pc: RTCPeerConnection) {
  const rank = [/av1/i, /vp9/i, /vp8/i, /h264/i]
  const caps = RTCRtpSender.getCapabilities?.('video') || RTCRtpReceiver.getCapabilities?.('video')
  if (!caps?.codecs?.length) return
  const ordered = [...caps.codecs].sort((a, b) => {
    const ia = rank.findIndex((re) => re.test(a.mimeType))
    const ib = rank.findIndex((re) => re.test(b.mimeType))
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
  })
  for (const t of pc.getTransceivers()) {
    try {
      t.setCodecPreferences?.(ordered)
    } catch {
      /* ignore */
    }
  }
}

function screenVideoConstraints(): MediaTrackConstraints {
  const preset = currentPreset()
  if (quality.value === '1080p') {
    return {
      width: { ideal: 3840 },
      height: { ideal: 2160 },
      frameRate: { ideal: preset.maxFramerate, max: preset.maxFramerate },
      ...({ resizeMode: 'none' } as MediaTrackConstraints),
    }
  }
  return {
    width: { ideal: preset.width, max: preset.width },
    height: { ideal: preset.height, max: preset.height },
    frameRate: { ideal: preset.maxFramerate, max: preset.maxFramerate },
  }
}

async function applyTrackConstraints(track: MediaStreamTrack) {
  try {
    track.contentHint = quality.value === '360p' ? 'motion' : 'detail'
  } catch {
    /* ignore */
  }
  try {
    await track.applyConstraints(screenVideoConstraints())
    const settings = track.getSettings()
    console.info('[Screen] track constraints', {
      quality: quality.value,
      want: quality.value === '1080p' ? 'native/4k uncapped' : `${currentPreset().width}x${currentPreset().height}`,
      got: `${settings.width}x${settings.height}@${settings.frameRate}`,
    })
  } catch (e) {
    console.warn('[Screen] applyConstraints failed', quality.value, e)
  }
}

async function applyScreenEncoding(pc: RTCPeerConnection) {
  const preset = currentPreset()
  const maxBitrate = effectiveScreenBitrate()
  for (const sender of pc.getSenders()) {
    if (sender.track?.kind !== 'video') continue
    try {
      sender.track.contentHint = quality.value === '360p' ? 'motion' : 'detail'
    } catch {
      /* ignore */
    }

    let applied = false
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const params = sender.getParameters()
        if (!params.encodings?.length) {
          await new Promise((r) => setTimeout(r, 80 * (attempt + 1)))
          continue
        }
        params.degradationPreference = 'maintain-resolution'
        params.encodings = params.encodings.map((enc, idx) =>
          idx === 0
            ? {
                ...enc,
                active: true,
                maxBitrate,
                maxFramerate: preset.maxFramerate,
                scaleResolutionDownBy: 1,
                ...(quality.value === '1080p'
                  ? { priority: 'high' as RTCPriorityType, networkPriority: 'high' as RTCPriorityType }
                  : {}),
              }
            : { ...enc, active: false },
        )
        await sender.setParameters(params)
        const got = sender.getParameters().encodings?.[0]?.maxBitrate
        console.info('[Screen] setParameters ok', {
          quality: quality.value,
          viewers: peers.size,
          wantBitrate: maxBitrate,
          gotBitrate: got,
        })
        applied = true
        break
      } catch (e) {
        console.warn('[Screen] setParameters retry', attempt, e)
        await new Promise((r) => setTimeout(r, 80 * (attempt + 1)))
      }
    }
    if (!applied) {
      console.warn('[Screen] setParameters gave up', quality.value, maxBitrate)
    }
  }
}

async function applyQualityToAllSenders() {
  const track = localStream?.getVideoTracks()[0]
  if (track) await applyTrackConstraints(track)
  await Promise.all([...peers.values()].map((p) => applyScreenEncoding(p.pc)))
}

async function onQualityChange(next: ScreenQuality) {
  if (quality.value === next) return
  quality.value = next
  MatomoTracker.trackEvent('Screen', 'Quality', next)
  if (!sharing.value) return
  await applyQualityToAllSenders()
  // 同分辨率档位只改码率时，重建 offer 才能稳定让观看端吃到新上限
  const viewerIds = [...peers.keys()]
  for (const id of viewerIds) {
    await offerToViewer(id)
  }
}

async function flushPendingIce(conn: PeerConn) {
  if (!conn.pc.remoteDescription || !conn.pendingIce.length) return
  const batch = conn.pendingIce.splice(0, conn.pendingIce.length)
  for (const c of batch) {
    try {
      await conn.pc.addIceCandidate(c)
    } catch (e) {
      console.warn('[Screen] flush ICE failed', e)
    }
  }
}

function createViewerPc(remoteId: string): PeerConn {
  const pc = new RTCPeerConnection({
    iceServers: toRtcIceServers(iceServers),
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
  })
  pc.addTransceiver('video', { direction: 'recvonly' })
  preferSharpScreenCodecs(pc)
  const conn: PeerConn = { pc, pendingIce: [] }
  pc.onicecandidate = (ev) => {
    signal({
      type: 'SCREEN_ICE',
      from: props.peerId,
      to: remoteId,
      candidate: ev.candidate ? ev.candidate.toJSON() : null,
    })
  }
  pc.ontrack = (ev) => {
    const stream = ev.streams[0] || new MediaStream([ev.track])
    bindRemoteVideo(stream)
    ev.track.addEventListener('ended', () => {
      if (remoteStream.value === stream) clearRemotePlayback()
    })
  }
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed') {
      console.warn('[Screen] viewer PC failed', remoteId)
    }
  }
  peers.set(remoteId, conn)
  return conn
}

function createSharerPc(viewerId: string): PeerConn {
  const pc = new RTCPeerConnection({
    iceServers: toRtcIceServers(iceServers),
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
  })
  // replace 时先 delete 再 create：人数按「即将加入后」计算
  const bitrate = effectiveScreenBitrate(peers.size + 1)
  if (localStream) {
    const preset = currentPreset()
    for (const track of localStream.getTracks()) {
      try {
        if (track.kind === 'video') {
          track.contentHint = quality.value === '360p' ? 'motion' : 'detail'
        }
      } catch {
        /* ignore */
      }
      try {
        pc.addTransceiver(track, {
          direction: 'sendonly',
          streams: [localStream],
          sendEncodings: [
            {
              active: true,
              maxBitrate: bitrate,
              maxFramerate: preset.maxFramerate,
              scaleResolutionDownBy: 1,
              ...(quality.value === '1080p'
                ? { priority: 'high' as RTCPriorityType, networkPriority: 'high' as RTCPriorityType }
                : {}),
            },
          ],
        })
      } catch {
        pc.addTrack(track, localStream)
      }
    }
  }
  preferSharpScreenCodecs(pc)
  const conn: PeerConn = { pc, pendingIce: [] }
  pc.onicecandidate = (ev) => {
    signal({
      type: 'SCREEN_ICE',
      from: props.peerId,
      to: viewerId,
      candidate: ev.candidate ? ev.candidate.toJSON() : null,
    })
  }
  // 连接就绪后再设一次，避免 encodings 未就绪时 setParameters 被静默丢掉
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'connected') {
      void applyScreenEncoding(pc)
    } else if (
      (pc.connectionState === 'failed' || pc.connectionState === 'closed') &&
      peers.get(viewerId)?.pc === pc
    ) {
      peers.delete(viewerId)
      try {
        pc.onicecandidate = null
        pc.ontrack = null
      } catch {
        /* ignore */
      }
      if (sharing.value && peers.size > 0) {
        void rebalanceScreenBitrates()
      }
    }
  }
  peers.set(viewerId, conn)
  return conn
}

function closePeer(id: string, options?: { rebalance?: boolean }) {
  const p = peers.get(id)
  if (!p) return
  try {
    p.pc.onicecandidate = null
    p.pc.ontrack = null
    p.pc.onconnectionstatechange = null
    p.pc.close()
  } catch {
    /* ignore */
  }
  peers.delete(id)
  if (options?.rebalance && sharing.value && peers.size > 0) {
    void rebalanceScreenBitrates()
  }
}

function closeAllPeers() {
  for (const id of [...peers.keys()]) closePeer(id, { rebalance: false })
}

/** 每次协商都新建 PC，避免第二次分享复用已 closed / 脏状态的连接 */
function replaceViewerPc(remoteId: string): PeerConn {
  closePeer(remoteId)
  return createViewerPc(remoteId)
}

function replaceSharerPc(viewerId: string): PeerConn {
  closePeer(viewerId)
  return createSharerPc(viewerId)
}

async function offerToViewer(viewerId: string) {
  if (!sharing.value || !localStream) return
  const epoch = shareEpoch
  await ensureIce()
  if (epoch !== shareEpoch || !sharing.value) return
  const conn = replaceSharerPc(viewerId)
  const perViewer = effectiveScreenBitrate()
  const offer = await conn.pc.createOffer()
  const sdp = offer.sdp ? injectVideoBandwidth(offer.sdp, perViewer) : offer.sdp
  const localDesc: RTCSessionDescriptionInit = { type: offer.type, sdp }
  await conn.pc.setLocalDescription(localDesc)
  await applyScreenEncoding(conn.pc)
  if (epoch !== shareEpoch || !sharing.value) return
  console.info('[Screen] offer bitrate', {
    viewerId,
    quality: quality.value,
    viewers: peers.size,
    perViewerBitrate: perViewer,
    totalBudget: currentPreset().maxBitrate,
  })
  signal({
    type: 'SCREEN_OFFER',
    from: props.peerId,
    to: viewerId,
    name: props.displayName,
    sdp: descPayload(conn.pc.localDescription) ?? localDesc,
  })
  // 新人加入后摊薄/抬高所有已有连接的每路码率（主要对高码率档有意义）
  await rebalanceScreenBitrates()
}

async function handleWatch(msg: ScreenSignal) {
  // 只响应发给自己的观看请求（广播通道上会看到别人的 WATCH）
  if (msg.to && msg.to !== props.peerId) return
  if (!sharing.value || !msg.from || msg.from === props.peerId) return
  await offerToViewer(msg.from)
}

async function handleOffer(msg: ScreenSignal) {
  if (!msg.from || !msg.sdp || msg.to !== props.peerId) return
  if (sharerId.value && sharerId.value !== msg.from) return
  const epoch = shareEpoch
  await ensureIce()
  if (epoch !== shareEpoch) return
  const conn = replaceViewerPc(msg.from)
  await conn.pc.setRemoteDescription(msg.sdp)
  await flushPendingIce(conn)
  const answer = await conn.pc.createAnswer()
  await conn.pc.setLocalDescription(answer)
  if (epoch !== shareEpoch) return
  signal({
    type: 'SCREEN_ANSWER',
    from: props.peerId,
    to: msg.from,
    name: props.displayName,
    sdp: descPayload(conn.pc.localDescription) ?? answer,
  })
}

async function handleAnswer(msg: ScreenSignal) {
  if (!msg.from || !msg.sdp || msg.to !== props.peerId) return
  const conn = peers.get(msg.from)
  if (!conn) return
  if (conn.pc.signalingState === 'have-local-offer') {
    await conn.pc.setRemoteDescription(msg.sdp)
    await flushPendingIce(conn)
  }
}

async function handleIce(msg: ScreenSignal) {
  if (!msg.from || msg.to !== props.peerId || !msg.candidate) return
  const conn = peers.get(msg.from)
  if (!conn) return
  if (!conn.pc.remoteDescription) {
    conn.pendingIce.push(msg.candidate)
    return
  }
  try {
    await conn.pc.addIceCandidate(msg.candidate)
  } catch (e) {
    console.warn('[Screen] addIceCandidate failed', e)
  }
}

function clearRemotePlayback() {
  remoteStream.value = null
  if (remoteVideoEl.value) remoteVideoEl.value.srcObject = null
}

function onRemoteStart(msg: ScreenSignal) {
  if (!msg.from || msg.from === props.peerId) return
  // 若自己还在分享，忽略他人 START（后端锁也应挡住）
  if (sharing.value) return
  shareEpoch += 1
  // 换分享者前必须拆掉旧 PC，否则第二次观看经常复用脏连接导致黑屏
  closeAllPeers()
  clearRemotePlayback()
  sharerId.value = msg.from
  sharerName.value = msg.name || msg.from
  errorText.value = ''
  signal({ type: 'SCREEN_WATCH', from: props.peerId, name: props.displayName, to: msg.from })
}

function onRemoteStop(msg: ScreenSignal) {
  if (!msg.from) return
  // 只处理当前分享者（或自己）的停止，避免误清
  if (sharerId.value && sharerId.value !== msg.from && msg.from !== props.peerId) return
  shareEpoch += 1
  closeAllPeers()
  clearRemotePlayback()
  if (msg.from === props.peerId || sharerId.value === msg.from) {
    sharerId.value = null
    sharerName.value = ''
  }
}

async function handleSignal(body: ScreenSignal) {
  if (!body?.type?.startsWith('SCREEN_')) return
  try {
    switch (body.type) {
      case 'SCREEN_START':
        if (body.from === props.peerId) {
          sharerId.value = props.peerId
          sharerName.value = props.displayName
        } else {
          onRemoteStart(body)
        }
        break
      case 'SCREEN_STOP':
        onRemoteStop(body)
        break
      case 'SCREEN_WATCH':
        await handleWatch(body)
        break
      case 'SCREEN_OFFER':
        await handleOffer(body)
        break
      case 'SCREEN_ANSWER':
        await handleAnswer(body)
        break
      case 'SCREEN_ICE':
        await handleIce(body)
        break
      case 'SCREEN_BUSY':
        errorText.value = t('room.screenBusy', {
          name: body.sharerName ? ` (${body.sharerName})` : '',
        })
        starting.value = false
        await cleanupLocalShare(false)
        break
      default:
        break
    }
  } catch (e) {
    console.error('[Screen] signal error', body.type, e)
  }
}

function applyInitialShare(state: { peerId: string; name?: string } | null | undefined) {
  if (!state?.peerId) return
  if (state.peerId === props.peerId) return
  if (sharing.value) return
  shareEpoch += 1
  closeAllPeers()
  clearRemotePlayback()
  sharerId.value = state.peerId
  sharerName.value = state.name || state.peerId
  signal({ type: 'SCREEN_WATCH', from: props.peerId, name: props.displayName, to: state.peerId })
}

async function cleanupLocalShare(broadcast: boolean) {
  shareEpoch += 1
  closeAllPeers()
  if (localStream) {
    for (const t of localStream.getTracks()) t.stop()
    localStream = null
  }
  if (localVideoEl.value) localVideoEl.value.srcObject = null
  const wasSharing = sharing.value
  sharing.value = false
  starting.value = false
  if (sharerId.value === props.peerId) {
    sharerId.value = null
    sharerName.value = ''
  }
  if (broadcast && wasSharing) {
    signal({ type: 'SCREEN_STOP', from: props.peerId, name: props.displayName })
  }
}

function isEmbeddedBrowser(): boolean {
  const ua = navigator.userAgent || ''
  // Cursor / VS Code 内置预览、部分 WebView 不支持稳定的 getDisplayMedia
  return /Electron|Cursor|VSCode|Code[/ ]/i.test(ua) || !!(window as unknown as { electron?: unknown }).electron
}

function screenStartErrorMessage(e: unknown): string {
  const name = e && typeof e === 'object' && 'name' in e ? String((e as { name: string }).name) : ''
  const message = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : String(e || '')
  const detail = [name, message].filter(Boolean).join(': ')

  if (!window.isSecureContext) {
    return `${t('room.screenInsecure')} (${detail || 'SecurityError'})`
  }
  if (!navigator.mediaDevices?.getDisplayMedia) {
    return `${t('room.screenUnsupported')} (${detail || 'NotSupportedError'})`
  }
  if (isEmbeddedBrowser()) {
    return `${t('room.screenEmbedded')} (${detail || 'EmbeddedBrowser'})`
  }
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return `${t('room.screenDenied')} (${detail})`
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return `${t('room.screenMacosPermission')} (${detail})`
  }
  if (name === 'NotFoundError' || name === 'AbortError') {
    return `${t('room.screenCancelled')} (${detail})`
  }
  if (name === 'SecurityError') {
    return `${t('room.screenInsecure')} (${detail})`
  }
  return `${t('room.screenStartFail')} (${detail || 'unknown'})`
}

async function acquireDisplayStream(): Promise<MediaStream> {
  if (!window.isSecureContext) {
    throw Object.assign(new Error('insecure context'), { name: 'SecurityError' })
  }
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw Object.assign(new Error('getDisplayMedia unsupported'), { name: 'NotSupportedError' })
  }
  if (isEmbeddedBrowser()) {
    throw Object.assign(new Error('embedded browser cannot capture screen'), { name: 'NotSupportedError' })
  }
  try {
    return await navigator.mediaDevices.getDisplayMedia({
      video: screenVideoConstraints(),
      audio: false,
    })
  } catch (e) {
    const name = e && typeof e === 'object' && 'name' in e ? String((e as { name: string }).name) : ''
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'AbortError') {
      throw e
    }
    return navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    })
  }
}

async function startShare() {
  if (props.frozen || starting.value || sharing.value) return
  if (sharerId.value && sharerId.value !== props.peerId) {
    errorText.value = t('room.screenBusy', {
      name: sharerName.value ? ` (${sharerName.value})` : '',
    })
    return
  }
  starting.value = true
  errorText.value = ''
  try {
    // 开始新一轮分享前清掉可能残留的观看连接
    shareEpoch += 1
    closeAllPeers()
    clearRemotePlayback()

    // 必须先拿屏幕流（保留用户手势）；ICE 失败不应挡住分享选择器
    localStream = await acquireDisplayStream()
    const vTrack = localStream.getVideoTracks()[0]
    if (!vTrack) {
      throw Object.assign(new Error('no video track from display media'), { name: 'NotFoundError' })
    }
    await applyTrackConstraints(vTrack)
    vTrack.addEventListener('ended', () => {
      void stopShare()
    })
    bindLocalVideo(localStream)
    sharing.value = true
    sharerId.value = props.peerId
    sharerName.value = props.displayName

    try {
      await ensureIce()
    } catch (iceErr) {
      console.warn('[Screen] ICE 配置获取失败，仍可本地预览，对端可能连不上', iceErr)
    }
    signal({ type: 'SCREEN_START', from: props.peerId, name: props.displayName })
    MatomoTracker.trackEvent('Screen', 'Start')
  } catch (e) {
    console.error('[Screen] startShare failed', e)
    errorText.value = screenStartErrorMessage(e)
    MatomoTracker.trackEvent('Screen', 'StartFail', errorText.value)
    await cleanupLocalShare(false)
  } finally {
    starting.value = false
  }
}

async function stopShare() {
  const wasSharing = sharing.value
  await cleanupLocalShare(true)
  clearRemotePlayback()
  if (wasSharing) MatomoTracker.trackEvent('Screen', 'Stop')
}

onBeforeUnmount(() => {
  void cleanupLocalShare(true)
  clearRemotePlayback()
})

defineExpose({ handleSignal, applyInitialShare, startShare, stopShare, setQuality: onQualityChange })
</script>

<template>
  <div class="screen-share-panel" :class="{ active }">
    <div v-if="!hideChrome" class="screen-toolbar">
      <div class="screen-meta">
        <template v-if="sharing">
          <span class="live-pill">{{ t('room.screenYouSharing') }}</span>
        </template>
        <template v-else-if="isViewer">
          <span class="live-pill viewer">{{ t('room.screenSharingBy', { name: sharerName }) }}</span>
        </template>
        <template v-else>
          <span class="idle-pill">{{ t('room.screenIdle') }}</span>
        </template>
        <div
          v-if="!isViewer"
          class="quality-switch"
          role="group"
          :aria-label="t('room.screenQuality')"
        >
          <span class="quality-label">{{ t('room.screenQuality') }}</span>
          <button
            v-for="q in QUALITY_ORDER"
            :key="q"
            type="button"
            class="quality-btn"
            :class="{ active: quality === q }"
            :disabled="frozen || starting"
            @click="onQualityChange(q)"
          >
            {{ t(QUALITY_PRESETS[q].labelKey) }}
          </button>
        </div>
      </div>
      <div class="screen-actions">
        <button
          v-if="!sharing"
          class="btn btn-primary"
          type="button"
          :disabled="frozen || starting || (!!sharerId && sharerId !== peerId)"
          @click="startShare"
        >
          {{ starting ? t('room.screenStarting') : t('room.screenStart') }}
        </button>
        <button v-if="sharing" class="btn btn-danger" type="button" @click="stopShare">
          {{ t('room.screenStop') }}
        </button>
      </div>
    </div>

    <p v-if="frozen" class="screen-error">{{ t('room.screenFrozen') }}</p>
    <p v-else-if="errorText" class="screen-error">{{ errorText }}</p>

    <div class="screen-stage">
      <div v-if="empty" class="screen-empty">
        <div class="empty-mark" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="3" y="4" width="18" height="12" rx="2" />
            <path d="M8 20h8M12 16v4" stroke-linecap="round" />
          </svg>
        </div>
        <h3 class="empty-title">{{ t('room.screenNobody') }}</h3>
        <p class="empty-desc">{{ frozen ? t('room.screenFrozen') : t('room.screenNobodyHint') }}</p>
        <button
          v-if="!frozen"
          class="empty-start"
          type="button"
          :disabled="starting || !!sharerId"
          @click="startShare"
        >
          {{ starting ? t('room.screenStarting') : t('room.screenStart') }}
        </button>
        <p v-if="!isSecure" class="empty-note">{{ t('room.screenInsecure') }}</p>
        <p v-else-if="embedded" class="empty-note">{{ t('room.screenEmbedded') }}</p>
      </div>
      <button
        v-if="sharing && hideChrome"
        class="screen-stop-fab"
        type="button"
        @click="stopShare"
      >
        {{ t('room.screenStop') }}
      </button>

      <video
        v-show="sharing"
        ref="localVideoEl"
        class="screen-video"
        autoplay
        muted
        playsinline
      />
      <video
        v-show="isViewer"
        ref="remoteVideoEl"
        class="screen-video"
        autoplay
        playsinline
      />
    </div>
  </div>
</template>
