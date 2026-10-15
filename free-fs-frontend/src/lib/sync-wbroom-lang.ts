/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { getAppLang, type AppLang } from '@/i18n'
import { setLang, type Lang } from '@/wbroom/i18n'

const APP_TO_WBROOM: Record<AppLang, Lang> = {
  zh: 'zh',
  'zh-HK': 'zh-TW',
  en: 'en',
}

/** Align embedded wbroom UI with the React app language (i18nextLng). */
export function syncWbroomLangFromApp(): void {
  setLang(APP_TO_WBROOM[getAppLang()])
}
