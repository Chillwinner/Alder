/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { shareFiles } from '@/api'
import type { FileItem } from '@/types/file'
import { Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { formatFileSize } from '@/utils/format'
import { copyTextToClipboard } from '@/utils/copy-to-clipboard'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { FileIcon } from '@/components/file-icon'
import {
  FormFieldStack,
  FormInlineOption,
} from '@/components/field-layout'

interface ShareModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  file: FileItem | null
  files: FileItem[]
  onSuccess?: () => void
}

export function ShareModal({
  open,
  onOpenChange,
  file,
  files,
  onSuccess,
}: ShareModalProps) {
  const { t } = useTranslation('files')
  // 表单状态
  const [expireType, setExpireType] = useState<number>(1) // 1-7天 2-30天 3-自定义 4-永久
  const [customExpireTime, setCustomExpireTime] = useState<string>('')
  const [needShareCode, setNeedShareCode] = useState(false)
  const [customShareCode, setCustomShareCode] = useState('')
  const [maxViewCountType, setMaxViewCountType] = useState<
    'unlimited' | 'custom'
  >('unlimited')
  const [maxViewCount, setMaxViewCount] = useState<string>('')
  const [maxDownloadCountType, setMaxDownloadCountType] = useState<
    'unlimited' | 'custom'
  >('unlimited')
  const [maxDownloadCount, setMaxDownloadCount] = useState<string>('')
  // 分享结果状态
  const [shareLink, setShareLink] = useState('')
  const [shareCode, setShareCode] = useState('')
  const [shareExpireTime, setShareExpireTime] = useState('')
  const [isPermanent, setIsPermanent] = useState(false)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)

  const sharingFiles = file ? [file] : files
  const isBatchShare = sharingFiles.length > 1
  const displayFiles = sharingFiles.slice(0, 3)

  // 判断是否永久分享
  const isPermanentShare = () => {
    if (shareLink) {
      return isPermanent
    }
    return expireType === 4
  }

  // 文件数量提示文本
  const filesCountText = useMemo(() => {
    const total = sharingFiles.length
    if (total > 3) {
      return t('shareModal.filesMore', { total })
    }
    return t('shareModal.filesTotal', { total })
  }, [sharingFiles.length, t])

  // 重置表单
  const resetForm = () => {
    setExpireType(1)
    setCustomExpireTime('')
    setNeedShareCode(false)
    setCustomShareCode('')
    setMaxViewCountType('unlimited')
    setMaxViewCount('')
    setMaxDownloadCountType('unlimited')
    setMaxDownloadCount('')
    setShareLink('')
    setShareCode('')
    setShareExpireTime('')
    setIsPermanent(false)
  }

  // 获取过期时间文本
  const getExpireText = useCallback(() => {
    if (shareExpireTime) {
      return shareExpireTime
    }
    if (expireType === 4) return t('shareModal.permanent')
    if (expireType === 3 && customExpireTime) {
      return customExpireTime
    }
    if (expireType === 1) return t('shareModal.expire7')
    if (expireType === 2) return t('shareModal.expire30')
    return ''
  }, [shareExpireTime, expireType, customExpireTime, t])

  // 生成分享链接
  const handleShare = async () => {
    // 验证自定义时间
    if (expireType === 3 && !customExpireTime) {
      toast.warning(t('shareModal.toastPickExpire'))
      return
    }

    // 验证自定义次数
    if (maxViewCountType === 'custom' && !maxViewCount) {
      toast.warning(t('shareModal.toastMaxView'))
      return
    }

    if (maxDownloadCountType === 'custom' && !maxDownloadCount) {
      toast.warning(t('shareModal.toastMaxDown'))
      return
    }

    const trimmedCode = customShareCode.trim()
    if (needShareCode && trimmedCode && (trimmedCode.length < 4 || trimmedCode.length > 32)) {
      toast.warning(t('shareModal.toastShareCodeLen'))
      return
    }

    setIsSubmitting(true)
    try {
      const fileIds = sharingFiles.map((f) => f.id)

      const response = await shareFiles({
        fileIds,
        expireType,
        expireTime: expireType === 3 ? customExpireTime : undefined,
        needShareCode,
        shareCode: needShareCode && trimmedCode ? trimmedCode : undefined,
        maxViewCount:
          maxViewCountType === 'custom' ? Number(maxViewCount) : undefined,
        maxDownloadCount:
          maxDownloadCountType === 'custom'
            ? Number(maxDownloadCount)
            : undefined,
        scope: 'download',
      })

      if (response) {
        const shareToken = response.id
        const baseUrl = window.location.origin
        setShareLink(`${baseUrl}/s/${shareToken}`)
        setShareCode(response.shareCode || '')
        setShareExpireTime(response.expireTime || '')
        setIsPermanent(response.isPermanent)

        const successMsg =
          fileIds.length === 1
            ? t('shareModal.toastOkOne')
            : t('shareModal.toastOkMany', { count: fileIds.length })
        toast.success(successMsg)
        onSuccess?.()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // 复制链接
  const handleCopyLink = async () => {
    try {
      const textToCopy = shareCode
        ? t('shareModal.copyWithCode', { link: shareLink, code: shareCode })
        : shareLink

      await copyTextToClipboard(textToCopy)
      setCopiedLink(true)
      setTimeout(() => {
        setCopiedLink(false)
      }, 2000)
      toast.success(t('common.copied'))
    } catch (error) {
      toast.error(t('common.copyFailed'))
    }
  }

  // 复制提取码
  const handleCopyCode = async () => {
    try {
      await copyTextToClipboard(shareCode)
      setCopiedCode(true)
      setTimeout(() => {
        setCopiedCode(false)
      }, 2000)
      toast.success(t('common.copied'))
    } catch (error) {
      toast.error(t('common.copyFailed'))
    }
  }

  // 处理确认按钮点击
  const handleOk = async () => {
    if (!shareLink) {
      await handleShare()
    }
  }

  // 关闭时重置
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        resetForm()
        setCopiedLink(false)
        setCopiedCode(false)
      }, 300)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[85vh] sm:max-w-xl overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>{t('shareModal.title')}</DialogTitle>
        </DialogHeader>

        <div className='flex flex-col gap-6'>
          {/* 文件信息预览 */}
          {!isBatchShare && file ? (
            <div className='flex items-center gap-4 rounded-lg border border-border bg-surface-secondary p-4'>
              <FileIcon
                type={file.isDir ? 'dir' : file.suffix || ''}
                size={48}
              />
              <div className='min-w-0 flex-1'>
                <div className='truncate text-sm font-medium text-foreground'>
                  {file.displayName}
                </div>
                <div className='font-mono text-xs tabular-nums text-muted-foreground'>
                  {formatFileSize(file.size || 0)}
                </div>
              </div>
            </div>
          ) : (
            <div className='flex flex-col gap-3'>
              <div className='flex justify-center gap-6 rounded-lg border border-border bg-surface-secondary p-6'>
                {displayFiles.map((previewFile) => (
                  <div
                    key={previewFile.id}
                    className='flex w-20 flex-col items-center gap-2'
                  >
                    <FileIcon
                      type={
                        previewFile.isDir ? 'dir' : previewFile.suffix || ''
                      }
                      size={64}
                    />
                    <span className='w-full truncate text-center text-xs text-muted-foreground'>
                      {previewFile.displayName}
                    </span>
                  </div>
                ))}
              </div>
              <div className='text-center font-mono text-xs tabular-nums text-muted-foreground'>
                {filesCountText}
              </div>
            </div>
          )}

          <Separator />

          {!shareLink ? (
            <>
              {/* 有效期 */}
              <FormFieldStack>
                <Label>{t('shareModal.labelExpire')}</Label>
                <RadioGroup
                  value={String(expireType)}
                  onValueChange={(value) => setExpireType(Number(value))}
                  disabled={!!shareLink}
                  className='flex flex-wrap gap-x-6 gap-y-2'
                >
                  <FormInlineOption>
                    <RadioGroupItem value='1' id='expire-7d' />
                    <Label
                      htmlFor='expire-7d'
                      className='cursor-pointer font-normal'
                    >
                      {t('shareModal.expire7')}
                    </Label>
                  </FormInlineOption>
                  <FormInlineOption>
                    <RadioGroupItem value='2' id='expire-30d' />
                    <Label
                      htmlFor='expire-30d'
                      className='cursor-pointer font-normal'
                    >
                      {t('shareModal.expire30')}
                    </Label>
                  </FormInlineOption>
                  <FormInlineOption>
                    <RadioGroupItem value='3' id='expire-custom' />
                    <Label
                      htmlFor='expire-custom'
                      className='cursor-pointer font-normal'
                    >
                      {t('shareModal.expireCustom')}
                    </Label>
                  </FormInlineOption>
                  <FormInlineOption>
                    <RadioGroupItem value='4' id='expire-permanent' />
                    <Label
                      htmlFor='expire-permanent'
                      className='cursor-pointer font-normal'
                    >
                      {t('shareModal.permanent')}
                    </Label>
                  </FormInlineOption>
                </RadioGroup>
                {expireType === 3 && (
                  <Input
                    type='datetime-local'
                    value={customExpireTime}
                    onChange={(e) => setCustomExpireTime(e.target.value)}
                    disabled={!!shareLink}
                    min={new Date().toISOString().slice(0, 16)}
                  />
                )}
              </FormFieldStack>

              {/* 分享类型 */}
              <FormFieldStack>
                <Label>{t('shareModal.labelShareType')}</Label>
                <RadioGroup
                  value={needShareCode ? 'private' : 'public'}
                  onValueChange={(value) => {
                    const nextPrivate = value === 'private'
                    setNeedShareCode(nextPrivate)
                    if (!nextPrivate) {
                      setCustomShareCode('')
                    }
                  }}
                  disabled={!!shareLink}
                  className='flex flex-wrap gap-x-6 gap-y-2'
                >
                  <FormInlineOption>
                    <RadioGroupItem value='public' id='share-public' />
                    <Label
                      htmlFor='share-public'
                      className='cursor-pointer font-normal'
                    >
                      {t('shareModal.sharePublic')}
                    </Label>
                  </FormInlineOption>
                  <FormInlineOption>
                    <RadioGroupItem value='private' id='share-private' />
                    <Label
                      htmlFor='share-private'
                      className='cursor-pointer font-normal'
                    >
                      {t('shareModal.sharePrivate')}
                    </Label>
                  </FormInlineOption>
                </RadioGroup>
                {needShareCode && !shareLink && (
                  <div className='flex flex-col mt-2 gap-1'>
                    <Label htmlFor='share-code-input'>{t('shareModal.labelShareCode')}</Label>
                    <Input
                      id='share-code-input'
                      value={customShareCode}
                      onChange={(e) => setCustomShareCode(e.target.value)}
                      placeholder={t('shareModal.shareCodePlaceholder')}
                      maxLength={32}
                      autoComplete='off'
                    />
                  </div>
                )}
              </FormFieldStack>

              {/* 最大查看次数 */}
              <FormFieldStack>
                <Label>{t('shareModal.labelMaxView')}</Label>
                <div className='flex flex-wrap items-center gap-2'>
                  <RadioGroup
                    value={maxViewCountType}
                    onValueChange={(value) =>
                      setMaxViewCountType(value as 'unlimited' | 'custom')
                    }
                    disabled={!!shareLink}
                    className='flex flex-wrap gap-x-6 gap-y-2'
                  >
                    <FormInlineOption>
                      <RadioGroupItem value='unlimited' id='view-unlimited' />
                      <Label
                        htmlFor='view-unlimited'
                        className='cursor-pointer font-normal'
                      >
                        {t('shareModal.unlimited')}
                      </Label>
                    </FormInlineOption>
                    <FormInlineOption>
                      <RadioGroupItem value='custom' id='view-custom' />
                      <Label
                        htmlFor='view-custom'
                        className='cursor-pointer font-normal'
                      >
                        {t('shareModal.custom')}
                      </Label>
                    </FormInlineOption>
                  </RadioGroup>
                  {maxViewCountType === 'custom' && (
                    <Input
                      type='number'
                      min='1'
                      placeholder={t('shareModal.placeholderCount')}
                      value={maxViewCount}
                      onChange={(e) => setMaxViewCount(e.target.value)}
                      disabled={!!shareLink}
                      className='w-32'
                    />
                  )}
                </div>
              </FormFieldStack>

              {/* 最大下载次数 */}
              <FormFieldStack>
                <Label>{t('shareModal.labelMaxDown')}</Label>
                <div className='flex flex-wrap items-center gap-2'>
                  <RadioGroup
                    value={maxDownloadCountType}
                    onValueChange={(value) =>
                      setMaxDownloadCountType(value as 'unlimited' | 'custom')
                    }
                    disabled={!!shareLink}
                    className='flex flex-wrap gap-x-6 gap-y-2'
                  >
                    <FormInlineOption>
                      <RadioGroupItem
                        value='unlimited'
                        id='download-unlimited'
                      />
                      <Label
                        htmlFor='download-unlimited'
                        className='cursor-pointer font-normal'
                      >
                        {t('shareModal.unlimited')}
                      </Label>
                    </FormInlineOption>
                    <FormInlineOption>
                      <RadioGroupItem value='custom' id='download-custom' />
                      <Label
                        htmlFor='download-custom'
                        className='cursor-pointer font-normal'
                      >
                        {t('shareModal.custom')}
                      </Label>
                    </FormInlineOption>
                  </RadioGroup>
                  {maxDownloadCountType === 'custom' && (
                    <Input
                      type='number'
                      min='1'
                      placeholder={t('shareModal.placeholderCount')}
                      value={maxDownloadCount}
                      onChange={(e) => setMaxDownloadCount(e.target.value)}
                      disabled={!!shareLink}
                      className='w-32'
                    />
                  )}
                </div>
              </FormFieldStack>
            </>
          ) : (
            <>
              {/* 分享结果 */}
              <Alert className='border-primary/30 bg-accent-soft'>
                <Check className='h-4 w-4 text-primary' />
                <AlertDescription className='text-foreground'>
                  {t('shareModal.alertGenerated')}
                </AlertDescription>
              </Alert>

              <div className='flex flex-col rounded-lg border border-border bg-surface-secondary p-4 gap-2'>
                {/* 分享链接和提取码 */}
                <div className='flex flex-col gap-1'>
                  <div className='font-mono text-[13px] break-all text-primary'>{shareLink}</div>
                  {shareCode && (
                    <div className='font-mono text-[13px] tracking-wider'>
                      <span>{t('shareModal.codeInline')}</span>
                      <span>{shareCode}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className='text-center text-[13px] text-muted-foreground'>
                {isPermanentShare()
                  ? t('shareModal.hintPermanent')
                  : t('shareModal.hintExpire', { time: getExpireText() })}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          {!shareLink ? (
            <>
              <DialogClose asChild>
                <Button variant='outline' disabled={isSubmitting}>
                  {t('common.cancel')}
                </Button>
              </DialogClose>
              <Button onClick={handleOk} disabled={isSubmitting}>
                {isSubmitting
                  ? t('shareModal.generating')
                  : t('shareModal.generate')}
              </Button>
            </>
          ) : (
            <>
              <DialogClose asChild>
                <Button variant='outline'>{t('common.cancel')}</Button>
              </DialogClose>
              <Button onClick={handleCopyLink}>
                {copiedLink ? (
                  <>
                    <Check className='mr-2 h-4 w-4' />
                    {t('shareModal.btnCopied')}
                  </>
                ) : (
                  <>
                    <Copy className='mr-2 h-4 w-4' />
                    {t('shareModal.btnCopyLink')}
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
