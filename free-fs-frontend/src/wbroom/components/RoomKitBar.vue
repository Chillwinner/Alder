<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { t } from '../i18n'
import type { useRoomKit } from '../composables/useRoomKit'

const props = defineProps<{
  kit: ReturnType<typeof useRoomKit>
  isAdmin?: boolean
  disabled?: boolean
}>()

type KitKind = 'timer' | 'vote'

const showTimerFab = computed(() => !!props.isAdmin)
const showVoteFab = computed(
  () => props.isAdmin || props.kit.vote.value.open || props.kit.tally.value.total > 0,
)
const showBar = computed(() => showTimerFab.value || showVoteFab.value)

const voteQuestion = ref('')
const voteOptions = ref(defaultVoteOptions())
const OPTION_MAX = 6

function defaultVoteOptions() {
  return [t('kit.voteYes'), t('kit.voteMaybe'), t('kit.voteNo')]
}

function resetVoteDraft() {
  voteQuestion.value = ''
  voteOptions.value = defaultVoteOptions()
}

function addVoteOption() {
  if (voteOptions.value.length >= OPTION_MAX) return
  voteOptions.value.push('')
}

function removeVoteOption(index: number) {
  if (voteOptions.value.length <= 2) return
  voteOptions.value.splice(index, 1)
}

function startVoteFromDraft() {
  const options = voteOptions.value.map((item) => item.trim()).filter(Boolean)
  if (options.length < 2) return
  props.kit.startVote(voteQuestion.value, options)
  resetVoteDraft()
}

const canStartVote = computed(() => {
  const options = voteOptions.value.map((item) => item.trim()).filter(Boolean)
  return !props.disabled && options.length >= 2
})

function optionMark(index: number) {
  return String.fromCharCode(65 + index)
}

function voteShare(opt: string) {
  const total = props.kit.tally.value.total
  if (!total) return 0
  return Math.round(((props.kit.tally.value.counts[opt] || 0) / total) * 100)
}

function isLeadOption(opt: string) {
  const total = props.kit.tally.value.total
  if (!total) return false
  const count = props.kit.tally.value.counts[opt] || 0
  if (!count) return false
  return props.kit.vote.value.options.every(
    (other) => other === opt || (props.kit.tally.value.counts[other] || 0) <= count,
  )
}
const WHEEL_ITEM = 28
const MINUTE_MAX = 180
const minutes = Array.from({ length: MINUTE_MAX + 1 }, (_, i) => i)
const seconds = Array.from({ length: 60 }, (_, i) => i)
const minWheelEl = ref<HTMLElement | null>(null)
const secWheelEl = ref<HTMLElement | null>(null)
const kitSlotReady = ref(false)
const timerOpen = ref(false)
const voteOpen = ref(false)

const timerLive = computed(() => !!props.kit.timer.value?.running)
const timerError = computed(() => props.kit.timerDone.value && !!props.kit.timer.value)
const voteLive = computed(() => props.kit.vote.value.open)

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function wheelIndex(el: HTMLElement | null, max: number) {
  if (!el) return 0
  return Math.min(max, Math.max(0, Math.round(el.scrollTop / WHEEL_ITEM)))
}

const pausedMidway = computed(() => {
  const timer = props.kit.timer.value
  if (!timer || timer.running || props.kit.timerDone.value) return false
  const left = timer.pausedLeftMs ?? timer.durationMs
  return left > 0 && left < timer.durationMs
})

function startOrResumeTimer() {
  if (props.disabled) return
  if (pausedMidway.value) {
    props.kit.resumeTimer()
    return
  }
  const ms = (wheelIndex(minWheelEl.value, MINUTE_MAX) * 60 + wheelIndex(secWheelEl.value, 59)) * 1000
  props.kit.startTimer(Math.max(10_000, ms))
}

