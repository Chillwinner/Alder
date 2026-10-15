/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import type { FileCollection } from '@/types/collection'
import { UserAvatar } from '@/components/user-avatar'
import { NotificationDismissButton } from '@/components/layout/notification-dismiss-button'
import { Button } from '@/components/ui/button'

export function CollectionAskCard({
  item,
  onDismiss,
  onSubmit,
}: {
  item: FileCollection
  onDismiss: () => void
  onSubmit: () => void
}) {
  const { t } = useTranslation('layout')
  const { user } = useAuth()
  const people = item.assignees ?? []
  const done = people.filter((person) => person.submitted).length
  const total = people.length
  const pct = total ? (done / total) * 100 : 0
  const mineDone = people.some((person) => person.userId === user?.id && person.submitted)

  return (
    <li className='relative rounded-lg border bg-card px-2.5 py-2 pr-8'>
      <NotificationDismissButton label={t('header.notifications.dismiss')} onClick={onDismiss} />
      <p className='text-sm font-medium'>{item.collectionName}</p>
      <p className='mt-0.5 text-xs text-muted-foreground'>{t('header.notifications.collectionAssigned')}</p>
      {total > 0 ? (
        <>
          <div className='mt-2 h-1.5 overflow-hidden rounded-full bg-muted'>
            <div className='h-full bg-success' style={{ width: `${pct}%` }} />
          </div>
          <p className='mt-1.5 text-xs text-muted-foreground'>
            {t('header.notifications.collectionProgress', { done, total })}
          </p>
          <div className='mt-2 flex flex-wrap gap-2'>
            {people.map((person) => (
              <div key={person.userId} className='flex w-12 flex-col items-center gap-1'>
                <div className='relative'>
                  <UserAvatar name={person.name} size={28} className='rounded-full' />
                  {person.submitted ? (
                    <span className='absolute -right-0.5 -bottom-0.5 flex size-3.5 items-center justify-center rounded-full bg-success text-white'>
                      <Check className='size-2' strokeWidth={3} />
                    </span>
                  ) : null}
                </div>
                <span className='w-full truncate text-center text-[10px] text-muted-foreground'>
                  {person.name}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}
      <Button
        type='button'
        size='sm'
        className='mt-2 h-7 w-full text-xs'
        disabled={mineDone}
        onClick={onSubmit}
      >
        {mineDone ? t('header.notifications.collectionSubmitted') : t('header.notifications.collectionSubmit')}
      </Button>
    </li>
  )
}
