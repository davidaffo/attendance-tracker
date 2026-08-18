const BACKUP_FOLDER_NAMES = new Set([
  'backup',
  'backups',
  'attendance-tracker-backups'
])

export function isBackupPath(value: string): boolean {
  return value
    .split(/[\\/]/)
    .filter(Boolean)
    .some((segment) => BACKUP_FOLDER_NAMES.has(segment.toLocaleLowerCase()))
}
