/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

export const IM_CRYPTO_VERSION = 2
export const IM_ENCRYPTED_PAYLOAD_VERSION = 1

export type ImEncryptedPayload = {
  v: number
  iv: string
  ct: string
  tag: string
}

export type ImKeyProofPayload = {
  ephemPub: string
  iv: string
  ct: string
  tag: string
}

export type ImWrappedGroupKeyPayload = ImKeyProofPayload

export type ImPrivateKeyBackup = {
  v: number
  userId: string
  publicKeySpki: string
  /** 32 字节随机数，用于 AES-256-GCM 加密私钥（保存在本机 IndexedDB / 备份文件中） */
  wrapKey: string
  iv: string
  tag: string
  ciphertext: string
}

const ECDH_PARAMS: EcKeyGenParams = { name: 'ECDH', namedCurve: 'P-256' }
const AES_GCM: AesGcmParams = { name: 'AES-GCM', length: 256 }

function b64Encode(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (let i = 0; i < u8.length; i += 1) {
    binary += String.fromCharCode(u8[i]!)
  }
  return btoa(binary)
}

function b64Decode(text: string): Uint8Array {
  const binary = atob(text)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i)
  }
  return out
}

export async function generateIdentityKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(ECDH_PARAMS, true, ['deriveKey', 'deriveBits'])
}

export async function exportPublicKeySpki(publicKey: CryptoKey): Promise<string> {
  const spki = await crypto.subtle.exportKey('spki', publicKey)
  return b64Encode(spki)
}

export async function exportPrivateKeyPkcs8(privateKey: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.exportKey('pkcs8', privateKey)
}

export async function importPublicKeySpki(spkiB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'spki',
    b64Decode(spkiB64),
    ECDH_PARAMS,
    true,
    []
  )
}

export async function importPrivateKeyPkcs8(pkcs8: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey('pkcs8', pkcs8, ECDH_PARAMS, true, ['deriveKey', 'deriveBits'])
}

async function aesKeyFromWrapSecret(wrapKeyB64: string): Promise<CryptoKey> {
  const raw = b64Decode(wrapKeyB64)
  if (raw.length !== 32) {
    throw new Error('im.crypto.wrap.invalid')
  }
  return crypto.subtle.importKey('raw', raw, AES_GCM, false, ['encrypt', 'decrypt'])
}

export async function wrapPrivateKeyBackup(
  userId: string,
  keyPair: CryptoKeyPair
): Promise<ImPrivateKeyBackup> {
  const wrapSecret = crypto.getRandomValues(new Uint8Array(32))
  const wrapKey = b64Encode(wrapSecret)
  const aesKey = await aesKeyFromWrapSecret(wrapKey)
  const pkcs8 = await exportPrivateKeyPkcs8(keyPair.privateKey)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, pkcs8)
  const encryptedBytes = new Uint8Array(encrypted)
  const tag = encryptedBytes.slice(-16)
  const ciphertext = encryptedBytes.slice(0, -16)
  return {
    v: IM_CRYPTO_VERSION,
    userId,
    publicKeySpki: await exportPublicKeySpki(keyPair.publicKey),
    wrapKey,
    iv: b64Encode(iv),
    tag: b64Encode(tag),
    ciphertext: b64Encode(ciphertext),
  }
}

export async function unwrapPrivateKeyBackup(backup: ImPrivateKeyBackup): Promise<CryptoKey> {
  const aesKey = await aesKeyFromWrapSecret(backup.wrapKey)
  const iv = b64Decode(backup.iv)
  const tag = b64Decode(backup.tag)
  const ciphertext = b64Decode(backup.ciphertext)
  const combined = new Uint8Array(ciphertext.length + tag.length)
  combined.set(ciphertext, 0)
  combined.set(tag, ciphertext.length)
  const pkcs8 = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, combined)
  return importPrivateKeyPkcs8(pkcs8)
}

async function ecdhSharedBits(privateKey: CryptoKey, publicKey: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    privateKey,
    256
  )
}

async function hkdfAesKey(
  sharedBits: ArrayBuffer,
  info: string,
  salt: string
): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const base = await crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: enc.encode(salt),
      info: enc.encode(info),
    },
    base,
    AES_GCM,
    false,
    ['encrypt', 'decrypt']
  )
}

export async function deriveSingleConversationKey(
  privateKey: CryptoKey,
  peerPublicKeySpki: string,
  conversationId: string
): Promise<CryptoKey> {
  const peerPublic = await importPublicKeySpki(peerPublicKeySpki)
  const bits = await ecdhSharedBits(privateKey, peerPublic)
  return hkdfAesKey(bits, `single:${conversationId}`, 'free-fs-im-v1')
}

