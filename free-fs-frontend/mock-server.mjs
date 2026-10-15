/**
 * NEBULA / Alder 假后端（开发预览用，零依赖）
 *
 * 用途：没有启动真实 Java 后端时，让前端可以完整交互浏览（登录、文件、看板、会议、通知…）。
 * 原理：Vite 会把 /apis /api /files /ws 代理到 127.0.0.1:8081（见 vite.config.ts），
 *       本服务在 8081 返回统一的 { code, msg, data } 包装与样例数据。
 *
 * 启动：
 *   node mock-server.mjs
 *
 * 说明：
 *   - 登录用任意账号密码即可（接口恒回 200）。
 *   - /ws 真实 WebSocket 不模拟，控制台会有握手失败提示，不影响页面渲染。
 *   - /apis/transfer/sse 与 /apis/workspace-board/events 走 SSE 长连接。
 *   - 时间字段一律「相对当下」生成：今天 / 昨天 / 3 小时前 都有真实层次。
 *   - 所有响应结构以 src/api/**、src/types/** 的 TS 接口为准，不要反过来改业务代码适配 mock。
 *   - 仅用于本地看效果，请勿部署到生产。
 */
import http from 'node:http'

/* ============================================================================
 * 时间工具：所有时间都相对「请求发生的那一刻」
 * ========================================================================== */
