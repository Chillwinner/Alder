/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { Search, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { getOperationLogs } from '@/api/log'
import type {
  OperationLogItem,
  OperationLogStatus,
} from '@/types/log'
import { formatOperationLogDetail } from '@/utils/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue, SelectGroup } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  SettingsPageDescription,
  SettingsPageEyebrow,
  SettingsPageTitle,
} from '../components/settings-page-header'

const PAGE_SIZE = 20

const OPERATION_TYPES = [
  'UPLOAD',
  'DOWNLOAD',
  'CREATE_FOLDER',
  'COPY',
  'MOVE',
  'RENAME',
  'DELETE',
  'RESTORE',
  'PERMANENT_DELETE',
  'CLEAR_RECYCLE',
  'CREATE_SHARE',
  'CANCEL_SHARE',
  'CREATE_COLLECTION',
  'UPDATE_COLLECTION',
  'DELETE_COLLECTION',
  'COLLECTION_UPLOAD',
  'CREATE_WORKSPACE',
  'UPDATE_WORKSPACE',
  'DELETE_WORKSPACE',
  'UPDATE_MEMBER_ROLE',
  'REMOVE_MEMBER',
  'CREATE_INVITATION',
  'CANCEL_INVITATION',
  'CREATE_ROLE',
  'UPDATE_ROLE',
  'DELETE_ROLE',
  'ADD_STORAGE',
  'UPDATE_STORAGE',
  'SWITCH_STORAGE',
  'DELETE_STORAGE',
] as const

function displayValue(value?: string | null) {
  return value?.trim() || '—'
}

function isHandledError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'handled' in error &&
    error.handled === true
  )
}

export function SettingsLogs() {
  const { t } = useTranslation('settings')
  const [logs, setLogs] = useState<OperationLogItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [operationType, setOperationType] = useState('ALL')
  const [status, setStatus] = useState('ALL')
  const [loading, setLoading] = useState(false)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getOperationLogs({
        page,
        pageSize: PAGE_SIZE,
        keyword: keyword || undefined,
        operationType:
          operationType === 'ALL' ? undefined : operationType,
        status:
          status === 'ALL' ? undefined : (Number(status) as OperationLogStatus),
      })
      setLogs(result?.records ?? [])
      setTotal(result?.total ?? 0)
    } catch (error: unknown) {
      if (!isHandledError(error)) toast.error(t('logs.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [keyword, operationType, page, status, t])

  useEffect(() => {
    // 筛选条件变化后需要主动请求服务端数据。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchLogs()
  }, [fetchLogs])

  const operationLabel = useMemo(
    () => (type: string, fallback?: string) => {
      const key = `logs.operationTypes.${type}`
      const translated = t(key)
      return translated === key ? displayValue(fallback) : translated
    },
    [t]
  )

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault()
    setPage(1)
    setKeyword(keywordInput.trim())
  }

  const handleFilterChange = (setter: (value: string) => void, value: string) => {
    setter(value)
    setPage(1)
  }

  return (
    <div className='flex flex-1 flex-col'>
      <header className='flex flex-col mb-6 flex-none gap-1.5'>
        <SettingsPageEyebrow>{t('nav.logs')}</SettingsPageEyebrow>
        <SettingsPageTitle>{t('logs.pageTitle')}</SettingsPageTitle>
        <SettingsPageDescription>
          {t('logs.pageDescription')}
        </SettingsPageDescription>
      </header>

      <div className='flex flex-1 flex-col'>
        <form
          onSubmit={handleSearch}
          className='set-group mb-4 flex w-full flex-wrap items-center gap-2 p-4'
        >
          <div className='relative min-w-[180px] flex-1'>
            <Search className='absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted' />
            <Input
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              placeholder={t('logs.searchPlaceholder')}
              className='a-input set-input-sm set-input-leading'
            />
          </div>
          <Select
            value={operationType}
            onValueChange={(value) =>
              handleFilterChange(setOperationType, value)
            }
          >
            <SelectTrigger className='a-input set-select w-[150px]'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
<SelectGroup>
              <SelectItem value='ALL'>{t('logs.allOperations')}</SelectItem>
              {OPERATION_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {operationLabel(type)}
                </SelectItem>
              ))}
            </SelectGroup>
</SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(value) => handleFilterChange(setStatus, value)}
          >
            <SelectTrigger className='a-input set-select w-[120px]'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
