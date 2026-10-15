/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { JSONContent } from '@tiptap/core'
import { useQuery } from '@tanstack/react-query'
import { Fragment, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { lookupMemoByName, probeMemo } from '@/api/workspace-board'
import { resolveMemoImageSrc } from '@/lib/memo-insert-image'
import { openMemoById } from '@/lib/memo-wiki-link'
import { MemoReferencedFileCard } from '@/pages/board/components/memo-workspace-file-card'

function textWithMarks(text: string, marks?: { type: string; attrs?: Record<string, unknown> }[]) {
  let node: ReactNode = text
  if (!marks?.length) return node
  if (marks.some((m) => m.type === 'code')) node = <code>{node}</code>
  if (marks.some((m) => m.type === 'bold')) node = <strong>{node}</strong>
  if (marks.some((m) => m.type === 'italic')) node = <em>{node}</em>
  if (marks.some((m) => m.type === 'strike')) node = <s>{node}</s>
  const href = marks.find((m) => m.type === 'link')?.attrs?.href
  if (typeof href === 'string' && href) {
    node = (
      <a href={href} target={href.startsWith('/') ? undefined : '_blank'} rel='noreferrer'>
        {node}
      </a>
    )
  }
  return node
}

function PreviewImage({ src, alt, memoId }: { src: string; alt: string; memoId?: string }) {
  const display = resolveMemoImageSrc(src, memoId)
  if (!display) return alt ? <span>{alt}</span> : null
  return (
    <img
      src={display}
      alt={alt}
      className='my-2 block h-auto max-h-[min(50vh,420px)] w-full max-w-full rounded-md object-contain'
    />
  )
}

function WikiChip({ memoId, title }: { memoId: string; title: string }) {
  const { t } = useTranslation('board')
  const label = title.trim() || t('editor.refMemoFallback')
  const resolve = useQuery({
    queryKey: ['memo-wiki', memoId, title],
    enabled: Boolean(memoId || title.trim()),
    queryFn: async () => {
      if (title.trim()) {
        return lookupMemoByName(title.trim())
      }
      await probeMemo(memoId)
      return { id: memoId, kind: 'md' as const, title: label }
    },
    staleTime: 30_000,
    retry: false,
  })
  const targetId = resolve.data?.id || memoId
  const gone = resolve.isError
  const isCanvas = resolve.data?.kind === 'canvas'
  const open = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (!targetId || gone) return
    openMemoById(targetId, label)
  }
  if (isCanvas) {
    return (
      <button type='button' className='memo-wiki-canvas' title={label} onClick={open}>
        <span className='block h-[140px] w-full' aria-hidden />
        <span>{label}</span>
      </button>
    )
  }
  return (
    <button
      type='button'
      className={gone ? 'memo-wiki-chip memo-wiki-chip--gone' : 'memo-wiki-chip'}
      title={gone ? t('editor.memoLinkMissing') : label}
      disabled={gone || resolve.isLoading}
      onClick={open}
    >
      <span className='truncate'>{gone ? `${label}${t('editor.refMemoGone')}` : label}</span>
    </button>
  )
}

function renderInline(node: JSONContent, memoId?: string): ReactNode {
  if (node.type === 'text') return textWithMarks(node.text || '', node.marks)
  if (node.type === 'hardBreak') return <br />
  if (node.type === 'image') {
    return (
      <PreviewImage
        src={String(node.attrs?.src || '')}
        alt={String(node.attrs?.alt || '')}
        memoId={memoId}
      />
    )
  }
  if (node.type === 'memoWikiLink') {
    return (
      <WikiChip
        memoId={String(node.attrs?.memoId || '')}
        title={String(node.attrs?.title || '')}
      />
    )
  }
  if (node.content) {
    return (
      <>
        {node.content.map((child, i) => (
          <Fragment key={i}>{renderInline(child, memoId)}</Fragment>
        ))}
      </>
    )
  }
  return null
}

function InlineNodes({ nodes, memoId }: { nodes?: JSONContent[]; memoId?: string }) {
  if (!nodes?.length) return null
  return (
    <>
      {nodes.map((node, i) => (
        <Fragment key={i}>{renderInline(node, memoId)}</Fragment>
      ))}
    </>
  )
}

function renderBlock(node: JSONContent, key: number, memoId?: string): ReactNode {
  const type = node.type || ''
  if (type === 'doc') {
    return node.content?.map((child, i) => renderBlock(child, i, memoId))
  }
  if (type === 'paragraph') {
    return (
      <p key={key}>
        <InlineNodes nodes={node.content} memoId={memoId} />
      </p>
    )
  }
  if (type === 'heading') {
    const level = Math.min(6, Math.max(1, Number(node.attrs?.level || 1)))
    const Tag = `h${level}` as 'h1'
    return (
      <Tag key={key}>
        <InlineNodes nodes={node.content} memoId={memoId} />
      </Tag>
    )
  }
  if (type === 'image') {
    return (
      <PreviewImage
        key={key}
        src={String(node.attrs?.src || '')}
        alt={String(node.attrs?.alt || '')}
        memoId={memoId}
      />
    )
  }
  if (type === 'memoWorkspaceFile') {
    const fileId = String(node.attrs?.fileId || '').trim()
    const name = String(node.attrs?.name || '').trim()
    if (!fileId || !name) return null
    return (
      <MemoReferencedFileCard
        key={key}
        attrs={{
          fileId,
          name,
          suffix: String(node.attrs?.suffix || ''),
          size: Number(node.attrs?.size) || 0,
          mime: String(node.attrs?.mime || ''),
          isDir: Boolean(node.attrs?.isDir),
        }}
      />
    )
  }
  if (type === 'bulletList') {
    return (
      <ul key={key}>
        {(node.content || []).map((item, i) => (
          <li key={i}>
            <InlineNodes nodes={item.content?.[0]?.content || item.content} memoId={memoId} />
          </li>
        ))}
      </ul>
    )
  }
  if (type === 'orderedList') {
    return (
      <ol key={key}>
        {(node.content || []).map((item, i) => (
          <li key={i}>
            <InlineNodes nodes={item.content?.[0]?.content || item.content} memoId={memoId} />
          </li>
        ))}
      </ol>
    )
  }
  if (type === 'blockquote') {
    return (
      <blockquote key={key}>
        <InlineNodes nodes={node.content?.[0]?.content || node.content} memoId={memoId} />
      </blockquote>
    )
  }
  if (type === 'codeBlock') {
    const code = (node.content || []).map((c) => c.text || '').join('\n')
    return (
      <pre key={key}>
        <code>{code}</code>
      </pre>
    )
  }
  if (type === 'horizontalRule') return <hr key={key} />
  if (node.content) {
    return (
      <div key={key}>
        {node.content.map((child, i) => renderBlock(child, i, memoId))}
      </div>
    )
  }
  return null
}

export function MemoDocPreview({ doc, memoId }: { doc: JSONContent; memoId?: string }) {
  return <>{renderBlock(doc, 0, memoId)}</>
}
