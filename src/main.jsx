import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.jsx'
import { ToastProvider } from './context/ToastContext.jsx'

Sentry.init({
  dsn: 'https://26471b758a7a09bdc0aca8742e2c1474@o4511161542639616.ingest.de.sentry.io/4511161571475536',
  environment: import.meta.env.MODE,
  enabled: import.meta.env.PROD,
})

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<div className="min-h-screen flex items-center justify-center bg-bg-primary text-text-primary text-sm">Something went wrong. Please refresh the page.</div>}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>
)
