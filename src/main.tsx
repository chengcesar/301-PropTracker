import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './design-system.css'
import './tailwind.css'
import './auth.css'
import { initAccentFromStorage } from './lib/accentTheme'
import App from './App.tsx'

initAccentFromStorage()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
