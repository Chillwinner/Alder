/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useState, useEffect, useCallback, memo, useRef, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { useTransferStore } from '@/store/transfer'
import { checkNameConflicts } from '@/api/file'
import { Upload, X, FileIcon, FolderUp } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface UploadModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  parentId?: string
  isDirectoryMode?: boolean
  title?: string
  submitLabel?: string
  /** 只回传选中的文件，不进工作空间上传队列 */
  onPick?: (files: File[]) => void
}

interface FileWithPath extends File {
  webkitRelativePath: string
}

// 单个文件 item，memo 避免无关重渲染
const FileItem = memo(
  ({
    index,
    displayName,
    onRemove,
  }: {
    file: FileWithPath
    index: number
    displayName: string
    onRemove: (index: number) => void
  }) => (
    <div className='flex animate-in items-center justify-between gap-3 rounded-lg border border-border bg-surface-secondary p-3 fade-in slide-in-from-top-1'>
      <div className='flex min-w-0 flex-1 items-center gap-2'>
        <FileIcon className='h-4 w-4 flex-shrink-0 text-primary' />
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className='text-sm break-words whitespace-normal'
              style={{ wordBreak: 'break-all' }}
            >
              {displayName}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{displayName}</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <X
        className='h-4 w-4 flex-shrink-0 cursor-pointer text-muted-foreground transition-colors hover:text-destructive'
        onClick={() => onRemove(index)}
      />
    </div>
  )
)

