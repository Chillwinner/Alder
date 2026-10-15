/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { Building2, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { invitationApi } from '@/api/invitation'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'
import {
  notifyInvitationsChanged,
  useWorkspaceInvitations,
} from '@/hooks/use-workspace-invitations'
import { useWorkspaceStore } from '@/store/workspace'
import { displayRoleName } from '@/utils/role-label'
import { Button } from '@/components/ui/button'
import { useSettingsModal } from '@/contexts/settings-modal-context'

export function WorkspaceInvitationDock() {
  const { t } = useTranslation('invite')
  const { t: tSettings } = useTranslation('settings')
  const navigate = useNavigate()
  const { openSettings } = useSettingsModal()
  const { isAuthenticated, loadWorkspaces, activateWorkspace } = useAuth()
  const { dockItems, dismissAllVisibleInDock } = useWorkspaceInvitations({
    enabled: isAuthenticated,
  })
  const [actingToken, setActingToken] = useState<string | null>(null)

  if (!isAuthenticated || dockItems.length === 0) {
    return null
  }

  const primary = dockItems[0]
  const token = primary.token
  const extraCount = dockItems.length - 1

  const handleAccept = async () => {
    if (!token) return
    setActingToken(token)
    try {
      await invitationApi.acceptInvitation(token)
      toast.success(t('acceptSuccess'))
      notifyInvitationsChanged()
      const hasWorkspaces = await loadWorkspaces()
      if (hasWorkspaces) {
        const { workspaces } = useWorkspaceStore.getState()
        const target =
          workspaces.find((w) => w.id === primary.workspaceId) ?? workspaces[0]
        if (target) {
          await activateWorkspace(target.id)
          navigate(`/w/${target.slug}/`, { replace: false })
        }
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t('acceptFailed')
      toast.error(message)
      notifyInvitationsChanged()
    } finally {
      setActingToken(null)
    }
  }

  const handleReject = async () => {
    if (!token) return
    setActingToken(token)
    try {
      await invitationApi.rejectInvitation(token)
      toast.success(t('rejectSuccess'))
      notifyInvitationsChanged()
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t('rejectFailed')
      toast.error(message)
      notifyInvitationsChanged()
    } finally {
      setActingToken(null)
    }
  }

  const busy = actingToken === token

  return (
    <div
      className='pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-end px-4 sm:px-6'
      role='region'
      aria-label={t('dockTitle')}
    >
      <div className='pointer-events-auto glass-card w-full max-w-sm p-4'>
        <div className='mb-3 flex items-start gap-2'>
          <div className='flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-accent-soft text-primary'>
            <Building2 className='size-4' />
          </div>
          <div className='min-w-0 flex-1'>
            <p className='text-[15px] font-semibold leading-snug tracking-tight'>
              {t('dockTitle')}
            </p>
            <p className='mt-0.5 text-[13px] leading-relaxed text-muted-foreground'>
              {t('dockSubtitle', {
                workspace: primary.workspaceName,
                inviter: primary.inviterName,
              })}
            </p>
          </div>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='size-8 shrink-0 text-muted-foreground'
            aria-label={t('dockClose')}
            disabled={busy}
            onClick={dismissAllVisibleInDock}
          >
            <X />
          </Button>
        </div>

        <dl className='flex flex-col mb-3 text-xs text-muted-foreground gap-1'>
          <div className='flex justify-between gap-2'>
            <dt>{t('yourRole')}</dt>
            <dd className='text-foreground'>
              {displayRoleName(tSettings, {
                roleName: primary.roleName,
                roleCode: primary.roleCode,
              })}
            </dd>
          </div>
          <div className='flex justify-between gap-2'>
            <dt>{t('expiresAt')}</dt>
            <dd className='font-mono text-xs tabular-nums text-foreground'>
              {dayjs(primary.expiresAt).format('YYYY-MM-DD HH:mm')}
            </dd>
          </div>
        </dl>

        {extraCount > 0 ? (
          <p className='mb-2 text-xs text-muted-foreground'>
            {t('dockMore', { count: extraCount })}
          </p>
        ) : null}

        <div className='flex flex-wrap gap-2'>
          <Button
            type='button'
            size='sm'
            className='flex-1'
            disabled={busy || !token}
            onClick={() => void handleAccept()}
          >
            {busy ? (
              <Loader2 className='size-4 animate-spin' />
            ) : (
              t('acceptInvite')
            )}
          </Button>
          <Button
            type='button'
            size='sm'
            variant='outline'
            className='flex-1'
            disabled={busy || !token}
            onClick={() => void handleReject()}
          >
            {t('rejectInvite')}
          </Button>
          <Button
            type='button'
            size='sm'
            variant='ghost'
            className='w-full text-xs'
            onClick={() =>
              openSettings('members', { membersSubTab: 'received' })
            }
          >
            {t('viewAllInvitations')}
          </Button>
        </div>
      </div>
    </div>
  )
}
