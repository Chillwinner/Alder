/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createImGroup, fetchFriends, uploadGroupAvatar } from '@/api/im'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { translateServerText } from '@/i18n'
import { resolveMediaUrl } from '@/utils/media-url'
import { useImStore } from '@/store/im'
import type { ImFriend } from '@/types/im'
import { displayUserName } from './im-utils'

export function ImCreateGroupDialog() {
  const { t } = useTranslation('messages')
  const open = useImStore((state) => state.createGroupOpen)
  const closeCreateGroup = useImStore((state) => state.closeCreateGroup)
  const selectConversation = useImStore((state) => state.selectConversation)

  const [name, setName] = useState('')
  const [notice, setNotice] = useState('')
  const [avatarPath, setAvatarPath] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [friends, setFriends] = useState<ImFriend[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loadingFriends, setLoadingFriends] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const resetForm = useCallback(() => {
    setName('')
    setNotice('')
    setAvatarPath(null)
    setSelectedIds([])
  }, [])

  const loadFriends = useCallback(async () => {
    setLoadingFriends(true)
    try {
      setFriends(await fetchFriends())
    } catch {
      setFriends([])
    } finally {
      setLoadingFriends(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    resetForm()
    void loadFriends()
  }, [open, loadFriends, resetForm])

  const toggleFriend = (friendId: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...prev, friendId] : prev.filter((id) => id !== friendId)
    )
  }

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.type && !file.type.startsWith('image/')) {
      toast.error(t('group.imageOnly'))
      return
    }
    setAvatarUploading(true)
    try {
      const result = await uploadGroupAvatar(file)
      setAvatarPath(result.path)
    } catch (cause) {
      toast.error(cause instanceof Error ? translateServerText(cause.message) : t('group.uploadFailed'))
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleSubmit = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      toast.error(t('group.nameRequired'))
      return
    }
    setSubmitting(true)
    try {
      const group = await createImGroup({
        name: trimmedName,
        avatar: avatarPath || undefined,
        notice: notice.trim() || undefined,
        memberIds: selectedIds,
      })
      toast.success(t('group.created'))
      closeCreateGroup()
      selectConversation(group.conversationId)
      window.dispatchEvent(new CustomEvent('im:connected'))
    } catch (cause) {
      toast.error(cause instanceof Error ? translateServerText(cause.message) : t('group.createFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const avatarInitial = name.trim().slice(0, 1).toUpperCase() || '?'

  return (
    <Dialog open={open} onOpenChange={(next) => !next && closeCreateGroup()}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('group.create')}</DialogTitle>
        </DialogHeader>

        <div className='flex flex-col gap-4'>
          <div className='flex items-center gap-4'>
            <button
              type='button'
              className='relative shrink-0 rounded-full outline-none transition-shadow duration-150 hover:ring-2 hover:ring-primary/40 focus-visible:ring-2 focus-visible:ring-ring'
              disabled={avatarUploading}
              onClick={() => avatarInputRef.current?.click()}
            >
              <Avatar className='size-16'>
                {avatarPath ? <AvatarImage src={resolveMediaUrl(avatarPath)} alt='' /> : null}
                <AvatarFallback className='bg-accent-soft text-lg font-semibold text-primary'>
                  {avatarInitial}
                </AvatarFallback>
              </Avatar>
              {avatarUploading && (
                <span className='absolute inset-0 flex items-center justify-center rounded-full bg-background/70'>
                  <Loader2 className='size-5 animate-spin text-muted-foreground' />
                </span>
              )}
            </button>
            <div className='flex flex-col min-w-0 flex-1 gap-1'>
              <p className='text-sm font-medium'>{t('group.avatar')}</p>
              <p className='text-xs leading-relaxed text-muted-foreground'>{t('group.avatarHint')}</p>
            </div>
            <input
              ref={avatarInputRef}
              type='file'
              accept='image/*'
              className='hidden'
              onChange={(event) => void handleAvatarChange(event)}
            />
          </div>

          <div className='flex flex-col gap-2'>
            <Label htmlFor='group-name'>{t('group.name')}</Label>
            <Input
              id='group-name'
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('group.namePlaceholder')}
              maxLength={128}
            />
          </div>

          <div className='flex flex-col gap-2'>
            <Label htmlFor='group-notice'>{t('group.notice')}</Label>
            <Textarea
              id='group-notice'
              value={notice}
              onChange={(event) => setNotice(event.target.value)}
              placeholder={t('group.noticePlaceholder')}
              maxLength={512}
              rows={3}
            />
          </div>

          <div className='flex flex-col gap-2'>
            <Label>{t('group.members')}</Label>
            <ScrollArea className='h-40 rounded-[14px] border border-divider'>
              {loadingFriends ? (
                <p className='p-3 text-center text-[13.5px] text-muted-foreground'>{t('loading')}</p>
              ) : friends.length === 0 ? (
                <p className='p-3 text-center text-[13.5px] leading-relaxed text-muted-foreground'>{t('group.noFriends')}</p>
              ) : (
                <ul className=''>
                  {friends.map((friend) => {
                    const checked = selectedIds.includes(friend.friendId)
                    return (
                      <li key={friend.friendId}>
                        <label className='flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors duration-150 hover:bg-surface-hover'>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) => toggleFriend(friend.friendId, value === true)}
                          />
                          <span className='min-w-0 flex-1 truncate text-sm'>{displayUserName(friend)}</span>
                          <span className='shrink-0 font-mono text-[11px] text-muted-foreground'>{friend.username}</span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => closeCreateGroup()}>
            {t('group.cancel')}
          </Button>
          <Button type='button' disabled={submitting || avatarUploading} onClick={() => void handleSubmit()}>
            {submitting ? <Loader2 className='size-4 animate-spin' /> : t('group.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
