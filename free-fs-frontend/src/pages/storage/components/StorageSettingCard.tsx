/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { StorageSetting, ConfigScheme } from '@/types/storage'
import {
  Database,
  Eye,
  Settings,
  Trash2,
  Link as LinkIcon,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  deleteStorageSetting,
  toggleStorageSetting,
  updateStorageSetting,
} from '@/api/storage'
import { usePermission } from '@/hooks/use-permission'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue, SelectGroup } from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { copyTextToClipboard } from '@/utils/copy-to-clipboard'
import { cn } from '@/lib/utils'
import {
  DescriptionField,
  DescriptionFieldLabel,
  DescriptionFieldList,
  DescriptionFieldValue,
  DescriptionFieldValueRow,
} from '@/components/field-layout'

interface StorageSettingCardProps {
  setting: StorageSetting
  onRefresh: () => void
}

export function StorageSettingCard({
  setting,
  onRefresh,
}: StorageSettingCardProps) {
  const { t } = useTranslation('storage')
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [toggleDialogOpen, setToggleDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [editFormData, setEditFormData] = useState<Record<string, string>>({})
  const [editRemark, setEditRemark] = useState('')
  const [editErrors, setEditErrors] = useState<Record<string, string>>({})
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [copiedConfig, setCopiedConfig] = useState(false)
  const { hasPermission } = usePermission()
  const canManageStorage = hasPermission('storage:manage')

  const schemes: ConfigScheme[] = JSON.parse(
    setting.storagePlatform.configScheme
  )
  const configData = setting.configData ? JSON.parse(setting.configData) : {}

  const isSensitiveField = (identifier: string): boolean => {
    const value = identifier.toLowerCase()
    return (
      value.includes('secret') ||
      value.includes('password') ||
      value.includes('token') ||
      (value.includes('access') && value.includes('key'))
    )
  }

  // 脱敏处理
  const maskValue = (identifier: string, value: string): string => {
    const emptyLabel = t('card.notConfigured')
    if (isSensitiveField(identifier) && value) {
      return '****'
    }
    return value || emptyLabel
  }

  // 获取枚举字段的显示值
  const getEnumLabel = (field: ConfigScheme, value: string): string => {
    if (field.dataType === 'enums' && field.enums) {
      const option = field.enums.find((opt) => opt.value === value)
      return option ? option.label : value
    }
    return value
  }

  // 复制配置
  const handleCopyConfig = async () => {
    const configText: string[] = []
    configText.push(
      t('card.configHeader', { name: setting.storagePlatform.name })
    )
    configText.push('='.repeat(30))
    schemes.forEach((field) => {
      const rawValue = isSensitiveField(field.identifier)
        ? '****'
        : configData[field.identifier] || t('card.notConfigured')
      const displayValue = getEnumLabel(field, rawValue)
      configText.push(`${field.label}: ${displayValue}`)
    })
    configText.push(
      t('card.remarkLine', {
        remark: setting.remark || t('card.noRemark'),
      })
    )

    try {
      await copyTextToClipboard(configText.join('\n'))
      setCopiedConfig(true)
      setTimeout(() => setCopiedConfig(false), 2000)
      toast.success(t('card.copied'))
    } catch {
      toast.error(t('card.copyFailed'))
    }
  }

  // 复制单个字段
  const handleCopyField = async (identifier: string, value: string) => {
    try {
      await copyTextToClipboard(value)
      setCopiedField(identifier)
      setTimeout(() => setCopiedField(null), 2000)
      toast.success(t('card.copied'))
    } catch {
      toast.error(t('card.copyFailed'))
    }
  }

  // 打开编辑模态框
  const handleOpenEdit = () => {
    const initialData: Record<string, string> = {}
    schemes.forEach((field) => {
      initialData[field.identifier] = isSensitiveField(field.identifier)
        ? ''
        : configData[field.identifier] || ''
    })
    setEditFormData(initialData)
    setEditRemark(setting.remark || '')
    setEditErrors({})
    setEditModalOpen(true)
  }

  // 清除单个字段错误
  const clearEditFieldError = (fieldName: string) => {
    if (editErrors[fieldName]) {
      setEditErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[fieldName]
        return newErrors
      })
    }
  }

  // 验证编辑表单
  const validateEditForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    schemes.forEach((field) => {
      if (
        field.validation.required &&
        !isSensitiveField(field.identifier) &&
        !editFormData[field.identifier]?.trim()
      ) {
        newErrors[field.identifier] = t('card.toastEnterField', {
          label: field.label,
        })
      }
    })

    setEditErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!validateEditForm()) {
      return
    }

    setIsLoading(true)
    try {
      await updateStorageSetting({
        settingId: setting.id.toString(),
        platformIdentifier: setting.storagePlatform.identifier,
        configData: JSON.stringify(editFormData),
        remark: editRemark.trim(),
      })
      toast.success(t('card.saveOk'))
      onRefresh()
      setEditModalOpen(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    setIsLoading(true)
    try {
      await deleteStorageSetting(setting.id)
      toast.success(t('card.deleteOk', { name: setting.storagePlatform.name }))
      onRefresh()
      setDeleteDialogOpen(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggle = async () => {
    const action = setting.enabled === 1 ? 0 : 1
    setIsLoading(true)
    try {
      await toggleStorageSetting(setting.id.toString(), action)
      toast.success(
        action === 1
          ? t('card.enabledToast', { name: setting.storagePlatform.name })
          : t('card.disabledToast', { name: setting.storagePlatform.name })
      )
      setTimeout(() => {
        window.location.reload()
      }, 800)
    } catch {
      setIsLoading(false)
    }
  }

  return (
    <>
      <li
        data-tilt=''
        className='glass-card flex flex-wrap items-center gap-4 rounded-[16px] px-4 py-3.5 transition-[background-color,border-color,box-shadow] duration-150 hover:border-primary/40'
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className='flex size-10 shrink-0 cursor-help items-center justify-center rounded-[12px] bg-accent-soft'>
                <Database className='size-4 text-primary' strokeWidth={1.75} />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className='font-mono text-xs tabular-nums'>ID: {setting.id}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-2'>
            <h2 className='truncate text-[15px] font-semibold tracking-tight'>
              {setting.storagePlatform.name}
            </h2>
            {setting.storagePlatform.link && (
              <a
                href={setting.storagePlatform.link}
                target='_blank'
                rel='noopener noreferrer'
              >
                <LinkIcon className='size-3 text-text-muted hover:text-foreground' />
              </a>
            )}
          </div>
          <p
            className={cn(
              'mt-0.5 truncate text-[12px] text-text-muted',
              !setting.remark && !setting.storagePlatform.desc && 'font-mono'
            )}
          >
            {setting.remark ||
              setting.storagePlatform.desc ||
              setting.storagePlatform.identifier}
          </p>
        </div>

        <div className='flex items-center gap-1.5 text-[12px] text-text-secondary'>
          <span
            className={cn(
              'size-1.5 rounded-full',
              setting.enabled === 1 ? 'bg-primary' : 'bg-text-muted'
            )}
          />
          {setting.enabled === 1 ? t('card.statusOn') : t('card.statusOff')}
        </div>

        <div className='flex flex-wrap items-center gap-1.5'>
          {canManageStorage && (
            <Button
              variant={setting.enabled === 1 ? 'secondary' : 'default'}
              size='sm'
              onClick={() => setToggleDialogOpen(true)}
              disabled={isLoading}
              className='h-8 bg-surface'
            >
              {setting.enabled === 1 ? t('card.disable') : t('card.enable')}
            </Button>
          )}
          <Button
            variant='ghost'
            size='sm'
            onClick={() => setViewModalOpen(true)}
            className='h-8'
          >
            <Eye className='size-3.5' strokeWidth={1.75} />
            {t('card.view')}
          </Button>
          {canManageStorage && (
            <>
              <Button
                variant='ghost'
                size='sm'
                onClick={handleOpenEdit}
                className='h-8'
              >
                <Settings strokeWidth={1.75} />
                {t('card.edit')}
              </Button>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => setDeleteDialogOpen(true)}
                className='h-8 text-destructive hover:text-destructive'
              >
                <Trash2 className='size-3.5' strokeWidth={1.75} />
                {t('card.delete')}
              </Button>
            </>
          )}
        </div>
      </li>

      {/* View Modal */}
      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent className='sm:max-w-[500px]'>
          <DialogHeader>
            <DialogTitle>{t('card.detailTitle')}</DialogTitle>
          </DialogHeader>

          <div className='flex flex-col gap-6'>
            <DescriptionFieldList>
              {schemes.map((field) => (
                <DescriptionField key={field.identifier}>
                  <DescriptionFieldLabel>{field.label}</DescriptionFieldLabel>
                  <DescriptionFieldValueRow>
                    <DescriptionFieldValue className='min-w-0 flex-1' breakAll>
                      {maskValue(
                        field.identifier,
                        getEnumLabel(field, configData[field.identifier])
                      )}
                    </DescriptionFieldValue>
                    <Button
                      variant='outline'
                      size='icon'
                      className='h-8 w-8 shrink-0'
                      onClick={() =>
                        handleCopyField(
                          field.identifier,
                          maskValue(
                            field.identifier,
                            configData[field.identifier]
                          )
                        )
                      }
                    >
                      {copiedField === field.identifier ? (
                        <Check className='h-4 w-4 text-success' />
                      ) : (
                        <Copy className='h-4 w-4' />
                      )}
                    </Button>
                  </DescriptionFieldValueRow>
                </DescriptionField>
              ))}
              <DescriptionField>
                <DescriptionFieldLabel>
                  {t('card.remarkField')}
                </DescriptionFieldLabel>
                <DescriptionFieldValue breakAll>
                  {setting.remark || t('card.noRemark')}
                </DescriptionFieldValue>
              </DescriptionField>
            </DescriptionFieldList>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant='outline'>{t('card.cancel')}</Button>
            </DialogClose>
            <Button onClick={handleCopyConfig}>
              {copiedConfig ? (
                <>
                  <Check className='mr-2 h-4 w-4' />
                  {t('card.copiedBtn')}
                </>
              ) : (
                <>
                  <Copy className='mr-2 h-4 w-4' />
                  {t('card.copyConfig')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className='max-h-[85vh] sm:max-w-2xl overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>{t('card.editTitle')}</DialogTitle>
          </DialogHeader>
          <div className='flex flex-col gap-6'>
            {schemes.map((field) => (
              <div key={field.identifier} className='flex flex-col gap-3'>
                <Label htmlFor={`edit-${field.identifier}`}>
                  {field.validation.required && (
                    <span className='relative top-0.5 text-destructive'>* </span>
                  )}
                  {field.label}
                </Label>
                {field.dataType === 'enums' && field.enums ? (
                  <Select
                    value={editFormData[field.identifier] || ''}
                    onValueChange={(value) => {
                      setEditFormData({
                        ...editFormData,
                        [field.identifier]: value,
                      })
                      clearEditFieldError(field.identifier)
                    }}
                  >
                    <SelectTrigger
                      className={`w-full ${
                          editErrors[field.identifier] ? 'border-destructive' : ''
                        }`}
                    >
                      <SelectValue
                        placeholder={t('addModal.fieldPh', {
                          label: field.label,
                        })}
                      />
                    </SelectTrigger>
                    <SelectContent>
<SelectGroup>
                      {field.enums.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
</SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={`edit-${field.identifier}`}
                    type={isSensitiveField(field.identifier) ? 'password' : 'text'}
                    value={editFormData[field.identifier] || ''}
                    onChange={(e) => {
                      setEditFormData({
                        ...editFormData,
                        [field.identifier]: e.target.value,
                      })
                      clearEditFieldError(field.identifier)
                    }}
                    placeholder={t('addModal.fieldPh', { label: field.label })}
                    className={
                      editErrors[field.identifier] ? 'border-destructive' : ''
                    }
                  />
                )}
                {editErrors[field.identifier] && (
                  <div className='flex items-center gap-1 text-sm text-destructive'>
                    <AlertCircle className='h-3 w-3' />
                    <span>{editErrors[field.identifier]}</span>
                  </div>
                )}
              </div>
            ))}
            <div className='flex flex-col gap-3'>
              <Label htmlFor='edit-remark'>{t('card.remarkField')}</Label>
              <Input
                id='edit-remark'
                value={editRemark}
                onChange={(e) => setEditRemark(e.target.value)}
                placeholder={t('card.editRemarkPh')}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant='outline' disabled={isLoading}>
                {t('card.cancel')}
              </Button>
            </DialogClose>
            <Button
              onClick={handleSaveEdit}
              disabled={
                isLoading ||
                !schemes.every((field) =>
                  field.validation.required
                    ? isSensitiveField(field.identifier) ||
                      editFormData[field.identifier]?.trim()
                    : true
                )
              }
            >
              {isLoading ? t('addModal.saving') : t('addModal.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <ConfirmDialog
        destructive
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        handleConfirm={handleDelete}
        isLoading={isLoading}
        title={t('card.deleteTitle')}
        desc={t('card.deleteDesc', { name: setting.storagePlatform.name })}
        confirmText={isLoading ? t('card.deleting') : t('card.confirmDelete')}
        cancelBtnText={t('card.cancel')}
      />

      {/* Toggle Dialog */}
      <ConfirmDialog
        open={toggleDialogOpen}
        onOpenChange={setToggleDialogOpen}
        handleConfirm={handleToggle}
        isLoading={isLoading}
        title={
          setting.enabled === 1
            ? t('card.toggleDisableTitle')
            : t('card.toggleEnableTitle')
        }
        desc={
          setting.enabled === 1
            ? t('card.toggleDisableDesc')
            : t('card.toggleEnableDesc', {
                name: setting.storagePlatform.name,
              })
        }
        confirmText={
          isLoading
            ? t('card.processing')
            : t('card.confirmToggle', {
                action:
                  setting.enabled === 1
                    ? t('card.disable')
                    : t('card.enable'),
              })
        }
        cancelBtnText={t('card.cancel')}
      />
    </>
  )
}
