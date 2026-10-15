import { closeWorkspaceMeeting, fetchMeetingIceServers } from '../../api/meeting'

export interface AlderMeetingBridge {
  meetingId: string
  roomId: string
  workspaceId: string
  host?: boolean
  displayName?: string
  noTtl?: boolean
}

export function alderMeeting(): AlderMeetingBridge | null {
  return (window as Window & { __alderMeeting?: AlderMeetingBridge }).__alderMeeting ?? null
}

export interface ApiResult<T> {
  success: boolean
  message: string
  data: T
}

export interface CreateRoomResponse {
  roomId: string
  adminToken: string
}

export interface IceServer {
  urls: string | string[]
  username?: string | null
  credential?: string | null
}

export interface IceConfigResponse {
  iceServers: IceServer[]
}

export function createRoom(roomId?: string) {
  const bridge = alderMeeting()
  if (!bridge) {
    return Promise.reject(new Error('meeting.not.open'))
  }
  return Promise.resolve<CreateRoomResponse>({ roomId: roomId || bridge.roomId, adminToken: 'alder-host' })
}

/** 房主关闭会议。快照仍由画板本地导出，不上传匿名房间接口。 */
export async function closeRoom(roomId: string, _adminToken: string, _snapshot?: Blob | null) {
  const bridge = alderMeeting()
  if (!bridge || bridge.roomId !== roomId) {
    throw new Error('meeting.not.found')
  }
  await closeWorkspaceMeeting(bridge.meetingId, bridge.workspaceId)
  return null
}

export interface RoomStatusInfo {
  status: string
  createdAt?: string | null
  expiresAt?: string | null
}

export async function getRoomStatus(roomId: string): Promise<RoomStatusInfo> {
  const bridge = alderMeeting()
  if (bridge && bridge.roomId === roomId) {
    return { status: 'ACTIVE' }
  }
  return { status: 'GONE' }
}

export async function downloadRoomSnapshot(_roomId: string) {
  throw new Error('SNAPSHOT_GONE')
}

export async function getIceServers(roomId: string, identity: string): Promise<IceConfigResponse> {
  const bridge = alderMeeting()
  if (!bridge || bridge.roomId !== roomId) {
    return { iceServers: [] }
  }
  const cfg = await fetchMeetingIceServers(bridge.meetingId, bridge.workspaceId, identity)
  return { iceServers: cfg.iceServers || [] }
}
