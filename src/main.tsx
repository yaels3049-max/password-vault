import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { isDiscoveryHarnessRoute } from './dev/discoveryHarnessDev.ts'

const root = createRoot(document.getElementById('root')!)

async function bootstrap() {
  if (isDiscoveryHarnessRoute()) {
    const { default: DiscoveryHarness } = await import('./dev/DiscoveryHarness.tsx')
    root.render(
      <StrictMode>
        <DiscoveryHarness />
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

void bootstrap()
