import type { TeamDocument, TrainingSession } from './types'

export type SyncConflictChoice = 'local' | 'remote'
export interface DocumentMerge {
  document: TeamDocument
  conflicts: string[]
}

// Compare content, independent of object key order and edit timestamps.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'undefined'
}

function sessionContent(session?: TrainingSession) {
  if (!session) return undefined
  const { id: _id, createdAt: _created, updatedAt: _updated,
    attendanceUpdatedAt: _attendance, updatedBy: _author, score, ...content } = session
  const scoreContent = score && (() => {
    const { updatedAt: _updated, updatedBy: _author, ...data } = score
    return data
  })()
  return { ...content, earlyDepartures: [...(session.earlyDepartures ?? [])].sort(), score: scoreContent }
}

export function mergeDocumentsFromBase(
  local: TeamDocument,
  remote: TeamDocument,
  base?: TeamDocument,
  choice?: SyncConflictChoice
): DocumentMerge {
  if (local.teamId !== remote.teamId || local.season.startYear !== remote.season.startYear ||
      local.season.endYear !== remote.season.endYear || (base &&
        (base.teamId !== local.teamId || canonical(base.season) !== canonical(local.season)))) {
    throw new Error('Il file remoto appartiene a una squadra o stagione diversa.')
  }
  const conflicts: string[] = []
  const equal = (a: unknown, b: unknown) => canonical(a) === canonical(b)
  const merge = (l: unknown, r: unknown, b: unknown, path: string): unknown => {
    if (equal(l, r)) return l
    if (base && equal(l, b)) return r
    if (base && equal(r, b)) return l
    const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
    if (object(l) && object(r) && (object(b) || b === undefined)) {
      const keys = new Set([...Object.keys(l), ...Object.keys(r), ...Object.keys(b ?? {})])
      return Object.fromEntries([...keys].map(key => [key, merge(l[key], r[key], object(b) ? b[key] : undefined, `${path}.${key}`)]).filter(([, v]) => v !== undefined))
    }
    // Without a common ancestor, distinct newly added dates are still safe to combine.
    if (!base && path.startsWith('sessions.') && path.split('.').length === 2 && (!l || !r)) return l ?? r
    conflicts.push(path)
    return choice === 'remote' ? r : l
  }
  const { sessions: _ls, revision: _lr, updatedAt: _lu, updatedBy: _lb, ...localData } = local
  const { sessions: _rs, revision: _rr, updatedAt: _ru, updatedBy: _rb, ...remoteData } = remote
  const baseData = base && (() => {
    const { sessions: _s, revision: _r, updatedAt: _u, updatedBy: _b, ...data } = base
    return data
  })()
  const data = merge(localData, remoteData, baseData, 'registro') as typeof localData
  const byDate = (d?: TeamDocument) => new Map(d?.sessions.map(s => [s.date, s]) ?? [])
  const l = byDate(local), r = byDate(remote), b = byDate(base)
  const sessions: TrainingSession[] = []
  for (const date of new Set([...l.keys(), ...r.keys(), ...b.keys()])) {
    const ls = l.get(date), rs = r.get(date), bs = b.get(date)
    const content = merge(sessionContent(ls), sessionContent(rs), sessionContent(bs), `sessions.${date}`) as ReturnType<typeof sessionContent>
    if (!content) continue
    const source = !ls ? rs! : !rs ? ls : ls.updatedAt >= rs.updatedAt ? ls : rs
    const scoreSource = !ls?.score ? rs?.score : !rs?.score ? ls.score : ls.score.updatedAt >= rs.score.updatedAt ? ls.score : rs.score
    sessions.push({ ...source, ...content, score: content.score && scoreSource ? { ...scoreSource, ...content.score } : undefined })
  }
  return {
    document: { ...data, revision: Math.max(local.revision, remote.revision) + 1,
      updatedAt: new Date().toISOString(), updatedBy: local.updatedBy,
      sessions: sessions.sort((a, b) => a.date.localeCompare(b.date)) },
    conflicts
  }
}
