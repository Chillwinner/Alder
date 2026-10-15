/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { MemoVisibility } from '@/types/workspace-board'

type Props = {
  className?: string
  disabled?: boolean
  label?: string
  onCreate: (kind: 'md' | 'canvas', visibility: MemoVisibility) => void
}

export function NewMemoMenu({ className, disabled, label, onCreate }: Props) {
  const { t } = useTranslation('board')
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type='button' className={className} disabled={disabled} title={t('newMemo')}>
          <Plus className='size-4' strokeWidth={2.2} />
          {label}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='min-w-44'>
        <DropdownMenuLabel>{t('visibility.private')}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onCreate('md', 'private')}>{t('mdKind')}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onCreate('canvas', 'private')}>
          {t('canvas.kind')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t('visibility.shared')}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onCreate('md', 'shared')}>{t('mdKind')}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onCreate('canvas', 'shared')}>
          {t('canvas.kind')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
