/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 *
 * 主站只通过这里挂载会议室。Vue、Pinia、白板视图不散落到 React 页面里。
 */

import { createApp, defineComponent, h } from 'vue'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import type { AlderMeetingBridge } from '@/wbroom/api/room'
import RoomView from '@/wbroom/views/RoomView.vue'
import { syncWbroomLangFromApp } from '@/lib/sync-wbroom-lang'
import 'tldraw/tldraw.css'

export async function mountMeetingRoom(host: HTMLElement, bridge: AlderMeetingBridge) {
  const scope = window as Window & { __alderMeeting?: AlderMeetingBridge }
  scope.__alderMeeting = bridge
  if (bridge.host) {
    localStorage.setItem(`whiteboard_admin_token:${bridge.roomId}`, 'alder-host')
  } else {
    localStorage.removeItem(`whiteboard_admin_token:${bridge.roomId}`)
  }

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/r/:roomId', component: RoomView }],
  })
  await router.replace(`/r/${bridge.roomId}`)
  syncWbroomLangFromApp()

  const Root = defineComponent({
    setup() {
      return () => h(RouterView)
    },
  })
  const app = createApp(Root)
  app.use(createPinia())
  app.use(router)
  app.mount(host)

  return () => {
    app.unmount()
    if (scope.__alderMeeting?.meetingId === bridge.meetingId) {
      delete scope.__alderMeeting
    }
  }
}
