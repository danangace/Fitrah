import { readFileSync } from 'node:fs'
import type { Hono } from 'hono'
import { API } from '../../shared/api'
import { UserError } from '../errors'
import type { DocsService } from './service'

const pathParam = (value: string | undefined): string => {
  if (!value) throw new UserError('missing_path', 'Missing ?path=')
  return value
}

export function registerDocsRoutes(app: Hono, docs: DocsService): void {
  app.get(API.docsTree, (c) => c.json(docs.tree()))
  app.get(API.docsFile, (c) => c.json(docs.read(pathParam(c.req.query('path')))))
  app.get(API.docsAsset, (c) => {
    const { full, type } = docs.asset(pathParam(c.req.query('path')))
    try {
      return c.body(readFileSync(full), 200, { 'content-type': type, 'cache-control': 'no-cache' })
    } catch {
      throw new UserError('asset_not_found', 'Image not found', 404)
    }
  })
}
