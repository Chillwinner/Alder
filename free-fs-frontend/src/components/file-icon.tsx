/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { cn } from '@/lib/utils'

/**
 * 统一的文件图标组件
 *
 * 造型遵循 Google Workspace / Drive：
 *   · Google 自家格式（文档 / 表格 / 幻灯片）＝实色圆角页，无折角
 *   · 其它格式＝带折角的页面
 * 每种类型的悬停动画在 styles/alder.css 里按 [data-type] 分派。
 *
 * 内纹必须内联：用 <use> 引用 symbol 时内容是影子树，外部 CSS 选择器命中不了内部形状。
 */

type Kind =
  | 'doc'
  | 'pdf'
  | 'sheet'
  | 'slides'
  | 'image'
  | 'video'
  | 'audio'
  | 'archive'
  | 'code'
  | 'folder'
  | 'unknown'

const SLAB = <rect className='pg' x='4.7' y='2.5' width='14.6' height='19' rx='2.5' />
const PAGE = (
  <path
    className='pg'
    d='M7.1 2.5h7.2l4.7 4.7v11.9a2.4 2.4 0 0 1-2.4 2.4H7.1a2.4 2.4 0 0 1-2.4-2.4V4.9a2.4 2.4 0 0 1 2.4-2.4Z'
  />
)
const FOLD = <path className='fold' d='M14.3 2.5v4.7h4.7Z' />

const GLYPH: Record<Kind, React.ReactNode> = {
  doc: (
    <>
      {SLAB}
      <path className='ln' style={{ '--d': '0ms' } as React.CSSProperties} d='M8.1 11.9h7.8' />
      <path className='ln' style={{ '--d': '80ms' } as React.CSSProperties} d='M8.1 14.5h7.8' />
      <path className='ln' style={{ '--d': '160ms' } as React.CSSProperties} d='M8.1 17.1h7.8' />
      <path className='ln' style={{ '--d': '240ms' } as React.CSSProperties} d='M8.1 19.5h4.8' />
    </>
  ),
  sheet: (
    <>
      {SLAB}
      <rect className='blk' x='7.2' y='11.2' width='9.6' height='8.4' rx='1.2' />
      <path className='gr cut' style={{ '--d': '0ms' } as React.CSSProperties} d='M7.2 14h9.6' />
      <path className='gr cut' style={{ '--d': '80ms' } as React.CSSProperties} d='M7.2 16.8h9.6' />
      <path className='gr cut' style={{ '--d': '160ms' } as React.CSSProperties} d='M12 11.2v8.4' />
    </>
  ),
  slides: (
    <>
      {SLAB}
      <rect className='blk' x='7.3' y='9.8' width='9.4' height='7.4' rx='1.3' />
      <path className='cut' d='M9.4 13.5h5.2' />
    </>
  ),
  pdf: (
    <>
      {PAGE}
      {FOLD}
      <path className='ln' d='M8.2 11.3h7.6' />
      <rect className='blk' x='8.2' y='13.5' width='7.6' height='2' rx='1' />
      <path className='ln' d='M8.2 18h4.4' />
    </>
  ),
  image: (
    <>
      {PAGE}
      {FOLD}
      <circle className='sun' cx='10' cy='11.6' r='1.7' />
      <path className='ln' d='M7 18.6l3.4-3.9 2.6 2.9 2-2.2 2.2 3.2' />
    </>
  ),
  video: (
    <>
      {PAGE}
      {FOLD}
      <path className='play' d='M10.1 10.4 15.3 14l-5.2 3.6Z' />
    </>
  ),
  audio: (
    <>
      {PAGE}
      {FOLD}
      <path className='wave' style={{ '--d': '0ms' } as React.CSSProperties} d='M9 12.6v3.2' />
      <path className='wave' style={{ '--d': '70ms' } as React.CSSProperties} d='M11.2 10.8v6.8' />
      <path className='wave' style={{ '--d': '140ms' } as React.CSSProperties} d='M13.5 12.9v2.6' />
      <path className='wave' style={{ '--d': '210ms' } as React.CSSProperties} d='M15.7 11.6v5.2' />
    </>
  ),
  archive: (
    <>
      {PAGE}
      {FOLD}
      <path className='zip' d='M12 8v10' />
      <path className='zipt' style={{ '--d': '0ms' } as React.CSSProperties} d='M10.7 10.3h2.6' />
      <path className='zipt' style={{ '--d': '90ms' } as React.CSSProperties} d='M10.7 12.8h2.6' />
      <path className='zipt' style={{ '--d': '180ms' } as React.CSSProperties} d='M10.7 15.3h2.6' />
    </>
  ),
  code: (
    <>
      {PAGE}
      {FOLD}
      <path className='chL' d='M10.2 11.3 7.8 14l2.4 2.7' />
      <path className='chR' d='M13.8 11.3 16.2 14l-2.4 2.7' />
    </>
  ),
  /*
    ⚠️ 文件夹图标的包围盒必须和上面 PAGE/SLAB **视觉一致**，
       否则网格里文件夹又是"宽而扁"、文件是"窄而高"，
       看起来就是"有的图标没占满格子"（用户反馈的问题）。

    实测原值：
      PAGE/SLAB → x 4.7~19.3（14.6 宽） y 2.5~21.5（19 高）
      folder    → x 2.7~21.3（18.6 宽） y 4.9~19.6（14.7 高）  ← 横着铺满，明显不一致

    修法：把文件夹整体收进同样的 14.6×19 视觉框里
    （x 居中于 12 → 4.7~19.3；y 取 4.2~20.8，约 16.6 高，
     文件夹天生比"纸"矮一点，这是公认的图形符号，不必强求等宽等高，
     但 **宽度必须对齐**，否则并排时一眼看出参差）。
  */
  folder: (
    <>
      <path
        className='pg'
        d='M4.7 8.2a1.9 1.9 0 0 1 1.9-1.9h2.9a1.9 1.9 0 0 1 1.45.67l.99 1.16h4.66a1.9 1.9 0 0 1 1.9 1.9v6.9a1.9 1.9 0 0 1-1.9 1.9H6.6a1.9 1.9 0 0 1-1.9-1.9Z'
      />
      <path
        className='flap'
        d='M4.7 11h14.6v6.6a1.9 1.9 0 0 1-1.9 1.9H6.6a1.9 1.9 0 0 1-1.9-1.9Z'
      />
    </>
  ),
  unknown: (
    <>
      {PAGE}
      {FOLD}
    </>
  ),
}

