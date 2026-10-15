/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { fetchImCryptoMe } from '@/api/im-crypto'
import type { ImPrivateKeyBackup } from '@/lib/im-crypto'
import {
  importPublicKeySpki,
  unwrapPrivateKeyBackup,
  verifyKeyProof,
} from '@/lib/im-crypto'
import { useImCryptoStore } from '@/store/im-crypto'

export async function activateImCryptoFromBackup(
  backup: ImPrivateKeyBackup,
  userId: string
) {
  const privateKey = await unwrapPrivateKeyBackup(backup)
  const publicKey = await importPublicKeySpki(backup.publicKeySpki)
  const me = await fetchImCryptoMe().catch(() => null)
  if (me?.registered && me.keyProof) {
    const ok = await verifyKeyProof(privateKey, publicKey, userId, me.keyProof)
    if (!ok) {
      throw new Error('im.crypto.proof.mismatch')
    }
  }
  useImCryptoStore.getState().setSession({
    privateKey,
    publicKeySpki: backup.publicKeySpki,
  })
}