async function setOpen(kind: KitKind, next: boolean) {
  if (kind === 'timer') {
    if (timerOpen.value === next) return
    timerOpen.value = next
    if (next) voteOpen.value = false
  } else {
    if (voteOpen.value === next) return
    voteOpen.value = next
    if (next) timerOpen.value = false
  }
  await nextTick()
  if (kind === 'timer' && next) {
    if (minWheelEl.value) minWheelEl.value.scrollTop = 5 * WHEEL_ITEM
    if (secWheelEl.value) secWheelEl.value.scrollTop = 0
  }
}

function toggleOpen(kind: KitKind) {
  void setOpen(kind, kind === 'timer' ? !timerOpen.value : !voteOpen.value)
}

watch(
  showTimerFab,
  (visible) => {
    if (!visible) timerOpen.value = false
  },
)

watch(
  showVoteFab,
  (visible) => {
    if (!visible) voteOpen.value = false
  },
)

watch(
  () => props.kit.vote.value.open,
  async (open) => {
    if (props.isAdmin || !open) return
    await setOpen('vote', true)
  },
  { immediate: true },
)

onMounted(async () => {
  for (let i = 0; i < 8 && !kitSlotReady.value; i++) {
    await nextTick()
    kitSlotReady.value = !!document.getElementById('board-kit-slot')
    if (!kitSlotReady.value) {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)))
    }
  }
})
</script>

