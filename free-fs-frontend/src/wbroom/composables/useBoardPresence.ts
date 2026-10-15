import { onUnmounted, ref, unref, watch, type Ref } from 'vue'
import type { Editor } from 'tldraw'
import {
  colorFromPeerId,
  pushTrailPoint,
  shortPresenceName,
  type PeerTrail,
  type PresencePayload,
  type PresencePoint,
} from '../lib/presence'
import {
  applyRemotePresence,
  clearAllRemotePresence,
  parsePresenceBody,
  removeRemotePresence,
} from '../lib/tldrawPresence'

const SEND_MS = 50
const IDLE_MS = 8000

export function useBoardPresence(opts: {
  peerId: string
  name?: Ref<string> | string
  send: (payload: unknown) => void
  canSend: () => boolean
  onBoard: () => boolean
  trails: Ref<PeerTrail[]>
}) {
  function resolveName() {
    const raw = unref(opts.name)
    return (typeof raw === 'string' ? raw.trim() : '') || shortPresenceName(opts.peerId)
  }
  const name = resolveName()
  const color = colorFromPeerId(opts.peerId)

  let editor: Editor | null = null
  let localTrail: PresencePoint[] = []
  let sendTimer = 0
  let decayTimer = 0
  let lastMoveAt = 0
  let pending = false
  let attached = false
  const remotes = new Map<string, { trail: PresencePoint[]; color: string; at: number }>()
  let idleTimer = 0

  const selfName = ref(name)
  const selfColor = ref(color)

  function applyLocalName(next: string) {
    const resolved = next.trim() || shortPresenceName(opts.peerId)
    if (selfName.value === resolved) return
    selfName.value = resolved
    editor?.user.updateUserPreferences({
      name: resolved,
      color: selfColor.value,
      colorScheme: 'light',
    } as any)
    scheduleSend()
  }

  watch(
    () => unref(opts.name),
    (next) => {
      if (typeof next === 'string') applyLocalName(next)
    },
  )

  function publishTrails() {
    const list: PeerTrail[] = []
    for (const [peerId, row] of remotes) {
      if (row.trail.length > 1) list.push({ peerId, color: row.color, points: row.trail })
    }
    opts.trails.value = list
  }

  function flush() {
    sendTimer = 0
    if (!pending || !editor || !opts.canSend() || !opts.onBoard()) return
    pending = false
    const point = editor.inputs.currentPagePoint
    const instance = editor.getInstanceState()
    const brush = instance.brush
    const payload: PresencePayload = {
      type: 'PRESENCE',
      from: opts.peerId,
      name: selfName.value,
      color: selfColor.value,
      pageId: editor.getCurrentPageId(),
      cursor: {
        x: point.x,
        y: point.y,
        type: instance.cursor?.type || 'default',
        rotation: instance.cursor?.rotation || 0,
      },
      selectedShapeIds: editor.getSelectedShapeIds().slice(0, 24),
      brush: brush ? { x: brush.x, y: brush.y, w: brush.w, h: brush.h } : null,
      trail: localTrail,
    }
    opts.send(payload)
  }

  function scheduleSend() {
    if (!opts.canSend() || !opts.onBoard()) return
    pending = true
    if (sendTimer) return
    sendTimer = window.setTimeout(flush, SEND_MS)
  }

  function onPointerMove() {
    if (!editor || !opts.canSend() || !opts.onBoard()) return
    const p = editor.inputs.currentPagePoint
    lastMoveAt = Date.now()
    localTrail = pushTrailPoint(localTrail, { x: p.x, y: p.y })
    scheduleSend()
    startDecay()
  }

  function startDecay() {
    if (decayTimer) return
    decayTimer = window.setInterval(() => {
      if (!localTrail.length) {
        window.clearInterval(decayTimer)
        decayTimer = 0
        return
      }
      if (Date.now() - lastMoveAt < 70) return
      localTrail = localTrail.slice(1)
      scheduleSend()
    }, 40)
  }

  function onPointerLeave() {
    localTrail = []
    if (!editor || !opts.canSend()) return
    opts.send({
      type: 'PRESENCE',
      from: opts.peerId,
      name: selfName.value,
      color: selfColor.value,
      pageId: editor.getCurrentPageId(),
      cursor: null,
      selectedShapeIds: editor.getSelectedShapeIds().slice(0, 24),
      brush: null,
      trail: [],
    } satisfies PresencePayload)
  }

  function onSessionChange() {
    scheduleSend()
  }

  function attach(next: Editor) {
    detach()
    editor = next
    next.user.updateUserPreferences({
      name: selfName.value,
      color: selfColor.value,
      colorScheme: 'light',
    } as any)
    const el = next.getContainer()
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerleave', onPointerLeave)
    unlisten = next.store.listen(onSessionChange as any, { source: 'user', scope: 'session' })
    attached = true
  }

  let unlisten: (() => void) | undefined

  function detach() {
    if (editor && attached) {
      const el = editor.getContainer()
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerleave', onPointerLeave)
    }
    unlisten?.()
    unlisten = undefined
    attached = false
    editor = null
    localTrail = []
    if (sendTimer) {
      window.clearTimeout(sendTimer)
      sendTimer = 0
    }
    if (decayTimer) {
      window.clearInterval(decayTimer)
      decayTimer = 0
    }
  }

  function handleRemote(body: any) {
    if (!body?.from || body.from === opts.peerId) return
    if (body.type === 'PRESENCE_LEAVE') {
      remotes.delete(body.from)
      if (editor) removeRemotePresence(editor, body.from)
      publishTrails()
      return
    }
    const parsed = parsePresenceBody(body)
    if (!parsed || !editor) return
    applyRemotePresence(editor, parsed)
    remotes.set(parsed.from, { trail: parsed.trail, color: parsed.color, at: Date.now() })
    publishTrails()
    bumpIdleSweep()
  }

  function bumpIdleSweep() {
    if (idleTimer) return
    idleTimer = window.setTimeout(() => {
      idleTimer = 0
      const now = Date.now()
      let changed = false
      for (const [id, row] of remotes) {
        if (now - row.at > IDLE_MS) {
          remotes.delete(id)
          if (editor) removeRemotePresence(editor, id)
          changed = true
        }
      }
      if (changed) publishTrails()
      if (remotes.size) bumpIdleSweep()
    }, 2000)
  }

  function announceLeave() {
    opts.send({ type: 'PRESENCE_LEAVE', from: opts.peerId })
  }

  function leave() {
    announceLeave()
    remotes.clear()
    opts.trails.value = []
    if (editor) clearAllRemotePresence(editor)
    detach()
  }

  onUnmounted(() => {
    if (idleTimer) window.clearTimeout(idleTimer)
    leave()
  })

  return {
    selfName,
    selfColor,
    attach,
    detach,
    handleRemote,
    leave,
    announceLeave,
    scheduleSend,
  }
}
