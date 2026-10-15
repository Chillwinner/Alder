import { computed, ref } from 'vue'
import messages from './messages.json'
import { HTML_LANG, LANG_PATH, langFromPath } from '../seo/site'

export type Lang = 'zh' | 'zh-TW' | 'en' | 'ja' | 'ko' | 'de' | 'fr' | 'ru'

export const LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'ru', label: 'Русский' },
]

const LANG_SET = new Set<string>(LANGS.map((l) => l.code))

const LANG_KEY = 'app_lang'

/** tldraw built-in locale codes */
export function tldrawLocale(l: Lang): string {
  const map: Record<Lang, string> = {
    zh: 'zh-cn',
    'zh-TW': 'zh-tw',
    en: 'en',
    ja: 'ja',
    ko: 'ko-kr',
    de: 'de',
    fr: 'fr',
    ru: 'ru',
  }
  return map[l]
}

export function langLabel(l: Lang): string {
  return LANGS.find((x) => x.code === l)?.label ?? l
}

export function isLang(value: string | undefined | null): value is Lang {
  return !!value && LANG_SET.has(value)
}

function browserLang(): Lang | null {
  if (typeof navigator === 'undefined') return null
  const candidates = [...(navigator.languages || []), navigator.language].filter(Boolean)
  for (const raw of candidates) {
    const lower = raw.toLowerCase()
    if (lower.startsWith('zh-tw') || lower.startsWith('zh-hk') || lower.startsWith('zh-hant')) {
      return 'zh-TW'
    }
    if (lower.startsWith('zh')) return 'zh'
    const primary = lower.split('-')[0]
    const hit = LANGS.find((l) => l.code === primary || LANG_PATH[l.code] === primary)
    if (hit) return hit.code
    const fromPath = langFromPath(primary)
    if (fromPath) return fromPath
  }
  return null
}

function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved && LANG_SET.has(saved)) return saved as Lang
  } catch {
    /* private mode */
  }
  return browserLang() || 'en'
}

export const lang = ref<Lang>(detectLang())

export function setLang(next: Lang) {
  lang.value = next
  try {
    localStorage.setItem(LANG_KEY, next)
  } catch {
    /* ignore */
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = HTML_LANG[next]
  }
}

function lookup(dict: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as object)) {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, dict)
}

export function t(key: string, params?: Record<string, string | number>): string {
  const dict = messages[lang.value] as Record<string, unknown> | undefined
  const fallback = messages.en as Record<string, unknown>
  const value = lookup(dict ?? fallback, key) ?? lookup(fallback, key)
  let text = typeof value === 'string' ? value : key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, String(v))
    }
  }
  return text
}

/** Read nested message for a specific language (prerender / SEO helpers) */
export function tFor(l: Lang, key: string): string {
  const dict = messages[l] as Record<string, unknown> | undefined
  const fallback = messages.en as Record<string, unknown>
  const value = lookup(dict ?? fallback, key) ?? lookup(fallback, key)
  return typeof value === 'string' ? value : key
}

export const tt = computed(() => t)

// Apply initial lang to <html> as early as possible
if (typeof document !== 'undefined') {
  document.documentElement.lang = HTML_LANG[lang.value]
}
