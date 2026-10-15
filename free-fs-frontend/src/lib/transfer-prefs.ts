/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { TransferSettingForm } from '@/types/transfer-setting'

const KEY = 'alder-transfer-prefs-v1'

export const DEFAULT_TRANSFER_PREFS: TransferSettingForm = {
  downloadLocation: '',
  isDefaultDownloadLocation: false,
  downloadSpeedLimit: 5,
  enableDownloadSpeedLimit: false,
  concurrentUploadQuantity: 3,
  concurrentDownloadQuantity: 3,
  chunkSize: 5 * 1024 * 1024,
}

export function readTransferPrefs(): TransferSettingForm {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_TRANSFER_PREFS }
    const parsed = JSON.parse(raw) as Partial<TransferSettingForm>
    return {
      ...DEFAULT_TRANSFER_PREFS,
      ...parsed,
      concurrentUploadQuantity: clamp(
        Number(parsed.concurrentUploadQuantity) || 3,
        1,
        3
      ),
      concurrentDownloadQuantity: clamp(
        Number(parsed.concurrentDownloadQuantity) || 3,
        1,
        3
      ),
      chunkSize: Math.max(
        1024 * 1024,
        Number(parsed.chunkSize) || DEFAULT_TRANSFER_PREFS.chunkSize
      ),
    }
  } catch {
    return { ...DEFAULT_TRANSFER_PREFS }
  }
}

export function writeTransferPrefs(prefs: TransferSettingForm) {
  localStorage.setItem(KEY, JSON.stringify(prefs))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
