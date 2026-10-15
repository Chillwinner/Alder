import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

function tokenKey(roomId: string) {
  return `whiteboard_admin_token:${roomId}`
}

export const useWhiteboardStore = defineStore('whiteboard', () => {
  const roomId = ref('')
  const onlineUsers = ref(1)

  const isAdmin = computed(() => {
    if (!roomId.value) return false
    return !!localStorage.getItem(tokenKey(roomId.value))
  })

  function setRoomId(id: string) {
    roomId.value = id
  }

  function setAdminToken(token: string) {
    if (!roomId.value) return
    localStorage.setItem(tokenKey(roomId.value), token)
  }

  function getAdminToken(): string | null {
    if (!roomId.value) return null
    return localStorage.getItem(tokenKey(roomId.value))
  }

  function clearAdminToken(id?: string) {
    const rid = id || roomId.value
    if (rid) localStorage.removeItem(tokenKey(rid))
  }

  function setOnlineUsers(n: number) {
    onlineUsers.value = n
  }

  /** 仅退出当前会话，保留房主 token，方便稍后用「加入房间」回来关房 */
  function clearSession() {
    roomId.value = ''
    onlineUsers.value = 1
  }

  /** 房间已不存在/已关闭：会话 + 房主凭证一并清掉 */
  function clearRoom() {
    clearAdminToken()
    clearSession()
  }

  return {
    roomId,
    onlineUsers,
    isAdmin,
    setRoomId,
    setAdminToken,
    getAdminToken,
    clearAdminToken,
    setOnlineUsers,
    clearSession,
    clearRoom,
  }
})