export default function UploadModal({
  open,
  onOpenChange,
  parentId,
  isDirectoryMode = false,
  title,
  submitLabel,
  onPick,
}: UploadModalProps) {
  const { t } = useTranslation('files')
  const [fileList, setFileList] = useState<FileWithPath[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [conflictOpen, setConflictOpen] = useState(false)
  const [conflictNames, setConflictNames] = useState<string[]>([])
  const conflictResolver = useRef<((ok: boolean) => void) | null>(null)

  const { startUploadSession, createTask, createTasksWithDirectory } =
    useTransferStore()
  const fileInputId = useId()

  useEffect(() => {
    if (!open) {
      setFileList([])
    }
  }, [open])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as FileWithPath[]

    if (isDirectoryMode) {
      setFileList([...fileList, ...files])
    } else {
      // 文件模式：限制 10 个
      if (files.length + fileList.length > 10) {
        toast.warning(t('upload.toastMax'))
        return
      }
      setFileList([...fileList, ...files])
    }
  }

  const handleRemoveFile = useCallback((index: number) => {
    setFileList((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const items = Array.from(e.dataTransfer.items)
    const files: FileWithPath[] = []

    // 递归读取文件夹，并行处理同级 entries
    const readEntry = (entry: any, path = ''): Promise<void> => {
      if (entry.isFile) {
        return new Promise((resolve) => {
          entry.file((file: File) => {
            // 直接复用原始 File 对象，避免重新构造 blob
            Object.defineProperty(file, 'webkitRelativePath', {
              value: path + file.name,
              writable: false,
              configurable: true,
            })
            files.push(file as FileWithPath)
            resolve()
          })
        })
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader()
        return new Promise((resolve) => {
          dirReader.readEntries(async (entries: any[]) => {
            // 并行处理同级子项
            await Promise.all(
              entries.map((childEntry) =>
                readEntry(childEntry, path + entry.name + '/')
              )
            )
            resolve()
          })
        })
      }
      return Promise.resolve()
    }

    // 并行处理所有顶层拖拽项
    const entries = items
      .map((item) => item.webkitGetAsEntry?.())
      .filter(Boolean)

    if (entries.length > 0) {
      await Promise.all(entries.map((entry) => readEntry(entry)))
      if (files.length > 0) {
        setFileList((prev) => [...prev, ...files])
        return
      }
    }

    // fallback：使用传统方式
    const fallbackFiles = Array.from(e.dataTransfer.files) as FileWithPath[]
    if (!isDirectoryMode && fallbackFiles.length > 0) {
      setFileList((prev) => {
        if (!isDirectoryMode && fallbackFiles.length + prev.length > 10) {
          toast.warning(t('upload.toastMax'))
          return prev
        }
        return [...prev, ...fallbackFiles]
      })
    }
  }, [isDirectoryMode, t])

  const askRenameConflicts = (names: string[]) => {
    return new Promise<boolean>((resolve) => {
      conflictResolver.current = resolve
      setConflictNames(names)
      setConflictOpen(true)
    })
  }

  const handleSubmit = () => {
    if (fileList.length === 0) {
      toast.warning(
        isDirectoryMode ? t('upload.pickFolder') : t('upload.pickFile')
      )
      return
    }

    const selectedFiles = [...fileList]

    if (onPick) {
      onOpenChange(false)
      onPick(selectedFiles)
      return
    }

    void (async () => {
      let allowRename = false
      if (!isDirectoryMode) {
        try {
          const items = await checkNameConflicts(
            parentId,
            selectedFiles.map((file) => file.name)
          )
          const conflicts = items.filter((item) => item.conflict)
          if (conflicts.length > 0) {
            const confirmed = await askRenameConflicts(
              conflicts.map((item) => item.fileName)
            )
            if (!confirmed) {
              return
            }
            allowRename = true
          }
        } catch {
          return
        }
      }

      const sessionId = startUploadSession()
      onOpenChange(false)

      requestAnimationFrame(() => {
        window.setTimeout(() => {
          void (async () => {
            try {
              if (isDirectoryMode) {
                await createTasksWithDirectory(
                  selectedFiles,
                  parentId,
                  sessionId,
                  allowRename
                )
              } else {
                await Promise.all(
                  selectedFiles.map((file) =>
                    createTask(file, parentId, sessionId, allowRename)
                  )
                )
              }

              toast.success(
                isDirectoryMode
                  ? t('operations.uploadFolderAdded')
                  : t('operations.uploadFileAdded'),
                {
                  description: t('operations.uploadCheckProgress'),
                }
              )
            } catch (error) {
              console.error('添加上传任务失败:', error)
              toast.error(t('upload.addQueueFail'), {
                description:
                  error instanceof Error
                    ? error.message
                    : t('upload.tryAgainLater'),
              })
            }
          })()
        }, 0)
      })
    })()
  }

  // 获取显示的文件名
  const getDisplayName = (file: FileWithPath) => {
    if (isDirectoryMode && file.webkitRelativePath) {
      return file.webkitRelativePath
    }
    return file.name
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-xl'>
        <DialogHeader>
          <DialogTitle>
            {title ??
              (isDirectoryMode ? t('upload.titleFolder') : t('upload.titleFile'))}
          </DialogTitle>
        </DialogHeader>

        <div className='py-4'>
          <input
            type='file'
            multiple={!isDirectoryMode}
            {...(isDirectoryMode ? { webkitdirectory: '', directory: '' } : {})}
            onChange={handleFileChange}
            className='hidden'
            id={fileInputId}
          />

          <label
            htmlFor={fileInputId}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-[10px] border border-dashed p-10 transition-all duration-150 ${
              isDragging
                ? 'border-primary bg-accent-soft'
                : 'border-border bg-surface-secondary hover:border-primary/60 hover:bg-accent'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isDirectoryMode ? (
              <FolderUp className='mb-4 h-12 w-12 text-primary' />
            ) : (
              <Upload className='mb-4 h-12 w-12 text-primary' />
            )}
            <div className='text-[15px] font-semibold tracking-tight text-foreground'>
              {isDirectoryMode ? t('upload.dropFolder') : t('upload.dropFile')}
            </div>
            <div className='mt-2 text-[13.5px] text-muted-foreground'>
              {isDirectoryMode ? t('upload.hintFolder') : t('upload.hintFile')}
            </div>
          </label>

          {fileList.length > 0 && (
            <TooltipProvider>
              <div className='flex flex-col mt-4 max-h-60 overflow-y-auto gap-2'>
                {fileList.map((file, index) => (
                  <FileItem
                    key={index}
                    file={file}
                    index={index}
                    displayName={getDisplayName(file)}
                    onRemove={handleRemoveFile}
                  />
                ))}
              </div>
            </TooltipProvider>
          )}
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={fileList.length === 0}>
            {submitLabel ?? t('upload.addToList')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog
      open={conflictOpen}
      onOpenChange={(next) => {
        setConflictOpen(next)
        if (!next && conflictResolver.current) {
          conflictResolver.current(false)
          conflictResolver.current = null
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('upload.conflictTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('upload.conflictDesc', { names: conflictNames.join(', ') })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => {
              conflictResolver.current?.(false)
              conflictResolver.current = null
            }}
          >
            {t('common.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              conflictResolver.current?.(true)
              conflictResolver.current = null
            }}
          >
            {t('upload.conflictContinue')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
