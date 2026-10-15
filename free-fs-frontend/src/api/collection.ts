/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { AxiosRequestConfig } from 'axios'
import type {
  CollectionUploadCheckResult,
  CollectionUploadInitParams,
  CreateFileCollectionParams,
  FileCollection,
  FileCollectionPage,
  FileCollectionPageQuery,
  FileCollectionPublic,
  FileCollectionStatus,
  FileCollectionSubmissionPage,
  FileCollectionSubmissionPageQuery,
  FileCollectionSubmissionSession,
} from '@/types/collection'
import { request } from './request'

const UPLOAD_TOKEN_HEADER = 'X-Collection-Upload-Token'
const silentPublicRequestConfig: AxiosRequestConfig & {
  showErrorMessage: boolean
} = {
  showErrorMessage: false,
}
const silentUploadConfig = {
  timeout: 0,
  showErrorMessage: false,
} as const

function uploadConfig(uploadToken: string) {
  return {
    ...silentUploadConfig,
    headers: { [UPLOAD_TOKEN_HEADER]: uploadToken },
  }
}

export function getFileCollectionPage(params?: FileCollectionPageQuery) {
  return request.get<FileCollectionPage>('/apis/file-collections/pages', {
    params,
  })
}

export function getAssignedFileCollections() {
  return request.get<FileCollection[]>('/apis/file-collections/assigned')
}

export function getFileCollectionDetail(collectionId: string) {
  return request.get<FileCollection>(`/apis/file-collections/${collectionId}`)
}

export function createFileCollection(params: CreateFileCollectionParams) {
  return request.post<FileCollection>('/apis/file-collections/create', params)
}

export function updateFileCollectionStatus(
  collectionId: string,
  status: FileCollectionStatus
) {
  return request.patch<FileCollection>(
    `/apis/file-collections/${collectionId}/status`,
    { status }
  )
}

/**
 * Delete a file collection record without touching files collected into its
 * target folder.
 */
export function deleteFileCollection(collectionId: string) {
  return request.delete<void>(`/apis/file-collections/${collectionId}`)
}

export function getFileCollectionSubmissions(
  collectionId: string,
  params?: FileCollectionSubmissionPageQuery
) {
  return request.get<FileCollectionSubmissionPage>(
    `/apis/file-collections/${collectionId}/submissions`,
    { params }
  )
}

export function getPublicFileCollection(collectionId: string) {
  return request.get<FileCollectionPublic>(
    `/apis/file-collections/public/${collectionId}`
  )
}

export function startFileCollectionSubmission(
  collectionId: string,
  submitterName: string,
  accessCode?: string
) {
  return request.post<FileCollectionSubmissionSession>(
    `/apis/file-collections/public/${collectionId}/submissions`,
    { submitterName, accessCode },
    silentPublicRequestConfig
  )
}

export function initFileCollectionUpload(
  collectionId: string,
  submissionId: string,
  uploadToken: string,
  params: CollectionUploadInitParams
) {
  return request.post<string>(
    `/apis/file-collections/public/${collectionId}/submissions/${submissionId}/uploads/init`,
    params,
    uploadConfig(uploadToken)
  )
}

export function checkFileCollectionUpload(
  collectionId: string,
  submissionId: string,
  uploadToken: string,
  taskId: string,
  fileMd5: string,
  fileName: string
) {
  return request.post<CollectionUploadCheckResult>(
    `/apis/file-collections/public/${collectionId}/submissions/${submissionId}/uploads/check`,
    { taskId, fileMd5, fileName },
    uploadConfig(uploadToken)
  )
}

export function uploadFileCollectionChunk(
  collectionId: string,
  submissionId: string,
  uploadToken: string,
  taskId: string,
  chunkIndex: number,
  chunkMd5: string,
  file: Blob
) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('taskId', taskId)
  formData.append('chunkIndex', String(chunkIndex))
  formData.append('chunkMd5', chunkMd5)
  return request.post(
    `/apis/file-collections/public/${collectionId}/submissions/${submissionId}/uploads/chunk`,
    formData,
    {
      ...uploadConfig(uploadToken),
      headers: {
        ...uploadConfig(uploadToken).headers,
      },
      timeout: 0,
    }
  )
}

export function getFileCollectionUploadedChunks(
  collectionId: string,
  submissionId: string,
  uploadToken: string,
  taskId: string
) {
  return request.get<number[]>(
    `/apis/file-collections/public/${collectionId}/submissions/${submissionId}/uploads/${taskId}/chunks`,
    uploadConfig(uploadToken)
  )
}

export function mergeFileCollectionUpload(
  collectionId: string,
  submissionId: string,
  uploadToken: string,
  taskId: string
) {
  return request.post<string>(
    `/apis/file-collections/public/${collectionId}/submissions/${submissionId}/uploads/${taskId}/merge`,
    null,
    uploadConfig(uploadToken)
  )
}

export function completeFileCollectionSubmission(
  collectionId: string,
  submissionId: string,
  uploadToken: string
) {
  return request.post(
    `/apis/file-collections/public/${collectionId}/submissions/${submissionId}/complete`,
    null,
    uploadConfig(uploadToken)
  )
}
