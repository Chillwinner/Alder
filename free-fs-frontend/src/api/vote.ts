/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { request } from './request'

export type VoteChoice = 'AGREE' | 'DISAGREE'

export interface WorkspaceVoteParticipant {
  userId: string
  username?: string | null
  nickname?: string | null
  avatar?: string | null
  choice?: VoteChoice | null
}

export interface WorkspaceVote {
  id: string
  workspaceId: string
  workspaceName?: string | null
  workspaceSlug?: string | null
  title: string
  createdBy?: string | null
  creatorName?: string | null
  createdAt?: string | null
  agreeCount: number
  disagreeCount: number
  pendingCount: number
  myChoice?: VoteChoice | null
  participant: boolean
  host?: boolean
  participants?: WorkspaceVoteParticipant[]
}

export function listWorkspaceVotes() {
  return request.get<WorkspaceVote[]>('/apis/workspace-votes')
}

export function listPendingVotes() {
  return request.get<WorkspaceVote[]>('/apis/workspace-votes/pending')
}

export function createWorkspaceVote(title: string, participantUserIds: string[]) {
  return request.post<WorkspaceVote>('/apis/workspace-votes', {
    title,
    participantUserIds,
  })
}

export function castWorkspaceVote(
  voteId: string,
  choice: VoteChoice,
  workspaceId?: string | null
) {
  const headers =
    workspaceId && workspaceId.length > 0
      ? { 'X-Workspace-Id': workspaceId }
      : undefined
  return request.post<void>(
    `/apis/workspace-votes/${voteId}/choice`,
    { choice },
    headers ? { headers } : undefined
  )
}
