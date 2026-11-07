import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/App'
import { registerBackButton } from '@/lib/back-button'
import { applyTheme, readTheme } from '@/lib/theme'
import '@/styles/app.css'

applyTheme(readTheme())
registerBackButton()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
