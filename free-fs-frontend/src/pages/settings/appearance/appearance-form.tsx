/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import React from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { getAppLang, type AppLang } from '@/i18n'
import { syncWbroomLangFromApp } from '@/lib/sync-wbroom-lang'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue, SelectGroup } from '@/components/ui/select'
import { useSidebar } from '@/components/ui/sidebar'
import { LAYOUT_STORAGE_KEY } from '@/components/layout/app-layout'
import { useTheme } from '@/components/theme-provider'
import {
  Languages,
  Monitor,
  Moon,
  PanelLeft,
  PanelLeftClose,
  Sun,
} from 'lucide-react'
import { SettingsGroup, SettingsRow } from '../components/settings-row'

type AppearanceFormValues = {
  theme: 'light' | 'dark' | 'system'
  language: AppLang
  layout: 'default' | 'compact'
}

function getInitialLayout(): 'default' | 'compact' {
  if (typeof window === 'undefined') return 'default'
  return (
    localStorage.getItem(LAYOUT_STORAGE_KEY) === 'compact'
      ? 'compact'
      : 'default'
  ) as 'default' | 'compact'
}

export function AppearanceForm() {
  const { t } = useTranslation('settings')
  const { i18n } = useTranslation()
  const { theme, setTheme } = useTheme()
  const { setOpen, open } = useSidebar()

  const appearanceFormSchema = React.useMemo(
    () =>
      z.object({
        theme: z.enum(['light', 'dark', 'system'], {
          message: t('appearance.validation.theme'),
        }),
        language: z.enum(['zh', 'zh-HK', 'en'], {
          message: t('appearance.validation.language'),
        }),
        layout: z.enum(['default', 'compact'], {
          message: t('appearance.validation.layout'),
        }),
      }),
    [t]
  )

  const form = useForm<AppearanceFormValues>({
    resolver: zodResolver(appearanceFormSchema),
    defaultValues: {
      theme: theme === 'dark' || theme === 'light' || theme === 'system' ? theme : 'system',
      language: getAppLang(),
      layout: getInitialLayout(),
    },
  })

  // 语言从别处切换（如登录页）后同步到表单
  React.useEffect(() => {
    form.setValue('language', getAppLang())
  }, [i18n.language, form])

  // 监听主题变化，同步更新表单
  React.useEffect(() => {
    if (theme === 'light' || theme === 'dark' || theme === 'system') {
      form.setValue('theme', theme)
    }
  }, [theme, form])

  // 监听侧边栏状态变化，同步更新表单
  React.useEffect(() => {
    const currentLayout = open ? 'default' : 'compact'
    form.setValue('layout', currentLayout)
  }, [open, form])

  // 监听 localStorage 变化（跨标签页同步）
  React.useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === LAYOUT_STORAGE_KEY && e.newValue) {
        const newLayout = e.newValue === 'compact' ? 'compact' : 'default'
        form.setValue('layout', newLayout)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [form])

  const handleThemeChange = (nextTheme: 'light' | 'dark' | 'system') => {
    setTheme(nextTheme, false)
    toast.success(t('appearance.themeUpdated'))
  }

  const handleLayoutChange = (layout: 'default' | 'compact') => {
    localStorage.setItem(LAYOUT_STORAGE_KEY, layout)
    setOpen(layout === 'default')
    toast.success(t('appearance.layoutUpdated'))
  }

  const handleLanguageChange = async (lang: AppLang) => {
    await i18n.changeLanguage(lang)
    syncWbroomLangFromApp()
    // changeLanguage 完成后再用 i18n.t，否则 toast 仍是切换前的语言
    toast.success(
      i18n.t('appearance.languageUpdated', { ns: 'settings' })
    )
  }

  const themeTiles: {
    value: AppearanceFormValues['theme']
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
    label: string
  }[] = [
    { value: 'light', icon: Sun, label: t('appearance.light') },
    { value: 'dark', icon: Moon, label: t('appearance.dark') },
    { value: 'system', icon: Monitor, label: t('appearance.system') },
  ]

  const layoutTiles: {
    value: AppearanceFormValues['layout']
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
    label: string
  }[] = [
    { value: 'default', icon: PanelLeft, label: t('appearance.layoutDefault') },
    { value: 'compact', icon: PanelLeftClose, label: t('appearance.layoutCompact') },
  ]

  return (
    <Form {...form}>
      <div className='flex flex-col'>
        <SettingsGroup
          label={t('nav.preference')}
          description={t('appearance.pageDescription')}
          action={<span className='a-tag a-tag--accent'>{t('appearance.pageTitle')}</span>}
        >
          <FormField
            control={form.control}
            name='language'
            render={({ field }) => (
              <FormItem className='contents'>
                <SettingsRow
                  icon={Languages}
                  tone='blue'
                  label={t('appearance.languageLabel')}
                  description={t('appearance.languageDescription')}
                >
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value)
                      void handleLanguageChange(value as AppLang)
                    }}
                  >
                    <FormControl>
                      <SelectTrigger className='a-input set-select w-[168px]'>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
