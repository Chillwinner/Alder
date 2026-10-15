/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useTranslation } from 'react-i18next'
import { Users, UsersRound } from 'lucide-react'
import { ImConversationAvatarList } from '@/components/messages/im-conversation-avatar-list'
import { ImRailAvatar } from '@/components/messages/im-rail-avatar'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/auth-context'
import { useImInbox } from '@/hooks/use-im-inbox'
import { useImStore } from '@/store/im'

export function ImConversationRail() {
  const { t } = useTranslation('messages')
  const { user } = useAuth()
  const panel = useImStore((state) => state.panel)
  const setPanel = useImStore((state) => state.setPanel)
  const openCreateGroup = useImStore((state) => state.openCreateGroup)
  const { items } = useImInbox()

  const displayName = user?.nickname || user?.username || '?'

  return (
    <nav className='flex h-full min-h-0 w-12 shrink-0 flex-col border-r border-divider bg-surface-3'>
      <div className='flex shrink-0 justify-center py-2'>
        <ImRailAvatar
          name={displayName}
          avatar={user?.avatar}
          colorSeed={user?.id || displayName}
        />
      </div>

      <ImConversationAvatarList items={items} variant='sidebar' />

      <div className='flex shrink-0 flex-col items-center gap-1 py-2'>
        <button
          type='button'
          title={t('group.create')}
          className='flex size-8 items-center justify-center rounded-md text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-foreground active:scale-[0.96]'
          onClick={() => openCreateGroup()}
        >
          <UsersRound className='size-4' strokeWidth={1.75} />
        </button>
        <button
          type='button'
          title={t('friends.title')}
          className={cn(
            'flex size-8 items-center justify-center rounded-md text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-foreground active:scale-[0.96]',
            panel === 'contacts' && 'bg-accent text-foreground'
          )}
          onClick={() => setPanel('contacts')}
        >
          <Users className='size-4' strokeWidth={1.75} />
        </button>
      </div>
    </nav>
  )
}
