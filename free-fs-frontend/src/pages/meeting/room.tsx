/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 *
 * 会议室窗口直接挂载 wbroom 的 RoomView（tldraw / 麦 / 摄像头 / 屏幕共享）。
 * 只适配登录、工作空间邀请和预约开关房。
 */

import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { createApp, defineComponent, h } from 'vue'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { joinWorkspaceMeeting } from '@/api/meeting'
import type { AlderMeetingBridge } from '@/wbroom/api/room'
import RoomView from '@/wbroom/views/RoomView.vue'
import { useAuth } from '@/contexts/auth-context'
import { translateServerText } from '@/i18n'
import { syncWbroomLangFromApp } from '@/lib/sync-wbroom-lang'
import 'tldraw/tldraw.css'
import './room-ios.css'

export default function MeetingRoomPage() {
  const { t } = useTranslation('board')
  const { meetingId = '' } = useParams()
  const [params] = useSearchParams()
  const { user } = useAuth()
  const hostRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')
  /*
   * 顶栏是**纯展示** chrome（demo 的会议室左上角有一枚浮动胶囊：
   * 房间名 + 实时计时）。这里不参与任何媒体/同步逻辑。
   */
  const [roomTitle, setRoomTitle] = useState('')
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (error) return
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [error])

  const elapsedLabel = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(
    elapsed % 60
  ).padStart(2, '0')}`

  useEffect(() => {
    const workspaceId = params.get('ws') || ''
    const el = hostRef.current
    if (!el || !meetingId) return
    let app: ReturnType<typeof createApp> | null = null
    let cancelled = false

    ;(async () => {
      try {
        const joined = await joinWorkspaceMeeting(meetingId, workspaceId)
        if (cancelled) return
        /*
         * 后端在「会议不存在 / 未开启 / 已结束」时会返回 data:null，
         * 而 request 层会把 null 原样透出。这里必须显式收口，
         * 否则下面 `joined.roomId` 会抛
         * "Cannot read properties of null (reading 'roomId')"，
         * 整页黑屏只剩一个 toast（实测过）。
         */
        if (!joined || !joined.roomId) {
          throw new Error(t('meeting.notOpen'))
        }
        setRoomTitle(joined.title || '')
        const bridge: AlderMeetingBridge = {
          meetingId,
          roomId: joined.roomId,
          workspaceId,
          host: !!joined.host,
          displayName: user?.username || user?.nickname || user?.email || '',
          noTtl: true,
        }
        ;(window as Window & { __alderMeeting?: AlderMeetingBridge }).__alderMeeting = bridge
        if (joined.host) {
          localStorage.setItem(`whiteboard_admin_token:${joined.roomId}`, 'alder-host')
        } else {
          localStorage.removeItem(`whiteboard_admin_token:${joined.roomId}`)
        }
        const router = createRouter({
          history: createMemoryHistory(),
          routes: [{ path: '/r/:roomId', component: RoomView }],
        })
        await router.replace(`/r/${joined.roomId}`)
        syncWbroomLangFromApp()
        const Host = defineComponent({
          setup() {
            return () => h(RouterView)
          },
        })
        app = createApp(Host)
        app.use(createPinia())
        app.use(router)
        app.mount(el)
      } catch (err) {
        const message = err instanceof Error ? err.message : t('meeting.notOpen')
        setError(translateServerText(message))
        toast.error(translateServerText(message))
      }
    })()

    return () => {
      cancelled = true
      app?.unmount()
      delete (window as Window & { __alderMeeting?: AlderMeetingBridge }).__alderMeeting
    }
  }, [meetingId, params, t, user?.email, user?.nickname, user?.username])

  return (
    /*
      会议室是「始终暗色」的整页场景：这里挂 .dark 作用域，
      让房间内部所有 design token 解析成暗色值（浅色主题下也一样），
      否则浅色主题会把视频舞台翻成冰白，语义直接反过来。
      另外 .room-shell 提供舞台底色，见 room-ios.css。
    */
    <div className='room-shell dark relative h-dvh w-screen overflow-hidden text-foreground'>
      {/*
        环境色场：会议室整页是暗色玻璃，玻璃必须有东西可折射，
        否则只剩一块死黑的板子。这里只铺一层极淡的色场。
      */}
      <div
        aria-hidden
        className='a-ambient pointer-events-none absolute inset-0 opacity-60'
      />
      <div
        ref={hostRef}
        className='relative h-full w-full'
        data-meeting-host={meetingId}
      />
      {/* 顶部浮动玻璃条：房间名 + 实时计时（纯展示） */}
      {!error ? (
        <div className='pointer-events-none absolute inset-x-0 top-0 z-40 flex items-start p-4'>
          <div className='a-glass flex max-w-[62vw] items-center gap-3 rounded-full py-2.5 pr-4 pl-4'>
            <span className='pulse-dot' aria-hidden />
            <span className='truncate text-[15px] font-semibold tracking-tight'>
              {roomTitle || t('meeting.title')}
            </span>
            <span
              className='font-mono text-[12.5px] tabular-nums text-text-secondary'
              aria-hidden
            >
              {elapsedLabel}
            </span>
          </div>
        </div>
      ) : null}
      {error ? (
        <div className='absolute inset-0 z-50 grid place-items-center px-6'>
          <div className='a-glass w-full max-w-[420px] rounded-[24px] px-8 py-9 text-center'>
            <div className='mx-auto mb-5 grid size-14 place-items-center rounded-full bg-accent-soft text-primary'>
              <svg
                width='24'
                height='24'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='1.8'
                aria-hidden
              >
                <path d='M17 10.5V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3.5l4 3.5V7l-4 3.5Z' strokeLinejoin='round' />
                <path d='M3 3l18 18' strokeLinecap='round' />
              </svg>
            </div>
            <p className='tech-eyebrow'>会议室</p>
            <h1 className='mt-2 text-[22px] font-semibold tracking-tight'>
              {t('meeting.notOpen')}
            </h1>
            <p className='mt-3 text-[13.5px] leading-relaxed text-text-secondary'>
              {error}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
