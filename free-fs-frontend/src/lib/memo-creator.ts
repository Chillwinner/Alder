/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { WorkspaceMember } from '@/types/workspace'
import type { WorkspaceMemo } from '@/types/workspace-board'

export function resolveMemoCreator(
  memo: WorkspaceMemo,
  members: WorkspaceMember[] | undefined,
  currentUserId?: string | null,
  labels?: { you: string; member: string }
) {
  const you = labels?.you ?? '我'
  const fallback = labels?.member ?? '成员'
  if (currentUserId && memo.createdBy === currentUserId) {
    return { name: you, avatar: undefined as string | undefined }
  }
  const member = memo.createdBy
    ? members?.find((item) => item.userId === memo.createdBy)
    : undefined
  return {
    name: member?.nickname?.trim() || member?.username?.trim() || fallback,
    avatar: member?.avatar,
  }
}