<template>
  <Teleport v-if="kitSlotReady && showBar" to="#board-kit-slot">
    <button
      v-if="showTimerFab"
      class="kit-dock-btn"
      :class="{ 'is-on': timerOpen, 'is-live': timerLive, 'is-error': timerError }"
      type="button"
      :title="t('kit.timer')"
      :aria-label="t('kit.timer')"
      :aria-pressed="timerOpen"
      @click="toggleOpen('timer')"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8Zm.75-13h-1.5v6.2l5.1 3 .75-1.3-4.35-2.55Z" />
      </svg>
    </button>
    <button
      v-if="showVoteFab"
      class="kit-dock-btn"
      :class="{ 'is-on': voteOpen, 'is-live': voteLive }"
      type="button"
      :title="t('kit.vote')"
      :aria-label="t('kit.vote')"
      :aria-pressed="voteOpen"
      @click="toggleOpen('vote')"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
        <rect x="4" y="3.5" width="16" height="17" rx="2.2" />
        <path d="M8 8.5h8M8 12.5h8M8 16.5h5" stroke-linecap="round" />
      </svg>
    </button>
  </Teleport>

  <div v-if="showBar" class="room-kit">
    <div
      v-if="timerOpen"
      class="kit-pop kit-pop-dock"
      :class="{ 'is-disabled': disabled }"
      role="dialog"
      :aria-label="t('kit.timer')"
    >
        <header class="kit-pop-head">
          <span class="kit-pop-title">{{ t('kit.timer') }}</span>
          <button
            type="button"
            class="kit-close"
            :aria-label="t('kit.collapse')"
            @click="setOpen('timer', false)"
          >
            ×
          </button>
        </header>

        <section class="kit-card" :aria-label="t('kit.timer')">
          <div class="kit-row">
            <span class="kit-kicker">{{ t('kit.timer') }}</span>
            <strong class="kit-time" :class="{ 'is-done': kit.timerDone.value && kit.timer.value }">
              {{ kit.timer.value ? kit.remainingLabel.value : '–:––' }}
            </strong>
          </div>
          <template v-if="isAdmin">
            <div class="kit-wheels" role="group" :aria-label="t('kit.timer')">
              <div class="kit-wheel-col">
                <span class="kit-wheel-unit">{{ t('kit.timerUnitMin') }}</span>
                <div class="kit-wheel">
                  <div class="kit-wheel-highlight" aria-hidden="true" />
                  <div ref="minWheelEl" class="kit-wheel-list" @pointerdown.stop>
                    <div v-for="n in minutes" :key="`m-${n}`" class="kit-wheel-item">{{ pad2(n) }}</div>
                  </div>
                </div>
              </div>
              <div class="kit-wheel-sep" aria-hidden="true">:</div>
              <div class="kit-wheel-col">
                <span class="kit-wheel-unit">{{ t('kit.timerUnitSec') }}</span>
                <div class="kit-wheel">
                  <div class="kit-wheel-highlight" aria-hidden="true" />
                  <div ref="secWheelEl" class="kit-wheel-list" @pointerdown.stop>
                    <div v-for="n in seconds" :key="`s-${n}`" class="kit-wheel-item">{{ pad2(n) }}</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="kit-actions kit-timer-actions">
              <button
                v-if="kit.timer.value?.running"
                type="button"
                class="kit-btn kit-btn-pause"
                :disabled="disabled"
                @click="kit.pauseTimer()"
              >
                {{ t('kit.timerPause') }}
              </button>
              <button
                v-else
                type="button"
                class="kit-btn kit-btn-go"
                :disabled="disabled"
                @click="startOrResumeTimer"
              >
                {{ pausedMidway ? t('kit.timerResume') : t('kit.timerStart') }}
              </button>
              <button
                type="button"
                class="kit-btn kit-btn-reset"
                :disabled="disabled || !kit.timer.value"
                @click="kit.resetTimer()"
              >
                {{ t('kit.timerReset') }}
              </button>
            </div>
          </template>
        </section>
    </div>

    <div
      v-if="voteOpen"
      class="kit-pop kit-pop-dock"
      :class="{ 'is-disabled': disabled }"
      role="dialog"
      :aria-label="t('kit.vote')"
    >
        <header class="kit-pop-head">
          <span class="kit-pop-title">{{ t('kit.vote') }}</span>
          <button
            type="button"
            class="kit-close"
            :aria-label="t('kit.collapse')"
            @click="setOpen('vote', false)"
          >
            ×
          </button>
        </header>

        <section class="kit-card kit-vote-card" :aria-label="t('kit.vote')">
          <div class="kit-row">
            <span class="kit-kicker">{{ t('kit.vote') }}</span>
            <strong
              v-if="kit.vote.value.open"
              class="kit-vote-clock"
              :class="{ 'is-urgent': kit.voteRemainingMs.value <= 60_000 }"
            >
              {{ kit.voteRemainingLabel.value }}
            </strong>
            <span v-if="kit.vote.value.open" class="kit-pill is-live">{{ t('kit.voteOpen') }}</span>
            <span v-else-if="kit.tally.value.total" class="kit-pill">{{ t('kit.voteClosed') }}</span>
          </div>
          <p v-if="kit.vote.value.question" class="kit-q">{{ kit.vote.value.question }}</p>
          <template v-if="kit.vote.value.open || kit.tally.value.total">
            <div class="kit-choices">
              <button
                v-for="(opt, index) in kit.vote.value.options"
                :key="opt"
                type="button"
                class="kit-choice"
                :class="{
                  'is-mine': kit.myVote.value === opt,
                  'is-lead': isLeadOption(opt),
                }"
                :disabled="disabled || !kit.vote.value.open || kit.voteExpired.value"
                @click="kit.castVote(opt)"
              >
                <span class="kit-choice-bar" :style="{ width: `${voteShare(opt)}%` }" />
                <span class="kit-choice-mark">{{ optionMark(index) }}</span>
                <span class="kit-choice-label">{{ opt }}</span>
                <strong class="kit-choice-count">{{ kit.tally.value.counts[opt] || 0 }}</strong>
              </button>
            </div>
            <p class="kit-total">{{ t('kit.voteCount', { n: kit.tally.value.total }) }}</p>
          </template>
          <div v-if="isAdmin && !kit.vote.value.open" class="kit-editor">
            <label class="kit-field">
              <span>{{ t('kit.voteQuestionLabel') }}</span>
              <input
                v-model="voteQuestion"
                class="kit-input"
                type="text"
                maxlength="80"
                :disabled="disabled"
                :placeholder="t('kit.votePlaceholder')"
                @keydown.enter="startVoteFromDraft"
              />
            </label>
            <div class="kit-field">
              <span>{{ t('kit.voteOptionsLabel') }}</span>
              <div
                v-for="(_, index) in voteOptions"
                :key="index"
                class="kit-opt-row"
              >
                <span class="kit-choice-mark">{{ optionMark(index) }}</span>
                <input
                  v-model="voteOptions[index]"
                  class="kit-input"
                  type="text"
                  maxlength="24"
                  :disabled="disabled"
                  :placeholder="t('kit.voteOption', { n: index + 1 })"
                />
                <button
                  v-if="voteOptions.length > 2"
                  type="button"
                  class="kit-opt-del"
                  :disabled="disabled"
                  :aria-label="t('kit.voteRemoveOption')"
                  @click="removeVoteOption(index)"
                >
                  ×
                </button>
              </div>
              <button
                v-if="voteOptions.length < OPTION_MAX"
                type="button"
                class="kit-opt-add"
                :disabled="disabled"
                @click="addVoteOption"
              >
                + {{ t('kit.voteAddOption') }}
              </button>
            </div>
          </div>
          <div v-if="isAdmin" class="kit-actions kit-vote-actions">
            <button
              v-if="!kit.vote.value.open"
              type="button"
              class="kit-btn kit-btn-go"
              :disabled="!canStartVote"
              @click="startVoteFromDraft"
            >
              {{ kit.tally.value.total ? t('kit.voteNew') : t('kit.voteStart') }}
            </button>
            <button
              v-else
              type="button"
              class="kit-btn kit-btn-pause"
              :disabled="disabled"
              @click="kit.closeVote()"
            >
              {{ t('kit.voteClose') }}
            </button>
            <button
              v-if="kit.tally.value.total && !kit.vote.value.open"
              type="button"
              class="kit-btn kit-btn-reset"
              :disabled="disabled"
              @click="kit.clearVote()"
            >
              {{ t('kit.voteClear') }}
            </button>
          </div>
        </section>
    </div>
  </div>
