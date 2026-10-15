/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { getDragState, subscribeDrag } from '@/lib/drag-layer'
import { useTranslation } from 'react-i18next'
import { Settings, Trash2 } from 'lucide-react'
import { usePermission } from '@/hooks/use-permission'
import { useDragState } from '@/hooks/use-drag-layer'
import { useTrashDrop } from '@/hooks/use-trash-drop'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useSettingsModal } from '@/contexts/settings-modal-context'
import { useSidebar } from '@/components/ui/sidebar'
import { WorkspaceSwitcher } from './workspace-switcher'
import { sidebarData, sidebarTrashItem } from './data/sidebar-data'
import type { NavLink, SidebarNavIconPair } from './types'
import { stabilizeWorkspacePath } from '@/lib/workspace-path'

/** Dock 只处理「链接型」导航项（sidebar-data 里全部是链接型） */
type DockLink = Omit<NavLink, 'icon'> & { url: string; icon: SidebarNavIconPair }

/* ==========================================================================
   左侧 Dock —— iOS 26 液态玻璃
   --------------------------------------------------------------------------
   指示器不是 CSS transition，是真的弹簧积分：
     a = -k·(x - target) - c·v
     主滴  k=215 c=27  → 0.5s 收敛，带轻微过冲
     拖尾  k=92  c=19  → 更慢，形成「一滴水被拽走」的尾巴
   按速度纵向拉伸、横向收窄，这就是「液态」的来源。
   ========================================================================== */

/** 一步半隐式欧拉积分 */
function integrate(pos: number, vel: number, target: number, k: number, c: number, dt: number) {
  const acc = -k * (pos - target) - c * vel
  const v = vel + acc * dt
  return [pos + v * dt, v] as const
}

