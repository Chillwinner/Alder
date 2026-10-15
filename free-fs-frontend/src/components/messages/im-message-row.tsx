/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { FileIcon } from '@/components/file-icon'
import { isShareFileAvailable } from '@/api/share'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger, ContextMenuGroup } from '@/components/ui/context-menu'
import { cn } from '@/lib/utils'
import {
  downloadImMedia,
  formatImFileName,
  formatImMediaSize,
  isImWorkspaceShare,
  openImMediaPreview,
  parseImMessageMedia,
  resolveImMediaIconType,
  IM_MSG_ENCRYPTED,
  IM_MSG_FILE,
  IM_MSG_IMAGE,
  type ImMessageMediaContent,
} from '@/utils/im-message-content'
import { useImMessagePlaintext } from '@/hooks/use-im-message-plaintext'
import { resolveMediaUrl } from '@/utils/media-url'
import type { ImInboxItem, ImMessage } from '@/types/im'
import { getAvatarColorPair, getDisplayInitials } from './im-avatar-style'
import { setImMessageDragData } from './im-drop-files'
import {
  canRecallImMessage,
  formatMessageTime,
  imQuotedSnippet,
  isImRecalled,
} from './im-utils'
import { beginDrag, endDrag } from '@/lib/drag-layer'

type ImMessageRowProps = {
  message: ImMessage
  mine: boolean
  isGroup: boolean
  isSingle: boolean
  peerLastReadMessageId: number
  selfName: string
  selfAvatar?: string | null
  meta: ImInboxItem | null
  showAvatar?: boolean
  showTime?: boolean
  grouped?: boolean
  onQuote?: (message: ImMessage) => void
  onRecall?: (message: ImMessage) => void
  onDelete?: (message: ImMessage) => void
}

function senderName(message: ImMessage) {
  return message.senderNickname || message.senderUsername || message.senderId
}

function MessageAvatar({
  name,
  avatar,
  colorSeed,
}: {
  name: string
  avatar?: string | null
  colorSeed: string
}) {
  const colors = getAvatarColorPair(colorSeed)
  return (
    <Avatar className='im-msg-avatar'>
      {avatar ? (
        <AvatarImage src={resolveMediaUrl(avatar)} alt={name} className='im-msg-avatar__img' />
      ) : null}
      <AvatarFallback
        className='im-msg-avatar__img text-[11px] font-semibold'
        style={{ backgroundColor: colors.background, color: colors.color }}
      >
        {getDisplayInitials(name)}
      </AvatarFallback>
    </Avatar>
  )
}

function MediaDownloadButton({ media }: { media: ImMessageMediaContent }) {
  const { t } = useTranslation('messages')
  return (
    <button
      type='button'
      aria-label={t('room.download')}
      className='im-download'
      onClick={(event) => {
        event.stopPropagation()
        void downloadImMedia(media).catch(() => toast.error(t('room.downloadFailed')))
      }}
    >
      <Download className='size-[15px]' strokeWidth={1.8} />
    </button>
  )
}

