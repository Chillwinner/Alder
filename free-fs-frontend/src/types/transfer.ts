/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

/**
 * 任务状态联合类型（9 种状态）
 */
export type TaskStatus =
  | 'idle'
  | 'initialized'
  | 'checking'
  | 'uploading'
  | 'downloading'
  | 'paused'
  | 'merging'
  | 'completed'
  | 'failed'
  | 'cancelled'

/**
 * 传输任务接口
 */
export interface TransferTask {
  taskId: string
  fileName: string
  fileSize: number
  status: TaskStatus
  progress: number
  uploadedBytes: number
  speed: number
  remainingTime: number
  errorMessage?: string
  createdAt: number
  updatedAt: number
  parentId?: string
  mimeType?: string
  fileMd5?: string
  totalChunks?: number
  uploadedChunks?: number
  chunkSize?: number
  taskType?: 'upload' | 'download'
  /** 上传 merge 完成后服务端文件 ID */
  resultFileId?: string
}

/**
 * 进度更新数据
 */
export interface ProgressUpdate {
  uploadedBytes: number
  totalBytes: number
  uploadedChunks?: number
  totalChunks?: number
}

/**
 * SSE 消息类型
 */
export type SSEMessageType = 'progress' | 'status' | 'complete' | 'error'

/**
 * SSE 进度数据
 */
export interface SSEProgressData {
  uploadedBytes: number
  totalBytes: number
  uploadedChunks: number
  totalChunks: number
}

/**
 * SSE 状态变更数据
 */
export interface SSEStatusData {
  status: TaskStatus | 'canceled'
  message?: string
}

/**
 * SSE 完成数据
 */
export interface SSECompleteData {
  fileId: string
  fileName: string
  fileSize: number
}

/**
 * SSE 错误数据
 */
export interface SSEErrorData {
  code: string
  message: string
}

/**
 * SSE 消息联合类型
 */
export type SSEMessageData =
  | SSEProgressData
  | SSEStatusData
  | SSECompleteData
  | SSEErrorData

/**
 * SSE 消息接口
 */
export interface SSEMessage {
  type: SSEMessageType
  taskId: string
  data: SSEMessageData
}

/**
 * 初始化上传请求参数
 */
export interface InitUploadCmd {
  fileName: string
  fileSize: number
  parentId?: string
  totalChunks: number
  chunkSize: number
  mimeType: string
  allowRename?: boolean
}

/**
 * 校验上传请求参数
 */
export interface CheckUploadCmd {
  taskId: string
  fileMd5: string
  fileName: string
}

/**
 * 校验上传响应结果
 */
export interface CheckUploadResultVO {
  isQuickUpload: boolean
  fileId?: string
  taskId: string
  uploadId?: string
  protocol?: 'tus' | 's3'
  message?: string
}

/**
 * 文件传输任务VO
 */
export interface FileTransferTaskVO {
  taskId: string
  taskType: 'upload' | 'download'
  userId: string
  parentId?: string
  objectKey: string
  fileName: string
  fileSize: number
  suffix?: string
  totalChunks: number
  uploadedChunks: number
  chunkSize: number
  storagePlatformSettingId: string
  status: TaskStatus | 'canceled'
  errorMsg?: string
  startTime?: string
  completeTime?: string
  progress?: number
  speed?: number
  remainTime?: number
  uploadedSize?: number
}

export type FolderDownloadTaskStatus =
  | 'queued'
  | 'scanning'
  | 'packing'
  | 'downloading'
  | 'completed'
  | 'failed'
  | 'canceled'
  | 'expired'

export interface FolderDownloadTaskVO {
  taskId: string
  folderId: string
  folderName: string
  status: FolderDownloadTaskStatus
  progress: number
  totalFiles: number
  processedFiles: number
  totalBytes: number
  processedBytes: number
  zipSize?: number
  message?: string
  errorMessage?: string
}
