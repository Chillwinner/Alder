# NEBULA 前端样式重构指南（STYLEGUIDE）

> 适用仓库：`free-fs-frontend`。所有页面/组件样式重构必须遵循本文件。
> 本文件由主控维护，**子任务不要修改本文件**。

## 0. 任务性质（最高优先级）

- **只改「看起来」的部分**：`className`、展示性 JSX 结构（包裹 div/section、区块顺序、装饰元素）、CSS 类、纯展示的内联 style。
- **绝对不改功能**：hooks / state / props 接口 / 事件处理 / API 调用 / 权限逻辑 / i18n 的 key / `data-*` 属性 / 组件导出名 / 路由行为。
- **不引入新依赖**、不新建全局样式文件（需要新样式优先用 Tailwind 类；确实需要就写进该页面自己的 `<style>` 块或既有 CSS，不动 `src/styles/*`）。
- **不跑 build / dev**（依赖由主控统一安装与验证）；保证 JSX 语法合法、标签闭合。
- 每个文件改完后自查：`git diff` 里不应出现逻辑行变更（除非是纯包裹结构调整）。

## 1. 设计方向：深空驾驶舱 × 冰川实验室

一个身份、两套明暗：暗色 = 深空驾驶舱（近黑蓝 + 电光青），浅色 = 冰川实验室（冰白 + 深青）。工具型应用，信息密度中高，克制的科技感动效。

- **单主色**：青色（暗 `--hud #4de3ff` / 浅 `--hud #0d7ea8`）。状态色仅 success/warning/destructive。
- **圆角**：面板/卡片 10px（`glass-card` 已强制）；输入 8px；按钮原语已定；胶囊用于徽标/chip。
- **字体**：正文 Space Grotesk（拉丁）+ 系统中文；**数据一律等宽** `font-mono`（JetBrains Mono）。
- **质感**：1px 半透明青色系发丝边框 + 柔和阴影；禁止粗边、重投影、渐变堆砌。

## 2. 颜色 Token（唯一合法色源）

| 用途 | Tailwind 类 | 说明 |
|---|---|---|
| 页面底 | `bg-app-bg` / `bg-background` | 页面画布 |
| 工作区底 | `bg-workspace-bg` | 内容区 |
| 卡片/面板 | `bg-card` `bg-surface` | 主面板 |
| 次级面 | `bg-surface-secondary` `bg-surface-3` | 分区/轨道 |
| 悬浮/按下 | `bg-surface-hover` `bg-surface-active` | 行 hover、按下态 |
| 主文字 | `text-foreground` `text-text-primary` | |
| 次文字 | `text-text-secondary` | |
| 弱文字 | `text-muted-foreground` `text-text-muted` | 描述、元信息 |
| 主色 | `text-primary` `bg-primary` `border-primary` | 按钮/高亮 |
| 主色浅底 | `bg-accent-soft` `text-primary` | 彩色底徽章（双主题自适应） |
| 悬停底 | `bg-accent` | ghost 悬停 |
| 边框 | `border-border` `border-border-strong` | 发丝边 |
| 状态 | `text-success` `text-warning` `text-destructive` | |
| HUD 青 | `text-hud` `bg-hud` `border-hud/40` | 装饰性青（眉标、角标、数据高亮） |

**禁止**：新增任何 hex 颜色、`bg-white`/`bg-black`、`text-slate|gray|zinc|blue-*`、用 `dark:` 做**颜色**切换（token 已自动双主题）。`dark:` 仅允许用于非颜色差异（如 `dark:hidden` 这类显示切换，尽量避免）。
存量旧类（`bg-white`、`dark:bg-*` 等）**必须顺手清除**。

## 3. 排版规范（重构重点）

层级对比要明显，不许全页 14px：

| 层级 | 类参考 |
|---|---|
| 页面主标题 | `text-[26px] font-semibold tracking-tight leading-tight` |
| 页面眉标（可选，每页 ≤1） | `<p className='tech-eyebrow'>NEBULA / FILES · 文件管理</p>` 放主标题上方 |
| 区块标题 | `text-[15px] font-semibold tracking-tight` |
| 描述正文 | `text-[13.5px] text-muted-foreground leading-relaxed max-w-prose` |
| **一切数据**（大小/时间/ID/计数/百分比/哈希） | `font-mono text-xs tabular-nums text-muted-foreground` |
| 表头 | `font-mono text-[11px] uppercase tracking-wider text-muted-foreground` |
| 徽标/chip | `font-mono text-[11px] tracking-wider` + `rounded-full` |

中文标题可不加 `uppercase`；英文/编号眉标必须 mono + 宽字距。

