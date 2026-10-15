/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Smile } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

const COMMON_EMOJIS = [
  '😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😜',
  '🤔', '😏', '🙄', '😴', '😢', '😭', '😡', '🤯',
  '😎', '🥳', '😇', '🤗', '🤭', '🤫', '😱', '🥺',
  '👍', '👎', '👏', '🙏', '💪', '👋', '🤝', '✌️',
  '❤️', '💔', '💯', '✨', '🎉', '🔥', '👀', '💩',
  '🐶', '🐱', '🌹', '☀️', '🌙', '⭐', '🍺', '🍻',
]

type ImEmojiPickerProps = {
  onPick: (emoji: string) => void
  disabled?: boolean
  className?: string
}

export function ImEmojiPicker({ onPick, disabled, className }: ImEmojiPickerProps) {
  const { t } = useTranslation('messages')
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          disabled={disabled}
          className={cn('im-iconbtn', className)}
          aria-label={t('room.emoji')}
        >
          <Smile strokeWidth={1.7} />
        </Button>
      </PopoverTrigger>
      <PopoverContent side='top' align='end' className='w-[268px] rounded-[18px] p-2.5'>
        <div className='im-emoji'>
          {COMMON_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type='button'
              className='im-emoji__key'
              onClick={() => {
                onPick(emoji)
                setOpen(false)
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
