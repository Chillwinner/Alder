<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LANGS, lang, langLabel, setLang, type Lang } from '../i18n'
import { LANG_PATH, marketingPath, type MarketingPage } from '../seo/site'
import { MatomoTracker } from '../lib/analytics'

const open = ref(false)
const route = useRoute()
const router = useRouter()

function toggle() {
  open.value = !open.value
}

async function choose(next: Lang) {
  MatomoTracker.trackEvent('Settings', 'LanguageChange', next)
  setLang(next)
  open.value = false
  const page = (route.meta.page as MarketingPage | undefined) || null
  if (!page) return
  const target = marketingPath(next, page)
  if (route.path !== target) {
    await router.push(target)
  } else if (route.params.lang !== LANG_PATH[next]) {
    await router.push(target)
  }
}

function onDocClick(e: MouseEvent) {
  const el = e.target as HTMLElement | null
  if (!el?.closest('.lang-switch')) open.value = false
}

onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <div class="lang-switch">
    <button
      class="lang-btn"
      :class="{ open }"
      type="button"
      :aria-expanded="open"
      aria-haspopup="listbox"
      :aria-label="langLabel(lang)"
      @click.stop="toggle"
    >
      <svg class="lang-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
      </svg>
      <span>{{ langLabel(lang) }}</span>
      <svg class="lang-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
    <Transition name="pop">
      <div v-if="open" class="lang-menu" role="listbox" @click.stop>
        <button
          v-for="item in LANGS"
          :key="item.code"
          class="lang-option"
          :class="{ active: lang === item.code }"
          type="button"
          role="option"
          :aria-selected="lang === item.code"
          @click="choose(item.code)"
        >
          <span>{{ item.label }}</span>
          <svg
            v-if="lang === item.code"
            class="lang-check"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.lang-switch {
  position: relative;
}

.lang-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--foreground);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.15s;
}

.lang-btn:hover {
  background: var(--surface-hover);
  border-color: color-mix(in srgb, var(--primary) 45%, transparent);
  color: var(--primary);
}

.lang-btn:active {
  transform: scale(0.98);
}

.lang-btn.open {
  border-color: var(--primary);
  color: var(--primary);
}

.lang-icon {
  color: var(--primary);
  flex-shrink: 0;
}

.lang-chevron {
  transition: transform 0.15s;
}

.lang-btn.open .lang-chevron {
  transform: rotate(180deg);
}

.lang-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 60;
  min-width: 148px;
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--glass-card-bg);
  box-shadow: var(--shadow-lg);
}

.lang-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--foreground);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.lang-option:hover {
  background: var(--surface-hover);
}

.lang-option.active {
  color: var(--primary);
  font-weight: 650;
}

.lang-check {
  color: var(--primary);
  flex-shrink: 0;
}

.pop-enter-active,
.pop-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}

.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
