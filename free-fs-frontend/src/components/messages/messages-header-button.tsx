/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useTranslation } from 'react-i18next'
import { MessageCircle } from 'lucide-react'
import { HeaderAlertBadge } from '@/components/layout/header-alert-badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { fetchImUnreadTotal } from '@/api/im'
import { useAuth } from '@/contexts/auth-context'
import { useHeaderCountAlert } from '@/hooks/use-header-count-alert'
import { primeNotificationAudio } from '@/lib/notification-chime'
import { cn } from '@/lib/utils'
import { useImStore } from '@/store/im'

export function MessagesHeaderButton() {
  const { t } = useTranslation('layout')
  const { isAuthenticated } = useAuth()
  const open = useImStore((state) => state.dialogOpen)
  const openDialog = useImStore((state) => state.openDialog)
  const closeDialog = useImStore((state) => state.closeDialog)
  const unreadTotal = useImStore((state) => state.unreadTotal)
  const setUnreadTotal = useImStore((state) => state.setUnreadTotal)

  const alerting = useHeaderCountAlert(
    unreadTotal,
    isAuthenticated && !open
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className={cn(
            'relative size-8 text-muted-foreground hover:bg-accent hover:text-foreground',
            open && 'bg-accent text-foreground',
            alerting && 'header-alert-shake text-destructive'
          )}
          onPointerDown={() => primeNotificationAudio()}
          onClick={() => {
            if (open) {
              closeDialog()
              return
            }
            void fetchImUnreadTotal()
              .then((result) => setUnreadTotal(result.total))
              .catch(() => undefined)
            openDialog()
          }}
          aria-label={t('header.messages')}
        >
          <MessageCircle className='size-[18px]' strokeWidth={1.75} />
          <HeaderAlertBadge count={unreadTotal} alerting={alerting} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{t('header.messages')}</p>
      </TooltipContent>
    </Tooltip>
  )
}
