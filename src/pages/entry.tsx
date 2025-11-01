import React from 'react'
import { createRoot } from 'react-dom/client'

type ComponentModule = { default: React.ComponentType }

const container = document.getElementById('root')!
const root = createRoot(container)

async function loadAndRender() {
  // 1) ハッシュ（#popup / #settings）を優先
  const hash = window.location.hash.replace(/^#/, '')
  // 2) 互換: パスから pages/<key>/ を推測（古い構成に対応）
  const parts = window.location.pathname.split('/')
  const pagesIdx = parts.lastIndexOf('pages')
  const pathKey = pagesIdx >= 0 && parts.length > pagesIdx + 1 ? parts[pagesIdx + 1] : undefined
  const key = hash || pathKey

  let mod: ComponentModule
  switch (key) {
    case 'popup':
      mod = await import('./popup/page')
      break
    case 'settings':
      mod = await import('./settings/page')
      break
    default:
      mod = { default: () => <div>Unknown page</div> }
  }

  const Page = mod.default
  root.render(
    <React.StrictMode>
      <Page />
    </React.StrictMode>
  )
}

loadAndRender()
