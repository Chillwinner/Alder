/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { cn } from '@/lib/utils'

/** 编辑预览、备忘录预览、工作空间 .md 预览共用，避免三套字号和间距。 */
export const MEMO_PROSE_CLASS = cn(
  'memo-preview-prose text-[14.5px] leading-[1.75] text-foreground',
  '[&_h1]:mt-2 [&_h1]:mb-2 [&_h1]:text-[22px] [&_h1]:font-bold [&_h1]:tracking-[-0.022em]',
  '[&_h2]:mt-2 [&_h2]:mb-1.5 [&_h2]:text-[18px] [&_h2]:font-semibold',
  '[&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-[16px] [&_h3]:font-semibold',
  '[&_h4]:mt-1 [&_h4]:text-[15px] [&_h4]:font-semibold',
  '[&_h5]:mt-1 [&_h5]:text-[14px] [&_h5]:font-semibold',
  '[&_h6]:mt-1 [&_h6]:text-[13px] [&_h6]:font-semibold',
  '[&_p]:my-2',
  '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5',
  '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5',
  '[&_blockquote]:my-2 [&_blockquote]:border-s-2 [&_blockquote]:border-border [&_blockquote]:ps-3 [&_blockquote]:text-text-secondary',
  '[&_code]:rounded [&_code]:bg-surface-secondary [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px]',
  '[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-surface-secondary [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-[13px]',
  '[&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-[13px]',
  '[&_a]:text-primary [&_a]:underline',
  '[&_hr]:my-4 [&_hr]:border-border'
)
