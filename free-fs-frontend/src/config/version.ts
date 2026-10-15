/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

/**
 * 应用版本配置
 * 自动从 package.json 读取版本号
 */
import packageJson from '../../package.json'

export const APP_VERSION = packageJson.version
