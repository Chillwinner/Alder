<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Editor } from 'tldraw'
import CameraOverlay from '../components/CameraOverlay.vue'
import DrawingCanvas from '../components/DrawingCanvas.vue'
import RoomKitBar from '../components/RoomKitBar.vue'
import ScreenSharePanel, { type ScreenShareState } from '../components/ScreenSharePanel.vue'
import VoicePanel from '../components/VoicePanel.vue'
import { alderMeeting, closeRoom, downloadRoomSnapshot, getRoomStatus } from '../api/room'
import { inviteWorkspaceMeeting, listWorkspaceMeetings } from '../../api/meeting'
import { workspaceApi } from '../../api/workspace'
import i18n from '../../i18n'
import { getAvatarFallback } from '../../utils/avatar'
import { resolveMediaUrl } from '../../utils/media-url'
import { useBoardPresence } from '../composables/useBoardPresence'
import { useRoomKit } from '../composables/useRoomKit'
import { useRoomOrientation } from '../composables/useRoomOrientation'
import { peekPrefetch, randomIdentity } from '../composables/useVoicePrefetch'
import { useStomp } from '../composables/useStomp'
import { lang, t } from '../i18n'
import { MatomoTracker } from '../lib/analytics'
import type { PeerTrail } from '../lib/presence'
import {
  assetToFilePayload,
  isClearableRecord,
  isSyncRecord,
  packRecord,
  unpackRecord,
} from '../lib/tldrawSync'
import { homePath } from '../seo/site'
import { useWhiteboardStore } from '../stores/whiteboard'
import './RoomView.css'

const route = useRoute()
const router = useRouter()
const store = useWhiteboardStore()
const {
  connected,
  connect,
  sendDraw,
  sendVoice,
  sendScreen,
  sendCamera,
  sendPresence,
  sendKit,
  disconnect,
} = useStomp()
const presenceTrails = ref<PeerTrail[]>([])
const { needsRotate, forceLandscapeLayout, isMobileLandscape, confirmLandscape } =
  useRoomOrientation()
const mobileMenuOpen = ref(false)

const roomId = computed(() => String(route.params.roomId || ''))
const status = ref<'loading' | 'ACTIVE' | 'CLOSED' | 'FROZEN' | 'GONE' | string>('loading')
const syncing = ref(true)
const error = ref('')
const showCloseConfirm = ref(false)
const closing = ref(false)
const showEnded = ref(false)
const isClosed = computed(() => status.value === 'CLOSED' || status.value === 'FROZEN')
const voiceReady = computed(() => status.value === 'ACTIVE' && connected.value && !isClosed.value)
const canvasRef = ref<InstanceType<typeof DrawingCanvas> | null>(null)
const voiceRef = ref<InstanceType<typeof VoicePanel> | null>(null)
const screenRef = ref<InstanceType<typeof ScreenSharePanel> | null>(null)
const viewMode = ref<'board' | 'screen'>('board')
const boardOpen = ref(false)
const screenOpen = ref(false)
const screenLive = ref(false)
const rightPane = computed<'none' | 'board' | 'screen'>(() => {
  if (boardOpen.value) return 'board'
  if (screenOpen.value) return 'screen'
  return 'none'
})
const camerasOnly = computed(() => rightPane.value === 'none')
const screenState = ref<ScreenShareState | undefined>()
const expandingPane = ref<'board' | 'screen' | null>(null)
let expandTimer = 0
let pipFitTimer = 0
let savedBoardCamera: { x: number; y: number; z: number } | null = null
const cameraTiles = ref<{ peerId: string; name: string; isLocal: boolean; stream: MediaStream | null }[]>([])

const roomExpiresAt = ref<number | null>(null)
const nowMs = ref(Date.now())
let ttlTimer = 0

