import { useEffect, useState } from 'react'
import type { ModelOption } from '../../shared/schemas'
import { api } from '../api/fitrah'
import { modelInfo } from './models'

// One request per account per page load; the runtime keeps the list in its DB.
const catalogRequests = new Map<string, Promise<ModelOption[]>>()
export function useAccountModels(accountId: string | null): ModelOption[] {
  const [models, setModels] = useState<ModelOption[]>([])
  useEffect(() => {
    if (!accountId) return setModels([])
    let alive = true
    let request = catalogRequests.get(accountId)
    if (!request) {
      request = api.accountModels(accountId).then((c) => c.models, () => [])
      catalogRequests.set(accountId, request)
    }
    void request.then((m) => alive && setModels(m))
    return () => {
      alive = false
    }
  }, [accountId])
  return models
}

/** Name + description of a model id: the account's own (e.g. "Fable 5.2"), else a best guess. */
export function describeModel(offered: ModelOption[], id: string): { name: string; description: string } {
  const known = offered.find((o) => o.value === id)
  return known ? { name: known.displayName, description: known.description } : modelInfo(id)
}
