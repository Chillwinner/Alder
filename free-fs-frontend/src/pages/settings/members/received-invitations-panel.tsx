/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { invitationApi } from '@/api/invitation'
import { useAuth } from '@/contexts/auth-context'
import {
  notifyInvitationsChanged,
  useWorkspaceInvitations,
} from '@/hooks/use-workspace-invitations'
import { useWorkspaceStore } from '@/store/workspace'
import { displayRoleName } from '@/utils/role-label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function ReceivedInvitationsPanel() {
  const { t } = useTranslation('settings')
  const { t: tInvite } = useTranslation('invite')
  const navigate = useNavigate()
  const { loadWorkspaces, activateWorkspace } = useAuth()
  const { items, loading, refresh } = useWorkspaceInvitations({ enabled: true })
  const [actingToken, setActingToken] = useState<string | null>(null)

  const handleAccept = async (token: string, workspaceId: string) => {
    setActingToken(token)
    try {
      await invitationApi.acceptInvitation(token)
      toast.success(tInvite('acceptSuccess'))
      notifyInvitationsChanged()
      await loadWorkspaces()
      const { workspaces } = useWorkspaceStore.getState()
      const target =
        workspaces.find((w) => w.id === workspaceId) ?? workspaces[0]
      if (target) {
        await activateWorkspace(target.id)
        navigate(`/w/${target.slug}/`)
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : tInvite('acceptFailed'))
      void refresh()
    } finally {
      setActingToken(null)
    }
  }

  const handleReject = async (token: string) => {
    setActingToken(token)
    try {
      await invitationApi.rejectInvitation(token)
      toast.success(tInvite('rejectSuccess'))
      notifyInvitationsChanged()
      void refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : tInvite('rejectFailed'))
      void refresh()
    } finally {
      setActingToken(null)
    }
  }

  return (
    <div className='set-group mt-4 overflow-hidden'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='font-mono text-[11px] uppercase tracking-wider'>
              {t('members.colWorkspace')}
            </TableHead>
            <TableHead className='font-mono text-[11px] uppercase tracking-wider'>
              {t('members.colInviter')}
            </TableHead>
            <TableHead className='font-mono text-[11px] uppercase tracking-wider'>
              {t('members.colRole')}
            </TableHead>
            <TableHead className='font-mono text-[11px] uppercase tracking-wider'>
              {t('members.colInvitedAt')}
            </TableHead>
            <TableHead className='font-mono text-[11px] uppercase tracking-wider'>
              {t('members.colExpiresAt')}
            </TableHead>
            <TableHead className='w-[140px] font-mono text-[11px] uppercase tracking-wider'>
              {t('members.colActions')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className='py-8 text-center'>
                <Loader2 className='mx-auto size-5 animate-spin text-muted-foreground' />
              </TableCell>
            </TableRow>
          ) : items.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className='py-8 text-center text-muted-foreground'
              >
                {t('members.emptyReceivedInvites')}
              </TableCell>
            </TableRow>
          ) : (
            items.map((inv) => {
              const busy = actingToken === inv.token
              return (
                <TableRow key={inv.id} className='hover:bg-surface-hover'>
                  <TableCell className='text-sm font-medium'>
                    {inv.workspaceName}
                  </TableCell>
                  <TableCell className='text-sm text-muted-foreground'>
                    {inv.inviterName}
                  </TableCell>
                  <TableCell>
                    <Badge variant='outline'>
                      {displayRoleName(t, {
                        roleName: inv.roleName,
                        roleCode: inv.roleCode,
                      })}
                    </Badge>
                  </TableCell>
                  <TableCell className='font-mono text-xs tabular-nums text-muted-foreground'>
                    {dayjs(inv.createdAt).format('YYYY-MM-DD HH:mm')}
                  </TableCell>
                  <TableCell className='font-mono text-xs tabular-nums text-muted-foreground'>
                    {dayjs(inv.expiresAt).format('YYYY-MM-DD HH:mm')}
                  </TableCell>
                  <TableCell>
                    <div className='flex gap-1'>
                      <Button
                        type='button'
                        size='sm'
                        className='h-7 px-2 text-xs'
                        disabled={busy || !inv.token}
                        onClick={() =>
                          void handleAccept(inv.token!, inv.workspaceId)
                        }
                      >
                        {busy ? (
                          <Loader2 className='size-3.5 animate-spin' />
                        ) : (
                          tInvite('acceptInvite')
                        )}
                      </Button>
                      <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        className='h-7 px-2 text-xs'
                        disabled={busy || !inv.token}
                        onClick={() => void handleReject(inv.token!)}
                      >
                        {tInvite('rejectInvite')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
