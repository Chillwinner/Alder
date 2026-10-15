/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { Fragment, useState, useEffect, useCallback, useMemo } from 'react'
import FolderDownloadPanel from '@/pages/files/components/FolderDownloadPanel'
import type { FileItem, SortOrder } from '@/types/file'
import type { ShareThin } from '@/types/share'
import {
  Clock,
  Eye,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  XCircle,
  FileText,
  List,
  LayoutGrid,
  Share2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  getShareDetail,
  validateShareCode,
  getShareItemList,
  saveShareToWorkspace,
  getShareFileAccessUrl,
  getShareFileContent,
} from '@/api/share'
import { openFilePreview } from '@/utils/preview'
import { probeDirectUrl } from '@/utils/probe-direct-url'
import { triggerBrowserDownload } from '@/lib/download-file-item'
import { useAuth } from '@/contexts/auth-context'
import { translateServerText } from '@/i18n'
import { MoveModal } from '@/pages/files/components/MoveModal'
import { getAvatarFallback } from '@/utils/avatar'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue, SelectGroup } from '@/components/ui/select'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { FileIcon } from '@/components/file-icon'
import { Logo } from '@/components/logo'
import { ShareFileListView, ShareFileGridView } from './components'
import { useShareFolderDownload } from './hooks/useShareFolderDownload'

type ViewMode = 'list' | 'grid'

function shareAllowsDownload(scope?: string) {
  if (!scope?.trim()) return true
  return scope
    .split(',')
    .map((part) => part.trim())
    .includes('download')
}

const sharePageBackdropClassName =
  'relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background px-4 py-10 md:py-14'

const sharePageBackdropPattern = (
  <div aria-hidden='true' className='a-ambient absolute inset-0 z-0' />
)

function ShareBrandLine() {
  return (
    <div className='a-brandline absolute top-7 left-7 z-10'>
      <span className='a-brandline__mark'>
        <Logo className='size-[18px]' />
      </span>
      <span className='a-brandline__name'>Alder</span>
    </div>
  )
}

/** 页头上的权限胶囊：来源 scope（preview,download）的展示层映射 */
function ScopeChip({ canDownload }: { canDownload: boolean }) {
  const { t } = useTranslation('share')
  return canDownload ? (
    <span className='a-tag a-tag--accent'>
      <ShieldCheck className='size-3.5' strokeWidth={1.9} />
      {t('browse.canDownload')}
    </span>
  ) : (
    <span className='a-tag'>
      <Eye className='size-3.5' strokeWidth={1.9} />
      {t('browse.previewOnly')}
    </span>
  )
}

interface ShareCrumb {
  name: string
  id: string
}

