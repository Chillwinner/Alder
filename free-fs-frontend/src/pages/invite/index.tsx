/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { displayRoleName } from '@/utils/role-label'
import { invitationApi } from '@/api/invitation'
import { useAuth } from '@/contexts/auth-context'
import { useWorkspaceStore } from '@/store/workspace'
import type { InvitationDetail } from '@/types/invitation'
import { Logo } from '@/components/logo'
import { toast } from 'sonner'
import { Loader2, Mail, UserCheck, AlertCircle } from 'lucide-react'

/** 独立页统一底：环境光 + 居中 */
const pageShell =
  'relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background px-4 py-12'

function Ambient() {
  return <div aria-hidden='true' className='a-ambient absolute inset-0 z-0' />
}

function BrandLine() {
  return (
    <div className='a-brandline absolute top-7 left-7 z-10'>
      <span className='a-brandline__mark'>
        <Logo className='size-[18px]' />
      </span>
      <span className='a-brandline__name'>Alder</span>
    </div>
  )
}

export default function InvitePage() {
  const { t } = useTranslation('invite')
  const { t: tSettings } = useTranslation('settings')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isAuthenticated, user, loadWorkspaces, activateWorkspace } = useAuth()
  const token = searchParams.get('token')

  const [loading, setLoading] = useState(true)
  const [invitation, setInvitation] = useState<InvitationDetail | null>(null)
  const [error, setError] = useState<string>('')
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    if (!token) {
      setError(t('invalidLink'))
      setLoading(false)
      return
    }

    loadInvitation()
  }, [token])

  // 加载邀请信息
  const loadInvitation = async () => {
    try {
      setLoading(true)
      const invitationData = await invitationApi.verifyInvitation(token!)

      setInvitation(invitationData)

      // 根据用户是否存在，决定下一步操作
      handleInvitationFlow(invitationData)
    } catch (err: any) {
      setError(err.message || t('verifyFailed'))
    } finally {
      setLoading(false)
    }
  }

  // 处理邀请流程
  const handleInvitationFlow = (invitationData: InvitationDetail) => {
    // 情况1：用户不存在，需要注册
    if (!invitationData.userExists) {
      // 跳转到注册页面，携带邀请信息
      navigate(
        `/login?type=register&token=${token}&email=${encodeURIComponent(invitationData.email)}`
      )
      return
    }

    // 情况2：用户已存在但未登录
    if (!isAuthenticated) {
      // 未登录，引导登录
      navigate(
        `/login?redirect=${encodeURIComponent(`/invite?token=${token}`)}&email=${encodeURIComponent(invitationData.email)}`
      )
      return
    }

    // 情况3：已登录，验证邮箱是否匹配
    if (user?.email !== invitationData.email) {
      setError(
        t('emailMismatch', {
          currentEmail: user?.email,
          inviteEmail: invitationData.email,
        })
      )
      return
    }

    // 邮箱匹配，可以接受邀请
  }

  // 接受邀请
  const handleAcceptInvitation = async () => {
    if (!token) return

    try {
      setAccepting(true)
      await invitationApi.acceptInvitation(token)

      toast.success(t('acceptSuccess'))

      // 接受成功，刷新工作空间列表（因为用户刚加入新工作空间）
      const hasWorkspaces = await loadWorkspaces()

      if (hasWorkspaces) {
        // 获取最新的工作空间列表
        const { workspaces, currentWorkspaceId } = useWorkspaceStore.getState()

        // 如果当前没有激活的工作空间，或者工作空间列表发生变化，激活第一个
        if (!currentWorkspaceId || workspaces.length > 0) {
          const targetWorkspace = workspaces[0]
          if (targetWorkspace) {
            await activateWorkspace(targetWorkspace.id)
            // 跳转到新加入的工作空间
            navigate(`/w/${targetWorkspace.slug}/`, { replace: true })
            return
          }
        }
      }

      // 兜底：跳转到首页（会触发 RootRedirect）
      navigate('/', { replace: true })
    } catch (err: any) {
      toast.error(err.message || t('acceptFailed'))
    } finally {
      setAccepting(false)
    }
  }

  // 渲染加载状态
  if (loading) {
    return (
      <div className={pageShell}>
        <Ambient />
        <BrandLine />
        <div className='a-glass tech-rise relative z-10 flex w-full max-w-md flex-col items-center gap-4 rounded-[28px] px-10 py-14 text-center'>
          <Loader2 className='size-7 animate-spin text-primary' />
          <p className='text-[13.5px] text-text-secondary'>{t('loading')}</p>
        </div>
      </div>
    )
  }

  // 渲染错误状态
  if (error) {
    return (
      <div className={pageShell}>
        <Ambient />
        <BrandLine />
        <div className='a-glass tech-rise relative z-10 w-full max-w-md rounded-[28px] px-8 py-12 text-center md:px-10'>
          <span className='mx-auto mb-6 flex size-14 items-center justify-center rounded-[18px] bg-destructive/10 text-destructive'>
            <AlertCircle className='size-7' strokeWidth={1.7} />
          </span>
          <p className='tech-eyebrow'>{t('workspaceInvitation')}</p>
          <h1 className='mt-2 text-[30px] leading-tight font-semibold tracking-tight'>
            {t('invalidInvite')}
          </h1>
          <p className='mx-auto mt-3 max-w-sm text-[14px] leading-relaxed text-text-secondary'>
            {error}
          </p>
          <button
            className='a-btn a-btn--primary a-btn--block mt-8'
            onClick={() => navigate('/')}
          >
            {t('backToHome')}
          </button>
        </div>
      </div>
    )
  }

  // 渲染邀请详情
  const workspaceInitial = (invitation?.workspaceName || 'A').trim().slice(0, 1)
  const roleLabel = displayRoleName(tSettings, invitation ?? {})
  // 统计条是三列窄格：这里只放日期，避免整串时间被 truncate 成省略号
  const expireText = invitation?.expiresAt
    ? dayjs(invitation.expiresAt).format('YYYY-MM-DD')
    : '-'

  return (
    <div className={pageShell}>
      <Ambient />
      <BrandLine />

      <div className='a-glass tech-rise relative z-10 w-full max-w-lg overflow-hidden rounded-[32px] px-7 py-10 text-center md:px-10 md:py-12'>
        {/* 空间标识 */}
        <span className='mx-auto mb-6 flex size-16 items-center justify-center rounded-[22px] bg-primary text-[26px] leading-none font-semibold text-primary-foreground shadow-lg'>
          {workspaceInitial}
        </span>

        <p className='tech-eyebrow'>{t('workspaceInvitation')}</p>
        <h1 className='mt-2 text-[32px] leading-tight font-semibold tracking-tight'>
          {invitation?.workspaceName || t('workspaceInvitation')}
        </h1>
        <p className='mx-auto mt-3 max-w-sm text-[14.5px] leading-relaxed text-text-secondary'>
          {t('dockSubtitle', {
            inviter: invitation?.inviterName,
            workspace: invitation?.workspaceName,
          })}
        </p>

        {/* 三段数据条：外层托盘 + 内层玻璃的同心圆角 */}
        <div className='mt-7 grid grid-cols-3 divide-x divide-divider overflow-hidden rounded-[18px] border border-border bg-surface-secondary/60'>
          <div className='px-3 py-3.5'>
            <p className='font-mono text-[11px] tracking-wider text-text-muted uppercase'>
              {t('joinWorkspace')}
            </p>
            <p className='mt-1.5 truncate text-[14px] font-semibold tracking-tight'>
              {invitation?.workspaceName || '-'}
            </p>
          </div>
          <div className='px-3 py-3.5'>
            <p className='font-mono text-[11px] tracking-wider text-text-muted uppercase'>
              {t('invitedBy')}
            </p>
            <p className='mt-1.5 truncate text-[14px] font-semibold tracking-tight'>
              {invitation?.inviterName || '-'}
            </p>
          </div>
          <div className='px-3 py-3.5'>
            <p className='font-mono text-[11px] tracking-wider text-text-muted uppercase'>
              {t('expiresAt')}
            </p>
            <p className='mt-1.5 truncate font-mono text-[12.5px] tabular-nums'>
              {expireText}
            </p>
          </div>
        </div>

        {/* 明细行 */}
        <div className='mt-4 divide-y divide-divider overflow-hidden rounded-[18px] border border-border bg-surface-secondary/60 text-left'>
          <div className='flex items-center gap-3 px-4 py-3.5'>
            <span className='flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-accent-soft text-primary'>
              <UserCheck className='size-[17px]' strokeWidth={1.8} />
            </span>
            <span className='min-w-0 flex-1'>
              <span className='block text-[13px] text-text-secondary'>
                {t('yourRole')}
              </span>
              <span className='mt-0.5 block text-[12px] text-text-muted'>
                邀请人指定
              </span>
            </span>
            <span className='a-tag a-tag--accent shrink-0'>{roleLabel}</span>
          </div>

          <div className='flex items-center gap-3 px-4 py-3.5'>
            <span className='flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-accent-soft text-primary'>
              <Mail className='size-[17px]' strokeWidth={1.8} />
            </span>
            <span className='min-w-0 flex-1'>
              <span className='block text-[13px] text-text-secondary'>
                {t('inviteEmail')}
              </span>
              <span className='mt-0.5 block text-[12px] text-text-muted'>
                与你当前账号一致
              </span>
            </span>
            <span className='min-w-0 truncate font-mono text-[12.5px] tabular-nums text-text-secondary'>
              {invitation?.email || '-'}
            </span>
          </div>
        </div>

        {/* 操作 */}
        <div className='mt-7 grid grid-cols-2 gap-3'>
          <button
            className='a-btn a-btn--ghost a-btn--block'
            onClick={() => navigate('/')}
            disabled={accepting}
          >
            {t('cancel')}
          </button>
          <button
            className='a-btn a-btn--primary a-btn--block'
            onClick={handleAcceptInvitation}
            disabled={accepting}
          >
            {accepting ? (
              <>
                <Loader2 className='size-4 animate-spin' />
                {t('processing')}
              </>
            ) : (
              t('acceptInvite')
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