</template>

<style scoped>
.room-kit {
  position: absolute;
  inset: 0;
  z-index: 310;
  pointer-events: none;
}

.kit-dock-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--foreground);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, transform 0.15s;
}

.kit-dock-btn:hover {
  background: var(--surface-hover);
  color: var(--primary);
}

.kit-dock-btn:active {
  transform: scale(0.96);
}

.kit-dock-btn.is-on,
.kit-dock-btn.is-live {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--primary-foreground);
}

.kit-dock-btn.is-error {
  background: color-mix(in srgb, var(--destructive) 18%, transparent);
  border-color: color-mix(in srgb, var(--destructive) 40%, transparent);
  color: var(--destructive);
}

@media (max-width: 900px) {
  .kit-dock-btn {
    width: 44px;
    height: 44px;
    border-radius: 12px;
  }
}

.kit-pop {
  width: 260px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--glass-card-bg);
  box-shadow: var(--shadow-xl);
  overflow: hidden;
  pointer-events: auto;
}

.kit-pop-dock {
  position: absolute;
  top: 12px;
  right: 72px;
  left: auto;
  bottom: auto;
  transform: none;
}

@media (max-width: 900px) {
  .kit-pop-dock {
    right: calc(max(10px, env(safe-area-inset-right)) + 60px);
    top: max(10px, env(safe-area-inset-top));
    transform: none;
  }
}

.kit-pop.is-disabled .kit-card {
  opacity: 0.55;
}

.kit-pop-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 8px 8px 10px;
  border-bottom: 1px solid var(--border);
}

