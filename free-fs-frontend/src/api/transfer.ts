/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type {
  FileTransferTaskVO,
  FolderDownloadTaskVO,
  InitUploadCmd,
  CheckUploadCmd,
  CheckUploadResultVO,
} from '@/types/transfer'
import { request } from './request'
import service from './request'

const silentUploadRequestConfig = {
  timeout: 0,
  showErrorMessage: false,
} as any

/**
 * 初始化上传
 */
export function initUpload(params: InitUploadCmd) {
  return request.post<string>(
    '/apis/transfer/init',
    params,
    silentUploadRequestConfig
  )
}

/**
 * 校验文件
 */
export function checkUpload(params: CheckUploadCmd) {
  return request.post<CheckUploadResultVO>(
    '/apis/transfer/check',
    params,
    silentUploadRequestConfig
  )
}

export async function tusHead(taskId: string): Promise<number> {
  const response = await service.head(`/apis/transfer/tus/${taskId}`, {
    timeout: 0,
    showErrorMessage: false,
  } as any)
  const raw = response.headers['upload-offset']
  return Number(raw || 0)
}

export async function tusPatch(
  taskId: string,
  offset: number,
  chunk: Blob,
  signal?: AbortSignal
): Promise<number> {
  const response = await service.patch(`/apis/transfer/tus/${taskId}`, chunk, {
    timeout: 0,
    showErrorMessage: false,
    signal,
    transformRequest: [(data) => data],
    headers: {
      'Content-Type': 'application/offset+octet-stream',
      'Upload-Offset': String(offset),
      'Tus-Resumable': '1.0.0',
    },
  } as any)
  const raw = response.headers['upload-offset']
  return Number(raw || offset + chunk.size)
}

/**
 * 上传分片
 */
export function uploadChunk(
  file: Blob,
  taskId: string,
  chunkIndex: number,
  chunkMd5: string,
  signal?: AbortSignal
) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('taskId', taskId)
  formData.append('chunkIndex', chunkIndex.toString())
  formData.append('chunkMd5', chunkMd5)

  return request.post('/apis/transfer/chunk', formData, {
    ...silentUploadRequestConfig,
    signal,
    timeout: 0,
  })
}

/**
 * 查询已上传的分片
 */
export function getUploadedChunks(taskId: string) {
  return request.get<number[]>(
    `/apis/transfer/chunks/${taskId}`,
    silentUploadRequestConfig
  )
}

/**
 * 合并分片
 */
export function mergeChunks(taskId: string) {
  return request.post<string>(`/apis/transfer/merge/${taskId}`)
}

/**
 * 取消上传任务
 */
export function cancelUpload(taskId: string) {
  return request.delete(`/apis/transfer/cancel/${taskId}`)
}

/**
 * 获取传输文件列表
 */
export function getTransferFiles() {
  return request.get<FileTransferTaskVO[]>(
    '/apis/transfer/files',
    silentUploadRequestConfig
  )
}

/**
 * 暂停上传任务
 */
export function pauseUpload(taskId: string) {
  return request.post(`/apis/transfer/pause/${taskId}`)
}

/**
 * 恢复上传任务
 */
export function resumeUpload(taskId: string) {
  return request.post(`/apis/transfer/resume/${taskId}`)
}

/**
 * 清空已完成任务
 */
export function clearCompletedTasks() {
  return request.delete('/apis/transfer/clears')
}

/**
 * 创建文件夹下载打包任务
 */
export function createFolderDownloadTask(folderId: string) {
  return request.post<FolderDownloadTaskVO>(
    `/apis/transfer/folder-download/tasks/${folderId}`,
    null,
    { timeout: 0 }
  )
}

/**
 * 查询文件夹下载打包进度
 */
export function getFolderDownloadTask(taskId: string) {
  return request.get<FolderDownloadTaskVO>(
    `/apis/transfer/folder-download/tasks/${taskId}`,
    silentUploadRequestConfig
  )
}

/**
 * 取消文件夹下载打包任务
 */
export function cancelFolderDownloadTask(taskId: string) {
  return request.delete(
    `/apis/transfer/folder-download/tasks/${taskId}`,
    silentUploadRequestConfig
  )
}

export function downloadFolderTaskFile(taskId: string) {
  return service.get<Blob>(
    `/apis/transfer/folder-download/tasks/${taskId}/file`,
    {
      responseType: 'blob',
      timeout: 0,
      showErrorMessage: false,
    } as any
  )
}
