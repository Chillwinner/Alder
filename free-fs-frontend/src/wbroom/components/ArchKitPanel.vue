<script setup lang="ts">
import type { Editor } from 'tldraw'
import {
  ARCH_ITEMS,
  insertArchShape,
  insertArchTemplate,
  useElbowArrowTool,
  type ArchKind,
} from '../lib/archKit'
import { t } from '../i18n'
import { MatomoTracker } from '../lib/analytics'

const props = defineProps<{
  getEditor: () => Editor | null
  disabled?: boolean
}>()

function labelOf(kind: ArchKind) {
  return t(`kit.arch.${kind}`)
}

function insert(kind: ArchKind) {
  const editor = props.getEditor()
  if (!editor || props.disabled) return
  insertArchShape(editor, kind, labelOf(kind))
  MatomoTracker.trackEvent('Board', 'ArchStamp', kind)
}

function template() {
  const editor = props.getEditor()
  if (!editor || props.disabled) return
  const labels = Object.fromEntries(ARCH_ITEMS.map((item) => [item.id, labelOf(item.id)])) as Record<
    ArchKind,
    string
  >
  insertArchTemplate(editor, labels)
  MatomoTracker.trackEvent('Board', 'ArchTemplate')
}

function elbow() {
  const editor = props.getEditor()
  if (!editor || props.disabled) return
  useElbowArrowTool(editor)
  MatomoTracker.trackEvent('Board', 'ArchElbow')
}
</script>

<template>
  <aside class="arch-kit" :class="{ 'is-disabled': disabled }" :aria-label="t('kit.archTitle')">
    <div class="arch-kit-head">
      <span class="arch-kit-title">{{ t('kit.archTitle') }}</span>
      <p class="arch-kit-hint">{{ t('kit.archHint') }}</p>
    </div>
    <button class="arch-kit-template" type="button" :disabled="disabled" @click="template">
      {{ t('kit.archTemplate') }}
    </button>
    <button class="arch-kit-elbow" type="button" :disabled="disabled" @click="elbow">
      {{ t('kit.archElbow') }}
    </button>
    <div class="arch-kit-grid">
      <button
        v-for="item in ARCH_ITEMS"
        :key="item.id"
        type="button"
        class="arch-kit-item"
        :data-kind="item.id"
        :disabled="disabled"
        :title="labelOf(item.id)"
        @click="insert(item.id)"
      >
        <span class="arch-kit-glyph" :data-kind="item.id" aria-hidden="true">
          <svg v-if="item.id === 'gateway'" viewBox="0 0 28 20">
            <polygon
              points="8,2 20,2 26,10 20,18 8,18 2,10"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        <span>{{ labelOf(item.id) }}</span>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.arch-kit {
  position: absolute;
  top: 16px;
  left: 12px;
  z-index: 220;
  width: 168px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--glass-card-bg);
  box-shadow: var(--shadow-xl);
}

.arch-kit.is-disabled {
  opacity: 0.55;
  pointer-events: none;
}

.arch-kit-head {
  margin-bottom: 8px;
}

.arch-kit-title {
  display: block;
  color: var(--foreground);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.arch-kit-hint {
  margin: 3px 0 0;
  color: var(--muted-foreground);
  font-size: 11.5px;
  line-height: 1.35;
}

.arch-kit-template {
  width: 100%;
  margin-bottom: 8px;
  padding: 7px 8px;
  border: 0;
  border-radius: 8px;
  background: var(--primary);
  color: var(--primary-foreground);
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
  transition: background 0.15s, transform 0.15s;
}

.arch-kit-template:hover {
  background: var(--accent-hover);
}

.arch-kit-template:active {
  transform: scale(0.98);
}

.arch-kit-elbow {
  width: 100%;
  margin-bottom: 8px;
  padding: 7px 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-secondary);
  color: var(--foreground);
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, transform 0.15s;
}

.arch-kit-elbow:hover {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--primary-foreground);
}

.arch-kit-elbow:active {
  transform: scale(0.98);
}

.arch-kit-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.arch-kit-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 7px 4px 6px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-secondary);
  color: var(--foreground);
  font-size: 10.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.15s;
}

.arch-kit-item:hover {
  background: var(--surface-hover);
  border-color: color-mix(in srgb, var(--primary) 45%, transparent);
  color: var(--primary);
}

.arch-kit-item:active {
  transform: scale(0.97);
}

.arch-kit-glyph {
  width: 28px;
  height: 18px;
  border: 1.6px solid currentColor;
  opacity: 0.85;
}

/* 节点图例分类色 → chart token（双主题已配好） */
.arch-kit-glyph[data-kind='service'],
.arch-kit-glyph[data-kind='store'] {
  border-radius: 3px;
  color: var(--chart-1);
}

.arch-kit-glyph[data-kind='store'] {
  color: var(--chart-4);
}

.arch-kit-glyph[data-kind='gateway'] {
  width: 28px;
  height: 20px;
  border: none;
  color: var(--hud);
}

.arch-kit-glyph[data-kind='gateway'] svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.arch-kit-glyph[data-kind='db'],
.arch-kit-glyph[data-kind='user'] {
  border-radius: 50%;
  width: 20px;
  height: 20px;
  color: var(--chart-5);
}

.arch-kit-glyph[data-kind='user'] {
  color: var(--chart-2);
}

.arch-kit-glyph[data-kind='cache'] {
  width: 18px;
  height: 18px;
  transform: rotate(45deg);
  border-radius: 2px;
  color: var(--chart-3);
}

.arch-kit-glyph[data-kind='queue'] {
  width: 28px;
  height: 12px;
  border-radius: 2px;
  color: var(--chart-4);
}

.arch-kit-glyph[data-kind='cloud'] {
  border-radius: 10px 10px 6px 6px;
  color: var(--muted-foreground);
}

@media (max-width: 900px) {
  .arch-kit {
    top: max(8px, env(safe-area-inset-top));
    left: max(8px, env(safe-area-inset-left));
    width: 148px;
    padding: 8px;
  }
}
</style>
