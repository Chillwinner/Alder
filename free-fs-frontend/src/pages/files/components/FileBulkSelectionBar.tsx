/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useTranslation } from 'react-i18next'
import {
  Download,
  Info,
  Edit,
  Share2,
  Inbox,
  Heart,
  Move,
  Trash2,
  Copy,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BulkSelectionBar } from '@/components/bulk-selection-bar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { RequirePermission } from '@/components/require-permission'

interface FileBulkSelectionBarProps {
  selectedCount: number
  hasUnfavorited: boolean
  onDownload: () => void
  onCopy: () => void
  onRename: () => void
  onDetail: () => void
  onShare: () => void
  onCollect?: () => void
  onFavorite: () => void
  onMove: () => void
  onDelete: () => void
  onClear: () => void
}

export function FileBulkSelectionBar({
  selectedCount,
  hasUnfavorited,
  onDownload,
  onCopy,
  onRename,
  onDetail,
  onShare,
  onCollect,
  onFavorite,
  onMove,
  onDelete,
  onClear,
}: FileBulkSelectionBarProps) {
  const { t } = useTranslation('files')
  return (
    <BulkSelectionBar
      selectedCount={selectedCount}
      onClear={onClear}
      ariaLabel={t('bulk.ariaBar')}
    >
      <RequirePermission code='file:read'>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type='button'
              variant='outline'
              size='icon'
              className='size-8 shrink-0'
              onClick={onDownload}
              aria-label={t('bulk.ariaDownload')}
            >
              <Download />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('rowMenu.download')}</p>
          </TooltipContent>
        </Tooltip>
      </RequirePermission>

      <RequirePermission code='file:write'>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type='button'
              variant='outline'
              size='icon'
              className='size-8 shrink-0'
              onClick={onCopy}
              aria-label={t('bulk.ariaCopy')}
            >
              <Copy />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('rowMenu.copy')}</p>
          </TooltipContent>
        </Tooltip>
      </RequirePermission>

      {selectedCount === 1 ? (
        <>
          <RequirePermission code='file:read'>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type='button'
                  variant='outline'
                  size='icon'
                  className='size-8 shrink-0'
                  onClick={onDetail}
                  aria-label={t('rowMenu.detail')}
                >
                  <Info />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('rowMenu.detail')}</p>
              </TooltipContent>
            </Tooltip>
          </RequirePermission>
          <RequirePermission code='file:write'>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type='button'
                  variant='outline'
                  size='icon'
                  className='size-8 shrink-0'
                  onClick={onRename}
                  aria-label={t('bulk.ariaRename')}
                >
                  <Edit />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('rowMenu.rename')}</p>
              </TooltipContent>
            </Tooltip>
          </RequirePermission>
        </>
      ) : null}

      <RequirePermission code='file:share'>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type='button'
              variant='outline'
              size='icon'
              className='size-8 shrink-0'
              onClick={onShare}
              aria-label={t('bulk.ariaShare')}
            >
              <Share2 />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('rowMenu.share')}</p>
          </TooltipContent>
        </Tooltip>
      </RequirePermission>

      {onCollect ? (
        <RequirePermission code='file:share'>
          <RequirePermission code='file:write'>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type='button'
                  variant='outline'
                  size='icon'
                  className='size-8 shrink-0'
                  onClick={onCollect}
                  aria-label={t('rowMenu.collect')}
                >
                  <Inbox />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('rowMenu.collect')}</p>
              </TooltipContent>
            </Tooltip>
          </RequirePermission>
        </RequirePermission>
      ) : null}

      <RequirePermission code='file:write'>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type='button'
              variant='outline'
              size='icon'
              className='size-8 shrink-0'
              onClick={onFavorite}
              aria-label={t('bulk.ariaFavorite')}
            >
              <Heart fill={hasUnfavorited ? 'none' : 'currentColor'} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('rowMenu.favorite')}</p>
          </TooltipContent>
        </Tooltip>
      </RequirePermission>

      <RequirePermission code='file:write'>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type='button'
              variant='outline'
              size='icon'
              className='size-8 shrink-0'
              onClick={onMove}
              aria-label={t('bulk.ariaMove')}
            >
              <Move />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('rowMenu.move')}</p>
          </TooltipContent>
        </Tooltip>
      </RequirePermission>

      <RequirePermission code='file:write'>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type='button'
              variant='destructive'
              size='icon'
              className='size-8 shrink-0'
              onClick={onDelete}
              aria-label={t('bulk.ariaTrash')}
            >
              <Trash2 />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('rowMenu.trash')}</p>
          </TooltipContent>
        </Tooltip>
      </RequirePermission>
    </BulkSelectionBar>
  )
}
