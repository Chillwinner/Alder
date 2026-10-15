import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Globe, HardDrive, KeyRound, Mail, Radio, Server } from 'lucide-react'
import { siteSettingsApi, type SiteSettings } from '@/api/site-settings'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  SettingsPageDescription,
  SettingsPageEyebrow,
  SettingsPageTitle,
} from '../components/settings-page-header'
import {
  SettingsBlock,
  SettingsGroup,
  SettingsRow,
} from '../components/settings-row'

function emptySettings(): SiteSettings {
  return {
    mailEnable: true,
    mailHost: '',
    mailPort: '465',
    mailUsername: '',
    mailPasswordSet: false,
    mailFrom: '',
    mailSsl: true,
    frontendDomain: '',
    corsOrigins: '',
    localBasePath: '',
    localBaseUrl: '',
    turnHost: '',
    turnPort: '3478',
    turnSecretSet: false,
    turnTtlSeconds: '86400',
    jwtSecretSet: false,
    jwtNeedsRestart: true,
    postgresHint: '',
    redisHint: '',
  }
}

export function SettingsSite() {
  const { t } = useTranslation('settings')
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<SiteSettings>(emptySettings)
  const [mailPassword, setMailPassword] = useState('')
  const [turnSecret, setTurnSecret] = useState('')
  const [jwtSecret, setJwtSecret] = useState('')
  const [boxPassword, setBoxPassword] = useState('')
  const [includeJwt, setIncludeJwt] = useState(false)
  const [includeOss, setIncludeOss] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const patch = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  useEffect(() => {
    siteSettingsApi
      .get()
      .then((data) => setForm(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const next = await siteSettingsApi.update({
        mailEnable: form.mailEnable,
        mailHost: form.mailHost,
        mailPort: form.mailPort,
        mailUsername: form.mailUsername,
        mailPassword: mailPassword || undefined,
        mailFrom: form.mailFrom,
        mailSsl: form.mailSsl,
        frontendDomain: form.frontendDomain,
        corsOrigins: form.corsOrigins,
        localBasePath: form.localBasePath,
        localBaseUrl: form.localBaseUrl,
        turnHost: form.turnHost,
        turnPort: form.turnPort,
        turnAuthSecret: turnSecret || undefined,
        turnTtlSeconds: form.turnTtlSeconds,
        jwtSecret: jwtSecret || undefined,
      })
      setForm(next)
      setMailPassword('')
      setTurnSecret('')
      setJwtSecret('')
      toast.success(t('site.saved'))
    } finally {
      setSaving(false)
    }
  }

  const exportBox = async () => {
    if (boxPassword.trim().length < 8) return
    const res = await siteSettingsApi.exportBox({
      password: boxPassword,
      includeJwt,
      includeOss,
    })
    const blob = new Blob([res.box], { type: 'application/octet-stream' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = res.filename || 'alder-site.box'
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success(t('site.exported'))
  }

  const importBox = async (file: File) => {
    if (boxPassword.trim().length < 8) return
    const box = await file.text()
    const next = await siteSettingsApi.importBox({ password: boxPassword, box })
    setForm(next)
    toast.success(t('site.imported'))
  }

  if (loading) {
    return <p className='text-sm text-muted-foreground'>{t('common.loading')}</p>
  }

  return (
    <div className='flex flex-col gap-8'>
      <header className='flex flex-col gap-1.5'>
        <SettingsPageEyebrow>{t('site.kicker')}</SettingsPageEyebrow>
        <SettingsPageTitle>{t('site.pageTitle')}</SettingsPageTitle>
        <SettingsPageDescription>{t('site.pageDescription')}</SettingsPageDescription>
      </header>

      <SettingsGroup label={t('site.mail')}>
        <SettingsRow label={t('site.mailEnable')} icon={Mail} tone='blue'>
          <Checkbox
            checked={form.mailEnable}
            onCheckedChange={(v) => patch('mailEnable', v === true)}
          />
        </SettingsRow>
        <SettingsBlock label={t('site.mailHost')}>
          <Input className='a-input' value={form.mailHost} onChange={(e) => patch('mailHost', e.target.value)} />
        </SettingsBlock>
        <SettingsBlock label={t('site.mailPort')}>
          <Input className='a-input' value={form.mailPort} onChange={(e) => patch('mailPort', e.target.value)} />
        </SettingsBlock>
        <SettingsBlock label={t('site.mailUser')}>
          <Input className='a-input' value={form.mailUsername} onChange={(e) => patch('mailUsername', e.target.value)} />
        </SettingsBlock>
        <SettingsBlock label={t('site.mailPassword')} description={form.mailPasswordSet ? t('site.mailPasswordPh') : undefined}>
          <Input
            className='a-input'
            type='password'
            autoComplete='new-password'
            value={mailPassword}
            placeholder={t('site.mailPasswordPh')}
            onChange={(e) => setMailPassword(e.target.value)}
          />
        </SettingsBlock>
        <SettingsBlock label={t('site.mailFrom')}>
          <Input className='a-input' value={form.mailFrom} onChange={(e) => patch('mailFrom', e.target.value)} />
        </SettingsBlock>
        <SettingsRow label={t('site.mailSsl')}>
          <Checkbox checked={form.mailSsl} onCheckedChange={(v) => patch('mailSsl', v === true)} />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup label={t('site.public')}>
        <SettingsBlock label={t('site.frontend')} description={t('site.frontendHint')} icon={Globe} tone='teal'>
          <Input className='a-input' value={form.frontendDomain} onChange={(e) => patch('frontendDomain', e.target.value)} />
        </SettingsBlock>
        <SettingsBlock label={t('site.cors')} description={t('site.corsHint')}>
          <Input className='a-input' value={form.corsOrigins} onChange={(e) => patch('corsOrigins', e.target.value)} />
        </SettingsBlock>
      </SettingsGroup>

      <SettingsGroup label={t('site.disk')}>
        <SettingsBlock label={t('site.localPath')} icon={HardDrive} tone='orange'>
          <Input className='a-input' value={form.localBasePath} onChange={(e) => patch('localBasePath', e.target.value)} />
        </SettingsBlock>
        <SettingsBlock label={t('site.localUrl')} description={t('site.localHint')}>
          <Input className='a-input' value={form.localBaseUrl} onChange={(e) => patch('localBaseUrl', e.target.value)} />
        </SettingsBlock>
      </SettingsGroup>

      <SettingsGroup label={t('site.turn')}>
        <SettingsBlock label={t('site.turnHost')} icon={Radio} tone='purple'>
          <Input className='a-input' value={form.turnHost} onChange={(e) => patch('turnHost', e.target.value)} />
        </SettingsBlock>
        <SettingsBlock label={t('site.turnPort')}>
          <Input className='a-input' value={form.turnPort} onChange={(e) => patch('turnPort', e.target.value)} />
        </SettingsBlock>
        <SettingsBlock label={t('site.turnSecret')} description={form.turnSecretSet ? t('site.mailPasswordPh') : undefined}>
          <Input
            className='a-input'
            type='password'
            autoComplete='new-password'
            value={turnSecret}
            placeholder={t('site.mailPasswordPh')}
            onChange={(e) => setTurnSecret(e.target.value)}
          />
        </SettingsBlock>
        <SettingsBlock label={t('site.turnTtl')}>
          <Input className='a-input' value={form.turnTtlSeconds} onChange={(e) => patch('turnTtlSeconds', e.target.value)} />
        </SettingsBlock>
      </SettingsGroup>

      <SettingsGroup label={t('site.jwt')} note={t('site.jwtHint')}>
        <SettingsBlock label={t('site.jwtSecret')} icon={KeyRound} tone='red'>
          <Input
            className='a-input'
            type='password'
            autoComplete='new-password'
            value={jwtSecret}
            placeholder={t('site.mailPasswordPh')}
            onChange={(e) => setJwtSecret(e.target.value)}
          />
        </SettingsBlock>
      </SettingsGroup>

      <SettingsGroup label={t('site.hints')}>
        <SettingsRow label={t('site.postgres')} icon={Server} tone='neutral' value={form.postgresHint || '—'} />
        <SettingsRow label={t('site.redis')} value={form.redisHint || '—'} />
      </SettingsGroup>

      <SettingsGroup label={t('site.box')} note={t('site.boxHint')}>
        <SettingsBlock label={t('site.boxPassword')}>
          <Input
            className='a-input'
            type='password'
            autoComplete='new-password'
            value={boxPassword}
            onChange={(e) => setBoxPassword(e.target.value)}
          />
        </SettingsBlock>
        <SettingsRow label={t('site.includeJwt')}>
          <Checkbox checked={includeJwt} onCheckedChange={(v) => setIncludeJwt(v === true)} />
        </SettingsRow>
        <SettingsRow label={t('site.includeOss')}>
          <Checkbox checked={includeOss} onCheckedChange={(v) => setIncludeOss(v === true)} />
        </SettingsRow>
        <div className='flex flex-wrap gap-2 px-4 pb-4'>
          <Button type='button' variant='outline' onClick={exportBox} disabled={boxPassword.trim().length < 8}>
            {t('site.export')}
          </Button>
          <Button
            type='button'
            variant='outline'
            onClick={() => fileRef.current?.click()}
            disabled={boxPassword.trim().length < 8}
          >
            {t('site.import')}
          </Button>
          <input
            ref={fileRef}
            type='file'
            accept='.box,text/plain'
            className='hidden'
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void importBox(file)
            }}
          />
        </div>
      </SettingsGroup>

      <div>
        <Button type='button' onClick={save} disabled={saving}>
          {t('site.save')}
        </Button>
      </div>
    </div>
  )
}
