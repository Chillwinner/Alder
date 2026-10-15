/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BookMarked, Cable, KeyRound, Puzzle, Sparkles, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { aiApi } from '@/api/ai'
import { collectDroppedFiles, isExternalFileDrag } from '@/components/messages/im-drop-files'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue, SelectGroup } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  AI_ENDPOINT_PRESETS,
  matchAiEndpointId,
  matchAiModelId,
  modelsForEndpoint,
  type AiEndpointPresetId,
} from '@/lib/ai-endpoint-presets'
import { cn } from '@/lib/utils'
import { useWorkspaceStore } from '@/store/workspace'

export function WorkspaceAiSettingsForm({ compact: _compact }: { compact?: boolean }) {
  const { t } = useTranslation('settings')
  const queryClient = useQueryClient()
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspaceId)
  const [enabled, setEnabled] = useState(true)
  const [endpointId, setEndpointId] = useState<AiEndpointPresetId>('deepseek')
  const [customUrl, setCustomUrl] = useState('')
  const [modelId, setModelId] = useState('deepseek-flash')
  const [customModel, setCustomModel] = useState('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [clearKey, setClearKey] = useState(false)
  const [selectedStaging, setSelectedStaging] = useState<string[]>([])
  const [ragDragOver, setRagDragOver] = useState(false)
  const stagingInputRef = useRef<HTMLInputElement>(null)
  const ragDragDepth = useRef(0)

  const query = useQuery({
    queryKey: ['workspace-ai-settings', workspaceId],
    queryFn: () => aiApi.getSettings(),
    enabled: Boolean(workspaceId),
  })

  useEffect(() => {
    const data = query.data
    if (!data) return
    const nextEndpoint = matchAiEndpointId(data.baseUrl)
    const nextModel = matchAiModelId(nextEndpoint, data.modelName)
    setEnabled(data.enabled)
    setEndpointId(nextEndpoint)
    setCustomUrl(nextEndpoint === 'custom' ? data.baseUrl : '')
    setModelId(nextModel)
    setCustomModel(nextModel === 'custom' ? data.modelName : '')
    setCustomPrompt(data.customPrompt?.trim() || t('workspaceAi.defaultPrompt'))
    setApiKey('')
    setClearKey(false)
  }, [query.data, t])

  const modelOptions = useMemo(() => modelsForEndpoint(endpointId), [endpointId])

  const resolvedUrl =
    endpointId === 'custom'
      ? customUrl.trim()
      : AI_ENDPOINT_PRESETS.find((p) => p.id === endpointId)?.url ?? ''
  const resolvedModel = modelId === 'custom' ? customModel.trim() : modelId

  const stagingQuery = useQuery({
    queryKey: ['workspace-ai-rag-staging', workspaceId],
    queryFn: () => aiApi.listRagStaging(),
    enabled: Boolean(workspaceId),
  })
  const docsQuery = useQuery({
    queryKey: ['workspace-ai-rag-docs', workspaceId],
    queryFn: () => aiApi.listRagDocs(),
    enabled: Boolean(workspaceId),
  })

  const invalidateRag = () => {
    void queryClient.invalidateQueries({ queryKey: ['workspace-ai-rag-staging', workspaceId] })
    void queryClient.invalidateQueries({ queryKey: ['workspace-ai-rag-docs', workspaceId] })
  }

  const rejectMediaFiles = (files: File[]) => {
    const blocked = /\.(png|jpe?g|gif|webp|svg|ico|bmp|heic|tiff?|mp3|wav|flac|aac|m4a|ogg|wma|opus|aiff|amr|mp4|mov|avi|mkv|webm|m4v|flv|wmv|mpeg|mpg|3gp)$/i
    const mediaMime = /^(image|audio|video)\//i
    const ok: File[] = []
    let rejected = false
    for (const file of files) {
      if (blocked.test(file.name) || mediaMime.test(file.type)) {
        rejected = true
        continue
      }
      ok.push(file)
    }
    if (rejected) toast.error(t('workspaceAi.ragRejectMedia'))
    return ok
  }

  const uploadRag = useMutation({
    mutationFn: async (files: File[]) => {
      const allowed = rejectMediaFiles(files)
      if (!allowed.length) return
      for (const file of allowed) {
        await aiApi.uploadRagStaging(file)
      }
    },
    onSuccess: () => {
      toast.success(t('workspaceAi.ragUploadOk'))
      invalidateRag()
    },
    onError: () => toast.error(t('workspaceAi.saveFailed')),
  })

  const indexRag = useMutation({
    mutationFn: () => aiApi.indexRag(selectedStaging),
    onSuccess: () => {
      setSelectedStaging([])
      invalidateRag()
    },
    onError: () => toast.error(t('workspaceAi.saveFailed')),
  })
  const removeRag = useMutation({
    mutationFn: (fileId: string) => aiApi.removeRag(fileId),
    onSuccess: invalidateRag,
    onError: () => toast.error(t('workspaceAi.saveFailed')),
  })
  const reindexRag = useMutation({
    mutationFn: (fileId: string) => aiApi.reindexRag(fileId),
    onSuccess: invalidateRag,
    onError: () => toast.error(t('workspaceAi.saveFailed')),
  })

  const persistEnabled = useMutation({
    mutationFn: (next: boolean) =>
      aiApi.saveSettings({
        enabled: next,
        baseUrl: query.data?.baseUrl ?? resolvedUrl,
        modelName: query.data?.modelName ?? resolvedModel,
        customPrompt: query.data?.customPrompt ?? customPrompt,
      }),
    onSuccess: async (result) => {
      queryClient.setQueryData(['workspace-ai-settings', workspaceId], result)
      toast.success(t('workspaceAi.saved'))
    },
    onError: (err: { handled?: boolean }, next) => {
      setEnabled(!next)
      queryClient.setQueryData(
        ['workspace-ai-settings', workspaceId],
        (old) => (old ? { ...old, enabled: !next } : old)
      )
      if (!err?.handled) toast.error(t('workspaceAi.saveFailed'))
    },
  })

  const save = useMutation({
    mutationFn: () =>
      aiApi.saveSettings({
        enabled,
        baseUrl: resolvedUrl,
        modelName: resolvedModel,
        customPrompt,
        apiKey: clearKey ? undefined : apiKey.trim() || undefined,
        clearApiKey: clearKey,
      }),
    onSuccess: async () => {
      toast.success(t('workspaceAi.saved'))
      setApiKey('')
      setClearKey(false)
      await queryClient.invalidateQueries({ queryKey: ['workspace-ai-settings', workspaceId] })
    },
    onError: (err: { handled?: boolean }) => {
      if (!err?.handled) toast.error(t('workspaceAi.saveFailed'))
    },
  })

  const data = query.data
  const canEdit = Boolean(data?.canEdit)

  const pickEndpoint = (id: string) => {
    const next = id as AiEndpointPresetId
    setEndpointId(next)
    if (next === 'custom') {
      setModelId('custom')
      return
    }
    const models = modelsForEndpoint(next)
    setModelId(models[0] ?? 'custom')
    setCustomUrl('')
  }

  if (query.isLoading) {
    return <p className='text-sm text-muted-foreground'>{t('common.loading')}</p>
  }
  if (query.isError || !data) {
    return <p className='text-sm text-muted-foreground'>{t('workspaceAi.loadFailed')}</p>
  }

  const keyHint = data.usingWorkspaceKey
    ? t('workspaceAi.apiKeyMasked', { masked: data.apiKeyMasked })
    : data.apiKeyConfigured
      ? t('workspaceAi.apiKeyFallback')
      : t('workspaceAi.apiKeyEmpty')

  const card = 'rounded-[18px] border border-border bg-surface p-4 sm:p-5'
  const icon = 'size-4 text-primary'
  const title = 'text-[15px] font-semibold tracking-tight'
  const hint = 'text-[13px] leading-relaxed text-text-secondary'
  const label = 'text-[12.5px] font-medium text-text-secondary'
  const columnLabel = 'font-mono text-[11px] uppercase tracking-wider text-text-muted'

  return (
    <div className='flex flex-col gap-5'>
      <section className='flex items-center justify-between gap-4 rounded-[18px] border border-border bg-accent-soft px-5 py-3.5'>
        <p className='text-[15px] font-semibold tracking-tight'>{t('workspaceAi.statusKicker')}</p>
          <button
            type='button'
            role='switch'
            aria-checked={enabled}
            aria-label={enabled ? t('workspaceAi.statusOn') : t('workspaceAi.statusOff')}
            disabled={!canEdit || persistEnabled.isPending}
            onClick={() => {
              const next = !enabled
              setEnabled(next)
              queryClient.setQueryData(
                ['workspace-ai-settings', workspaceId],
                (old) => (old ? { ...old, enabled: next } : old)
              )
              persistEnabled.mutate(next)
            }}
            className={cn(
              'relative h-7 w-12 shrink-0 rounded-full transition-colors',
              enabled ? 'bg-primary' : 'bg-surface-3',
              !canEdit && 'opacity-50'
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 size-6 rounded-full bg-background shadow-sm transition-[left]',
                enabled ? 'left-[22px]' : 'left-0.5'
              )}
            />
          </button>
      </section>

      <div className='grid items-start gap-5 lg:grid-cols-12 lg:gap-6'>
        <div className='flex min-w-0 flex-col gap-4 lg:col-span-5'>
          <p className={columnLabel}>
            {t('workspaceAi.columnAssistant')}
          </p>

      <section className={card}>
        <div className='mb-4 flex items-center gap-2'>
          <Zap className={icon} />
          <h3 className={title}>{t('workspaceAi.routeTitle')}</h3>
        </div>
        <div className='grid gap-4 sm:grid-cols-2'>
          <label className='grid gap-1.5'>
            <span className={label}>{t('workspaceAi.endpoint')}</span>
            <Select value={endpointId} onValueChange={pickEndpoint} disabled={!canEdit}>
              <SelectTrigger className='a-input set-select w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
<SelectGroup>
                {AI_ENDPOINT_PRESETS.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {t(`workspaceAi.${preset.labelKey}`)}
                  </SelectItem>
                ))}
                <SelectItem value='custom'>{t('workspaceAi.providerCustom')}</SelectItem>
              </SelectGroup>
