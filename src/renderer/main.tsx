import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { bootstrapSession } from './api/http-client'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

bootstrapSession()
  .catch(() => {
    root.textContent = 'Fitrah could not start a session. Open it with `fitrah start`.'
  })
  .finally(() => {
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
