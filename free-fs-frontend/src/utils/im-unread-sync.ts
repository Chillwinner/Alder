/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useImStore } from '@/store/im'
import type { ImInboxItem } from '@/types/im'

export function syncUnreadTotalFromInbox(items: ImInboxItem[]) {
  const total = items.reduce((sum, item) => sum + (item.unreadCount || 0), 0)
  useImStore.getState().setUnreadTotal(total)
}
