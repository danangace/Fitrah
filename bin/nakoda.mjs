#!/usr/bin/env node
// Global entry (`pnpm link --global`): run the TypeScript CLI through tsx.
import { register } from 'tsx/esm/api'

register()
await import('../src/cli/nakoda.ts')