const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR
const now = () => Date.now()
/** 相对当下的 ISO 字符串（dayjs / new Date 都能解析，且能算出「3 小时前」） */
const iso = (offsetMs) => new Date(now() + offsetMs).toISOString()
/** 相对当下的 'YYYY-MM-DD HH:mm:ss'（个别接口沿用后端简单格式） */
const plain = (offsetMs) => {
  const d = new Date(now() + offsetMs)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes()
  )}:${p(d.getSeconds())}`
}

/* ============================================================================
 * 账号 / 工作空间 / 权限 / 成员
 * ========================================================================== */
const USER = {
  id: 'u-001',
  username: 'nebula-admin',
  nickname: '星云管理员',
  email: 'admin@nebula.dev',
  avatar: '',
  status: 1,
  createdAt: plain(-270 * DAY),
  updatedAt: plain(-12 * DAY),
  lastLoginAt: plain(-3 * HOUR),
  isSetPassword: true,
}

const PERMISSIONS = [
  'file:read',
  'file:share',
  'file:write',
  'log:read',
  'member:manage',
  'storage:manage',
]

const PERMISSION_DEFS = [
  { id: 1, permissionCode: 'file:read', permissionName: '查看文件', module: 'file', desc: '浏览、下载与预览空间内文件', sort: 1 },
  { id: 2, permissionCode: 'file:write', permissionName: '编辑文件', module: 'file', desc: '上传、重命名、移动与删除文件', sort: 2 },
  { id: 3, permissionCode: 'file:share', permissionName: '分享文件', module: 'file', desc: '创建与管理对外分享链接', sort: 3 },
  { id: 4, permissionCode: 'member:manage', permissionName: '成员管理', module: 'member', desc: '邀请、移除成员并调整角色', sort: 4 },
  { id: 5, permissionCode: 'log:read', permissionName: '查看日志', module: 'log', desc: '查看空间内操作审计日志', sort: 5 },
  { id: 6, permissionCode: 'storage:manage', permissionName: '存储管理', module: 'storage', desc: '配置与切换对象存储平台', sort: 6 },
]

const WORKSPACES = [
  {
    id: 'ws-demo',
    name: 'NEBULA 工作空间',
    slug: 'nebula',
    description: '产品、设计与前端共用主空间',
    ownerId: 'u-001',
    memberCount: 8,
    createdAt: plain(-270 * DAY),
    updatedAt: plain(-2 * DAY),
  },
  {
    id: 'ws-orion',
    name: '猎户座内容实验室',
    slug: 'orion',
    description: '品牌内容与投放素材试验田',
    ownerId: 'u-002',
    memberCount: 5,
    createdAt: plain(-120 * DAY),
    updatedAt: plain(-9 * DAY),
  },
]

const WS_BY_ID = new Map(WORKSPACES.map((w) => [w.id, w]))
const WS_BY_SLUG = new Map(WORKSPACES.map((w) => [w.slug, w]))

/** 8 位成员，头像留空 → 前端走 monogram；角色覆盖 管理员/编辑/成员/审计/访客 */
const MEMBER_SEED = [
  { userId: 'u-001', username: 'nebula-admin', nickname: '星云管理员', email: 'admin@nebula.dev', roleId: 1, roleCode: 'admin', roleName: '空间管理员', joinedAt: -270 * DAY, lastLoginAt: -3 * HOUR },
  { userId: 'u-002', username: 'chenmo', nickname: '陈默', email: 'chenmo@nebula.dev', roleId: 2, roleCode: 'editor', roleName: '内容编辑', joinedAt: -240 * DAY, lastLoginAt: -35 * MIN },
  { userId: 'u-003', username: 'linxiao', nickname: '林筱', email: 'linxiao@nebula.dev', roleId: 2, roleCode: 'editor', roleName: '内容编辑', joinedAt: -210 * DAY, lastLoginAt: -2 * HOUR },
  { userId: 'u-004', username: 'zhaoyu', nickname: '赵屿', email: 'zhaoyu@nebula.dev', roleId: 3, roleCode: 'member', roleName: '成员', joinedAt: -188 * DAY, lastLoginAt: -1 * DAY },
  { userId: 'u-005', username: 'zhouke', nickname: '周珂', email: 'zhouke@nebula.dev', roleId: 3, roleCode: 'member', roleName: '成员', joinedAt: -96 * DAY, lastLoginAt: -6 * HOUR },
  { userId: 'u-006', username: 'wutong', nickname: '吴桐', email: 'wutong@nebula.dev', roleId: 3, roleCode: 'member', roleName: '成员', joinedAt: -74 * DAY, lastLoginAt: -3 * DAY },
  { userId: 'u-007', username: 'susiyuan', nickname: '苏思远', email: 'susiyuan@nebula.dev', roleId: 5, roleCode: 'guest', roleName: '访客', joinedAt: -45 * DAY, lastLoginAt: -2 * DAY },
  { userId: 'u-008', username: 'guxi', nickname: '顾曦', email: 'guxi@nebula.dev', roleId: 4, roleCode: 'auditor', roleName: '只读审计', joinedAt: -21 * DAY, lastLoginAt: -9 * HOUR },
]

const members = (workspaceId = 'ws-demo') =>
  MEMBER_SEED.map((m, i) => ({
    id: `wm-${String(i + 1).padStart(3, '0')}`,
    userId: m.userId,
    workspaceId,
    username: m.username,
    nickname: m.nickname,
    email: m.email,
    avatar: '',
    roleId: m.roleId,
    roleCode: m.roleCode,
    roleName: m.roleName,
    status: 1,
    joinedAt: iso(m.joinedAt),
    lastLoginAt: iso(m.lastLoginAt),
  }))

const ROLES = [
  {
    id: 1,
    roleCode: 'admin',
    roleName: '空间管理员',
    description: '拥有工作空间全部权限，可管理成员、角色与存储',
    roleType: 0,
    permissions: [...PERMISSIONS],
    userCount: 1,
    createdAt: plain(-270 * DAY),
    updatedAt: plain(-270 * DAY),
  },
  {
    id: 2,
    roleCode: 'editor',
    roleName: '内容编辑',
    description: '可读写文件、创建对外分享，并查看审计日志',
    roleType: 1,
    permissions: ['file:read', 'file:write', 'file:share', 'log:read'],
    userCount: 2,
    createdAt: plain(-268 * DAY),
    updatedAt: plain(-40 * DAY),
  },
  {
    id: 3,
    roleCode: 'member',
    roleName: '成员',
    description: '可读写空间内文件并分享给协作者',
    roleType: 0,
    permissions: ['file:read', 'file:write', 'file:share'],
    userCount: 3,
    createdAt: plain(-270 * DAY),
    updatedAt: plain(-40 * DAY),
  },
  {
    id: 4,
    roleCode: 'auditor',
    roleName: '只读审计',
    description: '自定义角色：可浏览文件并查看操作日志，不可修改',
    roleType: 1,
    permissions: ['file:read', 'log:read'],
    userCount: 1,
    createdAt: plain(-21 * DAY),
    updatedAt: plain(-6 * DAY),
  },
  {
    id: 5,
    roleCode: 'guest',
    roleName: '访客',
    description: '仅可浏览与下载被分享的文件',
    roleType: 0,
    permissions: ['file:read'],
    userCount: 1,
    createdAt: plain(-200 * DAY),
    updatedAt: plain(-60 * DAY),
  },
]

const WS_INVITATIONS = [
  { id: 'wsi-001', workspaceId: 'ws-demo', email: 'zhouke@nebula.dev', roleId: 3, roleName: '成员', roleCode: 'member', invitedBy: 'u-001', invitedByName: '星云管理员', status: 0, expiresAt: plain(6 * DAY), createdAt: plain(-1 * DAY) },
  { id: 'wsi-002', workspaceId: 'ws-demo', email: 'yangfan@nebula.dev', roleId: 5, roleName: '访客', roleCode: 'guest', invitedBy: 'u-003', invitedByName: '林筱', status: 0, expiresAt: plain(4 * DAY), createdAt: plain(-3 * DAY) },
  { id: 'wsi-003', workspaceId: 'ws-demo', email: 'zhengkai@nebula.dev', roleId: 2, roleName: '内容编辑', roleCode: 'editor', invitedBy: 'u-002', invitedByName: '陈默', status: 0, expiresAt: plain(2 * DAY), createdAt: plain(-6 * DAY) },
  { id: 'wsi-004', workspaceId: 'ws-demo', email: 'lifang@nebula.dev', roleId: 4, roleName: '只读审计', roleCode: 'auditor', invitedBy: 'u-001', invitedByName: '星云管理员', status: 2, expiresAt: plain(-2 * DAY), createdAt: plain(-11 * DAY) },
]

/* ============================================================================
 * 文件
 * ========================================================================== */
const TYPE_SUFFIX = {
  image: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'],
  video: ['mp4', 'mov', 'webm'],
  audio: ['mp3', 'wav', 'flac'],
  document: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'md', 'txt', 'csv'],
}

function kindOf(suffix, isDir) {
  if (isDir) return 'folder'
  const s = String(suffix || '').toLowerCase()
  for (const [type, list] of Object.entries(TYPE_SUFFIX)) if (list.includes(s)) return type
  return 'other'
}

const ROOT_FOLDERS = [
  { id: 'f-dir-design', name: '设计稿归档', files: 42, folders: 6 },
  { id: 'f-dir-report', name: '年度报告', files: 12, folders: 2 },
  { id: 'f-dir-client', name: '客户交付', files: 28, folders: 4 },
  { id: 'f-dir-meeting', name: '会议资料', files: 9, folders: 1 },
]

const ROOT_FILES = [
  { id: 'f-101', name: '产品路线图 2026Q4', suffix: 'pdf', size: 3_456_000, update: -35 * MIN },
  { id: 'f-102', name: '品牌规范 v3', suffix: 'fig', size: 22_800_000, update: -2 * HOUR },
  { id: 'f-103', name: '发布会开场视频', suffix: 'mp4', size: 184_000_000, update: -5 * HOUR },
  { id: 'f-104', name: '季度预算表', suffix: 'xlsx', size: 932_000, update: -8 * HOUR },
  { id: 'f-105', name: '团队合影-秋游', suffix: 'jpg', size: 4_120_000, update: -1 * DAY },
  { id: 'f-106', name: '会议纪要 1001', suffix: 'md', size: 18_400, update: -1 * DAY - 4 * HOUR },
  { id: 'f-107', name: '数据库备份', suffix: 'sql', size: 96_200_000, update: -2 * DAY },
  { id: 'f-108', name: 'logo 动效', suffix: 'json', size: 64_000, update: -3 * DAY },
  { id: 'f-109', name: '用户调研访谈记录', suffix: 'docx', size: 1_240_000, update: -4 * DAY },
  { id: 'f-110', name: '部署架构图', suffix: 'png', size: 2_640_000, update: -6 * DAY },
  { id: 'f-111', name: '接口联调说明', suffix: 'txt', size: 3_100, update: -9 * DAY },
]

const CHILD_FILES = {
  'f-dir-design': [
    { id: 'f-201', name: '首页视觉稿 v6', suffix: 'png', size: 8_400_000, update: -3 * HOUR },
    { id: 'f-202', name: '图标规范', suffix: 'svg', size: 186_000, update: -1 * DAY },
    { id: 'f-203', name: '动效分镜', suffix: 'mp4', size: 62_000_000, update: -2 * DAY },
  ],
  'f-dir-report': [
    { id: 'f-301', name: '2026 上半年财报', suffix: 'pdf', size: 5_600_000, update: -2 * DAY },
    { id: 'f-302', name: '数据附录', suffix: 'xlsx', size: 1_820_000, update: -2 * DAY - 3 * HOUR },
    { id: 'f-303', name: '结论摘要', suffix: 'docx', size: 420_000, update: -3 * DAY },
  ],
  'f-dir-client': [
    { id: 'f-401', name: '交付验收单', suffix: 'pdf', size: 640_000, update: -12 * HOUR },
    { id: 'f-402', name: '培训录屏', suffix: 'mp4', size: 320_000_000, update: -4 * DAY },
  ],
  'f-dir-meeting': [
    { id: 'f-501', name: '周会录音', suffix: 'mp3', size: 12_400_000, update: -1 * DAY },
    { id: 'f-502', name: '复盘白板照片', suffix: 'jpg', size: 3_900_000, update: -28 * HOUR },
  ],
}

const FILESHARE_FILES = [
  { id: 'f-601', name: '发布会主视觉-final', suffix: 'png', size: 6_820_000, update: -50 * MIN, pinned: true },
  { id: 'f-602', name: '产品路线图 2026Q4', suffix: 'pdf', size: 3_456_000, update: -2 * HOUR, pinned: true },
  { id: 'f-603', name: '品牌规范 v3', suffix: 'fig', size: 22_800_000, update: -6 * HOUR, pinned: false },
  { id: 'f-604', name: '交付给客户的素材', suffix: '', size: 0, isDir: true, update: -1 * DAY, pinned: false },
  { id: 'f-605', name: '归档 · 2026Q3', suffix: '', size: 0, isDir: true, update: -8 * DAY, pinned: false },
]

function fileVO(spec, parentId = 'root', owner = 'u-001') {
  const isDir = Boolean(spec.isDir)
  const display = isDir || !spec.suffix ? spec.name : `${spec.name}.${spec.suffix}`
  return {
    id: spec.id,
    objectKey: `nebula/${parentId}/${display}`,
    originalName: display,
    displayName: display,
    suffix: isDir ? '' : spec.suffix || '',
    size: spec.size,
    mimeType: isDir ? 'inode/directory' : 'application/octet-stream',
    isDir,
    parentId,
    userId: owner,
    uploadTime: iso((spec.update ?? -1 * DAY) - 3 * DAY),
    updateTime: iso(spec.update ?? -1 * DAY),
    lastAccessTime: iso((spec.update ?? -1 * DAY) + 20 * MIN),
    isFavorite: Boolean(spec.favorite),
    boardPinned: Boolean(spec.pinned),
    ...(isDir
      ? { includeFiles: spec.files ?? 0, includeFolders: spec.folders ?? 0, createTime: iso(-200 * DAY) }
      : {}),
  }
}

function rootEntries() {
  return [
    ...ROOT_FOLDERS.map((f) =>
      fileVO({ id: f.id, name: f.name, isDir: true, files: f.files, folders: f.folders, update: -1 * DAY }, 'root')
    ),
    ...ROOT_FILES.map((f) => fileVO(f, 'root')),
  ]
}

function allEntries() {
  const children = Object.entries(CHILD_FILES).flatMap(([parentId, list]) =>
    list.map((f) => fileVO(f, parentId))
  )
  return [...rootEntries(), ...children]
}

function folderPath(folderId) {
  const all = rootEntries().filter((f) => f.isDir)
  const target = all.find((f) => f.id === folderId)
  return target ? [{ ...target, displayName: '根目录' }, target].slice(1) : []
}

const RECYCLE_FILES = [
  { id: 'fr-001', displayName: '过期海报-初稿.png', suffix: 'png', size: 2_400_000, isDir: false, deleted: -6 * HOUR },
  { id: 'fr-002', displayName: '旧版品牌规范', suffix: '', size: 0, isDir: true, deleted: -2 * DAY },
  { id: 'fr-003', displayName: '废弃接口文档.md', suffix: 'md', size: 24_000, isDir: false, deleted: -5 * DAY },
  { id: 'fr-004', displayName: '会议录屏-未剪辑.mp4', suffix: 'mp4', size: 512_000_000, isDir: false, deleted: -12 * DAY },
]

/* ============================================================================
 * 备忘录（13 shared + 3 private，10 条/页）
 * ========================================================================== */
const MEMO_SEED = [
  ['m-001', '本周重点：移动端上传体验', 'shared', true, -2 * HOUR, -35 * MIN],
  ['m-002', '发布会物料清单（10.18）', 'shared', true, -5 * HOUR, -2 * HOUR],
  ['m-003', '存储配额调整方案', 'shared', false, -1 * DAY, -20 * HOUR],
  ['m-004', '设计走查问题汇总', 'shared', false, -1 * DAY - 3 * HOUR, -1 * DAY],
  ['m-005', '团队周会纪要 · W40', 'shared', false, -2 * DAY, -2 * DAY],
  ['m-006', '客户 A 交付风险与对策', 'shared', false, -2 * DAY - 6 * HOUR, -2 * DAY],
  ['m-007', '上传分片重试策略笔记', 'shared', false, -3 * DAY, -3 * DAY],
  ['m-008', '通知中心信息架构草稿', 'shared', false, -3 * DAY - 5 * HOUR, -3 * DAY],
  ['m-009', '三语文案待补清单', 'shared', false, -4 * DAY, -4 * DAY],
  ['m-010', 'CDN 回源排查记录', 'shared', false, -5 * DAY, -5 * DAY],
  ['m-011', '面试评估维度表', 'shared', false, -6 * DAY, -6 * DAY],
  ['m-012', '组件库迁移进度', 'shared', false, -7 * DAY, -7 * DAY],
  ['m-013', '十二月份预算初稿', 'shared', false, -9 * DAY, -9 * DAY],
  ['m-014', '个人待办（本周）', 'private', false, -4 * HOUR, -1 * HOUR],
  ['m-015', '面试反馈：前端 P6', 'private', false, -1 * DAY, -1 * DAY],
  ['m-016', '薪资沟通备忘', 'private', false, -4 * DAY, -4 * DAY],
]

const MEMO_BODIES = {
  'm-001': '<p>本周聚焦移动端上传链路的体验收口。</p><ul><li>分片重试从 3 次提到 5 次，失败后给明确重试入口</li><li>弱网下进度条改为「预估剩余时间」，不再只显示百分比</li><li>后台切换回前台要能自动续传</li></ul><p>验收：iOS Safari 与 Android Chrome 各跑一遍 1GB 视频上传。</p>',
  'm-002': '<p>10 月 18 日发布会需要准备的物料：</p><ol><li>主视觉（3 套尺寸）</li><li>开场视频 90s 成片与 3 段花絮</li><li>产品演示录屏 + 字幕</li><li>现场签到二维码与伴手礼清单</li></ol>',
  'm-003': '<p>当前空间已用 <strong>23.7 GB</strong>，按现有增速 11 月中旬触顶。</p><p>建议：归档 2026Q2 之前的原始素材到低频存储，预计释放 8.4 GB。</p>',
  'm-004': '<p>走查发现的问题按优先级排序：</p><ul><li>P0 深色模式下表格斑马纹对比不足</li><li>P1 移动端 Dock 遮挡内容底部</li><li>P2 空状态插画尺寸不统一</li></ul>',
  'm-005': '<p>周会结论：</p><ul><li>上传体验列为本周唯一 P0</li><li>通知中心下周三出信息架构稿</li><li>组件库迁移暂停一周，先保交付</li></ul>',
  'm-006': '<p>客户 A 的验收时间提前到 10.20。</p><p>风险：交付包缺 2 个模块的培训录屏。对策：本周四补录，周五内部预演一次。</p>',
  'm-007': '<p>分片上传失败主要来自 60s 超时。把单分片超时改成分片大小相关，5MB 分片给 120s。</p>',
  'm-008': '<p>通知中心分六组：提醒 / 会议 / 投票 / 好友申请 / 空间邀请 / 文件收集。</p><p>每组支持「消失」单条忽略，忽略状态存 localStorage。</p>',
  'm-009': '<p>待补语种：日语（ja-JP）、繁体（zh-TW）。</p><p>缺失词条集中在 <code>settings.nav</code> 与 <code>transfer.page</code>。</p>',
  'm-010': '<p>回源 502 集中在 21:00-22:00，怀疑源站限流。已在监控上加了 QPS 面板。</p>',
  'm-011': '<p>评估维度：工程能力 / 设计感 / 协作沟通 / 学习速度，各 1-5 分，2 名面试官独立打分后对齐。</p>',
  'm-012': '<p>已迁移 34/58 个组件。剩余集中在表单与图表类，依赖老版本的 <code>recharts</code>。</p>',
  'm-013': '<p>预算初稿：人力 62%，云资源 21%，外部合作 12%，预留 5%。</p>',
  'm-014': '<p>个人待办：</p><ul><li>周三前交上传体验走查报告</li><li>催一下审计日志的字段对齐</li><li>预约体检</li></ul>',
  'm-015': '<p>结论：通过。亮点是状态机设计清晰；建议补一下边界用例的测试覆盖。</p>',
  'm-016': '<p>沟通要点：调薪窗口在 11 月，需先提交上半年绩效自评。</p>',
}

const memos = () =>
  MEMO_SEED.map(([id, title, visibility, pinned, createdAt, updatedAt], i) => ({
    id,
    workspaceId: 'ws-demo',
    title,
    visibility,
    pinned,
    sortOrder: i,
    createdBy: i % 3 === 0 ? 'u-001' : i % 3 === 1 ? 'u-002' : 'u-003',
    createdAt: iso(createdAt),
    updatedAt: iso(updatedAt),
  }))

/* ============================================================================
 * 会议 / 投票 / 提醒
 * ========================================================================== */
const meetings = () => [
  {
    id: 'mtg-001',
    workspaceId: 'ws-demo',
    workspaceName: 'NEBULA 工作空间',
    workspaceSlug: 'nebula',
    roomId: 'room-nebula-001',
    title: '季度产品路线评审',
    startsAt: iso(-25 * MIN),
    createdBy: 'u-001',
    creatorName: '星云管理员',
    createdAt: iso(-2 * DAY),
    canEnter: true,
    status: 'OPEN',
    host: true,
    participantUserIds: ['u-001', 'u-002', 'u-003', 'u-005'],
  },
  {
    id: 'mtg-002',
    workspaceId: 'ws-demo',
    workspaceName: 'NEBULA 工作空间',
    workspaceSlug: 'nebula',
    roomId: 'room-nebula-002',
    title: '设计系统 2.0 对齐会',
    startsAt: iso(-6 * MIN),
    createdBy: 'u-003',
    creatorName: '林筱',
    createdAt: iso(-20 * HOUR),
    canEnter: true,
    status: 'OPEN',
    host: false,
    participantUserIds: ['u-001', 'u-003', 'u-004'],
  },
  {
    id: 'mtg-003',
    workspaceId: 'ws-demo',
    workspaceName: 'NEBULA 工作空间',
    workspaceSlug: 'nebula',
    roomId: 'room-nebula-003',
    title: '客户交付预演',
    startsAt: iso(15 * MIN),
    createdBy: 'u-001',
    creatorName: '星云管理员',
    createdAt: iso(-1 * DAY),
    canEnter: true,
    status: 'SCHEDULED',
    host: true,
    participantUserIds: ['u-001', 'u-002', 'u-006'],
  },
  {
    id: 'mtg-004',
    workspaceId: 'ws-demo',
    workspaceName: 'NEBULA 工作空间',
    workspaceSlug: 'nebula',
    roomId: 'room-nebula-004',
    title: '下周迭代排期',
    startsAt: iso(1 * DAY),
    createdBy: 'u-002',
    creatorName: '陈默',
    createdAt: iso(-6 * HOUR),
    canEnter: false,
    status: 'SCHEDULED',
    host: false,
    participantUserIds: ['u-002', 'u-003', 'u-004', 'u-007'],
  },
  {
    id: 'mtg-005',
    workspaceId: 'ws-demo',
    workspaceName: 'NEBULA 工作空间',
    workspaceSlug: 'nebula',
    roomId: 'room-nebula-005',
    title: '品牌视觉复盘',
    startsAt: iso(-1 * DAY),
    createdBy: 'u-001',
    creatorName: '星云管理员',
    createdAt: iso(-4 * DAY),
    canEnter: false,
    status: 'CLOSED',
    host: true,
    participantUserIds: ['u-001', 'u-003', 'u-008'],
  },
  {
    id: 'mtg-006',
    workspaceId: 'ws-demo',
    workspaceName: 'NEBULA 工作空间',
    workspaceSlug: 'nebula',
    roomId: 'room-nebula-006',
    title: '存储架构讨论',
    startsAt: iso(-2 * DAY),
    createdBy: 'u-002',
    creatorName: '陈默',
    createdAt: iso(-5 * DAY),
    canEnter: false,
    status: 'CLOSED',
    host: false,
    participantUserIds: ['u-001', 'u-002', 'u-006'],
  },
]

const pendingMeetings = () => meetings().filter((m) => m.status !== 'CLOSED').slice(0, 3)

const voteParticipants = (choices) =>
  MEMBER_SEED.slice(0, choices.length).map((m, i) => ({
    userId: m.userId,
    username: m.username,
    nickname: m.nickname,
    avatar: '',
    choice: choices[i],
  }))

const votes = () => [
  {
    id: 'vote-001',
    workspaceId: 'ws-demo',
    workspaceName: 'NEBULA 工作空间',
    workspaceSlug: 'nebula',
    title: '是否把上传体验列为本周唯一 P0？',
    createdBy: 'u-001',
    creatorName: '星云管理员',
    createdAt: iso(-3 * HOUR),
    agreeCount: 2,
    disagreeCount: 1,
    pendingCount: 1,
    myChoice: null,
    participant: true,
    host: true,
    participants: voteParticipants(['AGREE', 'AGREE', 'DISAGREE', null]),
  },
  {
    id: 'vote-002',
    workspaceId: 'ws-demo',
    workspaceName: 'NEBULA 工作空间',
    workspaceSlug: 'nebula',
    title: '11 月团建改到周六是否可行？',
    createdBy: 'u-003',
    creatorName: '林筱',
    createdAt: iso(-1 * DAY),
    agreeCount: 3,
    disagreeCount: 0,
    pendingCount: 2,
    myChoice: null,
    participant: true,
    host: false,
    participants: voteParticipants(['AGREE', 'AGREE', 'AGREE', null, null]),
  },
]

const reminders = () => [
  {
    id: 'rem-001',
    reminderId: 'rmd-001',
    workspaceId: 'ws-demo',
    workspaceName: 'NEBULA 工作空间',
    message: '今天 18:00 前把上传体验走查报告发到空间里',
    firedAt: iso(-12 * MIN),
  },
  {
    id: 'rem-002',
    reminderId: 'rmd-002',
    workspaceId: 'ws-demo',
    workspaceName: 'NEBULA 工作空间',
    message: '客户 A 交付包还差 2 份培训录屏，周四前补录',
    firedAt: iso(-3 * HOUR),
  },
  {
    id: 'rem-003',
    reminderId: 'rmd-003',
    workspaceId: 'ws-demo',
    workspaceName: 'NEBULA 工作空间',
    message: '每月 1 号例行归档 2026Q3 原始素材到低频存储',
    firedAt: iso(-1 * DAY - 2 * HOUR),
  },
]

/* ============================================================================
 * 文件收集
 * ========================================================================== */
const collections = () => [
  {
    id: 'c1',
    collectionName: '交作业 · 开放日主视觉',
    description: '周珂 发起的文件收集，把文件拖进下面的区域即可，截止时间 10 月 8 日 23:59。',
    targetFolderId: 'f-dir-design',
    targetFolderName: '设计稿归档',
    expireTime: iso(6 * DAY),
    permanent: false,
    expired: false,
    hasAccessCode: false,
    maxFileSize: 2_147_483_648,
    allowedExtensions: null,
    status: 'OPEN',
    submissionCount: 4,
    fileCount: 11,
    totalSize: 268_000_000,
    createdAt: iso(-3 * DAY),
    updatedAt: iso(-4 * HOUR),
  },
  {
    id: 'c2',
    collectionName: '客户 A 交付材料回收',
    description: '收集最终交付的合同扫描件与验收单。',
    targetFolderId: 'f-dir-client',
    targetFolderName: '客户交付',
    expireTime: iso(20 * DAY),
    permanent: false,
    expired: false,
    hasAccessCode: true,
    maxFileSize: 524_288_000,
    allowedExtensions: 'pdf,docx,zip',
    status: 'OPEN',
    submissionCount: 2,
    fileCount: 5,
    totalSize: 42_600_000,
    createdAt: iso(-9 * DAY),
    updatedAt: iso(-1 * DAY),
  },
  {
    id: 'c3',
    collectionName: '秋游照片征集（已结束）',
    description: '活动已结束，感谢大家投稿。',
    targetFolderId: 'f-dir-meeting',
    targetFolderName: '会议资料',
    expireTime: iso(-4 * DAY),
    permanent: false,
    expired: true,
    hasAccessCode: false,
    maxFileSize: 104_857_600,
    allowedExtensions: 'jpg,png',
    status: 'CLOSED',
    submissionCount: 6,
    fileCount: 38,
    totalSize: 620_000_000,
    createdAt: iso(-20 * DAY),
    updatedAt: iso(-4 * DAY),
  },
]

const submissions = (collectionId) => {
  const seed = {
    c1: [
      { id: 'sub-001', submitterName: '周珂', files: 3, size: 84_000_000, created: -4 * HOUR, status: 'COMPLETED' },
      { id: 'sub-002', submitterName: '杨帆', files: 2, size: 36_000_000, created: -1 * DAY, status: 'COMPLETED' },
      { id: 'sub-003', submitterName: '郑凯', files: 1, size: 12_000_000, created: -2 * DAY, status: 'COMPLETED' },
      { id: 'sub-004', submitterName: '外部访客 · 林一', files: 5, size: 136_000_000, created: -3 * DAY, status: 'UPLOADING' },
    ],
    c2: [
      { id: 'sub-101', submitterName: '客户 A · 张工', files: 3, size: 30_600_000, created: -1 * DAY, status: 'COMPLETED' },
      { id: 'sub-102', submitterName: '客户 A · 李经理', files: 2, size: 12_000_000, created: -5 * DAY, status: 'COMPLETED' },
    ],
    c3: [
      { id: 'sub-201', submitterName: '吴桐', files: 12, size: 210_000_000, created: -12 * DAY, status: 'COMPLETED' },
      { id: 'sub-202', submitterName: '苏思远', files: 9, size: 180_000_000, created: -13 * DAY, status: 'COMPLETED' },
      { id: 'sub-203', submitterName: '顾曦', files: 17, size: 230_000_000, created: -14 * DAY, status: 'COMPLETED' },
    ],
  }
  return (seed[collectionId] || []).map((s) => ({
    id: s.id,
    submitterName: s.submitterName,
    submitterIp: '203.0.113.' + (10 + s.files),
    folderId: 'f-sub-' + s.id,
    fileCount: s.files,
    totalSize: s.size,
    status: s.status,
    createdAt: iso(s.created),
    completedAt: s.status === 'COMPLETED' ? iso(s.created + 26 * MIN) : null,
  }))
}

/* ============================================================================
 * 分享
 * ========================================================================== */
const SHARES = [
  { id: '8f3c2a91', shareName: '2026 Q4 产品路线图', fileCount: 4, viewCount: 128, downloadCount: 37, createdAt: -2 * DAY, expire: 3 * DAY, permanent: false, code: null, scope: 'preview,download', maxView: 500, maxDownload: 200 },
  { id: 'sh-2f91c4', shareName: '发布会主视觉（对外）', fileCount: 6, viewCount: 342, downloadCount: 96, createdAt: -5 * DAY, expire: 10 * DAY, permanent: false, code: '7x2p', scope: 'preview', maxView: 1000, maxDownload: 0 },
  { id: 'sh-77aa30', shareName: '团队素材长期共享', fileCount: 18, viewCount: 902, downloadCount: 214, createdAt: -60 * DAY, expire: null, permanent: true, code: null, scope: 'preview,download', maxView: 0, maxDownload: 0 },
  { id: 'expired00', shareName: '已过期的旧版规范', fileCount: 2, viewCount: 44, downloadCount: 5, createdAt: -70 * DAY, expire: -12 * DAY, permanent: false, code: null, scope: 'preview,download', maxView: 0, maxDownload: 0 },
  { id: 'locked001', shareName: '需要提取码的合同扫描件', fileCount: 3, viewCount: 61, downloadCount: 12, createdAt: -8 * DAY, expire: 14 * DAY, permanent: false, code: 'a9k4', scope: 'preview,download', maxView: 200, maxDownload: 80 },
]

const shareVO = (s) => ({
  id: s.id,
  shareName: s.shareName,
  shareUrl: `/s/${s.id}`,
  shareCode: s.code,
  expireTime: s.expire == null ? null : iso(s.expire),
  isPermanent: s.permanent,
  viewCount: s.viewCount,
  downloadCount: s.downloadCount,
  maxViewCount: s.maxView,
  maxDownloadCount: s.maxDownload,
  fileCount: s.fileCount,
  createdAt: iso(s.createdAt),
  scope: s.scope,
})

const shareThin = (s, isExpireOverride) => ({
  id: s.id,
  shareName: s.shareName,
  expireTime: s.expire == null ? null : iso(s.expire),
  fileCount: s.fileCount,
  hasCheckCode: Boolean(s.code),
  isExpire: isExpireOverride ?? Boolean(s.expire != null && s.expire < 0),
  scope: s.scope,
})

const SHARE_ITEMS = [
  { id: 'f-601', name: '发布会主视觉-final', suffix: 'png', size: 6_820_000, update: -50 * MIN },
  { id: 'f-602', name: '产品路线图 2026Q4', suffix: 'pdf', size: 3_456_000, update: -2 * HOUR },
  { id: 'f-603', name: '品牌规范 v3', suffix: 'fig', size: 22_800_000, update: -6 * HOUR },
  { id: 'f-606', name: '对外可公开素材', suffix: '', size: 0, isDir: true, update: -1 * DAY },
]

const shareItems = (spec) =>
  (spec || SHARE_ITEMS).map((f) => fileVO(f, 'root', 'u-001'))

const SHARE_ACCESS_RECORDS = [
  { id: 'ar-001', accessIp: '203.0.113.24', accessAddress: '上海市 电信', browser: 'Safari 18.0', os: 'macOS 15.1', access: -40 * MIN },
  { id: 'ar-002', accessIp: '198.51.100.7', accessAddress: '北京市 联通', browser: 'Chrome 130', os: 'Windows 11', access: -5 * HOUR },
  { id: 'ar-003', accessIp: '198.51.100.88', accessAddress: '深圳市 移动', browser: 'Edge 130', os: 'Windows 10', access: -1 * DAY },
  { id: 'ar-004', accessIp: '203.0.113.140', accessAddress: '杭州市 电信', browser: 'Chrome 129', os: 'Android 15', access: -2 * DAY },
]

/* ============================================================================
 * 存储平台
 * ========================================================================== */
const STORAGE_PLATFORMS = [
  { id: 1, name: '本地磁盘', identifier: 'local', configScheme: '[{"identifier":"basePath","label":"存储根路径","dataType":"string","validation":{"required":true}}]', icon: 'hard-drive', link: 'https://docs.spring.io/spring-integration/reference/ftp.html', desc: '直接落到服务器本地目录，开发环境默认方案', isDefault: 1 },
  { id: 2, name: '阿里云 OSS', identifier: 'aliyun', configScheme: '[{"identifier":"endpoint","label":"Endpoint","dataType":"string","validation":{"required":true}},{"identifier":"accessKeyId","label":"AccessKeyId","dataType":"string","validation":{"required":true}},{"identifier":"accessKeySecret","label":"AccessKeySecret","dataType":"string","validation":{"required":true}},{"identifier":"bucketName","label":"BucketName","dataType":"string","validation":{"required":true}}]', icon: 'cloud', link: 'https://help.aliyun.com/product/31815.html', desc: '对象存储 OSS，适合大文件与 CDN 回源', isDefault: 0 },
  { id: 3, name: '腾讯云 COS', identifier: 'tencent', configScheme: '[{"identifier":"region","label":"Region","dataType":"string","validation":{"required":true}},{"identifier":"secretId","label":"SecretId","dataType":"string","validation":{"required":true}},{"identifier":"secretKey","label":"SecretKey","dataType":"string","validation":{"required":true}},{"identifier":"bucketName","label":"BucketName","dataType":"string","validation":{"required":true}}]', icon: 'cloud', link: 'https://cloud.tencent.com/document/product/436', desc: '腾讯云对象存储', isDefault: 0 },
  { id: 4, name: '七牛云 Kodo', identifier: 'qiniu', configScheme: '[{"identifier":"accessKey","label":"AccessKey","dataType":"string","validation":{"required":true}},{"identifier":"secretKey","label":"SecretKey","dataType":"string","validation":{"required":true}},{"identifier":"bucketName","label":"BucketName","dataType":"string","validation":{"required":true}},{"identifier":"domain","label":"访问域名","dataType":"string","validation":{"required":true}}]', icon: 'cloud', link: 'https://developer.qiniu.com/kodo', desc: '七牛云对象存储，自带图片处理', isDefault: 0 },
  { id: 5, name: 'MinIO', identifier: 'minio', configScheme: '[{"identifier":"endpoint","label":"Endpoint","dataType":"string","validation":{"required":true}},{"identifier":"accessKey","label":"AccessKey","dataType":"string","validation":{"required":true}},{"identifier":"secretKey","label":"SecretKey","dataType":"string","validation":{"required":true}},{"identifier":"bucketName","label":"BucketName","dataType":"string","validation":{"required":true}}]', icon: 'server', link: 'https://min.io/docs/minio/linux/index.html', desc: '自建 S3 兼容存储', isDefault: 0 },
]

const storageSettingVO = (id, platformId, enabled, remark, createdOffset) => ({
  id,
  storagePlatform: STORAGE_PLATFORMS.find((p) => p.id === platformId),
  configData: '{"basePath":"/data/nebula"}',
  enabled,
  userId: 'u-001',
  remark,
  createdAt: iso(createdOffset),
  updatedAt: iso(createdOffset + HOUR),
})

const STORAGE_SETTINGS = () => [
  storageSettingVO(1, 1, 1, '本地开发默认', -200 * DAY),
  storageSettingVO(2, 2, 1, '生产环境主存储 · 华东 1', -120 * DAY),
]

const ACTIVE_PLATFORMS = () => [
  { settingId: '1', platformIdentifier: 'local', platformName: '本地磁盘', platformIcon: 'hard-drive', isEnabled: true, remark: '本地开发默认', createdAt: iso(-200 * DAY), updatedAt: iso(-199 * DAY) },
  { settingId: '2', platformIdentifier: 'aliyun', platformName: '阿里云 OSS', platformIcon: 'cloud', isEnabled: true, remark: '生产环境主存储 · 华东 1', createdAt: iso(-120 * DAY), updatedAt: iso(-119 * DAY) },
]

/* ============================================================================
 * 操作日志
 * ========================================================================== */
const LOG_SEED = [
  ['FILE_UPLOAD', '上传文件', 'FILE', '发布会主视觉-final.png', 1, '文件大小：6820000'],
  ['FILE_DOWNLOAD', '下载文件', 'FILE', '产品路线图 2026Q4.pdf', 1, '文件大小：3456000'],
  ['FILE_RENAME', '重命名文件', 'FILE', '会议纪要 1001.md → 会议纪要 1001（终版）.md', 1, null],
  ['FILE_DELETE', '删除文件', 'FILE', '过期海报-初稿.png', 1, null],
  ['FILE_MOVE', '移动文件', 'FILE', '图标规范.svg → 设计稿归档', 1, null],
  ['FOLDER_CREATE', '新建文件夹', 'FOLDER', '客户交付', 1, null],
  ['SHARE_CREATE', '创建分享', 'SHARE', '2026 Q4 产品路线图', 1, '有效期 7 天'],
  ['SHARE_CANCEL', '取消分享', 'SHARE', '已过期的旧版规范', 1, null],
  ['MEMBER_INVITE', '邀请成员', 'MEMBER', 'zhouke@nebula.dev', 1, '角色：编辑'],
  ['MEMBER_ROLE_UPDATE', '调整成员角色', 'MEMBER', '顾曦：访客 → 只读审计', 1, null],
  ['MEMBER_REMOVE', '移除成员', 'MEMBER', 'wutong@nebula.dev', 1, null],
  ['ROLE_CREATE', '创建角色', 'ROLE', '内容审核员', 1, '权限 3 项'],
  ['STORAGE_UPDATE', '更新存储配置', 'STORAGE', '阿里云 OSS', 1, null],
  ['LOGIN', '登录系统', 'AUTH', 'nebula-admin', 1, 'IP 203.0.113.9'],
  ['MEETING_CREATE', '创建会议', 'MEETING', '客户交付预演', 1, null],
  ['MEETING_CLOSE', '结束会议', 'MEETING', '品牌视觉复盘', 1, null],
  ['MEMO_CREATE', '新建备忘录', 'MEMO', '本周重点：移动端上传体验', 1, null],
  ['MEMO_UPDATE', '更新备忘录', 'MEMO', '存储配额调整方案', 1, null],
  ['COLLECTION_CREATE', '创建文件收集', 'COLLECTION', '交作业 · 开放日主视觉', 1, null],
  ['VOTE_CREATE', '发起投票', 'VOTE', '是否把上传体验列为本周唯一 P0？', 1, null],
  ['FILE_UPLOAD', '上传文件', 'FILE', '数据库备份.sql', 0, '文件大小：96200000'],
  ['FILE_DELETE', '删除文件', 'FILE', '旧版品牌规范', 1, null],
]

const operationLogs = () =>
  Array.from({ length: 42 }, (_, i) => {
    const [type, name, targetType, targetName, status, detail] = LOG_SEED[i % LOG_SEED.length]
    const op = MEMBER_SEED[i % MEMBER_SEED.length]
    // 时间从「25 分钟前」一路铺到「约 30 天前」，让时间列有今天/昨天/上周的层次
    const offset =
      i === 0 ? -25 * MIN : i === 1 ? -2 * HOUR : i === 2 ? -7 * HOUR : -(i * 17 * HOUR) - (i % 5) * 11 * MIN
    return {
      id: 1000 - i,
      operatorId: op.userId,
      operatorName: op.nickname,
      workspaceId: 'ws-demo',
      operationType: type,
      operationName: name,
      targetType,
      targetId: `${targetType.toLowerCase()}-${100 + i}`,
      targetName,
      detail: detail ?? undefined,
      operationIp: `203.0.113.${20 + (i % 200)}`,
      userAgent: i % 2 ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/18.0' : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36',
      status,
      operationTime: iso(offset),
    }
  })

/* ============================================================================
 * 传输任务
 * ========================================================================== */
const transferTasks = () => {
  const mk = (id, name, size, status, progress, extra = {}) => ({
    taskId: id,
    taskType: 'upload',
    userId: 'u-001',
    parentId: 'root',
    objectKey: `nebula/root/${name}`,
    fileName: name,
    fileSize: size,
    suffix: name.includes('.') ? name.split('.').pop() : '',
    totalChunks: Math.max(1, Math.ceil(size / 5_242_880)),
    uploadedChunks: Math.round((Math.max(1, Math.ceil(size / 5_242_880)) * progress) / 100),
    chunkSize: 5_242_880,
    storagePlatformSettingId: '2',
    status,
    startTime: iso(extra.start ?? -1 * HOUR),
    completeTime: extra.complete == null ? undefined : iso(extra.complete),
    progress,
    speed: extra.speed ?? 0,
    remainTime: extra.remain ?? 0,
    uploadedSize: Math.round((size * progress) / 100),
    ...(extra.errorMsg ? { errorMsg: extra.errorMsg } : {}),
  })
  return [
    mk('t-9f31a2', '2026-Q4产品路线图.pdf', 18_400_000, 'uploading', 62, { start: -14 * MIN, speed: 2_460_000, remain: 3 }),
    mk('t-7c22b8', '发布会开场视频.mp4', 184_000_000, 'uploading', 23, { start: -6 * MIN, speed: 5_120_000, remain: 28 }),
    mk('t-4a90ef', '品牌规范v2.fig', 22_800_000, 'paused', 45, { start: -2 * HOUR, speed: 0, remain: 0 }),
    mk('t-2b71cd', '团队合影-秋游.jpg', 4_120_000, 'completed', 100, { start: -3 * HOUR, complete: -3 * HOUR + 4 * MIN }),
    mk('t-6d10aa', '设计稿归档.zip', 96_200_000, 'completed', 100, { start: -5 * HOUR, complete: -5 * HOUR + 21 * MIN }),
    mk('t-1e55f0', '数据库备份.sql', 96_200_000, 'failed', 37, { start: -26 * HOUR, errorMsg: '分片 12 上传超时（60s）' }),
    mk('t-3f8c41', '会议纪要 1001.md', 18_400, 'canceled', 10, { start: -30 * HOUR }),
  ]
}

/* ============================================================================
 * IM
 * ========================================================================== */
const imFriends = () => [
  { friendId: 'u-002', username: 'chenmo', nickname: '陈默', avatar: '', email: 'chenmo@nebula.dev', remark: '设计组 · 陈默', status: 'ACCEPTED', createdAt: iso(-200 * DAY) },
  { friendId: 'u-003', username: 'linxiao', nickname: '林筱', avatar: '', email: 'linxiao@nebula.dev', remark: null, status: 'ACCEPTED', createdAt: iso(-180 * DAY) },
  { friendId: 'u-004', username: 'zhaoyu', nickname: '赵屿', avatar: '', email: 'zhaoyu@nebula.dev', remark: '前端 · 赵屿', status: 'ACCEPTED', createdAt: iso(-150 * DAY) },
  { friendId: 'u-005', username: 'zhouke', nickname: '周珂', avatar: '', email: 'zhouke@nebula.dev', remark: null, status: 'ACCEPTED', createdAt: iso(-90 * DAY) },
  { friendId: 'u-008', username: 'guxi', nickname: '顾曦', avatar: '', email: 'guxi@nebula.dev', remark: null, status: 'ACCEPTED', createdAt: iso(-20 * DAY) },
]

const friendRequests = () => [
  { friendId: 'u-006', username: 'wutong', nickname: '吴桐', avatar: '', email: 'wutong@nebula.dev', remark: '同在 NEBULA 空间', status: 'PENDING', createdAt: iso(-2 * HOUR) },
  { friendId: 'u-007', username: 'susiyuan', nickname: '苏思远', avatar: '', email: 'susiyuan@nebula.dev', remark: null, status: 'PENDING', createdAt: iso(-1 * DAY - 3 * HOUR) },
  { friendId: 'u-108', username: 'heyan', nickname: '何岩', avatar: '', email: 'heyan@partner.dev', remark: '发布会合作方', status: 'PENDING', createdAt: iso(-2 * DAY - 5 * HOUR) },
]

const conversations = () => [
  { conversationId: 'c-single-u-002', convType: 'single', peerUserId: 'u-002', peerUsername: 'chenmo', peerNickname: '陈默', peerAvatar: '', unreadCount: 3, lastMessageId: 1024, lastContent: '主视觉的深色版本我再出一版，晚上发你', lastTime: iso(-8 * MIN), pinned: true, muted: false },
  { conversationId: 'c-group-design', convType: 'group', groupId: 'g-design', groupName: '设计系统 2.0', groupAvatar: '', unreadCount: 2, lastMessageId: 1018, lastContent: '组件清单我更新到共享备忘录了', lastTime: iso(-45 * MIN), pinned: true, muted: false },
  { conversationId: 'c-single-u-003', convType: 'single', peerUserId: 'u-003', peerUsername: 'linxiao', peerNickname: '林筱', peerAvatar: '', unreadCount: 2, lastMessageId: 1009, lastContent: '走查报告我补了三条 P1', lastTime: iso(-3 * HOUR), pinned: false, muted: false },
  { conversationId: 'c-group-delivery', convType: 'group', groupId: 'g-delivery', groupName: '客户 A 交付群', groupAvatar: '', unreadCount: 0, lastMessageId: 998, lastContent: '验收单已签收，谢谢大家', lastTime: iso(-1 * DAY), pinned: false, muted: true },
]

const IM_FILE_CONTENT = JSON.stringify({
  url: '/files/f-602?token=mock',
  name: '产品路线图 2026Q4.pdf',
  size: 3_456_000,
  mime: 'application/pdf',
})
const IM_IMAGE_CONTENT = JSON.stringify({
  url: '/files/f-601?token=mock',
  name: '发布会主视觉-final.png',
  size: 6_820_000,
  mime: 'image/png',
  width: 1600,
  height: 900,
})

const imHistory = (conversationId) => ({
  messages: [
    {
      id: 1001,
      clientMsgId: 'cm-1001',
      conversationId,
      senderId: 'u-002',
      senderUsername: 'chenmo',
      senderNickname: '陈默',
      senderAvatar: '',
      content: '主视觉第一版传空间了，帮忙看下暗色下的对比度',
      msgType: 'TEXT',
      createdAt: iso(-56 * MIN),
    },
    {
      id: 1002,
      clientMsgId: 'cm-1002',
      conversationId,
      senderId: 'u-001',
      senderUsername: 'nebula-admin',
      senderNickname: '星云管理员',
      senderAvatar: '',
      content: '收到，暗色下图标确实弱了点，我顺手把规范也标一下',
      msgType: 'TEXT',
      createdAt: iso(-48 * MIN),
    },
    {
      id: 1003,
      clientMsgId: 'cm-1003',
      conversationId,
      senderId: 'u-002',
      senderUsername: 'chenmo',
      senderNickname: '陈默',
      senderAvatar: '',
      content: IM_FILE_CONTENT,
      msgType: 'FILE',
      createdAt: iso(-46 * MIN),
    },
    {
      id: 1004,
      clientMsgId: 'cm-1004',
      conversationId,
      senderId: 'u-001',
      senderUsername: 'nebula-admin',
      senderNickname: '星云管理员',
      senderAvatar: '',
      content: '这份路线图我按改后的对比度更新了一版，你对比看看',
      msgType: 'TEXT',
      createdAt: iso(-30 * MIN),
      quoteMessageId: 1003,
      quoteSenderId: 'u-002',
      quoteSenderName: '陈默',
      quoteContent: '产品路线图 2026Q4.pdf',
      quoteMsgType: 'FILE',
      quoteRecalled: false,
    },
    {
      id: 1005,
      clientMsgId: 'cm-1005',
      conversationId,
      senderId: 'u-002',
      senderUsername: 'chenmo',
      senderNickname: '陈默',
      senderAvatar: '',
      content: IM_IMAGE_CONTENT,
      msgType: 'IMAGE',
      createdAt: iso(-26 * MIN),
    },
    {
      id: 1010,
      clientMsgId: 'cm-1010',
      conversationId,
      senderId: 'u-003',
      senderUsername: 'linxiao',
      senderNickname: '林筱',
      senderAvatar: '',
      content: '我把走查问题整理成备忘录了，标了 P0/P1',
      msgType: 'TEXT',
      createdAt: iso(-3 * HOUR),
    },
    {
      id: 1024,
      clientMsgId: 'cm-1024',
      conversationId,
      senderId: 'u-002',
      senderUsername: 'chenmo',
      senderNickname: '陈默',
      senderAvatar: '',
      content: '主视觉的深色版本我再出一版，晚上发你',
      msgType: 'TEXT',
      createdAt: iso(-8 * MIN),
    },
  ],
  peerLastReadMessageId: 1010,
})

const imGroups = () => [
  { id: 'g-design', name: '设计系统 2.0', avatar: '', ownerId: 'u-003', notice: '组件清单与走查问题都在共享备忘录里', conversationId: 'c-group-design', memberCount: 5, createdAt: iso(-60 * DAY) },
  { id: 'g-delivery', name: '客户 A 交付群', avatar: '', ownerId: 'u-001', notice: '交付节点：10.20 验收', conversationId: 'c-group-delivery', memberCount: 4, createdAt: iso(-40 * DAY) },
]

const imInbox = () => conversations()

/* ============================================================================
 * 分页/筛选工具
 * ========================================================================== */
function pageOf(list, q, defaultSize = 10) {
  const page = Math.max(1, Number(q.get('page') || q.get('pageNum') || 1) || 1)
  const sizeRaw = q.get('pageSize') || q.get('size') || defaultSize
  const size = Math.max(1, Number(sizeRaw) || defaultSize)
  const start = (page - 1) * size
  return { records: list.slice(start, start + size), total: list.length }
}

function filterFiles(list, q) {
  let out = [...list]
  const keyword = (q.get('keyword') || '').trim()
  if (keyword) out = out.filter((f) => f.displayName.toLowerCase().includes(keyword.toLowerCase()))
  const fileType = q.get('fileType')
  if (fileType && fileType !== 'all') out = out.filter((f) => kindOf(f.suffix, f.isDir) === fileType)
  if (q.get('isFavorite') === 'true') out = out.filter((f) => f.isFavorite)
  if (q.get('isDir') === 'true') out = out.filter((f) => f.isDir)
  if (q.get('isRecents') === 'true') {
    out = out
      .filter((f) => !f.isDir)
      .sort((a, b) => new Date(b.lastAccessTime).getTime() - new Date(a.lastAccessTime).getTime())
      .slice(0, 12)
    return out
  }
  const orderBy = q.get('orderBy') || 'updateTime'
  const dir = (q.get('orderDirection') || 'DESC').toUpperCase() === 'ASC' ? 1 : -1
  out.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
    if (orderBy === 'displayName' || orderBy === 'originalName') {
      return a.displayName.localeCompare(b.displayName, 'zh-CN') * dir
    }
    if (orderBy === 'size') return (a.size - b.size) * dir
    return (new Date(b.updateTime).getTime() - new Date(a.updateTime).getTime()) * -dir
  })
  return out
}

/* ============================================================================
 * 路由表（顺序敏感：具体路径在前，通配在后）
 * ctx = { path, q, method, body, json, wsId }
 * ========================================================================== */

/** 操作日志分页（`/apis/logs/operation/pages` 与兼容别名 `/apis/log/pages` 共用同一份数据） */
function operationLogPage(ctx) {
  let list = operationLogs()
  const keyword = (ctx.q.get('keyword') || '').trim().toLowerCase()
  if (keyword) {
    list = list.filter((l) =>
      [l.operationName, l.operatorName, l.targetName, l.operationType]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(keyword))
    )
  }
  const type = ctx.q.get('operationType') || ctx.q.get('action') || ctx.q.get('module')
  if (type) list = list.filter((l) => l.operationType === type || l.targetType === type)
  const status = ctx.q.get('status')
  if (status !== null && status !== '') list = list.filter((l) => String(l.status) === String(status))
  return pageOf(list, ctx.q, 10)
}

/** 角色详情（`/apis/role/:id` 与别名 `/apis/roles/:id` 共用） */
const roleDetail = (ctx) => ROLES.find((r) => r.id === Number(ctx.params[0])) || ROLES[1]

const routes = [
  /* ---- 认证 / 用户 ---- */
  ['POST', /^\/apis\/auth\/login$/, () => ({ id: USER.id, username: USER.username })],
  ['POST', /^\/apis\/auth\/login\/email-code$/, () => null],
  ['POST', /^\/apis\/auth\/logout$/, () => null],
  ['GET', /^\/apis\/user\/info$/, () => USER],
  ['PUT', /^\/apis\/user\/info$/, () => USER],
  ['POST', /^\/apis\/user\/register$/, () => USER],
  ['PUT', /^\/apis\/user\/avatar$/, () => null],
  ['POST', /^\/apis\/user\/password$/, () => null],
  ['PUT', /^\/apis\/user\/password$/, () => null],
  ['GET', /^\/apis\/user\/forget-password\/code\//, () => null],
  ['PUT', /^\/apis\/user\/forget-password$/, () => null],
  ['POST', /^\/apis\/user\/update-mail\/code\//, () => null],
  ['PUT', /^\/apis\/user\/update-mail\/code\//, () => null],
  ['GET', /^\/apis\/user\/transfer\/setting$/, () => ({
    id: 1,
    userId: USER.id,
    downloadLocation: 'D:\\Downloads\\NEBULA',
    isDefaultDownloadLocation: 1,
    downloadSpeedLimit: 0,
    concurrentUploadQuantity: 3,
    concurrentDownloadQuantity: 2,
    chunkSize: 5_242_880,
    createdAt: plain(-200 * DAY),
    updatedAt: plain(-9 * DAY),
  })],
  ['PUT', /^\/apis\/user\/transfer\/setting$/, (ctx) => ({
    id: 1,
    userId: USER.id,
    downloadLocation: 'D:\\Downloads\\NEBULA',
    isDefaultDownloadLocation: 1,
    downloadSpeedLimit: 0,
    concurrentUploadQuantity: 3,
    concurrentDownloadQuantity: 2,
    chunkSize: 5_242_880,
    ...(ctx.json || {}),
    updatedAt: plain(0),
  })],

  /* ---- 工作空间 ---- */
  ['GET', /^\/apis\/workspace\/list$/, () => WORKSPACES],
  ['GET', /^\/apis\/workspace\/current$/, (ctx) => {
    const ws = WS_BY_ID.get(ctx.wsId) || WORKSPACES[0]
    const role = ROLES[0]
    return {
      ...ws,
      roleCode: role.roleCode,
      roleName: role.roleName,
      permissions: role.permissions,
      currentRole: {
        id: role.id,
        roleCode: role.roleCode,
        roleName: role.roleName,
        permissions: role.permissions,
      },
    }
  }],
  ['POST', /^\/apis\/workspace$/, (ctx) => ({ ...WORKSPACES[0], ...(ctx.json || {}) })],
  ['PUT', /^\/apis\/workspace$/, (ctx) => ({ ...WORKSPACES[0], ...(ctx.json || {}) })],
  ['DELETE', /^\/apis\/workspace$/, () => null],
  ['GET', /^\/apis\/workspace\/check-slug$/, (ctx) => ctx.q.get('slug') !== 'nebula'],
  ['GET', /^\/apis\/workspace\/members$/, (ctx) => {
    const list = members(ctx.wsId || 'ws-demo')
    const keyword = (ctx.q.get('keyword') || '').trim().toLowerCase()
    const filtered = keyword
      ? list.filter(
          (m) =>
            m.nickname.toLowerCase().includes(keyword) ||
            m.username.toLowerCase().includes(keyword) ||
            m.email.toLowerCase().includes(keyword)
        )
      : list
    return pageOf(filtered, ctx.q, 10)
  }],
  ['PUT', /^\/apis\/workspace\/members\/([^/]+)\/role$/, () => null],
  ['DELETE', /^\/apis\/workspace\/members\/([^/]+)$/, () => null],
  ['GET', /^\/apis\/workspace\/invitations$/, () => WS_INVITATIONS],
  ['POST', /^\/apis\/workspace\/invitations$/, (ctx) => {
    const roleId = ctx.json?.roleId ?? 3
    const role = ROLES.find((r) => r.id === roleId) || ROLES[2]
    return {
      id: 'wsi-new-' + Date.now().toString(36),
      workspaceId: 'ws-demo',
      email: ctx.json?.email ?? 'newbie@nebula.dev',
      roleId: role.id,
      roleName: role.roleName,
      roleCode: role.roleCode,
      invitedBy: 'u-001',
      invitedByName: '星云管理员',
      status: 0,
      expiresAt: plain(7 * DAY),
      createdAt: plain(0),
    }
  }],
  ['DELETE', /^\/apis\/workspace\/invitations\/([^/]+)$/, () => null],

  /* ---- 角色 / 权限 ---- */
  ['GET', /^\/apis\/role\/list$/, () => ROLES.map(({ permissions, ...rest }) => rest)],
  ['POST', /^\/apis\/role$/, (ctx) => ({
    id: 90,
    roleCode: ctx.json?.roleCode ?? 'custom',
    roleName: ctx.json?.roleName ?? '自定义角色',
    description: ctx.json?.description ?? null,
    roleType: 1,
    permissions: ctx.json?.permissions ?? [],
    userCount: 0,
    createdAt: plain(0),
    updatedAt: plain(0),
  })],
  ['GET', /^\/apis\/role\/([^/]+)$/, roleDetail],
  ['PUT', /^\/apis\/role\/([^/]+)$/, (ctx) => {
    const id = Number(ctx.params[0])
    return { ...(ROLES.find((r) => r.id === id) || ROLES[1]), ...(ctx.json || {}) }
  }],
  ['DELETE', /^\/apis\/role\/([^/]+)$/, () => null],
  /* 兼容别名：/apis/roles（含 permissions[]），供 QA / 外部脚本直接 curl */
  ['GET', /^\/apis\/roles$/, () => ROLES],
  ['GET', /^\/apis\/roles\/([^/]+)$/, roleDetail],
  ['GET', /^\/apis\/permission\/list$/, () => PERMISSION_DEFS],

  /* ---- 日志 ---- */
  ['GET', /^\/apis\/logs\/operation\/pages$/, operationLogPage],
  /* 兼容别名：/apis/log/pages（与上面同一份数据、同一分页形态） */
  ['GET', /^\/apis\/log\/pages$/, operationLogPage],
  ['GET', /^\/apis\/logs\/operation$/, operationLogPage],
  ['GET', /^\/apis\/log$/, operationLogPage],

  /* ---- 存储 ---- */
  ['GET', /^\/apis\/storage\/platforms$/, () => STORAGE_PLATFORMS],
  ['GET', /^\/apis\/storage\/platform\/settings$/, () => STORAGE_SETTINGS()],
  ['GET', /^\/apis\/storage\/active-platforms$/, () => ACTIVE_PLATFORMS()],
  ['GET', /^\/apis\/storage\/settings\/([^/]+)$/, (ctx) => {
    const identifier = ctx.params[0]
    const platform = STORAGE_PLATFORMS.find((p) => p.identifier === identifier) || STORAGE_PLATFORMS[0]
    return {
      id: platform.id,
      storagePlatform: platform,
      configData: '{"basePath":"/data/nebula"}',
      enabled: 1,
      userId: USER.id,
      remark: '开发预览配置',
    }
  }],
  ['POST', /^\/apis\/storage\/settings$/, () => null],
  ['PUT', /^\/apis\/storage\/settings$/, () => null],
  ['DELETE', /^\/apis\/storage\/settings\/([^/]+)$/, () => null],
  ['POST', /^\/apis\/storage\/settings\/([^/]+)\/(\d+)$/, () => null],

  /* ---- 首页 ---- */
  ['GET', /^\/apis\/home\/info$/, () => {
    const days = ['一', '二', '三', '四', '五', '六', '日']
    const p = (n) => String(n).padStart(2, '0')
    const usedBytes = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now() - (6 - i) * DAY)
      return {
        date: `${p(d.getMonth() + 1)}-${p(d.getDate())}`,
        usedBytes: 12_400_000_000 + i * 1_880_000_000,
      }
    })
    return {
      usedStorage: 23.7,
      unit: 'GB',
      usedBytes,
      recentFiles: [...rootEntries()]
        .filter((f) => !f.isDir)
        .sort((a, b) => new Date(b.updateTime).getTime() - new Date(a.updateTime).getTime())
        .slice(0, 8)
        .map((f) => ({ ...f, weekday: days[(new Date(f.updateTime).getDay() + 6) % 7] })),
    }
  }],

  /* ---- 文件：具体路径必须在 /apis/file/:id 之前 ---- */
  ['GET', /^\/apis\/file\/list$/, (ctx) => {
    const parentId = ctx.q.get('parentId')
    const scope = !parentId || parentId === 'root' ? rootEntries() : allEntries().filter((f) => f.parentId === parentId)
    return pageOf(filterFiles(scope, ctx.q), ctx.q, 50)
  }],
  ['GET', /^\/apis\/file\/dirs$/, (ctx) => {
    const parentId = ctx.q.get('parentId')
    const scope = !parentId || parentId === 'root' ? rootEntries() : allEntries().filter((f) => f.parentId === parentId)
    return scope.filter((f) => f.isDir)
  }],
  ['GET', /^\/apis\/file\/recycle\/pages$/, (ctx) =>
    pageOf(
      RECYCLE_FILES.map((r) => ({
        id: r.id,
        displayName: r.displayName,
        suffix: r.suffix,
        size: r.size,
        isDir: r.isDir,
        deletedTime: iso(r.deleted),
      })),
      ctx.q,
      10
    )
  ],
  ['GET', /^\/apis\/file\/url\/([^/]+)$/, (ctx) => `/files/${ctx.params[0]}?token=mock`],
  ['GET', /^\/apis\/file\/directory\/([^/]+)\/path$/, (ctx) => folderPath(ctx.params[0])],
  ['POST', /^\/apis\/file\/name-conflicts$/, () => []],
  ['POST', /^\/apis\/file\/directory$/, (ctx) => {
    const name = ctx.json?.folderName || '新建文件夹'
    return fileVO(
      { id: 'f-new-' + Date.now().toString(36), name, isDir: true, files: 0, folders: 0, update: 0 },
      ctx.json?.parentId || 'root'
    )
  }],
  ['POST', /^\/apis\/file\/upload$/, () => null],
  ['POST', /^\/apis\/file\/copies$/, () => null],
  ['POST', /^\/apis\/file\/favorites$/, () => null],
  ['DELETE', /^\/apis\/file\/favorites$/, () => null],
  ['DELETE', /^\/apis\/file\/recycles\/clear$/, () => null],
  ['PUT', /^\/apis\/file\/recycles$/, () => null],
  ['DELETE', /^\/apis\/file\/recycles$/, () => null],
  ['PUT', /^\/apis\/file\/moves$/, () => null],
  ['DELETE', /^\/apis\/file$/, () => null],
  ['PUT', /^\/apis\/file\/([^/]+)\/rename$/, (ctx) => ({
    ...rootEntries()[0],
    id: ctx.params[0],
    displayName: ctx.json?.displayName ?? rootEntries()[0].displayName,
  })],
  ['GET', /^\/apis\/file\/([^/]+)$/, (ctx) => {
    const id = ctx.params[0]
    return allEntries().find((f) => f.id === id) || fileVO({ id, name: '未命名文件', suffix: 'txt', size: 1024, update: -1 * DAY }, 'root')
  }],

  /* ---- 文件收集 ---- */
  ['GET', /^\/apis\/file-collections\/pages$/, (ctx) => {
    let list = collections()
    const keyword = (ctx.q.get('keyword') || '').trim().toLowerCase()
    if (keyword) list = list.filter((c) => c.collectionName.toLowerCase().includes(keyword))
    const status = ctx.q.get('status')
    if (status) list = list.filter((c) => c.status === status)
    return pageOf(list, ctx.q, 10)
  }],
  ['GET', /^\/apis\/file-collections\/public\/([^/]+)$/, (ctx) => {
    const c = collections().find((x) => x.id === ctx.params[0]) || collections()[0]
    return {
      id: c.id,
      collectionName: c.collectionName,
      description: c.description,
      expireTime: c.expireTime,
      expired: c.expired,
      hasAccessCode: c.hasAccessCode,
      maxFileSize: c.maxFileSize,
      allowedExtensions: c.allowedExtensions,
      status: c.status,
    }
  }],
  ['POST', /^\/apis\/file-collections\/public\/([^/]+)\/submissions$/, () => ({
    submissionId: 'sub-new-' + Date.now().toString(36),
    uploadToken: 'mock-upload-token',
    folderName: '外部提交 · ' + plain(0).slice(0, 10),
  })],
  ['POST', /^\/apis\/file-collections\/create$/, (ctx) => ({
    ...collections()[0],
    id: 'c-new-' + Date.now().toString(36),
    collectionName: ctx.json?.collectionName ?? '新建收集',
    accessCode: ctx.json?.accessCode ?? null,
    submissionCount: 0,
    fileCount: 0,
    totalSize: 0,
    createdAt: iso(0),
    updatedAt: iso(0),
  })],
  ['GET', /^\/apis\/file-collections\/([^/]+)\/submissions$/, (ctx) => pageOf(submissions(ctx.params[0]), ctx.q, 10)],
  ['PATCH', /^\/apis\/file-collections\/([^/]+)\/status$/, (ctx) => ({
    ...collections()[0],
    id: ctx.params[0],
    status: ctx.json?.status ?? 'CLOSED',
  })],
  ['DELETE', /^\/apis\/file-collections\/([^/]+)$/, () => null],
  ['GET', /^\/apis\/file-collections\/([^/]+)$/, (ctx) =>
    collections().find((c) => c.id === ctx.params[0]) || collections()[0]
  ],

  /* ---- 分享 ---- */
  ['GET', /^\/apis\/share\/pages$/, (ctx) => pageOf(SHARES.map(shareVO), ctx.q, 10)],
  ['POST', /^\/apis\/share\/create$/, (ctx) => ({
    ...shareVO(SHARES[0]),
    shareName: ctx.json?.shareName ?? SHARES[0].shareName,
  })],
  ['DELETE', /^\/apis\/share\/cancels$/, () => null],
  ['DELETE', /^\/apis\/share\/clears$/, () => null],
  ['POST', /^\/apis\/share\/verify\/code$/, (ctx) => {
    const code = String(ctx.json?.shareCode ?? '').trim()
    return code === '' || code === 'a9k4' || code === '7x2p'
  }],
  ['GET', /^\/apis\/share\/([^/]+)\/info$/, (ctx) => {
    const s = SHARES.find((x) => x.id === ctx.params[0]) || SHARES[0]
    if (s.id === 'expired00') return shareThin(s, true)
    if (s.id === 'locked001') return shareThin(s, false)
    return shareThin(s)
  }],
  ['GET', /^\/apis\/share\/([^/]+)\/items$/, (ctx) =>
    ctx.params[0] === '8f3c2a91' ? shareItems(SHARE_ITEMS) : shareItems(SHARE_ITEMS).slice(0, 3)
  ],
  ['GET', /^\/apis\/share\/([^/]+)\/access\/records$/, () =>
    SHARE_ACCESS_RECORDS.map((r) => ({
      id: r.id,
      shareId: '8f3c2a91',
      accessIp: r.accessIp,
      accessAddress: r.accessAddress,
      browser: r.browser,
      os: r.os,
      accessTime: iso(r.access),
    }))
  ],
  ['GET', /^\/apis\/share\/([^/]+)\/files\/([^/]+)\/available$/, () => true],
  ['GET', /^\/apis\/share\/([^/]+)\/url\/([^/]+)$/, (ctx) => `/files/${ctx.params[1]}?share=${ctx.params[0]}`],
  ['POST', /^\/apis\/share\/([^/]+)\/save-to-workspace$/, () => fileVO(SHARE_ITEMS[0], 'root')],
  ['POST', /^\/apis\/share\/([^/]+)\/folder-download\/tasks\/([^/]+)$/, (ctx) => ({
    taskId: 'fdt-' + Date.now().toString(36),
    folderId: ctx.params[1],
    folderName: '对外可公开素材',
    status: 'queued',
    progress: 0,
    totalFiles: 4,
    processedFiles: 0,
    totalBytes: 32_900_000,
    processedBytes: 0,
  })],
  ['GET', /^\/apis\/share\/([^/]+)\/folder-download\/tasks\/([^/]+)$/, (ctx) => ({
    taskId: ctx.params[1],
    folderId: 'f-606',
    folderName: '对外可公开素材',
    status: 'completed',
    progress: 100,
    totalFiles: 4,
    processedFiles: 4,
    totalBytes: 32_900_000,
    processedBytes: 32_900_000,
    zipSize: 31_400_000,
  })],
  ['DELETE', /^\/apis\/share\/([^/]+)\/folder-download\/tasks\/([^/]+)$/, () => null],
  ['GET', /^\/apis\/share\/([^/]+)$/, (ctx) => shareVO(SHARES.find((x) => x.id === ctx.params[0]) || SHARES[0])],

  /* ---- 备忘录看板 ---- */
  ['GET', /^\/apis\/workspace-board\/overview$/, () => ({
    fileshareFolderId: 'f-fileshare-root',
    fileshareFiles: FILESHARE_FILES.map((f) => fileVO(f, 'f-fileshare-root')),
    memos: memos(),
  })],
  ['POST', /^\/apis\/workspace-board\/memos$/, (ctx) => ({
    id: 'm-new-' + Date.now().toString(36),
    workspaceId: 'ws-demo',
    title: ctx.json?.title ?? '未命名备忘录',
    visibility: ctx.json?.visibility ?? 'shared',
    pinned: false,
    sortOrder: memos().length,
    createdBy: 'u-001',
    createdAt: iso(0),
    updatedAt: iso(0),
  })],
  ['GET', /^\/apis\/workspace-board\/memos\/([^/]+)\/yjs-state$/, () => ({ payloadBase64: null })],
  ['GET', /^\/apis\/workspace-board\/memos\/([^/]+)\/body$/, (ctx) => {
    const id = ctx.params[0]
    const memo = memos().find((m) => m.id === id)
    return {
      memoId: id,
      visibility: memo?.visibility ?? 'shared',
      bodyHtml: MEMO_BODIES[id] || '<p>这里还没有内容，点右上角开始写点什么。</p>',
    }
  }],
  ['PUT', /^\/apis\/workspace-board\/memos\/([^/]+)\/body$/, (ctx) => ({
    memoId: ctx.params[0],
    visibility: memos().find((m) => m.id === ctx.params[0])?.visibility ?? 'shared',
    bodyHtml: ctx.json?.bodyHtml ?? null,
  })],
  ['PUT', /^\/apis\/workspace-board\/memos\/([^/]+)$/, (ctx) => {
    const base = memos().find((m) => m.id === ctx.params[0]) || memos()[0]
    return { ...base, ...(ctx.json || {}), updatedAt: iso(0) }
  }],
  ['DELETE', /^\/apis\/workspace-board\/memos\/([^/]+)$/, () => null],
  ['PUT', /^\/apis\/workspace-board\/fileshare\/files\/([^/]+)\/pinned$/, () => null],

  /* ---- 会议 ---- */
  ['GET', /^\/apis\/workspace-meetings$/, () => meetings()],
  ['GET', /^\/apis\/workspace-meetings\/pending$/, () => pendingMeetings()],
  ['POST', /^\/apis\/workspace-meetings$/, (ctx) => ({
    id: 'mtg-new-' + Date.now().toString(36),
    workspaceId: ctx.wsId || 'ws-demo',
    workspaceName: (WS_BY_ID.get(ctx.wsId) || WORKSPACES[0]).name,
    workspaceSlug: (WS_BY_ID.get(ctx.wsId) || WORKSPACES[0]).slug,
    roomId: 'room-new-' + Date.now().toString(36),
    title: ctx.json?.title ?? '未命名会议',
    startsAt: ctx.json?.startsAt ?? iso(30 * MIN),
    createdBy: 'u-001',
    creatorName: '星云管理员',
    createdAt: iso(0),
    canEnter: true,
    status: 'SCHEDULED',
    host: true,
    participantUserIds: ctx.json?.participantUserIds ?? ['u-001'],
  })],
  ['POST', /^\/apis\/workspace-meetings\/([^/]+)\/join$/, (ctx) => {
    const m = meetings().find((x) => x.id === ctx.params[0]) || meetings()[0]
    return {
      meetingId: m.id,
      roomId: m.roomId,
      title: m.title,
      workspaceName: m.workspaceName,
      host: m.host,
    }
  }],
  ['GET', /^\/apis\/workspace-meetings\/([^/]+)\/ice-servers$/, () => ({
    iceServers: [
      { urls: ['stun:stun.l.google.com:19302'] },
      { urls: ['turn:turn.nebula.dev:3478'], username: 'nebula', credential: 'mock-credential' },
    ],
  })],
  ['POST', /^\/apis\/workspace-meetings\/([^/]+)\/invite$/, () => null],
  ['POST', /^\/apis\/workspace-meetings\/([^/]+)\/close$/, () => null],

  /* ---- 投票 ---- */
  ['GET', /^\/apis\/workspace-votes$/, () => votes()],
  ['GET', /^\/apis\/workspace-votes\/pending$/, () => votes().filter((v) => !v.myChoice)],
  ['POST', /^\/apis\/workspace-votes$/, (ctx) => ({
    id: 'vote-new-' + Date.now().toString(36),
    workspaceId: ctx.wsId || 'ws-demo',
    workspaceName: (WS_BY_ID.get(ctx.wsId) || WORKSPACES[0]).name,
    workspaceSlug: (WS_BY_ID.get(ctx.wsId) || WORKSPACES[0]).slug,
    title: ctx.json?.title ?? '未命名投票',
    createdBy: 'u-001',
    creatorName: '星云管理员',
    createdAt: iso(0),
    agreeCount: 0,
    disagreeCount: 0,
    pendingCount: (ctx.json?.participantUserIds || []).length,
    myChoice: null,
    participant: true,
    host: true,
    participants: [],
  })],
  ['POST', /^\/apis\/workspace-votes\/([^/]+)\/choice$/, () => null],

  /* ---- 邀请 ---- */
  ['GET', /^\/apis\/invitation\/mine$/, () => [
    {
      id: 'inv-1',
      workspaceId: 'ws-demo',
      workspaceName: '产品设计部',
      email: 'admin@nebula.dev',
      roleName: '管理员',
      roleCode: 'admin',
      inviterName: '林筱',
      status: 0,
      expiresAt: iso(18 * DAY),
      expired: false,
      createdAt: iso(-1 * DAY),
      userExists: true,
      token: 'demo',
    },
    {
      id: 'inv-2',
      workspaceId: 'ws-002',
      workspaceName: '开放日筹备组',
      email: 'admin@nebula.dev',
      roleName: '成员',
      roleCode: 'member',
      inviterName: '周珂',
      status: 0,
      expiresAt: iso(4 * DAY),
      expired: false,
      createdAt: iso(-2 * DAY),
      userExists: true,
      token: 'demo2',
    },
    {
      id: 'inv-3',
      workspaceId: 'ws-orion',
      workspaceName: '猎户座内容实验室',
      email: 'admin@nebula.dev',
      roleName: '只读审计',
      roleCode: 'auditor',
      inviterName: '顾曦',
      status: 0,
      expiresAt: iso(11 * DAY),
      expired: false,
      createdAt: iso(-8 * HOUR),
      userExists: true,
      token: 'demo3',
    },
  ]],
  ['GET', /^\/apis\/invitation\/verify\/([^/]+)$/, (ctx) => ({
    id: 'inv-1',
    workspaceId: 'ws-demo',
    workspaceName: '产品设计部',
    email: 'admin@nebula.dev',
    roleName: '管理员',
    roleCode: 'admin',
    inviterName: '林筱',
    status: 0,
    expiresAt: iso(18 * DAY),
    expired: false,
    createdAt: iso(-1 * DAY),
    userExists: true,
    token: ctx.params[0],
  })],
  ['POST', /^\/apis\/invitation\/accept\/([^/]+)$/, () => ({ message: '已加入工作空间' })],
  ['POST', /^\/apis\/invitation\/reject\/([^/]+)$/, () => null],

  /* ---- AI ---- */
  ['GET', /^\/apis\/ai\/reminders\/inbox$/, () => reminders()],
  ['POST', /^\/apis\/ai\/reminders\/inbox\/([^/]+)\/dismiss$/, () => null],
  ['GET', /^\/apis\/ai\/settings$/, () => ({
    enabled: true,
    baseUrl: 'https://api.deepseek.com/v1',
    modelName: 'deepseek-chat',
    customPrompt: '你是 NEBULA 工作空间的空间助手，请用简体中文回答。',
    apiKeyConfigured: true,
    apiKeyMasked: 'sk-••••••••••••••••4f2a',
    usingWorkspaceKey: true,
    canEdit: true,
  })],
  ['PUT', /^\/apis\/ai\/settings$/, (ctx) => ({
    enabled: true,
    baseUrl: 'https://api.deepseek.com/v1',
    modelName: 'deepseek-chat',
    customPrompt: '你是 NEBULA 工作空间的空间助手，请用简体中文回答。',
    apiKeyConfigured: true,
    apiKeyMasked: 'sk-••••••••••••••••4f2a',
    usingWorkspaceKey: true,
    canEdit: true,
    ...(ctx.json || {}),
  })],
  ['GET', /^\/apis\/ai\/rag\/staging$/, () => [
    { fileId: 'f-102', displayName: '品牌规范 v3.fig', size: 22_800_000, indexed: false, chunkCount: null },
    { fileId: 'f-109', displayName: '用户调研访谈记录.docx', size: 1_240_000, indexed: false, chunkCount: null },
  ]],
  ['GET', /^\/apis\/ai\/rag\/docs$/, () => [
    { fileId: 'f-101', displayName: '产品路线图 2026Q4.pdf', size: 3_456_000, indexed: true, chunkCount: 86 },
    { fileId: 'f-106', displayName: '会议纪要 1001.md', size: 18_400, indexed: true, chunkCount: 12 },
  ]],
  ['POST', /^\/apis\/ai\/rag\/index$/, () => []],
  ['POST', /^\/apis\/ai\/rag\/docs\/([^/]+)\/reindex$/, () => []],
  ['DELETE', /^\/apis\/ai\/rag\/docs\/([^/]+)$/, () => null],
  ['GET', /^\/apis\/ai\/threads$/, () => [
    { id: 'th-001', title: '整理本周空间里的待办', updatedAt: now() - 20 * MIN },
    { id: 'th-002', title: '总结 10.18 发布会物料缺口', updatedAt: now() - 28 * HOUR },
  ]],
  ['POST', /^\/apis\/ai\/threads$/, () => ({ id: 'th-new-' + Date.now().toString(36), title: '新对话', updatedAt: now() })],
  ['DELETE', /^\/apis\/ai\/threads\/([^/]+)$/, () => null],
  ['GET', /^\/apis\/ai\/threads\/([^/]+)\/messages$/, () => [
    { role: 'user', text: '这周空间里有哪些没处理完的事？' },
    { role: 'assistant', text: '有三件事：1) 上传体验走查报告还没发；2) 客户 A 还差 2 份培训录屏；3) 有一条待你投票的「团建改期」。' },
  ]],
  ['PUT', /^\/apis\/ai\/threads\/([^/]+)\/messages$/, () => null],
  ['POST', /^\/apis\/ai\/threads\/([^/]+)\/drop-last-turn$/, () => null],

  /* ---- IM ---- */
  ['GET', /^\/apis\/conversation\/unread$/, () => ({ total: imInbox().reduce((sum, c) => sum + c.unreadCount, 0) })],
  ['GET', /^\/apis\/conversation\/inbox$/, () => imInbox()],
  ['GET', /^\/apis\/conversation\/history$/, (ctx) => imHistory(ctx.q.get('conversationId') || 'c-single-u-002')],
  ['POST', /^\/apis\/conversation\/send$/, (ctx) => ({
    id: Date.now() % 100000,
    clientMsgId: ctx.json?.clientMsgId ?? 'cm-' + Date.now(),
    conversationId: ctx.json?.conversationId ?? 'c-single-' + (ctx.json?.friendId ?? 'u-002'),
    senderId: 'u-001',
    senderUsername: 'nebula-admin',
    senderNickname: '星云管理员',
    senderAvatar: '',
    content: ctx.json?.content ?? '',
    msgType: ctx.json?.msgType ?? 'TEXT',
    createdAt: iso(0),
  })],
  ['POST', /^\/apis\/conversation\/read$/, () => ({ total: 4 })],
  ['POST', /^\/apis\/conversation\/recall$/, () => null],
  ['POST', /^\/apis\/conversation\/hide$/, () => null],
  ['POST', /^\/apis\/conversation\/mute$/, () => null],
  ['POST', /^\/apis\/conversation\/single\/open$/, (ctx) => ({
    conversationId: 'c-single-' + (ctx.q.get('friendId') || 'u-002'),
  })],
  ['GET', /^\/apis\/conversation\/friends\/requests$/, () => friendRequests()],
  ['GET', /^\/apis\/conversation\/friends\/rejected$/, () => []],
  ['GET', /^\/apis\/conversation\/friends\/search$/, (ctx) => {
    const keyword = (ctx.q.get('keyword') || '').toLowerCase()
    return MEMBER_SEED.filter(
      (m) => m.userId !== 'u-001' && (m.nickname.toLowerCase().includes(keyword) || m.username.toLowerCase().includes(keyword))
    ).map((m) => ({
      id: m.userId,
      username: m.username,
      nickname: m.nickname,
      avatar: '',
      email: m.email,
      friendStatus: imFriends().some((f) => f.friendId === m.userId) ? 'ACCEPTED' : 'NONE',
    }))
  }],
  ['GET', /^\/apis\/conversation\/friends$/, () => imFriends()],
  ['POST', /^\/apis\/conversation\/friends\/(request|accept|reject|block|delete)$/, () => null],
  ['GET', /^\/apis\/conversation\/groups\/members$/, () => {
    const groupId = ctx.q.get('groupId') || 'g-design'
    return MEMBER_SEED.slice(0, groupId === 'g-design' ? 5 : 4).map((m, i) => ({
      userId: m.userId,
      username: m.username,
      nickname: m.nickname,
      avatar: '',
      role: m.userId === 'u-003' ? 'OWNER' : 'MEMBER',
      groupNickname: i === 0 ? '星云 · 群主' : null,
      joinedAt: iso(-40 * DAY),
      friendStatus: 'ACCEPTED',
    }))
  }],
  ['GET', /^\/apis\/conversation\/groups$/, () => imGroups()],
  ['POST', /^\/apis\/conversation\/groups\/invite$/, (ctx) => ({ count: (ctx.json?.memberIds || []).length })],
  ['POST', /^\/apis\/conversation\/groups\/leave$/, () => null],
  ['POST', /^\/apis\/conversation\/groups$/, () => ({ id: 'g-new-' + Date.now().toString(36), conversationId: 'c-group-new' })],
  ['POST', /^\/apis\/conversation\/media\/(message|from-file|group-avatar|save-to-workspace)$/, () => ({
    url: '/files/f-601?token=mock',
    name: '共享文件.png',
    size: 1_024_000,
    mime: 'image/png',
    path: '/files/f-601',
  })],
  ['GET', /^\/apis\/im\/crypto\/me$/, () => ({ registered: false, publicKeySpki: null, keyProof: null })],
  ['POST', /^\/apis\/im\/crypto\/register$/, () => null],
  ['GET', /^\/apis\/im\/crypto\/users\/([^/]+)\/public-key$/, () => ({ publicKeySpki: 'mock-public-key' })],
  ['GET', /^\/apis\/im\/crypto\/groups\/([^/]+)\/wrap$/, () => null],
  ['PUT', /^\/apis\/im\/crypto\/groups\/([^/]+)\/wraps$/, () => null],
  ['POST', /^\/apis\/im\/crypto\/groups\/([^/]+)\/rotate$/, () => null],

  /* ---- 传输 ---- */
  ['GET', /^\/apis\/transfer\/files$/, () => transferTasks()],
  ['GET', /^\/apis\/transfer\/chunks\/([^/]+)$/, () => []],
  ['POST', /^\/apis\/transfer\/init$/, () => 't-' + Date.now().toString(36)],
  ['POST', /^\/apis\/transfer\/check$/, (ctx) => ({
    isQuickUpload: false,
    taskId: ctx.json?.taskId ?? 't-' + Date.now().toString(36),
    protocol: 'tus',
  })],
  ['POST', /^\/apis\/transfer\/merge\/([^/]+)$/, () => 'f-merged-' + Date.now().toString(36)],
  ['DELETE', /^\/apis\/transfer\/cancel\/([^/]+)$/, () => null],
  ['POST', /^\/apis\/transfer\/pause\/([^/]+)$/, () => null],
  ['POST', /^\/apis\/transfer\/resume\/([^/]+)$/, () => null],
  ['DELETE', /^\/apis\/transfer\/clears$/, () => null],
  ['POST', /^\/apis\/transfer\/folder-download\/tasks\/([^/]+)$/, (ctx) => ({
    taskId: 'fdt-' + Date.now().toString(36),
    folderId: ctx.params[0],
    folderName: '设计稿归档',
    status: 'queued',
    progress: 0,
    totalFiles: 42,
    processedFiles: 0,
    totalBytes: 268_000_000,
    processedBytes: 0,
  })],
  ['GET', /^\/apis\/transfer\/folder-download\/tasks\/([^/]+)$/, (ctx) => ({
    taskId: ctx.params[0],
    folderId: 'f-dir-design',
    folderName: '设计稿归档',
    status: 'packing',
    progress: 46,
    totalFiles: 42,
    processedFiles: 19,
    totalBytes: 268_000_000,
    processedBytes: 124_000_000,
  })],
  ['DELETE', /^\/apis\/transfer\/folder-download\/tasks\/([^/]+)$/, () => null],

  /* ---- 管理端（仅少数页面用） ---- */
  ['PUT', /^\/apis\/admin\/users\/([^/]+)\/status$/, () => null],
]

/* ============================================================================
 * 分发
 * ========================================================================== */
function resolve(full, method) {
  const [path, search = ''] = full.split('?')
  const q = new URLSearchParams(search)
  const ctx = { full, path, q, method, wsId: null, json: null, params: [] }
  // 工作空间 id 在 server 里按 X-Workspace-Id 头补齐（mock 不校验权限，仅用于回显 workspaceName/slug）

  for (const [m, re, handler] of routes) {
    if (m !== method) continue
    const match = re.exec(path)
    if (!match) continue
    ctx.params = match.slice(1)
    return { matched: true, handler, ctx }
  }
  return { matched: false, ctx }
}

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
)

/**
 * 日志开关。
 * ⚠️ 逐条打印会把 stdout 管道塞满（8 个 QA 脚本并发打同一个 mock 时尤其严重），
 * 进程会阻塞在写 stdout 上，表现为前端请求 10s 超时。默认只打极少量汇总行；
 * 需要排查时用 MOCK_VERBOSE=1 node mock-server.mjs 打开全量日志。
 */
const VERBOSE = process.env.MOCK_VERBOSE === '1'
let servedRequests = 0
const warnedRoutes = new Set()

const server = http.createServer(async (req, res) => {
  const full = req.url || '/'
  const [path] = full.split('?')
  servedRequests += 1
  if (VERBOSE) console.log(`${req.method} ${full}`)
  else if (servedRequests % 2000 === 0) console.log(`[mock] 已处理 ${servedRequests} 个请求`)

  // SSE 长连接（传输进度 / 看板协作 / 通知推送）
  if (path.includes('/sse') || path.includes('/events') || path.includes('/stream')) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    res.write(': connected\n\n')
    const timer = setInterval(() => {
      res.write('event: ping\ndata: {}\n\n')
    }, 15000)
    req.on('close', () => clearInterval(timer))
    return
  }

  // 文件内容 / 缩略图 → 返回占位图
  if (path.startsWith('/files/') || path.includes('/thumbnail') || path.includes('/content')) {
    res.writeHead(200, { 'Content-Type': 'image/png' })
    res.end(PNG_1x1)
    return
  }

  // 读取请求体（JSON / multipart 一律按 UTF-8 文本读，JSON 解析失败就忽略）
  let rawBody = ''
  try {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    rawBody = Buffer.concat(chunks).toString('utf8')
  } catch {
    rawBody = ''
  }

  const method = (req.method || 'GET').toUpperCase()
  const { matched, handler, ctx } = resolve(full, method)
  if (matched) {
    ctx._wsHeader = String(req.headers['x-workspace-id'] || '')
    const wsHeader = ctx._wsHeader
    const wsParam = ctx.q.get('workspaceId') || ctx.q.get('X-Workspace-Id')
    const candidate = wsHeader || wsParam || ''
    ctx.wsId = WS_BY_ID.has(candidate) ? candidate : null
    if (rawBody && rawBody.trim().startsWith('{')) {
      try {
        ctx.json = JSON.parse(rawBody)
      } catch {
        ctx.json = null
      }
    }
  } else {
    // 每个未覆盖的路径只提示一次，避免 WebSocket 重连等高频请求刷爆 stdout
    const key = `${method} ${path}`
    if (!warnedRoutes.has(key)) {
      warnedRoutes.add(key)
      console.warn(`[mock] UNHANDLED ${key} → 兜底返回 ${method === 'GET' ? '[]' : 'null'}`)
    }
  }

  const data = matched ? handler(ctx) : method === 'GET' ? [] : null

  if (method === 'HEAD') {
    res.writeHead(200, { 'Upload-Offset': '0', 'Tus-Resumable': '1.0.0' })
    res.end()
    return
  }

  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Credentials': 'true',
  })
  res.end(JSON.stringify({ code: 200, msg: 'ok', data }))
})

server.listen(8081, '127.0.0.1', () => {
  console.log('NEBULA mock backend running → http://127.0.0.1:8081')
  console.log('启动前端: pnpm dev  然后打开 http://localhost:5185')
})