function useLiquidIndicator(
  navRef: React.RefObject<HTMLDivElement | null>,
  pillRef: React.RefObject<HTMLSpanElement | null>,
  dropRef: React.RefObject<HTMLSpanElement | null>,
  activeKey: string
) {
  /*
    ⚠️ 弹簧状态必须放在 ref 里跨 effect 存活。
    一开始我把它写成 effect 内的局部变量，于是 activeKey 一变 effect 重跑、
    ready 重置为 false、measure() 立刻把位置吸附到目标 ——
    表现就是「指示器瞬移，没有移动动画」。
  */
  const spring = useRef({
    ready: false,
    py: 0,
    pv: 0,
    ph: 60,
    phv: 0,
    dy: 0,
    dv: 0,
    dh: 60,
    dhv: 0,
  })

  useEffect(() => {
    const nav = navRef.current
    const pill = pillRef.current
    const drop = dropRef.current
    if (!nav || !pill || !drop) return

    const s = spring.current
    let ty = s.py
    let th = s.ph
    let raf = 0
    let last = 0

    const paint = () => {
      const sp = Math.min(1, Math.abs(s.pv) / 720)
      pill.style.height = `${Math.max(0, s.ph)}px`
      pill.style.transform =
        `translate3d(0,${s.py.toFixed(2)}px,0) scale(${(1 - sp * 0.22).toFixed(3)},${(1 + sp * 0.42).toFixed(3)})`
      drop.style.height = `${Math.max(0, s.dh)}px`
      drop.style.transform =
        `translate3d(0,${s.dy.toFixed(2)}px,0) scale(${(1 - sp * 0.1).toFixed(3)},${(1 + sp * 0.58).toFixed(3)})`
      drop.style.opacity = `${(sp * 0.45).toFixed(3)}`
    }

    const tick = (now: number) => {
      raf = 0
      const dt = Math.min(0.032, (now - last) / 1000)
      last = now
      ;[s.py, s.pv] = integrate(s.py, s.pv, ty, 215, 27, dt)
      ;[s.ph, s.phv] = integrate(s.ph, s.phv, th, 195, 25, dt)
      ;[s.dy, s.dv] = integrate(s.dy, s.dv, ty, 92, 19, dt)
      ;[s.dh, s.dhv] = integrate(s.dh, s.dhv, th, 88, 18, dt)
      const settled =
        Math.abs(s.py - ty) < 0.3 && Math.abs(s.pv) < 0.5 &&
        Math.abs(s.ph - th) < 0.3 && Math.abs(s.phv) < 0.5 &&
        Math.abs(s.dy - ty) < 0.8 && Math.abs(s.dv) < 0.8
      paint()
      if (settled) {
        s.py = ty; s.ph = th; s.dy = ty; s.dh = th
        s.pv = s.phv = s.dv = s.dhv = 0
        paint()
      } else {
        raf = requestAnimationFrame(tick)
      }
    }

    const wake = () => {
      if (!raf) {
        last = performance.now()
        raf = requestAnimationFrame(tick)
      }
    }

    const measure = () => {
      const el =
        nav.querySelector<HTMLElement>('[data-active="true"]') ??
        nav.querySelector<HTMLElement>('.a-dock__item')
      if (!el) return
      ty = el.offsetTop
      th = el.offsetHeight
      // 只在首次吸附；之后一律从当前位置弹过去，这才有「移动动画」
      if (!s.ready) {
        s.py = ty; s.ph = th; s.dy = ty; s.dh = th
        s.ready = true
      }
      paint()
      wake()
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(nav)
    const t = window.setTimeout(measure, 320)
    return () => {
      ro.disconnect()
      window.clearTimeout(t)
      if (raf) cancelAnimationFrame(raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey])
}

/** 磁吸放大：靠近指针的图标轻微放大。只动 transform。 */
function useMagnet(_dockRef: React.RefObject<HTMLElement | null>) {
  /* 磁吸放大每帧量尺寸，和玻璃叠在一起会掉帧，关掉。 */
}

/** 把 item.url 转成带工作空间 slug 的真实路径，并判断是否选中 */
function stripSlugPrefix(fullPath: string): string {
  const match = fullPath.match(/^\/w\/[^/]+(.*)$/)
  return match ? match[1] || '/' : fullPath
}

function useNavState() {
  const location = useLocation()
  const current = stripSlugPrefix(
    stabilizeWorkspacePath(location.pathname) + location.search
  )
  const [curPath, curSearch = ''] = current.split('?')

  return useCallback(
    (url: string) => {
      const [itemPath, itemSearch = ''] = url.split('?')
      if (itemPath === '/') return curPath === '/' || curPath === ''
      const same =
        curPath === itemPath || (itemPath !== '/' && curPath.startsWith(`${itemPath}/`))
      if (!same) return false
      const want = new URLSearchParams(itemSearch).get('view')
      const got = new URLSearchParams(curSearch).get('view')
      return want === got
    },
    [curPath, curSearch]
  )
}

function DockItem({
  item,
  active,
  onNavigate,
}: {
  item: DockLink
  active: boolean
  onNavigate: () => void
}) {
  const { t } = useTranslation('layout')
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const Icon = item.icon.line
  const label = t(item.titleKey)
  const isFilesIcon = item.url === '/files'
  const [filesOver, setFilesOver] = useState(false)

  const acceptDockDrop = () => {
    if (!isFilesIcon) return false
    const kind = getDragState().kind
    return kind === 'memo' || kind === 'file' || kind === 'message'
  }

  useEffect(() => {
    if (!isFilesIcon) return
    return subscribeDrag((state) => {
      if (!state.kind) setFilesOver(false)
    })
  }, [isFilesIcon])

  return (
    <Link
      to={`/w/${slug}${item.url}`}
      data-active={active}
      data-files-over={filesOver ? 'true' : undefined}
      className='a-dock__item'
      title={label}
      onClick={onNavigate}
      onDragEnter={(event) => {
        if (!acceptDockDrop() || !slug) return
        event.preventDefault()
        setFilesOver(true)
        if (!location.pathname.includes('/files')) {
          navigate(`/w/${slug}/files`)
        }
      }}
      onDragOver={(event) => {
        if (!acceptDockDrop()) return
        event.preventDefault()
        event.dataTransfer.dropEffect = getDragState().kind === 'file' ? 'move' : 'copy'
        setFilesOver(true)
      }}
      onDragLeave={(event) => {
        const next = event.relatedTarget
        if (next instanceof Node && event.currentTarget.contains(next)) return
        setFilesOver(false)
      }}
    >
      <Icon strokeWidth={1.6} className='size-[22px]' />
      <span>{label}</span>
    </Link>
  )
}

export function AlderDock() {
  const dockRef = useRef<HTMLElement>(null)
  const navRef = useRef<HTMLDivElement>(null)
  const pillRef = useRef<HTMLSpanElement>(null)
  const dropRef = useRef<HTMLSpanElement>(null)

  const { t } = useTranslation('layout')
  const { slug } = useParams<{ slug: string }>()
  const { hasPermission } = usePermission()
  const { openSettings } = useSettingsModal()
  const { state, setOpenMobile } = useSidebar()
  const isActive = useNavState()

  const groups = sidebarData.navGroups
    .map((g) => ({
      ...g,
      items: (g.items as DockLink[]).filter(
        (i) => !i.permission || hasPermission(i.permission)
      ),
    }))
    .filter((g) => g.items.length > 0)

  const showTrash =
    !sidebarTrashItem.permission || hasPermission(sidebarTrashItem.permission)

  const activeKey = groups.flatMap((g) => g.items).find((i) => isActive(i.url))?.url ?? ''

  useLiquidIndicator(navRef, pillRef, dropRef, `${activeKey}|${state}`)
  useMagnet(dockRef)

  const closeMobile = useCallback(() => setOpenMobile(false), [setOpenMobile])

  /*
    拖到回收站删除 —— 侧栏底部的垃圾桶就是落点。
    删除成功后通知文件页/备忘录页刷新（用 CustomEvent，避免给 Dock 引入
    对这两个页面的 store 依赖；谁在监听谁刷新）。
  */
  const handleTrashDeleted = useCallback(
    (kind: 'file' | 'memo', count: number) => {
      window.dispatchEvent(
        new CustomEvent('alder:trash-deleted', { detail: { kind, count } })
      )
    },
    []
  )
  const trash = useTrashDrop({ onDeleted: handleTrashDeleted })
  /* 悬停时的高亮种类：决定提示文案（备忘录不可恢复，要区分） */
  const trashKind = useDragState().kind

  const flatItems = groups.flatMap((g) => g.items)
  const tabItems = flatItems.slice(0, 5)

  return (
    <>
      <aside
        ref={dockRef}
        className='a-dock'
        data-compact={state === 'collapsed'}
        aria-label={t('sidebar.groups.main')}
      >
        <span className='a-dock__rim' aria-hidden='true' />

        <div className='a-dock__brand'>
          <WorkspaceSwitcher compact />
        </div>

        <div className='a-dock__nav' ref={navRef}>
          <span className='a-dock__liquid' aria-hidden='true'>
            <span className='a-dock__drop' ref={dropRef} />
            <span className='a-dock__pill' ref={pillRef} />
          </span>

          {groups.map((group, gi) => (
            <Fragment key={group.titleKey}>
              {gi > 0 && <span className='a-dock__sep' aria-hidden='true' />}
              {group.items.map((item) => (
                <DockItem
                  key={item.url}
                  item={item}
                  active={isActive(item.url)}
                  onNavigate={closeMobile}
                />
              ))}
            </Fragment>
          ))}

          <span className='a-dock__spacer' />

          {showTrash && (
            <Link
              to={`/w/${slug}${sidebarTrashItem.url}`}
              data-active={isActive(sidebarTrashItem.url)}
              /*
                拖到回收站删除（就像 Windows 把文件拖进回收站）。
                bind 里已经 preventDefault，所以拖动时 Link 不会误触发跳转；
                只有普通点击才导航。
                data-trash-* 供 CSS 做"盖子掀开 + 变红 + 放大"的反馈。
              */
              {...trash.bind}
              data-trash-over={trash.isOver ? 'true' : undefined}
              data-trash-swallow={trash.justDropped ? 'true' : undefined}
              className='a-dock__item a-dock__trash'
              title={
                trash.isOver
                  ? trashKind === 'memo'
                    ? t('sidebar.trashDropMemo')
                    : t('sidebar.trashDropFile')
                  : t(sidebarTrashItem.titleKey)
              }
              onClick={closeMobile}
            >
              {/* 盖子：单独一层，拖拽悬停时掀开 */}
              <span className='a-dock__trash-lid' aria-hidden='true' />
              <span className='a-dock__trash-body'>
                <Trash2 strokeWidth={1.6} className='size-[22px]' />
              </span>
              <span>{t(sidebarTrashItem.titleKey)}</span>
            </Link>
          )}

          <button
            type='button'
            className='a-dock__item'
            title={t('sidebar.settings')}
            onClick={() => openSettings('profile')}
          >
            <Settings strokeWidth={1.6} className='size-[22px]' />
            <span>{t('sidebar.settings')}</span>
          </button>
        </div>
      </aside>

      {/* 移动端：底部胶囊标签栏（iOS 上没有侧栏，这台更合平台习惯） */}
      <nav className='a-tabbar' aria-label={t('sidebar.groups.main')}>
        {tabItems.map((item) => {
          const Icon = item.icon.line
          return (
            <Link
              key={item.url}
              to={`/w/${slug}${item.url}`}
              data-active={isActive(item.url)}
              className='a-tabbar__item'
            >
              <Icon strokeWidth={1.6} className='size-[21px]' />
              <span>{t(item.titleKey)}</span>
            </Link>
          )
        })}
      </nav>

      {/*
        拖到回收站后的二次确认。
        ------------------------------------------------------------------
        两处措辞**必须区分**（见 use-trash-drop.ts 的说明）：
          文件   → "移到回收站"，可从回收站恢复
          备忘录 → "删除"，后端没有回收站，**不可恢复**
        把两者都说成"回收站"会让用户以为备忘录能找回 —— 那是误导。
      */}
      <ConfirmDialog
        open={Boolean(trash.pending)}
        onOpenChange={(next) => !next && trash.cancelDelete()}
        destructive
        isLoading={trash.deleting}
        title={
          trash.pending?.kind === 'memo'
            ? t('sidebar.trashConfirmMemoTitle')
            : t('sidebar.trashConfirmFileTitle')
        }
        desc={
          trash.pending ? (
            <div className='flex flex-col gap-2'>
              <p>
                {trash.pending.kind === 'memo'
                  ? t('sidebar.trashConfirmMemoDesc')
                  : trash.pending.ids.length === 1
                    ? t('sidebar.trashConfirmFileDescOne')
                    : t('sidebar.trashConfirmFileDescMany', {
                        count: trash.pending.ids.length,
                      })}
              </p>
              {/* 列出将被删除的名字，避免"删错了才后悔" */}
              {trash.pending.names.length > 0 && (
                <ul className='flex flex-col max-h-32 overflow-auto rounded-lg bg-muted/50 p-2 text-[12.5px] gap-1'>
                  {trash.pending.names.slice(0, 8).map((name, index) => (
                    <li key={`${name}-${index}`} className='truncate'>
                      {name || '—'}
                    </li>
                  ))}
                  {trash.pending.names.length > 8 && (
                    <li className='text-text-muted'>
                      {t('sidebar.trashConfirmMore', {
                        count: trash.pending.names.length - 8,
                      })}
                    </li>
                  )}
                </ul>
              )}
            </div>
          ) : (
            ''
          )
        }
        cancelBtnText={t('sidebar.trashConfirmCancel')}
        confirmText={
          trash.pending?.kind === 'memo'
            ? t('sidebar.trashConfirmDelete')
            : t('sidebar.trashConfirmMove')
        }
        handleConfirm={trash.confirmDelete}
      />
    </>
  )
}
