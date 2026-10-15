<script setup lang="ts">
import { nextTick, onBeforeUnmount, watch } from 'vue'
import { t } from '../i18n'
import './CameraOverlay.css'

export type OverlayTile = {
  peerId: string
  name: string
  isLocal: boolean
  stream: MediaStream | null
}

const props = defineProps<{
  tiles: OverlayTile[]
  stage?: boolean
}>()

const videoEls: Record<string, HTMLVideoElement | null> = {}

function setVideoEl(peerId: string, el: HTMLVideoElement | null) {
  if (el) videoEls[peerId] = el
  else delete videoEls[peerId]
}

function bindTile(tile: OverlayTile) {
  const el = videoEls[tile.peerId]
  if (!el) return
  if (tile.stream) {
    if (el.srcObject !== tile.stream) el.srcObject = tile.stream
    void el.play().catch(() => {})
  } else {
    el.srcObject = null
  }
}

watch(
  () => props.tiles.map((x) => `${x.peerId}:${x.stream?.id ?? 'none'}:${x.name}`).join('|'),
  async () => {
    await nextTick()
    for (const tile of props.tiles) bindTile(tile)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  for (const el of Object.values(videoEls)) {
    if (el) el.srcObject = null
  }
})
</script>

<template>
  <aside
    class="camera-rail"
    :class="{ 'is-stage': stage && tiles.length > 0, 'is-empty': !tiles.length }"
    :data-count="tiles.length > 6 ? 'many' : tiles.length"
    role="region"
    :aria-label="t('voice.cameraOverlay')"
  >
    <div v-if="!tiles.length" class="camera-empty">
      <div class="camera-empty-mark" aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M17 10.5V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3.5l4 3.5V7l-4 3.5Z" stroke-linejoin="round" />
        </svg>
      </div>
      <h3>{{ t('voice.cameraNobody') }}</h3>
      <p>{{ t('voice.cameraNobodyHint') }}</p>
    </div>
    <div
      v-for="tile in tiles"
      :key="tile.peerId"
      class="camera-tile"
      :class="{ 'is-local': tile.isLocal, 'is-waiting': !tile.stream }"
    >
      <video
        :ref="(el) => setVideoEl(tile.peerId, el as HTMLVideoElement | null)"
        class="camera-video"
        :class="{ mirror: tile.isLocal }"
        autoplay
        playsinline
        muted
      />
      <div v-if="!tile.stream" class="camera-placeholder">
        <span class="camera-avatar">{{ (tile.name || '?').slice(0, 1).toUpperCase() }}</span>
      </div>
      <div class="camera-label">
        <span class="camera-name">{{ tile.name }}</span>
        <span v-if="tile.isLocal" class="camera-me">{{ t('voice.me') }}</span>
      </div>
    </div>
  </aside>
</template>
