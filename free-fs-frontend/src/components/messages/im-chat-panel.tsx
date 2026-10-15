/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type UIEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { Image, MessageCircle, PanelRightClose, Paperclip, PictureInPicture2, Send, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  shareImWorkspaceFile,
  fetchImHistory,
  fetchImInbox,
  hideImMessage,
  markImRead,
  recallImMessage,
  sendImMessage,
  uploadImMessageMedia,
} from '@/api/im'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { translateServerText } from '@/i18n'
import { useImStore } from '@/store/im'
import { useImSessionStore } from '@/store/im-session'
import type { ImInboxItem, ImMessage, ImPush } from '@/types/im'
import { notifyImPush, notifyInboxPreview, notifyInboxRead, notifyInboxRefresh } from './im-events'
import { ImEmojiPicker } from './im-emoji-picker'
import { ImMessageRow } from './im-message-row'
import {
  ImPendingUploadRow,
  isImUploadAbortError,
  type ImPendingUpload,
} from './im-pending-upload-row'
import { forwardImMessageToConversation } from './im-conversation-actions'
import {
  attachQuoteSnapshot,
  displayConversationTitle,
  formatImDaySeparator,
  formatMessageTime,
  imDayKey,
  imQuoteSnippet,
  isImRecalled,
} from './im-utils'
import {
  buildImMediaMessageContent,
  IM_MSG_FILE,
  IM_MSG_IMAGE,
} from '@/utils/im-message-content'
import { imMsgTypeForFile, type WorkspaceFileDragItem } from '@/components/messages/im-drop-files'
import { packageMemoExport } from '@/lib/memo-markdown'
import type { WorkspaceMemo } from '@/types/workspace-board'
import { useImExternalFileDrop } from '@/hooks/use-im-external-file-drop'
import { DropOverlay } from '@/components/drop-overlay'
import { resolveMediaUrl } from '@/utils/media-url'
import { useLanOnline } from '@/hooks/use-lan-online'
import { getAvatarColorPair, getDisplayInitials } from './im-avatar-style'
import { ImPresenceDot } from './im-presence-dot'
import { ImFriendProfileDialog } from './im-friend-profile-dialog'

async function markConversationRead(conversationId: string, lastId: number) {
  const result = await markImRead(conversationId, lastId)
  useImStore.getState().setUnreadTotal(result.total)
  notifyInboxRead(conversationId)
  notifyInboxRefresh()
}

const MESSAGE_MAX_LENGTH = 256
const HISTORY_PAGE = 50

function appendEmoji(draft: string, emoji: string) {
  const next = draft + emoji
  return next.length > MESSAGE_MAX_LENGTH ? next.slice(0, MESSAGE_MAX_LENGTH) : next
}

function shouldSendOnEnter(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey) return false
  if (event.nativeEvent.isComposing || event.isComposing) return false
  // IME 组合输入中（部分浏览器 keyCode 为 229）
  if (event.keyCode === 229) return false
  return true
}

type ImChatPanelProps = {
  variant?: 'sidebar' | 'popup' | 'detached'
  conversationId?: string
  active?: boolean
}

