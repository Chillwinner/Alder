/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckCircle2,
  FileUp,
  Inbox,
  Loader2,
  Lock,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { toast } from 'sonner'
import {
  checkFileCollectionUpload,
  completeFileCollectionSubmission,
  getFileCollectionUploadedChunks,
  getPublicFileCollection,
  initFileCollectionUpload,
  mergeFileCollectionUpload,
  startFileCollectionSubmission,
  uploadFileCollectionChunk,
} from '@/api/collection'
import type {
  FileCollectionPublic,
  FileCollectionSubmissionSession,
} from '@/types/collection'
import { calculateBlobMD5, calculateFileMD5 } from '@/utils/md5'
import { formatFileSize } from '@/utils/format'
import { FileIcon } from '@/components/file-icon'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Logo } from '@/components/logo'

type UploadStatus = 'ready' | 'preparing' | 'hashing' | 'uploading' | 'merging' | 'done' | 'failed'

interface UploadEntry {
  id: string
  file: File
  status: UploadStatus
  progress: number
  error?: string
}

const CHUNK_SIZE = 5 * 1024 * 1024
const CHUNK_CONCURRENCY = 3
const CHUNK_RETRIES = 3

function suffixOf(fileName: string) {
  return fileName.includes('.')
    ? fileName.split('.').pop()?.toLowerCase() || ''
    : ''
}

