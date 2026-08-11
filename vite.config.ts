import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const isGitHubPages = mode === 'github-pages'
  const base = isGitHubPages ? '/attendance-tracker/' : '/'

  return {
    base,
    build: {
      outDir: isGitHubPages ? 'docs' : 'dist'
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['app-icon.svg', 'app-icon-192.png', 'app-icon-512.png'],
        manifest: {
          name: 'Registro Presenze',
          short_name: 'Presenze',
          description: 'Registro presenze per squadre sportive',
          theme_color: '#173f35',
          background_color: '#f5f2ea',
          display: 'standalone',
          lang: 'it',
          start_url: `${base}#/`,
          scope: base,
          icons: [
            {
              src: `${base}app-icon-192.png`,
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: `${base}app-icon-512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          navigateFallbackDenylist: [/^\/remote\.php\//, /^\/public\.php\//]
        }
      })
    ]
  }
})