export function ImChatPanel({
  variant = 'sidebar',
  conversationId: conversationIdProp,
  active,
}: ImChatPanelProps) {
  const { t } = useTranslation('messages')
  const { user } = useAuth()
  const storeConversationId = useImStore((state) => state.conversationId)
  const dialogOpen = useImStore((state) => state.dialogOpen)
  const closeDialog = useImStore((state) => state.closeDialog)
  const selectConversation = useImStore((state) => state.selectConversation)
  const detachToPopup = useImStore((state) => state.detachToPopup)
  const applyPeerRead = useImStore((state) => state.applyPeerRead)
  const conversationId = conversationIdProp ?? storeConversationId
  const isActive = active ?? dialogOpen
  const peerLastReadMessageId = useImStore((state) =>
    conversationId ? (state.peerReadCursor[conversationId] ?? 0) : 0
  )

  const session = useImSessionStore((state) =>
    conversationId ? state.sessions[conversationId] : undefined
  )
  const messages = session?.messages ?? []
  const pendingUploads = session?.pendingUploads ?? []
  const quoting = session?.quoting ?? null
  const hasMoreOlder = session?.hasMoreOlder ?? false
  const initialized = session?.initialized ?? false

  const [meta, setMeta] = useState<ImInboxItem | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [sending, setSending] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const loadingOlderRef = useRef(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selfName = user?.nickname || user?.username || '?'
  const isGroup = meta?.convType === 'group'
  const isSingle = meta?.convType === 'single'
  const peerOnline = useLanOnline(isSingle && meta?.peerUserId ? [meta.peerUserId] : [])

  const scrollToBottom = useCallback((_behavior: ScrollBehavior = 'auto') => {
    const jump = () => {
      const viewport = rootRef.current?.querySelector<HTMLElement>(
        '[data-slot="scroll-area-viewport"]'
      )
      if (!viewport) return
      viewport.scrollTop = viewport.scrollHeight
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(jump)
      window.setTimeout(jump, 80)
    })
  }, [])

  const pushInboxPreview = useCallback(
    (message: ImMessage, targetId = conversationId) => {
      if (!targetId) return
      notifyInboxPreview({
        conversationId: targetId,
        lastContent: imQuoteSnippet(message, {
          recalled: t('room.quoteRecalled'),
          image: t('room.quoteImage'),
          file: t('room.quoteFile'),
        }),
        lastTime: message.createdAt,
      })
    },
    [conversationId, t]
  )

  const loadMeta = useCallback(async () => {
    if (!conversationId) {
      setMeta(null)
      return
    }
    const inbox = await fetchImInbox()
    setMeta(inbox.find((item) => item.conversationId === conversationId) ?? null)
  }, [conversationId])

  const loadHistory = useCallback(async (options?: { silent?: boolean; older?: boolean }) => {
    if (!conversationId) return
    const store = useImSessionStore.getState()
    const current = store.session(conversationId)
    const silent = options?.silent ?? false

    if (options?.older) {
      const oldest = current.messages[0]
      if (!oldest || !current.hasMoreOlder || loadingOlderRef.current) return
      loadingOlderRef.current = true
      setLoadingOlder(true)
      const viewport = rootRef.current?.querySelector<HTMLElement>(
        '[data-slot="scroll-area-viewport"]'
      )
      const previousHeight = viewport?.scrollHeight ?? 0
      try {
        const result = await fetchImHistory(conversationId, {
          beforeId: oldest.id,
          limit: HISTORY_PAGE,
        })
        store.prependOlder(conversationId, result.messages, HISTORY_PAGE)
        requestAnimationFrame(() => {
          if (!viewport) return
          viewport.scrollTop += viewport.scrollHeight - previousHeight
        })
      } finally {
        loadingOlderRef.current = false
        setLoadingOlder(false)
      }
      return
    }

    if (!silent) setLoading(true)
    try {
      const latest = await fetchImHistory(conversationId, { afterId: 0, limit: HISTORY_PAGE })
      if (latest.peerLastReadMessageId != null) {
        applyPeerRead(conversationId, latest.peerLastReadMessageId)
      }
      store.upsertMessages(conversationId, latest.messages)
      if (!current.initialized) {
        store.markInitialized(conversationId, latest.messages.length >= HISTORY_PAGE)
      }
      const newest = store.session(conversationId).messages.at(-1)
      if (newest && silent) {
        const newer = await fetchImHistory(conversationId, {
          afterId: newest.id,
          limit: HISTORY_PAGE,
        })
        if (newer.messages.length > 0) {
          store.upsertMessages(conversationId, newer.messages)
        }
      }
      const last = store.session(conversationId).messages.at(-1)
      if (last) {
        await markConversationRead(conversationId, last.id)
      } else {
        const inbox = await fetchImInbox()
        const item = inbox.find((entry) => entry.conversationId === conversationId)
        if (item?.unreadCount && item.unreadCount > 0 && item.lastMessageId) {
          await markConversationRead(conversationId, item.lastMessageId)
        }
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [applyPeerRead, conversationId])

  useEffect(() => {
    setDraft('')
    if (!conversationId) return
    const already = useImSessionStore.getState().session(conversationId).initialized
    void loadMeta()
    if (already) {
      void loadHistory({ silent: true }).then(() => scrollToBottom('auto'))
      return
    }
    void loadHistory().then(() => scrollToBottom('auto'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  useEffect(() => {
    if (!isActive || !conversationId) return
    void loadHistory({ silent: true }).then(() => scrollToBottom('auto'))
    void loadMeta()
  }, [conversationId, isActive, loadHistory, loadMeta, scrollToBottom])

  const lastMessageId = messages.at(-1)?.id
  const pinBottomRef = useRef(true)
  useEffect(() => {
    pinBottomRef.current = true
  }, [conversationId, isActive, lastMessageId])

  useEffect(() => {
    if (!isActive || !conversationId) return
    const viewport = rootRef.current?.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    if (!viewport) return

    const stick = () => {
      if (!pinBottomRef.current) return
      viewport.scrollTop = viewport.scrollHeight
    }
    const onScroll = () => {
      pinBottomRef.current =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 96
    }

    stick()
    viewport.addEventListener('scroll', onScroll, { passive: true })
    const inner = viewport.firstElementChild
    const ro = inner ? new ResizeObserver(stick) : null
    if (inner && ro) ro.observe(inner)
    const retry = window.setTimeout(stick, 120)
    return () => {
      viewport.removeEventListener('scroll', onScroll)
      ro?.disconnect()
      window.clearTimeout(retry)
    }
  }, [isActive, conversationId, lastMessageId])

  useEffect(() => {
    if (!conversationId) return undefined

    const onSync = () => {
      if (!isActive) return
      void loadHistory({ silent: true })
      void loadMeta()
    }

    const onPush = (event: Event) => {
      const push = (event as CustomEvent<ImPush>).detail
      if (push.conversationId !== conversationId) return

      if (push.type?.toUpperCase() === 'READ' && push.lastReadMessageId != null) {
        const lastId = Number(push.lastReadMessageId)
        if (Number.isFinite(lastId)) {
          applyPeerRead(conversationId, lastId)
        }
        return
      }

      const pushType = push.type?.toUpperCase()
      if (pushType !== 'MESSAGE' && pushType !== 'RECALL') return

      if (push.message) {
        useImSessionStore.getState().upsertMessages(conversationId, [push.message])
        if (isActive && pushType === 'MESSAGE') {
          void markConversationRead(conversationId, push.message.id)
        }
        if (pushType === 'RECALL') {
          const currentQuote = useImSessionStore.getState().session(conversationId).quoting
          if (currentQuote?.id === push.message.id) {
            useImSessionStore.getState().setQuoting(conversationId, null)
          }
        }
      } else {
        void loadHistory({ silent: true })
      }
      void loadMeta()
      if (push.message) {
        pushInboxPreview(push.message)
      }
      scrollToBottom('auto')
    }
    const onConnected = () => void loadHistory({ silent: true })
    window.addEventListener('im:sync', onSync)
    window.addEventListener('im:push', onPush)
    window.addEventListener('im:connected', onConnected)
    return () => {
      window.removeEventListener('im:sync', onSync)
      window.removeEventListener('im:push', onPush)
      window.removeEventListener('im:connected', onConnected)
    }
  }, [applyPeerRead, conversationId, isActive, loadHistory, loadMeta, pushInboxPreview, scrollToBottom])

  const handleSend = async () => {
    const content = draft.trim()
    if (!content || !conversationId || sending) return
    if (content.length > MESSAGE_MAX_LENGTH) {
      toast.error(t('room.tooLong'))
      return
    }
    setSending(true)
    try {
      const quoted = quoting && !isImRecalled(quoting) ? quoting : null
      const message = attachQuoteSnapshot(
        await sendImMessage({
          conversationId,
          clientMsgId: crypto.randomUUID(),
          content,
          quoteMessageId: quoted?.id,
        }),
        quoted
      )
      setDraft('')
      useImSessionStore.getState().setQuoting(conversationId, null)
      useImSessionStore.getState().upsertMessages(conversationId, [message])
      pushInboxPreview(message)
      await markConversationRead(conversationId, message.id)
      scrollToBottom('auto')
    } catch (cause) {
      toast.error(cause instanceof Error ? translateServerText(cause.message) : t('room.sendFailed'))
    } finally {
      setSending(false)
    }
  }

  const appendSentMessage = useCallback(
    async (message: ImMessage, targetId = conversationId) => {
      if (!targetId) return
      useImSessionStore.getState().upsertMessages(targetId, [message])
      pushInboxPreview(message, targetId)
      await markConversationRead(targetId, message.id)
      if (targetId === conversationId) scrollToBottom('auto')
    },
    [conversationId, pushInboxPreview, scrollToBottom]
  )

  const uploadAndSend = useCallback(async (
    file: File,
    msgType: typeof IM_MSG_IMAGE | typeof IM_MSG_FILE,
    targetId = conversationId,
    reuseId?: string
  ) => {
    if (!targetId) {
      toast.error(t('room.openFailed'))
      return
    }

    const pendingId = reuseId || crypto.randomUUID()
    const controller = new AbortController()
    const store = useImSessionStore.getState()
    const pending: ImPendingUpload = {
      id: pendingId,
      file,
      msgType,
      progress: 0,
      phase: 'uploading',
      abort: () => controller.abort(),
    }
    if (reuseId) {
      store.patchPending(targetId, pendingId, pending)
    } else {
      store.addPending(targetId, pending)
    }
    if (targetId === conversationId) scrollToBottom('auto')

    try {
      const media = await uploadImMessageMedia(targetId, file, {
        signal: controller.signal,
        onUploadProgress: (event) => {
          if (!event.total) return
          const progress = Math.min(99, Math.round((event.loaded / event.total) * 100))
          useImSessionStore.getState().patchPending(targetId, pendingId, { progress })
        },
      })
      store.patchPending(targetId, pendingId, { progress: 100, phase: 'sending' })
      const currentQuote = store.session(targetId).quoting
      const quoted = currentQuote && !isImRecalled(currentQuote) ? currentQuote : null
      const message = attachQuoteSnapshot(
        await sendImMessage({
          conversationId: targetId,
          clientMsgId: crypto.randomUUID(),
          msgType,
          content: buildImMediaMessageContent(media),
          quoteMessageId: quoted?.id,
        }),
        quoted
      )
      store.setQuoting(targetId, null)
      store.removePending(targetId, pendingId)
      await appendSentMessage(message, targetId)
    } catch (cause) {
      if (isImUploadAbortError(cause)) {
        useImSessionStore.getState().removePending(targetId, pendingId)
        return
      }
      const message =
        cause instanceof Error ? translateServerText(cause.message) : t('room.uploadFailed')
      useImSessionStore.getState().patchPending(targetId, pendingId, { phase: 'failed', error: message })
      toast.error(message)
    }
  }, [appendSentMessage, conversationId, t])

  const shareWorkspaceAndSend = useCallback(async (
    item: WorkspaceFileDragItem,
    targetId = conversationId,
    reuseId?: string
  ) => {
    if (!targetId) {
      toast.error(t('room.openFailed'))
      return
    }
    const pendingId = reuseId || crypto.randomUUID()
    const controller = new AbortController()
    const store = useImSessionStore.getState()
    const initialMsgType = item.isDir || !item.mime?.startsWith('image/') ? IM_MSG_FILE : IM_MSG_IMAGE
    const file = new File([], item.name, { type: item.mime || '' })
    const pending: ImPendingUpload = {
      id: pendingId,
      file,
      msgType: initialMsgType,
      progress: 0,
      phase: 'uploading',
      abort: () => controller.abort(),
      workspaceFileId: item.id,
      byteSize: item.size,
      isDir: item.isDir,
    }
    if (reuseId) {
      store.patchPending(targetId, pendingId, pending)
    } else {
      store.addPending(targetId, pending)
    }
    if (targetId === conversationId) scrollToBottom('auto')
    try {
      const media = await shareImWorkspaceFile(targetId, item.id, {
        signal: controller.signal,
      })
      const msgType = media.isDir || !media.mime?.startsWith('image/') ? IM_MSG_FILE : IM_MSG_IMAGE
      store.patchPending(targetId, pendingId, {
        progress: 100,
        phase: 'sending',
        msgType,
        byteSize: media.size,
        isDir: media.isDir,
      })
      const currentQuote = store.session(targetId).quoting
      const quoted = currentQuote && !isImRecalled(currentQuote) ? currentQuote : null
      const message = attachQuoteSnapshot(
        await sendImMessage({
          conversationId: targetId,
          clientMsgId: crypto.randomUUID(),
          msgType,
          content: buildImMediaMessageContent(media),
          quoteMessageId: quoted?.id,
        }),
        quoted
      )
      store.setQuoting(targetId, null)
      store.removePending(targetId, pendingId)
      await appendSentMessage(message, targetId)
    } catch (cause) {
      if (isImUploadAbortError(cause)) {
        useImSessionStore.getState().removePending(targetId, pendingId)
        return
      }
      const message =
        cause instanceof Error ? translateServerText(cause.message) : t('room.uploadFailed')
      useImSessionStore.getState().patchPending(targetId, pendingId, { phase: 'failed', error: message })
      toast.error(message)
    }
  }, [appendSentMessage, conversationId, t])

  const sendDroppedFiles = useCallback(
    (files: File[]) => {
      for (const file of files) {
        void uploadAndSend(file, imMsgTypeForFile(file))
      }
    },
    [uploadAndSend]
  )

  const sendDroppedWorkspaceFiles = useCallback(
    (files: WorkspaceFileDragItem[]) => {
      for (const file of files) {
        void shareWorkspaceAndSend(file)
      }
    },
    [shareWorkspaceAndSend]
  )

  const sendDroppedMemos = useCallback(
    async (memos: WorkspaceMemo[]) => {
      try {
        for (const memo of memos) {
          const pack = await packageMemoExport(memo, 'chat')
          void uploadAndSend(pack.file, imMsgTypeForFile(pack.file))
          for (const extra of pack.attachments) {
            void uploadAndSend(extra, imMsgTypeForFile(extra))
          }
        }
      } catch {
        toast.error(t('room.memoSendFailed'))
      }
    },
    [t, uploadAndSend]
  )

  const queuedDrop = useImStore((state) => state.queuedDrop)

  useEffect(() => {
    if (!conversationId || !queuedDrop) return
    if (queuedDrop.conversationId !== conversationId) return
    const drop = useImStore.getState().consumeQueuedDrop()
    if (!drop || drop.conversationId !== conversationId) return
    if (drop.files.length > 0) sendDroppedFiles(drop.files)
    if (drop.workspaceFiles.length > 0) sendDroppedWorkspaceFiles(drop.workspaceFiles)
  }, [conversationId, queuedDrop, sendDroppedFiles, sendDroppedWorkspaceFiles])

  const { isOver: isFileDropOver, dropProps } = useImExternalFileDrop({
    enabled: Boolean(conversationId),
    targetId: conversationId ? `im-chat:${conversationId}` : undefined,
    onFiles: sendDroppedFiles,
    onWorkspaceFiles: sendDroppedWorkspaceFiles,
    onMemos: (memos) => {
      void sendDroppedMemos(memos)
    },
    onImMessage: (drag) => {
      if (!conversationId) return
      void forwardImMessageToConversation(conversationId, drag).catch(() => toast.error(t('room.sendFailed')))
    },
    onSkippedFolders: (names) => {
      for (const name of names) {
        toast.error(t('room.folderNotSupported', { name }))
      }
    },
  })

  const handleQuote = (message: ImMessage) => {
    if (!conversationId || isImRecalled(message)) return
    useImSessionStore.getState().setQuoting(conversationId, message)
  }

  const handleRecall = async (message: ImMessage) => {
    const optimistic = { ...message, recalledAt: new Date().toISOString() }
    useImSessionStore.getState().upsertMessages(message.conversationId, [optimistic])
    if (quoting?.id === message.id) {
      useImSessionStore.getState().setQuoting(message.conversationId, null)
    }
    notifyImPush({
      type: 'RECALL',
      conversationId: message.conversationId,
      message: optimistic,
    })
    try {
      const recalled = await recallImMessage(message.id)
      const next = { ...recalled, recalledAt: recalled.recalledAt || optimistic.recalledAt }
      useImSessionStore.getState().upsertMessages(next.conversationId, [next])
      notifyImPush({
        type: 'RECALL',
        conversationId: next.conversationId,
        message: next,
      })
      void loadMeta()
    } catch (cause) {
      useImSessionStore.getState().upsertMessages(message.conversationId, [message])
      toast.error(cause instanceof Error ? translateServerText(cause.message) : t('room.recallFailed'))
    }
  }

  const handleDelete = async (message: ImMessage) => {
    try {
      await hideImMessage(message.id)
      useImSessionStore.getState().removeMessage(message.conversationId, message.id)
      void loadMeta()
    } catch (cause) {
      toast.error(cause instanceof Error ? translateServerText(cause.message) : t('room.deleteFailed'))
    }
  }

  const handleRetryUpload = (upload: ImPendingUpload) => {
    if (upload.workspaceFileId) {
      void shareWorkspaceAndSend(
        {
          id: upload.workspaceFileId,
          name: upload.file.name,
          size: upload.byteSize ?? upload.file.size,
          mime: upload.file.type,
          isDir: false,
        },
        conversationId,
        upload.id
      )
      return
    }
    void uploadAndSend(upload.file, upload.msgType, conversationId, upload.id)
  }

  const handleDismissUpload = (upload: ImPendingUpload) => {
    if (!conversationId) return
    useImSessionStore.getState().removePending(conversationId, upload.id)
  }

  const handleOlderScroll = (event: UIEvent<HTMLDivElement>) => {
    if (!hasMoreOlder || loadingOlder || !initialized) return
    if (event.currentTarget.scrollTop > 48) return
    void loadHistory({ older: true })
  }

  const quoteLabels = {
    recalled: t('room.quoteRecalled'),
    image: t('room.quoteImage'),
    file: t('room.quoteFile'),
  }

  const quoteBar = quoting ? (
    <div className='im-quotebar'>
      <div className='min-w-0 flex-1 truncate text-[11.5px] leading-snug text-text-secondary'>
        <span className='font-medium text-foreground'>
          {t('room.quoting', {
            name: quoting.senderNickname || quoting.senderUsername || quoting.senderId,
          })}
        </span>
        <span className='mx-1 opacity-50'>·</span>
        {imQuoteSnippet(quoting, quoteLabels)}
      </div>
      <Button
        type='button'
        variant='ghost'
        size='icon'
        className='size-6 shrink-0 text-muted-foreground'
        onClick={() => conversationId && useImSessionStore.getState().setQuoting(conversationId, null)}
      >
        <X className='size-3.5' />
      </Button>
    </div>
  ) : null

  const handleImagePick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    void uploadAndSend(file, IM_MSG_IMAGE)
  }

  const handleFilePick = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (picked.length === 0) {
      toast.error(t('room.noFileSelected'))
      return
    }
    if (!conversationId) {
      toast.error(t('room.openFailed'))
      return
    }
    for (const file of picked) {
      if (file.size <= 0) {
        toast.error(t('room.folderNotSupported', { name: file.name }))
        continue
      }
      void uploadAndSend(file, IM_MSG_FILE)
    }
  }

  const openFilePicker = () => {
    const input = fileInputRef.current
    if (!input) {
      toast.error(t('room.uploadFailed'))
      return
    }
    input.click()
  }

  const title = meta ? displayConversationTitle(meta) : ''
  const peerAvatar = isSingle ? meta?.peerAvatar : null
  const groupAvatar = isGroup ? meta?.groupAvatar : null
  const headerAvatar = peerAvatar || groupAvatar
  const headerColorSeed = isSingle ? meta?.peerUserId || title : meta?.groupId || title
  const headerColors = getAvatarColorPair(headerColorSeed)

  const mediaButtons = (
    <>
      <Button
        type='button'
        variant='ghost'
        size='icon'
        className='im-iconbtn'
        aria-label={t('room.sendImage')}
        onClick={() => imageInputRef.current?.click()}
      >
        <Image className='size-[17px]' strokeWidth={1.7} />
      </Button>
      <Button
        type='button'
        variant='ghost'
        size='icon'
        className='im-iconbtn'
        aria-label={t('room.sendFile')}
        onClick={openFilePicker}
      >
        <Paperclip strokeWidth={1.7} />
      </Button>
    </>
  )

  if (!conversationId) {
    return (
      <div className='flex h-full flex-col items-center justify-center gap-3 px-6 text-center'>
        <span className='im-chat__emptyglyph' aria-hidden='true'>
          <MessageCircle className='size-5' strokeWidth={1.6} />
        </span>
        <p className='max-w-[22em] text-[13px] leading-relaxed text-text-muted'>{t('dialog.selectChat')}</p>
      </div>
    )
  }

  return (
    <div ref={rootRef} className='im-chat'>
      <div className='im-chat__bar'>
        {(isSingle || isGroup) ? (
          <button
            type='button'
            className='im-chat__avatar'
            aria-label={isGroup ? t('profile.openGroup') : t('profile.open')}
            onClick={() => setProfileOpen(true)}
          >
            {isSingle ? (
              <ImPresenceDot online={Boolean(meta?.peerUserId && peerOnline[meta.peerUserId])}>
                <Avatar className='im-chat__avatar-media'>
                  {headerAvatar ? (
                    <AvatarImage src={resolveMediaUrl(headerAvatar)} alt={title} />
                  ) : null}
                  <AvatarFallback
                    className='text-[12px] font-semibold'
                    style={{ backgroundColor: headerColors.background, color: headerColors.color }}
                  >
                    {getDisplayInitials(title)}
                  </AvatarFallback>
                </Avatar>
              </ImPresenceDot>
            ) : (
              <Avatar className='im-chat__avatar-media'>
                {headerAvatar ? (
                  <AvatarImage src={resolveMediaUrl(headerAvatar)} alt={title} />
                ) : null}
                <AvatarFallback
                  className='text-[12px] font-semibold'
                  style={{ backgroundColor: headerColors.background, color: headerColors.color }}
                >
                  {getDisplayInitials(title)}
                </AvatarFallback>
              </Avatar>
            )}
          </button>
        ) : (
          <div
            className='im-chat__avatar'
            style={{ backgroundColor: headerColors.background, color: headerColors.color }}
          >
            {getDisplayInitials(title)}
          </div>
        )}
        <div className='min-w-0 flex-1'>
          <div className='flex min-w-0 items-baseline gap-2'>
            <h3 className='im-chat__name truncate'>{title}</h3>
            {meta?.lastTime ? (
              <time
                dateTime={meta.lastTime}
                className='shrink-0 font-mono text-[10.5px] tabular-nums text-text-muted'
              >
                {formatMessageTime(meta.lastTime)}
              </time>
            ) : null}
          </div>
          <p className='im-chat__sub flex min-w-0 items-center gap-1.5'>
            {isSingle ? <span className='im-chat__dot' aria-hidden='true' /> : null}
            <span className='truncate'>{isGroup ? t('inbox.title') : t('room.workspaceMember')}</span>
          </p>
        </div>
        {variant === 'sidebar' && (
          <>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='im-iconbtn'
              aria-label={t('display.detach')}
              onClick={() => detachToPopup()}
            >
              <PictureInPicture2 className='size-4' strokeWidth={1.75} />
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='im-iconbtn'
              aria-label={t('dialog.closeSidebar')}
              onClick={() => closeDialog()}
            >
              <PanelRightClose className='size-4' strokeWidth={1.75} />
            </Button>
          </>
        )}
      </div>

      <div className='relative flex min-h-0 min-w-0 flex-1 flex-col' {...dropProps}>
      {/*
        ⚠️ 这里原来是一个**手写**的落点提示：
             <div className='… bg-accent-soft ring-2 ring-inset ring-primary/50'>
               <p className='rounded-full bg-surface …'>{t('room.dropToSend')}</p>
             </div>
        它和文件页/备忘录/AI 面板用的不在同一套视觉里 —— 没有虚线框、
        不会按拖拽种类换图标、也没有 scale 的入场。

        改用全局共用的 <DropOverlay>（components/drop-overlay.tsx）：
          · 虚线框 + 玻璃底 + 主色，三面板一致
          · 图标随拖拽种类变（备忘录 / 文件 / 消息）
          · opacity + scale 的入场，与 iOS 的克制动效一致
      */}
      <DropOverlay active={isFileDropOver} label={t('room.dropToSend')} />
      <ScrollArea
        data-im-chat-scroll
        onScroll={handleOlderScroll}
        className='im-stream min-h-0 min-w-0 overflow-x-hidden'
      >
        {loading && messages.length === 0 && pendingUploads.length === 0 ? (
          <p className='py-8 text-center text-[13px] text-text-muted'>{t('loading')}</p>
        ) : (
          <div key={conversationId} className='im-msg-list im-stream__inner'>
            {loadingOlder ? (
              <p className='pb-2 text-center font-mono text-[10.5px] tracking-wide text-text-muted'>
                {t('room.loadingOlder')}
              </p>
            ) : hasMoreOlder && messages.length > 0 ? (
              <p className='pb-2 text-center font-mono text-[10.5px] tracking-wide text-text-muted'>
                {t('room.scrollForOlder')}
              </p>
            ) : null}
            {messages.map((message, index) => {
              const previous = messages[index - 1]
              const sameSenderAsPrev =
                previous &&
                previous.senderId === message.senderId &&
                !isImRecalled(previous) &&
                !isImRecalled(message)
              const newDay = !previous || imDayKey(previous.createdAt) !== imDayKey(message.createdAt)
              return (
                <Fragment key={message.id}>
                  {newDay ? (
                    <div className='im-daysep'>{formatImDaySeparator(message.createdAt)}</div>
                  ) : null}
                  <ImMessageRow
                    message={message}
                    mine={message.senderId === user?.id}
                    isGroup={isGroup}
                    isSingle={isSingle}
                    peerLastReadMessageId={peerLastReadMessageId}
                    selfName={selfName}
                    selfAvatar={user?.avatar}
                    meta={meta}
                    showAvatar={!sameSenderAsPrev}
                    showTime={!sameSenderAsPrev}
                    grouped={Boolean(sameSenderAsPrev)}
                    onQuote={handleQuote}
                    onRecall={handleRecall}
                    onDelete={handleDelete}
                  />
                </Fragment>
              )
            })}
            {pendingUploads.map((upload) => (
              <ImPendingUploadRow
                key={upload.id}
                upload={upload}
                selfName={selfName}
                selfAvatar={user?.avatar}
                onRetry={handleRetryUpload}
                onDismiss={handleDismissUpload}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      <div className='im-composer shrink-0'>
        {quoteBar}
        {variant === 'popup' || variant === 'detached' ? (
          <div className='im-composer__pill'>
            <div className='flex shrink-0 items-center'>{mediaButtons}</div>
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={t('room.inputPlaceholder')}
              maxLength={MESSAGE_MAX_LENGTH}
              rows={1}
              className='im-composer__field'
              onKeyDown={(event) => {
                if (!shouldSendOnEnter(event)) return
                event.preventDefault()
                void handleSend()
              }}
            />
            <ImEmojiPicker
              disabled={sending}
              onPick={(emoji) => setDraft((value) => appendEmoji(value, emoji))}
            />
            <Button
              type='button'
              className='im-send-btn'
              disabled={sending || !draft.trim()}
              aria-label={t('room.send')}
              onClick={() => void handleSend()}
            >
              <Send className='size-[15px]' strokeWidth={1.9} />
            </Button>
          </div>
        ) : (
          <div className='im-composer__pill'>
            <div className='flex shrink-0 items-center'>{mediaButtons}</div>
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={t('room.inputPlaceholder')}
              maxLength={MESSAGE_MAX_LENGTH}
              className='im-composer__field min-h-0'
              onKeyDown={(event) => {
                if (!shouldSendOnEnter(event)) return
                event.preventDefault()
                void handleSend()
              }}
            />
            <ImEmojiPicker
              disabled={sending}
              onPick={(emoji) => setDraft((value) => appendEmoji(value, emoji))}
            />
            <Button
              type='button'
              className='im-send-btn'
              disabled={sending || !draft.trim()}
              aria-label={t('room.send')}
              onClick={() => void handleSend()}
            >
              <Send className='size-[15px]' strokeWidth={1.9} />
            </Button>
          </div>
        )}
      </div>
      </div>

      <input
        ref={imageInputRef}
        type='file'
        accept='image/*'
        className='hidden'
        tabIndex={-1}
        onChange={handleImagePick}
      />
      <input
        ref={fileInputRef}
        type='file'
        multiple
        className='hidden'
        tabIndex={-1}
        onChange={handleFilePick}
      />
      <ImFriendProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        meta={meta}
        onMutedChange={(nextMuted) => setMeta((current) => (current ? { ...current, muted: nextMuted } : current))}
        onDeleted={() => selectConversation(null)}
        onGroupUpdated={(patch) =>
          setMeta((current) => (current ? { ...current, ...patch } : current))
        }
      />
    </div>
  )
}
