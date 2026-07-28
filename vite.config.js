import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['app-icon.svg'],
            manifest: {
                name: 'Registro Presenze',
                short_name: 'Presenze',
                description: 'Registro presenze semplice per squadre sportive',
                theme_color: '#173f35',
                background_color: '#f5f2ea',
                display: 'standalone',
                start_url: '/',
                icons: [
                    {
                        src: '/app-icon.svg',
                        sizes: 'any',
                        type: 'image/svg+xml',
                        purpose: 'any maskable'
                    }
                ]
            },
            workbox: {
                navigateFallbackDenylist: [/^\/remote\.php\//, /^\/public\.php\//]
            }
        })
    ]
});