export default function FileCollectionPublicPage() {
  const { collectionId } = useParams<{ collectionId: string }>()
  const { t } = useTranslation('collection')
  const [collection, setCollection] = useState<FileCollectionPublic | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [submitterName, setSubmitterName] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [entries, setEntries] = useState<UploadEntry[]>([])
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const sessionRef = useRef<FileCollectionSubmissionSession | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadCollection = useCallback(async () => {
    if (!collectionId) return
    setLoading(true)
    setLoadError(false)
    try {
      setCollection(await getPublicFileCollection(collectionId))
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [collectionId])

  useEffect(() => {
    void loadCollection()
  }, [loadCollection])

  const allowedExtensions = useMemo(
    () =>
      new Set(
        (collection?.allowedExtensions || '')
          .split(',')
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean)
      ),
    [collection?.allowedExtensions]
  )

  const accept = useMemo(
    () =>
      allowedExtensions.size > 0
        ? [...allowedExtensions].map((extension) => `.${extension}`).join(',')
        : undefined,
    [allowedExtensions]
  )

  const updateEntry = (id: string, patch: Partial<UploadEntry>) => {
    setEntries((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry))
    )
  }

  const addFiles = (fileList: FileList | File[]) => {
    if (!collection || uploading) return
    const incoming = Array.from(fileList)
    if (entries.length + incoming.length > 1000) {
      toast.error(t('public.tooManyFiles'))
      return
    }

    const existingKeys = new Set(
      entries.map((entry) => `${entry.file.name}:${entry.file.size}:${entry.file.lastModified}`)
    )
    const next: UploadEntry[] = []
    for (const file of incoming) {
      if (file.size > collection.maxFileSize) {
        toast.error(t('public.fileTooLarge', { name: file.name }))
        continue
      }
      const extension = file.name.includes('.')
        ? file.name.split('.').pop()?.toLowerCase() || ''
        : ''
      if (allowedExtensions.size > 0 && !allowedExtensions.has(extension)) {
        toast.error(t('public.typeNotAllowed', { name: file.name }))
        continue
      }
      const key = `${file.name}:${file.size}:${file.lastModified}`
      if (existingKeys.has(key)) continue
      existingKeys.add(key)
      next.push({
        id: `${crypto.randomUUID?.() || Date.now()}-${next.length}`,
        file,
        status: 'ready',
        progress: 0,
      })
    }
    setEntries((current) => [...current, ...next])
  }

  const uploadChunkWithRetry = async (
    session: FileCollectionSubmissionSession,
    taskId: string,
    file: File,
    chunkIndex: number
  ) => {
    const start = chunkIndex * CHUNK_SIZE
    const chunk = file.slice(start, Math.min(start + CHUNK_SIZE, file.size))
    const chunkMd5 = await calculateBlobMD5(chunk)
    let lastError: unknown
    for (let attempt = 0; attempt < CHUNK_RETRIES; attempt += 1) {
      try {
        await uploadFileCollectionChunk(
          collectionId!,
          session.submissionId,
          session.uploadToken,
          taskId,
          chunkIndex,
          chunkMd5,
          chunk
        )
        return
      } catch (error) {
        lastError = error
        if (attempt < CHUNK_RETRIES - 1) {
          await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)))
        }
      }
    }
    throw lastError
  }

  const uploadOne = async (
    entry: UploadEntry,
    session: FileCollectionSubmissionSession
  ) => {
    const { file } = entry
    updateEntry(entry.id, { status: 'preparing', progress: 2, error: undefined })
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
    const taskId = await initFileCollectionUpload(
      collectionId!,
      session.submissionId,
      session.uploadToken,
      {
        fileName: file.name,
        fileSize: file.size,
        totalChunks,
        chunkSize: CHUNK_SIZE,
        mimeType: file.type || 'application/octet-stream',
      }
    )

    updateEntry(entry.id, { status: 'hashing', progress: 5 })
    const fileMd5 = await calculateFileMD5(file)
    const check = await checkFileCollectionUpload(
      collectionId!,
      session.submissionId,
      session.uploadToken,
      taskId,
      fileMd5,
      file.name
    )
    if (check.isQuickUpload) {
      updateEntry(entry.id, { status: 'done', progress: 100 })
      return
    }

    const uploaded = new Set(
      await getFileCollectionUploadedChunks(
        collectionId!,
        session.submissionId,
        session.uploadToken,
        taskId
      )
    )
    let uploadedCount = uploaded.size
    const pending = Array.from({ length: totalChunks }, (_, index) => index).filter(
      (index) => !uploaded.has(index)
    )
    let cursor = 0
    updateEntry(entry.id, {
      status: 'uploading',
      progress: totalChunks === 0 ? 90 : 10 + (uploadedCount / totalChunks) * 80,
    })

    const worker = async () => {
      while (cursor < pending.length) {
        const current = cursor
        cursor += 1
        const chunkIndex = pending[current]
        await uploadChunkWithRetry(session, taskId, file, chunkIndex)
        uploadedCount += 1
        updateEntry(entry.id, {
          status: 'uploading',
          progress: 10 + (uploadedCount / totalChunks) * 80,
        })
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(CHUNK_CONCURRENCY, pending.length) }, () => worker())
    )

    updateEntry(entry.id, { status: 'merging', progress: 95 })
    await mergeFileCollectionUpload(
      collectionId!,
      session.submissionId,
      session.uploadToken,
      taskId
    )
    updateEntry(entry.id, { status: 'done', progress: 100 })
  }

  const handleUpload = async () => {
    if (!collection || !collectionId) return
    if (!submitterName.trim()) {
      toast.warning(t('public.nameRequired'))
      return
    }
    if (collection.hasAccessCode && !accessCode.trim()) {
      toast.warning(t('public.codeRequired'))
      return
    }
    if (entries.length === 0) {
      toast.warning(t('public.filesRequired'))
      return
    }

    setUploading(true)
    let failed = false
    try {
      let session = sessionRef.current
      if (!session) {
        try {
          session = await startFileCollectionSubmission(
            collectionId,
            submitterName.trim(),
            accessCode.trim() || undefined
          )
          sessionRef.current = session
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : t('public.sessionFailed')
          )
          return
        }
      }

      const pendingEntries = entries.filter((entry) => entry.status !== 'done')
      for (const entry of pendingEntries) {
        try {
          await uploadOne(entry, session)
        } catch (error) {
          failed = true
          updateEntry(entry.id, {
            status: 'failed',
            error: error instanceof Error ? error.message : t('public.failed'),
          })
        }
      }

      if (!failed) {
        await completeFileCollectionSubmission(
          collectionId,
          session.submissionId,
          session.uploadToken
        )
        setSuccess(true)
        sessionRef.current = null
      } else {
        toast.error(t('public.someFailed'))
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('public.someFailed'))
    } finally {
      setUploading(false)
    }
  }

  const resetSubmission = () => {
    setEntries([])
    setSuccess(false)
    setSubmitterName('')
    setAccessCode('')
    sessionRef.current = null
  }

  if (loading) {
    return (
      <div className='relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background px-4'>
        <div aria-hidden='true' className='a-ambient absolute inset-0 z-0' />
        <div className='a-glass tech-rise relative z-10 flex w-full max-w-md flex-col items-center gap-4 rounded-[28px] px-10 py-14'>
          <Loader2 className='size-7 animate-spin text-primary' />
        </div>
      </div>
    )
  }

  if (loadError || !collection) {
    return (
      <div className='relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background px-4'>
        <div aria-hidden='true' className='a-ambient absolute inset-0 z-0' />
        <div className='a-glass tech-rise relative z-10 w-full max-w-md rounded-[28px] px-8 py-12 text-center'>
          <span className='mx-auto mb-6 flex size-14 items-center justify-center rounded-[18px] bg-destructive/10 text-destructive'>
            <XCircle className='size-7' strokeWidth={1.7} />
          </span>
          <p className='tech-eyebrow'>{t('public.title')}</p>
          <h1 className='mt-2 text-[28px] leading-tight font-semibold tracking-tight'>
            {t('public.notFound')}
          </h1>
          <button
            className='a-btn a-btn--primary a-btn--block mt-8'
            onClick={() => void loadCollection()}
          >
            {t('public.retry')}
          </button>
        </div>
      </div>
    )
  }

  const unavailable = collection.status !== 'OPEN' || collection.expired
  const totalSize = entries.reduce((sum, entry) => sum + entry.file.size, 0)

  return (
    <div className='relative min-h-screen w-full overflow-hidden bg-background'>
      <div aria-hidden='true' className='a-ambient absolute inset-0 z-0' />

      <div className='relative z-10 mx-auto w-full max-w-3xl px-5 pt-7 pb-16 md:px-6'>
        <div className='flex items-center justify-between gap-4'>
          <div className='a-brandline'>
            <span className='a-brandline__mark'>
              <Logo className='size-[18px]' />
            </span>
            <span className='a-brandline__name'>Alder</span>
          </div>
          <span className='a-tag'>
            <Inbox className='size-3.5' strokeWidth={1.8} />
            {unavailable
              ? collection.expired
                ? t('public.expired')
                : t('public.closed')
              : t('manager.open')}
          </span>
        </div>

        <div className='a-page mt-10'>
          <header className='a-phead'>
            <div className='min-w-0'>
              <span className='font-mono text-[11px] tracking-wider text-text-muted uppercase'>
                {t('public.title')}
              </span>
              <h1 className='mt-2 break-words'>{collection.collectionName}</h1>
              <p className='a-sub'>
                {t('public.poweredBy')}
                {collection.expireTime ? (
                  <>
                    {' · '}
                    <span className='font-mono tabular-nums'>
                      {t('manager.expire')}{' '}
                      {dayjs(collection.expireTime).format('YYYY-MM-DD HH:mm')}
                    </span>
                  </>
                ) : null}
              </p>
            </div>
          </header>

          {unavailable ? (
            <div className='a-glass tech-rise flex flex-col items-center gap-4 rounded-[24px] px-6 py-12 text-center'>
              <span className='flex size-14 items-center justify-center rounded-[18px] bg-destructive/10 text-destructive'>
                <XCircle className='size-7' strokeWidth={1.7} />
              </span>
              <p className='text-[15px] font-semibold tracking-tight'>
                {collection.expired ? t('public.expired') : t('public.closed')}
              </p>
            </div>
          ) : success ? (
            <div className='a-glass tech-rise flex flex-col items-center gap-4 rounded-[24px] px-6 py-12 text-center'>
              <span className='flex size-16 items-center justify-center rounded-[20px] bg-success/10 text-success'>
                <CheckCircle2 className='size-8' strokeWidth={1.7} />
              </span>
              <h2 className='text-[30px] leading-tight font-semibold tracking-tight'>
                {t('public.successTitle')}
              </h2>
              <p className='max-w-sm text-[13.5px] leading-relaxed text-text-secondary'>
                {t('public.successDescription')}
              </p>
              <button
                className='a-btn a-btn--primary mt-2'
                onClick={resetSubmission}
              >
                {t('public.submitMore')}
              </button>
            </div>
          ) : (
            <>
              {/* 提交者信息 */}
              <section className='a-glass tech-rise rounded-[24px] px-5 py-5 md:px-6'>
                <div className='grid gap-4 md:grid-cols-2'>
                  <div className='a-field'>
                    <label htmlFor='submitter-name'>{t('public.submitterName')}</label>
                    <div className='a-input'>
                      <FileUp className='size-[18px]' strokeWidth={1.8} />
                      <Input
                        id='submitter-name'
                        value={submitterName}
                        disabled={uploading || Boolean(sessionRef.current)}
                        maxLength={64}
                        placeholder={t('public.submitterPlaceholder')}
                        onChange={(event) => setSubmitterName(event.target.value)}
                        className='h-full rounded-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0'
                      />
                    </div>
                  </div>

                  {collection.hasAccessCode && (
                    <div className='a-field'>
                      <label htmlFor='collection-access-code'>
                        {t('public.accessCode')}
                      </label>
                      <div className='a-input'>
                        <Lock className='size-[18px]' strokeWidth={1.8} />
                        <Input
                          id='collection-access-code'
                          value={accessCode}
                          disabled={uploading || Boolean(sessionRef.current)}
                          maxLength={32}
                          placeholder={t('public.accessCodePlaceholder')}
                          onChange={(event) => setAccessCode(event.target.value)}
                          className='h-full rounded-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0'
                        />
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* 上传区 */}
              <input
                ref={fileInputRef}
                type='file'
                multiple
                accept={accept}
                className='hidden'
                onChange={(event) => event.target.files && addFiles(event.target.files)}
              />
              <button
                type='button'
                disabled={uploading}
                className='flex w-full flex-col items-center rounded-[28px] border border-dashed border-border-strong bg-surface-secondary/40 px-6 py-11 text-center transition-colors hover:border-primary/60 hover:bg-accent-soft/40 disabled:cursor-not-allowed disabled:opacity-60'
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  addFiles(event.dataTransfer.files)
                }}
              >
                <span className='mb-5 flex size-16 items-center justify-center rounded-[20px] bg-surface text-primary shadow-sm'>
                  <FileUp className='size-7' strokeWidth={1.7} />
                </span>
                <span className='text-[17px] leading-tight font-semibold tracking-tight text-foreground'>
                  把文件拖到这里
                </span>
                <span className='mt-2 max-w-md text-[13px] leading-relaxed text-text-secondary'>
                  {t('public.dropHint')}
                </span>
                <span className='a-btn a-btn--primary mt-5'>
                  {t('public.chooseFiles')}
                </span>
              </button>

              {/* 限制说明 */}
              <div className='flex flex-wrap gap-2'>
                <span className='a-tag font-mono tabular-nums'>
                  {t('public.maxSize', { size: formatFileSize(collection.maxFileSize) })}
                </span>
                <span className='a-tag'>
                  {allowedExtensions.size > 0
                    ? t('public.allowedTypes', { types: [...allowedExtensions].join(', ') })
                    : t('public.allTypes')}
                </span>
              </div>

              {/* 已提交列表 */}
              {entries.length > 0 && (
                <section className='a-glass tech-rise overflow-hidden rounded-[24px]'>
                  <div className='flex items-center justify-between gap-3 border-b border-divider px-5 py-3.5'>
                    <p className='text-[14.5px] font-semibold tracking-tight'>
                      {t('public.selected', { count: entries.length })}
                    </p>
                    <p className='font-mono text-[12px] tabular-nums text-text-muted'>
                      {formatFileSize(totalSize)}
                    </p>
                  </div>

                  <div className='max-h-72 divide-y divide-divider overflow-y-auto'>
                    {entries.map((entry) => (
                      <div
                        key={entry.id}
                        className='flex items-start gap-3.5 px-5 py-3.5 transition-colors hover:bg-surface-hover'
                      >
                        <span className='mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-surface-secondary'>
                          <FileIcon
                            type={suffixOf(entry.file.name) || 'unknown'}
                            size={22}
                          />
                        </span>

                        <div className='min-w-0 flex-1'>
                          <div className='flex items-center justify-between gap-3'>
                            <span className='truncate text-[13.5px] font-medium'>
                              {entry.file.name}
                            </span>
                            <span className='shrink-0 font-mono text-[12px] tabular-nums text-text-muted'>
                              {formatFileSize(entry.file.size)}
                            </span>
                          </div>
                          <div className='mt-2 flex items-center gap-2.5'>
                            <Progress value={entry.progress} className='h-1.5 flex-1' />
                            <span className='w-16 text-right font-mono text-[11px] tracking-wide text-text-muted'>
                              {t(`public.${entry.status}`)}
                            </span>
                          </div>
                          {entry.error && (
                            <p className='mt-1.5 text-[12px] text-destructive'>
                              {entry.error}
                            </p>
                          )}
                        </div>

                        {!uploading && entry.status !== 'done' && (
                          <button
                            type='button'
                            className='flex size-8 shrink-0 items-center justify-center rounded-[10px] text-text-muted transition-colors hover:bg-surface-active hover:text-destructive'
                            onClick={() =>
                              setEntries((current) =>
                                current.filter((item) => item.id !== entry.id)
                              )
                            }
                          >
                            <Trash2 className='size-4' strokeWidth={1.8} />
                            <span className='sr-only'>{t('public.remove')}</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 投稿说明 */}
              <section className='rounded-[18px] border border-border bg-surface-secondary/50 px-4 py-4'>
                <div className='flex items-start gap-3'>
                  <span className='flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-accent-soft text-primary'>
                    <ShieldCheck className='size-[17px]' strokeWidth={1.8} />
                  </span>
                  <div className='min-w-0'>
                    <p className='text-[14px] font-semibold tracking-tight'>投稿说明</p>
                    <p className='mt-1 text-[12.5px] leading-relaxed text-text-secondary'>
                      提交的文件会直接归入发起人的收集文件夹，你可以多次提交。
                    </p>
                    <p className='mt-1.5 font-mono text-[11.5px] tracking-wide text-text-muted tabular-nums'>
                      {t('public.maxSize', { size: formatFileSize(collection.maxFileSize) })}
                      {' · '}
                      {allowedExtensions.size > 0
                        ? t('public.allowedTypes', {
                            types: [...allowedExtensions].join(', '),
                          })
                        : t('public.allTypes')}
                    </p>
                  </div>
                </div>
              </section>

              <button
                className='a-btn a-btn--primary a-btn--block a-btn--lg'
                disabled={uploading}
                onClick={() => void handleUpload()}
              >
                {uploading ? (
                  <>
                    <Loader2 className='size-4 animate-spin' />
                    {t('public.uploading')}
                  </>
                ) : (
                  <>
                    <FileUp className='size-4' strokeWidth={1.8} />
                    {t('public.upload')}
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
