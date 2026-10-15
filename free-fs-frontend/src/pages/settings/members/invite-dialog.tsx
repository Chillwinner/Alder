/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Loader2, Mail, Search } from 'lucide-react'
import { fetchFriends } from '@/api/im'
import { workspaceApi } from '@/api/workspace'
import type { RoleListItem } from '@/types/role'
import type { ImFriend } from '@/types/im'
import { RoleOptionLabel } from './role-option-label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue, SelectGroup } from '@/components/ui/select'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { resolveMediaUrl } from '@/utils/media-url'

interface InviteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  roles: RoleListItem[]
  onSuccess: () => void
}

function friendDisplayName(friend: ImFriend) {
  return (friend.nickname || friend.username || '').trim() || friend.friendId
}

export function InviteDialog({
  open,
  onOpenChange,
  roles,
  onSuccess,
}: InviteDialogProps) {
  const { t } = useTranslation('settings')
  const [tab, setTab] = useState<'email' | 'friends'>('email')
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState('')
  const [loading, setLoading] = useState(false)

  const [friends, setFriends] = useState<ImFriend[]>([])
  const [friendsLoading, setFriendsLoading] = useState(false)
  const [memberUserIds, setMemberUserIds] = useState<Set<string>>(new Set())
  const [pendingEmails, setPendingEmails] = useState<Set<string>>(new Set())
  const [friendKeyword, setFriendKeyword] = useState('')
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([])

  useEffect(() => {
    if (open && roles.length > 0 && !roleId) {
      setRoleId(String(roles[0].id))
    }
  }, [open, roles, roleId])

  const loadFriendsContext = useCallback(async () => {
    setFriendsLoading(true)
    try {
      const [friendList, memberPage, invitationList] = await Promise.all([
        fetchFriends(),
        workspaceApi.getMembers({ page: 1, size: 500 }),
        workspaceApi.getInvitations(),
      ])
      setFriends(friendList)
      setMemberUserIds(new Set(memberPage.records.map((m) => m.userId)))
      setPendingEmails(
        new Set(
          invitationList
            .filter((inv) => inv.status === 0)
            .map((inv) => inv.email.trim().toLowerCase())
        )
      )
    } catch {
      setFriends([])
      setMemberUserIds(new Set())
      setPendingEmails(new Set())
    } finally {
      setFriendsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      setEmail('')
      setFriendKeyword('')
      setSelectedFriendIds([])
      setTab('email')
      return
    }
    void loadFriendsContext()
  }, [open, loadFriendsContext])

  const invitableFriends = useMemo(() => {
    return friends.filter((friend) => {
      if (memberUserIds.has(friend.friendId)) return false
      const mail = friend.email?.trim().toLowerCase()
      if (!mail) return false
      if (pendingEmails.has(mail)) return false
      return true
    })
  }, [friends, memberUserIds, pendingEmails])

  const filteredInvitableFriends = useMemo(() => {
    const q = friendKeyword.trim().toLowerCase()
    if (!q) return invitableFriends
    return invitableFriends.filter((friend) => {
      const name = friendDisplayName(friend).toLowerCase()
      const username = friend.username.toLowerCase()
      const mail = (friend.email || '').toLowerCase()
      return name.includes(q) || username.includes(q) || mail.includes(q)
    })
  }, [invitableFriends, friendKeyword])

  const selectedFriends = useMemo(
    () =>
      invitableFriends.filter((f) => selectedFriendIds.includes(f.friendId)),
    [invitableFriends, selectedFriendIds]
  )

  const allFilteredSelected =
    filteredInvitableFriends.length > 0 &&
    filteredInvitableFriends.every((f) =>
      selectedFriendIds.includes(f.friendId)
    )

  const toggleFriend = (friendId: string, checked: boolean) => {
    setSelectedFriendIds((prev) =>
      checked ? [...prev, friendId] : prev.filter((id) => id !== friendId)
    )
  }

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      const filteredIds = new Set(
        filteredInvitableFriends.map((f) => f.friendId)
      )
      setSelectedFriendIds((prev) =>
        prev.filter((id) => !filteredIds.has(id))
      )
      return
    }
    const merged = new Set(selectedFriendIds)
    for (const f of filteredInvitableFriends) {
      merged.add(f.friendId)
    }
    setSelectedFriendIds([...merged])
  }

  const roleSelect = (
    <div className='flex flex-col gap-3'>
      <Label htmlFor='role-select'>
        <span className='relative top-0.5 text-destructive'>* </span>
        {t('members.inviteDialog.selectRole')}
      </Label>
      <Select value={roleId} onValueChange={setRoleId} disabled={loading}>
        <SelectTrigger className='a-input set-select-auto w-full [&_[data-slot=select-value]]:line-clamp-none [&_[data-slot=select-value]]:w-full [&_[data-slot=select-value]]:items-start justify-between gap-2 py-2.5 whitespace-normal text-left'>
          <SelectValue
            placeholder={t('members.inviteDialog.selectRolePlaceholder')}
          />
        </SelectTrigger>
        <SelectContent className='max-w-[min(100vw-2rem,22rem)]'>
<SelectGroup>
          {roles.map((role) => (
            <SelectItem
              key={role.id}
              value={String(role.id)}
              className='items-start py-2 [&>span]:items-start'
            >
              <RoleOptionLabel role={role} />
            </SelectItem>
          ))}
        </SelectGroup>
</SelectContent>
      </Select>
    </div>
  )

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !roleId) {
      toast.error(t('members.inviteDialog.fillAll'))
      return
    }

    setLoading(true)
    try {
      await workspaceApi.createInvitation({
        email: email.trim(),
        roleId: Number(roleId),
      })
      toast.success(t('members.inviteDialog.sent'))
      setEmail('')
      onOpenChange(false)
      onSuccess()
    } catch (err: unknown) {
      const handled =
        err &&
        typeof err === 'object' &&
        'handled' in err &&
        (err as { handled?: boolean }).handled
      if (!handled) toast.error(t('members.inviteDialog.sendFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleFriendsSubmit = async () => {
    if (!roleId) {
      toast.error(t('members.inviteDialog.fillAll'))
      return
    }
    if (selectedFriends.length === 0) {
      toast.error(t('members.inviteDialog.pickFriends'))
      return
    }

    setLoading(true)
    try {
      const results = await Promise.allSettled(
        selectedFriends.map((friend) =>
          workspaceApi.createInvitation({
            email: friend.email!.trim(),
            roleId: Number(roleId),
          })
        )
      )
      const ok = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.length - ok
      if (ok > 0) {
        toast.success(t('members.inviteDialog.batchSent', { count: ok }))
        setSelectedFriendIds([])
        onOpenChange(false)
        onSuccess()
      }
      if (failed > 0 && ok === 0) {
        toast.error(t('members.inviteDialog.sendFailed'))
      } else if (failed > 0) {
        toast.warning(t('members.inviteDialog.batchPartial', { failed }))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{t('members.inviteDialog.title')}</DialogTitle>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as 'email' | 'friends')}
          className='w-full'
        >
          <SegmentedControl
            fill
            value={tab}
            onChange={(v) => setTab(v)}
            items={[
              { value: 'email', label: t('members.inviteDialog.tabEmail') },
              { value: 'friends', label: t('members.inviteDialog.tabFriends') },
            ]}
          />

          <TabsContent value='email' className='flex flex-col mt-4 gap-4'>
            <form onSubmit={handleEmailSubmit} className='flex flex-col gap-4'>
              <div className='flex flex-col gap-3'>
                <Label htmlFor='invite-email'>
                  <span className='relative top-0.5 text-destructive'>* </span>
                  {t('members.inviteDialog.email')}
                </Label>
                <div className='relative'>
                  <Mail className='absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-muted' />
                  <Input
                    id='invite-email'
                    type='email'
                    placeholder='user@example.com'
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className='a-input set-input-sm set-input-leading'
                    disabled={loading}
                    required
                  />
                </div>
              </div>
              {roleSelect}
              <DialogFooter className='gap-2 sm:gap-0'>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                >
                  {t('members.inviteDialog.cancel')}
                </Button>
                <Button
                  type='submit'
                  disabled={loading || !email.trim() || !roleId}
                >
                  {loading
                    ? t('members.inviteDialog.sending')
                    : t('members.inviteDialog.send')}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value='friends' className='flex flex-col mt-4 gap-4'>
            {roleSelect}
            <div className='flex flex-col gap-2'>
              <div className='flex items-center justify-between gap-2'>
                <Label>{t('members.inviteDialog.friendsLabel')}</Label>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='h-8 text-xs'
                  disabled={
                    friendsLoading || filteredInvitableFriends.length === 0
                  }
                  onClick={toggleSelectAllFiltered}
                >
                  {allFilteredSelected
                    ? t('members.inviteDialog.deselectAll')
                    : t('members.inviteDialog.selectAll')}
                </Button>
              </div>
              <div className='relative'>
                <Search className='absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-muted' />
                <Input
                  value={friendKeyword}
                  onChange={(e) => setFriendKeyword(e.target.value)}
                  placeholder={t('members.inviteDialog.friendsSearch')}
                  className='a-input set-input-sm set-input-leading'
                  disabled={friendsLoading}
                />
              </div>
              <ScrollArea className='h-56 overflow-hidden rounded-[13px] border border-border'>
                {friendsLoading ? (
                  <div className='flex h-56 items-center justify-center'>
                    <Loader2 className='size-5 animate-spin text-muted-foreground' />
                  </div>
                ) : filteredInvitableFriends.length === 0 ? (
                  <p className='px-3 py-10 text-center text-sm text-muted-foreground'>
                    {t('members.inviteDialog.noFriendsToInvite')}
                  </p>
                ) : (
                  <ul className='divide-y divide-border'>
                    {filteredInvitableFriends.map((friend) => {
                      const name = friendDisplayName(friend)
                      const checked = selectedFriendIds.includes(
                        friend.friendId
                      )
                      return (
                        <li key={friend.friendId}>
                          <label className='flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-surface-hover'>
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) =>
                                toggleFriend(friend.friendId, value === true)
                              }
                            />
                            <Avatar className='size-9 shrink-0'>
                              {friend.avatar ? (
                                <AvatarImage
                                  src={resolveMediaUrl(friend.avatar)}
                                  alt={name}
                                />
                              ) : null}
                              <AvatarFallback className='text-xs'>
                                {name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className='min-w-0 flex-1'>
                              <p className='truncate text-sm font-medium'>
                                {name}
                              </p>
                              <p className='truncate text-xs text-muted-foreground'>
                                {friend.email || friend.username}
                              </p>
                            </div>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </ScrollArea>
              <p className='text-xs text-muted-foreground'>
                {t('members.inviteDialog.friendsHint')}
              </p>
            </div>
            <DialogFooter className='gap-2 sm:gap-0'>
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                {t('members.inviteDialog.cancel')}
              </Button>
              <Button
                type='button'
                disabled={loading || !roleId || selectedFriends.length === 0}
                onClick={() => void handleFriendsSubmit()}
              >
                {loading
                  ? t('members.inviteDialog.sending')
                  : t('members.inviteDialog.sendBatch', {
                      count: selectedFriends.length,
                    })}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
