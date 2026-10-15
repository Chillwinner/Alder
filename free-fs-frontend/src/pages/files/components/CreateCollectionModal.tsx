/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { Check, Copy, FolderUp, Link as LinkIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { createFileCollection } from '@/api/collection'
import { notifyHeaderNotificationsChanged } from '@/hooks/use-header-notifications'
import { workspaceApi } from '@/api/workspace'
import type { FileCollection } from '@/types/collection'
import type { FileItem } from '@/types/file'
import { copyTextToClipboard } from '@/utils/copy-to-clipboard'
import { formatFileSize } from '@/utils/format'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
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
import { Textarea } from '@/components/ui/textarea'

interface CreateCollectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  folder: FileItem | null
  onCreated?: () => void
}

const SIZE_OPTIONS = [
  100 * 1024 * 1024,
  500 * 1024 * 1024,
  1024 * 1024 * 1024,
  5 * 1024 * 1024 * 1024,
  10 * 1024 * 1024 * 1024,
]

export function CreateCollectionModal({
  open,
  onOpenChange,
  folder,
  onCreated,
}: CreateCollectionModalProps) {
  const { t } = useTranslation('collection')
  const { slug = '' } = useParams<{ slug: string }>()
  const [collectionName, setCollectionName] = useState('')
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [description, setDescription] = useState('')
  const [expireType, setExpireType] = useState<'1' | '2' | '3' | '4'>('1')
  const [expireTime, setExpireTime] = useState('')
  const [needAccessCode, setNeedAccessCode] = useState(false)
  const [accessCode, setAccessCode] = useState('')
  const [maxFileSize, setMaxFileSize] = useState(String(SIZE_OPTIONS[2]))
  const [allowedExtensions, setAllowedExtensions] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState<FileCollection | null>(null)
  const [copied, setCopied] = useState(false)

  const collectionUrl = useMemo(
    () => (created ? `${window.location.origin}/collect/${created.id}` : ''),
    [created]
  )

  useEffect(() => {
    if (!open) return
    setCollectionName(folder?.displayName || folder?.originalName || '')
    setDescription('')
    setExpireType('1')
    setExpireTime('')
    setNeedAccessCode(false)
    setAccessCode('')
    setMaxFileSize(String(SIZE_OPTIONS[2]))
    setAllowedExtensions('')
    setAssigneeIds([])
    setCreated(null)
    setCopied(false)
  }, [open, folder])

  const membersQuery = useQuery({
    queryKey: ['workspace-members', slug, 'collection-create'],
    queryFn: () => workspaceApi.getMembers({ page: 1, size: 200 }),
    enabled: open && Boolean(slug),
  })
  const members = membersQuery.data?.records ?? []

  const handleCreate = async () => {
    if (!folder || !collectionName.trim()) {
      toast.warning(t('create.nameRequired'))
      return
    }
    if (expireType === '3') {
      const selected = dayjs(expireTime)
      if (!expireTime || !selected.isValid() || !selected.isAfter(dayjs())) {
        toast.warning(t('create.expireRequired'))
        return
      }
    }

    setSubmitting(true)
    try {
      const result = await createFileCollection({
        collectionName: collectionName.trim(),
        description: description.trim() || undefined,
        targetFolderId: folder.id,
        expireType: Number(expireType) as 1 | 2 | 3 | 4,
        expireTime:
          expireType === '3'
            ? dayjs(expireTime).format('YYYY-MM-DD HH:mm:ss')
            : undefined,
        needAccessCode,
        accessCode: needAccessCode ? accessCode.trim() || undefined : undefined,
        maxFileSize: Number(maxFileSize),
        allowedExtensions: allowedExtensions.trim() || undefined,
        assigneeUserIds: assigneeIds,
      })
      setCreated(result)
      notifyHeaderNotificationsChanged()
      toast.success(t('create.createdToast'))
      onCreated?.()
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopy = async () => {
    const lines = [collectionUrl]
    if (created?.accessCode) {
      lines.push(`${t('create.accessCode')}: ${created.accessCode}`)
    }
    await copyTextToClipboard(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[88vh] overflow-y-auto sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle>{t('create.title')}</DialogTitle>
        </DialogHeader>

        {created ? (
          <div className='flex flex-col py-2 gap-5'>
            <Alert>
              <Check className='size-4' />
              <AlertDescription>{t('create.created')}</AlertDescription>
            </Alert>
            <div className='flex flex-col gap-2'>
              <Label>{t('create.link')}</Label>
              <div className='flex gap-2'>
                <Input value={collectionUrl} readOnly className='font-mono text-[13px]' />
                <Button type='button' variant='outline' size='icon' onClick={handleCopy}>
                  {copied ? <Check /> : <Copy />}
                </Button>
              </div>
            </div>
            {created.accessCode && (
              <div className='flex flex-col gap-2'>
                <Label>{t('create.generatedCode')}</Label>
                <Input value={created.accessCode} readOnly className='text-center font-mono text-lg tracking-[0.3em]' />
              </div>
            )}
            <DialogFooter>
              <Button type='button' variant='outline' onClick={handleCopy}>
                <LinkIcon className='mr-2 size-4' />
                {t('create.copyAll')}
              </Button>
              <Button type='button' onClick={() => onOpenChange(false)}>
                {t('common:close')}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className='flex flex-col py-2 gap-5'>
            <div className='flex items-center gap-3 rounded-lg border border-border bg-surface-secondary p-3'>
              <FolderUp className='size-8 text-primary' />
              <div className='min-w-0'>
                <p className='font-mono text-[11px] tracking-wider text-muted-foreground uppercase'>{t('create.targetFolder')}</p>
                <p className='truncate font-medium text-foreground'>
                  {folder?.displayName || folder?.originalName}
                </p>
              </div>
            </div>

            <div className='flex flex-col gap-2'>
              <Label htmlFor='collection-name'>{t('create.name')}</Label>
              <Input
                id='collection-name'
                value={collectionName}
                maxLength={255}
                placeholder={t('create.namePlaceholder')}
                onChange={(event) => setCollectionName(event.target.value)}
              />
            </div>

            <div className='flex flex-col gap-2'>
              <Label htmlFor='collection-description'>{t('create.description')}</Label>
              <Textarea
                id='collection-description'
                value={description}
                maxLength={1000}
                placeholder={t('create.descriptionPlaceholder')}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='flex flex-col gap-2'>
                <Label>{t('create.expire')}</Label>
                <Select value={expireType} onValueChange={(value) => setExpireType(value as typeof expireType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
<SelectGroup>
                    <SelectItem value='1'>{t('create.expire7')}</SelectItem>
                    <SelectItem value='2'>{t('create.expire30')}</SelectItem>
                    <SelectItem value='3'>{t('create.expireCustom')}</SelectItem>
                    <SelectItem value='4'>{t('create.expirePermanent')}</SelectItem>
                  </SelectGroup>
</SelectContent>
                </Select>
              </div>
              <div className='flex flex-col gap-2'>
                <Label>{t('create.maxFileSize')}</Label>
                <Select value={maxFileSize} onValueChange={setMaxFileSize}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
<SelectGroup>
                    {SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {formatFileSize(size)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
</SelectContent>
                </Select>
              </div>
            </div>

            {expireType === '3' && (
              <Input
                type='datetime-local'
                value={expireTime}
                min={dayjs().add(1, 'minute').format('YYYY-MM-DDTHH:mm')}
                onChange={(event) => setExpireTime(event.target.value)}
              />
            )}

            <div className='flex flex-col rounded-lg border border-border bg-surface-secondary p-3 gap-3'>
              <div className='flex items-center gap-2'>
                <Checkbox
                  id='collection-code-enabled'
                  checked={needAccessCode}
                  onCheckedChange={(checked) => setNeedAccessCode(checked === true)}
                />
                <Label htmlFor='collection-code-enabled'>{t('create.enableAccessCode')}</Label>
              </div>
              {needAccessCode && (
                <Input
                  value={accessCode}
                  maxLength={32}
                  placeholder={t('create.accessCodeHint')}
                  onChange={(event) => setAccessCode(event.target.value)}
                />
              )}
            </div>

            {members.length > 0 ? (
              <div className='flex flex-col gap-2'>
                <Label>{t('create.assignees')}</Label>
                <p className='text-[12px] text-muted-foreground'>{t('create.assigneesHint')}</p>
                <div className='max-h-40 overflow-auto rounded-lg border border-border p-2'>
                  {members.map((member) => {
                    const checked = assigneeIds.includes(member.userId)
                    return (
                      <label
                        key={member.userId}
                        className='flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 hover:bg-surface-secondary'
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => {
                            setAssigneeIds((current) =>
                              value === true
                                ? [...current, member.userId]
                                : current.filter((id) => id !== member.userId)
                            )
                          }}
                        />
                        <span className='truncate text-[13px]'>
                          {member.nickname || member.username}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ) : null}

            <div className='flex flex-col gap-2'>
              <Label htmlFor='collection-extensions'>{t('create.allowedExtensions')}</Label>
              <Input
                id='collection-extensions'
                value={allowedExtensions}
                maxLength={1000}
                placeholder={t('create.allowedExtensionsHint')}
                onChange={(event) => setAllowedExtensions(event.target.value)}
              />
            </div>

            <DialogFooter>
              <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
                {t('common:cancel')}
              </Button>
              <Button type='button' disabled={submitting} onClick={handleCreate}>
                {submitting ? t('create.creating') : t('create.submit')}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
