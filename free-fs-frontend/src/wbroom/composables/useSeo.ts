import { watch } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { getArticle, listArticles, pickHubMeta, pickLocaleBlock } from '../content'
import {
  HTML_LANG,
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
  blogArticlePath,
  blogPath,
  featuresPath,
  guidePath,
  homePath,
  langFromPath,
  marketingPath,
  type MarketingPage,
} from '../seo/site'
import { LANGS, lang, t, type Lang } from '../i18n'

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertLink(rel: string, href: string, extra?: Record<string, string>) {
  const selector = extra?.hreflang
    ? `link[rel="${rel}"][hreflang="${extra.hreflang}"]`
    : `link[rel="${rel}"]:not([hreflang])`
  let el = document.head.querySelector<HTMLLinkElement>(selector)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
  if (extra) {
    for (const [k, v] of Object.entries(extra)) el.setAttribute(k, v)
  }
}

function removeHreflang() {
  document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((n) => n.remove())
}

function upsertJsonLd(id: string, data: Record<string, unknown>) {
  let el = document.getElementById(id) as HTMLScriptElement | null
  if (!el) {
    el = document.createElement('script')
    el.type = 'application/ld+json'
    el.id = id
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(data)
}

function removeJsonLd(id: string) {
  document.getElementById(id)?.remove()
}

function applyHreflang(pathBuilder: (l: Lang) => string) {
  removeHreflang()
  for (const item of LANGS) {
    upsertLink('alternate', absoluteUrl(pathBuilder(item.code)), {
      hreflang: HTML_LANG[item.code],
    })
  }
  upsertLink('alternate', absoluteUrl(pathBuilder('en')), { hreflang: 'x-default' })
}

function applySocial(opts: {
  title: string
  description: string
  canonical: string
  routeLang: Lang
  type?: string
}) {
  const { title, description, canonical, routeLang, type = 'website' } = opts
  document.title = title
  upsertMeta('name', 'description', description)
  upsertMeta('name', 'robots', 'index,follow,max-image-preview:large')
  upsertMeta('name', 'googlebot', 'index,follow,max-image-preview:large')

  upsertMeta('property', 'og:type', type)
  upsertMeta('property', 'og:site_name', SITE_NAME)
  upsertMeta('property', 'og:title', title)
  upsertMeta('property', 'og:description', description)
  upsertMeta('property', 'og:url', canonical)
  upsertMeta('property', 'og:locale', HTML_LANG[routeLang].replace('-', '_'))
  upsertMeta('property', 'og:image', absoluteUrl('/og-image.png'))
  upsertMeta('property', 'og:image:width', '1200')
  upsertMeta('property', 'og:image:height', '630')

  upsertMeta('name', 'twitter:card', 'summary_large_image')
  upsertMeta('name', 'twitter:title', title)
  upsertMeta('name', 'twitter:description', description)
  upsertMeta('name', 'twitter:image', absoluteUrl('/og-image.png'))

  upsertLink('canonical', canonical)
}

export function applyDocumentLang(l: Lang) {
  document.documentElement.lang = HTML_LANG[l]
}

function applyHomeSeo(routeLang: Lang) {
  const title = t('home.seo.title')
  const description = t('home.seo.description')
  const keywords = t('home.seo.keywords')
  const canonical = absoluteUrl(homePath(routeLang))

  applySocial({ title, description, canonical, routeLang })
  upsertMeta('name', 'keywords', keywords)
  applyHreflang((l) => homePath(l))

  upsertJsonLd('seo-jsonld', {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description,
        inLanguage: HTML_LANG[routeLang],
      },
      {
        '@type': 'SoftwareApplication',
        name: SITE_NAME,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web Browser',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
        description,
        url: canonical,
        inLanguage: HTML_LANG[routeLang],
      },
    ],
  })
}

function applyFeaturesSeo(routeLang: Lang) {
  const title = `${t('features.heroTitle')} · ${SITE_NAME}`
  const description = t('features.heroDesc')
  const canonical = absoluteUrl(featuresPath(routeLang))
  applySocial({ title, description, canonical, routeLang })
  applyHreflang((l) => featuresPath(l))
  upsertJsonLd('seo-jsonld', {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: t('features.heroTitle'),
    description,
    url: canonical,
    inLanguage: HTML_LANG[routeLang],
  })
}

