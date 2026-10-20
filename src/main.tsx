import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import App from './App'
import './styles/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: { borderRadius: 14, border: '1px solid #E6E9F2', fontFamily: 'Inter, sans-serif', boxShadow: '0 16px 40px -12px rgba(49,84,223,0.25)' },
        }}
        richColors
        closeButton
      />
    </BrowserRouter>
  </StrictMode>,
)
