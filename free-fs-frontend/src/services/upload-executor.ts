/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import {
  checkUpload,
  uploadChunk,
  getUploadedChunks,
  tusHead,
  tusPatch,
  mergeChunks,
} from '@/api/transfer'
import { calculateFileMD5, calculateBlobMD5 } from '@/utils/md5'
import i18n from '@/i18n'

function executorText(
  key: string,
  params?: Record<string, string | number>
): string {
  return i18n.t(`transfer:executor.${key}`, params)
}

export interface ChunkUploadResult {
  chunkIndex: number
  success: boolean
  error?: string
}

interface UploadTaskContext {
  taskId: string
  file: File
  totalChunks: number
  chunkSize: number
  uploadedChunks: Set<number>
  isPaused: boolean
  isCancelled: boolean
  activeUploads: Map<number, AbortController>
  retryCount: Map<number, number>
  concurrency: number
  protocol?: 'tus' | 's3'
}

export interface ProgressUpdateData {
  uploadedBytes: number
  totalBytes: number
  uploadedChunks: number
  totalChunks: number
}

export interface UploadExecutorCallbacks {
  onTransition: (taskId: string, status: string) => void
  onProgress: (taskId: string, data: ProgressUpdateData) => void
  onError: (taskId: string, errorMessage: string) => void
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('abort') ||
      message.includes('connection') ||
      message.includes('fetch')
    )
  }
  return false
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

class UploadExecutor {
  private static instance: UploadExecutor | null = null
  public readonly CHUNK_SIZE = 5 * 1024 * 1024
  public readonly DEFAULT_CONCURRENCY = 3
  public readonly MAX_RETRY_COUNT = 3
  private readonly RETRY_BASE_DELAY = 1000
  private taskContexts = new Map<string, UploadTaskContext>()
  private concurrency = this.DEFAULT_CONCURRENCY
  private callbacks: UploadExecutorCallbacks | null = null

  public static getInstance(): UploadExecutor {
    if (!UploadExecutor.instance) {
      UploadExecutor.instance = new UploadExecutor()
    }
    return UploadExecutor.instance
  }

  public setCallbacks(callbacks: UploadExecutorCallbacks): void {
    this.callbacks = callbacks
  }

  public setConcurrency(concurrency: number): void {
    this.concurrency = Math.max(1, concurrency)
  }

  public getConcurrency(): number {
    return this.concurrency
  }

  public calculateChunkCount(fileSize: number, chunkSize: number): number {
    return Math.ceil(fileSize / chunkSize)
  }

  public async start(
    taskId: string,
    file: File,
    concurrency?: number,
    chunkSize?: number
  ): Promise<void> {
    const taskChunkSize = chunkSize ?? this.CHUNK_SIZE
    const totalChunks = this.calculateChunkCount(file.size, taskChunkSize)
    const taskConcurrency = concurrency ?? this.concurrency

    const context: UploadTaskContext = {
      taskId,
      file,
      totalChunks,
      chunkSize: taskChunkSize,
      uploadedChunks: new Set(),
      isPaused: false,
      isCancelled: false,
      activeUploads: new Map(),
      retryCount: new Map(),
      concurrency: taskConcurrency,
      protocol: undefined,
    }

    this.taskContexts.set(taskId, context)

    try {
      this.notifyTransition(taskId, 'checking')

      const fileMd5 = await calculateFileMD5(file)

      if (context.isCancelled || context.isPaused) {
        return
      }

      const checkResult = await checkUpload({
        taskId,
        fileMd5,
        fileName: file.name,
      })

      if (checkResult.isQuickUpload) {
        this.notifyTransition(taskId, 'completed')
        this.cleanup(taskId)
        return
      }

      context.protocol = checkResult.protocol === 'tus' ? 'tus' : 's3'
      this.notifyTransition(taskId, 'uploading')

      if (context.protocol === 'tus') {
        await this.uploadTus(context)
      } else {
        const uploadedChunks = await getUploadedChunks(taskId)
        const uploadedChunksList = uploadedChunks || []
        uploadedChunksList.forEach((index) => context.uploadedChunks.add(index))
        this.notifyProgress(taskId, context)
        await this.uploadChunks(context)
      }

      if (context.isCancelled) {
        return
      }

      if (context.isPaused) {
        return
      }

      this.notifyTransition(taskId, 'merging')
      if (context.protocol === 'tus') {
        await mergeChunks(taskId)
      }
    } catch (error) {
      if (isNetworkError(error)) {
        this.notifyTransition(taskId, 'paused')
      } else {
        const errorMessage =
          error instanceof Error ? error.message : executorText('uploadFailed')
        this.notifyError(taskId, errorMessage)
      }
    }
  }