function MessageBubbleContent({
  message,
  media,
  msgType,
  fileUnavailable,
  encryptedPlaintext,
  decryptFailed,
}: {
  message: ImMessage
  media: ImMessageMediaContent | null
  msgType: string
  fileUnavailable?: boolean
  encryptedPlaintext?: string | null
  decryptFailed?: boolean
}) {
  const { t } = useTranslation('messages')

  if (msgType === IM_MSG_ENCRYPTED) {
    if (decryptFailed || encryptedPlaintext == null) {
      return (
        <span
          className='block min-h-[2.5rem] min-w-[6rem] rounded-[13px] bg-surface-3 px-3 py-2 text-xs text-text-muted'
          title={t('crypto.decryptFailed')}
        />
      )
    }
    return <span className='whitespace-pre-wrap break-words'>{encryptedPlaintext}</span>
  }

  const shareHint = isImWorkspaceShare(media) ? (
    <span className='im-file__hint'>
      {fileUnavailable ? t('room.fileUnavailable') : t('room.sharedFromWorkspace')}
    </span>
  ) : null

  if (msgType === IM_MSG_IMAGE && media) {
    if (fileUnavailable) {
      return (
        <div data-tilt='' className='im-file w-[220px] max-w-full px-1 py-1'>
          <span className='im-file__icon'>
            <FileIcon type='invalid' size={20} />
          </span>
          <span className='min-w-0 flex-1'>
            <span className='im-file__name' title={media.name}>
              {formatImFileName(media.name)}
            </span>
            {shareHint}
          </span>
        </div>
      )
    }
    const src = resolveMediaUrl(media.url)
    return (
      <div className='min-w-0'>
        <button
          type='button'
          className='block overflow-hidden rounded-[15px] text-left transition-opacity duration-150 hover:opacity-90'
          onClick={() => openImMediaPreview(media)}
        >
          <img
            src={src}
            alt={media.name}
            className='max-h-52 w-auto max-w-full object-cover'
            loading='lazy'
          />
        </button>
        {shareHint ? <span className='mt-1.5 block px-1'>{shareHint}</span> : null}
      </div>
    )
  }

  if (msgType === IM_MSG_FILE && media) {
    return (
      <button
        type='button'
        className='im-file transition-opacity duration-150 hover:opacity-80'
        onClick={() => {
          if (fileUnavailable) return
          openImMediaPreview(media)
        }}
      >
        <span className='im-file__icon'>
          <FileIcon type={fileUnavailable ? 'invalid' : resolveImMediaIconType(media)} size={20} />
        </span>
        <span className='min-w-0 flex-1'>
          <span className='im-file__name' title={media.name}>
            {formatImFileName(media.name)}
          </span>
          {fileUnavailable ? null : (
            <span className='im-file__meta'>{formatImMediaSize(media, t('room.file'))}</span>
          )}
          {shareHint}
        </span>
      </button>
    )
  }

  if ((msgType === IM_MSG_IMAGE || msgType === IM_MSG_FILE) && !media) {
    return (
      <span className='text-sm'>
        {msgType === IM_MSG_IMAGE ? t('room.imageBroken') : t('room.fileBroken')}
      </span>
    )
  }

  return <span className='whitespace-pre-wrap break-words'>{message.content}</span>
}

function messageBubbleClass(mine: boolean, msgType: string) {
  const side = mine ? 'im-bubble--me' : 'im-bubble--them'
  if (msgType === IM_MSG_IMAGE) return `im-bubble im-bubble--image ${side}`
  if (msgType === IM_MSG_FILE) return `im-bubble im-bubble--file ${side}`
  return `im-bubble ${side}`
}

