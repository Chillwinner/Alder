/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useCallback, useEffect, useState } from 'react'
import dayjs from 'dayjs'
import {
  Copy,
  ExternalLink,
  Inbox,
  MoreHorizontal,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  deleteFileCollection,
  getFileCollectionPage,
  getFileCollectionSubmissions,
  updateFileCollectionStatus,
} from '@/api/collection'
import { sendImMessage } from '@/api/im'
import type {
  FileCollection,
  FileCollectionStatus,
  FileCollectionSubmission,
} from '@/types/collection'
import { FileLibrarySkeleton } from './FileLibrarySkeleton'
import { copyTextToClipboard } from '@/utils/copy-to-clipboard'
import { formatFileSize } from '@/utils/format'
import { usePermission } from '@/hooks/use-permission'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuGroup } from '@/components/ui/dropdown-menu'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue, SelectGroup } from '@/components/ui/select'
import { SidebarTrigger } from '@/components/ui/sidebar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function MyCollectionsView() {
  const { t } = useTranslation('collection')
  const { t: tc } = useTranslation('common')
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()
  const { hasPermission } = usePermission()
  const canShare = hasPermission('file:share')
  const canWrite = hasPermission('file:write')
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<'ALL' | FileCollectionStatus>('ALL')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [collections, setCollections] = useState<FileCollection[]>([])

  const [recordsOpen, setRecordsOpen] = useState(false)
  const [activeCollection, setActiveCollection] = useState<FileCollection | null>(null)
  const [records, setRecords] = useState<FileCollectionSubmission[]>([])
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [recordsPage, setRecordsPage] = useState(1)
  const [recordsTotal, setRecordsTotal] = useState(0)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingCollection, setDeletingCollection] =
    useState<FileCollection | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchCollections = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getFileCollectionPage({
        keyword: keyword || undefined,
        status: status === 'ALL' ? undefined : status,
        page,
        pageSize,
        orderBy: 'createdAt',
        orderDirection: 'DESC',
      })
      setCollections(result.records)
      setTotal(Number(result.total || 0))
    } finally {
      setLoading(false)
    }
  }, [keyword, page, pageSize, status])

  useEffect(() => {
    // The fetch updates loading/data state after synchronizing with the API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchCollections()
  }, [fetchCollections])

  const fetchRecords = useCallback(async () => {
    if (!activeCollection) return
    setRecordsLoading(true)
    try {
      const result = await getFileCollectionSubmissions(activeCollection.id, {
        page: recordsPage,
        pageSize: 10,
      })
      setRecords(result.records)
      setRecordsTotal(Number(result.total || 0))
    } finally {
      setRecordsLoading(false)
    }
  }, [activeCollection, recordsPage])

  useEffect(() => {
    if (recordsOpen) {
      // The fetch updates loading/data state after synchronizing with the API.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void fetchRecords()
    }
  }, [recordsOpen, fetchRecords])

  const collectionUrl = (collection: FileCollection) =>
    `${window.location.origin}/collect/${collection.id}`

  const handleCopyLink = async (collection: FileCollection) => {
    await copyTextToClipboard(collectionUrl(collection))
    toast.success(t('manager.copied'))
  }

  const handleNudge = async (collection: FileCollection) => {
    const ids = collection.assigneeUserIds ?? []
    if (ids.length === 0) return
    const text = t('manager.nudgeText', { url: collectionUrl(collection) })
    await Promise.allSettled(
      ids.map((friendId) =>
        sendImMessage({
          friendId,
          clientMsgId: crypto.randomUUID(),
          content: text,
        })
      )
    )
    toast.success(t('manager.nudged'))
  }

  const handleStatus = async (collection: FileCollection) => {
    const nextStatus: FileCollectionStatus =
      collection.status === 'OPEN' ? 'CLOSED' : 'OPEN'
    if (nextStatus === 'OPEN' && !canWrite) return
    await updateFileCollectionStatus(collection.id, nextStatus)
    toast.success(t('manager.statusUpdated'))
    void fetchCollections()
  }

  const requestDelete = (collection: FileCollection) => {
    setDeletingCollection(collection)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!deletingCollection || deleting) return

    const collection = deletingCollection
    setDeleting(true)
    try {
      await deleteFileCollection(collection.id)
      toast.success(t('manager.deleted'))
      setDeleteDialogOpen(false)
      setDeletingCollection(null)

      if (activeCollection?.id === collection.id) {
        setRecordsOpen(false)
        setActiveCollection(null)
      }

      const shouldGoToPreviousPage = collections.length === 1 && page > 1
      setCollections((current) =>
        current.filter((item) => item.id !== collection.id)
      )
      setTotal((current) => Math.max(0, current - 1))

      if (shouldGoToPreviousPage) {
        setPage((current) => Math.max(1, current - 1))
      } else {
        void fetchCollections()
      }
    } catch (error: unknown) {
      const handled =
        typeof error === 'object' &&
        error !== null &&
        'handled' in error &&
        error.handled === true
      if (!handled) toast.error(t('manager.deleteFailed'))
    } finally {
      setDeleting(false)
    }
  }

  const openRecords = (collection: FileCollection) => {
    setActiveCollection(collection)
    setRecords([])
    setRecordsPage(1)
    setRecordsOpen(true)
  }

  const effectiveStatus = (collection: FileCollection) => {
    if (collection.expired) return 'expired'
    return collection.status === 'OPEN' ? 'open' : 'closed'
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const recordPages = Math.max(1, Math.ceil(recordsTotal / 10))

  return (
    <div className='flex h-full flex-col gap-3 overflow-hidden'>
      {/* 与文件页共用同一套页头骨架（.a-phead / .a-eyebrow / .a-sub） */}
      <header className='a-phead shrink-0'>
        <div className='min-w-0'>
          <div className='flex items-center gap-2'>
            <SidebarTrigger className='md:hidden' />
            <p className='a-eyebrow'>我的收藏</p>
          </div>
          <h1 className='truncate'>{t('manager.title')}</h1>
          <p className='a-sub'>{t('manager.subtitle')}</p>
        </div>
        <div className='a-phead__right min-w-0'>
          <div className='group relative w-full min-w-0 sm:w-56'>
            <Search className='pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-muted transition-colors group-focus-within:text-primary' strokeWidth={1.9} />
            <Input
              value={keywordInput}
              className='h-9 rounded-full border-transparent bg-surface-secondary pl-9 text-[13px] shadow-none transition-[background-color,border-color,box-shadow] duration-200 hover:bg-surface-hover focus-visible:border-primary/70 focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-accent-soft'
              placeholder={t('manager.searchPlaceholder')}
              onChange={(event) => setKeywordInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  setPage(1)
                  setKeyword(keywordInput.trim())
                }
              }}
            />
          </div>
          <Select
            value={status}
            onValueChange={(value) => {
              setPage(1)
              setStatus(value as typeof status)
            }}
          >
            <SelectTrigger className='a-btn a-btn--sm a-btn--ghost w-auto min-w-[104px] gap-1.5 border-0 text-text-secondary shadow-none'><SelectValue /></SelectTrigger>
            <SelectContent>