.kit-pop-title {
  flex: 1;
  min-width: 0;
  color: var(--foreground);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.kit-close {
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--muted-foreground);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.kit-close:hover {
  background: var(--surface-hover);
  color: var(--foreground);
}

.kit-card {
  padding: 10px;
}

.kit-card + .kit-card {
  border-top: 1px solid var(--border);
}

.kit-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.kit-kicker {
  color: var(--muted-foreground);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.kit-time {
  color: var(--foreground);
  font-family: var(--font-mono);
  font-size: 20px;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
}

.kit-time.is-done {
  color: var(--destructive);
}

.kit-live,
.kit-pill {
  color: var(--success);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.kit-pill {
  padding: 2px 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--success) 14%, transparent);
}

.kit-pill:not(.is-live) {
  color: var(--muted-foreground);
  background: var(--surface-secondary);
}

.kit-vote-clock {
  margin-left: auto;
  margin-right: 6px;
  color: var(--foreground);
  font-family: var(--font-mono);
  font-size: 16px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.03em;
}

.kit-vote-clock.is-urgent {
  color: var(--destructive);
}

.kit-wheels {
  display: flex;
  align-items: stretch;
  gap: 6px;
  margin-top: 8px;
}

.kit-wheel-col {
  flex: 1;
  min-width: 0;
}

.kit-wheel-sep {
  display: flex;
  align-items: center;
  padding-top: 18px;
  color: var(--foreground);
  font-family: var(--font-mono);
  font-size: 18px;
  font-weight: 750;
}

.kit-wheel {
  position: relative;
  height: 84px;
  overflow: hidden;
  border-radius: 10px;
  background: var(--surface-secondary);
  border: 1px solid var(--border);
}

.kit-wheel-highlight {
  position: absolute;
  left: 4px;
  right: 4px;
  top: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--surface-hover);
  box-shadow: inset 0 0 0 1px var(--border);
  pointer-events: none;
}

.kit-wheel-list {
  position: relative;
  z-index: 1;
  height: 84px;
  overflow-y: scroll;
  overscroll-behavior: contain;
  scrollbar-width: none;
  padding: 28px 0;
  touch-action: pan-y;
  -webkit-overflow-scrolling: touch;
  mask-image: linear-gradient(to bottom, transparent, black 22%, black 78%, transparent);
}

.kit-wheel-list::-webkit-scrollbar {
  display: none;
}

.kit-wheel-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 28px;
  color: var(--foreground);
  font-family: var(--font-mono);
  font-size: 16px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
  user-select: none;
}

.kit-wheel-unit {
  display: block;
  margin-bottom: 4px;
  color: var(--muted-foreground);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-align: center;
  text-transform: uppercase;
}

.kit-actions,
.kit-votes {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.kit-timer-actions {
  flex-wrap: nowrap;
  gap: 8px;
  margin-top: 10px;
}

.kit-chip,
.kit-btn,
.kit-vote {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-secondary);
  color: var(--foreground);
  font-size: 11.5px;
  font-weight: 650;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, transform 0.15s;
}

.kit-chip {
  padding: 4px 7px;
}

.kit-btn {
  padding: 5px 8px;
}

.kit-btn-primary {
  background: var(--accent-soft);
  color: var(--primary);
}

.kit-chip:hover,
.kit-btn:hover,
.kit-vote:hover,
.kit-choice:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--primary);
}

.kit-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.kit-timer-actions .kit-btn {
  flex: 1;
  height: 36px;
  padding: 0 10px;
  border: 0;
  border-radius: 10px;
  color: var(--background);
  font-size: 14px;
  font-weight: 750;
}

.kit-timer-actions .kit-btn-go {
  background: var(--success);
  box-shadow: none;
}

.kit-timer-actions .kit-btn-go:hover:not(:disabled) {
  background: var(--success);
  filter: brightness(1.06);
  color: var(--background);
}

.kit-timer-actions .kit-btn-pause {
  background: var(--warning);
  box-shadow: none;
}

.kit-timer-actions .kit-btn-pause:hover:not(:disabled) {
  background: var(--warning);
  filter: brightness(1.06);
  color: var(--background);
}

.kit-timer-actions .kit-btn-reset {
  background: var(--destructive);
  box-shadow: none;
}

