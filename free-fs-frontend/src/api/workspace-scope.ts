/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { AxiosRequestConfig } from 'axios'

export type WorkspaceScopedRequest = {
  workspaceId: string
  storagePlatformId?: string | null
}

export function workspaceScopedConfig(
  scope: WorkspaceScopedRequest
): AxiosRequestConfig {
  const headers: Record<string, string> = {
    'X-Workspace-Id': scope.workspaceId,
  }
  if (scope.storagePlatformId) {
    headers['X-Storage-Platform-Config-Id'] = scope.storagePlatformId
  }
  return { headers }
}
