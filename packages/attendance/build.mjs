import { build } from 'vite'
import postcss from 'postcss'
import { readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('.', import.meta.url))
await build({
  configFile: false,
  root: directory,
  build: {
    lib: { entry: { attendance: `${directory}src/index.ts`, domain: `${directory}src/domain/index.ts` }, formats: ['es'], fileName: (_format, name) => `${name}.js` },
    rollupOptions: { external: (id) => /^(react|react-dom)(\/|$)/.test(id) },
  },
  esbuild: { jsx: 'automatic' },
})
execFileSync(process.execPath, [fileURLToPath(new URL('../../node_modules/typescript/bin/tsc', import.meta.url)), '-p', `${directory}tsconfig.json`], { stdio: 'inherit' })

// Scope every selector, including selectors inside media queries. Keyframe steps
// are not selectors and must remain untouched. The original CSS serves the PWA.
const css = postcss.parse(await readFile(`${directory}styles/app.css`, 'utf8'))
css.walkRules(rule => {
  if (rule.parent.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return
  // PostCSS's selector list understands commas inside :is(...).
  rule.selectors = rule.selectors.map(selector => {
    if (selector.startsWith("html[data-theme='dark']")) {
      return selector.replace("html[data-theme='dark']", '.attendance-module[data-theme="dark"]').replace(/ body\b/g, '')
    }
    if (/^html:not/.test(selector)) return `.attendance-module ${selector}`
    if (/^(:root|html|body)$/.test(selector)) return '.attendance-module'
    return `.attendance-module ${selector}`
  })
})
css.walkAtRules(/keyframes$/, rule => { rule.params = `attendance-${rule.params}` })
css.walkDecls(/^animation/, decl => {
  decl.value = decl.value.replace(/\b(spin|loading-progress)\b/g, 'attendance-$1')
})
css.append('.attendance-module { min-height: 0; padding: 16px; border-radius: 12px; } .attendance-module .page-content { padding: 0; }')
await writeFile(`${directory}dist/styles.css`, css.toString())
await writeFile(`${directory}dist/THIRD_PARTY_NOTICES.txt`, await readFile(new URL('../../node_modules/lucide-react/LICENSE', import.meta.url), 'utf8'))
