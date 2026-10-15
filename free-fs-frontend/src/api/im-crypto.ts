/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { request } from './request'

export type ImCryptoMe = {
  registered: boolean
  publicKeySpki?: string | null
  keyProof?: string | null
}

export function fetchImCryptoMe() {
  return request.get<ImCryptoMe>('/apis/im/crypto/me')
}

export function registerImCrypto(publicKeySpki: string, keyProof: string) {
  return request.post<void>('/apis/im/crypto/register', { publicKeySpki, keyProof })
}

export function fetchImUserPublicKey(userId: string) {
  return request.get<{ publicKeySpki: string }>(`/apis/im/crypto/users/${userId}/public-key`)
}

export function fetchImGroupKeyWrap(groupId: string) {
  return request.get<{
    groupId: string
    keyVersion: number
    wrappedKey: string
  } | null>(`/apis/im/crypto/groups/${groupId}/wrap`)
}

export function publishImGroupKeyWraps(
  groupId: string,
  keyVersion: number,
  wraps: { userId: string; wrappedKey: string }[]
) {
  return request.put<void>(`/apis/im/crypto/groups/${groupId}/wraps`, {
    keyVersion,
    wraps,
  })
}

export function rotateImGroupKeys(groupId: string) {
  return request.post<void>(`/apis/im/crypto/groups/${groupId}/rotate`)
}