function applyGuideSeo(routeLang: Lang) {
  const title = `${t('home.navGuideFaq')} · ${SITE_NAME}`
  const description = t('home.guideSub')
  const canonical = absoluteUrl(guidePath(routeLang))
  applySocial({ title, description, canonical, routeLang })
  applyHreflang((l) => guidePath(l))

  const faqEntities = Array.from({ length: 8 }, (_, i) => {
    const n = i + 1
    return {
      '@type': 'Question',
      name: t(`home.faq${n}Q`),
      acceptedAnswer: {
        '@type': 'Answer',
        text: t(`home.faq${n}A`),
      },
    }
  })

  upsertJsonLd('seo-jsonld', {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: t('home.navGuideFaq'),
        description,
        url: canonical,
        inLanguage: HTML_LANG[routeLang],
      },
      {
        '@type': 'FAQPage',
        '@id': `${canonical}#faq`,
        url: `${canonical}#faq`,
        inLanguage: HTML_LANG[routeLang],
        mainEntity: faqEntities,
      },
    ],
  })
}

function applyBlogSeo(routeLang: Lang) {
  const hub = pickHubMeta('blog', routeLang)
  const title = `${hub.title} · ${SITE_NAME}`
  const canonical = absoluteUrl(blogPath(routeLang))
  applySocial({ title, description: hub.description, canonical, routeLang })
  applyHreflang((l) => blogPath(l))

  const articles = listArticles('blog')
  upsertJsonLd('seo-jsonld', {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Blog',
        name: hub.title,
        description: hub.description,
        url: canonical,
        inLanguage: HTML_LANG[routeLang],
      },
      {
        '@type': 'ItemList',
        itemListElement: articles.map((article, i) => {
          const block = pickLocaleBlock(article.i18n, routeLang)
          return {
            '@type': 'ListItem',
            position: i + 1,
            name: block.title,
            url: absoluteUrl(blogArticlePath(routeLang, article.slug)),
          }
        }),
      },
    ],
  })
}

function applyBlogArticleSeo(routeLang: Lang, slug: string) {
  const article = getArticle('blog', slug)
  if (!article) {
    const hub = pickHubMeta('blog', routeLang)
    applySocial({
      title: `${t('content.notFoundTitle')} · ${SITE_NAME}`,
      description: hub.description,
      canonical: absoluteUrl(blogPath(routeLang)),
      routeLang,
    })
    upsertMeta('name', 'robots', 'noindex,follow')
    removeJsonLd('seo-jsonld')
    return
  }
  const block = pickLocaleBlock(article.i18n, routeLang)
  const canonical = absoluteUrl(blogArticlePath(routeLang, slug))
  applySocial({
    title: `${block.title} · ${SITE_NAME}`,
    description: block.description || block.summary,
    canonical,
    routeLang,
    type: 'article',
  })
  applyHreflang((l) => blogArticlePath(l, slug))
  upsertJsonLd('seo-jsonld', {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: block.title,
    description: block.description || block.summary,
    datePublished: article.date,
    url: canonical,
    inLanguage: HTML_LANG[routeLang],
    mainEntityOfPage: canonical,
    author: { '@type': 'Organization', name: SITE_NAME },
  })
}

export function applyRouteSeo(route: RouteLocationNormalizedLoaded) {
  const robots = (route.meta.robots as string) || 'index,follow'
  const routeLang =
    (typeof route.params.lang === 'string' && langFromPath(route.params.lang)) || lang.value
  const page = route.meta.page as MarketingPage | undefined

  applyDocumentLang(routeLang)

  if (page === 'home' || route.name === 'home') {
    applyHomeSeo(routeLang)
    return
  }
  if (page === 'features' || route.name === 'features') {
    applyFeaturesSeo(routeLang)
    return
  }
  if (page === 'guide' || route.name === 'guide') {
    applyGuideSeo(routeLang)
    return
  }
  if (page === 'blog' || route.name === 'blog') {
    applyBlogSeo(routeLang)
    return
  }
  if (page === 'blog-article' || route.name === 'blog-article') {
    applyBlogArticleSeo(routeLang, String(route.params.slug || ''))
    return
  }

  document.title = `${SITE_NAME}`
  upsertMeta('name', 'description', t('home.seo.description'))
  upsertMeta('name', 'robots', robots)
  upsertMeta('name', 'googlebot', robots)
  removeHreflang()
  removeJsonLd('seo-jsonld')
  const path = route.fullPath.split('?')[0] || '/'
  upsertLink('canonical', absoluteUrl(path))
}

export function watchLangSeo(getRoute: () => RouteLocationNormalizedLoaded) {
  watch(lang, () => applyRouteSeo(getRoute()))
}

export function localePathList(): string[] {
  return LANGS.map((l) => marketingPath(l.code, 'home'))
}
