import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { isDiscoveryHarnessRoute } from './dev/discoveryHarnessDev.ts'
import { isAdminRoute } from './admin/adminRoutes.ts'

const root = createRoot(document.getElementById('root')!)

async function renderShell() {
  if (isDiscoveryHarnessRoute()) {
    const { default: DiscoveryHarness } = await import('./dev/DiscoveryHarness.tsx')
    root.render(
      <StrictMode>
        <DiscoveryHarness />
      </StrictMode>,
    )
    return
  }

  if (isAdminRoute()) {
    const { default: AdminApp } = await import('./admin/AdminApp.tsx')
    root.render(
      <StrictMode>
        <AdminApp />
      </StrictMode>,
    )
    return
  }

  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void renderShell()

window.addEventListener('hashchange', () => {
  void renderShell()
})

window.addEventListener('popstate', () => {
  void renderShell()
})
