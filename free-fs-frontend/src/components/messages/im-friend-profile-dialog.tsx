/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, Loader2, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import {
  deleteFriend,
  fetchFriends,
  fetchImGroupMembers,
  fetchImInbox,
  inviteImGroupMembers,
  leaveImGroup,
  openSingleConversation,
  requestFriend,
  setConversationMuted,
  updateImGroup,
  uploadGroupAvatar,
} from '@/api/im'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/auth-context'
import { translateServerText } from '@/i18n'
import { cn } from '@/lib/utils'
import { resolveMediaUrl } from '@/utils/media-url'
import type { ImFriend, ImGroupMember, ImInboxItem } from '@/types/im'
import { getAvatarColorPair, getDisplayInitials } from './im-avatar-style'
import { notifyInboxRefresh } from './im-events'
import { displayConversationTitle, displayUserName } from './im-utils'

type ProfileView = 'main' | 'member' | 'invite'

type ImFriendProfileDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  meta: ImInboxItem | null
  onMutedChange?: (muted: boolean) => void
  onDeleted?: () => void
  onGroupUpdated?: (patch: { groupAvatar?: string | null; groupNotice?: string | null }) => void
}

function memberDisplayName(member: ImGroupMember) {
  return member.groupNickname || displayUserName(member)
}