  public pause(taskId: string): void {
    const context = this.taskContexts.get(taskId)
    if (!context) return
    context.isPaused = true
  }

  public async resume(taskId: string): Promise<void> {
    const context = this.taskContexts.get(taskId)
    if (!context) return

    context.isPaused = false

    try {
      if (context.protocol === 'tus') {
        await this.uploadTus(context)
        if (context.isCancelled || context.isPaused) {
          return
        }
        this.notifyTransition(taskId, 'merging')
        await mergeChunks(taskId)
        return
      }

      const backendUploadedChunks = await getUploadedChunks(taskId)
      const uploadedChunksList = backendUploadedChunks || []

      context.uploadedChunks.clear()
      uploadedChunksList.forEach((index) => context.uploadedChunks.add(index))

      this.notifyProgress(taskId, context)

      await this.uploadChunks(context)

      if (context.isCancelled || context.isPaused) {
        return
      }

      if (context.uploadedChunks.size === context.totalChunks) {
        this.notifyTransition(taskId, 'merging')
      } else {
        throw new Error(
          executorText('chunksIncomplete', {
            uploaded: context.uploadedChunks.size,
            total: context.totalChunks,
          })
        )
      }
    } catch (error) {
      if (isNetworkError(error)) {
        this.notifyTransition(taskId, 'paused')
      } else {
        const errorMessage =
          error instanceof Error ? error.message : executorText('uploadFailed')
        this.notifyError(taskId, errorMessage)
      }
    }
  }

  public cancel(taskId: string): void {
    const context = this.taskContexts.get(taskId)
    if (!context) return

    context.isCancelled = true
    context.isPaused = false

    context.activeUploads.forEach((controller) => {
      controller.abort()
    })
    context.activeUploads.clear()

    this.cleanup(taskId)
  }

  public isRunning(taskId: string): boolean {
    const context = this.taskContexts.get(taskId)
    return context !== undefined && !context.isPaused && !context.isCancelled
  }

  public getTaskContext(taskId: string): UploadTaskContext | undefined {
    return this.taskContexts.get(taskId)
  }

  public clearAll(): void {
    this.taskContexts.forEach((context) => {
      context.activeUploads.forEach((controller) => {
        controller.abort()
      })
    })
    this.taskContexts.clear()
  }

  private notifyTransition(taskId: string, status: string): void {
    if (this.callbacks?.onTransition) {
      this.callbacks.onTransition(taskId, status)
    }
  }

  private notifyProgress(taskId: string, context: UploadTaskContext): void {
    if (!this.callbacks?.onProgress) return

    const { file, totalChunks, uploadedChunks, chunkSize } = context

    let uploadedBytes = 0
    uploadedChunks.forEach((chunkIndex) => {
      const start = chunkIndex * chunkSize
      const end = Math.min(start + chunkSize, file.size)
      uploadedBytes += end - start
    })

    this.callbacks.onProgress(taskId, {
      uploadedBytes,
      totalBytes: file.size,
      uploadedChunks: uploadedChunks.size,
      totalChunks,
    })
  }

  private notifyError(taskId: string, errorMessage: string): void {
    if (this.callbacks?.onError) {
      this.callbacks.onError(taskId, errorMessage)
    }
  }

  private async uploadTus(context: UploadTaskContext): Promise<void> {
    const { taskId, file, chunkSize } = context
    let offset = await tusHead(taskId)
    this.notifyProgressFromBytes(taskId, context, offset)

    while (offset < file.size) {
      if (context.isPaused || context.isCancelled) {
        return
      }
      const end = Math.min(offset + chunkSize, file.size)
      const blob = file.slice(offset, end)
      const controller = new AbortController()
      context.activeUploads.set(0, controller)
      try {
        offset = await tusPatch(taskId, offset, blob, controller.signal)
        this.notifyProgressFromBytes(taskId, context, offset)
      } finally {
        context.activeUploads.delete(0)
      }
    }
  }

