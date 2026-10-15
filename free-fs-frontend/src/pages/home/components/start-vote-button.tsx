/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { Vote } from 'lucide-react'
import { toast } from 'sonner'
import { workspaceApi } from '@/api/workspace'
import { createWorkspaceVote } from '@/api/vote'
import { notifyHeaderNotificationsChanged } from '@/hooks/use-header-notifications'
import { UserAvatar } from '@/components/user-avatar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { translateServerText } from '@/i18n'
import { cn } from '@/lib/utils'
import type { WorkspaceMember } from '@/types/workspace'

function memberLabel(member: { nickname?: string | null; username?: string | null }) {
  return member.nickname?.trim() || member.username?.trim() || ''
}

export function StartVoteButton() {
  const { t } = useTranslation('home')
  const { t: tBoard } = useTranslation('board')
  const { slug = '' } = useParams()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [selected, setSelected] = useState<string[]>([])

  const membersQuery = useQuery({
    queryKey: ['workspace-members', slug, 'home-vote'],
    queryFn: () => workspaceApi.getMembers({ page: 1, size: 200 }),
    enabled: open,
  })

  const createVote = useMutation({
    mutationFn: () => createWorkspaceVote(title.trim(), selected),
    onSuccess: async () => {
      toast.success(tBoard('vote.created'))
      setOpen(false)
      setTitle('')
      setSelected([])
      await queryClient.invalidateQueries({ queryKey: ['workspace-votes', slug] })
      notifyHeaderNotificationsChanged()
    },
    onError: (cause: unknown) => {
      toast.error(
        cause instanceof Error
          ? translateServerText(cause.message, tBoard('vote.createFailed'))
          : tBoard('vote.createFailed')
      )
    },
  })

  const members = membersQuery.data?.records ?? []

  return (
    <>
      {/*
        ⚠️ 这里原来用 shadcn 的 <Button size='sm' variant='ghost'> + 一串自定义类
        （h-8 rounded-md bg-accent-soft），与旁边用 .a-btn 的「上传 / 邀请」
        尺寸和圆角都不同 —— 用户反馈"发起投票样式和其他按钮不一样"。

        统一走 .a-btn 原语：高度、圆角、字号、hover 全部与兄弟按钮一致。
        用 --ghost 变体（和「邀请」相同），三个按钮形成
        「主操作实心 + 两个次要幽灵」的正确层次。
      */}
      <button
        type='button'
        className='a-btn a-btn--ghost'
        onClick={() => setOpen(true)}
      >
        <Vote strokeWidth={1.9} />
        {t('welcome.vote')}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>{tBoard('vote.create')}</DialogTitle>
            <DialogDescription>{tBoard('vote.createHint')}</DialogDescription>
          </DialogHeader>
          <Input
            value={title}
            maxLength={200}
            placeholder={tBoard('vote.titlePlaceholder')}
            onChange={(event) => setTitle(event.target.value)}
          />
          <div className='flex flex-col max-h-64 overflow-auto pr-1 gap-1'>
            {members.map((member: WorkspaceMember) => {
              const checked = selected.includes(member.userId)
              const name = memberLabel(member)
              return (
                <label
                  key={member.userId}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors duration-150 hover:bg-surface-hover',
                    checked && 'bg-surface-secondary'
                  )}
                >
                  <UserAvatar name={name} avatar={member.avatar} size={36} className='rounded-full' />
                  <span className='min-w-0 flex-1 truncate font-medium'>{name}</span>
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => {
                      setSelected((current) =>
                        value === true
                          ? [...current, member.userId]
                          : current.filter((id) => id !== member.userId)
                      )
                    }}
                  />
                </label>
              )
            })}
          </div>
          <DialogFooter>
            <Button
              type='button'
              disabled={createVote.isPending || title.trim().length === 0 || selected.length === 0}
              onClick={() => createVote.mutate()}
            >
              {tBoard('vote.publish')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
