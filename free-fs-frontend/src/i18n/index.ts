/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import enCommon from '@/locales/en/common.json'
import enCollection from '@/locales/en/collection.json'
import enFiles from '@/locales/en/files.json'
import enHome from '@/locales/en/home.json'
import enLayout from '@/locales/en/layout.json'
import enLogin from '@/locales/en/login.json'
import enInvite from '@/locales/en/invite.json'
import enSettings from '@/locales/en/settings.json'
import enShare from '@/locales/en/share.json'
import enStorage from '@/locales/en/storage.json'
import enTransfer from '@/locales/en/transfer.json'
import enWorkspace from '@/locales/en/workspace.json'
import enMessages from '@/locales/en/messages.json'
import enBoard from '@/locales/en/board.json'
import enProgress from '@/locales/en/progress.json'
import enErrors from '@/locales/en/errors.json'
import zhCommon from '@/locales/zh/common.json'
import zhCollection from '@/locales/zh/collection.json'
import zhFiles from '@/locales/zh/files.json'
import zhHome from '@/locales/zh/home.json'
import zhLayout from '@/locales/zh/layout.json'
import zhLogin from '@/locales/zh/login.json'
import zhInvite from '@/locales/zh/invite.json'
import zhSettings from '@/locales/zh/settings.json'
import zhShare from '@/locales/zh/share.json'
import zhStorage from '@/locales/zh/storage.json'
import zhTransfer from '@/locales/zh/transfer.json'
import zhWorkspace from '@/locales/zh/workspace.json'
import zhMessages from '@/locales/zh/messages.json'
import zhBoard from '@/locales/zh/board.json'
import zhProgress from '@/locales/zh/progress.json'
import zhErrors from '@/locales/zh/errors.json'
import zhHKCommon from '@/locales/zh-HK/common.json'
import zhHKCollection from '@/locales/zh-HK/collection.json'
import zhHKFiles from '@/locales/zh-HK/files.json'
import zhHKHome from '@/locales/zh-HK/home.json'
import zhHKLayout from '@/locales/zh-HK/layout.json'
import zhHKLogin from '@/locales/zh-HK/login.json'
import zhHKInvite from '@/locales/zh-HK/invite.json'
import zhHKSettings from '@/locales/zh-HK/settings.json'
import zhHKShare from '@/locales/zh-HK/share.json'
import zhHKStorage from '@/locales/zh-HK/storage.json'
import zhHKTransfer from '@/locales/zh-HK/transfer.json'
import zhHKWorkspace from '@/locales/zh-HK/workspace.json'
import zhHKMessages from '@/locales/zh-HK/messages.json'
import zhHKBoard from '@/locales/zh-HK/board.json'
import zhHKProgress from '@/locales/zh-HK/progress.json'
import zhHKErrors from '@/locales/zh-HK/errors.json'

export type AppLang = 'zh' | 'zh-HK' | 'en'

const NAMESPACES = [
  'common',
  'collection',
  'files',
  'home',
  'layout',
  'login',
  'invite',
  'settings',
  'share',
  'storage',
  'transfer',
  'workspace',
  'errors',
  'messages',
  'board',
  'progress',
] as const

function pack(files: Record<(typeof NAMESPACES)[number], object>) {
  return files
}

export function getAppLang(): AppLang {
  const lng = (i18n.resolvedLanguage || i18n.language || 'en').replace('_', '-')
  if (lng === 'zh-HK' || lng.toLowerCase() === 'zh-hk') return 'zh-HK'
  if (lng.startsWith('zh')) return 'zh'
  return 'en'
}

/** 把接口返回的 msg（稳定 key，可选 `|arg`）翻成当前语言。对不上就原样显示。 */
export function translateServerText(raw?: string | null, fallback?: string): string {
  if (!raw) return fallback || ''
  const [key, ...args] = raw.split('|')
  const opts = { ns: 'errors', keySeparator: false as const }
  if (i18n.exists(key, opts)) {
    const interpolation = Object.fromEntries(args.map((value, index) => [String(index), value]))
    return i18n.t(key, { ...opts, ...interpolation })
  }
  return raw
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: pack({
        common: enCommon,
        collection: enCollection,
        files: enFiles,
        home: enHome,
        layout: enLayout,
        login: enLogin,
        invite: enInvite,
        settings: enSettings,
        share: enShare,
        storage: enStorage,
        transfer: enTransfer,
        workspace: enWorkspace,
        errors: enErrors,
        messages: enMessages,
        board: enBoard,
        progress: enProgress,
      }),
      zh: pack({
        common: zhCommon,
        collection: zhCollection,
        files: zhFiles,
        home: zhHome,
        layout: zhLayout,
        login: zhLogin,
        invite: zhInvite,
        settings: zhSettings,
        share: zhShare,
        storage: zhStorage,
        transfer: zhTransfer,
        workspace: zhWorkspace,
        errors: zhErrors,
        messages: zhMessages,
        board: zhBoard,
        progress: zhProgress,
      }),
      'zh-HK': pack({
        common: zhHKCommon,
        collection: zhHKCollection,
        files: zhHKFiles,
        home: zhHKHome,
        layout: zhHKLayout,
        login: zhHKLogin,
        invite: zhHKInvite,
        settings: zhHKSettings,
        share: zhHKShare,
        storage: zhHKStorage,
        transfer: zhHKTransfer,
        workspace: zhHKWorkspace,
        errors: zhHKErrors,
        messages: zhHKMessages,
        board: zhHKBoard,
        progress: zhHKProgress,
      }),
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'zh', 'zh-HK'],
    nonExplicitSupportedLngs: false,
    load: 'currentOnly',
    ns: [...NAMESPACES],
    defaultNS: 'login',
    interpolation: { escapeValue: false },
    ignoreJSONStructure: true,
    detection: {
      order: ['localStorage'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  })

export default i18n
