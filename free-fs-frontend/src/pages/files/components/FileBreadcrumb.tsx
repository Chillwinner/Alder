/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import type { BreadcrumbItem } from '@/types/file'
import { ChevronRight } from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbItem as BreadcrumbItemUI,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

interface FileBreadcrumbProps {
  breadcrumbPath: BreadcrumbItem[]
  customTitle?: string
  onNavigate: (folderId?: string) => void
}

const KINETIC_CSS = `
.fs-ch{display:inline-block;white-space:pre;animation:fsChIn .6s cubic-bezier(.22,1,.36,1) both}
@keyframes fsChIn{from{opacity:0;transform:translateY(.6em) rotate(3deg);filter:blur(6px)}to{opacity:1;transform:none;filter:blur(0)}}
`

/** 末级大标题的逐字 kinetic 入场（demo .kinetic .ch 写法） */
function KineticText({ text }: { text: string }) {
  return (
    <>
      {Array.from(text).map((char, index) => (
        <span
          key={index}
          className='fs-ch'
          style={{ animationDelay: `${Math.min(index * 45, 900)}ms` }}
        >
          {char}
        </span>
      ))}
    </>
  )
}

export function FileBreadcrumb({
  breadcrumbPath,
  customTitle,
  onNavigate,
}: FileBreadcrumbProps) {
  const { t } = useTranslation('files')
  // 只有多层级时才应用透明度
  const hasMultipleLevels = breadcrumbPath.length > 0

  // 前面的层级统一使用透明度，最后一级使用 1.0
  const getOpacity = (isLast: boolean) => {
    if (!hasMultipleLevels) return 1
    return isLast ? 1 : 0.75
  }

  return (
    <>
      <style>{KINETIC_CSS}</style>
      <div className='py-2'>
        <Breadcrumb>
          <BreadcrumbList className='items-baseline gap-1.5'>
            {/* 根目录 */}
            <BreadcrumbItemUI style={{ opacity: getOpacity(breadcrumbPath.length === 0) }} className='transition-all min-w-0'>
              {customTitle ? (
                <BreadcrumbPage
                  key={customTitle}
                  className='max-w-[36vw] truncate text-[26px] leading-tight font-semibold tracking-tight text-foreground'
                >
                  <KineticText text={customTitle} />
                </BreadcrumbPage>
              ) : breadcrumbPath.length === 0 ? (
                <BreadcrumbPage className='text-[26px] leading-tight font-semibold tracking-tight text-foreground'>
                  <KineticText text={t('breadcrumb.allFiles')} />
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink
                  onClick={() => onNavigate()}
                  className='cursor-pointer text-sm font-medium text-muted-foreground transition-colors hover:text-primary'
                >
                  {t('breadcrumb.allFiles')}
                </BreadcrumbLink>
              )}
            </BreadcrumbItemUI>

            {/* 面包屑路径 */}
            {!customTitle &&
              breadcrumbPath.map((item, index) => {
                const isLast = index === breadcrumbPath.length - 1
                const opacity = getOpacity(isLast)

                return (
                  <Fragment key={item.id}>
                    <BreadcrumbSeparator style={{ opacity }} className='transition-opacity text-muted-foreground'>
                      <ChevronRight className='h-4 w-4' />
                    </BreadcrumbSeparator>
                    <BreadcrumbItemUI style={{ opacity }} className='transition-all min-w-0'>
                      {isLast ? (
                        <BreadcrumbPage
                          key={`${item.id}-${item.name}`}
                          className='max-w-[36vw] truncate text-[26px] leading-tight font-semibold tracking-tight text-foreground'
                        >
                          <KineticText text={item.name} />
                        </BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink
                          onClick={() => onNavigate(item.id)}
                          className='cursor-pointer text-sm font-medium text-muted-foreground transition-colors hover:text-primary'
                        >
                          {item.name}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItemUI>
                  </Fragment>
                )
              })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </>
  )
}
