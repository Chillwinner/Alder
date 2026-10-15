/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  acceptLanSession,
  cancelLanSession,
  createLanSession,
  doneLanSession,
  failLanSession,
  rejectLanSession,
  type LanSession,
} from '@/api/lan'
import { translateServerText } from '@/i18n'
import { createLanPeer, receiveLanFiles, sendLanFiles } from '@/lib/lan-rtc'
import { finishLanSaves, pickLanDirectory, resetLanSaves, writeLanChunk } from '@/lib/lan-save'
import type { LanSocketEvent } from '@/hooks/use-im-socket'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import UploadModal from '@/pages/files/components/UploadModal'
import { formatFileSize } from '@/utils/format'

type PeerApi = ReturnType<typeof createLanPeer>

export function openLanSendDialog(peerUserId: string, peerName: string) {
  window.dispatchEvent(
    new CustomEvent('alder:lan-send', { detail: { peerUserId, peerName } })
  )
}

export function LanTransferHost() {
  const { t } = useTranslation('messages')
  const [sendOpen, setSendOpen] = useState(false)
  const [peerUserId, setPeerUserId] = useState('')
  const [peerName, setPeerName] = useState('')
  const [picked, setPicked] = useState<File[]>([])
  const [incoming, setIncoming] = useState<LanSession | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const peerRef = useRef<PeerApi | null>(null)
  const sessionRef = useRef<string | null>(null)
  const pickedRef = useRef<File[]>([])
  const pendingSignals = useRef<{ type: string; payload: string }[]>([])

  useEffect(() => {
    pickedRef.current = picked
  }, [picked])

  const teardown = useCallback(() => {
    peerRef.current?.close()
    peerRef.current = null
    sessionRef.current = null
    pendingSignals.current = []
    resetLanSaves()
    setBusy(false)
    setProgress('')
    setIncoming(null)
  }, [])

  const handleEvent = useCallback(
    async (event: LanSocketEvent) => {
      if (event.type === 'INVITE' && event.session) {
        setIncoming(event.session)
        return
      }
      if (event.type === 'REJECTED' || event.type === 'CANCELLED' || event.type === 'FAILED') {
        toast.error(t(`lan.${event.type.toLowerCase()}` as 'lan.rejected'))
        setSendOpen(false)
        teardown()
        return
      }
      if (event.type === 'DONE') {
        toast.success(t('lan.done'))
        setSendOpen(false)
        teardown()
        return
      }
      if (event.type === 'ACCEPTED' && event.session) {
        const peer = createLanPeer(event.session.id, false)
        peerRef.current = peer
        sessionRef.current = event.session.id
        for (const signal of pendingSignals.current) {
          await peer.handleSignal(signal.type, signal.payload)
        }
        pendingSignals.current = []
        try {
          await peer.localOffer()
          const channel = await peer.waitChannel()
          await sendLanFiles(channel, pickedRef.current, (p) =>
            setProgress(`${formatFileSize(p.sent)} / ${formatFileSize(p.total)}`)
          )
          await doneLanSession(event.session.id)
          toast.success(t('lan.sent'))
          setSendOpen(false)
          teardown()
        } catch (error) {
          await failLanSession(event.session.id).catch(() => undefined)
          toast.error(
            error instanceof Error
              ? translateServerText(error.message, t('lan.failed'))
              : t('lan.failed')
          )
          teardown()
        }
        return
      }
      if (event.type === 'SIGNAL' && event.signalType && event.payload) {
        if (peerRef.current) {
          await peerRef.current.handleSignal(event.signalType, event.payload)
        } else {
          pendingSignals.current.push({ type: event.signalType, payload: event.payload })
        }
      }
    },
    [t, teardown]
  )

  useEffect(() => {
    const onSend = (event: Event) => {
      const detail = (event as CustomEvent<{ peerUserId: string; peerName: string }>).detail
      setPeerUserId(detail.peerUserId)
      setPeerName(detail.peerName)
      setPicked([])
      setSendOpen(true)
    }
    const onLan = (event: Event) => {
      void handleEvent((event as CustomEvent<LanSocketEvent>).detail)
    }
    window.addEventListener('alder:lan-send', onSend)
    window.addEventListener('alder:lan-event', onLan)
    return () => {
      window.removeEventListener('alder:lan-send', onSend)
      window.removeEventListener('alder:lan-event', onLan)
    }
  }, [handleEvent])

  const startSend = async (files: File[]) => {
    if (!peerUserId || files.length === 0) return
    setPicked(files)
    pickedRef.current = files
    setBusy(true)
    try {
      const session = await createLanSession(
        peerUserId,
        files.map((file) => ({
          name: file.name,
          relativePath: file.webkitRelativePath || file.name,
          size: file.size,
        }))
      )
      sessionRef.current = session.id
      toast.message(t('lan.waitingAccept'))
    } catch (error) {
      setBusy(false)
      if (error && typeof error === 'object' && 'handled' in error && error.handled) return
      toast.error(
        error instanceof Error ? translateServerText(error.message, t('lan.failed')) : t('lan.failed')
      )
    }
  }

  const acceptIncoming = async () => {
    if (!incoming) return
    setBusy(true)
    try {
      const dir = await pickLanDirectory()
      if (!dir && !window.confirm(t('lan.fallbackDownload'))) {
        setBusy(false)
        return
      }
      const peer = createLanPeer(incoming.id, true)
      peerRef.current = peer
      sessionRef.current = incoming.id
      const session = await acceptLanSession(incoming.id)
      for (const signal of pendingSignals.current) {
        await peer.handleSignal(signal.type, signal.payload)
      }
      pendingSignals.current = []
      const channel = await peer.waitChannel()
      await receiveLanFiles(
        channel,
        session.files,
        (path, chunk, done) => writeLanChunk(dir, path, chunk, done),
        (p) => setProgress(`${formatFileSize(p.sent)} / ${formatFileSize(p.total)}`)
      )
      await finishLanSaves()
      await doneLanSession(session.id).catch(() => undefined)
      toast.success(t('lan.received'))
    } catch (error) {
      if (incoming) await failLanSession(incoming.id).catch(() => undefined)
      toast.error(
        error instanceof Error ? translateServerText(error.message, t('lan.failed')) : t('lan.failed')
      )
    } finally {
      teardown()
    }
  }

  return (
    <>
      <UploadModal
        open={sendOpen && !busy}
        onOpenChange={(open) => {
          if (!open && sessionRef.current) void cancelLanSession(sessionRef.current)
          if (!open) {
            setSendOpen(false)
            if (!sessionRef.current) teardown()
          }
        }}
        title={t('lan.sendTitle', { name: peerName })}
        submitLabel={t('lan.send')}
        onPick={(files) => void startSend(files)}
      />

      <Dialog open={Boolean(incoming)} onOpenChange={(open) => !open && setIncoming(null)}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>{t('lan.incomingTitle', { name: incoming?.fromName || '' })}</DialogTitle>
            <DialogDescription>
              {t('lan.incomingHint', {
                count: incoming?.files.length ?? 0,
                size: formatFileSize((incoming?.files ?? []).reduce((sum, file) => sum + file.size, 0)),
              })}
            </DialogDescription>
          </DialogHeader>
          <ul className='max-h-40 overflow-auto text-[13px]'>
            {(incoming?.files ?? []).slice(0, 20).map((file) => (
              <li key={file.relativePath} className='truncate'>
                {file.relativePath} · {formatFileSize(file.size)}
              </li>
            ))}
          </ul>
          {progress ? <p className='font-mono text-[12px]'>{progress}</p> : null}
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => {
                if (incoming) void rejectLanSession(incoming.id)
                setIncoming(null)
              }}
            >
              {t('lan.reject')}
            </Button>
            <Button type='button' disabled={busy} onClick={() => void acceptIncoming()}>
              {t('lan.accept')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