  private notifyProgressFromBytes(
    taskId: string,
    context: UploadTaskContext,
    uploadedBytes: number
  ): void {
    if (!this.callbacks?.onProgress) return
    const uploadedChunks = Math.floor(uploadedBytes / context.chunkSize)
    this.callbacks.onProgress(taskId, {
      uploadedBytes,
      totalBytes: context.file.size,
      uploadedChunks,
      totalChunks: context.totalChunks,
    })
  }

  private async uploadChunks(context: UploadTaskContext): Promise<void> {
    const { taskId, totalChunks, uploadedChunks, concurrency } = context

    const chunksToUpload: number[] = []
    for (let i = 0; i < totalChunks; i += 1) {
      if (!uploadedChunks.has(i)) {
        chunksToUpload.push(i)
      }
    }

    if (chunksToUpload.length === 0) return

    let currentIndex = 0

    const uploadWorker = async (): Promise<void> => {
      while (currentIndex < chunksToUpload.length) {
        if (context.isPaused || context.isCancelled) {
          break
        }

        const localIndex = currentIndex
        currentIndex += 1

        const chunkIndex = chunksToUpload[localIndex]

        const result = await this.uploadChunkWithRetry(
          context,
          context.file,
          chunkIndex
        )

        if (result.success) {
          uploadedChunks.add(chunkIndex)
          this.notifyProgress(taskId, context)
        } else if (!context.isCancelled && !context.isPaused) {
          throw new Error(
            result.error ||
              executorText('chunkUploadFailedGeneric', { index: chunkIndex })
          )
        }
      }
    }

    const workerCount = Math.min(concurrency, chunksToUpload.length)
    const workers = Array.from({ length: workerCount }, () => uploadWorker())

    await Promise.all(workers)
  }

  private async uploadChunkWithRetry(
    context: UploadTaskContext,
    file: File,
    chunkIndex: number
  ): Promise<ChunkUploadResult> {
    const { taskId, chunkSize } = context
    let retryCount = context.retryCount.get(chunkIndex) || 0

    while (retryCount <= this.MAX_RETRY_COUNT) {
      if (context.isPaused || context.isCancelled) {
        return {
          chunkIndex,
          success: false,
          error: executorText('taskPausedOrCancelled'),
        }
      }

      try {
        const abortController = new AbortController()
        context.activeUploads.set(chunkIndex, abortController)

        const start = chunkIndex * chunkSize
        const end = Math.min(start + chunkSize, file.size)
        const chunkBlob = file.slice(start, end)

        const chunkMd5 = await calculateBlobMD5(chunkBlob)

        if (context.isCancelled) {
          context.activeUploads.delete(chunkIndex)
          return {
            chunkIndex,
            success: false,
            error: executorText('taskCancelled'),
          }
        }

        await uploadChunk(
          chunkBlob,
          taskId,
          chunkIndex,
          chunkMd5,
          abortController.signal
        )

        context.activeUploads.delete(chunkIndex)
        context.retryCount.delete(chunkIndex)

        return { chunkIndex, success: true }
      } catch (error) {
        context.activeUploads.delete(chunkIndex)

        if (context.isCancelled) {
          return {
            chunkIndex,
            success: false,
            error: executorText('taskCancelled'),
          }
        }

        retryCount += 1
        context.retryCount.set(chunkIndex, retryCount)

        if (retryCount <= this.MAX_RETRY_COUNT) {
          const delay = this.RETRY_BASE_DELAY * 2 ** (retryCount - 1)
          await sleep(delay)
        } else {
          const errorMessage =
            error instanceof Error ? error.message : executorText('uploadFailed')
          return {
            chunkIndex,
            success: false,
            error: executorText('chunkUploadFailedRetry', {
              index: chunkIndex,
              retries: this.MAX_RETRY_COUNT,
              message: errorMessage,
            }),
          }
        }
      }
    }

    return {
      chunkIndex,
      success: false,
      error: executorText('chunkUploadFailedGeneric', { index: chunkIndex }),
    }
  }

  private cleanup(taskId: string): void {
    this.taskContexts.delete(taskId)
  }
}

export const uploadExecutor = UploadExecutor.getInstance()
