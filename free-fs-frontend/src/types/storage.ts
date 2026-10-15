/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

/**
 * 存储平台类型定义
 */
export interface StoragePlatform {
  id: number
  name: string
  identifier: string
  configScheme: string
  icon: string
  link: string
  desc: string
  isDefault: number
}

/**
 * 用户存储配置类型定义
 */
export interface StorageSetting {
  id: string
  storagePlatform: StoragePlatform
  configData: string
  enabled: number
  workspaceId?: string
  userId?: string
  remark?: string
}

/**
 * 活跃存储平台类型定义
 */
export interface ActiveStoragePlatform {
  settingId: string
  platformIdentifier: string
  platformName: string
  platformIcon: string
  isEnabled: boolean
  remark?: string
  createdAt?: string
  updatedAt?: string
}

/**
 * 添加存储设置参数
 */
export interface AddStorageSettingParams {
  platformIdentifier: string
  configData: string
  remark?: string
}

/**
 * 更新存储设置参数
 */
export interface UpdateStorageSettingParams {
  settingId: string
  platformIdentifier: string
  configData: string
  remark?: string
}

/**
 * 配置方案字段
 */
export interface ConfigScheme {
  identifier: string
  label: string
  dataType: string
  validation: {
    required: boolean
  }
}
