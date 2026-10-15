/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { AxiosProgressEvent, AxiosRequestConfig } from 'axios'
import type {
  FileListParams,
  FileItem,
  FileRecycleItem,
  RecyclePageQuery,
} from '@/types/file'
import type { PageRecord } from '@/types/page'
import type { WorkspaceScopedRequest } from './workspace-scope'
import { workspaceScopedConfig } from './workspace-scope'
import { request } from './request'
import service from './request'

/**
 * 查询文件列表（分页）
 */
export function getFileList(params: FileListParams) {
  return request.get<PageRecord<FileItem>>('/apis/file/list', { params })
}

/**
 * 获取文件详情
 */
export function getFileDetail(fileId: string) {
  return request.get<FileItem>(`/apis/file/${fileId}`)
}

export function probeWorkspaceFile(fileId: string) {
  return request.get<FileItem>(`/apis/file/${fileId}`, {
    showErrorMessage: false,
  } as AxiosRequestConfig & { showErrorMessage: boolean })
}

/**
 * 查询目录列表
 */
export function checkNameConflicts(parentId: string | undefined, fileNames: string[]) {
  return request.post<
    Array<{ fileName: string; conflict: boolean; suggestedName: string }>
  >('/apis/file/name-conflicts', { parentId, fileNames })
}

export function getFolders(
  parentId?: string | null,
  scope?: WorkspaceScopedRequest
) {
  return request.get<FileItem[]>('/apis/file/dirs', {
    params: parentId ? { parentId } : {},
    ...(scope ? workspaceScopedConfig(scope) : {}),
  })
}

/**
 * 获取文件夹路径（面包屑导航）
 */
export function getFolderPath(folderId: string) {
  return request.get<FileItem[]>(`/apis/file/directory/${folderId}/path`)
}

/**
 * 上传文件
 */
export function uploadFile(
  file: File,
  parentId?: string,
  onProgress?: (progressEvent: AxiosProgressEvent) => void
) {
  const formData = new FormData()
  formData.append('file', file)
  if (parentId) {
    formData.append('parentId', parentId)
  }
  return request.post<FileItem>('/apis/file/upload', formData, {
    onUploadProgress: onProgress,
    timeout: 0,
  }).then((res) => {
    window.dispatchEvent(new CustomEvent('fileshare-changed'))
    return res
  })
}

/**
 * 创建文件夹
 */
export function createFolder(
  data: { folderName: string; parentId?: string },
  scope?: WorkspaceScopedRequest
) {
  return request.post<FileItem>('/apis/file/directory', data, {
    timeout: 0,
    ...(scope ? workspaceScopedConfig(scope) : {}),
  })
}

/**
 * 删除文件（移到回收站）
 */
export function deleteFiles(fileIds: string[]) {
  return request.delete('/apis/file', { data: fileIds }).then((res) => {
    window.dispatchEvent(new CustomEvent('fileshare-changed'))
    return res
  })
}

/**
 * 重命名文件
 */
export function renameFile(fileId: string, displayName: string) {
  return request.put(`/apis/file/${fileId}/rename`, { displayName }).then((res) => {
    window.dispatchEvent(new CustomEvent('fileshare-changed'))
    return res
  })
}

/**
 * 移动文件
 */
export function moveFiles(dirId: string, fileIds: string[]) {
  return request.put('/apis/file/moves', { dirId, fileIds }).then((res) => {
    window.dispatchEvent(new CustomEvent('fileshare-changed'))
    return res
  })
}

/**
 * 复制文件或文件夹到指定目录。dirId 为空时复制到工作空间根目录。
 */
export function copyFiles(data: { dirId?: string; fileIds: string[] }) {
  return request.post<void>('/apis/file/copies', data)
}

/**
 * 分页获取回收站文件列表
 */
export function getRecyclePage(params?: RecyclePageQuery) {
  return request.get<PageRecord<FileRecycleItem>>('/apis/file/recycle/pages', {
    params,
  })
}

/**
 * 还原文件
 */
export function restoreFiles(fileIds: string[]) {
  return request.put('/apis/file/recycles', fileIds)
}

/**
 * 彻底删除文件
 */
export function permanentDeleteFiles(fileIds: string[]) {
  return request.delete('/apis/file/recycles', { data: fileIds })
}

/**
 * 清空回收站
 */
export function clearRecycle() {
  return request.delete('/apis/file/recycles/clear')
}

/**
 * 收藏文件
 */
export function favoriteFile(fileIds: string[]) {
  return request.post('/apis/file/favorites', fileIds)
}

/**
 * 取消收藏文件
 */
export function unfavoriteFile(fileIds: string[]) {
  return request.delete('/apis/file/favorites', { data: fileIds })
}

/**
 * 获取文件访问URL
 */
export function getFileAccessUrl(
  fileId: string,
  expireSeconds = 3600,
  download = false
) {
  return request.get<string>(`/apis/file/url/${fileId}`, {
    params: { expireSeconds, download },
  })
}

/**
 * 读取当前空间内文件的原始内容，供前端预览。
 */
export async function getFileContent(fileId: string): Promise<Blob> {
  const response = await service.get(`/apis/file/${fileId}/content`, {
    responseType: 'blob',
    timeout: 0,
  })
  return asFileBlob(response.data)
}

export async function asFileBlob(data: Blob): Promise<Blob> {
  if (data.type.includes('application/json')) {
    const payload = JSON.parse(await data.text()) as { msg?: string }
    throw new Error(payload.msg || 'preview.failed')
  }
  return data
}
