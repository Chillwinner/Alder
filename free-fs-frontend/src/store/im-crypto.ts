/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { create } from 'zustand'

type ImCryptoState = {
  unlocked: boolean
  privateKey: CryptoKey | null
  publicKeySpki: string | null
  groupKeys: Record<string, CryptoKey>
  setSession: (session: {
    privateKey: CryptoKey
    publicKeySpki: string
  }) => void
  clearSession: () => void
  setGroupKey: (groupId: string, key: CryptoKey) => void
  clearGroupKeys: () => void
}

export const useImCryptoStore = create<ImCryptoState>((set) => ({
  unlocked: false,
  privateKey: null,
  publicKeySpki: null,
  groupKeys: {},
  setSession: ({ privateKey, publicKeySpki }) =>
    set({ unlocked: true, privateKey, publicKeySpki, groupKeys: {} }),
  clearSession: () =>
    set({ unlocked: false, privateKey: null, publicKeySpki: null, groupKeys: {} }),
  setGroupKey: (groupId, key) =>
    set((state) => ({ groupKeys: { ...state.groupKeys, [groupId]: key } })),
  clearGroupKeys: () => set({ groupKeys: {} }),
}))
