/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { create } from 'zustand'
import type { FileItem } from '@/types/file'

type OfficeEditState = {
  file: FileItem | null
  open: (file: FileItem) => void
  close: () => void
}

export const useOfficeEditStore = create<OfficeEditState>((set) => ({
  file: null,
  open: (file) => set({ file }),
  close: () => set({ file: null }),
}))