## 4. 页面骨架 Pattern

顶层容器**保持既有**（`mx-auto w-full max-w-[1600px]` 等），只重构头部与区块：

```tsx
<div className='flex flex-1 flex-col'>
  <div className='mx-auto flex w-full max-w-[1600px] flex-col'>
    {/* 页头 */}
    <header className='mb-6 flex flex-wrap items-end justify-between gap-4'>
      <div className='space-y-1.5'>
        <p className='tech-eyebrow'>03 / SETTINGS · 偏好设置</p>
        <h1 className='text-[26px] font-semibold tracking-tight'>外观设置</h1>
        <p className='text-[13.5px] text-muted-foreground'>主题、语言与界面密度。</p>
      </div>
      <div className='flex items-center gap-2'>{/* 操作区 */}</div>
    </header>

    {/* 主面板：保留 glass-card（PageMotion 入场动画依赖它） */}
    <section className='glass-card hud-corners p-5'>…</section>
  </div>
</div>
```

规则：
- **主面板必须保留 `glass-card` 或 `data-tilt`**（切页 stagger 动画依赖；去掉会丧失动效）。可在其上叠加 `hud-corners`（青色角标，每页 ≤4 面板）。
- 间距节奏：页头 `mb-6`；区块间 `gap-5` 或 `mt-5`；卡片内边距 `p-5`（高密度界面 `p-4`）。
- 每页版式要有**至少一处结构性变化**（分栏比例、页头形态、卡片组合），不是所有页都套同一个头。
- `tech-scan`（面板扫描线）每页最多 1 处，且只用于「实时/状态」类面板。

## 5. 动效规范

- 区块入场：依赖既有 `art-card-pop`（`glass-card` 自动获得）；静态无 glass 的大块可加 `tech-rise`（每页 ≤3，可用 `style={{ animationDelay: '80ms' }}` 微延迟）。
- 卡片 hover：`transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md` 或 `hover:border-primary/40`。
- 行 hover：`hover:bg-surface-hover`；可点击元素必须有 hover + `active:scale-[0.99]`（按钮原语已有）。
- **禁止**新增无限循环动画；`pulse-dot` / `tech-scan` 各页合计 ≤1 处。
- 不要动全局 `prefers-reduced-motion`（已全局降级）。

## 6. 明暗双主题

- 只用 §2 token → 自动适配。需要「青色浅底」用 `bg-accent-soft`。
- 需要分隔/发丝线：`border-border`（已是青色系半透明）。
- 第三方/图表配色：优先 `--chart-1..5`（token 已配好双主题）。

## 7. 既有全局类（可直接用）

| 类 | 作用 |
|---|---|
| `tech-eyebrow` | 等宽青色眉标 |
| `hud-corners` | 面板左上/右下青色角标 |
| `pulse-dot` | 呼吸状态点 |
| `tech-rise` | 上浮入场动画 |
| `tech-scan` | 面板扫描线（慎用） |
| `glass-card` `glass-shell` `glass-overlay` | 半透明玻璃面板 |
| `app-header` | 顶栏（勿在页面用） |

## 8. 自检清单（交付前逐条过）

1. 搜索本任务文件：`bg-white|bg-black|text-slate|text-gray|text-zinc|text-blue|bg-blue|#[0-9a-fA-F]{3,8}` → 新增命中为 0（存量清除）。
2. `dark:` 命中仅限非颜色场景。
3. 主面板保留 `glass-card`/`data-tilt`。
4. 数据类文本已 `font-mono`。
5. 每页 ≤1 个 `tech-eyebrow`；无重复 CTA 文案。
6. i18n key、hooks、事件、props 与改前一致。
7. JSX 合法（标签闭合、未引用未导入的组件）。

## 9. Before → After 示例

```tsx
// ❌ 改前：无层级、硬编码色
<div className='bg-white dark:bg-zinc-900 rounded-lg p-4 mt-4'>
  <div className='text-sm font-bold'>存储用量</div>
  <div className='text-sm text-gray-500'>已使用 12.4 GB</div>
</div>

// ✅ 改后：眉标+层级+mono 数据+token+角标
<section className='glass-card hud-corners mt-5 p-5'>
  <div className='flex items-center justify-between'>
    <div className='space-y-1'>
      <p className='tech-eyebrow'>STORAGE</p>
      <h2 className='text-[15px] font-semibold tracking-tight'>存储用量</h2>
    </div>
    <span className='font-mono text-xs tabular-nums text-primary'>12.4 GB</span>
  </div>
  <p className='mt-1 text-[13px] text-muted-foreground'>共 50 GB，剩余 37.6 GB</p>
</section>
```