</SelectContent>
            </Select>
          </label>
          <label className='grid gap-1.5'>
            <span className={label}>{t('workspaceAi.model')}</span>
            <Select value={modelId} onValueChange={setModelId} disabled={!canEdit}>
              <SelectTrigger className='a-input set-select w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
<SelectGroup>
                {modelOptions.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
                <SelectItem value='custom'>{t('workspaceAi.modelCustom')}</SelectItem>
              </SelectGroup>
</SelectContent>
            </Select>
          </label>
        </div>
        {endpointId === 'custom' ? (
          <label className='mt-4 grid gap-1.5'>
            <span className={label}>
              {t('workspaceAi.customUrl')}
            </span>
            <Input
              value={customUrl}
              disabled={!canEdit}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder='https://'
              className='a-input set-mono'
            />
          </label>
        ) : null}
        {modelId === 'custom' ? (
          <label className='mt-4 grid gap-1.5'>
            <span className={label}>
              {t('workspaceAi.customModel')}
            </span>
            <Input
              value={customModel}
              disabled={!canEdit}
              onChange={(e) => setCustomModel(e.target.value)}
              placeholder='model-id'
              className='a-input set-mono'
            />
          </label>
        ) : null}
      </section>

      <section className={card}>
        <div className='mb-4 flex items-center gap-2'>
          <KeyRound className={icon} />
          <h3 className={title}>{t('workspaceAi.apiKey')}</h3>
        </div>
        <p className={cn('mb-3', hint)}>{keyHint}</p>
        <Input
          type='password'
          autoComplete='off'
          value={apiKey}
          disabled={!canEdit || clearKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={t('workspaceAi.apiKeyPlaceholder')}
          className='a-input set-mono'
        />
        {canEdit && data.usingWorkspaceKey ? (
          <label className='mt-3 flex items-center gap-2 text-sm text-muted-foreground'>
            <Checkbox checked={clearKey} onCheckedChange={(v) => setClearKey(v === true)} />
            {t('workspaceAi.clearKey')}
          </label>
        ) : null}
      </section>

          <section className={card}>
            <div className='mb-2 flex items-center gap-2'>
              <Puzzle className={icon} />
              <h3 className={title}>{t('workspaceAi.skillTitle')}</h3>
            </div>
            <p className={hint}>{t('workspaceAi.skillSoon')}</p>
          </section>

          <section className={card}>
            <div className='mb-2 flex items-center gap-2'>
              <Cable className={icon} />
              <h3 className={title}>{t('workspaceAi.mcpTitle')}</h3>
            </div>
            <p className={hint}>{t('workspaceAi.mcpSoon')}</p>
          </section>

          {canEdit ? (
            <div className='flex justify-end'>
              <Button disabled={save.isPending} onClick={() => save.mutate()}>
                {save.isPending ? t('workspaceAi.saving') : t('workspaceAi.save')}
              </Button>
            </div>
          ) : (
            <p className='text-xs text-muted-foreground'>{t('workspaceAi.readOnly')}</p>
          )}
        </div>

        <div className='flex min-w-0 flex-col gap-4 lg:col-span-7'>
          <p className={columnLabel}>
            {t('workspaceAi.columnCapabilities')}
          </p>

      <section className={card}>
        <div className='mb-4 flex items-center gap-2'>
          <Sparkles className={icon} />
          <h3 className={title}>{t('workspaceAi.prompt')}</h3>
        </div>
        <p className={cn('mb-3', hint)}>{t('workspaceAi.promptDesc')}</p>
        <Textarea
          value={customPrompt}
          disabled={!canEdit}
          onChange={(e) => setCustomPrompt(e.target.value)}
          rows={6}
          placeholder={t('workspaceAi.promptPlaceholder')}
          className='a-input set-textarea min-h-[8rem] resize-y'
        />
      </section>

      <section
        className={cn(
          card,
          canEdit && ragDragOver && 'border-primary/40 bg-surface-hover'
        )}
        onDragEnter={(event: DragEvent) => {
          if (!canEdit || uploadRag.isPending || !isExternalFileDrag(event)) return
          event.preventDefault()
          event.stopPropagation()
          ragDragDepth.current += 1
          setRagDragOver(true)
        }}
        onDragOver={(event: DragEvent) => {
          if (!canEdit || uploadRag.isPending || !isExternalFileDrag(event)) return
          event.preventDefault()
          event.stopPropagation()
          event.dataTransfer.dropEffect = 'copy'
        }}
        onDragLeave={(event: DragEvent) => {
          if (!canEdit || !isExternalFileDrag(event)) return
          event.preventDefault()
          event.stopPropagation()
          ragDragDepth.current -= 1
          if (ragDragDepth.current <= 0) {
            ragDragDepth.current = 0
            setRagDragOver(false)
          }
        }}
        onDrop={(event: DragEvent) => {
          if (!canEdit || uploadRag.isPending || !isExternalFileDrag(event)) return
          event.preventDefault()
          event.stopPropagation()
          ragDragDepth.current = 0
          setRagDragOver(false)
          const { files, skippedFolders } = collectDroppedFiles(event)
          if (skippedFolders.length) toast.error(t('workspaceAi.ragDropSkipFolder'))
          if (files.length) uploadRag.mutate(files)
        }}
      >
        <div className='mb-4 flex items-center gap-2'>
          <BookMarked className={icon} />
          <h3 className={title}>{t('workspaceAi.ragTitle')}</h3>
        </div>
        <p className={cn('mb-4', hint)}>{t('workspaceAi.ragDesc')}</p>
        {canEdit ? (
          <div className='mb-4'>
            <input
              ref={stagingInputRef}
              type='file'
              multiple
              accept='.txt,.md,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.json,.xml,.html,.htm,.rtf,.odt'
              className='hidden'
              onChange={(e) => {
                const files = Array.from(e.target.files ?? [])
                e.target.value = ''
                if (files.length) uploadRag.mutate(files)
              }}
            />
            <Button
              type='button'
              size='sm'
              variant='outline'
              disabled={uploadRag.isPending}
              onClick={() => stagingInputRef.current?.click()}
            >
              {uploadRag.isPending ? t('workspaceAi.ragUploading') : t('workspaceAi.ragUpload')}
            </Button>
            <p className={cn('mt-2', hint)}>{t('workspaceAi.ragDropHint')}</p>
          </div>
        ) : null}
        <div className='grid gap-5'>
          <div>
            <p className={cn('mb-2', columnLabel)}>{t('workspaceAi.ragStaging')}</p>
            {stagingQuery.data?.length ? (
              <ul className='flex flex-col gap-2'>
                {stagingQuery.data.map((file) => (
                  <li
                    key={file.fileId}
                    className='flex items-start gap-2.5 rounded-[13px] border border-border bg-surface-secondary/60 px-3 py-2.5 text-sm transition-colors duration-150 hover:bg-surface-hover'
                  >
                    <Checkbox
                      disabled={!canEdit}
                      checked={selectedStaging.includes(file.fileId)}
                      onCheckedChange={(v) => {
                        setSelectedStaging((prev) =>
                          v === true
                            ? [...prev, file.fileId]
                            : prev.filter((id) => id !== file.fileId)
                        )
                      }}
                    />
                    <span className='min-w-0'>
                      <span className='block truncate font-medium'>{file.displayName}</span>
                      {file.indexed ? (
                        <span className='font-mono text-[11px] tabular-nums text-muted-foreground'>
                          {t('workspaceAi.ragIndexedBadge', { count: file.chunkCount ?? 0 })}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={hint}>{t('workspaceAi.ragEmptyStaging')}</p>
            )}
            {canEdit ? (
              <Button
                className='mt-3'
                size='sm'
                disabled={!selectedStaging.length || indexRag.isPending}
                onClick={() => indexRag.mutate()}
              >
                {t('workspaceAi.ragIndex')}
              </Button>
            ) : null}
          </div>
          <div>
            <p className={cn('mb-2', columnLabel)}>{t('workspaceAi.ragIndexed')}</p>
            {docsQuery.data?.length ? (
              <ul className='flex flex-col gap-2'>
                {docsQuery.data.map((file) => (
                  <li
                    key={file.fileId}
                    className='flex items-center justify-between gap-2 rounded-[13px] border border-border bg-surface-secondary/60 px-3 py-2 text-sm transition-colors duration-150 hover:bg-surface-hover'
                  >
                    <span className='min-w-0 truncate'>
                      {file.displayName}
                      <span className='ml-1 font-mono text-[11px] tabular-nums text-muted-foreground'>
                        {t('workspaceAi.ragIndexedBadge', { count: file.chunkCount ?? 0 })}
                      </span>
                    </span>
                    {canEdit ? (
                      <span className='flex shrink-0 gap-1'>
                        <Button
                          size='sm'
                          variant='ghost'
                          disabled={reindexRag.isPending}
                          onClick={() => reindexRag.mutate(file.fileId)}
                        >
                          {t('workspaceAi.ragReindex')}
                        </Button>
                        <Button
                          size='sm'
                          variant='ghost'
                          disabled={removeRag.isPending}
                          onClick={() => removeRag.mutate(file.fileId)}
                        >
                          {t('workspaceAi.ragRemove')}
                        </Button>
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={hint}>{t('workspaceAi.ragEmptyIndexed')}</p>
            )}
          </div>
        </div>
      </section>
        </div>
      </div>
    </div>
  )
}
