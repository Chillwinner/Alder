/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useTranslation } from 'react-i18next'
import { PanelRight, Users, UsersRound } from 'lucide-react'
import { ImConversationAvatarList } from '@/components/messages/im-conversation-avatar-list'
import { ImRailAvatar } from '@/components/messages/im-rail-avatar'
import { useAuth } from '@/contexts/auth-context'
import { useImInbox } from '@/hooks/use-im-inbox'
import { useImStore } from '@/store/im'

export function ImPopupNavRail() {
  const { t } = useTranslation('messages')
  const { user } = useAuth()
  const panel = useImStore((state) => state.panel)
  const setPanel = useImStore((state) => state.setPanel)
  const attachToSidebar = useImStore((state) => state.attachToSidebar)
  const openCreateGroup = useImStore((state) => state.openCreateGroup)
  const { items } = useImInbox()

  const displayName = user?.nickname || user?.username || '?'

  return (
    <nav className='im-rail'>
      <div className='im-rail__top'>
        <ImRailAvatar
          name={displayName}
          avatar={user?.avatar}
          colorSeed={user?.id || displayName}
        />
      </div>

      <ImConversationAvatarList items={items} variant='sidebar' className='im-rail__stack' />

      <div className='im-rail__foot'>
        <span className='im-rail__sep' aria-hidden='true' />
        <button
          type='button'
          title={t('group.create')}
          className='im-rail__btn'
          onClick={() => openCreateGroup()}
        >
          <UsersRound className='size-[18px]' strokeWidth={1.7} />
        </button>
        <button
          type='button'
          title={t('friends.title')}
          data-on={panel === 'contacts'}
          className='im-rail__btn'
          onClick={() => setPanel('contacts')}
        >
          <Users className='size-[18px]' strokeWidth={1.7} />
        </button>
        <button
          type='button'
          title={t('display.attach')}
          className='im-rail__btn'
          onClick={() => attachToSidebar()}
        >
          <PanelRight className='size-[18px]' strokeWidth={1.7} />
        </button>
      </div>
    </nav>
  )
}
