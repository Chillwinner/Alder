/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const libarchiveSrc = path.join(rootDir, 'node_modules/libarchive.js/dist')

function stripProxiedHtmlType(proxy: {
  on: (event: string, fn: (proxyRes: { headers: Record<string, unknown> }) => void) => void
}) {
  proxy.on('proxyRes', (proxyRes) => {
    const type = String(proxyRes.headers['content-type'] ?? '')
    if (type.includes('text/html')) {
      proxyRes.headers['content-type'] = 'application/octet-stream'
    }
  })
}

function isFileContentApiPath(urlPath: string): boolean {
  const pathOnly = urlPath.split('?')[0] ?? ''
  return (
    pathOnly.startsWith('/apis/') &&
    /\/content(?:\/|$)/.test(pathOnly)
  )
}

/** 文件原文不要进 Vite 的 HTML 中间件，否则会卡死预览 */
function proxyRawFileContent(target: URL): Plugin {
  return {
    name: 'proxy-raw-file-content',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !isFileContentApiPath(req.url)) {
          next()
          return
        }
        const headers = { ...req.headers, host: target.host }
        const upstream = http.request(
          {
            hostname: target.hostname,
            port: target.port || (target.protocol === 'https:' ? 443 : 80),
            path: req.url,
            method: req.method,
            headers,
          },
          (incoming) => {
            const outHeaders = { ...incoming.headers }
            outHeaders['content-type'] = 'application/octet-stream'
            res.writeHead(incoming.statusCode ?? 502, outHeaders)
            incoming.pipe(res)
          }
        )
        upstream.on('error', (err) => {
          next(err)
        })
        req.pipe(upstream)
      })
    },
  }
}

function serveLibarchive(): Plugin {
  const files = new Set(['worker-bundle.js', 'libarchive.wasm'])
  const copyAssets = (outDir: string) => {
    const dest = path.join(outDir, 'libarchive')
    fs.mkdirSync(dest, { recursive: true })
    for (const name of files) {
      fs.copyFileSync(path.join(libarchiveSrc, name), path.join(dest, name))
    }
  }

  return {
    name: 'serve-libarchive',
    configureServer(server) {
      server.middlewares.use('/libarchive', (req, res, next) => {
        const name = path.basename(req.url?.split('?')[0] || '')
        if (!files.has(name)) {
          next()
          return
        }
        const file = path.join(libarchiveSrc, name)
        res.setHeader(
          'Content-Type',
          name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript'
        )
        fs.createReadStream(file).pipe(res)
      })
    },
    closeBundle() {
      copyAssets(path.join(rootDir, 'dist'))
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  /*
   * 后端地址：默认指向真实后端 8080。
   * 需要回到假后端（mock-server.mjs）时，设 VITE_API_TARGET=http://127.0.0.1:8081，
   * 或在 .env.development 里加一行即可 —— 不用改这个文件。
   *
   * 历史：这里曾硬编码 8081（mock）。真后端是 8080
   * （见 Gateway/src/main/resources/application.yml 的 server.port）。
   */
  const apiTarget = env.VITE_API_TARGET || 'http://127.0.0.1:8080'
  const rawFileHost = new URL(apiTarget)

  return {
    plugins: [proxyRawFileContent(rawFileHost), react(), vue(), tailwindcss(), serveLibarchive()],
    resolve: {
      // 自动读取 tsconfig.json 中的 paths
      tsconfigPaths: true,
      dedupe: ['react', 'react-dom', 'yjs'],
    },
    optimizeDeps: {
      include: [
        'luckyexcel',
        '@fortune-sheet/react',
        '@vidstack/react',
        '@extend-ai/react-pptx',
        'regl',
        '@tiptap/react',
        '@tiptap/starter-kit',
        '@tiptap/extension-collaboration',
        '@tiptap/extension-link',
        '@tiptap/extension-image',
        '@tiptap/extension-text-align',
        '@tiptap/extension-text-style',
        '@tiptap/extension-underline',
        'yjs',
        '@xyflow/react',
        '@xyflow/system',
        'd3-drag',
        'd3-selection',
        'd3-zoom',
        'd3-transition',
        'd3-dispatch',
      ],
    },
    server: {
      port: 5180,
      strictPort: true,
      host: true,
      open: true,
      proxy: {
        '/apis': {
          target: apiTarget,
          changeOrigin: true,
          timeout: 600_000,
          proxyTimeout: 600_000,
          configure: stripProxiedHtmlType,
        },
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          timeout: 600_000,
          proxyTimeout: 600_000,
          configure: stripProxiedHtmlType,
        },
        '/files': {
          target: apiTarget,
          changeOrigin: true,
          timeout: 600_000,
          proxyTimeout: 600_000,
          configure: stripProxiedHtmlType,
        },
        '/ws': { target: apiTarget, changeOrigin: true, ws: true },
      },
    },
  }
})
