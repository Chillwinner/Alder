import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs'
import { onUnmounted, ref } from 'vue'
import { useWhiteboardStore } from '../stores/whiteboard'

export type StompHandler = (body: unknown) => void

export function useStomp() {
  const connected = ref(false)
  let client: Client | null = null
  const subs: StompSubscription[] = []

  function connect(roomId: string, onInit: StompHandler, onRoom: StompHandler) {
    disconnect()
    const store = useWhiteboardStore()
    // 进房前确保 roomId 已写入，才能读到 localStorage 里的房主 token
    if (roomId) store.setRoomId(roomId)
    const adminToken = store.getAdminToken() || ''

    client = new Client({
      brokerURL: `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/meeting`,
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        connected.value = true
        console.log('[STOMP] 已连接, roomId:', roomId, 'admin:', !!adminToken)
        if (!client) return
        subs.push(
          client.subscribe('/user/queue/init', (msg: IMessage) => {
            try {
              const body = JSON.parse(msg.body)
              console.log('[STOMP] 收到 INIT:', body)
              onInit(body)
            } catch (e) {
              console.warn('[STOMP] INIT 解析失败', e)
            }
          }),
        )
        const roomHeaders: Record<string, string> = {}
        if (adminToken) roomHeaders['admin-token'] = adminToken
        subs.push(
          client.subscribe(
            `/topic/room/${roomId}`,
            (msg: IMessage) => {
              try {
                const body = JSON.parse(msg.body)
                onRoom(body)
              } catch (e) {
                console.warn('[STOMP] 房间消息解析失败', e)
              }
            },
            roomHeaders,
          ),
        )
      },
      onDisconnect: () => {
        connected.value = false
      },
      onWebSocketClose: () => {
        connected.value = false
      },
      onStompError: (frame) => {
        console.error('[STOMP] error', frame.headers['message'], frame.body)
      },
    })
    client.activate()
  }

  function sendDraw(roomId: string, payload: unknown) {
    if (!client?.connected) return
    client.publish({
      destination: `/app/draw/${roomId}`,
      body: JSON.stringify(payload),
      headers: { 'content-type': 'application/json' },
    })
  }

  function sendVoice(roomId: string, payload: unknown) {
    if (!client?.connected) return
    client.publish({
      destination: `/app/voice/${roomId}`,
      body: JSON.stringify(payload),
      headers: { 'content-type': 'application/json' },
    })
  }

  function sendScreen(roomId: string, payload: unknown) {
    if (!client?.connected) return
    client.publish({
      destination: `/app/screen/${roomId}`,
      body: JSON.stringify(payload),
      headers: { 'content-type': 'application/json' },
    })
  }

  function sendCamera(roomId: string, payload: unknown) {
    if (!client?.connected) return
    client.publish({
      destination: `/app/camera/${roomId}`,
      body: JSON.stringify(payload),
      headers: { 'content-type': 'application/json' },
    })
  }

  function sendKit(roomId: string, payload: unknown) {
    if (!client?.connected) return
    const store = useWhiteboardStore()
    const adminToken = store.getAdminToken() || ''
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (adminToken) headers['admin-token'] = adminToken
    client.publish({
      destination: `/app/kit/${roomId}`,
      body: JSON.stringify(payload),
      headers,
    })
  }

  function sendPresence(roomId: string, payload: unknown) {
    if (!client?.connected) return
    client.publish({
      destination: `/app/presence/${roomId}`,
      body: JSON.stringify(payload),
      headers: { 'content-type': 'application/json' },
    })
  }

  function disconnect() {
    while (subs.length) {
      try {
        subs.pop()?.unsubscribe()
      } catch {
        /* ignore */
      }
    }
    if (client) {
      void client.deactivate()
      client = null
    }
    connected.value = false
  }

  onUnmounted(disconnect)

  return {
    connected,
    connect,
    sendDraw,
    sendVoice,
    sendScreen,
    sendCamera,
    sendPresence,
    sendKit,
    disconnect,
  }
}
