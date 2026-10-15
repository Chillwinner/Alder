import { onMounted, onUnmounted, onUpdated } from 'vue'

/**
 * Toggle `.is-in` as sections enter and leave the viewport.
 * Scroll-up removes the class so motion reverses. No scroll listeners.
 */
export function useScrollMotion() {
  let io: IntersectionObserver | null = null

  function observe() {
    if (!io) return
    document.querySelectorAll('[data-reveal]').forEach((el) => io?.observe(el))
  }

  onMounted(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    document.documentElement.classList.add('js-motion')
    io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          entry.target.classList.toggle('is-in', entry.isIntersecting)
        }
      },
      { threshold: 0.16, rootMargin: '0px 0px -10% 0px' },
    )
    observe()
  })

  onUpdated(observe)

  onUnmounted(() => {
    io?.disconnect()
    io = null
  })
}
