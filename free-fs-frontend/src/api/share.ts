/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { AxiosRequestConfig } from 'axios'
import type { FileItem } from '@/types/file'
import type { PageRecord } from '@/types/page'
import type {
  ShareCreateParams,
  ShareCreateResponse,
  ShareItem,
  SharePageQuery,
  ShareThin,
  ShareValidParams,
  ShareAccessRecord,
} from '@/types/share'
import type { FolderDownloadTaskVO } from '@/types/transfer'
import { asFileBlob } from './file'
import type { WorkspaceScopedRequest } from './workspace-scope'
import { workspaceScopedConfig } from './workspace-scope'
import service, { request } from './request'

const silentRequestConfig: AxiosRequestConfig & {
  showErrorMessage: boolean
} = {
  showErrorMessage: false,
}

/**
 * 分页获取我的分享列表
 */
export function getMySharePage(params?: SharePageQuery) {
  return request.get<PageRecord<ShareItem>>('/apis/share/pages', { params })
}

/**
 * 创建分享
 */
export function shareFiles(params: ShareCreateParams) {
  return request.post<ShareCreateResponse>('/apis/share/create', params)
}

/**
 * 取消分享（支持单个和批量）
 */
export function cancelShares(ids: string[]) {
  return request.delete('/apis/share/cancels', { data: ids })
}

/**
 * 清空当前用户全部分享
 */
export function clearAllShares() {
  return request.delete<unknown>('/apis/share/clears')
}

/**
 * 查看分享详情
 */
export function getShareDetail(shareId: string) {
  return request.get<ShareThin>(`/apis/share/${shareId}/info`)
}

/**
 * 验证分享码
 */
export function validateShareCode(params: ShareValidParams) {
  return request.post<boolean>('/apis/share/verify/code', params)
}

/**
 * 获取分享文件列表
 */
export function isShareFileAvailable(shareId: string, fileId: string) {
  return request.get<boolean>(`/apis/share/${shareId}/files/${fileId}/available`, silentRequestConfig)
}

export function getShareItemList(shareId: string, parentId?: string) {
  return request.get<FileItem[]>(`/apis/share/${shareId}/items`, {
    params: parentId ? { parentId } : undefined,
  })
}

/**
 * 获取分享详细信息（用于查看详情）
 */
export function getShareDetailById(shareId: string) {
  return request.get<ShareItem>(`/apis/share/${shareId}`)
}

/**
 * 获取分享访问记录列表
 */
export function getShareAccessRecords(shareId: string) {
  return request.get<ShareAccessRecord[]>(
    `/apis/share/${shareId}/access/records`
  )
}

/**
 * 下载分享文件
 */
export async function downloadShareFile(shareId: string, fileId: string): Promise<Blob> {
  const response = await service.get(`/apis/share/${shareId}/download/${fileId}`, {
    responseType: 'blob',
    timeout: 0,
  })
  return asFileBlob(response.data)
}

export async function getShareFileContent(shareId: string, fileId: string): Promise<Blob> {
  const response = await service.get(`/apis/share/${shareId}/content/${fileId}`, {
    responseType: 'blob',
    timeout: 0,
  })
  return asFileBlob(response.data)
}

export function getShareFileAccessUrl(
  shareId: string,
  fileId: string,
  expireSeconds = 3600,
  download = false
) {
  return request.get<string>(`/apis/share/${shareId}/url/${fileId}`, {
    params: { expireSeconds, download },
  })
}

/**
 * 创建分享文件夹下载打包任务
 */
export function createShareFolderDownloadTask(
  shareId: string,
  folderId: string
) {
  return request.post<FolderDownloadTaskVO>(
    `/apis/share/${shareId}/folder-download/tasks/${folderId}`,
    null,
    { timeout: 0 }
  )
}

/**
 * 查询分享文件夹下载打包进度
 */
export function getShareFolderDownloadTask(shareId: string, taskId: string) {
  return request.get<FolderDownloadTaskVO>(
    `/apis/share/${shareId}/folder-download/tasks/${taskId}`,
    silentRequestConfig
  )
}

/**
 * 取消分享文件夹下载打包任务
 */
export function saveShareToWorkspace(
  shareId: string,
  data: { fileId: string; parentId?: string },
  scope?: WorkspaceScopedRequest
) {
  return request.post<FileItem>(
    `/apis/share/${shareId}/save-to-workspace`,
    data,
    scope ? workspaceScopedConfig(scope) : {}
  )
}

export function cancelShareFolderDownloadTask(shareId: string, taskId: string) {
  return request.delete(
    `/apis/share/${shareId}/folder-download/tasks/${taskId}`,
    silentRequestConfig
  )
}
