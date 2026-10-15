/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useTranslation } from 'react-i18next'
import { SearchIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSearch } from '@/context/search-provider'
import { useOptionalShortcutBindings } from '@/hooks/use-shortcut-bindings'
import { DEFAULT_SHORTCUTS, formatChord } from '@/lib/shortcuts'

type SearchProps = {
  className?: string
  type?: React.HTMLInputTypeAttribute
  placeholder?: string
}

export function Search({ className = '', placeholder }: SearchProps) {
  const { t } = useTranslation('common')
  const defaultPlaceholder = placeholder ?? t('searchShortcut')
  const { setOpen } = useSearch()
  const shortcuts = useOptionalShortcutBindings()
  const paletteLabel = formatChord(
    shortcuts?.bindings.commandPalette ?? DEFAULT_SHORTCUTS.commandPalette
  )

  return (
    <button
      type='button'
      className={cn(
        'group flex h-8 w-[320px] max-w-[min(100%,360px)] items-center gap-2 rounded-[10px] border border-border/60 bg-surface/70 px-2.5 text-left text-[13px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
      onClick={() => setOpen(true)}
    >
      <SearchIcon
        aria-hidden='true'
        className='size-3.5 shrink-0'
        strokeWidth={1.75}
      />
      <span className='min-w-0 flex-1 truncate'>{defaultPlaceholder}</span>
      <kbd className='pointer-events-none hidden h-5 items-center rounded border border-border bg-surface-secondary px-1.5 font-mono text-[11px] font-medium tracking-wider text-muted-foreground sm:inline-flex'>
        {paletteLabel}
      </kbd>
    </button>
  )
}
