/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useTranslation } from 'react-i18next'
import type { RoleListItem } from '@/types/role'
import { displayRoleDesc, displayRoleName } from '@/utils/role-label'
import { cn } from '@/lib/utils'

/** 角色下拉项：标题 + 描述（与列表接口中的 description 一致） */
export function RoleOptionLabel({
  role,
  compact,
  className,
}: {
  role: RoleListItem
  compact?: boolean
  className?: string
}) {
  const { t } = useTranslation('settings')
  const name = displayRoleName(t, role)
  const desc = displayRoleDesc(t, role)
  return (
    <div
      className={cn(
        'flex flex-col gap-0.5 text-left',
        compact ? 'py-0' : 'py-0.5',
        className
      )}
    >
      <span
        className={cn(
          'font-medium leading-tight tracking-tight',
          compact ? 'text-xs' : 'text-sm'
        )}
      >
        {name}
      </span>
      {desc ? (
        <span
          className={cn(
            'text-muted-foreground leading-snug',
            compact ? 'line-clamp-2 text-[11px]' : 'line-clamp-3 text-xs'
          )}
        >
          {desc}
        </span>
      ) : null}
    </div>
  )
}
