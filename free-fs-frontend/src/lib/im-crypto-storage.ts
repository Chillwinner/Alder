/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { ImPrivateKeyBackup } from '@/lib/im-crypto'

const DB_NAME = 'free-fs-im-crypto'
const DB_VERSION = 1
const STORE = 'keys'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'userId' })
      }
    }
    request.onsuccess = () => resolve(request.result)
  })
}

export async function savePrivateKeyBackup(userId: string, backup: ImPrivateKeyBackup) {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(backup)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function loadPrivateKeyBackup(userId: string): Promise<ImPrivateKeyBackup | null> {
  const db = await openDb()
  const row = await new Promise<ImPrivateKeyBackup | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(userId)
    req.onsuccess = () => resolve((req.result as ImPrivateKeyBackup | undefined) ?? null)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return row
}

export async function deletePrivateKeyBackup(userId: string) {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(userId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

const BACKUP_ACK_KEY = 'im_crypto_backup_ack'

export function hasAcknowledgedBackupDownload(userId: string) {
  return localStorage.getItem(`${BACKUP_ACK_KEY}:${userId}`) === '1'
}

export function markBackupDownloadAcknowledged(userId: string) {
  localStorage.setItem(`${BACKUP_ACK_KEY}:${userId}`, '1')
}
