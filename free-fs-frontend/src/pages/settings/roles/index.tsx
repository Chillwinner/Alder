/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { roleApi } from '@/api/role'
import { permissionApi } from '@/api/permission'
import { usePermission } from '@/hooks/use-permission'
import type { RoleListItem } from '@/types/role'
import type { PermissionDef } from '@/types/permission'
import {
  SettingsPageDescription,
  SettingsPageEyebrow,
  SettingsPageTitle,
} from '../components/settings-page-header'
import { displayRoleDesc, displayRoleName } from '@/utils/role-label'
import { RoleDialog } from './role-dialog'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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

function isPresetRole(r: RoleListItem) {
  if (r.roleType === 0) return true
  if (r.roleType === 1) return false
  return ['admin', 'member', 'viewer'].includes(r.roleCode)
}

export function SettingsRoles() {
  const { t } = useTranslation('settings')
  const { hasPermission } = usePermission()
  const canManageRoles = hasPermission('member:manage')
  const canCreateRole = canManageRoles
  const canUpdateRole = canManageRoles
  const canDeleteRole = canManageRoles

  const [roles, setRoles] = useState<RoleListItem[]>([])
  const [permissionDefs, setPermissionDefs] = useState<PermissionDef[]>([])
  const [loading, setLoading] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<RoleListItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RoleListItem | null>(null)

  const presetRoles = roles.filter(isPresetRole)
  const customRoles = roles.filter((r) => !isPresetRole(r))

  const fetchRoles = useCallback(async () => {
    setLoading(true)
    try {
      const data = await roleApi.list()
      setRoles(data)
    } catch (err: any) {
      if (!err?.handled) toast.error(t('roles.listFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  const fetchPermissionDefs = useCallback(async () => {
    try {
      const data = await permissionApi.list()
      setPermissionDefs(data)
    } catch (err: any) {
      if (!err?.handled) toast.error(t('roles.permListFailed'))
    }
  }, [t])

  useEffect(() => {
    fetchRoles()
    fetchPermissionDefs()
  }, [fetchRoles, fetchPermissionDefs])

  const handleCreate = () => {
    setEditingRole(null)
    setDialogOpen(true)
  }

  const handleEdit = (role: RoleListItem) => {
    if (isPresetRole(role)) return
    setEditingRole(role)
    setDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await roleApi.delete(deleteTarget.id)
      toast.success(t('roles.deleted'))
      setDeleteTarget(null)
      fetchRoles()
    } catch (err: any) {
      if (!err?.handled) toast.error(t('roles.deleteFailed'))
    }
  }

  const renderRoleTable = (
    title: string,
    hint: string,
    list: RoleListItem[],
    showActions: boolean
  ) => (
    <section className='min-w-0'>
      <div className='mb-4 flex items-start justify-between gap-4'>
        <div className='flex flex-col min-w-0 flex-1 gap-1'>
          <h2 className='text-[15px] font-semibold tracking-tight'>{title}</h2>
          <p className='text-[13.5px] leading-relaxed text-muted-foreground'>
            {hint}
          </p>
        </div>
        {showActions && canCreateRole && (
          <Button
            size='sm'
            onClick={handleCreate}
            className='a-btn a-btn--primary a-btn--sm shrink-0'
          >
            <Plus strokeWidth={2} />
            {t('roles.createRole')}
          </Button>
        )}
      </div>
      <div className='set-group overflow-hidden'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-[140px] font-mono text-[11px] uppercase tracking-wider'>
                {t('roles.colName')}
              </TableHead>
              <TableHead className='w-[120px] font-mono text-[11px] uppercase tracking-wider'>
                {t('roles.colCode')}
              </TableHead>
              <TableHead className='min-w-[200px] font-mono text-[11px] uppercase tracking-wider'>
                {t('roles.colDesc')}
              </TableHead>
              {showActions && (canUpdateRole || canDeleteRole) && (
                <TableHead className='w-[100px] text-right font-mono text-[11px] uppercase tracking-wider'>
                  {t('roles.colActions')}
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && list.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={showActions && (canUpdateRole || canDeleteRole) ? 4 : 3}
                  className='py-10 text-center text-muted-foreground'
                >
                  {t('roles.loading')}
                </TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={showActions && (canUpdateRole || canDeleteRole) ? 4 : 3}
                  className='py-8 text-center text-muted-foreground'
                >
                  {t('roles.empty')}
                </TableCell>
              </TableRow>
            ) : (
              list.map((role) => (
                <TableRow key={role.id} className='hover:bg-surface-hover'>
                  <TableCell>
                    <span className='font-medium'>
                      {displayRoleName(t, role)}
                    </span>
                  </TableCell>
                  <TableCell className='font-mono text-xs text-muted-foreground'>
                    {role.roleCode}
                  </TableCell>
                  <TableCell className='text-xs text-muted-foreground'>
                    {displayRoleDesc(t, role) || '—'}
                  </TableCell>
                  {showActions && (canUpdateRole || canDeleteRole) && (
                    <TableCell className='text-right'>
                      <div className='flex justify-end gap-1'>
                        {canUpdateRole && (
                          <Button
                            variant='ghost'
                            size='icon'
                            className='h-8 w-8'
                            onClick={() => handleEdit(role)}
                          >
                            <Pencil className='h-3.5 w-3.5' />
                          </Button>
                        )}
                        {canDeleteRole && (
                          <Button
                            variant='ghost'
                            size='icon'
                            className='h-8 w-8 text-destructive hover:text-destructive'
                            onClick={() => setDeleteTarget(role)}
                          >
                            <Trash2 className='h-3.5 w-3.5' />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  )

  return (
    <div className='flex flex-1 flex-col'>
      <header className='flex flex-col mb-6 flex-none gap-1.5'>
        <SettingsPageEyebrow>{t('nav.roles')}</SettingsPageEyebrow>
        <SettingsPageTitle>{t('roles.pageTitle')}</SettingsPageTitle>
        <SettingsPageDescription>
          {t('roles.pageDescription')}
        </SettingsPageDescription>
      </header>

      <div className='flex flex-col gap-6'>
        {renderRoleTable(
          t('roles.presetTitle'),
          t('roles.presetHint'),
          presetRoles,
          false
        )}

        {renderRoleTable(
          t('roles.customTitle'),
          t('roles.customHint'),
          customRoles,
          true
        )}
      </div>

        <RoleDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          role={editingRole}
          permissionDefs={permissionDefs}
          onSuccess={fetchRoles}
        />

        <AlertDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('roles.confirmDeleteTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('roles.confirmDeleteDesc', {
                  name:
                    displayRoleName(t, deleteTarget ?? {}) || '',
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('roles.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
                onClick={handleDelete}
              >
                {t('roles.confirmDeleteAction')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </div>
  )
}
