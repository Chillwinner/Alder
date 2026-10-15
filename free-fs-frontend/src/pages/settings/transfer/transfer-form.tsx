/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { InfoCircledIcon } from '@radix-ui/react-icons'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { userApi } from '@/api/user'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue, SelectGroup } from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  SettingsBlock,
  SettingsGroup,
  SettingsRow,
} from '../components/settings-row'
import {
  Download,
  Folder,
  FolderCheck,
  Gauge,
  Layers,
  Timer,
  Upload,
} from 'lucide-react'

// 路径格式校验
const validatePath = (value: string) => {
  if (!value || !value.trim()) {
    return false
  }

  const path = value.trim()

  const windowsAbsolutePathRegex =
    /^[a-zA-Z]:\\([\w\s\u4e00-\u9fa5\-().]+\\)*[\w\s\u4e00-\u9fa5\-().]*$/
  const windowsNetworkPathRegex =
    /^\\\\[\w\-.]+(\[\w\s\u4e00-\u9fa5\-().]+)+(\[\w\s\u4e00-\u9fa5\-().]+)*$/

  const unixPathRegex = /^\/[\w\s\u4e00-\u9fa5\-./]*$/

  const isWindowsPath =
    windowsAbsolutePathRegex.test(path) || windowsNetworkPathRegex.test(path)
  const isUnixPath = unixPathRegex.test(path)

  if (!isWindowsPath && !isUnixPath) {
    return false
  }

  if (isWindowsPath) {
    const illegalChars = /[<>"|?*]/
    const pathWithoutDrive = path.substring(path.indexOf(':') + 1)
    if (illegalChars.test(pathWithoutDrive)) {
      return false
    }
  }

  return true
}

type TransferFormValues = {
  downloadLocation: string
  isDefaultDownloadLocation: boolean
  enableDownloadSpeedLimit: boolean
  downloadSpeedLimit?: number
  concurrentUploadQuantity: number
  concurrentDownloadQuantity: number
  chunkSize: number
}

export function TransferForm() {
  const { t } = useTranslation('settings')
  const transferFormSchema = useMemo(
    () =>
      z.object({
        downloadLocation: z
          .string()
          .min(1, t('transfer.validation.downloadRequired'))
          .refine(validatePath, t('transfer.validation.pathInvalid')),
        isDefaultDownloadLocation: z.boolean(),
        enableDownloadSpeedLimit: z.boolean(),
        downloadSpeedLimit: z.number().min(1).max(200).optional(),
        concurrentUploadQuantity: z.number().min(1).max(3),
        concurrentDownloadQuantity: z.number().min(1).max(3),
        chunkSize: z.number(),
      }),
    [t]
  )

  const [loading, setLoading] = useState(false)

  const form = useForm<TransferFormValues>({
    resolver: zodResolver(transferFormSchema),
    defaultValues: {
      downloadLocation: '',
      isDefaultDownloadLocation: false,
      enableDownloadSpeedLimit: false,
      downloadSpeedLimit: 5,
      concurrentUploadQuantity: 3,
      concurrentDownloadQuantity: 3,
      chunkSize: 5 * 1024 * 1024,
    },
  })

  const enableSpeedLimit = form.watch('enableDownloadSpeedLimit')

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    setLoading(true)
    try {
      const settings = await userApi.getTransferSetting()

      form.reset({
        downloadLocation: settings.downloadLocation || '',
        isDefaultDownloadLocation: settings.isDefaultDownloadLocation === 1,
        enableDownloadSpeedLimit: settings.downloadSpeedLimit > 0,
        downloadSpeedLimit:
          settings.downloadSpeedLimit > 0 ? settings.downloadSpeedLimit : 5,
        concurrentUploadQuantity: settings.concurrentUploadQuantity || 3,
        concurrentDownloadQuantity: settings.concurrentDownloadQuantity || 3,
        chunkSize: settings.chunkSize || 5 * 1024 * 1024,
      })
    } catch {
      toast.error(t('transfer.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form {...form}>
      <div className='pointer-events-none' aria-disabled>
        <SettingsGroup
          label={t('transfer.pageTitle')}
          description={t('transfer.pageDescription')}
          action={<span className='a-tag a-tag--accent'>{t('nav.transfer')}</span>}
        >
          <FormField
            control={form.control}
            name='downloadLocation'
            render={({ field }) => (
              <FormItem className='contents'>
                <SettingsBlock
                  icon={Folder}
                  tone='blue'
                  label={t('transfer.downloadLocation')}
                  description={t('transfer.downloadLocationDesc')}
                >
                  <div className='flex w-full min-w-0 items-center gap-2'>
                    <FormControl>
                      <Input
                        placeholder={t('transfer.downloadLocationPlaceholder')}
                        className='a-input set-mono min-w-0 flex-1'
                        {...field}
                        onChange={field.onChange}
                        disabled={loading}
                      />
                    </FormControl>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type='button'
                            variant='outline'
                            size='icon'
                            className='shrink-0'
                          >
                            <InfoCircledIcon />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side='left' className='max-w-xs'>
                          <p>{t('transfer.pathHintTitle')}</p>
                          <p>{t('transfer.pathHintWin')}</p>
                          <p>{t('transfer.pathHintUnix')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </SettingsBlock>
                <FormMessage className='px-5 pb-3' />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='isDefaultDownloadLocation'
            render={({ field }) => (
              <FormItem className='contents'>
                <SettingsRow
                  icon={FolderCheck}
                  tone='green'
                  label={t('transfer.defaultPath')}
                  description={t('transfer.defaultPathDesc')}
                >
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className='size-5'
                      disabled={loading}
                    />
                  </FormControl>
                </SettingsRow>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='enableDownloadSpeedLimit'
            render={({ field }) => (
              <FormItem className='contents'>
                <SettingsRow
                  icon={Gauge}
                  tone='amber'
                  label={t('transfer.speedLimit')}
                  description={t('transfer.speedLimitDesc')}
                >
                  <FormControl>
                    <RadioGroup
                      onValueChange={(value: string) => {
                        field.onChange(value === 'true')
                      }}
                      value={field.value ? 'true' : 'false'}
                      className='flex flex-row flex-wrap items-center justify-end gap-5'
                      disabled={loading}
                    >
                      <label className='flex cursor-pointer items-center gap-2'>
                        <RadioGroupItem value='false' id='speed-off' />
                        <span className='text-sm'>{t('transfer.unlimited')}</span>
                      </label>
                      <label className='flex cursor-pointer items-center gap-2'>
                        <RadioGroupItem value='true' id='speed-on' />
                        <span className='text-sm'>{t('transfer.capped')}</span>
                      </label>
                    </RadioGroup>
                  </FormControl>
                </SettingsRow>
              </FormItem>
            )}
          />

          {enableSpeedLimit && (
            <FormField
              control={form.control}
              name='downloadSpeedLimit'
              render={({ field }) => (
                <FormItem className='contents'>
                  <SettingsRow
                    icon={Timer}
                    tone='orange'
                    label={t('transfer.speedValue')}
                    description={t('transfer.speedValueDesc')}
                  >
                    <div className='flex items-center gap-2'>
                      <FormControl>
                        <Input
                          type='number'
                          min={1}
                          max={200}
                          className='a-input set-input-sm set-mono w-24'
                          {...field}
                          onChange={(e) => {
                            field.onChange(Number(e.target.value))
                          }}
                          onBlur={field.onBlur}
                          disabled={loading}
                        />
                      </FormControl>
                      <span className='shrink-0 font-mono text-xs text-text-muted'>
                        MB/s
                      </span>
                    </div>
                  </SettingsRow>
                  <FormMessage className='px-5 pb-3' />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name='concurrentUploadQuantity'
            render={({ field }) => (
              <FormItem className='contents'>
                <SettingsRow
                  icon={Upload}
                  tone='teal'
                  label={t('transfer.concurrentUpload')}
                  description={t('transfer.concurrentUploadDesc')}
                >
                  <Select
                    onValueChange={(value) => {
                      field.onChange(Number(value))
                    }}
                    value={String(field.value)}
                    disabled={loading}
                  >
                    <FormControl>
                      <SelectTrigger className='a-input set-select w-[116px]'>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
<SelectGroup>
                      {[1, 2, 3].map((num) => (
                        <SelectItem key={num} value={String(num)}>
                          {t('transfer.unitCount', { count: num })}
                        </SelectItem>
                      ))}
                    </SelectGroup>
</SelectContent>
                  </Select>
                </SettingsRow>
                <FormMessage className='px-5 pb-3' />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='concurrentDownloadQuantity'
            render={({ field }) => (
              <FormItem className='contents'>
                <SettingsRow
                  icon={Download}
                  tone='purple'
                  label={t('transfer.concurrentDownload')}
                  description={t('transfer.concurrentDownloadDesc')}
                >
                  <Select
                    onValueChange={(value) => {
                      field.onChange(Number(value))
                    }}
                    value={String(field.value)}
                    disabled={loading}
                  >
                    <FormControl>
                      <SelectTrigger className='a-input set-select w-[116px]'>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
<SelectGroup>
                      {[1, 2, 3].map((num) => (
                        <SelectItem key={num} value={String(num)}>
                          {t('transfer.unitCount', { count: num })}
                        </SelectItem>
                      ))}
                    </SelectGroup>
</SelectContent>
                  </Select>
                </SettingsRow>
                <FormMessage className='px-5 pb-3' />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='chunkSize'
            render={({ field }) => (
              <FormItem className='contents'>
                <SettingsRow
                  icon={Layers}
                  tone='neutral'
                  label={t('transfer.chunkSize')}
                  description={t('transfer.chunkSizeDesc')}
                >
                  <Select
                    onValueChange={(value) => {
                      field.onChange(Number(value))
                    }}
                    value={String(field.value)}
                    disabled={loading}
                  >
                    <FormControl>
                      <SelectTrigger className='a-input set-select set-mono w-[116px]'>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
<SelectGroup>
                      <SelectItem value={String(2 * 1024 * 1024)}>2 MB</SelectItem>
                      <SelectItem value={String(5 * 1024 * 1024)}>5 MB</SelectItem>
                      <SelectItem value={String(10 * 1024 * 1024)}>
                        10 MB
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
      </div>
    </Form>
  )
}