export default function SharePage() {
  const { t } = useTranslation('share')
  const { isAuthenticated } = useAuth()
  const { shareToken } = useParams<{ shareToken: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isVerified, setIsVerified] = useState(false)
  const [accessCode, setAccessCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [shareData, setShareData] = useState<ShareThin>({
    id: '',
    shareName: '',
    expireTime: '',
    hasCheckCode: false,
    isExpire: false,
  })
  const [fileList, setFileList] = useState<FileItem[]>([])
  const [bodyLoading, setBodyLoading] = useState(false)
  const [breadcrumbs, setBreadcrumbs] = useState<ShareCrumb[]>([])
  const [orderBy, setOrderBy] = useState('updateTime')
  const [orderDirection, setOrderDirection] = useState<SortOrder>('DESC')
  const [viewMode, setViewMode] = useState<ViewMode>(
    (searchParams.get('viewMode') as ViewMode) || 'list'
  )

  const parentId = searchParams.get('parentId') || undefined
  const folderDownload = useShareFolderDownload(shareToken)
  const canSaveToWorkspace = shareAllowsDownload(shareData.scope)
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [fileToSave, setFileToSave] = useState<FileItem | null>(null)

  const sortedFileList = useMemo(() => {
    const direction = orderDirection === 'ASC' ? 1 : -1
    return [...fileList].sort((left, right) => {
      if (left.isDir !== right.isDir) return left.isDir ? -1 : 1

      let comparison = 0
      if (orderBy === 'displayName') {
        comparison = (
          left.displayName ||
          left.originalName ||
          ''
        ).localeCompare(
          right.displayName || right.originalName || '',
          undefined,
          { numeric: true, sensitivity: 'base' }
        )
      } else if (orderBy === 'suffix') {
        comparison = (left.suffix || '').localeCompare(
          right.suffix || '',
          undefined,
          {
            numeric: true,
            sensitivity: 'base',
          }
        )
      } else if (orderBy === 'size') {
        comparison = (left.size || 0) - (right.size || 0)
      } else {
        comparison =
          new Date(left.updateTime || 0).getTime() -
          new Date(right.updateTime || 0).getTime()
      }

      if (comparison === 0) {
        comparison = (
          left.displayName ||
          left.originalName ||
          ''
        ).localeCompare(
          right.displayName || right.originalName || '',
          undefined,
          { numeric: true, sensitivity: 'base' }
        )
      }
      return comparison * direction
    })
  }, [fileList, orderBy, orderDirection])

  // 验证提取码
  const handleVerify = async () => {
    if (!accessCode.trim()) {
      toast.warning(t('toast.enterCode'))
      return
    }
    setVerifying(true)
    try {
      const result = await validateShareCode({
        shareId: shareToken!,
        shareCode: accessCode,
      })
      if (result) {
        setIsVerified(true)
        const params = new URLSearchParams(searchParams)
        params.set('shareCode', accessCode)
        navigate(`/s/${shareToken}?${params.toString()}`, { replace: true })
      } else {
        toast.error(t('toast.codeWrong'))
      }
    } finally {
      setVerifying(false)
    }
  }

  // 获取分享信息
  const fetchShare = async () => {
    setIsLoading(true)
    setHasError(false)
    setErrorMessage('')

    try {
      const data = await getShareDetail(shareToken!)
      setShareData(data)

      if (data.isExpire) {
        setIsLoading(false)
        return
      }

      if (!data.hasCheckCode) {
        setIsVerified(true)
      } else {
        const urlCode = searchParams.get('shareCode')
        if (urlCode) {
          setAccessCode(urlCode)
          handleVerify()
        }
      }
    } catch (error: any) {
      setHasError(true)
      if (
        error.message?.includes('Network Error') ||
        error.code === 'ERR_NETWORK'
      ) {
        setErrorMessage(t('errors.network'))
      } else if (error.response?.status === 404) {
        setErrorMessage(t('errors.notFound'))
      } else if (error.response?.status >= 500) {
        setErrorMessage(t('errors.server'))
      } else {
        setErrorMessage(error.message || t('errors.generic'))
      }
    } finally {
      setIsLoading(false)
    }
  }

  // 获取分享文件列表
  const fetchShareFile = async () => {
    if (!isVerified) return
    setBodyLoading(true)
    try {
      const data = await getShareItemList(shareToken!, parentId)
      setFileList(data)
    } finally {
      setBodyLoading(false)
    }
  }

  // 处理文件点击
  const handleFileClick = (file: FileItem) => {
    if (file.unavailable) return
    if (file.isDir) {
      if (parentId === file.id) return
      setBreadcrumbs((current) => {
        if (current.at(-1)?.id === file.id) return current
        return [...current, { name: file.originalName, id: file.id }]
      })
      const params = new URLSearchParams(searchParams)
      params.set('parentId', file.id)
      params.set('viewMode', viewMode)
      navigate(`/s/${shareToken}?${params.toString()}`)
      return
    }
    openFilePreview(file, {
      shareId: shareToken,
      navigationFiles: fileList.filter((item) => !item.isDir),
    })
  }

  // 处理面包屑导航
  const handleBreadcrumb = (index: number) => {
    const params = new URLSearchParams(searchParams)
    if (index === -1) {
      setBreadcrumbs([])
      params.delete('parentId')
    } else {
      const target = breadcrumbs[index]
      setBreadcrumbs(breadcrumbs.slice(0, index + 1))
      params.set('parentId', target.id)
    }
    navigate(`/s/${shareToken}?${params.toString()}`)
  }

  // 格式化到期时间
  const formatExpireTime = useCallback(
    (expireTime: string | null) => {
      if (!expireTime) return t('expire.permanent')

      const expireDate = new Date(expireTime)
      const now = new Date()
      const diffTime = expireDate.getTime() - now.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      if (diffDays < 0) return t('expire.expired')
      if (diffDays === 0) return t('expire.today')
      if (diffDays === 1) return t('expire.tomorrow')
      if (diffDays <= 7) return t('expire.inDays', { days: diffDays })

      const year = expireDate.getFullYear()
      const month = String(expireDate.getMonth() + 1).padStart(2, '0')
      const day = String(expireDate.getDate()).padStart(2, '0')
      return t('expire.onDate', { date: `${year}/${month}/${day}` })
    },
    [t]
  )

  const handleSortChange = (field: string, direction: SortOrder) => {
    setOrderBy(field)
    setOrderDirection(direction)
  }

  const handleSaveToWorkspace = (file: FileItem) => {
    if (!canSaveToWorkspace) {
      toast.warning(t('toast.saveNoDownload'))
      return
    }
    if (!isAuthenticated) {
      toast.info(t('toast.saveNeedLogin'))
      const redirect = encodeURIComponent(
        `${window.location.pathname}${window.location.search}`
      )
      navigate(`/login?redirect=${redirect}`)
      return
    }
    setFileToSave(file)
    setSaveModalOpen(true)
  }

  const confirmSaveToWorkspace = async (
    _fileIds: string[],
    targetDirId: string,
    scope?: { workspaceId: string; storagePlatformId?: string | null }
  ) => {
    if (!shareToken || !fileToSave || !scope?.workspaceId) return
    try {
      await saveShareToWorkspace(
        shareToken,
        {
          fileId: fileToSave.id,
          parentId: targetDirId || undefined,
        },
        scope
      )
      toast.success(t('toast.saveOk'))
      setFileToSave(null)
    } catch (error: unknown) {
      const cause = error as { message?: string }
      toast.error(
        cause?.message
          ? translateServerText(cause.message, t('errors.generic'))
          : t('errors.generic')
      )
      throw error
    }
  }

  // 处理下载
  const handleDownload = (file: FileItem) => {
    if (file.unavailable) return
    if (!canSaveToWorkspace) {
      toast.error(t('browse.previewOnly'))
      return
    }
    if (file.isDir) {
      void folderDownload.downloadFolder(file)
      return
    }
    if (!shareToken) {
      return
    }

    void getShareFileAccessUrl(shareToken, file.id, 3600, true)
      .then(async (url) => {
        if (await probeDirectUrl(url)) {
          triggerBrowserDownload(url, file.displayName || file.originalName)
        } else {
          const blob = await getShareFileContent(shareToken, file.id)
          const objectUrl = URL.createObjectURL(blob)
          triggerBrowserDownload(objectUrl, file.displayName || file.originalName)
          URL.revokeObjectURL(objectUrl)
        }
        toast.success(t('toast.downloadStart'))
      })
      .catch(() => toast.error(t('errors.generic')))
  }

  useEffect(() => {
    if (shareToken) {
      fetchShare()
    }
  }, [shareToken])

  useEffect(() => {
    if (isVerified) {
      fetchShareFile()
      if (!parentId) {
        setBreadcrumbs([])
      }
    }
  }, [isVerified, parentId])

  // 加载中状态
  if (isLoading) {
    return (
      <div className={sharePageBackdropClassName}>
        {sharePageBackdropPattern}
        <ShareBrandLine />
        <div className='a-glass tech-rise relative z-10 flex w-full max-w-sm flex-col items-center gap-4 rounded-[28px] px-10 py-12'>
          <Loader2 className='size-7 animate-spin text-primary' />
          <p className='text-[13.5px] text-text-secondary'>{t('loading.fetching')}</p>
        </div>
      </div>
    )
  }

  // 错误状态
  if (hasError) {
    return (
      <div className={sharePageBackdropClassName}>
        {sharePageBackdropPattern}
        <ShareBrandLine />
        <div className='a-glass tech-rise relative z-10 w-full max-w-md rounded-[28px] px-8 py-12 text-center'>
          <span className='mx-auto mb-6 flex size-14 items-center justify-center rounded-[18px] bg-destructive/10 text-destructive'>
            <XCircle className='size-7' strokeWidth={1.7} />
          </span>
          <p className='tech-eyebrow'>分享浏览</p>
          <h1 className='mt-2 text-[28px] leading-tight font-semibold tracking-tight'>
            {errorMessage}
          </h1>
          <p className='mx-auto mt-3 max-w-sm text-[13.5px] leading-relaxed text-text-secondary'>
            {t('errorState.hint')}
          </p>
          <button
            className='a-btn a-btn--primary a-btn--block mt-8'
            onClick={fetchShare}
          >
            <RefreshCw className='size-4' strokeWidth={1.9} />
            {t('errorState.reload')}
          </button>
        </div>
      </div>
    )
  }

  // 已过期状态
  if (shareData.isExpire) {
    return (
      <div className={sharePageBackdropClassName}>
        {sharePageBackdropPattern}
        <ShareBrandLine />
        <div className='a-glass tech-rise relative z-10 w-full max-w-md rounded-[28px] px-8 py-12 text-center'>
          <span className='mx-auto mb-6 flex size-14 items-center justify-center rounded-[18px] bg-surface-secondary text-text-muted'>
            <Clock className='size-7' strokeWidth={1.7} />
          </span>
          <p className='tech-eyebrow'>分享浏览</p>
          <h1 className='mt-2 text-[28px] leading-tight font-semibold tracking-tight'>
            {t('expired.title')}
          </h1>
          <p className='mx-auto mt-3 max-w-sm text-[13.5px] leading-relaxed text-text-secondary'>
            {t('expired.desc')}
          </p>
          <div className='mt-6 flex flex-col items-center gap-2 rounded-[18px] border border-border bg-surface-secondary/60 px-4 py-4'>
            <div className='flex max-w-full items-center gap-2 text-[14px] font-medium'>
              <Share2 className='size-4 shrink-0 text-primary' strokeWidth={1.9} />
              <span className='truncate'>{shareData.shareName}</span>
            </div>
            {shareData.expireTime && (
              <div className='flex items-center gap-2 font-mono text-[12px] tabular-nums text-text-muted'>
                <Clock className='size-3.5' strokeWidth={1.9} />
                <span>{t('expired.at', { time: shareData.expireTime })}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // 需要验证码状态
  if (!isVerified) {
    const avatarFallback = getAvatarFallback(
      shareData.shareName || t('verify.defaultBrand')
    )

    return (
      <div className={sharePageBackdropClassName}>
        {sharePageBackdropPattern}
        <ShareBrandLine />
        <div className='a-glass tech-rise relative z-10 w-full max-w-md rounded-[28px] px-7 py-10 md:px-9'>
          <div className='text-center'>
            <span className='mx-auto mb-5 flex size-16 items-center justify-center rounded-[22px] bg-accent-soft text-[24px] leading-none font-semibold text-primary'>
              {avatarFallback}
            </span>
            <p className='tech-eyebrow'>分享浏览</p>
            <h1 className='mt-2 text-[28px] leading-tight font-semibold tracking-tight'>
              {t('verify.title', {
                name: shareData.shareName || t('verify.defaultBrand'),
              })}
            </h1>
            <p className='mx-auto mt-3 max-w-xs text-[13.5px] leading-relaxed text-text-secondary'>
              {t('verify.needCode')}
            </p>
          </div>
          <div className='flex flex-col mt-7 gap-3'>
            <div className='a-input'>
              <Lock className='size-[18px]' strokeWidth={1.8} />
              <Input
                type='text'
                placeholder={t('verify.placeholder')}
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                className='h-full rounded-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0'
              />
            </div>
            <button
              className='a-btn a-btn--primary a-btn--block'
              onClick={handleVerify}
              disabled={verifying}
            >
              {verifying ? t('verify.verifying') : t('verify.submit')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 文件浏览状态
  const avatarFallback = getAvatarFallback(
    shareData.shareName || t('verify.defaultBrand')
  )

  return (
    <div className='relative min-h-screen w-full overflow-hidden bg-background px-4 py-6 md:px-8 md:py-10'>
      {sharePageBackdropPattern}

      <div className='relative z-10 mx-auto w-full max-w-6xl'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='a-brandline'>
            <span className='a-brandline__mark'>
              <Logo className='size-[18px]' />
            </span>
            <span className='a-brandline__name'>Alder</span>
          </div>
          {shareData.expireTime && (
            <span className='a-tag font-mono tabular-nums'>
              <Clock className='size-3.5' strokeWidth={1.9} />
              {formatExpireTime(shareData.expireTime)}
            </span>
          )}
        </div>

        <div className='a-glass tech-rise mt-6 flex flex-col overflow-hidden rounded-[32px]'>
          {/* 页头：来源信息 + 权限 chip */}
          <header className='flex flex-wrap items-center justify-between gap-4 border-b border-divider px-6 py-6 md:px-8'>
            <div className='flex min-w-0 items-center gap-4'>
              <span className='flex size-14 shrink-0 items-center justify-center rounded-[20px] bg-accent-soft text-[22px] leading-none font-semibold text-primary'>
                {avatarFallback}
              </span>
              <div className='min-w-0'>
                <p className='tech-eyebrow'>
                  {t('verify.title', {
                    name: shareData.shareName || t('verify.defaultBrand'),
                  })}
                </p>
                <h1 className='mt-1.5 truncate text-[30px] leading-tight font-semibold tracking-tight'>
                  {shareData.shareName}
                </h1>
                <div className='mt-2 flex flex-wrap items-center gap-2.5 font-mono text-[12px] tabular-nums text-text-muted'>
                  <span>
                    {t('browse.fileCount', {
                      count: shareData.fileCount ?? fileList.length,
                    })}
                  </span>
                  <span className='opacity-40'>·</span>
                  <span>分享浏览</span>
                </div>
              </div>
            </div>

            <div className='flex shrink-0 items-center gap-2'>
              <ScopeChip canDownload={canSaveToWorkspace} />
            </div>
          </header>

          {/* 面包屑导航 */}
          <div className='border-b border-divider px-6 py-3 md:px-8'>
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink
                    onClick={() => handleBreadcrumb(-1)}
                    className='flex cursor-pointer items-center gap-1.5'
                  >
                    <FileIcon type='folder' size={16} />
                    {t('browse.root')}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {breadcrumbs.map((item, index) => (
                  <Fragment key={item.id}>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbLink
                        onClick={() => handleBreadcrumb(index)}
                        className='cursor-pointer'
                      >
                        {item.name}
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                  </Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          {/* 工具栏 */}
          <div className='flex items-center justify-between gap-3 border-b border-divider px-6 py-3 md:px-8'>
            <span className='font-mono text-[12px] tabular-nums text-text-muted'>
              {t('browse.totalFiles', { count: fileList.length })}
            </span>
            <div className='flex items-center gap-2'>
              <Select
                value={orderBy}
                onValueChange={(field) => handleSortChange(field, orderDirection)}
              >
                <SelectTrigger
                  className='h-8 w-auto border-0 bg-transparent shadow-none'
                  size='sm'
                  aria-label={t('sort.fieldAria')}
                >
                  <ArrowUpDown className='size-4 text-text-muted' />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
<SelectGroup>
                  <SelectItem value='displayName'>{t('sort.name')}</SelectItem>
                  <SelectItem value='updateTime'>{t('sort.modified')}</SelectItem>
                  <SelectItem value='suffix'>{t('sort.type')}</SelectItem>
                  <SelectItem value='size'>{t('sort.size')}</SelectItem>
                </SelectGroup>
</SelectContent>
              </Select>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='size-8 shrink-0 text-text-muted'
                onClick={() =>
                  handleSortChange(
                    orderBy,
                    orderDirection === 'ASC' ? 'DESC' : 'ASC'
                  )
                }
                aria-label={
                  orderDirection === 'ASC'
                    ? t('sort.ascending')
                    : t('sort.descending')
                }
                title={
                  orderDirection === 'ASC'
                    ? t('sort.ascending')
                    : t('sort.descending')
                }
              >
                {orderDirection === 'ASC' ? (
                  <ArrowUp className='size-4' />
                ) : (
                  <ArrowDown className='size-4' />
                )}
              </Button>
              <SegmentedControl
                value={viewMode}
                onChange={setViewMode}
                items={[
                  {
                    value: 'list',
                    ariaLabel: t('browse.listView'),
                    label: <List className='size-4' strokeWidth={1.75} />,
                  },
                  {
                    value: 'grid',
                    ariaLabel: t('browse.gridView'),
                    label: <LayoutGrid className='size-4' strokeWidth={1.75} />,
                  },
                ]}
              />
              <Button variant='ghost' size='icon' className='size-8 text-text-muted' onClick={fetchShareFile}>
                <RefreshCw />
              </Button>
            </div>
          </div>

          {/* 文件列表 */}
          <div className='flex-1 overflow-auto px-5 py-4 md:px-7'>
            {bodyLoading ? (
              <div className='flex h-full min-h-[220px] items-center justify-center'>
                <div className='text-center'>
                  <Loader2 className='mx-auto mb-4 size-7 animate-spin text-primary' />
                  <p className='text-[13px] text-text-secondary'>
                    {t('loading.list')}
                  </p>
                </div>
              </div>
            ) : fileList.length === 0 ? (
              <div className='flex h-full min-h-[220px] items-center justify-center'>
                <div className='text-center'>
                  <span className='mx-auto mb-4 flex size-16 items-center justify-center rounded-[20px] bg-surface-secondary text-text-muted'>
                    <FileText className='size-7' strokeWidth={1.7} />
                  </span>
                  <p className='text-[13.5px] text-text-secondary'>
                    {t('browse.empty')}
                  </p>
                </div>
              </div>
            ) : viewMode === 'list' ? (
              <ShareFileListView
                fileList={sortedFileList}
                onFileClick={handleFileClick}
                onDownload={canSaveToWorkspace ? handleDownload : undefined}
                onSaveToWorkspace={
                  canSaveToWorkspace ? handleSaveToWorkspace : undefined
                }
                orderBy={orderBy}
                orderDirection={orderDirection}
                onSortChange={handleSortChange}
              />
            ) : (
              <ShareFileGridView
                fileList={sortedFileList}
                onFileClick={handleFileClick}
                onDownload={canSaveToWorkspace ? handleDownload : undefined}
                onSaveToWorkspace={
                  canSaveToWorkspace ? handleSaveToWorkspace : undefined
                }
              />
            )}
          </div>

          {/* 底部 */}
          <div className='border-t border-divider px-6 py-3 text-center font-mono text-[11px] tracking-wider text-text-muted'>
            {t('browse.footer')}
          </div>
        </div>
      </div>

      <FolderDownloadPanel
        tasks={folderDownload.tasks}
        onDismiss={folderDownload.dismissTask}
        onCancel={folderDownload.cancelTask}
      />
      <MoveModal
        open={saveModalOpen}
        onOpenChange={(open) => {
          setSaveModalOpen(open)
          if (!open) setFileToSave(null)
        }}
        file={null}
        files={[]}
        pickFolderMode
        allowWorkspacePick
        dialogTitle={t('saveToWorkspace.title')}
        confirmText={t('saveToWorkspace.confirm')}
        onConfirm={confirmSaveToWorkspace}
      />
    </div>
  )
}
