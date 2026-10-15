/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { Fragment, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, UserCheck, UserX } from 'lucide-react'
import { toast } from 'sonner'
import {
  acceptFriend,
  blockFriend,
  fetchFriends,
  fetchFriendRequests,
  fetchImGroups,
  fetchRejectedFriendRequests,
  openSingleConversation,
  rejectFriend,
  requestFriend,
  searchUsers,
} from '@/api/im'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { translateServerText } from '@/i18n'
import { useImStore } from '@/store/im'
import type { ImFriend, ImGroup, ImUserSearchResult } from '@/types/im'
import { openLanSendDialog } from '@/components/lan/lan-transfer-host'
import { useLanOnline } from '@/hooks/use-lan-online'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { getAvatarColorPair, getDisplayInitials } from './im-avatar-style'
import { ImPresenceDot } from './im-presence-dot'
import { displayUserName } from './im-utils'

type ImContactsPanelProps = {
  compact?: boolean
}

export function ImContactsPanel({ compact }: ImContactsPanelProps) {
  const { t } = useTranslation('messages')
  const selectConversation = useImStore((state) => state.selectConversation)

  const [keyword, setKeyword] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<ImUserSearchResult[]>([])
  const [friends, setFriends] = useState<ImFriend[]>([])
  const [groups, setGroups] = useState<ImGroup[]>([])
  const [requests, setRequests] = useState<ImFriend[]>([])
  const [rejected, setRejected] = useState<ImFriend[]>([])
  const [loading, setLoading] = useState(true)
  const [contactsTab, setContactsTab] = useState<
    'friends' | 'groups' | 'requests' | 'rejected'
  >('friends')
  const lanOnline = useLanOnline(friends.map((friend) => friend.friendId))

  const loadLists = useCallback(async () => {
    setLoading(true)
    try {
      const [friendList, groupList, requestList, rejectedList] = await Promise.all([
        fetchFriends(),
        fetchImGroups(),
        fetchFriendRequests(),
        fetchRejectedFriendRequests(),
      ])
      setFriends(friendList)
      setGroups(groupList)
      setRequests(requestList)
      setRejected(rejectedList)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadLists()
  }, [loadLists])

  useEffect(() => {
    const onPush = (event: Event) => {
      const type = (event as CustomEvent<{ type?: string }>).detail?.type
      if (type === 'FRIEND_REQUEST') {
        void loadLists()
      }
    }
    window.addEventListener('im:push', onPush)
    return () => window.removeEventListener('im:push', onPush)
  }, [loadLists])

  const handleSearch = async () => {
    const q = keyword.trim()
    if (q.length < 2) {
      toast.error(t('friends.searchMin'))
      return
    }
    setSearching(true)
    try {
      setResults(await searchUsers(q))
    } catch (cause) {
      const message =
        cause instanceof Error
          ? translateServerText(cause.message, t('friends.searchFailed'))
          : t('friends.searchFailed')
      toast.error(message)
    } finally {
      setSearching(false)
    }
  }

  const handleRequest = async (friendId: string) => {
    try {
      await requestFriend(friendId)
      toast.success(t('friends.requestSent'))
      await handleSearch()
      await loadLists()
    } catch (cause) {
      const message =
        cause instanceof Error
          ? translateServerText(cause.message, t('friends.requestFailed'))
          : t('friends.requestFailed')
      toast.error(message)
    }
  }

  const handleAccept = async (friendId: string) => {
    try {
      await acceptFriend(friendId)
      toast.success(t('friends.accepted'))
      await loadLists()
    } catch (cause) {
      toast.error(cause instanceof Error ? translateServerText(cause.message) : t('friends.actionFailed'))
    }
  }

  const handleReject = async (friendId: string) => {
    try {
      await rejectFriend(friendId)
      await loadLists()
    } catch (cause) {
      toast.error(cause instanceof Error ? translateServerText(cause.message) : t('friends.actionFailed'))
    }
  }

  const handleChat = async (friendId: string) => {
    try {
      const { conversationId } = await openSingleConversation(friendId)
      selectConversation(conversationId)
    } catch (cause) {
      toast.error(cause instanceof Error ? translateServerText(cause.message) : t('room.openFailed'))
    }
  }

  const handleBlock = async (friendId: string) => {
    try {
      await blockFriend(friendId)
      toast.success(t('friends.blockedOk'))
      await loadLists()
    } catch (cause) {
      toast.error(cause instanceof Error ? translateServerText(cause.message) : t('friends.blockFailed'))
    }
  }

  const handleOpenGroup = (group: ImGroup) => {
    if (!group.conversationId) {
      toast.error(t('room.openFailed'))
      return
    }
    selectConversation(group.conversationId)
  }

  const renderSearchResult = (user: ImUserSearchResult) => {
    const status = user.friendStatus
    const name = displayUserName(user)
    const colors = getAvatarColorPair(user.id || name)
    return (
      <li
        key={user.id}
        className='im-contacts__row flex items-center justify-between gap-2 px-3 py-2 transition-colors duration-150 hover:bg-surface-hover'
      >
        <div className='flex min-w-0 items-center gap-2.5'>
          <span
            className='im-contacts__avatar'
            style={{ backgroundColor: colors.background, color: colors.color }}
          >
            {getDisplayInitials(name)}
          </span>
          <div className='min-w-0'>
            <p className='truncate text-[13px] font-medium'>{name}</p>
            <p className='truncate font-mono text-[10.5px] text-muted-foreground'>
              {user.username}
              {user.email ? ` · ${user.email}` : ''}
            </p>
          </div>
        </div>
        {status === 'accepted' ? (
          <Button size='sm' className='h-7 shrink-0 text-xs' onClick={() => void handleChat(user.id)}>
            {t('friends.chat')}
          </Button>
        ) : status === 'pending' ? (
          <span className='shrink-0 text-xs text-muted-foreground'>{t('friends.pending')}</span>
        ) : status === 'rejected' ? (
          <span className='shrink-0 text-xs text-muted-foreground'>{t('friends.rejected')}</span>
        ) : status === 'blocked' ? (
          <span className='shrink-0 text-xs text-muted-foreground'>{t('friends.blocked')}</span>
        ) : (
          <Button size='sm' variant='outline' className='h-7 shrink-0 text-xs' onClick={() => void handleRequest(user.id)}>
            {t('friends.add')}
          </Button>
        )}
      </li>
    )
  }

  const renderUserRow = (user: ImFriend, online: boolean) => {
    const name = displayUserName(user)
    const colors = getAvatarColorPair(user.friendId || name)
    return (
      <div className='flex min-w-0 items-center gap-2.5'>
        <ImPresenceDot online={online}>
          <span
            className='im-contacts__avatar'
            style={{ backgroundColor: colors.background, color: colors.color }}
          >
            {getDisplayInitials(name)}
          </span>
        </ImPresenceDot>
        <div className='min-w-0'>
          <p className='truncate text-[13px] font-medium'>{name}</p>
          <p className='truncate font-mono text-[10.5px] text-muted-foreground'>{user.username}</p>
        </div>
      </div>
    )
  }

  return (
    <div className='im-contacts'>
      <div className='im-contacts__search'>
        <Input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder={t('friends.searchPlaceholder')}
          className='im-conv__input'
          onKeyDown={(event) => {
            if (event.key === 'Enter') void handleSearch()
          }}
        />
        <Button size='sm' className='h-8 shrink-0' disabled={searching} onClick={() => void handleSearch()}>
          <Search className='size-3.5' />
        </Button>
      </div>

      {results.length > 0 && (
        <div className={compact ? 'max-h-36 shrink-0 overflow-y-auto border-b border-divider' : 'max-h-40 shrink-0 overflow-y-auto border-b border-divider'}>
          <p className='im-sect'>{t('friends.searchResults')}</p>
          <ul>{results.map(renderSearchResult)}</ul>
        </div>
      )}

      <Tabs
        value={contactsTab}
        onValueChange={(v) =>
          setContactsTab(v as 'friends' | 'groups' | 'requests' | 'rejected')
        }
        className='flex min-h-0 flex-1 flex-col'
      >
        <SegmentedControl
          fill
          className='mx-3 mt-2 [&_button]:px-2 [&_button]:text-[12px]'
          value={contactsTab}
          onChange={setContactsTab}
          items={[
            { value: 'friends', label: t('friends.friendsTab') },
            { value: 'groups', label: t('friends.groupsTab') },
            {
              value: 'requests',
              label: `${t('friends.requests')}${requests.length > 0 ? ` (${requests.length})` : ''}`,
            },
            {
              value: 'rejected',
              label: `${t('friends.rejectedTab')}${rejected.length > 0 ? ` (${rejected.length})` : ''}`,
            },
          ]}
        />

        <TabsContent value='friends' className='mt-0 min-h-0 flex-1'>
          <ScrollArea className='h-full'>
            {loading ? (
              <p className='p-3 text-center text-[12.5px] text-muted-foreground'>{t('loading')}</p>
            ) : friends.length === 0 ? (
              <p className='p-3 text-center text-[12.5px] leading-relaxed text-muted-foreground'>{t('friends.empty')}</p>
            ) : (
              <ul>
                {friends.map((friend) => {
                  const row = (
                    <li className='im-contacts__row flex items-center justify-between gap-2 px-3 py-2 transition-colors duration-150 hover:bg-surface-hover'>
                      {renderUserRow(friend, Boolean(lanOnline[friend.friendId]))}
                      <div className='flex shrink-0 gap-1'>
                        <Button size='sm' className='h-7 text-xs' onClick={() => void handleChat(friend.friendId)}>
                          {t('friends.chat')}
                        </Button>
                        <Button
                          size='sm'
                          variant='outline'
                          className='h-7 text-xs'
                          onClick={() => void handleBlock(friend.friendId)}
                        >
                          {t('friends.block')}
                        </Button>
                      </div>
                    </li>
                  )
                  if (!lanOnline[friend.friendId]) {
                    return <Fragment key={friend.friendId}>{row}</Fragment>
                  }
                  return (
                    <ContextMenu key={friend.friendId}>
                      <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
                      <ContextMenuContent className='w-40'>
                        <ContextMenuItem
                          onSelect={() => openLanSendDialog(friend.friendId, displayUserName(friend))}
                        >
                          {t('lan.menu')}
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  )
                })}
              </ul>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value='groups' className='mt-0 min-h-0 flex-1'>
          <ScrollArea className='h-full'>
            {loading ? (
              <p className='p-3 text-center text-[12.5px] text-muted-foreground'>{t('loading')}</p>
            ) : groups.length === 0 ? (
              <p className='p-3 text-center text-[12.5px] leading-relaxed text-muted-foreground'>{t('group.empty')}</p>
            ) : (
              <ul>
                {groups.map((group) => (
                  <li
                    key={group.id}
                    className='im-contacts__row flex items-center justify-between gap-2 px-3 py-2 transition-colors duration-150 hover:bg-surface-hover'
                  >
                    <div className='min-w-0'>
                      <p className='truncate text-sm font-medium'>{group.name}</p>
                      <p className='font-mono text-[11px] tabular-nums text-muted-foreground'>
                        {group.memberCount != null ? `${group.memberCount}` : ''}
                      </p>
                    </div>
                    <Button size='sm' className='h-7 text-xs' onClick={() => handleOpenGroup(group)}>
                      {t('group.open')}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value='requests' className='mt-0 min-h-0 flex-1'>
          <ScrollArea className='h-full'>
            {loading ? (
              <p className='p-3 text-center text-[12.5px] text-muted-foreground'>{t('loading')}</p>
            ) : requests.length === 0 ? (
              <p className='p-3 text-center text-[12.5px] leading-relaxed text-muted-foreground'>{t('friends.noRequests')}</p>
            ) : (
              <ul>
                {requests.map((request) => (
                  <li
                    key={request.friendId}
                    className='im-contacts__row flex items-center justify-between gap-2 px-3 py-2 transition-colors duration-150 hover:bg-surface-hover'
                  >
                    {renderUserRow(request, false)}
                    <div className='flex shrink-0 gap-1'>
                      <Button size='sm' className='h-7 px-2 text-xs' onClick={() => void handleAccept(request.friendId)}>
                        <UserCheck className='size-3.5' />
                      </Button>
                      <Button size='sm' variant='outline' className='h-7 px-2 text-xs' onClick={() => void handleReject(request.friendId)}>
                        <UserX className='size-3.5' />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value='rejected' className='mt-0 min-h-0 flex-1'>
          <ScrollArea className='h-full'>
            {loading ? (
              <p className='p-3 text-center text-[12.5px] text-muted-foreground'>{t('loading')}</p>
            ) : rejected.length === 0 ? (
              <p className='p-3 text-center text-[12.5px] leading-relaxed text-muted-foreground'>{t('friends.noRejected')}</p>
            ) : (
              <ul>
                {rejected.map((item) => (
                  <li
                    key={item.friendId}
                    className='im-contacts__row flex items-center justify-between gap-2 px-3 py-2 transition-colors duration-150 hover:bg-surface-hover'
                  >
                    {renderUserRow(item, false)}
                    <Button size='sm' className='h-7 text-xs' onClick={() => void handleAccept(item.friendId)}>
                      {t('friends.accept')}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}
