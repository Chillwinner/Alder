import { computed, onUnmounted, ref, watch } from 'vue'

export type TimerState = {
  running: boolean
  durationMs: number
  endsAt: number | null
  pausedLeftMs: number | null
}

export type VoteState = {
  open: boolean
  question: string
  options: string[]
  ballots: Record<string, string>
  endsAt: number | null
}

const EMPTY_VOTE: VoteState = { open: false, question: '', options: [], ballots: {}, endsAt: null }

export function useRoomKit(opts: {
  peerId: string
  send: (payload: unknown) => void
  canSend: () => boolean
}) {
  const timer = ref<TimerState | null>(null)
  const vote = ref<VoteState>({ ...EMPTY_VOTE })
  const now = ref(Date.now())
  let tick = 0

  const remainingMs = computed(() => {
    const t = timer.value
    if (!t) return 0
    if (t.running && t.endsAt) return Math.max(0, t.endsAt - now.value)
    return Math.max(0, t.pausedLeftMs ?? t.durationMs ?? 0)
  })

  const remainingLabel = computed(() => formatMs(remainingMs.value))
  const timerDone = computed(() => !!timer.value && remainingMs.value <= 0)
  const voteRemainingMs = computed(() => {
    const endsAt = vote.value.endsAt
    if (!vote.value.open || !endsAt) return 0
    return Math.max(0, endsAt - now.value)
  })
  const voteRemainingLabel = computed(() => formatMs(voteRemainingMs.value))
  const voteExpired = computed(() => vote.value.open && !!vote.value.endsAt && voteRemainingMs.value <= 0)
  const myVote = computed(() => vote.value.ballots[opts.peerId] || '')
  const tally = computed(() => {
    const counts: Record<string, number> = {}
    for (const opt of vote.value.options) counts[opt] = 0
    let total = 0
    for (const choice of Object.values(vote.value.ballots)) {
      if (choice in counts) counts[choice] += 1
      total += 1
    }
    return { counts, total }
  })

  function startClock() {
    if (tick) return
    tick = window.setInterval(() => {
      now.value = Date.now()
    }, 250)
  }

  function applyKit(body: any) {
    if (!body) return
    if (body.timer) applyTimer(body.timer)
    if (body.vote) applyVote(body.vote)
  }

  function applyTimer(data: any) {
    if (!data || typeof data !== 'object') {
      timer.value = null
      return
    }
    timer.value = {
      running: !!data.running,
      durationMs: Number(data.durationMs) || 0,
      endsAt: data.endsAt == null ? null : Number(data.endsAt),
      pausedLeftMs: data.pausedLeftMs == null ? null : Number(data.pausedLeftMs),
    }
    if (timer.value.running) startClock()
  }

  function applyVote(data: any) {
    if (!data || typeof data !== 'object') {
      vote.value = { open: false, question: '', options: [], ballots: {}, endsAt: null }
      return
    }
    const options = Array.isArray(data.options)
      ? data.options.map((item: unknown) => String(item || '').trim()).filter(Boolean)
      : []
    const allowed = new Set(options)
    const ballots: Record<string, string> = {}
    if (data.ballots && typeof data.ballots === 'object') {
      for (const [id, choice] of Object.entries(data.ballots)) {
        const label = String(choice || '')
        if (allowed.has(label)) ballots[id] = label
      }
    }
    vote.value = {
      open: !!data.open,
      question: String(data.question || ''),
      options,
      ballots,
      endsAt: data.endsAt == null ? null : Number(data.endsAt),
    }
    if (vote.value.open && vote.value.endsAt) startClock()
  }

  function handleRemote(body: any) {
    if (body?.type === 'TIMER') applyTimer(body.data)
    if (body?.type === 'VOTE') applyVote(body.data)
  }

  function send(payload: unknown) {
    if (!opts.canSend()) return
    opts.send(payload)
  }

  function startTimer(durationMs: number) {
    send({ type: 'TIMER_START', durationMs })
  }
  function pauseTimer() {
    send({ type: 'TIMER_PAUSE' })
  }
  function resumeTimer() {
    send({ type: 'TIMER_RESUME' })
  }
  function resetTimer() {
    send({ type: 'TIMER_RESET' })
  }
  function startVote(question = '', options: string[] = []) {
    send({ type: 'VOTE_START', question, options })
  }
  function castVote(choice: string) {
    send({ type: 'VOTE_CAST', from: opts.peerId, choice })
  }
  function closeVote() {
    send({ type: 'VOTE_CLOSE' })
  }

  watch(voteExpired, (expired) => {
    if (expired) closeVote()
  })
  function clearVote() {
    send({ type: 'VOTE_CLEAR' })
  }

  onUnmounted(() => {
    if (tick) window.clearInterval(tick)
  })

  return {
    timer,
    vote,
    remainingMs,
    remainingLabel,
    timerDone,
    voteRemainingMs,
    voteRemainingLabel,
    voteExpired,
    myVote,
    tally,
    applyKit,
    handleRemote,
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    startVote,
    castVote,
    closeVote,
    clearVote,
  }
}

function formatMs(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}
