const BACKUP_FOLDER_NAME = 'attendance-tracker-backups'

export function isBackupPath(value: string): boolean {
  return value
    .split(/[\\/]/)
    .filter(Boolean)
    .some((segment) => segment.toLocaleLowerCase() === BACKUP_FOLDER_NAME)
}
