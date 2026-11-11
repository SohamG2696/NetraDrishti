import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const fontLink = document.getElementById('google-fonts-css') as HTMLLinkElement | null
if (fontLink) fontLink.rel = 'stylesheet'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