/** 扩展名 → 图标种类 */
function getKind(type: string): Kind {
  const t = (type || '').toLowerCase().replace(/^\./, '')
  if (t === 'dir' || t === 'folder') return 'folder'
  if (t === 'pdf') return 'pdf'

  if (['doc', 'docx', 'odt', 'rtf', 'pages', 'txt', 'md', 'log', 'ini', 'cfg', 'conf', 'env'].includes(t))
    return 'doc'
  if (['xls', 'xlsx', 'xlsm', 'xlsb', 'csv', 'tsv', 'ods', 'numbers'].includes(t)) return 'sheet'
  if (['ppt', 'pptx', 'odp', 'key'].includes(t)) return 'slides'
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico', 'tiff', 'tif', 'heic', 'heif'].includes(t))
    return 'image'
  if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm', 'm4v', 'mpg', 'mpeg', '3gp', 'ogv'].includes(t))
    return 'video'
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'opus', 'ape', 'alac'].includes(t)) return 'audio'
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'dmg'].includes(t)) return 'archive'
  if (
    [
      'js', 'jsx', 'ts', 'tsx', 'vue', 'py', 'java', 'cpp', 'c', 'h', 'cs', 'php', 'rb', 'go', 'rs',
      'swift', 'kt', 'scala', 'sh', 'bash', 'json', 'xml', 'yaml', 'yml', 'toml', 'css', 'scss',
      'sass', 'less', 'html', 'htm', 'r', 'dart', 'lua',
    ].includes(t)
  )
    return 'code'
  return 'unknown'
}

const KIND_COLOR: Record<Kind, string> = {
  doc: 'var(--t-doc)',
  pdf: 'var(--t-pdf)',
  sheet: 'var(--t-sheet)',
  slides: 'var(--t-slide)',
  image: 'var(--t-image)',
  video: 'var(--t-video)',
  audio: 'var(--t-audio)',
  archive: 'var(--t-archive)',
  code: 'var(--t-code)',
  folder: 'var(--t-folder)',
  unknown: 'var(--t-unknown)',
}

interface FileIconProps {
  type: string
  className?: string
  size?: number
}

export const FileIcon: React.FC<FileIconProps> = ({
  type,
  className = '',
  size = 48,
}) => {
  const kind = getKind(type)

  return (
    <span
      className={cn('a-glyph', className)}
      data-type={kind}
      aria-hidden
      style={
        {
          '--sz': `${size}px`,
          '--tc': KIND_COLOR[kind],
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: `${Math.max(3, Math.round(size * 0.28))}px`,
        } as React.CSSProperties
      }
    >
      <svg viewBox='0 0 24 24'>{GLYPH[kind]}</svg>
    </span>
  )
}

export { getKind as getFileIconKind }
