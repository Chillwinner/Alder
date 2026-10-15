/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { Command as CommandPrimitive } from 'cmdk'
import {
  Bell,
  FileText,
  Folder,
  HardDrive,
  Home,
  Image,
  Inbox,
  MessageSquare,
  Moon,
  Music,
  NotebookPen,
  Palette,
  Search,
  Settings,
  Star,
  Sun,
  Trash2,
  Upload,
  UserRound,
  Users,
  Calendar,
  Keyboard,
  ListTodo,
  Video,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useSearch } from '@/context/search-provider'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { useSettingsModal, type SettingsTab } from '@/contexts/settings-modal-context'
import { useTheme } from '@/components/theme-provider'
import { usePermission } from '@/hooks/use-permission'
import { useImStore } from '@/store/im'
import { useCommandPaletteSearch } from '@/hooks/use-command-palette-search'
import { openFilePreview } from '@/utils/preview'
import type { FileType } from '@/types/file'
import { cn } from '@/lib/utils'

/** `all` 表示未选类型；其余与文件页 URL `type` / `isDir` 一致 */
export type SearchScopeId = 'all' | 'image' | 'video' | 'folder' | 'document' | 'audio'

const FILE_TYPE_META: {
  id: Exclude<SearchScopeId, 'all'>
  icon: ComponentType<{ className?: string }>
}[] = [
  { id: 'image', icon: Image },
  { id: 'video', icon: Video },
  { id: 'folder', icon: Folder },
  { id: 'document', icon: FileText },
  { id: 'audio', icon: Music },
]

const ITEM_CLASS =
  'rounded-lg transition-colors data-[selected=true]:bg-sidebar-accent data-[selected=true]:text-sidebar-accent-foreground'

const GROUP_CLASS =
  '[&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground'

/** 快捷搜索使用独立参数，避免污染文件页工具栏搜索框的 `keyword`。 */
function buildFilesSearchHref(
  slug: string,
  keyword: string,
  scope: SearchScopeId
): string {
  const k = keyword.trim()
  const params = new URLSearchParams()
  if (k) params.set('quickKeyword', k)
  if (scope === 'folder') {
    params.set('isDir', 'true')
  } else if (scope !== 'all') {
    params.set('type', scope as FileType)
  }
  const q = params.toString()
  const filesPath = `/w/${slug}/files`
  return q ? `${filesPath}?${q}` : filesPath
}

