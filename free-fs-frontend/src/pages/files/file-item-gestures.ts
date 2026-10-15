/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

/** 网格和列表共用的选中规则：普通点击单选，Ctrl/⌘ 点击切换。 */
export function nextFileSelection(selectedKeys: string[], fileId: string, multi: boolean): string[] {
  if (!multi) return [fileId]
  return selectedKeys.includes(fileId)
    ? selectedKeys.filter((id) => id !== fileId)
    : [...selectedKeys, fileId]
}

export function selectionAfterCheck(selectedKeys: string[], fileId: string, checked: boolean): string[] {
  if (checked) {
    return selectedKeys.includes(fileId) ? selectedKeys : [...selectedKeys, fileId]
  }
  return selectedKeys.filter((id) => id !== fileId)
}

/** 文件夹进入，文件在有读权限时预览。 */
export function openFileTarget(
  file: { isDir?: boolean | null },
  canRead: boolean,
  openDir: () => void,
  preview: () => void
) {
  if (file.isDir) openDir()
  else if (canRead) preview()
}
