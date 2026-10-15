/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { TFunction } from 'i18next'

const PRESET_CODES = new Set(['admin', 'member', 'viewer'])

function presetCode(role: { roleCode?: string | null; roleName?: string | null }) {
  const code = (role.roleCode || '').trim().toLowerCase()
  if (PRESET_CODES.has(code)) return code
  return ''
}

export function displayRoleName(
  t: TFunction,
  role: { roleCode?: string | null; roleName?: string | null }
) {
  const code = presetCode(role)
  if (code) {
    return t(`roles.preset.${code}.name`, { ns: 'settings' })
  }
  return role.roleName || ''
}

export function displayRoleDesc(
  t: TFunction,
  role: { roleCode?: string | null; description?: string | null }
) {
  const code = presetCode(role)
  if (code) {
    return t(`roles.preset.${code}.description`, { ns: 'settings' })
  }
  return role.description?.trim() || ''
}
