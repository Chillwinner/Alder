/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { TransferSettingForm } from '@/types/transfer-setting'
import { readTransferPrefs, writeTransferPrefs } from '@/lib/transfer-prefs'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue, SelectGroup } from '@/components/ui/select'
import { FormInlineOption } from '@/components/field-layout'

interface TransferSettingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * 传输设置弹窗：玻璃面板 + .a-field / .a-input 表单版式，
 * 内容按 45ms 步进错峰入场（tech-rise，backwards 填充）。
 * 表单 state 与保存/取消逻辑与改造前完全一致。
 */
export default function TransferSettingModal({
  open,
  onOpenChange,
}: TransferSettingModalProps) {
  const { t } = useTranslation('transfer')
  const [formData, setFormData] = useState<TransferSettingForm>(readTransferPrefs)

  useEffect(() => {
    if (open) {
      loadSettings()
    }
  }, [open])

  const loadSettings = async () => {
    setFormData(readTransferPrefs())
  }

  const handleSave = async () => {
    writeTransferPrefs(formData)
    toast.success(t('settings.toastSaveOk'))
    onOpenChange(false)
  }

  const stagger = (step: number) => ({ animationDelay: `${step * 45}ms` })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle className='text-[20px] font-semibold tracking-[-0.022em] text-foreground'>
            {t('settings.title')}
          </DialogTitle>
          <p className='text-[13px] leading-relaxed text-text-secondary'>
            {t('settings.intro')}
          </p>
        </DialogHeader>

        <div className='flex flex-col gap-5 py-1'>
          {/* 文件下载位置 */}
          <div className='a-field tf-stagger' style={stagger(1)}>
            <Label htmlFor='downloadLocation'>
              {t('settings.downloadPath')}
            </Label>
            <div className='a-input'>
              <Input
                id='downloadLocation'
                value={formData.downloadLocation}
                onChange={(e) =>
                  setFormData({ ...formData, downloadLocation: e.target.value })
                }
                placeholder={t('settings.downloadPathPh')}
              />
            </div>
          </div>

          {/* 默认下载路径 */}
          <div
            className='tf-stagger flex items-start gap-3 rounded-[14px] bg-surface-secondary px-4 py-3.5'
            style={stagger(2)}
          >
            <Checkbox
              id='isDefaultDownloadLocation'
              className='mt-0.5'
              checked={formData.isDefaultDownloadLocation}
              onCheckedChange={(checked) =>
                setFormData({
                  ...formData,
                  isDefaultDownloadLocation: checked as boolean,
                })
              }
            />
            <div className='min-w-0'>
              <Label
                htmlFor='isDefaultDownloadLocation'
                className='text-[13.5px] font-medium text-foreground'
              >
                {t('settings.defaultPath')}
              </Label>
              <p className='mt-1 text-[12.5px] leading-relaxed text-text-muted'>
                {t('settings.defaultPathHint')}
              </p>
            </div>
          </div>

          {/* 下载速率限制 */}
          <div className='a-field tf-stagger' style={stagger(3)}>
            <Label>{t('settings.speedLimit')}</Label>
            <div className='flex flex-wrap items-center gap-x-6 gap-y-3'>
              <RadioGroup
                value={
                  formData.enableDownloadSpeedLimit ? 'limited' : 'unlimited'
                }
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    enableDownloadSpeedLimit: value === 'limited',
                  })
                }
                className='flex flex-wrap gap-x-6 gap-y-2'
              >
                <FormInlineOption>
                  <RadioGroupItem value='unlimited' id='unlimited' />
                  <Label htmlFor='unlimited' className='font-normal'>
                    {t('settings.unlimited')}
                  </Label>
                </FormInlineOption>
                <FormInlineOption>
                  <RadioGroupItem value='limited' id='limited' />
                  <Label htmlFor='limited' className='font-normal'>
                    {t('settings.limited')}
                  </Label>
                </FormInlineOption>
              </RadioGroup>

              {formData.enableDownloadSpeedLimit && (
                <div className='flex items-center gap-2.5'>
                  <div className='a-input a-input--sm w-28'>
                    <Input
                      type='number'
                      min={1}
                      max={200}
                      value={formData.downloadSpeedLimit}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          downloadSpeedLimit: parseInt(e.target.value) || 5,
                        })
                      }
                    />
                  </div>
                  <span className='font-mono text-[12.5px] tabular-nums text-text-muted'>
                    MB/s
                  </span>
                  <span className='text-[12.5px] text-text-muted'>
                    {t('settings.speedHint')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 并发限制 */}
          <div className='a-field tf-stagger' style={stagger(4)}>
            <Label>{t('settings.concurrent')}</Label>
            <div className='flex flex-wrap items-center gap-x-5 gap-y-3'>
              <span className='text-[13px] text-text-secondary'>
                {t('settings.uploadConcurrency')}
              </span>
              <Select
                value={formData.concurrentUploadQuantity.toString()}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    concurrentUploadQuantity: parseInt(value),
                  })
                }
              >
                <SelectTrigger className='w-24 border-0 bg-surface-secondary shadow-none'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
<SelectGroup>
                  {[1, 2, 3].map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {t('settings.countUnit', { n: num })}
                    </SelectItem>
                  ))}
                </SelectGroup>
</SelectContent>
              </Select>

              <span className='text-[13px] text-text-secondary'>
                {t('settings.downloadConcurrency')}
              </span>
              <Select
                value={formData.concurrentDownloadQuantity.toString()}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    concurrentDownloadQuantity: parseInt(value),
                  })
                }
              >
                <SelectTrigger className='w-24 border-0 bg-surface-secondary shadow-none'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
<SelectGroup>
                  {[1, 2, 3].map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {t('settings.countUnit', { n: num })}
                    </SelectItem>
                  ))}
                </SelectGroup>
</SelectContent>
              </Select>
            </div>
          </div>

          {/* 分片大小 */}
          <div className='a-field tf-stagger' style={stagger(5)}>
            <Label>{t('settings.chunkSize')}</Label>
            <div className='flex flex-wrap items-center gap-3'>
              <Select
                value={formData.chunkSize.toString()}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    chunkSize: parseInt(value),
                  })
                }
              >
                <SelectTrigger className='w-32 border-0 bg-surface-secondary shadow-none'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
<SelectGroup>
                  <SelectItem value={(2 * 1024 * 1024).toString()}>
                    2 MB
                  </SelectItem>
                  <SelectItem value={(5 * 1024 * 1024).toString()}>
                    5 MB
                  </SelectItem>
                  <SelectItem value={(10 * 1024 * 1024).toString()}>
                    10 MB
                  </SelectItem>
                </SelectGroup>
</SelectContent>
              </Select>
              <span className='font-mono text-[12.5px] tabular-nums text-text-muted'>
                {t('settings.chunkHint')}
              </span>
            </div>
          </div>
        </div>

        <div className='flex justify-end gap-2'>
          <button
            type='button'
            className='a-btn a-btn--ghost'
            onClick={() => onOpenChange(false)}
          >
            {t('settings.cancel')}
          </button>
          <button
            type='button'
            className='a-btn a-btn--primary'
            onClick={handleSave}
          >
            {t('settings.save')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
