<script setup lang="ts">
import { RouterLink } from 'vue-router'
import BrandMark from './BrandMark.vue'
import LanguageSwitcher from './LanguageSwitcher.vue'
import { useScrollMotion } from '../composables/useScrollMotion'
import { lang, t } from '../i18n'
import {
  blogPath,
  featuresPath,
  guidePath,
  homePath,
  type MarketingPage,
} from '../seo/site'
import '../views/HomeView.css'
import '../views/content/ContentShell.css'

defineProps<{
  active: MarketingPage
}>()

useScrollMotion()
</script>

<template>
  <div class="home studio" :class="{ 'content-page': active !== 'home' }" :data-lang="lang">
    <div class="scroll-progress" aria-hidden="true" />
    <a class="skip-link" href="#main-content">{{ t('home.skipToContent') }}</a>

    <header class="masthead">
      <div class="page-rail mast-rail">
        <RouterLink class="mast-brand" :to="homePath(lang)" :aria-label="t('home.whiteboard')">
          <span class="mast-mark" aria-hidden="true">
            <BrandMark />
          </span>
          <span class="mast-name">{{ t('home.whiteboard') }}</span>
        </RouterLink>
        <nav class="mast-nav" :aria-label="t('content.navLabel')">
          <RouterLink :class="{ 'is-on': active === 'home' }" :to="homePath(lang)">{{ t('content.navHome') }}</RouterLink>
          <RouterLink :class="{ 'is-on': active === 'features' }" :to="featuresPath(lang)">{{ t('home.navFeatures') }}</RouterLink>
          <RouterLink :class="{ 'is-on': active === 'guide' }" :to="guidePath(lang)">{{ t('home.navGuideFaq') }}</RouterLink>
          <RouterLink :class="{ 'is-on': active === 'blog' }" :to="blogPath(lang)">{{ t('content.navBlog') }}</RouterLink>
        </nav>
        <div class="mast-tools">
          <LanguageSwitcher />
        </div>
      </div>
    </header>

    <main id="main-content" class="main">
      <div class="page-rail">
        <slot />
      </div>
    </main>

    <footer class="colophon">
      <div class="page-rail colophon-rail">
        <p>{{ t('home.footer') }}</p>
        <nav :aria-label="t('content.navLabel')">
          <RouterLink :to="homePath(lang)">{{ t('content.navHome') }}</RouterLink>
          <RouterLink :to="featuresPath(lang)">{{ t('home.navFeatures') }}</RouterLink>
          <RouterLink :to="guidePath(lang)">{{ t('home.navGuideFaq') }}</RouterLink>
          <RouterLink :to="blogPath(lang)">{{ t('content.navBlog') }}</RouterLink>
        </nav>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.page-rail {
  width: min(1180px, calc(100% - 40px));
  margin: 0 auto;
}

.masthead {
  position: sticky;
  top: 0;
  z-index: 50;
  background: color-mix(in srgb, var(--glass-shell-bg) 92%, transparent);
  border-bottom: 1px solid var(--border);
  backdrop-filter: blur(12px);
}

.mast-rail {
  display: flex;
  align-items: center;
  gap: 20px;
  height: 60px;
}

.mast-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--foreground);
  text-decoration: none;
}

.mast-mark {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
}

.mast-name {
  font-family: var(--font-sans);
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.mast-nav {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.mast-nav a {
  padding: 7px 12px;
  border-radius: 8px;
  color: var(--muted-foreground);
  font-size: 13.5px;
  font-weight: 500;
  text-decoration: none;
  transition: background 0.15s, color 0.15s;
}

.mast-nav a:hover {
  background: var(--accent);
  color: var(--foreground);
}

.mast-nav a.is-on {
  background: var(--accent-soft);
  color: var(--primary);
  font-weight: 600;
}

.mast-tools {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

.main {
  min-height: 60vh;
}

.colophon {
  border-top: 1px solid var(--border);
  padding: 24px 0;
  color: var(--muted-foreground);
  font-size: 13px;
}

.colophon-rail {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.colophon-rail p {
  margin: 0;
}

.colophon nav {
  display: flex;
  gap: 14px;
}

.colophon nav a {
  color: var(--muted-foreground);
  text-decoration: none;
  transition: color 0.15s;
}

.colophon nav a:hover {
  color: var(--primary);
}

.scroll-progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  z-index: 60;
  background: var(--hud);
  transform-origin: left;
}

.skip-link {
  position: absolute;
  left: -9999px;
  z-index: 100;
  padding: 8px 14px;
  border-radius: 8px;
  background: var(--primary);
  color: var(--primary-foreground);
  font-size: 13px;
  text-decoration: none;
}

.skip-link:focus {
  left: 12px;
  top: 12px;
}
</style>
