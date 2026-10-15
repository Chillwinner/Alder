/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { fetchImCryptoMe, registerImCrypto } from '@/api/im-crypto'
import { activateImCryptoFromBackup } from '@/lib/im-crypto-session'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { translateServerText } from '@/i18n'
import type { ImPrivateKeyBackup } from '@/lib/im-crypto'
import {
  createKeyProof,
  downloadJsonFile,
  generateIdentityKeyPair,
  wrapPrivateKeyBackup,
} from '@/lib/im-crypto'
import {
  hasAcknowledgedBackupDownload,
  loadPrivateKeyBackup,
  markBackupDownloadAcknowledged,
  savePrivateKeyBackup,
} from '@/lib/im-crypto-storage'
import { useImCryptoStore } from '@/store/im-crypto'

type Phase = 'idle' | 'backup' | 'import'

export function ImCryptoHost() {
  const { t } = useTranslation('messages')
  const { isAuthenticated, user } = useAuth()
  const unlocked = useImCryptoStore((s) => s.unlocked)
  const [phase, setPhase] = useState<Phase>('idle')
  const [pendingBackup, setPendingBackup] = useState<ImPrivateKeyBackup | null>(null)
  const bootstrapping = useRef(false)
  const importDismissed = useRef(false)
  const importRef = useRef<HTMLInputElement>(null)

  const activateSession = useCallback(
    async (backup: ImPrivateKeyBackup) => {
      if (!user?.id) return
      await activateImCryptoFromBackup(backup, user.id)
    },
    [user?.id]
  )

  const runInitialSetup = useCallback(async () => {
    if (!user?.id) return
    const keyPair = await generateIdentityKeyPair()
    const backup = await wrapPrivateKeyBackup(user.id, keyPair)
    const proof = await createKeyProof(keyPair.privateKey, keyPair.publicKey, user.id)
    await registerImCrypto(backup.publicKeySpki, proof)
    await savePrivateKeyBackup(user.id, backup)
    await activateSession(backup)
    setPendingBackup(backup)
    if (!hasAcknowledgedBackupDownload(user.id)) {
      setPhase('backup')
    }
  }, [activateSession, user?.id])

  const bootstrap = useCallback(async () => {
    if (!user?.id || unlocked || bootstrapping.current) return
    bootstrapping.current = true
    try {
      const local = await loadPrivateKeyBackup(user.id)
      if (local) {
        await activateSession(local)
        return
      }
      const me = await fetchImCryptoMe().catch(() => null)
      if (!me?.registered) {
        await runInitialSetup()
        return
      }
      if (!importDismissed.current) setPhase('import')
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? translateServerText(cause.message, t('crypto.setupFailed'))
          : t('crypto.setupFailed')
      )
    } finally {
      bootstrapping.current = false
    }
  }, [activateSession, runInitialSetup, t, unlocked, user?.id])

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      useImCryptoStore.getState().clearSession()
      setPhase('idle')
      bootstrapping.current = false
      return
    }
    void bootstrap()
  }, [bootstrap, isAuthenticated, user?.id])

  const handleDownloadBackup = () => {
    if (!pendingBackup || !user?.id) return
    downloadJsonFile(`alder-im-key-${user.id}.json`, pendingBackup)
    markBackupDownloadAcknowledged(user.id)
    setPhase('idle')
    setPendingBackup(null)
  }

  const dismissImport = () => {
    importDismissed.current = true
    setPhase('idle')
  }

  const skipBackup = () => {
    if (user?.id) markBackupDownloadAcknowledged(user.id)
    setPhase('idle')
    setPendingBackup(null)
  }

  const handleImportFile = async (file: File) => {
    if (!user?.id) return
    try {
      const text = await file.text()
      const backup = JSON.parse(text) as ImPrivateKeyBackup
      if (backup.userId !== user.id) {
        toast.error(t('crypto.importUserMismatch'))
        return
      }
      await savePrivateKeyBackup(user.id, backup)
      await activateSession(backup)
      setPhase('idle')
      toast.success(t('crypto.importOk'))
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? translateServerText(cause.message, t('crypto.importFailed'))
          : t('crypto.importFailed')
      )
    }
  }

  if (!isAuthenticated) return null

  return (
    <>
      <input
        ref={importRef}
        type='file'
        accept='application/json,.json'
        className='hidden'
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void handleImportFile(file)
        }}
      />

      <Dialog
        open={phase === 'backup'}
        onOpenChange={(open) => {
          if (!open) skipBackup()
        }}
      >
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>{t('crypto.backupTitle')}</DialogTitle>
            <DialogDescription>{t('crypto.backupDesc')}</DialogDescription>
          </DialogHeader>
          <DialogFooter className='gap-2 sm:gap-0'>
            <Button type='button' variant='outline' onClick={skipBackup}>
              {t('crypto.backupLater')}
            </Button>
            <Button type='button' onClick={handleDownloadBackup}>
              {t('crypto.backupDownload')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={phase === 'import'}
        onOpenChange={(open) => {
          if (!open) dismissImport()
        }}
      >
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>{t('crypto.importTitle')}</DialogTitle>
            <DialogDescription>{t('crypto.importDesc')}</DialogDescription>
          </DialogHeader>
          <DialogFooter className='gap-2 sm:gap-0'>
            <Button type='button' variant='outline' onClick={dismissImport}>
              {t('crypto.importLater')}
            </Button>
            <Button type='button' onClick={() => importRef.current?.click()}>
              {t('crypto.importChooseFile')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