function applyRoomDeadline(_createdAt?: string | null, expiresAt?: string | null) {
  if (alderMeeting()?.noTtl || !expiresAt) {
    roomExpiresAt.value = null
    return
  }
  const exp = Date.parse(expiresAt)
  roomExpiresAt.value = Number.isFinite(exp) ? exp : null
}

const roomRemainMs = computed(() => {
  if (roomExpiresAt.value == null) return null
  return Math.max(0, roomExpiresAt.value - nowMs.value)
})

const roomRemainLabel = computed(() => {
  if (roomRemainMs.value == null) return '--:--'
  const total = Math.ceil(roomRemainMs.value / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

const roomRemainUrgent = computed(() => roomRemainMs.value != null && roomRemainMs.value <= 10 * 60 * 1000)

const peerId = `u-${Math.random().toString(36).slice(2, 10)}`
const alderName = (window as Window & { __alderMeeting?: { displayName?: string } }).__alderMeeting
  ?.displayName
const displayName = ref(alderName || peekPrefetch(roomId.value)?.identity || '')

type InviteMember = { userId: string; label: string; avatar?: string }
const inviteMembers = ref<InviteMember[]>([])
const invitingId = ref('')
const poppedId = ref('')
const inviteNote = ref('')

function meetingText(key: string) {
  return i18n.t(key, { ns: 'board' })
}

async function loadInvitees() {
  const bridge = alderMeeting()
  if (!bridge) return
  const [members, meetings] = await Promise.all([
    workspaceApi.getMembers(
      { page: 1, size: 200 },
      { 'X-Workspace-Id': bridge.workspaceId }
    ),
    listWorkspaceMeetings(bridge.workspaceId),
  ])
  const current = meetings.find((item) => item.id === bridge.meetingId)
  const already = new Set(current?.participantUserIds ?? [])
  inviteMembers.value = (members.records ?? [])
    .filter((member) => member.userId && !already.has(member.userId))
    .map((member) => ({
      userId: member.userId,
      label: member.nickname?.trim() || member.username || member.userId,
      avatar: resolveMediaUrl(member.avatar),
    }))
}

async function inviteOne(userId: string) {
  const bridge = alderMeeting()
  if (!bridge || invitingId.value) return
  invitingId.value = userId
  poppedId.value = userId
  inviteNote.value = ''
  try {
    await inviteWorkspaceMeeting(bridge.meetingId, bridge.workspaceId, [userId])
    window.setTimeout(() => {
      inviteMembers.value = inviteMembers.value.filter((member) => member.userId !== userId)
      if (poppedId.value === userId) poppedId.value = ''
    }, 460)
  } catch (e) {
    poppedId.value = ''
    inviteNote.value = e instanceof Error ? e.message : meetingText('meeting.createFailed')
  } finally {
    invitingId.value = ''
  }
}
const presence = useBoardPresence({
  peerId,
  name: displayName,
  send: (payload) => sendPresence(roomId.value, payload),
  canSend: () => connected.value && !isClosed.value && !syncing.value,
  onBoard: () => rightPane.value === 'board',
  trails: presenceTrails,
})
const kit = useRoomKit({
  peerId,
  send: (payload) => sendKit(roomId.value, payload),
  canSend: () => connected.value && !isClosed.value,
})

let editor: Editor | null = null
let applyingRemote = false
const versions = new Map<string, number>()
/** 已同步到房间的 asset dataURL，避免重复广播 */
const syncedFiles = new Set<string>()
/** FILE 缓存：asset id → dataURL */
const fileSrcCache = new Map<string, string>()
/** INIT 可能早于 tldraw editor 就绪，先缓存再应用 */
let pendingInit: any = null
let pendingPageId: string | null = null
let lastPageId = ''
let syncTimer: number | undefined
let unlistenStore: (() => void) | undefined
let unlistenPage: (() => void) | undefined

function setApplying() {
  applyingRemote = true
  window.setTimeout(() => {
    applyingRemote = false
  }, 80)
}

function setReadonly(readonly: boolean) {
  editor?.updateInstanceState({ isReadonly: readonly })
}

function bumpVersion(id: string): number {
  const next = (versions.get(id) ?? 0) + 1
  versions.set(id, next)
  return next
}

function cacheFiles(files: Record<string, any> | any[] | null | undefined) {
  if (!files) return
  const list = Array.isArray(files) ? files : Object.values(files)
  for (const f of list) {
    if (f?.id && f?.dataURL) {
      fileSrcCache.set(f.id, f.dataURL)
      syncedFiles.add(f.id)
    }
  }
}

function ensureAssetSynced(asset: any) {
  if (!asset?.id || syncedFiles.has(asset.id) || applyingRemote) return
  if (isClosed.value || !connected.value || syncing.value) return
  const payload = assetToFilePayload(asset)
  if (!payload) return
  syncedFiles.add(asset.id)
  fileSrcCache.set(asset.id, payload.dataURL)
  sendDraw(roomId.value, { type: 'FILE', fileId: asset.id, data: payload })
}

function putRemoteRecords(records: any[]) {
  if (!editor || !records.length) return
  setApplying()
  editor.store.mergeRemoteChanges(() => {
    editor!.store.put(records as any)
  })
}

function removeRemoteIds(ids: string[]) {
  if (!editor || !ids.length) return
  setApplying()
  editor.store.mergeRemoteChanges(() => {
    editor!.store.remove(ids as any)
  })
}

function handleInit(body: any) {
  if (body?.type === 'ROOM_NOT_FOUND') {
    error.value = t('room.notFound')
    MatomoTracker.trackEvent('Room', 'NotFound', roomId.value)
    store.clearRoom()
    window.setTimeout(() => router.push(homePath(lang.value)), 2000)
    return
  }
  if (body?.type === 'ROOM_FULL') {
    error.value = t('room.full')
    MatomoTracker.trackEvent('Room', 'Full', roomId.value)
    // 人满只退会话，保留房主凭证以便稍后再进
    store.clearSession()
    window.setTimeout(() => router.push(homePath(lang.value)), 2500)
    return
  }
  if (body?.type === 'SCREEN_BUSY') {
    screenRef.value?.handleSignal(body)
    return
  }
  if (body?.type === 'CAMERA_BUSY' || body?.type === 'CAMERA_STATE') {
    voiceRef.value?.handleSignal(body)
    return
  }
  if (body?.type !== 'INIT') return
  applyRoomDeadline(body.createdAt, body.expiresAt)
  MatomoTracker.trackEvent('Room', 'Enter', roomId.value)
  if (!editor) {
    pendingInit = body
    return
  }
  applyInitScene(body)
}

function applyInitScene(body: any) {
  if (!editor) return
  const map = (body.elements || {}) as Record<string, any>
  versions.clear()
  syncedFiles.clear()
  fileSrcCache.clear()
  cacheFiles(body.files)

  const records: any[] = []
  for (const raw of Object.values(map)) {
    if (!raw || typeof raw !== 'object') continue
    const ver = (raw as any).version ?? 0
    const src =
      (raw as any).typeName === 'asset'
        ? fileSrcCache.get((raw as any).id) || (raw as any).props?.src
        : null
    const record = unpackRecord(raw, src)
    if (!record) continue
    versions.set(record.id, ver)
    records.push(record)
  }

  // 清掉本地未同步的记录再灌入房间快照；若房间还没有 page，保留本地默认页
  const incomingPages = records.filter((r) => r.typeName === 'page')
  const stale: string[] = []
  for (const r of editor.store.allRecords()) {
    if (!isSyncRecord(r)) continue
    if (r.typeName === 'page' && !incomingPages.length) continue
    stale.push(r.id)
  }
  setApplying()
  editor.store.mergeRemoteChanges(() => {
    if (records.length) editor!.store.put(records as any)
    if (stale.length) editor!.store.remove(stale as any)
  })
  applyRemotePage(body.currentPageId)
  if (body.kit) kit.applyKit(body.kit)

  syncing.value = false
  pendingInit = null
  if (syncTimer) window.clearTimeout(syncTimer)
  if (body.screenShare?.peerId) {
    window.setTimeout(() => {
      screenRef.value?.applyInitialShare(body.screenShare)
    }, 50)
  }
  if (Array.isArray(body.cameraShare) && body.cameraShare.length) {
    window.setTimeout(() => {
      voiceRef.value?.applyInitialCameras(body.cameraShare)
    }, 50)
  }
}

function handleRoom(body: any) {
  if (!body?.type) return
  if (String(body.type).startsWith('VOICE_')) {
    voiceRef.value?.handleSignal(body)
    return
  }
  if (String(body.type).startsWith('CAMERA_')) {
    voiceRef.value?.handleSignal(body)
    return
  }
  if (String(body.type).startsWith('SCREEN_')) {
    screenRef.value?.handleSignal(body)
    return
  }
  if (body.type === 'PRESENCE' || body.type === 'PRESENCE_LEAVE') {
    presence.handleRemote(body)
    return
  }
  if (body.type === 'TIMER' || body.type === 'VOTE') {
    kit.handleRemote(body)
    return
  }
  if (body.type === 'CLOSE') {
    status.value = 'CLOSED'
    showEnded.value = true
    syncing.value = false
    setReadonly(true)
    void screenRef.value?.stopShare()
    cameraTiles.value = []
    presence.leave()
    void Promise.resolve(voiceRef.value?.leave?.(true)).finally(() => disconnect())
    return
  }
  if (body.type === 'FILE') {
    const f = body.data
    if (f?.id && f?.dataURL) {
      fileSrcCache.set(f.id, f.dataURL)
      syncedFiles.add(f.id)
      const existing = editor?.store.get(f.id as any)
      if (existing && isSyncRecord(existing) && existing.typeName === 'asset') {
        putRemoteRecords([
          {
            ...existing,
            props: { ...(existing as any).props, src: f.dataURL },
          },
        ])
      }
    }
    return
  }
  if (body.type === 'ADD' || body.type === 'UPDATE') {
    const el = body.data
    if (!el?.id) return
    const prev = versions.get(el.id) ?? -1
    if ((el.version ?? 0) <= prev) return
    versions.set(el.id, el.version ?? 0)
    const src = el.typeName === 'asset' ? fileSrcCache.get(el.id) || el.props?.src : null
    const record = unpackRecord(el, src)
    if (!record) return
    putRemoteRecords([record])
    if (record.typeName === 'page') applyPendingPage()
    return
  }
  if (body.type === 'PAGE') {
    applyRemotePage(body.pageId)
    return
  }
  if (body.type === 'DELETE') {
    const id = body.elementId as string
    versions.delete(id)
    syncedFiles.delete(id)
    fileSrcCache.delete(id)
    removeRemoteIds([id])
    return
  }
  if (body.type === 'CLEAR') {
    for (const [id] of [...versions]) {
      const rec = editor?.store.get(id as any)
      if (!rec || isClearableRecord(rec)) versions.delete(id)
    }
    syncedFiles.clear()
    fileSrcCache.clear()
    setApplying()
    canvasRef.value?.applyClearedScene?.()
  }
}

function onClearBoard() {
  if (isClosed.value || syncing.value || !connected.value) return
  if (!window.confirm(t('room.clearBoardConfirm'))) return
  MatomoTracker.trackEvent('Board', 'Clear', roomId.value)
  for (const [id] of [...versions]) {
    const rec = editor?.store.get(id as any)
    if (!rec || isClearableRecord(rec)) versions.delete(id)
  }
  syncedFiles.clear()
  fileSrcCache.clear()
  setApplying()
  canvasRef.value?.applyClearedScene?.()
  sendDraw(roomId.value, { type: 'CLEAR' })
}

function onLocalStoreChange(entry: { changes: { added: any; updated: any; removed: any } }) {
  if (applyingRemote || isClosed.value || !connected.value || syncing.value) return
  const { added, updated, removed } = entry.changes

  for (const record of Object.values(added) as any[]) {
    if (!isSyncRecord(record)) continue
    if (record.typeName === 'asset') ensureAssetSynced(record)
    const ver = bumpVersion(record.id)
    sendDraw(roomId.value, {
      type: 'ADD',
      elementId: record.id,
      data: packRecord(record, ver),
    })
  }

  for (const pair of Object.values(updated) as any[]) {
    const to = Array.isArray(pair) ? pair[1] : pair
    if (!isSyncRecord(to)) continue
    if (to.typeName === 'asset') ensureAssetSynced(to)
    const ver = bumpVersion(to.id)
    sendDraw(roomId.value, {
      type: 'UPDATE',
      elementId: to.id,
      data: packRecord(to, ver),
    })
  }

  for (const record of Object.values(removed) as any[]) {
    if (!isSyncRecord(record)) continue
    versions.delete(record.id)
    syncedFiles.delete(record.id)
    fileSrcCache.delete(record.id)
    sendDraw(roomId.value, { type: 'DELETE', elementId: record.id })
  }
}

function applyRemotePage(pageId: unknown) {
  if (!editor || typeof pageId !== 'string' || !pageId) return
  const exists = editor.getPages().some((p) => p.id === pageId)
  if (!exists) {
    pendingPageId = pageId
    return
  }
  pendingPageId = null
  if (editor.getCurrentPageId() === pageId) {
    lastPageId = pageId
    return
  }
  setApplying()
  lastPageId = pageId
  editor.setCurrentPage(pageId as any)
}

function applyPendingPage() {
  if (pendingPageId) applyRemotePage(pendingPageId)
}

function onLocalPageChange() {
  if (!editor || applyingRemote || isClosed.value || !connected.value || syncing.value) return
  const pageId = editor.getCurrentPageId()
  if (!pageId || pageId === lastPageId) return
  lastPageId = pageId
  sendDraw(roomId.value, { type: 'PAGE', pageId })
}

function onApiReady(next: Editor) {
  editor = next
  lastPageId = next.getCurrentPageId()
  unlistenStore?.()
  unlistenPage?.()
  unlistenStore = next.store.listen(onLocalStoreChange as any, {
    source: 'user',
    scope: 'document',
  })
  unlistenPage = next.store.listen(onLocalPageChange as any, {
    source: 'user',
    scope: 'session',
  })
  presence.attach(next)
  if (isClosed.value) setReadonly(true)
  if (pendingInit) applyInitScene(pendingInit)
}

async function loadStatus() {
  try {
    const info = await getRoomStatus(roomId.value)
    status.value = info.status
    applyRoomDeadline(info.createdAt, info.expiresAt)
    if (isClosed.value) {
      showEnded.value = true
      syncing.value = false
      setReadonly(true)
    }
  } catch (e) {
    status.value = 'GONE'
    syncing.value = false
    error.value = e instanceof Error ? e.message : t('room.notFound')
  }
}

async function onCloseConfirm() {
  const token = store.getAdminToken()
  if (!token) {
    error.value = t('room.adminTokenInvalid')
    return
  }
  closing.value = true
  try {
    let snapshot: Blob | null = null
    try {
      snapshot = (await canvasRef.value?.exportPngBlob()) ?? null
    } catch {
      snapshot = null
    }
    await closeRoom(roomId.value, token, snapshot)
    MatomoTracker.trackEvent('Room', 'Close', roomId.value)
    store.clearAdminToken(roomId.value)
    status.value = 'CLOSED'
    showCloseConfirm.value = false
    showEnded.value = true
    syncing.value = false
    setReadonly(true)
    presence.leave()
    void screenRef.value?.stopShare()
    await Promise.resolve(voiceRef.value?.leave?.(true)).catch(() => undefined)
    disconnect()
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('room.closeFail')
    MatomoTracker.trackEvent('Room', 'CloseFail', error.value)
  } finally {
    closing.value = false
  }
}

function toggleScreen() {
  if (screenOpen.value) {
    screenOpen.value = false
    return
  }
  boardOpen.value = false
  screenOpen.value = true
  setViewMode('screen')
}

async function download() {
  error.value = ''
  try {
    await downloadRoomSnapshot(roomId.value)
    MatomoTracker.trackEvent('Room', 'Download', roomId.value)
    return
  } catch (e) {
    if (e instanceof Error && e.message === 'SNAPSHOT_GONE') {
      // fall through to local canvas if still mounted
    } else {
      // try local before giving up
    }
  }
  try {
    const blob = await canvasRef.value?.exportPng(roomId.value)
    if (!blob) {
      error.value = t('room.snapshotGone')
      MatomoTracker.trackEvent('Room', 'DownloadFail', roomId.value)
    } else MatomoTracker.trackEvent('Room', 'Download', `${roomId.value}:local`)
  } catch {
    error.value = t('room.snapshotGone')
    MatomoTracker.trackEvent('Room', 'DownloadFail', roomId.value)
  }
}

function onHangup() {
  if (store.isAdmin && !isClosed.value) {
    showCloseConfirm.value = true
    return
  }
  leave()
}

async function teardownSession() {
  presence.leave()
  void screenRef.value?.stopShare()
  disconnect()
  store.clearSession()
  try {
    await voiceRef.value?.leave?.(true)
  } catch {
    /* ignore */
  }
}

function leave() {
  MatomoTracker.trackEvent('Room', 'Leave', roomId.value)
  void teardownSession().then(() => {
    void router.push(homePath(lang.value))
  })
}

/** 只离开当前标签页，不关房间。关不掉时回大厅。 */
function exitTab() {
  MatomoTracker.trackEvent('Room', 'ExitTab', roomId.value)
  void teardownSession().then(() => {
    window.close()
    window.setTimeout(() => {
      void router.push(homePath(lang.value))
    }, 80)
  })
}

function setViewMode(mode: 'board' | 'screen', fromPip = false) {
  if (viewMode.value === mode) return
  if (mode === 'screen') presence.announceLeave()
  if (fromPip && screenLive.value) {
    expandingPane.value = mode
    window.clearTimeout(expandTimer)
    expandTimer = window.setTimeout(() => {
      expandingPane.value = null
    }, 460)
  }
  viewMode.value = mode
  MatomoTracker.trackEvent('Room', 'ViewMode', fromPip ? `${mode}:pip` : mode)
}

function toggleBoard() {
  if (boardOpen.value) {
    boardOpen.value = false
    return
  }
  screenOpen.value = false
  boardOpen.value = true
  setViewMode('board')
}

function boardIsPip() {
  return viewMode.value === 'screen' && screenLive.value
}

function fitEditorToContent(ed: Editor) {
  const bounds = ed.getCurrentPageBounds()
  const w = bounds ? (bounds as { w?: number; width?: number }).w ?? bounds.width : 0
  const h = bounds ? (bounds as { h?: number; height?: number }).h ?? bounds.height : 0
  if (bounds && w > 1 && h > 1) {
    ed.zoomToBounds(bounds, { inset: 12, animation: { duration: 0 } })
    return
  }
  ed.zoomToFit({ animation: { duration: 0 } })
}

watch(screenLive, (live) => {
  if (live) {
    boardOpen.value = false
    screenOpen.value = true
    setViewMode('screen')
  }
})

watch(
  boardIsPip,
  async (pip, wasPip) => {
    await nextTick()
    window.clearTimeout(pipFitTimer)
    pipFitTimer = window.setTimeout(() => {
      if (!editor) return
      if (pip) {
        if (!wasPip) savedBoardCamera = { ...editor.getCamera() }
        fitEditorToContent(editor)
        return
      }
      if (savedBoardCamera) {
        editor.setCamera(savedBoardCamera, { animation: { duration: 0 } })
        savedBoardCamera = null
      }
    }, 480)
  },
)

function paneClass(which: 'board' | 'screen') {
  const isMain = rightPane.value === which
  return {
    'is-main': isMain,
    'is-hidden': !isMain,
  }
}

onMounted(async () => {
  ttlTimer = window.setInterval(() => {
    nowMs.value = Date.now()
  }, 1000)
  store.setRoomId(roomId.value)
  await loadStatus()
  if (isClosed.value) {
    // 房间已释放，仅保留 15 分钟图片下载
    return
  }
  if (error.value) return
  connect(roomId.value, handleInit, handleRoom)
  void loadInvitees()
  syncTimer = window.setTimeout(() => {
    syncing.value = false
  }, 10000)
})

onUnmounted(() => {
  window.clearTimeout(expandTimer)
  window.clearTimeout(pipFitTimer)
  if (ttlTimer) window.clearInterval(ttlTimer)
  if (syncTimer) window.clearTimeout(syncTimer)
  unlistenStore?.()
  unlistenPage?.()
  unlistenStore = undefined
  unlistenPage = undefined
  presence.leave()
  editor = null
  void screenRef.value?.stopShare()
  disconnect()
})
</script>

<template>
  <div
    class="room-view"
    :data-lang="lang"
    :class="{
      'is-portrait-blocked': needsRotate,
      'force-landscape-layout': forceLandscapeLayout,
      'is-mobile-landscape': isMobileLandscape,
    }"
  >
    <!-- 手机竖屏：遮罩提示横屏；点确认后立刻强制横屏布局 -->
    <div v-if="needsRotate" class="rotate-gate" role="dialog" aria-modal="true">
      <div class="rotate-card">
        <div class="rotate-phone" aria-hidden="true">
          <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
            <rect class="rotate-phone-body" x="22" y="8" width="28" height="56" rx="5" stroke="currentColor" stroke-width="2.5" />
            <circle cx="36" cy="56" r="2" fill="currentColor" />
            <path d="M48 28c6 2 10 8 10 14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
            <path d="M54 24l4 8-8 1" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <h2 class="rotate-title">{{ t('room.rotateTitle') }}</h2>
        <p class="rotate-hint">{{ t('room.rotateHint') }}</p>
        <button class="rotate-btn" type="button" @click="confirmLandscape">{{ t('room.rotateBtn') }}</button>
      </div>
    </div>

    <div
      v-if="!isClosed && roomExpiresAt"
      class="room-chip"
      :aria-label="t('room.roomTtl', { time: roomRemainLabel })"
    >
      <span class="room-ttl" :class="{ 'is-urgent': roomRemainUrgent }">
        {{ roomRemainLabel }}
      </span>
    </div>

    <div v-if="isClosed" class="frozen-banner">{{ t('room.frozenBanner') }}</div>
    <div v-if="error" class="error-banner">{{ error }}</div>
    <div v-if="syncing && viewMode === 'board' && !isClosed" class="sync-indicator">
      <span class="sync-spinner" />
      {{ t('room.syncing') }}
    </div>

    <div class="room-body" :class="{ 'is-split': !camerasOnly }">
      <CameraOverlay v-if="status === 'ACTIVE'" :tiles="cameraTiles" :stage="camerasOnly" />
      <div class="canvas-wrapper" :class="{ 'is-screen': rightPane === 'screen' }">
      <div
        v-if="!store.isAdmin && kit.timer.value"
        class="timer-hud"
        :class="{ 'is-urgent': kit.remainingMs.value <= 60_000 }"
      >
        {{ kit.remainingLabel.value }}
      </div>
      <div class="board-pane" :class="paneClass('board')">
        <DrawingCanvas
          ref="canvasRef"
          :view-mode="isClosed"
          :trails="presenceTrails"
          @api-ready="onApiReady"
          @clear-board="onClearBoard"
        />
        <RoomKitBar :kit="kit" :is-admin="store.isAdmin" :disabled="isClosed || !connected" />
      </div>
      <div class="screen-pane" :class="paneClass('screen')">
        <ScreenSharePanel
          ref="screenRef"
          :room-id="roomId"
          :peer-id="peerId"
          :display-name="displayName"
          :active="!isClosed"
          :frozen="isClosed"
          :send-signal="(payload) => sendScreen(roomId, payload)"
          hide-chrome
          @live="screenLive = $event"
          @state="screenState = $event"
        />
      </div>
      </div>
    </div>
    <VoicePanel
      v-if="status === 'ACTIVE'"
      ref="voiceRef"
      :room-id="roomId"
      :identity="displayName"
      :ready="voiceReady"
      :send-signal="(payload) => sendVoice(roomId, payload)"
      :send-camera-signal="(payload) => sendCamera(roomId, payload)"
      :screen="screenState"
      :screen-frozen="isClosed"
      :board-open="boardOpen"
      :screen-open="screenOpen"
      :is-admin="store.isAdmin"
      @update:identity="displayName = $event"
      @toggle-board="toggleBoard"
      @toggle-screen="toggleScreen"
      @camera-tiles="cameraTiles = $event"
      @screen-quality="(q) => void screenRef?.setQuality?.(q)"
      @hangup="onHangup"
      @exit-tab="exitTab"
    >
      <template #invite>
        <div class="meet-invite">
          <p class="meet-label">{{ meetingText('meeting.invite') }}</p>
          <p v-if="inviteMembers.length === 0" class="meet-invite-hint">{{ meetingText('meeting.inviteEmpty') }}</p>
          <div class="meet-invite-grid">
            <button
              v-for="member in inviteMembers"
              :key="member.userId"
              type="button"
              class="invite-person"
              :class="{ 'is-pop': poppedId === member.userId }"
              :disabled="!!invitingId"
              @click="inviteOne(member.userId)"
            >
              <span class="invite-avatar">
                <img v-if="member.avatar" :src="member.avatar" :alt="member.label" />
                <span v-else>{{ getAvatarFallback(member.label) }}</span>
                <i class="invite-check" aria-hidden="true">✓</i>
              </span>
              <span class="invite-name">{{ member.label }}</span>
            </button>
          </div>
          <p v-if="inviteNote" class="meet-invite-hint">{{ inviteNote }}</p>
        </div>
      </template>
    </VoicePanel>

    <Teleport to="body">
      <div v-if="showCloseConfirm" class="end-overlay dark">
        <div class="end-dialog">
          <div class="end-icon">⚠</div>
          <h3 class="end-title">{{ t('room.closeConfirmTitle') }}</h3>
          <p class="end-desc">{{ t('room.closeConfirmDesc') }}</p>
          <p class="end-hint">{{ t('room.closeConfirmHint') }}</p>
          <div class="end-actions">
            <button class="end-btn end-btn-ghost" type="button" @click="showCloseConfirm = false">{{ t('room.cancel') }}</button>
            <button class="end-btn end-btn-primary" type="button" :disabled="closing" @click="onCloseConfirm">
              {{ closing ? t('room.confirming') : t('room.confirmClose') }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="showEnded" class="end-overlay dark">
        <div class="end-dialog end-dialog-info">
          <div class="end-icon">✓</div>
          <h3 class="end-title">{{ t('room.endTitle') }}</h3>
          <p class="end-desc">{{ t('room.endDesc') }}</p>
          <p class="end-hint">{{ t('room.endHint', { roomId }) }}</p>
          <div class="end-actions">
            <button class="end-btn end-btn-primary" type="button" @click="download">{{ t('room.downloadBoardImg') }}</button>
            <button class="end-btn end-btn-ghost" type="button" @click="leave">{{ t('room.exit') }}</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
