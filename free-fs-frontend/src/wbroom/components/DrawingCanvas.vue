<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createRoot, type Root } from 'react-dom/client'
import React, { useCallback, useEffect } from 'react'
import { Tldraw, type Editor } from 'tldraw'
import ArchKitPanel from './ArchKitPanel.vue'
import { preferElbowArrows } from '../lib/archKit'
import { lang, t, tldrawLocale } from '../i18n'
import { MatomoTracker } from '../lib/analytics'
import type { PeerTrail } from '../lib/presence'
import { asPngBlob, downloadBlob } from '../lib/download'
import { isClearableRecord } from '../lib/tldrawSync'

const props = defineProps<{
  viewMode?: boolean
  trails?: PeerTrail[]
}>()

const emit = defineEmits<{
  apiReady: [editor: Editor]
  clearBoard: []
}>()

const host = ref<HTMLDivElement | null>(null)
const wrap = ref<HTMLDivElement | null>(null)
const historyBar = ref<HTMLDivElement | null>(null)
const archKitOpen = ref(true)
let root: Root | null = null
let editor: Editor | null = null
let trailRaf = 0
let railObserver: ResizeObserver | null = null

function syncRailOffset() {
  const bar = historyBar.value
  const shell = wrap.value
  if (!shell) return
  const gap = 8
  const top = bar ? bar.offsetTop + bar.offsetHeight + gap : 12
  shell.style.setProperty('--board-tools-top', `${top}px`)
}

type ScreenSeg = { points: string; opacity: number; width: number }
type ScreenTrail = { peerId: string; color: string; segs: ScreenSeg[] }
const screenTrails = ref<ScreenTrail[]>([])

function pageToLocal(ed: Editor, x: number, y: number) {
  const screen = ed.pageToScreen({ x, y })
  const box = host.value?.getBoundingClientRect()
  if (!box) return { x: screen.x, y: screen.y }
  return { x: screen.x - box.left, y: screen.y - box.top }
}

function paintTrails() {
  trailRaf = 0
  const ed = editor
  const list = props.trails || []
  if (!ed || !list.length) {
    if (screenTrails.value.length) screenTrails.value = []
    return
  }
  const next: ScreenTrail[] = []
  for (const trail of list) {
    if (trail.points.length < 2) continue
    const segs: ScreenSeg[] = []
    const n = trail.points.length - 1
    for (let i = 0; i < n; i++) {
      const a = pageToLocal(ed, trail.points[i].x, trail.points[i].y)
      const b = pageToLocal(ed, trail.points[i + 1].x, trail.points[i + 1].y)
      const fade = (i + 1) / n
      segs.push({
        points: `${a.x},${a.y} ${b.x},${b.y}`,
        opacity: 0.08 + fade * 0.32,
        width: 1.1 + fade * 1.4,
      })
    }
    next.push({ peerId: trail.peerId, color: trail.color, segs })
  }
  screenTrails.value = next
  trailRaf = requestAnimationFrame(paintTrails)
}

function startTrailLoop() {
  if (trailRaf) return
  trailRaf = requestAnimationFrame(paintTrails)
}

function onClearClick() {
  if (props.viewMode) return
  emit('clearBoard')
}

function onUndoClick() {
  if (props.viewMode) return
  editor?.undo()
  MatomoTracker.trackEvent('Board', 'Undo')
}

function onRedoClick() {
  if (props.viewMode) return
  editor?.redo()
  MatomoTracker.trackEvent('Board', 'Redo')
}

function onArchKitToggle() {
  if (props.viewMode) return
  archKitOpen.value = !archKitOpen.value
  MatomoTracker.trackEvent('Board', archKitOpen.value ? 'ArchKitShow' : 'ArchKitHide')
}

function applyReadonly(ed: Editor, readonly: boolean) {
  ed.updateInstanceState({ isReadonly: readonly })
}

function applyLocale(ed: Editor, code: string) {
  ed.user.updateUserPreferences({ locale: code as any, colorScheme: 'dark' })
}

