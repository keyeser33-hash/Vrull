import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/App'
import { startData } from '@/data/app-data'
import { registerBackButton } from '@/lib/back-button'
import { applyTheme, readTheme } from '@/lib/theme'
import '@/styles/app.css'

applyTheme(readTheme())
registerBackButton()
void startData()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
