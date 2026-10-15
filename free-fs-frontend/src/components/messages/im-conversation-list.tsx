/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDistanceToNow } from 'date-fns'
import { Inbox, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { resolveMediaUrl } from '@/utils/media-url'
import { openLanSendDialog } from '@/components/lan/lan-transfer-host'
import { useLanOnline } from '@/hooks/use-lan-online'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { useImInbox } from '@/hooks/use-im-inbox'
import { useImExternalFileDrop } from '@/hooks/use-im-external-file-drop'
import { useImStore } from '@/store/im'
import { useImSessionStore } from '@/store/im-session'
import type { ImInboxItem } from '@/types/im'
import {
  dropFilesToInboxItem,
  dropImMessageToInboxItem,
  dropMemosToInboxItem,
  dropWorkspaceFilesToInboxItem,
  selectInboxConversation,
} from './im-conversation-actions'
import { useAvatarDragDetach } from '@/hooks/use-avatar-drag-detach'
import { getAvatarColorPair, getDisplayInitials } from './im-avatar-style'
import { ImPresenceDot } from './im-presence-dot'
import { displayConversationTitle, formatInboxLastContent, imDateLocale, imQuoteSnippet } from './im-utils'

function conversationInitial(item: ImInboxItem) {
  return getDisplayInitials(displayConversationTitle(item))
}

function conversationAvatar(item: ImInboxItem) {
  return item.convType === 'group' ? item.groupAvatar : item.peerAvatar
}

function conversationColorSeed(item: ImInboxItem) {
  return item.peerUserId || item.groupId || displayConversationTitle(item)
}

function itemKey(item: ImInboxItem) {
  return item.conversationId || `${item.convType}:${item.peerUserId || item.groupId}`
}

function ConversationListRow({
  item,
  active,
  lanOnline,
}: {
  item: ImInboxItem
  active: boolean
  lanOnline: boolean
}) {
  const { t } = useTranslation('messages')
  const sessionLast = useImSessionStore(
    (state) =>
      (item.conversationId ? state.sessions[item.conversationId]?.messages.at(-1) : undefined) ??
      null
  )
  const title = displayConversationTitle(item)
  const preview = (() => {
    if (
      sessionLast &&
      (!item.lastTime || String(sessionLast.createdAt) >= String(item.lastTime))
    ) {
      return (
        formatInboxLastContent(
          imQuoteSnippet(sessionLast, {
            recalled: t('room.quoteRecalled'),
            image: t('room.quoteImage'),
            file: t('room.quoteFile'),
          })
        ) || t('inbox.noPreview')
      )
    }
    return formatInboxLastContent(item.lastContent) || t('inbox.noPreview')
  })()
  const colors = getAvatarColorPair(conversationColorSeed(item))
  const avatarUrl = conversationAvatar(item)
  const onFiles = useCallback(
    (files: File[]) => {
      void dropFilesToInboxItem(item, files).then((conversationId) => {
        if (!conversationId) toast.error(t('room.openFailed'))
      })
    },
    [item, t]
  )
  const onWorkspaceFiles = useCallback(
    (files: Parameters<typeof dropWorkspaceFilesToInboxItem>[1]) => {
      void dropWorkspaceFilesToInboxItem(item, files).then((conversationId) => {
        if (!conversationId) toast.error(t('room.openFailed'))
      })
    },
    [item, t]
  )
  const onMemos = useCallback(
    (memos: Parameters<typeof dropMemosToInboxItem>[1]) => {
      void dropMemosToInboxItem(item, memos)
        .then((conversationId) => {
          if (!conversationId) toast.error(t('room.openFailed'))
        })
        .catch(() => toast.error(t('room.memoSendFailed')))
    },
    [item, t]
  )
  const { onPointerDown, dragging, ghostNode } = useAvatarDragDetach({
    item,
    title,
    colors,
    avatar: avatarUrl,
    initials: conversationInitial(item),
  })
  const { isOver, dropProps } = useImExternalFileDrop({
    targetId: `im-inbox:${item.id}`,
    onFiles,
    onWorkspaceFiles,
    onMemos,
    onImMessage: (drag) => {
      void dropImMessageToInboxItem(item, drag)
        .then((conversationId) => {
          if (!conversationId) toast.error(t('room.sendFailed'))
        })
        .catch(() => toast.error(t('room.sendFailed')))
    },
    onSkippedFolders: (names) => {
      for (const name of names) {
        toast.error(t('room.folderNotSupported', { name }))
      }
    },
  })

  const row = (
    <li>
      {ghostNode}
      <button
        type='button'
        className={cn('im-conv__row', dragging && 'opacity-40', isOver ? 'is-drop' : active && 'is-active')}
        onPointerDown={onPointerDown}
        onClick={() => void selectInboxConversation(item)}
        {...dropProps}
      >
        {item.convType === 'single' ? (
          <ImPresenceDot online={lanOnline}>
            <span
              className='im-conv__avatar'
              style={{ backgroundColor: colors.background, color: colors.color }}
            >
              {avatarUrl ? (
                <img
                  src={resolveMediaUrl(avatarUrl)}
                  alt={title ?? ''}
                  className='size-full rounded-[13px] object-cover'
                />
              ) : (
                conversationInitial(item)
              )}
            </span>
          </ImPresenceDot>
        ) : (
          <span
            className='im-conv__avatar'
            style={{ backgroundColor: colors.background, color: colors.color }}
          >
            {avatarUrl ? (
              <img
                src={resolveMediaUrl(avatarUrl)}
                alt={title ?? ''}
                className='size-full rounded-[13px] object-cover'
              />
            ) : (
              conversationInitial(item)
            )}
          </span>
        )}
        <div className='min-w-0 flex-1'>
          <div className='flex items-baseline justify-between gap-2'>
            <span className='im-conv__name truncate'>{title}</span>
            {item.lastTime && (
              <span className='im-conv__time'>
                {formatDistanceToNow(new Date(item.lastTime), {
                  addSuffix: false,
                  locale: imDateLocale(),
                })}
              </span>
            )}
          </div>
          <div className='mt-0.5 flex items-center justify-between gap-2'>
            <p className={cn('im-conv__last min-w-0 flex-1 truncate', isOver ? 'is-drop' : item.unreadCount > 0 && 'is-unread')}>
              {isOver
                ? t('room.dropToConversation', { name: title })
                : preview}
            </p>
            {item.unreadCount > 0 && (
              <span className={cn('im-conv__badge', item.muted && 'is-muted')}>
                {item.unreadCount > 99 ? '99+' : item.unreadCount}
              </span>
            )}
          </div>
        </div>
      </button>
    </li>
  )

  if (!lanOnline || item.convType !== 'single' || !item.peerUserId) {
    return row
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
      <ContextMenuContent className='w-40'>
        <ContextMenuItem onSelect={() => openLanSendDialog(item.peerUserId!, title)}>
          {t('lan.menu')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

export function ImConversationList() {
  const { t } = useTranslation('messages')
  const conversationId = useImStore((state) => state.conversationId)
  const listWidth = useImStore((state) => state.popupListWidth)
  const { items, loading } = useImInbox()
  const [keyword, setKeyword] = useState('')
  const lanOnline = useLanOnline(
    items.filter((item) => item.convType === 'single' && item.peerUserId).map((item) => item.peerUserId!)
  )

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => displayConversationTitle(item).toLowerCase().includes(q))
  }, [items, keyword])

  return (
    <div
      className='im-conv'
      style={{ width: listWidth }}
    >
      <div className='im-conv__head'>
        <div className='im-conv__search'>
          <Search aria-hidden='true' strokeWidth={1.9} />
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={t('inbox.searchPlaceholder')}
            className='im-conv__input'
          />
        </div>
      </div>

      <ScrollArea className='min-h-0 flex-1'>
        {loading ? (
          <p className='p-4 text-center text-[12.5px] text-muted-foreground'>{t('loading')}</p>
        ) : filtered.length === 0 ? (
          <div className='im-conv__empty'>
            <span className='im-chat__emptyglyph' aria-hidden='true'>
              <Inbox className='size-5' strokeWidth={1.6} />
            </span>
            <p className='text-[12.5px] leading-relaxed text-text-muted'>{t('inbox.empty')}</p>
          </div>
        ) : (
          <ul className='im-conv__list'>
            {filtered.map((item) => (
              <ConversationListRow
                key={itemKey(item)}
                item={item}
                active={item.conversationId === conversationId}
                lanOnline={Boolean(item.peerUserId && lanOnline[item.peerUserId])}
              />
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  )
}