function applyBoardChrome(ed: Editor) {
  ed.updateInstanceState({ isGridMode: true })
}

function SmallCollaboratorCursor(p: {
  className?: string
  zoom: number
  point: { x: number; y: number } | null
  color?: string
  name: string | null
  chatMessage?: string
}) {
  if (!p.point) return null
  const zoom = p.zoom || 1
  return React.createElement(
    'div',
    {
      className: `tl-overlays__item wb-collab ${p.className || ''}`,
      style: {
        transform: `translate(${p.point.x}px, ${p.point.y}px) scale(${1 / zoom})`,
        transformOrigin: 'top left',
        pointerEvents: 'none',
      },
    },
    React.createElement(
      'svg',
      { width: 11, height: 15, viewBox: '0 0 11 15', className: 'wb-collab-pointer', 'aria-hidden': true },
      React.createElement('path', {
        d: 'M1.2 1.2v11.2l3.1-2.6 2.4 4.4 1.5-.8-2.4-4.3H10.4z',
        fill: p.color || '#5E6E84',
        stroke: '#fff',
        strokeWidth: 0.75,
        strokeLinejoin: 'round',
      }),
    ),
    p.name
      ? React.createElement(
          'span',
          { className: 'wb-collab-name', style: { backgroundColor: p.color } },
          p.name,
        )
      : null,
  )
}

function BoardApp(boardProps: { viewMode: boolean; locale: string }) {
  const handleMount = useCallback((ed: Editor) => {
    editor = ed
    applyLocale(ed, boardProps.locale)
    applyBoardChrome(ed)
    applyReadonly(ed, boardProps.viewMode)
    preferElbowArrows(ed)
    if (!boardProps.viewMode) ed.setCurrentTool('hand')
    emit('apiReady', ed)
    if (props.trails?.length) startTrailLoop()
  }, [])

  useEffect(() => {
    if (!editor) return
    applyReadonly(editor, boardProps.viewMode)
    if (!boardProps.viewMode) editor.setCurrentTool('hand')
  }, [boardProps.viewMode])

  useEffect(() => {
    if (!editor) return
    applyLocale(editor, boardProps.locale)
  }, [boardProps.locale])

  return React.createElement(
    'div',
    { className: 'tldraw-host', style: { width: '100%', height: '100%' } },
    React.createElement(Tldraw as any, {
      inferDarkMode: false,
      onMount: handleMount,
      options: { maxPages: 1 },
      components: {
        SharePanel: null,
        QuickActions: null,
        ActionsMenu: null,
        NavigationPanel: null,
        Minimap: null,
        MenuPanel: null,
        MainMenu: null,
        PageMenu: null,
        CollaboratorCursor: SmallCollaboratorCursor,
      },
    }),
  )
}

function render() {
  if (!host.value) return
  if (!root) root = createRoot(host.value)
  root.render(
    React.createElement(BoardApp, {
      viewMode: !!props.viewMode,
      locale: tldrawLocale(lang.value),
    }),
  )
}

watch(
  () => props.viewMode,
  (v) => {
    if (editor) applyReadonly(editor, !!v)
    else render()
  },
)

watch(lang, (l) => {
  if (editor) applyLocale(editor, tldrawLocale(l))
  else render()
})

watch(
  () => props.trails,
  (list) => {
    if (list?.length) startTrailLoop()
    else {
      if (trailRaf) cancelAnimationFrame(trailRaf)
      trailRaf = 0
      screenTrails.value = []
    }
  },
)

function bindRailObserver() {
  railObserver?.disconnect()
  if (typeof ResizeObserver !== 'undefined') {
    railObserver = new ResizeObserver(syncRailOffset)
    if (historyBar.value) railObserver.observe(historyBar.value)
  }
  syncRailOffset()
}

onMounted(() => {
  render()
  bindRailObserver()
})
onBeforeUnmount(() => {
  if (trailRaf) cancelAnimationFrame(trailRaf)
  trailRaf = 0
  railObserver?.disconnect()
  railObserver = null
  root?.unmount()
  root = null
  editor = null
})