.kit-timer-actions .kit-btn-reset:hover:not(:disabled) {
  background: var(--destructive);
  filter: brightness(1.06);
  color: var(--background);
}

.kit-timer-actions .kit-btn:disabled,
.kit-vote-actions .kit-btn:disabled {
  opacity: 0.4;
  box-shadow: none;
  cursor: not-allowed;
}

.kit-vote-actions {
  flex-wrap: nowrap;
  gap: 8px;
  margin-top: 10px;
}

.kit-vote-actions .kit-btn {
  flex: 1;
  height: 36px;
  padding: 0 10px;
  border: 0;
  border-radius: 10px;
  color: var(--primary-foreground);
  font-size: 13px;
  font-weight: 750;
}

.kit-vote-actions .kit-btn-go {
  background: var(--primary);
  box-shadow: none;
}

.kit-vote-actions .kit-btn-go:hover:not(:disabled) {
  background: var(--accent-hover);
  color: var(--primary-foreground);
}

.kit-vote-actions .kit-btn-pause {
  background: var(--warning);
  box-shadow: none;
  color: var(--background);
}

.kit-vote-actions .kit-btn-pause:hover:not(:disabled) {
  background: var(--warning);
  filter: brightness(1.06);
  color: var(--background);
}

.kit-vote-actions .kit-btn-reset {
  background: var(--destructive);
  box-shadow: none;
  color: var(--destructive-foreground);
}

.kit-vote-actions .kit-btn-reset:hover:not(:disabled) {
  background: var(--destructive);
  filter: brightness(1.06);
  color: var(--destructive-foreground);
}

.kit-q {
  margin: 8px 0 0;
  color: var(--foreground);
  font-size: 14px;
  font-weight: 650;
  line-height: 1.35;
}

.kit-total {
  margin: 8px 0 0;
  color: var(--muted-foreground);
  font-family: var(--font-mono);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.kit-choices {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 10px;
}

.kit-choice {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 40px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-secondary);
  color: var(--foreground);
  text-align: left;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.kit-choice-bar {
  position: absolute;
  inset: 0 auto 0 0;
  background: color-mix(in srgb, var(--primary) 14%, transparent);
  pointer-events: none;
}

.kit-choice.is-lead .kit-choice-bar {
  background: color-mix(in srgb, var(--primary) 24%, transparent);
}

.kit-choice.is-mine {
  border-color: color-mix(in srgb, var(--primary) 50%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary) 20%, transparent);
}

.kit-choice:disabled {
  cursor: default;
}

.kit-choice-mark {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 7px;
  background: var(--surface-hover);
  color: var(--primary);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 800;
}

.kit-choice-label {
  position: relative;
  z-index: 1;
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kit-choice-count {
  position: relative;
  z-index: 1;
  color: var(--foreground);
  font-family: var(--font-mono);
  font-size: 15px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.kit-editor {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
}

.kit-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.kit-field > span {
  color: var(--muted-foreground);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.kit-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-secondary);
  color: var(--foreground);
  font-size: 13px;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
}

.kit-input:focus {
  outline: none;
  background: var(--surface);
  border-color: var(--primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 30%, transparent);
}

.kit-opt-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.kit-opt-row .kit-input {
  flex: 1;
}

.kit-opt-del {
  flex-shrink: 0;
  width: 28px;
  height: 32px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-secondary);
  color: var(--muted-foreground);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.kit-opt-del:hover:not(:disabled) {
  background: color-mix(in srgb, var(--destructive) 18%, transparent);
  border-color: color-mix(in srgb, var(--destructive) 40%, transparent);
  color: var(--destructive);
}

.kit-opt-add {
  width: 100%;
  margin-top: 2px;
  padding: 8px;
  border: 1px dashed color-mix(in srgb, var(--primary) 50%, transparent);
  border-radius: 10px;
  background: transparent;
  color: var(--primary);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
}

.kit-opt-add:hover:not(:disabled) {
  background: var(--accent-soft);
}
</style>