<SelectGroup>
              <SelectItem value='ALL'>{t('manager.allStatus')}</SelectItem>
              <SelectItem value='OPEN'>{t('manager.open')}</SelectItem>
              <SelectItem value='CLOSED'>{t('manager.closed')}</SelectItem>
            </SelectGroup>
</SelectContent>
          </Select>
          <Button
            variant='ghost'
            size='icon'
            className='size-9 shrink-0 rounded-full text-text-muted transition-colors hover:bg-surface-hover hover:text-foreground'
            onClick={() => void fetchCollections()}
          >
            <RefreshCw className='size-4' strokeWidth={1.9} />
          </Button>
        </div>
      </header>

      <div className='flex-1 overflow-auto pb-6'>
        {loading ? (
          <FileLibrarySkeleton variant='list' rows={6} />
        ) : collections.length === 0 ? (
          <div className='flex h-full items-center justify-center'>
            <Empty>
              <EmptyHeader className='tech-rise gap-3'>
                <EmptyMedia variant='icon' className='bg-accent-soft text-primary'><Inbox className='size-8' /></EmptyMedia>
                <EmptyTitle className='text-[15px] font-semibold tracking-tight'>{t('manager.empty')}</EmptyTitle>
                <EmptyDescription className='max-w-prose text-[13.5px] leading-relaxed text-muted-foreground'>{t('manager.emptyHint')}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : (
          <div className='glass-card hud-corners overflow-hidden rounded-[18px]'>
            <Table>
              <TableHeader className='[&_tr]:border-b [&_tr]:border-border/70'>
                <TableRow className='hover:bg-transparent'>
                  <TableHead className='font-mono text-[10.5px] tracking-[0.16em] text-text-muted uppercase'>{t('manager.name')}</TableHead>
                  <TableHead className='font-mono text-[10.5px] tracking-[0.16em] text-text-muted uppercase'>{t('manager.target')}</TableHead>
                  <TableHead className='font-mono text-[10.5px] tracking-[0.16em] text-text-muted uppercase'>{t('manager.expire')}</TableHead>
                  <TableHead className='text-center font-mono text-[10.5px] tracking-[0.16em] text-text-muted uppercase'>{t('manager.submissions')}</TableHead>
                  <TableHead className='text-center font-mono text-[10.5px] tracking-[0.16em] text-text-muted uppercase'>{t('manager.files')}</TableHead>
                  <TableHead className='font-mono text-[10.5px] tracking-[0.16em] text-text-muted uppercase'>{t('manager.size')}</TableHead>
                  <TableHead className='w-16 text-right font-mono text-[10.5px] tracking-[0.16em] text-text-muted uppercase'>{t('manager.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collections.map((collection) => {
                  const state = effectiveStatus(collection)
                  return (
                    <TableRow key={collection.id} className='tech-rise transition-colors duration-150 hover:bg-surface-hover'>
                      <TableCell>
                        <div className='max-w-64'>
                          <div className='truncate text-[13.5px] font-semibold tracking-[-0.012em] text-foreground'>{collection.collectionName}</div>
                          {(collection.assigneeUserIds?.length ?? 0) > 0 ? (
                            <p className='mt-0.5 text-[11px] text-muted-foreground'>
                              {t('manager.assigneeCount', {
                                count: collection.assigneeUserIds?.length ?? 0,
                              })}
                            </p>
                          ) : null}
                          <Badge
                            variant={state === 'open' ? 'default' : 'secondary'}
                            className='mt-1 rounded-full font-mono text-[10.5px] tracking-[0.1em]'
                          >
                            {t(`manager.${state}`)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className='max-w-48 truncate text-text-secondary'>{collection.targetFolderName}</TableCell>
                      <TableCell className='font-mono text-[11.5px] tabular-nums text-text-secondary'>
                        {collection.expireTime
                          ? dayjs(collection.expireTime).format('YYYY-MM-DD HH:mm')
                          : t('manager.permanent')}
                      </TableCell>
                      <TableCell className='text-center font-mono text-[11.5px] tabular-nums text-text-secondary'>{collection.submissionCount}</TableCell>
                      <TableCell className='text-center font-mono text-[11.5px] tabular-nums text-text-secondary'>{collection.fileCount}</TableCell>
                      <TableCell className='font-mono text-[11.5px] tabular-nums text-text-secondary'>{formatFileSize(collection.totalSize || 0)}</TableCell>
                      <TableCell className='text-right'>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant='ghost' size='icon' className='size-8 rounded-full text-text-muted transition-colors hover:bg-surface-hover hover:text-foreground'><MoreHorizontal /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align='end'>
<DropdownMenuGroup>
                            <DropdownMenuItem onClick={() => void handleCopyLink(collection)}>
                              <Copy className='size-4' />{t('manager.copyLink')}
                            </DropdownMenuItem>
                            {(collection.assigneeUserIds?.length ?? 0) > 0 ? (
                              <DropdownMenuItem onClick={() => void handleNudge(collection)}>
                                <Inbox className='size-4' />{t('manager.nudge')}
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem onClick={() => openRecords(collection)}>
                              <Inbox className='size-4' />{t('manager.records')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={collection.status === 'CLOSED' && !canWrite}
                              onClick={() => void handleStatus(collection)}
                            >
                              <RefreshCw className='size-4' />
                              {collection.status === 'OPEN' ? t('manager.close') : t('manager.reopen')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={!canShare || !canWrite}
                              className='text-destructive focus:text-destructive'
                              onClick={() => requestDelete(collection)}
                            >
                              <Trash2 className='size-4' />
                              {t('manager.delete')}
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
</DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {collections.length > 0 && (
        <div className='flex items-center justify-end gap-3 border-t border-border/60 px-4 py-3'>
          <Button className='a-btn a-btn--sm a-btn--ghost border-0 shadow-none' variant='outline' size='sm' disabled={page <= 1} onClick={() => setPage((v) => v - 1)}>
            {t('manager.previous')}
          </Button>
          <span className='font-mono text-[11.5px] tabular-nums text-text-muted'>{t('manager.page', { page })}</span>
          <Button className='a-btn a-btn--sm a-btn--ghost border-0 shadow-none' variant='outline' size='sm' disabled={page >= totalPages} onClick={() => setPage((v) => v + 1)}>
            {t('manager.next')}
          </Button>
        </div>
      )}

      <Dialog open={recordsOpen} onOpenChange={setRecordsOpen}>
        <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-4xl'>
          <DialogHeader>
            <DialogTitle>
              {t('manager.records')} · {activeCollection?.collectionName}
            </DialogTitle>
          </DialogHeader>
          {recordsLoading ? (
            <FileLibrarySkeleton variant='list' rows={4} />
          ) : records.length === 0 ? (
            <div className='py-12 text-center text-[13.5px] text-muted-foreground'>{t('manager.noRecords')}</div>
          ) : (
            <Table>
              <TableHeader className='[&_tr]:border-b [&_tr]:border-border'>
                <TableRow className='hover:bg-transparent'>
                  <TableHead className='font-mono text-[10.5px] tracking-[0.16em] text-text-muted uppercase'>{t('manager.submitter')}</TableHead>
                  <TableHead className='font-mono text-[10.5px] tracking-[0.16em] text-text-muted uppercase'>{t('manager.submittedAt')}</TableHead>
                  <TableHead className='font-mono text-[10.5px] tracking-[0.16em] text-text-muted uppercase'>{t('manager.completedAt')}</TableHead>
                  <TableHead className='font-mono text-[10.5px] tracking-[0.16em] text-text-muted uppercase'>{t('manager.files')}</TableHead>
                  <TableHead className='font-mono text-[10.5px] tracking-[0.16em] text-text-muted uppercase'>{t('manager.size')}</TableHead>
                  <TableHead className='font-mono text-[10.5px] tracking-[0.16em] text-text-muted uppercase'>{t('manager.ip')}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id} className='tech-rise transition-colors duration-150 hover:bg-surface-hover'>
                    <TableCell>
                      <div className='text-[13.5px] font-semibold tracking-[-0.012em] text-foreground'>{record.submitterName}</div>
                      <Badge variant='secondary' className='mt-1 rounded-full font-mono text-[10.5px] tracking-[0.1em]'>
                        {record.status === 'COMPLETED' ? t('manager.completed') : t('manager.uploading')}
                      </Badge>
                    </TableCell>
                    <TableCell className='font-mono text-[11.5px] tabular-nums text-text-secondary'>{dayjs(record.createdAt).format('YYYY-MM-DD HH:mm')}</TableCell>
                    <TableCell className='font-mono text-[11.5px] tabular-nums text-text-secondary'>{record.completedAt ? dayjs(record.completedAt).format('YYYY-MM-DD HH:mm') : '-'}</TableCell>
                    <TableCell className='font-mono text-[11.5px] tabular-nums text-text-secondary'>{record.fileCount}</TableCell>
                    <TableCell className='font-mono text-[11.5px] tabular-nums text-text-secondary'>{formatFileSize(record.totalSize || 0)}</TableCell>
                    <TableCell className='font-mono text-[11.5px] tabular-nums text-text-secondary'>{record.submitterIp || '-'}</TableCell>
                    <TableCell className='text-right'>
                      <Button
                        variant='ghost'
                        size='sm'
                        className='a-btn a-btn--sm a-btn--ghost'
                        onClick={() => {
                          setRecordsOpen(false)
                          navigate(`/w/${slug}/files?parentId=${record.folderId}`)
                        }}
                      >
                        <ExternalLink className='mr-2 size-4' />
                        {t('manager.openFolder')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {recordsTotal > 0 && (
            <div className='flex items-center justify-end gap-3 pt-3'>
              <Button className='a-btn a-btn--sm a-btn--ghost border-0 shadow-none' variant='outline' size='sm' disabled={recordsPage <= 1} onClick={() => setRecordsPage((v) => v - 1)}>
                {t('manager.previous')}
              </Button>
              <span className='font-mono text-[11.5px] tabular-nums text-text-muted'>{t('manager.page', { page: recordsPage })}</span>
              <Button className='a-btn a-btn--sm a-btn--ghost border-0 shadow-none' variant='outline' size='sm' disabled={recordsPage >= recordPages} onClick={() => setRecordsPage((v) => v + 1)}>
                {t('manager.next')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open)
          if (!open && !deleting) setDeletingCollection(null)
        }}
        title={t('manager.deleteTitle')}
        desc={t('manager.deleteDescription', {
          name: deletingCollection?.collectionName ?? '',
        })}
        cancelBtnText={tc('cancel')}
        confirmText={deleting ? t('manager.deleting') : t('manager.delete')}
        destructive
        isLoading={deleting}
        handleConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