watch(historyBar, bindRailObserver)

async function exportPngBlob(): Promise<Blob | null> {
  if (!editor) throw new Error('not ready')
  const ids = [...editor.getCurrentPageShapeIds()]
  if (!ids.length) return null
  const { blob } = await editor.toImage(ids, {
    format: 'png',
    background: true,
    padding: 32,
  })
  return asPngBlob(blob)
}

async function exportPng(roomId: string) {
  const blob = await exportPngBlob()
  if (!blob) return null
  downloadBlob(blob, `whiteboard-${roomId}.png`)
  return blob
}

function applyClearedScene() {
  if (!editor) return
  const ids: string[] = []
  for (const record of editor.store.allRecords()) {
    if (isClearableRecord(record)) ids.push(record.id)
  }
  if (!ids.length) return
  editor.store.mergeRemoteChanges(() => {
    editor!.store.remove(ids as any)
  })
  editor.clearHistory()
}

defineExpose({
  exportPng,
  exportPngBlob,
  getApi: () => editor,
  applyClearedScene,
})
</script>

<template>
  <div class="drawing-canvas-wrap" ref="wrap">
    <div class="drawing-canvas" ref="host" />
    <svg v-if="screenTrails.length" class="presence-trails" aria-hidden="true">
      <g v-for="trail in screenTrails" :key="trail.peerId">
        <polyline
          v-for="(seg, i) in trail.segs"
          :key="i"
          :points="seg.points"
          :stroke="trail.color"
          :stroke-opacity="seg.opacity"
          :stroke-width="seg.width"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </g>
    </svg>
    <div
      v-if="!viewMode"
      ref="historyBar"
      class="board-history-bar"
      role="toolbar"
      :aria-label="t('room.clearBoard')"
    >
      <button
        type="button"
        class="board-tool-btn board-clear-btn"
        :title="t('room.clearBoard')"
        :aria-label="t('room.clearBoard')"
        @click="onClearClick"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M10 11v6M14 11v6" stroke-linecap="round" />
        </svg>
      </button>
      <button
        type="button"
        class="board-tool-btn"
        :title="t('room.undo')"
        :aria-label="t('room.undo')"
        @click="onUndoClick"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <path d="M9 14 4 9l5-5" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M4 9h10a6 6 0 0 1 0 12h-3" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <button
        type="button"
        class="board-tool-btn"
        :title="t('room.redo')"
        :aria-label="t('room.redo')"
        @click="onRedoClick"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <path d="m15 14 5-5-5-5" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M20 9H10a6 6 0 0 0 0 12h3" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <button
        type="button"
        class="board-tool-btn"
        :class="{ 'is-on': archKitOpen }"
        :title="t('kit.archTitle')"
        :aria-label="t('kit.archTitle')"
        :aria-pressed="archKitOpen"
        @click="onArchKitToggle"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <rect x="8" y="2.5" width="8" height="5.5" rx="1.2" />
          <rect x="2" y="16" width="8" height="5.5" rx="1.2" />
          <rect x="14" y="16" width="8" height="5.5" rx="1.2" />
          <path d="M12 8v3.2M12 11.2H6v4.8M12 11.2h6v4.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <div id="board-kit-slot" class="board-kit-slot" />
    </div>
    <ArchKitPanel
      v-if="archKitOpen && !viewMode"
      :get-editor="() => editor"
      :disabled="!!viewMode"
    />
  </div>
</template>

<style scoped>
.drawing-canvas-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  --board-rail-right: 12px;
  --board-rail-top: 12px;
  --board-tools-top: 300px;
  /* tldraw 强制暗色，画板底固定深空系 */
  background: #0a0f18;
}

.presence-trails {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 80;
  overflow: visible;
}

.drawing-canvas :deep(.wb-collab) {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1000;
}

.drawing-canvas :deep(.wb-collab-pointer) {
  display: block;
  overflow: visible;
}

