import type { Validators } from './fetch'

const UNCONDITIONAL: Validators = { etag: null, lastModified: null }

export type ValidatorStore = {
  get(id: string): Validators
  set(id: string, validators: Validators): void
}

export function createValidatorStore(): ValidatorStore {
  const stored = new Map<string, Validators>()
  return {
    get: (id) => stored.get(id) ?? UNCONDITIONAL,
    set: (id, validators) => {
      stored.set(id, validators)
    },
  }
}
