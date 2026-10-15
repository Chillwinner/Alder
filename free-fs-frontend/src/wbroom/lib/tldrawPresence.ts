import {
  InstancePresenceRecordType,
  type Editor,
  type TLPageId,
  type TLShapeId,
} from 'tldraw'
import type { PresenceBrush, PresenceCursor, PresencePayload } from './presence'
import { sanitizeBrush, sanitizeSelectedIds, sanitizeTrail } from './presence'

export function presenceRecordId(peerId: string) {
  return InstancePresenceRecordType.createId(peerId)
}

function cursorType(type: string): PresenceCursor['type'] {
  return type || 'default'
}

export function applyRemotePresence(editor: Editor, body: PresencePayload) {
  const pageId = (body.pageId || editor.getCurrentPageId()) as TLPageId
  const known = editor.getPages().some((p) => p.id === pageId)
  const cursor = body.cursor
    ? {
        x: body.cursor.x,
        y: body.cursor.y,
        type: cursorType(body.cursor.type) as any,
        rotation: Number(body.cursor.rotation) || 0,
      }
    : null

  const record = InstancePresenceRecordType.create({
    id: presenceRecordId(body.from),
    userId: body.from,
    userName: (body.name || shortFallback(body.from)).slice(0, 24),
    color: body.color,
    currentPageId: known ? pageId : editor.getCurrentPageId(),
    cursor,
    selectedShapeIds: sanitizeSelectedIds(body.selectedShapeIds) as TLShapeId[],
    brush: sanitizeBrush(body.brush),
    scribbles: [],
    lastActivityTimestamp: Date.now(),
    chatMessage: '',
    camera: null,
    screenBounds: null,
    followingUserId: null,
    meta: {},
  })

  editor.store.mergeRemoteChanges(() => {
    editor.store.put([record])
  })
}

export function removeRemotePresence(editor: Editor, peerId: string) {
  const id = presenceRecordId(peerId)
  if (!editor.store.has(id)) return
  editor.store.mergeRemoteChanges(() => {
    editor.store.remove([id])
  })
}

export function clearAllRemotePresence(editor: Editor) {
  const ids = editor.store
    .allRecords()
    .filter((r) => r.typeName === 'instance_presence')
    .map((r) => r.id)
  if (!ids.length) return
  editor.store.mergeRemoteChanges(() => {
    editor.store.remove(ids as any)
  })
}

export function parsePresenceBody(body: any): PresencePayload | null {
  if (!body || body.type !== 'PRESENCE' || typeof body.from !== 'string' || !body.from) {
    return null
  }
  const cursor = body.cursor && typeof body.cursor === 'object'
    ? {
        x: Number(body.cursor.x),
        y: Number(body.cursor.y),
        type: String(body.cursor.type || 'default'),
        rotation: Number(body.cursor.rotation) || 0,
      }
    : null
  if (cursor && (!Number.isFinite(cursor.x) || !Number.isFinite(cursor.y))) {
    return null
  }
  return {
    type: 'PRESENCE',
    from: body.from,
    name: String(body.name || shortFallback(body.from)).slice(0, 24),
    color: typeof body.color === 'string' && body.color.startsWith('#') ? body.color : '#5E6E84',
    pageId: String(body.pageId || ''),
    cursor,
    selectedShapeIds: sanitizeSelectedIds(body.selectedShapeIds),
    brush: sanitizeBrush(body.brush) as PresenceBrush | null,
    trail: sanitizeTrail(body.trail),
  }
}

function shortFallback(peerId: string) {
  return peerId.replace(/^u-/, '').slice(-4).toUpperCase() || 'ME'
}
