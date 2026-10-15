/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Building2, Link2 } from 'lucide-react'
import { workspaceApi } from '@/api/workspace'
import { useWorkspaceStore } from '@/store/workspace'
import { useAuth } from '@/contexts/auth-context'
import type { Workspace } from '@/types/workspace'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Logo } from '@/components/logo'

function slugFromUsername(username?: string) {
  const base = username || ''
  return base
    ? `${base
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '')}-ws`
    : ''
}

export default function NewWorkspacePage() {
  const { t } = useTranslation('workspace')
  const navigate = useNavigate()
  const { loadWorkspaces, activateWorkspace, user } = useAuth()
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const uname = user?.nickname || user?.username
  const { defaultName, defaultSlug } = useMemo(() => {
    const slug = slugFromUsername(uname)
    const name = uname ? t('new.defaultName', { name: uname }) : ''
    return { defaultName: name, defaultSlug: slug }
  }, [uname, t])

  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)

  useEffect(() => {
    setName(defaultName)
    setSlug(defaultSlug)
    setSlugTouched(false)
  }, [defaultName, defaultSlug])

  const handleNameChange = (value: string) => {
    setName(value)
    if (!slugTouched) {
      setSlug(
        value
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, '-')
          .replace(/^-+|-+$/g, '')
      )
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !slug.trim()) {
      toast.error(t('new.toastFill'))
      return
    }

    setLoading(true)
    try {
      const created: Workspace = await workspaceApi.create({
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
      })
      toast.success(t('new.toastSuccess'))
      await loadWorkspaces()
      await activateWorkspace(created.id)
      navigate(`/w/${created.slug}/`)
    } catch (err: any) {
      if (!err?.handled) toast.error(t('new.toastFail'))
    } finally {
      setLoading(false)
    }
  }

  const canGoBack = workspaces.length > 0

  return (
    <div className='relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background px-4 py-14'>
      <div aria-hidden='true' className='a-ambient absolute inset-0 z-0' />

      <div className='a-brandline absolute top-7 left-7 z-10'>
        <span className='a-brandline__mark'>
          <Logo className='size-[18px]' />
        </span>
        <span className='a-brandline__name'>Alder</span>
      </div>

      <div className='a-glass tech-rise relative z-10 w-full max-w-md rounded-[32px] px-7 py-9 md:px-9 md:py-10'>
        {/* 步骤条：纯装饰，只表示「第一步」 */}
        <div className='mb-7 flex items-center justify-center gap-2' aria-hidden='true'>
          <span className='h-1.5 w-8 rounded-full bg-primary' />
          <span className='h-1.5 w-8 rounded-full bg-surface-3' />
          <span className='h-1.5 w-8 rounded-full bg-surface-3' />
        </div>

        <div className='text-center'>
          <p className='tech-eyebrow'>新建工作空间</p>
          <h1 className='mt-2 text-[30px] leading-tight font-semibold tracking-tight'>
            {t('new.title')}
          </h1>
          <p className='mx-auto mt-3 max-w-sm text-[13.5px] leading-relaxed text-text-secondary'>
            {t('new.subtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className='flex flex-col mt-8 gap-4'>
          <div className='a-field'>
            <label htmlFor='ws-name'>{t('new.nameLabel')}</label>
            <div className='a-input'>
              <Building2 className='size-[18px]' strokeWidth={1.8} />
              <Input
                id='ws-name'
                placeholder={t('new.namePlaceholder')}
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                disabled={loading}
                required
                autoFocus
                className='h-full rounded-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0'
              />
            </div>
          </div>

          <div className='a-field'>
            <label htmlFor='ws-slug'>{t('new.slugLabel')}</label>
            <div className='a-input'>
              <Link2 className='size-[18px]' strokeWidth={1.8} />
              <span className='shrink-0 font-mono text-[13px] text-text-muted'>
                alder.app/w/
              </span>
              <Input
                id='ws-slug'
                placeholder={t('new.slugPlaceholder')}
                value={slug}
                className='h-full rounded-none border-0 bg-transparent px-0 font-mono shadow-none focus-visible:ring-0'
                onChange={(e) => {
                  setSlugTouched(true)
                  setSlug(e.target.value)
                }}
                disabled={loading}
                required
              />
            </div>
            <p className='pl-1 font-mono text-[11.5px] leading-relaxed tracking-wide text-text-muted'>
              {t('new.slugHint')}
            </p>
          </div>

          <div className='a-field'>
            <label htmlFor='ws-desc'>{t('new.descLabel')}</label>
            <div className='rounded-[13px] bg-surface-secondary p-1 transition-colors focus-within:bg-surface focus-within:ring-2 focus-within:ring-primary/35'>
              <Textarea
                id='ws-desc'
                placeholder={t('new.descPlaceholder')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading}
                rows={3}
                className='min-h-[84px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0'
              />
            </div>
          </div>

          <div className={canGoBack ? 'grid grid-cols-2 gap-3 pt-2' : 'pt-2'}>
            {canGoBack && (
              <button
                type='button'
                className='a-btn a-btn--ghost a-btn--block'
                onClick={() => navigate('/')}
                disabled={loading}
              >
                {t('new.back')}
              </button>
            )}
            <button
              type='submit'
              className='a-btn a-btn--primary a-btn--block'
              disabled={loading}
            >
              {loading ? t('new.submitting') : t('new.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
