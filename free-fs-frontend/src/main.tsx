/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@fontsource-variable/space-grotesk'
import '@fontsource-variable/jetbrains-mono'
import '@/i18n'
import App from './app'
import { ThemeProvider } from './components/theme-provider'
import { initFxLayer } from './lib/fx-layer'
import { initMotionLayer } from './lib/motion-layer'
import './styles/index.css'
/*
 * 材质层 / Dock / UI 原子层 / 拖拽层 —— 必须在这里 import，不能靠 index.css 的 @import。
 *
 * Tailwind v4 只会内联文件顶部的 @import；'tailwindcss' 与 'tw-animate-css' 之后
 * 的 @import 会被原样保留，而这种由 JS 注入的 <style> 解析不了相对路径 →
 * 这几个文件会静默丢失（实测 .a-glass / .a-dock / .a-fcard 命中数为 0）。
 * 放在 index.css 之后 import，保证它们能覆盖 Tailwind 的基础层。
 */
import './styles/alder.css'
import './styles/alder-dock.css'
import './styles/alder-ui.css'
import './styles/drag-layer.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

initFxLayer()
initMotionLayer()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme='system' storageKey='theme'>
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
)
