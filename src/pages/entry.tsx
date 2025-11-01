import React from 'react'
import { createRoot } from 'react-dom/client'

type ComponentModule = { default: React.ComponentType }

const container = document.getElementById('root')!
const root = createRoot(container)

async function loadAndRender() {
  const hash = window.location.hash.replace(/^#/, '')
  const key = hash

  const mod: ComponentModule = await import(`./${key}/page`);

  const Page = mod.default
  root.render(
    <React.StrictMode>
      <Page />
    </React.StrictMode>
  )
}

loadAndRender()
