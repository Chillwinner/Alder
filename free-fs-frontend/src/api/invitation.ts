/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { InvitationDetail, AcceptInvitationResponse } from '@/types/invitation'
import { request } from './request'

export const invitationApi = {
  /**
   * 验证邀请令牌
   * @param token 邀请令牌
   */
  verifyInvitation: (token: string) => {
    return request.get<InvitationDetail>(`/apis/invitation/verify/${token}`)
  },

  /**
   * 接受邀请
   * @param token 邀请令牌
   */
  acceptInvitation: (token: string) => {
    return request.post<AcceptInvitationResponse>(`/apis/invitation/accept/${token}`)
  },

  listMine: () => {
    return request.get<InvitationDetail[]>('/apis/invitation/mine')
  },

  rejectInvitation: (token: string) => {
    return request.post<void>(`/apis/invitation/reject/${token}`)
  },
}
