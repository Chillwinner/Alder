/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useTranslation } from 'react-i18next'
import {
  Search,
  Upload,
  FolderPlus,
  RefreshCw,
  FolderUp,
  ClipboardPaste,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RequirePermission } from '@/components/require-permission'

interface ToolbarProps {
  searchKeyword: string
  onSearchChange: (keyword: string) => void
  onSearch: (keyword: string) => void
  onUpload: () => void
  onUploadDirectory?: () => void
  onCreateFolder: () => void
  onRefresh: () => void
  onPaste?: () => void
  clipboardItemCount?: number
  pasting?: boolean
  hideActions?: boolean
  /** 上传已提升到页头（demo 的 .a-phead__right），这里不再重复渲染 */
  hideUpload?: boolean
}

/*
  demo 的内容区工具条：左侧圆角内嵌搜索框，右侧一组胶囊按钮。
  这里只重排版式与视觉，onSearch / onRefresh / onPaste / onCreateFolder
  的调用点与顺序保持原样。
*/
export function Toolbar({
  searchKeyword,
  onSearchChange,
  onSearch,
  onUpload,
  onUploadDirectory,
  onCreateFolder,
  onRefresh,
  onPaste,
  clipboardItemCount = 0,
  pasting = false,
  hideActions = false,
  hideUpload = false,
}: ToolbarProps) {
  const { t } = useTranslation('files')
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearch(searchKeyword)
    }
  }

  const pillClass = 'a-btn a-btn--sm a-btn--ghost rounded-xl border-0 shadow-none'

  return (
    <div className='flex min-w-0 flex-wrap items-center justify-end gap-2.5'>
      {/* demo 的搜索胶囊：全圆角 + 内嵌图标，聚焦时整颗胶囊亮起 */}
      <div className='group relative min-w-0 flex-1 sm:w-[268px] sm:flex-none'>
        <Search
          className='pointer-events-none absolute top-1/2 left-3.5 size-3.5 -translate-y-1/2 text-text-muted transition-colors group-focus-within:text-primary'
          strokeWidth={1.9}
        />
        <Input
          placeholder={t('toolbar.searchPlaceholder')}
          value={searchKeyword}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          className='h-9 rounded-full border border-border/50 bg-surface-3 pl-9 text-[13px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] transition-[background-color,border-color,box-shadow] duration-200 placeholder:text-text-muted hover:bg-surface-hover focus-visible:border-primary/70 focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-accent-soft'
        />
      </div>

      {/* demo 的液态胶囊按钮组：整组落在一条玻璃轨道上，而不是散落的独立按钮 */}
      <div className='flex shrink-0 items-center gap-0.5 rounded-2xl border border-border/50 bg-surface-secondary/60 p-1 backdrop-blur-xl'>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='size-8 shrink-0 rounded-xl border-0 text-text-muted transition-colors hover:bg-surface hover:text-foreground'
          onClick={onRefresh}
          aria-label={t('index.refresh')}
          title={t('index.refresh')}
        >
          <RefreshCw strokeWidth={1.9} />
        </Button>

        {!hideActions && (
          <>
            {onPaste && clipboardItemCount > 0 && (
              <RequirePermission code='file:write'>
                <Button
                  onClick={onPaste}
                  variant='ghost'
                  size='sm'
                  className={pillClass}
                  disabled={pasting}
                >
                  {pasting ? (
                    <Loader2 className='size-3.5 animate-spin' />
                  ) : (
                    <ClipboardPaste strokeWidth={1.9} />
                  )}
                  {t('toolbar.paste', { count: clipboardItemCount })}
                </Button>
              </RequirePermission>
            )}
            {!hideUpload && (
              <RequirePermission code='file:write'>
                <Button
                  onClick={onUpload}
                  size='sm'
                  className='a-btn a-btn--sm a-btn--primary rounded-xl border-0'
                >
                  <Upload strokeWidth={1.9} />
                  {t('index.uploadFile')}
                </Button>
              </RequirePermission>
            )}
            {onUploadDirectory && (
              <RequirePermission code='file:write'>
                <Button
                  onClick={onUploadDirectory}
                  variant='ghost'
                  size='sm'
                  className={pillClass}
                >
                  <FolderUp strokeWidth={1.9} />
                  {t('index.uploadFolder')}
                </Button>
              </RequirePermission>
            )}
            <RequirePermission code='file:write'>
              <Button
                onClick={onCreateFolder}
                variant='secondary'
                size='sm'
                className='a-btn a-btn--sm a-btn--secondary rounded-xl border-0 shadow-none'
              >
                <FolderPlus strokeWidth={1.9} />
                {t('index.newFolder')}
              </Button>
            </RequirePermission>
          </>
        )}
      </div>
    </div>
  )
}
