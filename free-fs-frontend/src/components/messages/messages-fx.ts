/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import './messages-fx.css'

import { useEffect, useRef, useState } from 'react'
import type { ImMessage } from '@/types/im'

/** 自己发出消息后，「对方正在输入」的最长存活时间（超时兜底） */
const TYPE_TIMEOUT = 3000

type MessagesSignature = {
  key: string
  conversationId: string | undefined
}

function buildSignature(messages: ImMessage[]) {
  // 签名 = senderId:id 列表；用于区分「同会话尾部追加」与「整体重绘/切会话」
  return messages.map((message) => `${message.senderId}:${message.id}`).join('|')
}

/**
 * 在展示层观察消息列表的变化（不触碰任何收发/存储逻辑）：
 * - 自己发出的消息在列表尾部追加 → 显示 typing 气泡
 * - 对方回复到达（或 TYPE_TIMEOUT 超时） → 收起
 * - 切换会话 / 历史加载等整体重绘 → 收起
 *
 * 状态切换统一走微任务/定时器回调，签名比较在 effect 内完成。
 */
export function useImTypingState(
  messages: ImMessage[],
  conversationId: string | undefined,
  selfId: string | number | undefined
): boolean {
  const [typing, setTyping] = useState(false)
  // 递增以在「重新进入 typing」时重置 3s 超时窗口
  const [typingNonce, setTypingNonce] = useState(0)
  const signatureRef = useRef<MessagesSignature>({
    key: '',
    conversationId,
  })

  // 超时兜底：typing 期间挂 3s 定时器，回调中收起
  useEffect(() => {
    if (!typing) return undefined
    const timer = setTimeout(() => setTyping(false), TYPE_TIMEOUT)
    return () => clearTimeout(timer)
  }, [typing, typingNonce])

  useEffect(() => {
    const previous = signatureRef.current
    const key = buildSignature(messages)

    let next: boolean | null = null

    if (previous.conversationId !== conversationId) {
      // 切换会话：输入语境失效
      next = false
    } else {
      const previousKey = previous.key
      if (previousKey && previousKey !== key) {
        if (key.length > previousKey.length && key.startsWith(previousKey)) {
          // 签名前缀不变 + 尾部追加 = 同会话新消息
          const last = messages[messages.length - 1]
          if (last) {
            next = selfId != null && String(last.senderId) === String(selfId)
          }
        } else {
          // 整体重绘（加载历史 / 撤回 / 删除等），输入语境失效
          next = false
        }
      }
    }

    signatureRef.current = { key, conversationId }

    if (next === null) return
    queueMicrotask(() => {
      if (next) {
        setTyping(true)
        setTypingNonce((value) => value + 1)
      } else {
        setTyping(false)
      }
    })
  }, [messages, conversationId, selfId])

  return typing
}
