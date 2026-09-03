import {
  mergeDocuments,
  parseTeamDocument,
  serializeTeamDocument
} from '../domain/document'
import { isBackupPath } from '../domain/backup'
import type { TeamSummary } from '../domain/types'

async function scanHandle(
  handle: FileSystemDirectoryHandle,
  prefix: string,
  output: TeamSummary[]
): Promise<void> {
  for await (const entry of handle.values()) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.kind === 'directory') {
      if (isBackupPath(path)) continue
      await scanHandle(entry, path, output)
      continue
    }
    if (!entry.name.endsWith('.attendance.json') || isBackupPath(path)) continue

    try {
      const file = await entry.getFile()
      output.push({
        source: path,
        document: parseTeamDocument(await file.text()),
        fileHandle: entry
      })
    } catch (error) {
      console.warn(`File ignorato: ${path}`, error)
    }
  }
}

export async function scanDirectoryHandle(
  handle: FileSystemDirectoryHandle
): Promise<TeamSummary[]> {
  const output: TeamSummary[] = []
  await scanHandle(handle, '', output)
  return output.sort((a, b) => a.document.teamName.localeCompare(b.document.teamName))
}

export async function pickAndScanDirectory(): Promise<{
  handle: FileSystemDirectoryHandle
  teams: TeamSummary[]
}> {
  if (!window.showDirectoryPicker) {
    throw new Error('Questo browser non consente di scegliere una cartella locale.')
  }
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
  return { handle, teams: await scanDirectoryHandle(handle) }
}

export async function writeTeamDocumentToFile(
  handle: FileSystemFileHandle,
  document: TeamSummary['document']
): Promise<TeamSummary['document']> {
  let permission = await handle.queryPermission({ mode: 'readwrite' })
  if (permission !== 'granted') {
    permission = await handle.requestPermission({ mode: 'readwrite' })
  }
  if (permission !== 'granted') {
    throw new Error('Il browser non ha il permesso di modificare questo file locale.')
  }

  const current = parseTeamDocument(await (await handle.getFile()).text())
  const next = serializeTeamDocument(current) === serializeTeamDocument(document)
    ? document
    : mergeDocuments(document, current)
  const writable = await handle.createWritable()
  try {
    await writable.write(serializeTeamDocument(next))
  } finally {
    await writable.close()
  }
  return next
}

export async function parseSelectedFiles(files: FileList): Promise<TeamSummary[]> {
  const output: TeamSummary[] = []
  for (const file of files) {
    if (!file.name.endsWith('.attendance.json') || isBackupPath(file.webkitRelativePath)) continue
    try {
      output.push({
        source: file.webkitRelativePath || file.name,
        document: parseTeamDocument(await file.text())
      })
    } catch (error) {
      console.warn(`File ignorato: ${file.name}`, error)
    }
  }
  return output.sort((a, b) => a.document.teamName.localeCompare(b.document.teamName))
}
