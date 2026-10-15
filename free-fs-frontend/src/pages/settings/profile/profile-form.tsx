/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, PlusIcon, UserRound } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'
import { userApi } from '@/api/user'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar'
import { resolveMediaUrl } from '@/utils/media-url'

type ProfileFormValues = { nickname: string }

function initialsFromNickname(nickname: string) {
  const t = nickname.trim()
  if (!t) return '?'
  return t.length >= 2 ? t.slice(0, 2).toUpperCase() : t.toUpperCase()
}

export function ProfileForm() {
  const { t } = useTranslation('settings')
  const { user, updateUser } = useAuth()
  const [loading, setLoading] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const initializedRef = useRef(false)

  const profileFormSchema = useMemo(
    () =>
      z.object({
        nickname: z
          .string()
          .min(2, t('profile.validation.nicknameMin'))
          .max(20, t('profile.validation.nicknameMax')),
      }),
    [t]
  )

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      nickname: '',
    },
  })

  useEffect(() => {
    if (user?.nickname && !initializedRef.current) {
      form.reset({
        nickname: user.nickname,
      })
      initializedRef.current = true
    }
  }, [user?.nickname, form])

  async function saveChanges(data: ProfileFormValues) {
    if (!user) return

    setLoading(true)
    try {
      await userApi.updateUserInfo({
        nickname: data.nickname,
      })
      const fresh = await userApi.getUserInfo()
      updateUser(fresh)

      toast.success(t('profile.saved'))
    } catch (error) {
      toast.error(t('profile.saveFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleNicknameBlur = async () => {
    const values = form.getValues()
    const ok = await form.trigger('nickname')
    if (!ok || !user) return
    if (values.nickname === user.nickname) return
    await saveChanges(values)
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !user) return
    if (file.type && !file.type.startsWith('image/')) {
      toast.error(t('profile.imageOnly'))
      return
    }
    setAvatarUploading(true)
    try {
      await userApi.uploadAvatar(file)
      const fresh = await userApi.getUserInfo()
      updateUser(fresh)
      toast.success(t('profile.avatarUpdated'))
    } catch {
      toast.error(t('profile.uploadFailed'))
    } finally {
      setAvatarUploading(false)
    }
  }

  return (
    <Form {...form}>
      <div className='flex flex-col'>
        <div className='set-row set-row--start' data-settings-row=''>
          <div className='flex shrink-0 flex-col items-center gap-2 sm:items-start sm:pt-0.5'>
            <input
              ref={avatarInputRef}
              type='file'
              accept='image/*'
              className='sr-only'
              onChange={handleAvatarChange}
              disabled={avatarUploading || loading}
            />
            <button
              type='button'
              className='group relative shrink-0 rounded-full border-0 bg-transparent p-0 outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50'
              disabled={avatarUploading || loading}
              onClick={() => avatarInputRef.current?.click()}
              aria-label={t('profile.uploadAvatarAria')}
            >
              <span className='relative inline-flex size-16 shrink-0'>
                <Avatar className='size-16 bg-surface-secondary'>
                  {user?.avatar ? (
                    <AvatarImage src={resolveMediaUrl(user.avatar)} alt='' />
                  ) : null}
                  <AvatarFallback className='text-lg font-medium'>
                    {user?.nickname ? initialsFromNickname(user.nickname) : '?'}
                  </AvatarFallback>
                </Avatar>
                <span
                  className='pointer-events-none absolute inset-0 z-1 rounded-full bg-background/65 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-disabled:opacity-0'
                  aria-hidden
                />
                <span
                  className='pointer-events-none absolute right-0 bottom-0 z-10 flex size-6 items-center justify-center rounded-full border-2 border-surface bg-primary text-primary-foreground shadow-sm'
                  aria-hidden
                >
                  <PlusIcon className='size-3' />
                </span>
              </span>
              {avatarUploading && (
                <div className='pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-background/70'>
                  <Loader2 className='size-6 animate-spin text-muted-foreground' />
                </div>
              )}
            </button>
          </div>

          <div className='set-row__body justify-center self-center'>
            <span className='text-[17px] font-semibold tracking-[-0.02em] text-foreground'>
              {user?.nickname || '—'}
            </span>
            <span className='set-row__desc set-row__desc--mono'>
              {user?.email || t('account.notSet')}
            </span>
          </div>
        </div>

        <FormField
          control={form.control}
          name='nickname'
          render={({ field }) => (
            <FormItem className='contents'>
              <div className='set-row set-row--hover' data-settings-row=''>
                <span
                  data-settings-row-icon=''
                  className='set-row__ico set-row__ico--blue'
                >
                  <UserRound className='size-4' strokeWidth={1.9} aria-hidden />
                </span>
                <div className='set-row__body'>
                  <FormLabel className='set-row__title'>
                    {t('profile.nickname')}
                  </FormLabel>
                  <span className='set-row__desc'>
                    {t('profile.nicknameHint')}
                    {loading && (
                      <span className='ps-2 text-text-muted'>
                        {t('profile.saving')}
                      </span>
                    )}
                  </span>
                </div>
                <div className='set-row__control'>
                  <FormControl>
                    <Input
                      placeholder={t('profile.nicknamePlaceholder')}
                      className='a-input set-input-sm w-[180px] sm:w-[220px]'
                      {...field}
                      onBlur={() => {
                        field.onBlur()
                        void handleNicknameBlur()
                      }}
                      disabled={loading}
                    />
                  </FormControl>
                </div>
              </div>
              <FormMessage className='px-5 pb-3' />
            </FormItem>
          )}
        />
      </div>
    </Form>
  )
}
