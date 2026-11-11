import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { z } from 'zod/v4'
import { API } from '../shared/api'
import { App } from './App'
import { ApiError, bootstrapSession, request } from './api/http-client'
import { NotConnected } from './pages/NotConnected'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

/** True when this browser holds a valid session (cookie). */
async function connected(): Promise<boolean> {
  try {
    await bootstrapSession()
    await request('GET', API.settings, z.unknown())
    return true
  } catch (error) {
    return !(error instanceof ApiError && (error.status === 401 || error.code === 'session_failed'))
  }
}

void connected().then((ok) => {
  createRoot(root).render(<StrictMode>{ok ? <App /> : <NotConnected />}</StrictMode>)
})
