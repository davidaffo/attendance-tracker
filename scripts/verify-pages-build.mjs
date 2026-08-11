import { readFile } from 'node:fs/promises'

const html = await readFile(new URL('../docs/index.html', import.meta.url), 'utf8')
const serviceWorker = await readFile(new URL('../docs/sw.js', import.meta.url), 'utf8')

if (html.includes('/src/main.tsx')) {
  throw new Error('La build Pages contiene ancora il sorgente TSX.')
}

if (!html.includes('/attendance-tracker/assets/')) {
  throw new Error('La build Pages non usa il percorso /attendance-tracker/.')
}

if (!html.includes('/attendance-tracker/manifest.webmanifest')) {
  throw new Error('Il manifest PWA non usa il percorso /attendance-tracker/.')
}

if (html.includes('registerSW.js')) {
  throw new Error('La build registra ancora il service worker automatico precedente.')
}

if (!serviceWorker.includes('SKIP_WAITING')) {
  throw new Error('Il service worker non supporta l’aggiornamento confermato dall’utente.')
}

if (serviceWorker.includes('self.skipWaiting(),')) {
  throw new Error('Il service worker applica ancora gli aggiornamenti senza mostrare l’avviso.')
}

console.log('Build GitHub Pages valida.')
