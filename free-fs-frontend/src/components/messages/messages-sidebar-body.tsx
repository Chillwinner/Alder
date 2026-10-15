/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { ImChatPanel } from '@/components/messages/im-chat-panel'
import { ImContactsPanel } from '@/components/messages/im-contacts-panel'
import { ImConversationRail } from '@/components/messages/im-conversation-rail'
import { useImStore } from '@/store/im'

export function MessagesSidebarBody() {
  const panel = useImStore((state) => state.panel)

  return (
    <div className='flex min-h-0 min-w-0 flex-1 flex-col'>
      <div className='flex min-h-0 min-w-0 flex-1'>
        <ImConversationRail />
        <div className='min-w-0 flex-1 overflow-hidden'>
          {panel === 'contacts' ? <ImContactsPanel compact /> : <ImChatPanel variant='sidebar' />}
        </div>
      </div>
    </div>
  )
}
