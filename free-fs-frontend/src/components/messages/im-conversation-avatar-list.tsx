/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { resolveMediaUrl } from '@/utils/media-url'
import { useAvatarDragDetach } from '@/hooks/use-avatar-drag-detach'
import { useImExternalFileDrop } from '@/hooks/use-im-external-file-drop'
import { useImStore } from '@/store/im'
import type { ImInboxItem } from '@/types/im'
import { getAvatarColorPair, getDisplayInitials } from './im-avatar-style'
import {
  dropFilesToInboxItem,
  dropImMessageToInboxItem,
  dropMemosToInboxItem,
  dropWorkspaceFilesToInboxItem,
  selectInboxConversation,
} from './im-conversation-actions'
import { displayConversationTitle } from './im-utils'
import { ImPresenceDot } from './im-presence-dot'
import { ImUnreadBadge } from './im-unread-badge'
import { useLanOnline } from '@/hooks/use-lan-online'

type ImConversationAvatarListProps = {
  items: ImInboxItem[]
  variant: 'sidebar' | 'popup'
  className?: string
}

function itemKey(item: ImInboxItem) {
  return item.conversationId || `${item.convType}:${item.peerUserId || item.groupId}`
}

function conversationAvatar(item: ImInboxItem) {
  return item.convType === 'group' ? item.groupAvatar : item.peerAvatar
}

function conversationColorSeed(item: ImInboxItem) {
  return item.peerUserId || item.groupId || displayConversationTitle(item)
}

type SidebarAvatarButtonProps = {
  item: ImInboxItem
  active: boolean
  unread: number
  muted?: boolean
  title: string
  avatar?: string | null
  colors: { color: string; background: string }
  online?: boolean
}

function SidebarAvatarButton({
  item,
  active,
  unread,
  muted,
  title,
  avatar,
  colors,
  online,
}: SidebarAvatarButtonProps) {
  const { t } = useTranslation('messages')
  const { onPointerDown, dragging, ghostNode } = useAvatarDragDetach({
    item,
    title,
    colors,
    avatar,
    initials: getDisplayInitials(title),
    enabled: true,
  })
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
  const { isOver, dropProps } = useImExternalFileDrop({
    targetId: `im-avatar:${item.id}`,
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

  return (
    <>
      <button
        type='button'
        title={isOver ? t('room.dropToConversation', { name: title }) : title}
        className={cn(
          'relative outline-none rounded-[10px] transition-transform duration-150 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring/50',
          dragging && 'opacity-40',
          isOver && 'ring-2 ring-primary/70'
        )}
        onPointerDown={onPointerDown}
        {...dropProps}
      >
        {item.convType === 'single' ? (
          <ImPresenceDot online={Boolean(online)}>
            <Avatar
              className={cn(
                'size-9 rounded-[10px]',
                active && 'ring-2 ring-primary/70 ring-offset-1 ring-offset-sidebar'
              )}
            >
              {avatar ? (
                <AvatarImage src={resolveMediaUrl(avatar)} alt={title} className='rounded-[10px]' />
              ) : null}
              <AvatarFallback
                className='rounded-[10px] text-xs font-semibold'
                style={{ backgroundColor: colors.background, color: colors.color }}
              >
                {getDisplayInitials(title)}
              </AvatarFallback>
            </Avatar>
          </ImPresenceDot>
        ) : (
          <Avatar
            className={cn(
              'size-9 rounded-[10px]',
              active && 'ring-2 ring-primary/70 ring-offset-1 ring-offset-sidebar'
            )}
          >
            {avatar ? (
              <AvatarImage src={resolveMediaUrl(avatar)} alt={title} className='rounded-[10px]' />
            ) : null}
            <AvatarFallback
              className='rounded-[10px] text-xs font-semibold'
              style={{ backgroundColor: colors.background, color: colors.color }}
            >
              {getDisplayInitials(title)}
            </AvatarFallback>
          </Avatar>
        )}
        <ImUnreadBadge count={unread} muted={muted} />
      </button>
      {ghostNode}
    </>
  )
}

export function ImConversationAvatarList({ items, variant, className }: ImConversationAvatarListProps) {
  const panel = useImStore((state) => state.panel)
  const conversationId = useImStore((state) => state.conversationId)
  const isSidebar = variant === 'sidebar'
  const lanOnline = useLanOnline(
    items.filter((item) => item.convType === 'single' && item.peerUserId).map((item) => item.peerUserId!)
  )

  return (
    <ScrollArea
      className={cn(
        'min-h-0 flex-1',
        isSidebar && 'bg-transparent',
        className
      )}
    >
      <div
        className={cn(
          'flex flex-col items-center',
          isSidebar ? 'gap-1.5 px-1 py-2' : 'gap-1.5 px-1.5 py-2'
        )}
      >
        {items.map((item) => {
          const active = panel === 'chats' && item.conversationId === conversationId
          const unread = item.unreadCount
          const title = displayConversationTitle(item)
          const avatar = conversationAvatar(item)
          const colors = getAvatarColorPair(conversationColorSeed(item))

          if (isSidebar) {
            return (
              <SidebarAvatarButton
                key={itemKey(item)}
                item={item}
                active={active}
                unread={unread}
                muted={item.muted}
                title={title}
                avatar={avatar}
                colors={colors}
                online={Boolean(item.peerUserId && lanOnline[item.peerUserId])}
              />
            )
          }

          return (
            <PopupAvatarButton
              key={itemKey(item)}
              item={item}
              active={active}
              unread={unread}
              muted={item.muted}
              title={title}
              avatar={avatar}
              online={Boolean(item.peerUserId && lanOnline[item.peerUserId])}
            />
          )
        })}
      </div>
    </ScrollArea>
  )
}

function PopupAvatarButton({
  item,
  active,
  unread,
  muted,
  title,
  avatar,
  online,
}: {
  item: ImInboxItem
  active: boolean
  unread: number
  muted?: boolean
  title: string
  avatar?: string | null
  online?: boolean
}) {
  const { t } = useTranslation('messages')
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
  const { isOver, dropProps } = useImExternalFileDrop({
    targetId: `im-avatar:${item.id}`,
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

  return (
    <button
      type='button'
      title={isOver ? t('room.dropToConversation', { name: title }) : title}
      className={cn(
        'relative outline-none rounded-full transition-transform duration-150 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring/50',
        isOver && 'ring-2 ring-primary'
      )}
      onClick={() => void selectInboxConversation(item)}
      {...dropProps}
    >
      {item.convType === 'single' ? (
        <ImPresenceDot online={Boolean(online)}>
          <Avatar
            className={cn(
              'size-10',
              active && 'ring-2 ring-primary ring-offset-1 ring-offset-background'
            )}
          >
            {avatar ? <AvatarImage src={resolveMediaUrl(avatar)} alt={title} /> : null}
            <AvatarFallback className='rounded-[10px] bg-accent-soft text-xs font-semibold text-primary'>
              {getDisplayInitials(title)}
            </AvatarFallback>
          </Avatar>
        </ImPresenceDot>
      ) : (
        <Avatar
          className={cn(
            'size-10',
            active && 'ring-2 ring-primary ring-offset-1 ring-offset-background'
          )}
        >
          {avatar ? <AvatarImage src={resolveMediaUrl(avatar)} alt={title} /> : null}
          <AvatarFallback className='rounded-[10px] bg-accent-soft text-xs font-semibold text-primary'>
            {getDisplayInitials(title)}
          </AvatarFallback>
        </Avatar>
      )}
      <ImUnreadBadge count={unread} muted={muted} />
    </button>
  )
}
