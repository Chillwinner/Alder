/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { motion } from 'motion/react'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AiFileChip } from '@/components/ai-dock/ai-file-chip'
import { AiMemoChip } from '@/components/ai-dock/ai-memo-chip'
import { DropOverlay } from '@/components/drop-overlay'
import { useImExternalFileDrop } from '@/hooks/use-im-external-file-drop'
import { parseAiFileMessage } from '@/lib/ai-file-refs'
import { useMemoPreviewStore } from '@/store/memo-preview'
import { useAiDockStore } from '@/store/ai-dock'
import { useWorkspaceStore } from '@/store/workspace'
import type { WorkspaceMemo } from '@/types/workspace-board'
import { cn } from '@/lib/utils'

const ease = [0.22, 1, 0.36, 1] as const

export function AiDockPanel({ right }: { right: number }) {
  const { t } = useTranslation('layout')
  const draft = useAiDockStore((s) => s.draft)
  const setDraft = useAiDockStore((s) => s.setDraft)
  const sending = useAiDockStore((s) => s.sending)
  const sendDraft = useAiDockStore((s) => s.sendDraft)
  const stopTurn = useAiDockStore((s) => s.stopTurn)
  const resendFrom = useAiDockStore((s) => s.resendFrom)
  const createThread = useAiDockStore((s) => s.createThread)
  const removeThread = useAiDockStore((s) => s.removeThread)
  const selectThread = useAiDockStore((s) => s.selectThread)
  const activeThreadId = useAiDockStore((s) => s.activeThreadId)
  const threadsByWorkspace = useAiDockStore((s) => s.threadsByWorkspace)
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspaceId)
  const threads = workspaceId ? (threadsByWorkspace[workspaceId] ?? []) : []
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const openMemo = (memo: WorkspaceMemo, origin: DOMRect) => {
    useMemoPreviewStore.getState().open(memo, origin)
  }
  const active = useMemo(
    () => threads.find((item) => item.id === activeThreadId) ?? threads[0],
    [activeThreadId, threads]
  )
  const logRef = useRef<HTMLDivElement>(null)
  const stickBottom = useRef(true)
  const lastMessage = active?.messages.at(-1)
  const lastText = lastMessage?.text ?? ''

  /*
   * 助手也接受拖拽：把工作空间文件 / 备忘录拖进来 = 交给助手读。
   * 复用聊天那套 hook（同一份 dataTransfer 协议），
   * 落点身份用 'ai' 前缀，源卡片据此高亮。
   */
  const { isOver: isDropOver, dropProps } = useImExternalFileDrop({
    targetId: 'ai',
    onWorkspaceFiles: (files) => {
      if (!files.length) return
      const names = files.map((f) => f.name).join('、')
      setDraft(`${draft ? draft + '\n' : ''}请读一下这些工作空间文件：${names}`)
    },
    onMemos: (memos) => {
      if (!memos.length) return
      const names = memos.map((m) => m.title || '未命名备忘录').join('、')
      setDraft(`${draft ? draft + '\n' : ''}请读一下这些备忘录：${names}`)
    },
    onFiles: () => {
      // 系统文件不能直接喂给助手（没有工作空间引用），明确告知而不是静默吞掉
      setDraft(`${draft ? draft + '\n' : ''}（本地文件需要先上传到工作空间，我才能读取）`)
    },
  })

  useLayoutEffect(() => {
    stickBottom.current = true
  }, [active?.id])

  useLayoutEffect(() => {
    const el = logRef.current
    if (!el || !stickBottom.current) return
    el.scrollTop = el.scrollHeight
  }, [active?.id, active?.messages.length, lastText, sending])

  const submit = () => {
    if (!workspaceId) return
    void sendDraft(workspaceId)
  }

  return (
    <motion.section
      role='dialog'
      aria-label={t('ai.title')}
      /*
        从右下角悬浮球的位置「长出来」：
        用 transformOrigin 钉在右下角 + scale/位移/透明度过渡，
        而不是 layoutId 的形状插值 —— 后者会把玻璃面板的圆角、
        毛玻璃和内部排版一起拉变形，过程中非常难看。
      */
      className='ai-sheet im-ai-panel pointer-events-auto absolute bottom-5 flex h-[min(620px,calc(100vh-2.5rem))] w-[min(440px,calc(100vw-2.5rem))] flex-col overflow-hidden'
      style={{ right, transformOrigin: '100% 100%' }}
      initial={{ opacity: 0, scale: 0.86, y: 18 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 12 }}
      transition={{ type: 'spring', stiffness: 400, damping: 34, mass: 0.8 }}
      {...dropProps}
    >
      <DropOverlay active={isDropOver} label={t('ai.dropHere')} />
      <div className='ai-sheet-scan' aria-hidden />
      <header className='relative z-[1] flex items-start justify-between gap-4 px-6 pt-6 pb-4'>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.36, ease }}
        >
          <p className='ai-sheet-kicker'>{t('ai.kicker')}</p>
          <h2 className='ai-sheet-title'>{t('ai.title')}</h2>
        </motion.div>
        <motion.button
          type='button'
          className='ai-sheet-plus'
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.18, duration: 0.35, ease }}
          onClick={() => workspaceId && void createThread(workspaceId)}
        >
          {t('ai.newThread')}
        </motion.button>
      </header>

      <motion.div
        className='relative z-[1] flex gap-2 overflow-x-auto px-5 pb-3'
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.35 }}
      >
        {threads.map((thread, index) => (
          <motion.div
            key={thread.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 + index * 0.04, duration: 0.32, ease }}
            className={cn('ai-sheet-tab shrink-0', thread.id === active?.id && 'ai-sheet-tab-on')}
          >
            <button
              type='button'
              className='ai-sheet-tab-name transition-colors duration-150 hover:text-[color:var(--ai-ink)]'
              onClick={() => workspaceId && void selectThread(workspaceId, thread.id)}
            >
              {thread.title || t('ai.untitled')}
            </button>
            <button
              type='button'
              className='ai-sheet-tab-del'
              aria-label={t('ai.deleteThread')}
              onClick={(event) => {
                event.stopPropagation()
                if (workspaceId) void removeThread(workspaceId, thread.id)
              }}
            >
              ×
            </button>
          </motion.div>
        ))}
      </motion.div>

      <div
        ref={logRef}
        className='ai-sheet-log relative z-[1] min-h-0 flex-1 overflow-y-auto px-6 py-2'
        onScroll={(event) => {
          const el = event.currentTarget
          stickBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48
        }}
      >
        {(!active || active.messages.length === 0) && (
          <motion.p
            className='ai-sheet-empty'
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24, duration: 0.45, ease }}
          >
            {t('ai.empty')}
          </motion.p>
        )}
        <div className='flex flex-col gap-6'>
          {active?.messages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index, 8) * 0.04, duration: 0.36, ease }}
              className={cn(
                'ai-sheet-row',
                message.role === 'user' ? 'ai-sheet-row-user' : 'ai-sheet-row-ai'
              )}
            >
              <span className='ai-sheet-who'>
                {message.role === 'user' ? t('ai.you') : t('ai.title')}
              </span>
              {message.role === 'user' ? (
                <button
                  type='button'
                  className='ai-sheet-bubble'
                  onClick={() => {
                    setEditingId(message.id)
                    setEditText(message.text)
                  }}
                >
                  {message.text}
                </button>
              ) : (
                <AiAssistantBody
                  text={message.text}
                  pending={Boolean(sending && !message.text)}
                  onOpenMemo={openMemo}
                />
              )}
              {editingId === message.id && (
                <div className='ai-sheet-edit'>
                  <textarea
                    rows={3}
                    value={editText}
                    onChange={(event) => setEditText(event.target.value)}
                    className='ai-sheet-edit-field'
                  />
                  <div className='ai-sheet-edit-actions'>
                    <button type='button' className='ai-sheet-edit-cancel' onClick={() => setEditingId(null)}>
                      {t('ai.cancel')}
                    </button>
                    <button
                      type='button'
                      className='ai-sheet-go'
                      disabled={!editText.trim() || !workspaceId}
                      onClick={() => {
                        if (!workspaceId) return
                        const next = editText
                        setEditingId(null)
                        void resendFrom(workspaceId, message.id, next)
                      }}
                    >
                      {t('ai.resend')}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      <motion.form
        className='ai-sheet-form relative z-[1]'
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28, duration: 0.4, ease }}
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <textarea
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              submit()
            }
          }}
          placeholder={t('ai.placeholder')}
          className='ai-sheet-field'
        />
        {sending ? (
          <button
            type='button'
            className='ai-sheet-stop'
            onClick={() => workspaceId && void stopTurn(workspaceId)}
          >
            {t('ai.stop')}
          </button>
        ) : (
          <button type='submit' className='ai-sheet-go' disabled={!draft.trim() || !workspaceId}>
            {t('ai.send')}
          </button>
        )}
      </motion.form>
    </motion.section>
  )
}

function AiAssistantBody({
  text,
  pending,
  onOpenMemo,
}: {
  text: string
  pending: boolean
  onOpenMemo: (memo: WorkspaceMemo, origin: DOMRect) => void
}) {
  const { t } = useTranslation('layout')
  const parsed = useMemo(() => parseAiFileMessage(text || ''), [text])
  if (pending) {
    return <p className='opacity-70 italic'>{t('ai.pending')}</p>
  }
  const chips = parsed.files.length + parsed.memos.length
  return (
    <div>
      {parsed.prose ? <p className='whitespace-pre-wrap break-words'>{parsed.prose}</p> : null}
      {chips > 0 ? (
        <div className='ai-sheet-files'>
          {parsed.memos.map((memo) => (
            <AiMemoChip key={memo.id} memo={memo} onOpen={onOpenMemo} />
          ))}
          {parsed.files.map((file) => (
            <AiFileChip key={file.id} file={file} onOpenMemo={onOpenMemo} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