export function CommandMenu() {
  const { t } = useTranslation('common')
  const { t: tl } = useTranslation('layout')
  const { t: ts } = useTranslation('settings')
  const { open, setOpen } = useSearch()
  const { openSettings } = useSettingsModal()
  const { theme, setTheme } = useTheme()
  const { hasPermission } = usePermission()
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()
  const inputRef = useRef<HTMLInputElement>(null)
  const [keyword, setKeyword] = useState('')
  const [scopeId, setScopeId] = useState<SearchScopeId>('all')

  useEffect(() => {
    if (!open) return
    setKeyword('')
    setScopeId('all')
  }, [open])

  const focusInput = useCallback(() => {
    inputRef.current?.focus()
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    const id = window.requestAnimationFrame(focusInput)
    return () => window.cancelAnimationFrame(id)
  }, [focusInput, open, scopeId])

  const handlePaletteKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const input = inputRef.current
      if (!input) return
      const onInput = event.target === input
      if (onInput) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === 'Tab' || event.key === 'Escape') return

      const listNav =
        event.key === 'ArrowDown' ||
        event.key === 'ArrowUp' ||
        event.key === 'Home' ||
        event.key === 'End' ||
        event.key === 'PageDown' ||
        event.key === 'PageUp' ||
        event.key === 'Enter'
      const typesIntoInput =
        event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete'

      if (!listNav && !typesIntoInput) return

      input.focus()
      event.preventDefault()
      event.stopPropagation()

      if (listNav) {
        input.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: event.key,
            code: event.code,
            bubbles: true,
            cancelable: true,
          })
        )
        return
      }
      if (event.key === 'Backspace') {
        setKeyword((current) => current.slice(0, -1))
        return
      }
      if (event.key === 'Delete') return
      setKeyword((current) => current + event.key)
    },
    []
  )

  const showScopeBadge = scopeId !== 'all'
  const hasKeyword = keyword.trim().length > 0
  const hits = useCommandPaletteSearch(keyword, open && hasKeyword && Boolean(slug))
  const canManageStorage = hasPermission('storage:manage')

  const scopeLabel = useMemo(() => {
    if (scopeId === 'all') return ''
    return t(`commandMenu.types.${scopeId}`)
  }, [scopeId, t])

  const close = () => setOpen(false)

  const afterClose = (fn: () => void) => {
    setOpen(false)
    window.setTimeout(fn, 0)
  }

  const go = (path: string) => {
    if (!slug) return
    afterClose(() => navigate(path))
  }

  const submitToFilesPage = () => {
    const q = keyword.trim()
    if (!q || !slug) return
    close()
    navigate(buildFilesSearchHref(slug, q, scopeId))
  }

  const openTab = (tab: SettingsTab) => {
    afterClose(() => openSettings(tab))
  }

  const clearSearch = () => {
    setKeyword('')
    setScopeId('all')
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }

  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      contentTitle={t('commandMenu.title')}
      hideClose
      contentProps={{
        onOpenAutoFocus: focusInput,
        onKeyDown: handlePaletteKeyDown,
      }}
    >
      <div
        className='flex items-center gap-2 border-b px-3 py-2'
        cmdk-input-wrapper=''
      >
        <Search className='size-4 shrink-0 opacity-50' aria-hidden />
        {showScopeBadge ? (
          <span className='inline-flex max-w-[45%] shrink-0 items-center rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[11px] tracking-wider text-primary'>
            <span className='truncate'>{scopeLabel}:</span>
          </span>
        ) : null}
        <CommandPrimitive.Input
          ref={inputRef}
          autoFocus
          className='flex h-10 min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50'
          placeholder={
            showScopeBadge
              ? t('commandMenu.placeholderScoped')
              : t('commandMenu.placeholderAll')
          }
          value={keyword}
          onValueChange={setKeyword}
        />
        <Button
          type='button'
          variant='ghost'
          size='sm'
          className='h-8 shrink-0 px-2 text-xs text-muted-foreground hover:text-foreground'
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onClick={(e) => {
            e.stopPropagation()
            clearSearch()
          }}
        >
          {t('commandMenu.clear')}
        </Button>
        <Separator orientation='vertical' className='h-4 shrink-0' />
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='h-8 w-8 shrink-0'
          aria-label={t('commandMenu.closeAria')}
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onClick={(e) => {
            e.stopPropagation()
            close()
          }}
        >
          <X className='size-4' />
        </Button>
      </div>

      <CommandList className='max-h-[min(420px,60vh)]'>
        <CommandEmpty>{t('commandMenu.empty')}</CommandEmpty>

        {hasKeyword && slug ? (
          <CommandGroup heading={t('commandMenu.searchHeading')} className={GROUP_CLASS}>
            <CommandItem
              value={`search-files ${keyword}`}
              keywords={[keyword, t('commandMenu.searchFiles', { query: keyword })]}
              className={ITEM_CLASS}
              onSelect={submitToFilesPage}
            >
              <Search className='size-4 text-hud' />
              <span>{t('commandMenu.searchFiles', { query: keyword })}</span>
            </CommandItem>
            {hits.fileHits.map((file) => (
              <CommandItem
                key={`file-${file.id}`}
                value={`hit-file ${file.displayName} ${file.id}`}
                className={ITEM_CLASS}
                onSelect={() => {
                  if (file.isDir) {
                    go(`/w/${slug}/files?parentId=${file.id}`)
                    return
                  }
                  afterClose(() => openFilePreview(file))
                }}
              >
                <FileText className='size-4 text-hud' />
                <span className='truncate'>{file.displayName}</span>
              </CommandItem>
            ))}
            {hits.memoHits.map((memo) => (
              <CommandItem
                key={`memo-${memo.id}`}
                value={`hit-memo ${memo.title} ${memo.id}`}
                className={ITEM_CLASS}
                onSelect={() => go(`/w/${slug}/board/${memo.id}`)}
              >
                <NotebookPen className='size-4 text-hud' />
                <span className='truncate'>{memo.title}</span>
              </CommandItem>
            ))}
            {hits.chatHits.map((item) => (
              <CommandItem
                key={`chat-${item.conversationId}`}
                value={`hit-chat ${hits.inboxLabel(item)} ${item.conversationId}`}
                className={ITEM_CLASS}
                onSelect={() => {
                  afterClose(() =>
                    useImStore.getState().openDialog({
                      conversationId: item.conversationId,
                    })
                  )
                }}
              >
                <MessageSquare className='size-4 text-hud' />
                <span className='truncate'>{hits.inboxLabel(item) || t('commandMenu.openMessages')}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {scopeId === 'all' ? (
          <CommandGroup heading={t('commandMenu.typeHeading')} className={GROUP_CLASS}>
            {FILE_TYPE_META.map(({ id, icon: Icon }) => {
              const label = t(`commandMenu.types.${id}`)
              return (
                <CommandItem
                  key={id}
                  value={`type-${id} ${label}`}
                  keywords={[label]}
                  className={ITEM_CLASS}
                  onSelect={() => setScopeId(id)}
                >
                  <Icon className='size-4 text-hud' />
                  <span>{label}</span>
                </CommandItem>
              )
            })}
          </CommandGroup>
        ) : null}

        {slug ? (
          <CommandGroup heading={t('commandMenu.goHeading')} className={GROUP_CLASS}>
            <CommandItem
              value={`go-home ${tl('sidebar.nav.home')}`}
              className={ITEM_CLASS}
              onSelect={() => go(`/w/${slug}/`)}
            >
              <Home className='size-4 text-hud' />
              <span>{tl('sidebar.nav.home')}</span>
            </CommandItem>
            <CommandItem
              value={`go-files ${tl('sidebar.nav.allFiles')}`}
              className={ITEM_CLASS}
              onSelect={() => go(`/w/${slug}/files`)}
            >
              <Folder className='size-4 text-hud' />
              <span>{tl('sidebar.nav.allFiles')}</span>
            </CommandItem>
            <CommandItem
              value={`go-board ${tl('sidebar.nav.board')}`}
              className={ITEM_CLASS}
              onSelect={() => go(`/w/${slug}/board`)}
            >
              <NotebookPen className='size-4 text-hud' />
              <span>{tl('sidebar.nav.board')}</span>
            </CommandItem>
            <CommandItem
              value={`go-meetings ${tl('sidebar.nav.meetings')}`}
              className={ITEM_CLASS}
              onSelect={() => go(`/w/${slug}/meetings`)}
            >
              <Calendar className='size-4 text-hud' />
              <span>{tl('sidebar.nav.meetings')}</span>
            </CommandItem>
            <CommandItem
              value={`go-progress ${tl('sidebar.nav.progress')}`}
              className={ITEM_CLASS}
              onSelect={() => go(`/w/${slug}/progress`)}
            >
              <ListTodo className='size-4 text-hud' />
              <span>{tl('sidebar.nav.progress')}</span>
            </CommandItem>
            <CommandItem
              value={`go-transfer ${tl('sidebar.nav.transfer')}`}
              className={ITEM_CLASS}
              onSelect={() => go(`/w/${slug}/transfer`)}
            >
              <Upload className='size-4 text-hud' />
              <span>{tl('sidebar.nav.transfer')}</span>
            </CommandItem>
            <CommandItem
              value={`go-favorites ${tl('sidebar.nav.favorites')}`}
              className={ITEM_CLASS}
              onSelect={() => go(`/w/${slug}/files?view=favorites`)}
            >
              <Star className='size-4 text-hud' />
              <span>{tl('sidebar.nav.favorites')}</span>
            </CommandItem>
            <CommandItem
              value={`go-collections ${tl('sidebar.nav.collections')}`}
              className={ITEM_CLASS}
              onSelect={() => go(`/w/${slug}/files?view=collections`)}
            >
              <Inbox className='size-4 text-hud' />
              <span>{tl('sidebar.nav.collections')}</span>
            </CommandItem>
            <CommandItem
              value={`go-recycle ${tl('sidebar.nav.recycle')}`}
              className={ITEM_CLASS}
              onSelect={() => go(`/w/${slug}/files?view=recycle`)}
            >
              <Trash2 className='size-4 text-hud' />
              <span>{tl('sidebar.nav.recycle')}</span>
            </CommandItem>
            <CommandItem
              value={`go-notifications ${tl('breadcrumb.notifications')}`}
              className={ITEM_CLASS}
              onSelect={() => go(`/w/${slug}/notifications`)}
            >
              <Bell className='size-4 text-hud' />
              <span>{tl('breadcrumb.notifications')}</span>
            </CommandItem>
          </CommandGroup>
        ) : null}

        <CommandGroup heading={t('commandMenu.actionHeading')} className={GROUP_CLASS}>
          <CommandItem
            value={`action-messages ${tl('sidebar.nav.messages')}`}
            className={ITEM_CLASS}
            onSelect={() => {
              afterClose(() => useImStore.getState().openDialog())
            }}
          >
            <MessageSquare className='size-4 text-hud' />
            <span>{t('commandMenu.openMessages')}</span>
          </CommandItem>
          <CommandItem
            value={`action-theme ${t('commandMenu.toggleTheme')}`}
            className={ITEM_CLASS}
            onSelect={() => {
              afterClose(() => setTheme(isDark ? 'light' : 'dark'))
            }}
          >
            {isDark ? (
              <Sun className='size-4 text-hud' />
            ) : (
              <Moon className='size-4 text-hud' />
            )}
            <span>{t('commandMenu.toggleTheme')}</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading={t('commandMenu.settingsHeading')} className={GROUP_CLASS}>
          <CommandItem
            value={`settings-appearance ${ts('nav.preference')}`}
            className={ITEM_CLASS}
            onSelect={() => openTab('appearance')}
          >
            <Palette className='size-4 text-hud' />
            <span>{ts('nav.preference')}</span>
          </CommandItem>
          <CommandItem
            value={`settings-shortcuts ${ts('nav.shortcuts')}`}
            className={ITEM_CLASS}
            onSelect={() => openTab('shortcuts')}
          >
            <Keyboard className='size-4 text-hud' />
            <span>{ts('nav.shortcuts')}</span>
          </CommandItem>
          <CommandItem
            value={`settings-profile ${ts('nav.profile')}`}
            className={ITEM_CLASS}
            onSelect={() => openTab('profile')}
          >
            <UserRound className='size-4 text-hud' />
            <span>{ts('nav.profile')}</span>
          </CommandItem>
          <CommandItem
            value={`settings-workspace ${ts('nav.workspace')}`}
            className={ITEM_CLASS}
            onSelect={() => openTab('workspace')}
          >
            <Settings className='size-4 text-hud' />
            <span>{ts('nav.workspace')}</span>
          </CommandItem>
          {canManageStorage ? (
            <CommandItem
              value={`settings-storage ${ts('nav.storage')}`}
              className={ITEM_CLASS}
              onSelect={() => openTab('storage')}
            >
              <HardDrive className='size-4 text-hud' />
              <span>{ts('nav.storage')}</span>
            </CommandItem>
          ) : null}
          <CommandItem
            value={`settings-members ${ts('nav.members')}`}
            className={ITEM_CLASS}
            onSelect={() => openTab('members')}
          >
            <Users className='size-4 text-hud' />
            <span>{ts('nav.members')}</span>
          </CommandItem>
        </CommandGroup>

        <div
          className={cn(
            'px-4 py-3 text-center text-[12px] leading-relaxed text-muted-foreground',
            'border-t border-border/60'
          )}
        >
          {hasKeyword ? t('commandMenu.footerFilter') : t('commandMenu.footerHint')}
        </div>
      </CommandList>
    </CommandDialog>
  )
}
