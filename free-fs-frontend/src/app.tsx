/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { AuthProvider } from '@/contexts/auth-context'
import { router } from '@/router'
import { RouterProvider } from 'react-router-dom'
import { useSSEConnection } from '@/hooks/useSSEConnection'
import { useUploadGuard } from '@/hooks/useUploadGuard'
import { FilePreviewDialog } from '@/components/file-preview-dialog'
import { OfficeEditDialog } from '@/components/office-edit/office-edit-dialog'
import { Toaster } from '@/components/ui/sonner'
import { NavigationProgress } from '@/components/navigation-progress'
import { PressTilt } from '@/components/press-tilt'

// SSE 初始化组件（必须在 AuthProvider 内部）
function SSEInitializer() {
  useSSEConnection()
  useUploadGuard()
  return null
}

export default function App() {
  return (
    <AuthProvider>
      <SSEInitializer />
      <NavigationProgress />
      <PressTilt />
      <RouterProvider router={router} />
      <FilePreviewDialog />
      <OfficeEditDialog />
      {/*
        Toaster 默认落在右下角，正好压住右下角的 AI 悬浮球 ——
        实测 toast 期间点悬浮球命中的是 toast 的 <li>，球点不动。
        这里把它抬到球的上方并留出安全间距。
      */}
      <Toaster position='bottom-right' offset={96} mobileOffset={88} />
    </AuthProvider>
  )
}