export async function encryptWithAesGcm(
  aesKey: CryptoKey,
  plaintext: string
): Promise<ImEncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const enc = new TextEncoder()
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    enc.encode(plaintext)
  )
  const bytes = new Uint8Array(encrypted)
  const tag = bytes.slice(-16)
  const ct = bytes.slice(0, -16)
  return {
    v: IM_ENCRYPTED_PAYLOAD_VERSION,
    iv: b64Encode(iv),
    ct: b64Encode(ct),
    tag: b64Encode(tag),
  }
}

export async function decryptWithAesGcm(
  aesKey: CryptoKey,
  payload: ImEncryptedPayload
): Promise<string> {
  const iv = b64Decode(payload.iv)
  const ct = b64Decode(payload.ct)
  const tag = b64Decode(payload.tag)
  const combined = new Uint8Array(ct.length + tag.length)
  combined.set(ct, 0)
  combined.set(tag, ct.length)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, combined)
  return new TextDecoder().decode(plain)
}

export function serializeEncryptedPayload(payload: ImEncryptedPayload): string {
  return JSON.stringify(payload)
}

export function parseEncryptedPayload(raw: string): ImEncryptedPayload | null {
  try {
    const parsed = JSON.parse(raw) as ImEncryptedPayload
    if (parsed?.v !== IM_ENCRYPTED_PAYLOAD_VERSION) return null
    if (!parsed.iv || !parsed.ct || !parsed.tag) return null
    return parsed
  } catch {
    return null
  }
}

export async function createKeyProof(
  _privateKey: CryptoKey,
  publicKey: CryptoKey,
  userId: string
): Promise<string> {
  const ephem = await crypto.subtle.generateKey(ECDH_PARAMS, true, ['deriveKey', 'deriveBits'])
  const shared = await ecdhSharedBits(ephem.privateKey, publicKey)
  const wrapKey = await hkdfAesKey(shared, `proof:${userId}`, 'free-fs-im-proof-v1')
  const body = JSON.stringify({ v: 1, userId, check: 'ok' })
  const payload = await encryptWithAesGcm(wrapKey, body)
  const ephemPub = await exportPublicKeySpki(ephem.publicKey)
  const proof: ImKeyProofPayload = {
    ephemPub,
    iv: payload.iv,
    ct: payload.ct,
    tag: payload.tag,
  }
  return JSON.stringify(proof)
}

export async function verifyKeyProof(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
  userId: string,
  proofJson: string
): Promise<boolean> {
  try {
    const proof = JSON.parse(proofJson) as ImKeyProofPayload
    const ephemPublic = await importPublicKeySpki(proof.ephemPub)
    const shared = await ecdhSharedBits(privateKey, ephemPublic)
    const wrapKey = await hkdfAesKey(shared, `proof:${userId}`, 'free-fs-im-proof-v1')
    const body = await decryptWithAesGcm(wrapKey, {
      v: IM_ENCRYPTED_PAYLOAD_VERSION,
      iv: proof.iv,
      ct: proof.ct,
      tag: proof.tag,
    })
    const parsed = JSON.parse(body) as { userId?: string; check?: string }
    return parsed.userId === userId && parsed.check === 'ok'
  } catch {
    return false
  }
}

export async function wrapGroupKeyForMember(
  groupKeyRaw: Uint8Array,
  memberPublicKeySpki: string
): Promise<string> {
  const memberPublic = await importPublicKeySpki(memberPublicKeySpki)
  const ephem = await crypto.subtle.generateKey(ECDH_PARAMS, true, ['deriveKey', 'deriveBits'])
  const bits = await ecdhSharedBits(ephem.privateKey, memberPublic)
  const wrapKey = await hkdfAesKey(bits, 'group-key-wrap', 'free-fs-im-group-v1')
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrapKey, groupKeyRaw)
  const bytes = new Uint8Array(encrypted)
  const payload: ImWrappedGroupKeyPayload = {
    ephemPub: await exportPublicKeySpki(ephem.publicKey),
    iv: b64Encode(iv),
    ct: b64Encode(bytes.slice(0, -16)),
    tag: b64Encode(bytes.slice(-16)),
  }
  return JSON.stringify(payload)
}

export async function unwrapGroupKeyForMember(
  privateKey: CryptoKey,
  wrappedJson: string
): Promise<Uint8Array> {
  const payload = JSON.parse(wrappedJson) as ImWrappedGroupKeyPayload
  const ephemPublic = await importPublicKeySpki(payload.ephemPub)
  const bits = await ecdhSharedBits(privateKey, ephemPublic)
  const wrapKey = await hkdfAesKey(bits, 'group-key-wrap', 'free-fs-im-group-v1')
  const iv = b64Decode(payload.iv)
  const ct = b64Decode(payload.ct)
  const tag = b64Decode(payload.tag)
  const combined = new Uint8Array(ct.length + tag.length)
  combined.set(ct, 0)
  combined.set(tag, ct.length)
  const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, wrapKey, combined)
  return new Uint8Array(raw)
}

export async function importGroupAesKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw, AES_GCM, false, ['encrypt', 'decrypt'])
}

export function generateGroupKeyMaterial(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32))
}

export function downloadJsonFile(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
