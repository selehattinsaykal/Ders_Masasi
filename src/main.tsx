import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'

// Çevrimdışı çalışma: uygulama kabuğu önbelleğe alınır, yeni sürüm gelince kendiliğinden güncellenir.
registerSW({ immediate: true })

// Tarayıcı yer açmak için veriyi silmesin.
void navigator.storage?.persist?.()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
