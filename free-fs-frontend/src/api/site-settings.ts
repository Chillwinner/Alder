import { request } from './request'

export type SiteSettings = {
  mailEnable: boolean
  mailHost: string
  mailPort: string
  mailUsername: string
  mailPasswordSet: boolean
  mailFrom: string
  mailSsl: boolean
  frontendDomain: string
  corsOrigins: string
  localBasePath: string
  localBaseUrl: string
  turnHost: string
  turnPort: string
  turnSecretSet: boolean
  turnTtlSeconds: string
  jwtSecretSet: boolean
  jwtNeedsRestart: boolean
  postgresHint: string
  redisHint: string
}

export type UpdateSiteSettingsPayload = {
  mailEnable?: boolean
  mailHost?: string
  mailPort?: string
  mailUsername?: string
  mailPassword?: string
  mailFrom?: string
  mailSsl?: boolean
  frontendDomain?: string
  corsOrigins?: string
  localBasePath?: string
  localBaseUrl?: string
  turnHost?: string
  turnPort?: string
  turnAuthSecret?: string
  turnTtlSeconds?: string
  jwtSecret?: string
}

export const siteSettingsApi = {
  get: () => request.get<SiteSettings>('/apis/admin/site-settings'),
  update: (data: UpdateSiteSettingsPayload) =>
    request.put<SiteSettings>('/apis/admin/site-settings', data),
  exportBox: (data: {
    password: string
    includeJwt?: boolean
    includeOss?: boolean
  }) =>
    request.post<{ filename: string; box: string }>(
      '/apis/admin/site-settings/export',
      data
    ),
  importBox: (data: { password: string; box: string }) =>
    request.post<SiteSettings>('/apis/admin/site-settings/import', data),
}
