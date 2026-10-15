import type { Lang } from '../i18n'

/**
 * Site origin for canonical / OG / sitemap. Injected at build time from
 * site.config.env (SITE_DOMAIN) via VITE_SITE_URL; falls back to localhost so a
 * bare `npm run dev` / `npm run build` still works before a domain is picked.
 */
export const SITE_URL = (import.meta.env.VITE_SITE_URL || 'http://localhost').replace(/\/$/, '')

export const SITE_NAME = import.meta.env.VITE_SITE_NAME || 'wbroom'

/** BCP 47 tags for <html lang> and hreflang */
export const HTML_LANG: Record<Lang, string> = {
  en: 'en',
  zh: 'zh-CN',
  'zh-TW': 'zh-TW',
  ja: 'ja',
  ko: 'ko',
  de: 'de',
  fr: 'fr',
  ru: 'ru',
}

/** URL path segment per language (lowercase, SEO-friendly) */
export const LANG_PATH: Record<Lang, string> = {
  en: 'en',
  zh: 'zh',
  'zh-TW': 'zh-tw',
  ja: 'ja',
  ko: 'ko',
  de: 'de',
  fr: 'fr',
  ru: 'ru',
}

const PATH_TO_LANG = Object.fromEntries(
  Object.entries(LANG_PATH).map(([lang, path]) => [path, lang]),
) as Record<string, Lang>

export function langFromPath(segment: string | undefined | null): Lang | null {
  if (!segment) return null
  return PATH_TO_LANG[segment.toLowerCase()] ?? null
}

export type MarketingPage = 'home' | 'features' | 'guide' | 'blog'

export function homePath(lang: Lang): string {
  return `/${LANG_PATH[lang]}/`
}

export function featuresPath(lang: Lang): string {
  return `/${LANG_PATH[lang]}/features/`
}

export function guidePath(lang: Lang): string {
  return `/${LANG_PATH[lang]}/guide/`
}

export function blogPath(lang: Lang): string {
  return `/${LANG_PATH[lang]}/blog/`
}

export function blogArticlePath(lang: Lang, slug: string): string {
  return `/${LANG_PATH[lang]}/blog/${slug}/`
}

export function marketingPath(lang: Lang, page: MarketingPage): string {
  if (page === 'home') return homePath(lang)
  if (page === 'features') return featuresPath(lang)
  if (page === 'guide') return guidePath(lang)
  return blogPath(lang)
}

export function absoluteUrl(path: string): string {
  if (path.startsWith('http')) return path
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}
