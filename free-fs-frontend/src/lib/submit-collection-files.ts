/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import {
  checkFileCollectionUpload,
  completeFileCollectionSubmission,
  getFileCollectionUploadedChunks,
  initFileCollectionUpload,
  mergeFileCollectionUpload,
  startFileCollectionSubmission,
  uploadFileCollectionChunk,
} from '@/api/collection'
import { calculateBlobMD5, calculateFileMD5 } from '@/utils/md5'

const CHUNK_SIZE = 5 * 1024 * 1024
const CHUNK_CONCURRENCY = 3

async function uploadOne(
  collectionId: string,
  session: { submissionId: string; uploadToken: string },
  file: File
) {
  const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE))
  const taskId = await initFileCollectionUpload(
    collectionId,
    session.submissionId,
    session.uploadToken,
    {
      fileName: file.name,
      fileSize: file.size,
      totalChunks,
      chunkSize: CHUNK_SIZE,
      mimeType: file.type || 'application/octet-stream',
    }
  )
  const fileMd5 = await calculateFileMD5(file)
  const check = await checkFileCollectionUpload(
    collectionId,
    session.submissionId,
    session.uploadToken,
    taskId,
    fileMd5,
    file.name
  )
  if (check.isQuickUpload) return
  const uploaded = new Set(
    await getFileCollectionUploadedChunks(
      collectionId,
      session.submissionId,
      session.uploadToken,
      taskId
    )
  )
  const pending = Array.from({ length: totalChunks }, (_, index) => index).filter((index) => !uploaded.has(index))
  let cursor = 0
  const worker = async () => {
    while (cursor < pending.length) {
      const chunkIndex = pending[cursor]
      cursor += 1
      const start = chunkIndex * CHUNK_SIZE
      const chunk = file.slice(start, Math.min(start + CHUNK_SIZE, file.size))
      const chunkMd5 = await calculateBlobMD5(chunk)
      await uploadFileCollectionChunk(
        collectionId,
        session.submissionId,
        session.uploadToken,
        taskId,
        chunkIndex,
        chunkMd5,
        chunk
      )
    }
  }
  await Promise.all(Array.from({ length: Math.min(CHUNK_CONCURRENCY, pending.length) }, () => worker()))
  await mergeFileCollectionUpload(collectionId, session.submissionId, session.uploadToken, taskId)
}

export async function submitCollectionFiles(
  collectionId: string,
  files: File[],
  submitterName: string
) {
  const session = await startFileCollectionSubmission(collectionId, submitterName)
  for (const file of files) {
    await uploadOne(collectionId, session, file)
  }
  await completeFileCollectionSubmission(collectionId, session.submissionId, session.uploadToken)
}
