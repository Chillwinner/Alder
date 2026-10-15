/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { create } from 'zustand'
import type { WorkspaceMemo } from '@/types/workspace-board'

type MemoPreviewState = {
  memo: WorkspaceMemo | null
  origin: DOMRect | null
  open: (memo: WorkspaceMemo, origin?: DOMRect | null) => void
  close: () => void
}

export const useMemoPreviewStore = create<MemoPreviewState>((set) => ({
  memo: null,
  origin: null,
  open: (memo, origin) => set({ memo, origin: origin ?? null }),
  close: () => set({ memo: null, origin: null }),
}))
