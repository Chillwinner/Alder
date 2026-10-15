/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'
import { toast } from 'sonner'
import { Inbox, Loader2 } from 'lucide-react'
import { invitationApi } from '@/api/invitation'
import { useAuth } from '@/contexts/auth-context'
import {
  notifyInvitationsChanged,
  useWorkspaceInvitations,
} from '@/hooks/use-workspace-invitations'
import { useWorkspaceStore } from '@/store/workspace'
import { displayRoleName } from '@/utils/role-label'
import { Logo } from '@/components/logo'

export default function InvitationsPage() {
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId)
  const workspace =
    workspaces.find((item) => item.id === currentWorkspaceId) ?? workspaces[0]
  if (workspace) {
    return <Navigate to={`/w/${workspace.slug}/notifications`} replace />
  }
  return <PendingInvitationsPage />
}

function PendingInvitationsPage() {
  const { t } = useTranslation('invite')
  const { t: tSettings } = useTranslation('settings')
  const navigate = useNavigate()
  const { loadWorkspaces, activateWorkspace } = useAuth()
  const { items, loading, refresh } = useWorkspaceInvitations({ enabled: true })
  const [actingToken, setActingToken] = useState<string | null>(null)

  const handleAccept = async (token: string, workspaceId: string) => {
    setActingToken(token)
    try {
      await invitationApi.acceptInvitation(token)
      toast.success(t('acceptSuccess'))
      notifyInvitationsChanged()
      await loadWorkspaces()
      const { workspaces: next } = useWorkspaceStore.getState()
      const target = next.find((w) => w.id === workspaceId) ?? next[0]
      if (target) {
        await activateWorkspace(target.id)
        navigate(`/w/${target.slug}/`)
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('acceptFailed'))
      void refresh()
    } finally {
      setActingToken(null)
    }
  }

  const handleReject = async (token: string) => {
    setActingToken(token)
    try {
      await invitationApi.rejectInvitation(token)
      toast.success(t('rejectSuccess'))
      notifyInvitationsChanged()
      void refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('rejectFailed'))
      void refresh()
    } finally {
      setActingToken(null)
    }
  }

  return (
    <div className='relative min-h-screen w-full overflow-hidden bg-background'>
      <div aria-hidden='true' className='a-ambient absolute inset-0 z-0' />

      <div className='relative z-10 mx-auto w-full max-w-3xl px-5 pt-7 pb-16 md:px-6'>
        <div className='a-brandline'>
          <span className='a-brandline__mark'>
            <Logo className='size-[18px]' />
          </span>
          <span className='a-brandline__name'>Alder</span>
        </div>

        <div className='a-page mt-12'>
          <header className='a-phead'>
            <div>
              <span className='font-mono text-[11px] tracking-wider text-text-muted uppercase'>
                Invitations
              </span>
              <h1 className='mt-2'>{t('inboxTitle')}</h1>
              <p className='a-sub'>{t('inboxDesc')}</p>
            </div>
            <div className='a-phead__right'>
              <span className='a-tag font-mono tabular-nums'>
                {loading && items.length === 0 ? '—' : items.length}
              </span>
            </div>
          </header>

          {loading && items.length === 0 ? (
            <div className='a-glass flex flex-col items-center gap-3 rounded-[24px] px-6 py-14 text-center'>
              <Loader2 className='size-6 animate-spin text-primary' />
              <p className='text-[13px] text-text-secondary'>{t('loading')}</p>
            </div>
          ) : items.length === 0 ? (
            <div className='a-glass tech-rise flex flex-col items-center gap-4 rounded-[24px] px-6 py-14 text-center'>
              <span className='flex size-14 items-center justify-center rounded-[18px] bg-accent-soft text-primary'>
                <Inbox className='size-7' strokeWidth={1.7} />
              </span>
              <p className='text-[15px] font-semibold tracking-tight'>
                {t('inboxEmpty')}
              </p>
              <p className='max-w-sm text-[13.5px] leading-relaxed text-text-secondary'>
                {t('inboxDesc')}
              </p>
            </div>
          ) : (
            <div className='flex flex-col gap-3.5'>
              {items.map((inv, index) => {
                const busy = actingToken === inv.token
                const initial = (inv.workspaceName || 'A').trim().slice(0, 1)
                const roleLabel = displayRoleName(tSettings, {
                  roleName: inv.roleName,
                  roleCode: inv.roleCode,
                })
                return (
                  <article
                    key={inv.id}
                    className='a-glass tech-rise rounded-[24px] px-4 py-4 md:px-5'
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    <div className='flex flex-wrap items-center gap-x-4 gap-y-4'>
                      <span className='flex size-12 shrink-0 items-center justify-center rounded-[16px] bg-accent-soft text-[18px] leading-none font-semibold text-primary'>
                        {initial}
                      </span>

                      <div className='min-w-0 flex-1'>
                        <h2 className='truncate text-[17px] leading-tight font-semibold tracking-tight'>
                          {inv.workspaceName}
                        </h2>
                        <div className='mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5'>
                          <span className='text-[13px] text-text-secondary'>
                            {t('invitedBy')} · {inv.inviterName}
                          </span>
                          <span className='a-tag a-tag--accent'>{roleLabel}</span>
                          <span className='font-mono text-[11.5px] tabular-nums text-text-muted'>
                            {dayjs(inv.createdAt).format('MM-DD HH:mm')}
                          </span>
                          <span className='font-mono text-[11.5px] tabular-nums text-text-muted'>
                            → {dayjs(inv.expiresAt).format('MM-DD HH:mm')}
                          </span>
                        </div>
                      </div>

                      <div className='flex shrink-0 items-center gap-2'>
                        <button
                          type='button'
                          className='a-btn a-btn--ghost a-btn--sm'
                          disabled={busy || !inv.token}
                          onClick={() => void handleReject(inv.token!)}
                        >
                          {t('rejectInvite')}
                        </button>
                        <button
                          type='button'
                          className='a-btn a-btn--primary a-btn--sm'
                          disabled={busy || !inv.token}
                          onClick={() =>
                            void handleAccept(inv.token!, inv.workspaceId)
                          }
                        >
                          {busy ? (
                            <Loader2 className='size-3.5 animate-spin' />
                          ) : (
                            t('acceptInvite')
                          )}
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