export function ImFriendProfileDialog({
  open,
  onOpenChange,
  meta,
  onMutedChange,
  onDeleted,
  onGroupUpdated,
}: ImFriendProfileDialogProps) {
  const { t } = useTranslation('messages')
  const { user } = useAuth()
  const [view, setView] = useState<ProfileView>('main')
  const [selectedMember, setSelectedMember] = useState<ImGroupMember | null>(null)
  const [muted, setMuted] = useState(false)
  const [muting, setMuting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [addingFriend, setAddingFriend] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [members, setMembers] = useState<ImGroupMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [memberConversationId, setMemberConversationId] = useState<string | null>(null)
  const [memberConversationLoading, setMemberConversationLoading] = useState(false)
  const [friends, setFriends] = useState<ImFriend[]>([])
  const [friendsLoading, setFriendsLoading] = useState(false)
  const [inviteSelectedIds, setInviteSelectedIds] = useState<string[]>([])
  const [inviting, setInviting] = useState(false)
  const [noticeDraft, setNoticeDraft] = useState('')
  const [savingNotice, setSavingNotice] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const groupAvatarInputRef = useRef<HTMLInputElement>(null)

  const isSingle = meta?.convType === 'single'
  const isGroup = meta?.convType === 'group'
  const isMemberView = view === 'member' && selectedMember != null
  const isInviteView = view === 'invite'
  const memberIdSet = new Set(members.map((member) => member.userId))
  const invitableFriends = friends.filter((friend) => !memberIdSet.has(friend.friendId))

  useEffect(() => {
    if (!open) {
      setView('main')
      setSelectedMember(null)
      setMemberConversationId(null)
      setDeleteOpen(false)
      setInviteSelectedIds([])
    }
  }, [open])

  const noticeTouched = useRef(false)

  useEffect(() => {
    if (!open) {
      noticeTouched.current = false
      return
    }
    if (view !== 'main') return
    setMuted(Boolean(meta?.muted))
  }, [open, view, meta?.muted])

  useEffect(() => {
    if (!open) return
    if (noticeTouched.current) return
    setNoticeDraft(meta?.groupNotice || '')
  }, [open, meta?.groupId, meta?.groupNotice])

  const loadMembers = useCallback(async () => {
    if (!meta?.groupId) return
    setMembersLoading(true)
    try {
      setMembers(await fetchImGroupMembers(meta.groupId))
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? translateServerText(cause.message, t('profile.membersFailed'))
          : t('profile.membersFailed')
      )
      setMembers([])
    } finally {
      setMembersLoading(false)
    }
  }, [meta?.groupId, t])

  useEffect(() => {
    if (!open || !isGroup || view !== 'main') return
    void loadMembers()
  }, [open, isGroup, view, loadMembers])

  const loadFriends = useCallback(async () => {
    setFriendsLoading(true)
    try {
      setFriends(await fetchFriends())
    } catch {
      setFriends([])
    } finally {
      setFriendsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open || !isInviteView) return
    setInviteSelectedIds([])
    void loadFriends()
  }, [open, isInviteView, loadFriends])

  const loadMemberConversation = useCallback(async (member: ImGroupMember) => {
    if (member.friendStatus !== 'accepted') {
      setMemberConversationId(null)
      setMuted(false)
      return
    }
    setMemberConversationLoading(true)
    try {
      const { conversationId } = await openSingleConversation(member.userId)
      setMemberConversationId(conversationId)
      const inbox = await fetchImInbox()
      const item = inbox.find((entry) => entry.conversationId === conversationId)
      setMuted(Boolean(item?.muted))
    } catch {
      setMemberConversationId(null)
      setMuted(false)
    } finally {
      setMemberConversationLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open || !isMemberView || !selectedMember) return
    void loadMemberConversation(selectedMember)
  }, [open, isMemberView, selectedMember, loadMemberConversation])

  if (!meta || (!isSingle && !isGroup)) {
    return null
  }
  if (isSingle && !meta.peerUserId) {
    return null
  }
  if (isGroup && !meta.groupId) {
    return null
  }

  const title = displayConversationTitle(meta)
  const conversationId = meta.conversationId
  const avatarSeed = isSingle ? meta.peerUserId! : meta.groupId || title
  const colors = getAvatarColorPair(avatarSeed)
  const avatarUrl = isSingle ? meta.peerAvatar : meta.groupAvatar

  const memberName = selectedMember ? memberDisplayName(selectedMember) : ''
  const memberColors = selectedMember ? getAvatarColorPair(selectedMember.userId) : colors

  const deleteLabel = isMemberView
    ? t('profile.delete')
    : isGroup
      ? t('profile.leaveGroup')
      : t('profile.delete')
  const deleteTitle = isMemberView
    ? t('profile.deleteConfirmTitle')
    : isGroup
      ? t('profile.leaveConfirmTitle')
      : t('profile.deleteConfirmTitle')
  const deleteBody = isMemberView
    ? t('profile.deleteConfirmBody', { name: memberName })
    : isGroup
      ? t('profile.leaveConfirmBody', { name: title })
      : t('profile.deleteConfirmBody', { name: title })
  const deleteSuccess = isMemberView
    ? t('profile.deletedOk')
    : isGroup
      ? t('profile.leftOk')
      : t('profile.deletedOk')
  const deleteFailed = isMemberView
    ? t('profile.deleteFailed')
    : isGroup
      ? t('profile.leaveFailed')
      : t('profile.deleteFailed')

  const handleOpenMember = (member: ImGroupMember) => {
    if (member.userId === user?.id) return
    setSelectedMember(member)
    setView('member')
  }

  const handleBack = () => {
    setView('main')
    setSelectedMember(null)
    setMemberConversationId(null)
    setDeleteOpen(false)
    setInviteSelectedIds([])
  }

  const toggleInviteFriend = (friendId: string, checked: boolean) => {
    setInviteSelectedIds((prev) =>
      checked ? [...prev, friendId] : prev.filter((id) => id !== friendId)
    )
  }

  const handleInvite = async () => {
    if (!meta?.groupId || inviting) return
    if (inviteSelectedIds.length === 0) {
      toast.error(t('profile.inviteEmpty'))
      return
    }
    setInviting(true)
    try {
      const result = await inviteImGroupMembers(meta.groupId, inviteSelectedIds)
      toast.success(t('profile.invitedOk', { count: result.count }))
      setView('main')
      setInviteSelectedIds([])
      void loadMembers()
      notifyInboxRefresh()
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? translateServerText(cause.message, t('profile.inviteFailed'))
          : t('profile.inviteFailed')
      )
    } finally {
      setInviting(false)
    }
  }

  const persistGroup = async (patch: { avatar?: string | null; notice?: string | null }) => {
    if (!meta?.groupId) return
    const updated = await updateImGroup({
      groupId: meta.groupId,
      avatar: patch.avatar,
      notice: patch.notice,
    })
    onGroupUpdated?.({
      groupAvatar: updated.avatar ?? patch.avatar ?? meta.groupAvatar,
      groupNotice: updated.notice ?? patch.notice ?? meta.groupNotice,
    })
    notifyInboxRefresh()
    return updated
  }

  const handleSaveNotice = async () => {
    if (!meta?.groupId || savingNotice) return
    const next = noticeDraft.trim()
    if (next === (meta.groupNotice || '').trim()) return
    setSavingNotice(true)
    try {
      await persistGroup({ notice: next })
      noticeTouched.current = false
      toast.success(t('profile.noticeSaved'))
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? translateServerText(cause.message, t('profile.noticeFailed'))
          : t('profile.noticeFailed')
      )
    } finally {
      setSavingNotice(false)
    }
  }

  const handleGroupAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !meta?.groupId) return
    if (file.type && !file.type.startsWith('image/')) {
      toast.error(t('group.imageOnly'))
      return
    }
    setAvatarUploading(true)
    try {
      const uploaded = await uploadGroupAvatar(file)
      await persistGroup({ avatar: uploaded.path })
      toast.success(t('profile.avatarSaved'))
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? translateServerText(cause.message, t('profile.avatarFailed'))
          : t('profile.avatarFailed')
      )
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleMutedChange = async (next: boolean, targetConversationId: string | null | undefined) => {
    if (!targetConversationId || muting) return
    const previous = muted
    setMuted(next)
    setMuting(true)
    try {
      await setConversationMuted(targetConversationId, next)
      if (isSingle && targetConversationId === conversationId) {
        onMutedChange?.(next)
      }
      notifyInboxRefresh()
      toast.success(next ? t('profile.mutedOn') : t('profile.mutedOff'))
    } catch (cause) {
      setMuted(previous)
      toast.error(
        cause instanceof Error
          ? translateServerText(cause.message, t('profile.muteFailed'))
          : t('profile.muteFailed')
      )
    } finally {
      setMuting(false)
    }
  }

  const handleDelete = async () => {
    if (deleting) return
    setDeleting(true)
    try {
      if (isMemberView && selectedMember) {
        await deleteFriend(selectedMember.userId)
        setSelectedMember({ ...selectedMember, friendStatus: null })
        setMemberConversationId(null)
        setMuted(false)
      } else if (isGroup) {
        await leaveImGroup(meta.groupId!)
        onOpenChange(false)
        onDeleted?.()
      } else {
        await deleteFriend(meta.peerUserId!)
        onOpenChange(false)
        onDeleted?.()
      }
      toast.success(deleteSuccess)
      setDeleteOpen(false)
      notifyInboxRefresh()
      if (isGroup && view === 'main') {
        onOpenChange(false)
        onDeleted?.()
      }
      if (isMemberView) {
        void loadMembers()
      }
    } catch (cause) {
      toast.error(
        cause instanceof Error ? translateServerText(cause.message, deleteFailed) : deleteFailed
      )
    } finally {
      setDeleting(false)
    }
  }

  const handleAddFriend = async () => {
    if (!selectedMember || addingFriend) return
    setAddingFriend(true)
    try {
      await requestFriend(selectedMember.userId)
      toast.success(t('friends.requestSent'))
      setSelectedMember({ ...selectedMember, friendStatus: 'pending' })
      void loadMembers()
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? translateServerText(cause.message, t('friends.requestFailed'))
          : t('friends.requestFailed')
      )
    } finally {
      setAddingFriend(false)
    }
  }

  const renderMemberActions = () => {
    if (!selectedMember) return null
    const status = selectedMember.friendStatus

    if (status === 'accepted') {
      return (
        <div className='flex flex-col border-t pt-4 gap-3'>
          <label
            htmlFor='im-member-dnd'
            className='flex cursor-pointer items-center gap-3 rounded-md px-1 py-1.5 hover:bg-surface-hover transition-colors duration-150'
          >
            <Checkbox
              id='im-member-dnd'
              checked={muted}
              disabled={muting || memberConversationLoading || !memberConversationId}
              onCheckedChange={(checked) =>
                void handleMutedChange(checked === true, memberConversationId)
              }
            />
            <div className='min-w-0 flex-1'>
              <Label htmlFor='im-member-dnd' className='cursor-pointer font-medium'>
                {t('profile.mute')}
              </Label>
              <p className='text-xs leading-relaxed text-muted-foreground'>{t('profile.muteHint')}</p>
            </div>
            {muting || memberConversationLoading ? (
              <Loader2 className='text-muted-foreground size-4 animate-spin' />
            ) : null}
          </label>
          <Button
            type='button'
            variant='destructive'
            className='w-full'
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className='mr-2 size-4' />
            {t('profile.delete')}
          </Button>
        </div>
      )
    }

    if (status === 'pending') {
      return (
        <div className='border-t pt-4'>
          <p className='text-muted-foreground text-center text-sm'>{t('friends.pending')}</p>
        </div>
      )
    }

    if (status === 'blocked') {
      return (
        <div className='border-t pt-4'>
          <p className='text-muted-foreground text-center text-sm'>{t('friends.blocked')}</p>
        </div>
      )
    }

    if (status === 'rejected') {
      return (
        <div className='border-t pt-4'>
          <p className='text-muted-foreground mb-3 text-center text-sm'>{t('friends.rejected')}</p>
          <Button type='button' className='w-full' disabled={addingFriend} onClick={() => void handleAddFriend()}>
            {addingFriend ? <Loader2 className='size-4 animate-spin' /> : <UserPlus className='mr-2 size-4' />}
            {t('friends.add')}
          </Button>
        </div>
      )
    }

    return (
      <div className='border-t pt-4'>
        <Button type='button' className='w-full' disabled={addingFriend} onClick={() => void handleAddFriend()}>
          {addingFriend ? (
            <Loader2 className='size-4 animate-spin' />
          ) : (
            <>
              <UserPlus className='mr-2 size-4' />
              {t('friends.add')}
            </>
          )}
        </Button>
      </div>
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn('sm:max-w-sm', isGroup && !isMemberView && 'sm:max-w-md')}>
          <DialogHeader>
            <div className='flex items-center gap-2'>
              {isMemberView || isInviteView ? (
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  className='size-8 shrink-0'
                  aria-label={t('profile.back')}
                  onClick={handleBack}
                >
                  <ChevronLeft />
                </Button>
              ) : null}
              <DialogTitle className='min-w-0 flex-1 truncate'>
                {isMemberView
                  ? t('profile.title')
                  : isInviteView
                    ? t('profile.inviteTitle')
                    : isGroup
                      ? t('profile.groupTitle')
                      : t('profile.title')}
              </DialogTitle>
            </div>
          </DialogHeader>

          {isInviteView ? (
            <>
              <ScrollArea className='h-72 rounded-[14px] border border-divider'>
                {friendsLoading ? (
                  <div className='flex h-72 items-center justify-center'>
                    <Loader2 className='text-muted-foreground size-5 animate-spin' />
                  </div>
                ) : invitableFriends.length === 0 ? (
                  <p className='px-3 py-8 text-center text-[13.5px] leading-relaxed text-muted-foreground'>
                    {t('profile.noFriendsToInvite')}
                  </p>
                ) : (
                  <ul className='divide-y divide-border'>
                    {invitableFriends.map((friend) => {
                      const friendName = displayUserName(friend)
                      const checked = inviteSelectedIds.includes(friend.friendId)
                      return (
                        <li key={friend.friendId}>
                          <label className='flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-surface-hover transition-colors duration-150'>
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) =>
                                toggleInviteFriend(friend.friendId, value === true)
                              }
                            />
                            <Avatar className='size-9 shrink-0 rounded-[11px]'>
                              {friend.avatar ? (
                                <AvatarImage
                                  src={resolveMediaUrl(friend.avatar)}
                                  alt={friendName}
                                  className='rounded-[11px]'
                                />
                              ) : null}
                              <AvatarFallback className='rounded-lg text-xs font-semibold'>
                                {getDisplayInitials(friendName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className='min-w-0 flex-1'>
                              <p className='truncate text-sm font-medium'>{friendName}</p>
                              <p className='truncate font-mono text-[11px] text-muted-foreground'>{friend.username}</p>
                            </div>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </ScrollArea>
              <Button
                type='button'
                className='w-full'
                disabled={inviting || inviteSelectedIds.length === 0}
                onClick={() => void handleInvite()}
              >
                {inviting ? (
                  <Loader2 className='size-4 animate-spin' />
                ) : (
                  <>
                    <UserPlus className='mr-2 size-4' />
                    {t('profile.inviteSubmit')}
                  </>
                )}
              </Button>
            </>
          ) : isMemberView && selectedMember ? (
            <>
              <div className='flex flex-col items-center gap-3 py-2'>
                <Avatar className='size-16 rounded-[18px]'>
                  {selectedMember.avatar ? (
                    <AvatarImage
                      src={resolveMediaUrl(selectedMember.avatar)}
                      alt={memberName}
                      className='rounded-[18px]'
                    />
                  ) : null}
                  <AvatarFallback
                    className='rounded-[18px] text-lg font-semibold'
                    style={{ backgroundColor: memberColors.background, color: memberColors.color }}
                  >
                    {getDisplayInitials(memberName)}
                  </AvatarFallback>
                </Avatar>
                <div className='text-center'>
                  <p className='text-[15px] font-semibold tracking-tight'>{memberName}</p>
                  <p className='font-mono text-xs text-muted-foreground'>{selectedMember.username}</p>
                  {selectedMember.role === 'owner' ? (
                    <p className='mt-1 font-mono text-[11px] font-medium tracking-wider text-primary'>{t('profile.owner')}</p>
                  ) : null}
                </div>
              </div>
              {renderMemberActions()}
            </>
          ) : (
            <>
              <div className='flex flex-col items-center gap-3 py-2'>
                {isGroup ? (
                  <button
                    type='button'
                    className='relative shrink-0 rounded-[18px] outline-none transition-shadow duration-150 hover:ring-2 hover:ring-primary/40 focus-visible:ring-2 focus-visible:ring-ring'
                    disabled={avatarUploading}
                    title={t('profile.changeAvatar')}
                    onClick={() => groupAvatarInputRef.current?.click()}
                  >
                    <Avatar className='size-16 rounded-[18px]'>
                      {avatarUrl ? (
                        <AvatarImage src={resolveMediaUrl(avatarUrl)} alt={title} className='rounded-[18px]' />
                      ) : null}
                      <AvatarFallback
                        className='rounded-[18px] text-lg font-semibold'
                        style={{ backgroundColor: colors.background, color: colors.color }}
                      >
                        {getDisplayInitials(title)}
                      </AvatarFallback>
                    </Avatar>
                    {avatarUploading ? (
                      <span className='absolute inset-0 flex items-center justify-center rounded-[18px] bg-background/70'>
                        <Loader2 className='size-5 animate-spin text-muted-foreground' />
                      </span>
                    ) : null}
                  </button>
                ) : (
                  <Avatar className='size-16 rounded-[18px]'>
                    {avatarUrl ? (
                      <AvatarImage src={resolveMediaUrl(avatarUrl)} alt={title} className='rounded-[18px]' />
                    ) : null}
                    <AvatarFallback
                      className='rounded-[18px] text-lg font-semibold'
                      style={{ backgroundColor: colors.background, color: colors.color }}
                    >
                      {getDisplayInitials(title)}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className='text-center'>
                  <p className='text-[15px] font-semibold tracking-tight'>{title}</p>
                  {isSingle && meta.peerUsername ? (
                    <p className='font-mono text-xs text-muted-foreground'>{meta.peerUsername}</p>
                  ) : null}
                  {isGroup ? (
                    <p className='text-sm text-muted-foreground'>
                      {membersLoading
                        ? t('profile.membersLoading')
                        : t('profile.memberCount', { count: members.length })}
                    </p>
                  ) : null}
                </div>
                {isGroup ? (
                  <input
                    ref={groupAvatarInputRef}
                    type='file'
                    accept='image/*'
                    className='hidden'
                    onChange={(event) => void handleGroupAvatarChange(event)}
                  />
                ) : null}
              </div>

              {isGroup ? (
                <div className='flex flex-col gap-2 border-t pt-3'>
                  <Label htmlFor='im-group-notice'>{t('profile.notice')}</Label>
                  <Textarea
                    id='im-group-notice'
                    value={noticeDraft}
                    maxLength={512}
                    rows={3}
                    placeholder={t('profile.noticePlaceholder')}
                    onChange={(event) => {
                      noticeTouched.current = true
                      setNoticeDraft(event.target.value)
                    }}
                    onBlur={() => void handleSaveNotice()}
                  />
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    className='self-end'
                    disabled={savingNotice}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => void handleSaveNotice()}
                  >
                    {savingNotice ? <Loader2 className='size-3.5 animate-spin' /> : t('profile.noticeSave')}
                  </Button>
                  {savingNotice ? (
                    <p className='flex items-center gap-1.5 text-xs text-muted-foreground'>
                      <Loader2 className='size-3.5 animate-spin' />
                      {t('loading')}
                    </p>
                  ) : !noticeDraft.trim() ? (
                    <p className='text-xs text-muted-foreground'>{t('profile.noticeEmpty')}</p>
                  ) : null}
                </div>
              ) : null}

              {isGroup ? (
                <div className='border-t pt-3'>
                  <div className='mb-2 flex items-center justify-between gap-2'>
                    <p className='text-sm font-medium'>{t('profile.members')}</p>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      className='h-7 shrink-0 text-xs'
                      onClick={() => setView('invite')}
                    >
                      <UserPlus className='mr-1 size-3.5' />
                      {t('profile.inviteFriends')}
                    </Button>
                  </div>
                  <ScrollArea className='h-48 rounded-[14px] border border-divider'>
                    {membersLoading ? (
                      <div className='flex h-48 items-center justify-center'>
                        <Loader2 className='text-muted-foreground size-5 animate-spin' />
                      </div>
                    ) : members.length === 0 ? (
                      <p className='px-3 py-6 text-center text-[13.5px] leading-relaxed text-muted-foreground'>
                        {t('profile.membersEmpty')}
                      </p>
                    ) : (
                      <ul className='divide-y divide-border'>
                        {members.map((member) => {
                          const name = memberDisplayName(member)
                          const memberRowColors = getAvatarColorPair(member.userId)
                          const isSelf = member.userId === user?.id
                          const clickable = !isSelf
                          return (
                            <li key={member.userId}>
                              <button
                                type='button'
                                disabled={!clickable}
                                className={cn(
                                  'flex w-full items-center gap-2.5 px-3 py-2 text-left',
                                  clickable && 'hover:bg-surface-hover transition-colors duration-150 cursor-pointer',
                                  !clickable && 'cursor-default opacity-80'
                                )}
                                onClick={() => clickable && handleOpenMember(member)}
                              >
                                <Avatar className='size-9 shrink-0 rounded-[11px]'>
                                  {member.avatar ? (
                                    <AvatarImage
                                      src={resolveMediaUrl(member.avatar)}
                                      alt={name}
                                      className='rounded-[11px]'
                                    />
                                  ) : null}
                                  <AvatarFallback
                                    className='rounded-lg text-xs font-semibold'
                                    style={{
                                      backgroundColor: memberRowColors.background,
                                      color: memberRowColors.color,
                                    }}
                                  >
                                    {getDisplayInitials(name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className='min-w-0 flex-1'>
                                  <p className='truncate text-sm font-medium'>
                                    {name}
                                    {isSelf ? (
                                      <span className='ml-1 text-xs font-normal text-muted-foreground'>
                                        ({t('profile.self')})
                                      </span>
                                    ) : null}
                                  </p>
                                  <p className='truncate font-mono text-[11px] text-muted-foreground'>{member.username}</p>
                                </div>
                                {member.role === 'owner' ? (
                                  <span className='im-contacts__role shrink-0'>
                                    {t('profile.owner')}
                                  </span>
                                ) : null}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </ScrollArea>
                </div>
              ) : null}

              <div className='flex flex-col border-t pt-4 gap-3'>
                <label
                  htmlFor='im-conversation-dnd'
                  className='flex cursor-pointer items-center gap-3 rounded-md px-1 py-1.5 hover:bg-surface-hover transition-colors duration-150'
                >
                  <Checkbox
                    id='im-conversation-dnd'
                    checked={muted}
                    disabled={muting}
                    onCheckedChange={(checked) =>
                      void handleMutedChange(checked === true, conversationId)
                    }
                  />
                  <div className='min-w-0 flex-1'>
                    <Label htmlFor='im-conversation-dnd' className='cursor-pointer font-medium'>
                      {t('profile.mute')}
                    </Label>
                    <p className='text-xs leading-relaxed text-muted-foreground'>{t('profile.muteHint')}</p>
                  </div>
                  {muting ? <Loader2 className='text-muted-foreground size-4 animate-spin' /> : null}
                </label>
                <Button
                  type='button'
                  variant='destructive'
                  className='w-full'
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className='mr-2 size-4' />
                  {deleteLabel}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{deleteBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t('group.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault()
                void handleDelete()
              }}
            >
              {deleting ? <Loader2 className='size-4 animate-spin' /> : deleteLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
