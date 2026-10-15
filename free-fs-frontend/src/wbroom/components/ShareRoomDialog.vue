<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import QrcodeVue from 'qrcode.vue'
import { t } from '../i18n'

const props = defineProps<{
  roomId: string
}>()

const emit = defineEmits<{
  close: []
}>()

const copied = ref(true)
let copiedTimer = 0

const shareUrl = computed(() => {
  const path = `/room/${props.roomId}`
  if (typeof window === 'undefined') return path
  return `${window.location.origin}${path}`
})

async function copyLink() {
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    copied.value = true
    window.clearTimeout(copiedTimer)
    copiedTimer = window.setTimeout(() => {
      copied.value = false
    }, 4000)
    return true
  } catch {
    copied.value = false
    return false
  }
}

function close() {
  emit('close')
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

onMounted(() => {
  void copyLink()
  window.addEventListener('keydown', onKey)
})

onUnmounted(() => {
  window.clearTimeout(copiedTimer)
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <Teleport to="body">
    <div class="share-overlay" role="presentation" @click.self="close">
      <div class="share-dialog" role="dialog" aria-modal="true" :aria-label="t('room.shareRoom')">
        <header class="share-head">
          <div class="share-head-copy">
            <p class="share-kicker">{{ t('room.roomPrefix') }} {{ roomId }}</p>
            <h3 class="share-title">{{ t('room.shareRoom') }}</h3>
          </div>
          <button class="share-x" type="button" :aria-label="t('room.shareClose')" @click="close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
            </svg>
          </button>
        </header>

        <div class="share-body">
          <div class="share-qr-card">
            <div class="share-qr">
              <QrcodeVue
                :value="shareUrl"
                :size="168"
                level="M"
                render-as="svg"
                foreground="#1E293B"
                background="#ffffff"
              />
            </div>
            <p class="share-qr-hint">{{ t('room.shareScan') }}</p>
          </div>

          <button class="share-link" :class="{ 'is-copied': copied }" type="button" @click="copyLink">
            <span class="share-link-text">
              <span class="share-link-label">{{ copied ? t('room.shareCopied') : t('room.shareCopyAgain') }}</span>
              <code>{{ shareUrl }}</code>
            </span>
            <span class="share-link-icon" aria-hidden="true">
              <svg v-if="copied" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <rect x="8" y="8" width="12" height="12" rx="2" />
                <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
              </svg>
            </span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.share-overlay {
  position: fixed;
  inset: 0;
  z-index: 2400;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: color-mix(in srgb, var(--background) 68%, transparent);
  backdrop-filter: blur(14px) saturate(1.2);
}

.share-dialog {
  width: min(380px, 100%);
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--glass-card-bg);
  box-shadow: var(--shadow-xl);
  color: var(--foreground);
  animation: share-in 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes share-in {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.share-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 18px 16px;
  background: var(--accent-soft);
  border-bottom: 1px solid var(--border);
}

.share-kicker {
  margin: 0 0 4px;
  color: var(--primary);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-variant-numeric: tabular-nums;
}

.share-title {
  margin: 0;
  color: var(--foreground);
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.share-x {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--muted-foreground);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, transform 0.15s;
}

.share-x:hover {
  background: var(--surface-hover);
  color: var(--foreground);
}

.share-x:active {
  transform: scale(0.95);
}

.share-body {
  padding: 18px 18px 16px;
}

.share-qr-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 14px;
}

.share-qr {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.share-qr-hint {
  margin: 10px 0 0;
  color: var(--muted-foreground);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-align: center;
}

.share-link {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  margin-bottom: 0;
  padding: 10px 10px 10px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-secondary);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, transform 0.15s;
}

.share-link:hover {
  border-color: color-mix(in srgb, var(--primary) 45%, transparent);
  background: var(--surface-hover);
}

.share-link:active {
  transform: scale(0.99);
}

.share-link.is-copied {
  border-color: color-mix(in srgb, var(--success) 45%, transparent);
  background: color-mix(in srgb, var(--success) 10%, transparent);
}

.share-link-text {
  min-width: 0;
  flex: 1;
}

.share-link-label {
  display: block;
  margin-bottom: 2px;
  color: var(--success);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.share-link:not(.is-copied) .share-link-label {
  color: var(--muted-foreground);
}

.share-link-text code {
  display: block;
  overflow: hidden;
  color: var(--foreground);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.share-link-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--success);
  box-shadow: var(--shadow-xs);
}

.share-link:not(.is-copied) .share-link-icon {
  color: var(--primary);
}
</style>
