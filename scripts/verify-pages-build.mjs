import { readFile } from 'node:fs/promises'

const html = await readFile(new URL('../docs/index.html', import.meta.url), 'utf8')

if (html.includes('/src/main.tsx')) {
  throw new Error('La build Pages contiene ancora il sorgente TSX.')
}

if (!html.includes('/attendance-tracker/assets/')) {
  throw new Error('La build Pages non usa il percorso /attendance-tracker/.')
}

if (!html.includes('/attendance-tracker/manifest.webmanifest')) {
  throw new Error('Il manifest PWA non usa il percorso /attendance-tracker/.')
}

console.log('Build GitHub Pages valida.')
