/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

/** 邀请详情（验证接口返回） */
export interface InvitationDetail {
  id: string
  workspaceId: string
  workspaceName: string
  email: string
  roleName: string
  roleCode?: string
  inviterName: string
  status: number
  expiresAt: string
  expired: boolean
  createdAt: string
  userExists: boolean // 关键字段：用户是否已存在
  /** 列表接口返回，用于接受/拒绝 */
  token?: string
}

/** 接受邀请响应 */
export interface AcceptInvitationResponse {
  message?: string
}