<SelectGroup>
                      <SelectItem value='zh'>
                        {t('appearance.langZh')}
                      </SelectItem>
                      <SelectItem value='zh-HK'>
                        {t('appearance.langZhHK')}
                      </SelectItem>
                      <SelectItem value='en'>
                        {t('appearance.langEn')}
                      </SelectItem>
                    </SelectGroup>
</SelectContent>
                  </Select>
                </SettingsRow>
                <FormMessage className='px-5 pb-3' />
              </FormItem>
            )}
          />
        </SettingsGroup>

        <SettingsGroup
          label={t('appearance.themeLabel')}
          description={t('appearance.themeDescription')}
          action={<span className='a-tag'>{t('appearance.themeLabel')}</span>}
        >
          <FormField
            control={form.control}
            name='theme'
            render={({ field }) => (
              <FormItem className='contents'>
                <div className='set-field'>
                  <RadioGroup
                    aria-label={t('appearance.themeLabel')}
                    onValueChange={(value) => {
                      field.onChange(value)
                      handleThemeChange(value as 'light' | 'dark' | 'system')
                    }}
                    value={field.value}
                    className='grid w-full grid-cols-3 gap-2.5'
                  >
                    {themeTiles.map((tile) => {
                      const Icon = tile.icon
                      return (
                        <FormItem key={tile.value} className='contents'>
                          <FormLabel className='set-tile'>
                            <FormControl>
                              <RadioGroupItem
                                value={tile.value}
                                className='sr-only'
                              />
                            </FormControl>
                            <Icon className='size-5' strokeWidth={1.85} aria-hidden />
                            <span>{tile.label}</span>
                          </FormLabel>
                        </FormItem>
                      )
                    })}
                  </RadioGroup>
                </div>
                <FormMessage className='px-5 pb-3' />
              </FormItem>
            )}
          />
        </SettingsGroup>

        <SettingsGroup
          label={t('appearance.layoutLabel')}
          description={t('appearance.layoutDescription')}
          action={<span className='a-tag'>{t('appearance.layoutLabel')}</span>}
        >
          <FormField
            control={form.control}
            name='layout'
            render={({ field }) => (
              <FormItem className='contents'>
                <div className='set-field'>
                  <RadioGroup
                    aria-label={t('appearance.layoutLabel')}
                    onValueChange={(value) => {
                      field.onChange(value)
                      handleLayoutChange(value as 'default' | 'compact')
                    }}
                    value={field.value}
                    className='grid w-full grid-cols-2 gap-2.5'
                  >
                    {layoutTiles.map((tile) => {
                      const Icon = tile.icon
                      return (
                        <FormItem key={tile.value} className='contents'>
                          <FormLabel className='set-tile'>
                            <FormControl>
                              <RadioGroupItem
                                value={tile.value}
                                className='sr-only'
                              />
                            </FormControl>
                            <Icon className='size-5' strokeWidth={1.85} aria-hidden />
                            <span>{tile.label}</span>
                          </FormLabel>
                        </FormItem>
                      )
                    })}
                  </RadioGroup>
                </div>
                <FormMessage className='px-5 pb-3' />
              </FormItem>
            )}
          />
        </SettingsGroup>
      </div>
    </Form>
  )
}
