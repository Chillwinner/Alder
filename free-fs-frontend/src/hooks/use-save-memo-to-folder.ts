/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { saveMemosToFolder } from '@/lib/save-memo-to-folder'
import { translateServerText } from '@/i18n'
import type { WorkspaceMemo } from '@/types/workspace-board'

export function useSaveMemoToFolder(onSaved?: () => void) {
  const { t } = useTranslation('files')
  const queryClient = useQueryClient()

  const save = useCallback(
    async (memos: WorkspaceMemo[], parentId?: string) => {
      await saveMemosToFolder(memos, parentId)
      toast.success(t('index.savedMemoToFolder', { count: memos.length }))
      void queryClient.invalidateQueries({ queryKey: ['homeInfo'] })
      void queryClient.invalidateQueries({ queryKey: ['workspace-board'] })
      onSaved?.()
    },
    [onSaved, queryClient, t]
  )

  return { save }
}

export function reportMemoSaveFailed(cause: unknown, fallback: string) {
  toast.error(cause instanceof Error ? translateServerText(cause.message) : fallback)
}