export function ImMessageRow({
  message,
  mine,
  isGroup,
  isSingle,
  peerLastReadMessageId,
  selfName,
  selfAvatar,
  meta,
  showAvatar = true,
  showTime = true,
  grouped = false,
  onQuote,
  onRecall,
  onDelete,
}: ImMessageRowProps) {
  const { t } = useTranslation('messages')
  const recalled = isImRecalled(message)
  const quoteLabels = {
    recalled: t('room.quoteRecalled'),
    image: t('room.quoteImage'),
    file: t('room.quoteFile'),
  }
  const quotedText = imQuotedSnippet(message, quoteLabels)
  /* 这条消息气泡是否正被拖往工作空间/备忘录 —— 驱动 .drag-source-active */
  const [bubbleDragging, setBubbleDragging] = useState(false)
  const name = mine ? selfName : senderName(message)
  const avatar = mine
    ? selfAvatar
    : isGroup
      ? message.senderAvatar
      : meta?.peerAvatar
  const colorSeed = mine ? selfName : message.senderId
  const timeLabel = formatMessageTime(message.createdAt)
  const read = isSingle && mine && message.id <= peerLastReadMessageId
  const { msgType, plaintext: encryptedPlaintext, failed: decryptFailed } =
    useImMessagePlaintext(message, meta)
  const media =
    msgType === IM_MSG_ENCRYPTED ? null : parseImMessageMedia(message.content)
  const availability = useQuery({
    queryKey: ['share-file-available', media?.shareId, media?.fileId],
    enabled: Boolean(media?.shareId && media?.fileId),
    queryFn: () => isShareFileAvailable(media!.shareId!, media!.fileId!),
    staleTime: 30_000,
    retry: false,
  })
  const fileUnavailable = availability.data === false
  const showDownload = Boolean(
    !recalled && !fileUnavailable && media && (msgType === IM_MSG_IMAGE || msgType === IM_MSG_FILE)
  )
  const downloadBtn = media ? <MediaDownloadButton media={media} /> : null
  const canRecall = canRecallImMessage(message, mine)
  const recalledLabel = mine
    ? t('room.recalledSelf')
    : isGroup
      ? t('room.recalledNamed', { name: senderName(message) })
      : t('room.recalledPeer')

  const canDragToWorkspace = Boolean(
    !recalled && !fileUnavailable && media && (msgType === IM_MSG_IMAGE || msgType === IM_MSG_FILE)
  )
  const bubble = (
    <div
      data-tilt=''
      draggable={canDragToWorkspace}
      onDragStart={(event) => {
        if (!canDragToWorkspace) return
        event.stopPropagation()
        setImMessageDragData(event.dataTransfer, {
          conversationId: message.conversationId,
          messageId: message.id,
        })
        beginDrag(event, 'message')
        setBubbleDragging(true)
      }}
      onDragEnd={() => {
        setBubbleDragging(false)
        endDrag()
      }}
      className={cn(
        messageBubbleClass(mine, msgType),
        msgType !== IM_MSG_FILE && 'min-w-0 max-w-full',
        /*
          拖拽源反馈：与备忘录卡片/文件卡片共用同一套 .drag-source-active
          （变暗 + 缩小 + 倾斜，见 styles/drag-layer.css），
          让"从这里拿起来"的手感在三个面板里完全一致。
        */
        bubbleDragging && 'drag-source-active'
      )}
    >
      {quotedText ? (
        <div className='im-quote max-w-full'>
          <span className='font-medium'>{message.quoteSenderName || t('room.quote')}</span>
          <span className='mx-1 opacity-50'>:</span>
          <span>{quotedText}</span>
        </div>
      ) : null}
      <MessageBubbleContent
        message={message}
        media={media}
        msgType={msgType}
        fileUnavailable={fileUnavailable}
        encryptedPlaintext={encryptedPlaintext}
        decryptFailed={decryptFailed}
      />
    </div>
  )

  const menu = (
    <ContextMenuContent className='w-28'>
<ContextMenuGroup>
      {!recalled ? (
        <ContextMenuItem onSelect={() => onQuote?.(message)}>{t('room.quote')}</ContextMenuItem>
      ) : null}
      {canRecall ? (
        <ContextMenuItem onSelect={() => onRecall?.(message)}>{t('room.recall')}</ContextMenuItem>
      ) : null}
      <ContextMenuItem onSelect={() => onDelete?.(message)}>{t('room.delete')}</ContextMenuItem>
    </ContextMenuGroup>
</ContextMenuContent>
  )

  const wrappedBubble = recalled ? null : (
    <ContextMenu>
      <ContextMenuTrigger asChild>{bubble}</ContextMenuTrigger>
      {menu}
    </ContextMenu>
  )

  const recalledLine = (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <p className='im-recalled'>
          {recalledLabel}
        </p>
      </ContextMenuTrigger>
      {menu}
    </ContextMenu>
  )

  return (
    <div
      className={cn(
        'im-msg-row w-full',
        mine ? 'im-msg-row--me' : 'im-msg-row--them',
        grouped ? 'pt-1.5' : 'pt-3.5'
      )}
    >
      {recalled ? (
        recalledLine
      ) : mine ? (
        <div className='grid w-full min-w-0 grid-cols-[minmax(0,1fr)_1.875rem] items-start gap-1.5'>
          <div className='flex min-w-0 flex-col items-end gap-1'>
            <div className='flex min-w-0 items-end justify-end gap-1.5'>
              {isSingle && (
                <span
                  className={cn(
                    'im-msg-read',
                    read ? 'text-text-muted' : 'text-text-secondary'
                  )}
                >
                  {read ? t('room.read') : t('room.unread')}
                </span>
              )}
              {showDownload && downloadBtn}
              {wrappedBubble}
            </div>
            {showTime ? (
              <time dateTime={message.createdAt} className='im-msg-time pr-0.5'>
                {timeLabel}
              </time>
            ) : null}
          </div>
          {showAvatar ? (
            <MessageAvatar name={selfName} avatar={selfAvatar} colorSeed={colorSeed} />
          ) : (
            <span className='im-msg-avatar-gap' />
          )}
        </div>
      ) : (
        <div className='grid w-full min-w-0 grid-cols-[1.875rem_minmax(0,1fr)] items-start gap-1.5'>
          {showAvatar ? (
            <MessageAvatar name={name} avatar={avatar} colorSeed={colorSeed} />
          ) : (
            <span className='im-msg-avatar-gap' />
          )}
          <div className='flex min-w-0 flex-col items-start gap-1 overflow-hidden'>
            {isGroup && showTime && (
              <span className='pl-1 text-[11px] leading-none text-text-muted'>
                {senderName(message)}
              </span>
            )}
            <div className='flex min-w-0 items-end gap-1.5 overflow-hidden'>
              {wrappedBubble}
              {showDownload && downloadBtn}
            </div>
            {showTime ? (
              <time dateTime={message.createdAt} className='im-msg-time pl-0.5'>
                {timeLabel}
              </time>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
