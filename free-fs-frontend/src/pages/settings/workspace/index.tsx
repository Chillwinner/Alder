/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { workspaceApi } from '@/api/workspace'
import { useWorkspaceStore } from '@/store/workspace'
import { useAuth } from '@/contexts/auth-context'
import { usePermission } from '@/hooks/use-permission'
import {
  SettingsPageDescription,
  SettingsPageEyebrow,
  SettingsPageTitle,
} from '../components/settings-page-header'
import {
  SettingsBlock,
  SettingsGroup,
  SettingsRow,
} from '../components/settings-row'
import { Building2, FileText, HardDrive, Link2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export function SettingsWorkspace() {
  const { t } = useTranslation('settings')
  const navigate = useNavigate()
  const { loadWorkspaces, activateWorkspace, user } = useAuth()
  const { isAdmin } = usePermission()
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId)
  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [quotaGb, setQuotaGb] = useState('5')
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  const isOwner = currentWorkspace?.ownerId === user?.id

  useEffect(() => {
    if (currentWorkspace) {
      setName(currentWorkspace.name)
      setDescription(currentWorkspace.description || '')
      const bytes = currentWorkspace.localQuotaBytes ?? 5 * 1024 * 1024 * 1024
      const gb = bytes / (1024 * 1024 * 1024)
      setQuotaGb(String(Number(gb.toFixed(gb >= 10 ? 1 : 2))))
    }
  }, [currentWorkspace])

  const saveIfChanged = async () => {
    if (!currentWorkspace || !isAdmin) return
    const trimmedName = name.trim()
    if (!trimmedName) {
      toast.error(t('workspace.nameRequired'))
      return
    }
    const trimmedDesc = description.trim()
    const prevDesc = (currentWorkspace.description ?? '').trim()
    const quota = Number(quotaGb)
    const prevQuotaGb =
      (currentWorkspace.localQuotaBytes ?? 5 * 1024 * 1024 * 1024) /
      (1024 * 1024 * 1024)
    if (!Number.isFinite(quota) || quota < 0.1 || quota > 10240) {
      toast.error(t('workspace.localQuotaInvalid'))
      return
    }
    if (
      trimmedName === currentWorkspace.name &&
      trimmedDesc === prevDesc &&
      Math.abs(quota - prevQuotaGb) < 0.001
    ) {
      return
    }
    setSaving(true)
    try {
      await workspaceApi.update({
        name: trimmedName,
        description: trimmedDesc || undefined,
        localQuotaGb: quota,
      })
      toast.success(t('workspace.saved'))
      await loadWorkspaces()
      if (currentWorkspaceId) {
        await activateWorkspace(currentWorkspaceId)
      }
    } catch (err: any) {
      if (!err?.handled) toast.error(t('workspace.updateFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await workspaceApi.delete()
      toast.success(t('workspace.deleted'))
      setDeleteOpen(false)
      await loadWorkspaces()
      const remaining = useWorkspaceStore.getState().workspaces
      if (remaining.length === 0) {
        navigate('/workspace/new')
      } else {
        navigate(`/w/${remaining[0].slug}/`)
      }
    } catch (err: any) {
      if (!err?.handled) toast.error(t('workspace.deleteFailed'))
    } finally {
      setDeleting(false)
    }
  }

  if (!currentWorkspace) {
    return null
  }

  return (
    <div className='flex flex-1 flex-col'>
      <header className='flex flex-col mb-6 flex-none gap-1.5'>
        <SettingsPageEyebrow>{t('nav.workspace')}</SettingsPageEyebrow>
        <SettingsPageTitle>{t('workspace.pageTitle')}</SettingsPageTitle>
        <SettingsPageDescription>
          {t('workspace.pageDescription')}
        </SettingsPageDescription>
      </header>

      <div className='flex flex-col'>
        <SettingsGroup
          label={t('workspace.sectionSettings')}
          description={t('workspace.pageDescription')}
          action={<span className='a-tag a-tag--accent'>{t('nav.workspace')}</span>}
        >
          <SettingsBlock
            icon={Building2}
            tone='blue'
            label={t('workspace.name')}
            description={t('workspace.nameDesc')}
          >
            <Input
              id='ws-name'
              value={name}
              maxLength={65}
              placeholder={t('workspace.namePlaceholder')}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                void saveIfChanged()
              }}
              disabled={saving || !isAdmin}
              required
              className='a-input max-w-md'
            />
            {saving && (
              <p className='pt-1 text-[12.5px] text-text-muted'>
                {t('workspace.saving')}
              </p>
            )}
          </SettingsBlock>

          <SettingsBlock
            icon={Link2}
            tone='neutral'
            label={t('workspace.slug')}
            description={t('workspace.slugDesc')}
          >
            <Input
              value={currentWorkspace.slug}
              disabled
              readOnly
              className='a-input set-mono max-w-md'
            />
          </SettingsBlock>

          <SettingsBlock
            icon={FileText}
            tone='teal'
            label={t('workspace.description')}
            description={t('workspace.descriptionDesc')}
          >
            <Textarea
              id='ws-desc'
              value={description}
              placeholder={t('workspace.descriptionPlaceholder')}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => {
                void saveIfChanged()
              }}
              disabled={saving || !isAdmin}
              rows={4}
              className='a-input set-textarea min-h-[100px]'
            />
          </SettingsBlock>

          <SettingsBlock
            icon={HardDrive}
            tone='orange'
            label={t('workspace.localQuota')}
            description={t('workspace.localQuotaDesc')}
          >
            <div className='flex max-w-md items-center gap-2'>
              <Input
                type='number'
                min={0.1}
                max={10240}
                step={0.1}
                value={quotaGb}
                onChange={(e) => setQuotaGb(e.target.value)}
                onBlur={() => {
                  void saveIfChanged()
                }}
                disabled={saving || !isAdmin}
                className='a-input'
              />
              <span className='shrink-0 text-[13px] text-text-muted'>
                {t('workspace.localQuotaUnit')}
              </span>
            </div>
          </SettingsBlock>
        </SettingsGroup>

        {isOwner && (
          <SettingsGroup label={t('workspace.dangerZone')}>
            <SettingsRow
              icon={Trash2}
              tone='red'
              align='start'
              label={
                <span className='text-destructive'>
                  {t('workspace.deleteTitle')}
                </span>
              }
              description={t('workspace.deleteDesc')}
            >
              <Button
                type='button'
                variant='destructive'
                size='sm'
                className='a-btn a-btn--sm shrink-0'
                onClick={() => setDeleteOpen(true)}
              >
                {t('workspace.deleteButton')}
              </Button>
            </SettingsRow>
          </SettingsGroup>
        )}
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('workspace.confirmDeleteTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('workspace.confirmDeleteDesc', {
                name: currentWorkspace.name,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className='py-2'>
            <Input
              placeholder={currentWorkspace.name}
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className='a-input'
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {t('workspace.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              disabled={
                deleting || deleteConfirmText !== currentWorkspace.name
              }
              onClick={handleDelete}
            >
              {deleting
                ? t('workspace.deleting')
                : t('workspace.confirmDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
