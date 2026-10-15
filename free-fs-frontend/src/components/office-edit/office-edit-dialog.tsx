/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  aiApi,
  streamOfficeAiChat,
  type AiMessageDto,
  type AiThreadDto,
  type OfficeLockDto,
} from '@/api/ai'
import { getFileContent } from '@/api/file'
import { FilePreviewBody } from '@/components/preview/file-preview-body'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { typedPreviewBlob } from '@/utils/preview'
import { useOfficeEditStore } from '@/store/office-edit'
import { cn } from '@/lib/utils'

type ChatLine = AiMessageDto & { id: string }

function nid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function withIds(list: AiMessageDto[]): ChatLine[] {
  return list.map((item) => ({ ...item, id: nid() }))
}

export function OfficeEditDialog() {
  const { t } = useTranslation('files')
  const file = useOfficeEditStore((s) => s.file)
  const closeStore = useOfficeEditStore((s) => s.close)
  const [lock, setLock] = useState<OfficeLockDto | null>(null)
  const [threads, setThreads] = useState<AiThreadDto[]>([])
  const [threadId, setThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatLine[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [blob, setBlob] = useState<Blob | null>(null)
  const sessionRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const revisionRef = useRef(0)
  const logRef = useRef<HTMLDivElement>(null)
  const threadIdRef = useRef<string | null>(null)
  threadIdRef.current = threadId

  const shutdown = async () => {
    abortRef.current?.abort()
    const sessionId = sessionRef.current
    const fileId = file?.id
    sessionRef.current = null
    if (fileId && sessionId) {
      try {
        await aiApi.releaseOfficeLock(fileId, sessionId)
      } catch {
        // ignore
      }
    }
    setLock(null)
    setThreads([])
    setThreadId(null)
    setMessages([])
    setDraft('')
    setBlob(null)
    closeStore()
  }

  useEffect(() => {
    if (!file) return
    let cancelled = false
    void (async () => {
      try {
        const next = await aiApi.acquireOfficeLock(file.id)
        if (cancelled) {
          if (next.sessionId) await aiApi.releaseOfficeLock(file.id, next.sessionId)
          return
        }
        sessionRef.current = next.sessionId ?? null
        revisionRef.current = next.revision
        setLock(next)
        const catalog = await aiApi.officeThreads(file.id)
        if (cancelled) return
        setThreads(catalog)
        const active = catalog[0]?.id ?? null
        setThreadId(active)
        if (active) {
          setMessages(withIds(await aiApi.officeMessages(file.id, active)))
        }
        const content = typedPreviewBlob(file, await getFileContent(file.id))
        if (!cancelled) {
          setBlob(content)
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : t('officeEdit.lockFailed'))
          closeStore()
        }
      }
    })()
    return () => {
      cancelled = true
      const sessionId = sessionRef.current
      sessionRef.current = null
      if (sessionId) {
        void aiApi.releaseOfficeLock(file.id, sessionId).catch(() => undefined)
      }
    }
  }, [file, closeStore, t])

  useEffect(() => {
    if (!file || !sessionRef.current) return
    const beat = window.setInterval(() => {
      const sessionId = sessionRef.current
      if (!sessionId || !file) return
      void aiApi.heartbeatOfficeLock(file.id, sessionId).catch(() => undefined)
    }, 45_000)
    let refreshTimer = 0
    const poll = window.setInterval(() => {
      void aiApi.officeLock(file.id).then((status) => {
        if (status.revision === revisionRef.current) return
        revisionRef.current = status.revision
        window.clearTimeout(refreshTimer)
        refreshTimer = window.setTimeout(() => {
          void getFileContent(file.id).then((content) => {
            setBlob(typedPreviewBlob(file, content))
          })
        }, 700)
      }).catch(() => undefined)
    }, 400)
    return () => {
      window.clearInterval(beat)
      window.clearInterval(poll)
      window.clearTimeout(refreshTimer)
    }
  }, [file, lock?.sessionId])

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, sending])

  const selectThread = async (id: string) => {
    if (!file || id === threadId) return
    abortRef.current?.abort()
    setSending(false)
    setThreadId(id)
    setMessages(withIds(await aiApi.officeMessages(file.id, id)))
    setEditingId(null)
  }

  const createThread = async () => {
    if (!file) return
    const created = await aiApi.createOfficeThread(file.id)
    setThreads((prev) => [created, ...prev])
    setThreadId(created.id)
    setMessages([])
    setEditingId(null)
  }

  const removeThread = async (id: string) => {
    if (!file) return
    await aiApi.deleteOfficeThread(file.id, id)
    const next = threads.filter((item) => item.id !== id)
    if (next.length === 0) {
      const created = await aiApi.createOfficeThread(file.id)
      setThreads([created])
      setThreadId(created.id)
      setMessages([])
      return
    }
    setThreads(next)
    if (threadId === id) {
      setThreadId(next[0].id)
      setMessages(withIds(await aiApi.officeMessages(file.id, next[0].id)))
    }
  }

  const stopTurn = async () => {
    abortRef.current?.abort()
    abortRef.current = null
    const active = threadIdRef.current
    setSending(false)
    setMessages((prev) => {
      const next = [...prev]
      if (next.at(-1)?.role === 'assistant') next.pop()
      if (next.at(-1)?.role === 'user') next.pop()
      return next
    })
    if (file && active) {
      try {
        await aiApi.dropOfficeLastTurn(file.id, active)
      } catch {
        // local already dropped
      }
    }
  }

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? draft).trim()
    const sessionId = sessionRef.current
    const active = threadId
    if (!file || !sessionId || !active || !text || sending) return
    if (!textOverride) setDraft('')
    setSending(true)
    const assistantId = nid()
    setMessages((prev) => [
      ...prev,
      { id: nid(), role: 'user', text },
      { id: assistantId, role: 'assistant', text: '' },
    ])
    abortRef.current = new AbortController()
    try {
      await streamOfficeAiChat(
        file.id,
        active,
        sessionId,
        text,
        (token) => {
          setMessages((prev) =>
            prev.map((item) =>
              item.id === assistantId ? { ...item, text: item.text + token } : item
            )
          )
        },
        abortRef.current.signal
      )
      const catalog = await aiApi.officeThreads(file.id)
      setThreads(catalog)
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        toast.error(error instanceof Error ? error.message : t('officeEdit.chatFailed'))
      }
    } finally {
      setSending(false)
    }
  }

  const resendFrom = async (userMessageId: string, text: string) => {
    const trimmed = text.trim()
    if (!file || !threadId || !trimmed) return
    if (sending) await stopTurn()
    const index = messages.findIndex((item) => item.id === userMessageId)
    if (index < 0) return
    const prefix = messages.slice(0, index)
    setMessages(prefix)
    await aiApi.replaceOfficeMessages(
      file.id,
      threadId,
      prefix.map((item) => ({ role: item.role, text: item.text }))
    )
    await send(trimmed)
  }

  return (
    <Dialog open={Boolean(file)} onOpenChange={(open) => { if (!open) void shutdown() }}>
      <DialogContent className='office-stage flex h-[min(92vh,920px)] w-[min(1240px,calc(100%-20px))] max-w-none flex-col gap-0 overflow-hidden p-0 outline-none focus:outline-none focus-visible:outline-none sm:max-w-none'>
        <header className='office-stage-head relative z-[1]'>
          <div className='min-w-0'>
            <p className='ai-sheet-kicker'>{t('officeEdit.title')}</p>
            <DialogTitle className='office-stage-name'>{file?.displayName}</DialogTitle>
            <DialogDescription className='sr-only'>{t('officeEdit.empty')}</DialogDescription>
            {lock && !lock.officeCliReady ? (
              <p className='office-stage-note'>{t('officeEdit.cliMissing')}</p>
            ) : null}
          </div>
          <button type='button' className='office-stage-new' onClick={() => void createThread()}>
            {t('officeEdit.newThread')}
          </button>
        </header>
        <div className='office-stage-split relative z-[1] grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(320px,34%)_minmax(0,1fr)]'>
          <section className='office-stage-chat flex min-h-0 flex-col'>
            <div className='office-stage-threads'>
              {threads.map((item) => (
                <div
                  key={item.id}
                  className={cn('ai-sheet-tab shrink-0', item.id === threadId && 'ai-sheet-tab-on')}
                >
                  <button
                    type='button'
                    className='ai-sheet-tab-name'
                    onClick={() => void selectThread(item.id)}
                  >
                    {item.title || t('officeEdit.untitled')}
                  </button>
                  <button
                    type='button'
                    className='ai-sheet-tab-del'
                    aria-label={t('officeEdit.deleteThread')}
                    onClick={() => void removeThread(item.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div ref={logRef} className='min-h-0 flex-1 overflow-y-auto px-5 py-2'>
              {messages.length === 0 ? (
                <p className='ai-sheet-empty'>{t('officeEdit.empty')}</p>
              ) : (
                <div className='flex flex-col gap-5'>
                  {messages.map((item, index) => (
                    <div
                      key={item.id}
                      className={cn(
                        'ai-sheet-row',
                        item.role === 'user' ? 'ai-sheet-row-user' : 'ai-sheet-row-ai'
                      )}
                    >
                      {item.role !== 'user' && (index === 0 || messages[index - 1]?.role !== item.role) ? (
                        <span className='ai-sheet-who'>{t('officeEdit.title')}</span>
                      ) : null}
                      {item.role === 'user' && editingId === item.id ? (
                        <div className='ai-sheet-edit'>
                          <textarea
                            rows={3}
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className='ai-sheet-edit-field'
                          />
                          <div className='ai-sheet-edit-actions'>
                            <button type='button' className='ai-sheet-edit-cancel' onClick={() => setEditingId(null)}>
                              {t('officeEdit.cancelEdit')}
                            </button>
                            <button
                              type='button'
                              className='ai-sheet-go'
                              disabled={!editText.trim()}
                              onClick={() => {
                                const next = editText
                                setEditingId(null)
                                void resendFrom(item.id, next)
                              }}
                            >
                              {t('officeEdit.resend')}
                            </button>
                          </div>
                        </div>
                      ) : item.role === 'user' ? (
                        <button
                          type='button'
                          className='ai-sheet-bubble office-stage-say whitespace-pre-wrap'
                          onClick={() => {
                            setEditingId(item.id)
                            setEditText(item.text)
                          }}
                        >
                          {item.text}
                        </button>
                      ) : item.text ? (
                        <p className='office-stage-reply whitespace-pre-wrap'>{item.text}</p>
                      ) : sending && index === messages.length - 1 ? (
                        <span className='inline-flex items-center gap-1 py-1' aria-label={t('officeEdit.sending')}>
                          {[0, 1, 2].map((dot) => (
                            <span
                              key={dot}
                              className='size-1.5 rounded-full motion-safe:animate-bounce'
                              style={{ background: 'var(--ai-accent)', animationDelay: `${dot * 0.16}s` }}
                            />
                          ))}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <form
              className='ai-sheet-form office-stage-compose'
              onSubmit={(event) => {
                event.preventDefault()
                void send()
              }}
            >
              <textarea
                value={draft}
                rows={2}
                disabled={sending}
                placeholder={t('officeEdit.placeholder')}
                className='ai-sheet-field'
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void send()
                  }
                }}
              />
              {sending ? (
                <button type='button' className='ai-sheet-stop' onClick={() => void stopTurn()}>
                  {t('officeEdit.stop')}
                </button>
              ) : (
                <button type='submit' className='ai-sheet-go' disabled={!draft.trim() || !threadId}>
                  {t('officeEdit.send')}
                </button>
              )}
            </form>
          </section>
          <section className='office-stage-preview flex min-h-0 flex-col'>
            <div className='office-stage-well'>
              {file && blob ? (
                <div className='min-h-0 flex-1 overflow-hidden'>
                  <FilePreviewBody file={file} blob={blob} />
                </div>
              ) : (
                <p className='ai-sheet-empty px-5 py-8'>{t('officeEdit.loadingPreview')}</p>
              )}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