<SelectGroup>
              <SelectItem value='ALL'>{t('logs.allStatuses')}</SelectItem>
              <SelectItem value='0'>{t('logs.success')}</SelectItem>
              <SelectItem value='1'>{t('logs.failure')}</SelectItem>
            </SelectGroup>
</SelectContent>
          </Select>
          <Button type='submit' size='sm' className='a-btn a-btn--primary a-btn--sm'>
            <Search className='mr-1.5 size-4' />
            {t('logs.search')}
          </Button>
          <Button
            type='button'
            variant='outline'
            size='icon'
            className='size-8 rounded-full'
            onClick={() => void fetchLogs()}
            disabled={loading}
            aria-label={t('logs.refresh')}
          >
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />
          </Button>
        </form>

        <div className='set-group max-w-full overflow-hidden'>
          <Table
            className='min-w-[760px] table-fixed'
            containerClassName='max-w-full overflow-x-auto'
          >
            <TableHeader>
              <TableRow>
                <TableHead className='w-[17%] font-mono text-[11px] uppercase tracking-wider'>
                  {t('logs.colTime')}
                </TableHead>
                <TableHead className='w-[12%] font-mono text-[11px] uppercase tracking-wider'>
                  {t('logs.colOperator')}
                </TableHead>
                <TableHead className='w-[15%] font-mono text-[11px] uppercase tracking-wider'>
                  {t('logs.colOperation')}
                </TableHead>
                <TableHead className='w-[19%] font-mono text-[11px] uppercase tracking-wider'>
                  {t('logs.colTarget')}
                </TableHead>
                <TableHead className='w-[13%] font-mono text-[11px] uppercase tracking-wider'>
                  {t('logs.colIp')}
                </TableHead>
                <TableHead className='w-[16%] font-mono text-[11px] uppercase tracking-wider'>
                  {t('logs.colDetail')}
                </TableHead>
                <TableHead className='w-[8%] text-center font-mono text-[11px] uppercase tracking-wider'>
                  {t('logs.colStatus')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className='py-10 text-center text-muted-foreground'>
                    {t('logs.loading')}
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className='py-10 text-center text-muted-foreground'>
                    {t('logs.empty')}
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id} className='hover:bg-surface-hover'>
                    <TableCell className='font-mono text-xs tabular-nums whitespace-nowrap text-muted-foreground'>
                      {log.operationTime
                        ? dayjs(log.operationTime).format('YYYY-MM-DD HH:mm:ss')
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <div className='max-w-[110px] truncate text-sm' title={displayValue(log.operatorName || log.operatorId)}>
                        {displayValue(log.operatorName || log.operatorId)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className='max-w-[140px] truncate text-sm' title={operationLabel(log.operationType, log.operationName)}>
                        {operationLabel(log.operationType, log.operationName)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className='truncate text-sm' title={displayValue(log.targetName || log.targetId)}>
                        {displayValue(log.targetName || log.targetId)}
                      </div>
                    </TableCell>
                    <TableCell className='font-mono text-xs text-muted-foreground'>
                      {displayValue(log.operationIp)}
                    </TableCell>
                    <TableCell>
                      <div className='truncate text-xs text-muted-foreground' title={formatOperationLogDetail(log.detail || log.errorMessage)}>
                        {displayValue(formatOperationLogDetail(log.detail || log.errorMessage))}
                      </div>
                    </TableCell>
                    <TableCell className='text-center'>
                      <Badge
                        className='whitespace-nowrap'
                        variant={log.status === 0 ? 'secondary' : 'destructive'}
                      >
                        {log.status === 0 ? t('logs.success') : t('logs.failure')}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className='mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground'>
          <span className='font-mono tabular-nums'>
            {t('logs.total', { count: total })}
          </span>
          <div className='flex items-center gap-2'>
            <Button
              type='button'
              variant='outline'
              size='icon'
              className='size-8'
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft className='size-4' />
            </Button>
            <span className='font-mono tabular-nums'>
              {t('logs.pageOf', { page, total: totalPages })}
            </span>
            <Button
              type='button'
              variant='outline'
              size='icon'
              className='size-8'
              disabled={page >= totalPages || loading}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
