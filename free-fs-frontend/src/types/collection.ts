/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { PageRecord } from './page'

export type FileCollectionStatus = 'OPEN' | 'CLOSED'
export type FileCollectionSubmissionStatus = 'UPLOADING' | 'COMPLETED'

export interface FileCollection {
  id: string
  collectionName: string
  description: string | null
  targetFolderId: string
  targetFolderName: string
  expireTime: string | null
  permanent: boolean
  expired: boolean
  hasAccessCode: boolean
  /** Only returned once, immediately after creation. */
  accessCode?: string | null
  maxFileSize: number
  allowedExtensions: string | null
  assigneeUserIds?: string[]
  assignees?: FileCollectionAssignee[]
  status: FileCollectionStatus
  submissionCount: number
  fileCount: number
  totalSize: number
  createdAt: string
  updatedAt: string
}

export interface FileCollectionAssignee {
  userId: string
  name: string
  submitted: boolean
}

export interface FileCollectionPublic {
  id: string
  collectionName: string
  description: string | null
  expireTime: string | null
  expired: boolean
  hasAccessCode: boolean
  maxFileSize: number
  allowedExtensions: string | null
  status: FileCollectionStatus
}

export interface FileCollectionSubmission {
  id: string
  submitterName: string
  submitterIp: string | null
  folderId: string
  fileCount: number
  totalSize: number
  status: FileCollectionSubmissionStatus
  createdAt: string
  completedAt: string | null
}

export interface CreateFileCollectionParams {
  collectionName: string
  description?: string
  targetFolderId: string
  expireType: 1 | 2 | 3 | 4
  expireTime?: string
  needAccessCode: boolean
  accessCode?: string
  maxFileSize: number
  allowedExtensions?: string
  assigneeUserIds?: string[]
}

export interface FileCollectionPageQuery {
  keyword?: string
  status?: FileCollectionStatus
  page?: number
  pageSize?: number
  orderBy?: string
  orderDirection?: 'ASC' | 'DESC'
}

export interface FileCollectionSubmissionPageQuery {
  keyword?: string
  page?: number
  pageSize?: number
}

export interface FileCollectionSubmissionSession {
  submissionId: string
  uploadToken: string
  folderName: string
}

export interface CollectionUploadInitParams {
  fileName: string
  fileSize: number
  totalChunks: number
  chunkSize: number
  mimeType: string
}

export interface CollectionUploadCheckResult {
  isQuickUpload: boolean
  taskId: string
  fileId?: string
  uploadId?: string
  message?: string
}

export type FileCollectionPage = PageRecord<FileCollection>
export type FileCollectionSubmissionPage =
  PageRecord<FileCollectionSubmission>