.drawing-canvas :deep(.wb-collab-name) {
  position: absolute;
  top: 12px;
  left: 8px;
  color: #e9eff7;
  font-family: var(--font-mono);
  font-size: 9px;
  line-height: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  padding: 0 4px;
  border-radius: 3px;
  max-width: 96px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.9;
}

.drawing-canvas {
  width: 100%;
  height: 100%;
}

.drawing-canvas :deep(.tldraw-host),
.drawing-canvas :deep(.tl-container) {
  width: 100%;
  height: 100%;
}

.drawing-canvas :deep(.tlui-navigation-panel),
.drawing-canvas :deep(.tlui-zoom-menu__button),
.drawing-canvas :deep([data-testid="minimap.toggle-button"]),
.drawing-canvas :deep([data-testid="minimap.zoom-menu-button"]) {
  display: none !important;
}

/* 工具栏：画板最右侧竖列，紧挨历史栏下方 */
.drawing-canvas :deep(.tlui-layout__bottom) {
  position: absolute !important;
  grid-area: unset !important;
  top: var(--board-tools-top, 300px) !important;
  right: var(--board-rail-right, 12px) !important;
  bottom: auto !important;
  left: auto !important;
  width: max-content !important;
  max-width: 72px !important;
  height: auto !important;
  max-height: none;
  transform: none;
  display: flex !important;
  justify-content: flex-start !important;
  align-items: flex-end !important;
}

.drawing-canvas :deep(.tlui-layout__bottom__main),
.drawing-canvas :deep(.tlui-toolbar),
.drawing-canvas :deep(.tlui-toolbar__inner),
.drawing-canvas :deep(.tlui-toolbar__left),
.drawing-canvas :deep(.tlui-toolbar__tools),
.drawing-canvas :deep(.tlui-toolbar-container),
.drawing-canvas :deep(.tlui-toolbar__tools__list) {
  flex-direction: column !important;
  align-items: center !important;
  flex-wrap: nowrap !important;
  width: auto !important;
  height: auto !important;
}

.drawing-canvas :deep(.tlui-toolbar__inner),
.drawing-canvas :deep(.tlui-toolbar__tools),
.drawing-canvas :deep(.tlui-toolbar__tools__list) {
  max-height: none;
  overflow: visible;
  scrollbar-width: none;
}

.drawing-canvas :deep(.tlui-toolbar__inner::-webkit-scrollbar),
.drawing-canvas :deep(.tlui-toolbar__tools::-webkit-scrollbar),
.drawing-canvas :deep(.tlui-toolbar__tools__list::-webkit-scrollbar) {
  display: none;
}

.drawing-canvas :deep(.tlui-toolbar__left) {
  width: auto !important;
}

.board-history-bar,
.board-kit-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.board-history-bar {
  position: absolute;
  top: var(--board-rail-top);
  right: var(--board-rail-right);
  left: auto;
  bottom: auto;
  z-index: 300;
  padding: 6px 4px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 10px;
  background: rgba(16, 22, 34, 0.88);
  box-shadow: var(--shadow-lg);
  color: #d7e4f4;
}

@media (max-width: 900px) {
  .drawing-canvas-wrap {
    --board-rail-right: max(10px, env(safe-area-inset-right));
    --board-rail-top: max(10px, env(safe-area-inset-top));
  }

  .board-tool-btn {
    width: 40px;
    height: 40px;
    border-radius: 10px;
  }
}

.board-tool-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #d7e4f4;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, transform 0.15s;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.board-tool-btn svg {
  display: block;
  stroke: currentColor;
  fill: none;
}

.board-tool-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #8cb8ff;
}

.board-tool-btn:active {
  transform: scale(0.96);
}

.board-tool-btn.is-on {
  background: var(--primary);
  color: var(--primary-foreground);
}

.board-clear-btn:hover {
  background: color-mix(in srgb, var(--destructive) 16%, transparent);
  color: var(--destructive);
}
</style>
