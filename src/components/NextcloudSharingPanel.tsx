import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Eye,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  UsersRound
} from 'lucide-react'
import type { SyncConfig, TeamDocument } from '../domain/types'
import {
  listNextcloudDirectoryUsers,
  type NextcloudDirectoryUser
} from '../services/nextcloudDirectory'
import {
  createNextcloudShare,
  deleteNextcloudShare,
  listNextcloudShares,
  NEXTCLOUD_PERMISSION_UPDATE,
  NEXTCLOUD_PERMISSIONS_EDITOR,
  NEXTCLOUD_PERMISSIONS_VIEWER,
  NEXTCLOUD_SHARE_TYPE_GROUP,
  NEXTCLOUD_SHARE_TYPE_USER,
  nextcloudDocumentFolderUrl,
  updateNextcloudSharePermissions,
  type NextcloudShare,
  type NextcloudSharee
} from '../services/nextcloudSharing'

interface NextcloudSharingPanelProps {
  document: TeamDocument
  config: SyncConfig
  onEnsureConfig: () => Promise<SyncConfig | undefined>
}

type PanelStatus = 'idle' | 'loading' | 'ready' | 'error'

function shareTypeLabel(shareType: number): string {
  switch (shareType) {
    case NEXTCLOUD_SHARE_TYPE_USER:
      return 'Utente'
    case NEXTCLOUD_SHARE_TYPE_GROUP:
      return 'Gruppo'
    case 3:
      return 'Link pubblico'
    case 4:
      return 'Email'
    case 6:
      return 'Federata'
    case 7:
      return 'Team Nextcloud'
    default:
      return 'Condivisione'
  }
}

function roleFromPermissions(permissions: number): number {
  return permissions & NEXTCLOUD_PERMISSION_UPDATE
    ? NEXTCLOUD_PERMISSIONS_EDITOR
    : NEXTCLOUD_PERMISSIONS_VIEWER
}

export function NextcloudSharingPanel({
  document,
  config,
  onEnsureConfig
}: NextcloudSharingPanelProps) {
  const pwaOrigin = typeof window === 'undefined' ? '' : window.location.origin
  const [status, setStatus] = useState<PanelStatus>('idle')
  const [shares, setShares] = useState<NextcloudShare[]>([])
  const [directoryUsers, setDirectoryUsers] = useState<NextcloudDirectoryUser[]>([])
  const [directoryError, setDirectoryError] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [busyAction, setBusyAction] = useState<string>()
  const [shareToRemove, setShareToRemove] = useState<NextcloudShare>()
  const [removeError, setRemoveError] = useState('')
  const [message, setMessage] = useState('')

  const resolveConfig = async (): Promise<SyncConfig | undefined> => {
    const ready = config.appPassword ? config : await onEnsureConfig()
    return ready ? { ...ready, remoteFolder: config.remoteFolder } : undefined
  }

  const loadShares = async (providedConfig?: SyncConfig) => {
    setStatus('loading')
    setMessage('')
    try {
      const ready = providedConfig ?? (await resolveConfig())
      if (!ready) {
        setStatus('idle')
        setMessage('Accesso alle condivisioni non eseguito.')
        return
      }
      const [sharesResult, directoryResult] = await Promise.allSettled([
        listNextcloudShares(ready, document),
        listNextcloudDirectoryUsers(ready)
      ])
      if (sharesResult.status === 'rejected') throw sharesResult.reason
      setShares(sharesResult.value)
      if (directoryResult.status === 'fulfilled') {
        setDirectoryUsers(directoryResult.value)
        setDirectoryError('')
      } else {
        setDirectoryUsers([])
        setDirectoryError(
          directoryResult.reason instanceof Error
            ? directoryResult.reason.message
            : 'Impossibile caricare la rubrica utenti Nextcloud.'
        )
      }
      setStatus('ready')
    } catch (error) {
      setStatus('error')
      setMessage(
        error instanceof Error
          ? error.message
          : 'Impossibile caricare le condivisioni Nextcloud.'
      )
    }
  }

  useEffect(() => {
    setShares([])
    setDirectoryUsers([])
    setDirectoryError('')
    setUserFilter('')
    setMessage('')
    if (config.appPassword) {
      void loadShares(config)
    } else {
      setStatus('idle')
    }
  }, [document.teamId, document.season.startYear, config.baseUrl, config.username, config.remoteFolder])

  const addShare = async (
    user: NextcloudDirectoryUser,
    permissions: number
  ) => {
    const sharee: NextcloudSharee = {
      shareType: NEXTCLOUD_SHARE_TYPE_USER,
      shareWith: user.id,
      displayName: user.displayName
    }
    const duplicate = shares.some(
      (share) =>
        share.shareType === sharee.shareType && share.shareWith === sharee.shareWith
    )
    if (duplicate) {
      setMessage(`${sharee.displayName} ha già accesso a questo registro.`)
      return
    }
    setBusyAction(`add:${user.id}`)
    setMessage('')
    try {
      const ready = await resolveConfig()
      if (!ready) return
      await createNextcloudShare(ready, document, sharee, permissions)
      setShares(await listNextcloudShares(ready, document))
      setStatus('ready')
      setMessage(
        `${sharee.displayName} aggiunto come ${
          permissions === NEXTCLOUD_PERMISSIONS_EDITOR
            ? 'allenatore con scrittura delle presenze'
            : 'giocatrice in sola lettura'
        }.`
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Condivisione non riuscita.')
    } finally {
      setBusyAction(undefined)
    }
  }

  const changePermissions = async (share: NextcloudShare, permissions: number) => {
    setBusyAction(`update:${share.id}`)
    setMessage('')
    try {
      const ready = await resolveConfig()
      if (!ready) return
      await updateNextcloudSharePermissions(ready, share.id, permissions)
      setShares((current) =>
        current.map((candidate) =>
          candidate.id === share.id ? { ...candidate, permissions } : candidate
        )
      )
      setMessage(`Permessi di ${share.displayName} aggiornati.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Modifica non riuscita.')
    } finally {
      setBusyAction(undefined)
    }
  }

  const removeShare = async (share: NextcloudShare) => {
    setBusyAction(`delete:${share.id}`)
    setMessage('')
    setRemoveError('')
    try {
      const ready = await resolveConfig()
      if (!ready) return
      await deleteNextcloudShare(ready, share.id)
      const refreshedShares = await listNextcloudShares(ready, document)
      if (refreshedShares.some((candidate) => candidate.id === share.id)) {
        throw new Error(
          'Nextcloud ha ricevuto la richiesta ma la condivisione risulta ancora attiva.'
        )
      }
      setShares(refreshedShares)
      setShareToRemove(undefined)
      setMessage(`Accesso di ${share.displayName} rimosso.`)
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Errore sconosciuto.'
      setRemoveError(detail)
      setMessage(
        `Rimozione non riuscita per ${share.displayName}. Apri la conferma per i dettagli.`
      )
    } finally {
      setBusyAction(undefined)
    }
  }

  const sharedUserIds = new Set(
    shares
      .filter((share) => share.shareType === NEXTCLOUD_SHARE_TYPE_USER)
      .map((share) => share.shareWith)
  )
  const normalizedFilter = userFilter.trim().toLocaleLowerCase()
  const availableUsers = directoryUsers.filter(
    (user) =>
      !sharedUserIds.has(user.id) &&
      (!normalizedFilter ||
        user.displayName.toLocaleLowerCase().includes(normalizedFilter) ||
        user.email?.toLocaleLowerCase().includes(normalizedFilter))
  )

  return (
    <section className="sharing-panel" aria-busy={status === 'loading' || Boolean(busyAction)}>
      <div className="sharing-panel-heading">
        <div>
          <span className="eyebrow">Nextcloud</span>
          <h2>Accessi e condivisioni</h2>
          <p>
            Condividi soltanto questo registro. Nextcloud applica e verifica i permessi
            dell’account coordinatore.
          </p>
        </div>
        <button
          className="button secondary compact"
          type="button"
          onClick={() => void loadShares()}
          disabled={status === 'loading' || Boolean(busyAction)}
        >
          <RefreshCw className={status === 'loading' ? 'spin' : undefined} size={16} />
          {status === 'idle' ? 'Verifica accesso' : 'Aggiorna'}
        </button>
      </div>

      {status === 'loading' && (
        <div className="sharing-status" role="status">
          <RefreshCw className="spin" size={19} />
          Controllo le condivisioni del registro…
        </div>
      )}

      {status === 'error' && (
        <div className="sharing-warning" role="alert">
          <AlertTriangle size={19} />
          <div>
            <strong>Gestione diretta non disponibile</strong>
            <span>{message}</span>
            <div className="sharing-cors-help">
              <strong>Configurazione da fare come amministratore Nextcloud:</strong>
              <ol>
                <li>Apri Impostazioni → Impostazioni di amministrazione → WebAppPassword.</li>
                <li>
                  Scorri fino a <strong>Files sharing API</strong>, non fermarti alla
                  sezione WebDAV.
                </li>
                <li>
                  In <strong>Allowed origins for files sharing api</strong> aggiungi
                  l’origine esatta <code>{pwaOrigin || 'http://localhost:5173'}</code>.
                </li>
                <li>Premi <strong>Set origins</strong>, poi torna qui e usa Aggiorna.</li>
              </ol>
              <small>
                Inserisci solo protocollo, dominio e porta: nessun percorso e nessuna
                barra finale. Le origini di produzione possono essere aggiunte separate
                da virgole.
              </small>
            </div>
          </div>
        </div>
      )}

      {status === 'idle' && (
        <div className="sharing-status">
          <ShieldCheck size={20} />
          Verifica che l’account possa leggere e amministrare le condivisioni del file.
        </div>
      )}

      {message && status !== 'error' && (
        <p className="sharing-message" role="status">{message}</p>
      )}

      {status === 'ready' && (
        <>
          <div className="sharing-current">
            <h3>Accessi attuali</h3>
            {shares.length === 0 ? (
              <p className="sharing-empty">Il registro non è ancora condiviso.</p>
            ) : (
              <div className="sharing-list">
                {shares.map((share) => {
                  const actionBusy = busyAction?.endsWith(`:${share.id}`)
                  return (
                    <div className="sharing-row" key={share.id}>
                      <span className="sharing-person-icon">
                        {share.shareType === NEXTCLOUD_SHARE_TYPE_GROUP ? (
                          <UsersRound size={18} />
                        ) : (
                          <UserPlus size={18} />
                        )}
                      </span>
                      <span className="sharing-person">
                        <strong>{share.displayName}</strong>
                        <small>{shareTypeLabel(share.shareType)} · {share.shareWith}</small>
                      </span>
                      {share.canEdit &&
                      (share.shareType === NEXTCLOUD_SHARE_TYPE_USER ||
                        share.shareType === NEXTCLOUD_SHARE_TYPE_GROUP) ? (
                        <div
                          className="sharing-role-buttons"
                          aria-label={`Permessi di ${share.displayName}`}
                        >
                          <button
                            className={
                              roleFromPermissions(share.permissions) ===
                              NEXTCLOUD_PERMISSIONS_VIEWER
                                ? 'selected'
                                : ''
                            }
                            type="button"
                            disabled={Boolean(busyAction)}
                            onClick={() =>
                              void changePermissions(
                                share,
                                NEXTCLOUD_PERMISSIONS_VIEWER
                              )
                            }
                          >
                            <Eye size={15} /> Sola lettura
                          </button>
                          <button
                            className={
                              roleFromPermissions(share.permissions) ===
                              NEXTCLOUD_PERMISSIONS_EDITOR
                                ? 'selected'
                                : ''
                            }
                            type="button"
                            disabled={Boolean(busyAction)}
                            onClick={() =>
                              void changePermissions(
                                share,
                                NEXTCLOUD_PERMISSIONS_EDITOR
                              )
                            }
                          >
                            <Pencil size={15} /> Compila presenze
                          </button>
                        </div>
                      ) : share.canDelete ? (
                        <span className="sharing-readonly-share">
                          {shareTypeLabel(share.shareType)} gestita da Nextcloud
                        </span>
                      ) : (
                        <span className="sharing-readonly-share">
                          Non modificabile da questo account
                        </span>
                      )}
                      {share.canDelete ? (
                        <button
                          className="icon-button quiet"
                          type="button"
                          disabled={Boolean(busyAction)}
                          onClick={() => {
                            setRemoveError('')
                            setShareToRemove(share)
                          }}
                          aria-label={`Rimuovi accesso di ${share.displayName}`}
                        >
                          {actionBusy ? (
                            <RefreshCw className="spin" size={17} />
                          ) : (
                            <Trash2 size={17} />
                          )}
                        </button>
                      ) : (
                        <span aria-hidden="true" />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="sharing-add">
            <div className="sharing-add-heading">
              <div>
                <h3>Aggiungi persone</h3>
                <p>
                  Scegli direttamente dalla rubrica Nextcloud chi può leggere e chi può
                  modificare questo registro.
                </p>
              </div>
            </div>
            {directoryError ? (
              <div className="sharing-directory-warning" role="status">
                <AlertTriangle size={18} />
                <div>
                  <strong>Rubrica utenti non disponibile</strong>
                  <span>{directoryError}</span>
                </div>
              </div>
            ) : (
              <>
                {directoryUsers.length > 6 && (
                  <label className="sharing-directory-filter">
                    <Search size={17} />
                    <span className="visually-hidden">Filtra persone</span>
                    <input
                      value={userFilter}
                      onChange={(event) => setUserFilter(event.target.value)}
                      placeholder="Filtra per nome o email"
                    />
                  </label>
                )}
                {availableUsers.length === 0 ? (
                  <p className="sharing-empty">
                    {userFilter
                      ? 'Nessuna persona corrisponde al filtro.'
                      : 'Tutte le persone disponibili hanno già accesso.'}
                  </p>
                ) : (
                  <div className="sharing-directory-list">
                    {availableUsers.map((user) => {
                      const adding = busyAction === `add:${user.id}`
                      return (
                        <div className="sharing-directory-row" key={user.id}>
                          <span className="sharing-person-icon">
                            {adding ? <RefreshCw className="spin" size={17} /> : <UserPlus size={18} />}
                          </span>
                          <span className="sharing-person">
                            <strong>{user.displayName}</strong>
                            <small>{user.email || user.id}</small>
                          </span>
                          <div className="sharing-directory-actions">
                            <button
                              className="button secondary compact"
                              type="button"
                              disabled={Boolean(busyAction)}
                              onClick={() => void addShare(user, NEXTCLOUD_PERMISSIONS_VIEWER)}
                            >
                              <Eye size={15} /> Sola lettura
                            </button>
                            <button
                              className="button primary compact"
                              type="button"
                              disabled={Boolean(busyAction)}
                              onClick={() => void addShare(user, NEXTCLOUD_PERMISSIONS_EDITOR)}
                            >
                              <Pencil size={15} /> Compila presenze
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {shareToRemove && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="modal-card sharing-remove-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="sharing-remove-title"
          >
            <div>
              <span className="eyebrow">Conferma rimozione</span>
              <h2 id="sharing-remove-title">Rimuovere {shareToRemove.displayName}?</h2>
              <p>
                L’utente perderà l’accesso a questo registro. Gli altri registri e le
                altre condivisioni non verranno modificati.
              </p>
              {removeError && (
                <div className="sharing-warning" role="alert">
                  <AlertTriangle size={18} />
                  <div>
                    <strong>Rimozione bloccata dal server</strong>
                    <span>{removeError}</span>
                    <a
                      className="button secondary compact"
                      href={nextcloudDocumentFolderUrl(config)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Apri la cartella in Nextcloud
                    </a>
                  </div>
                </div>
              )}
            </div>
            <div className="inline-actions">
              <button
                className="button secondary"
                type="button"
                disabled={Boolean(busyAction)}
                onClick={() => setShareToRemove(undefined)}
              >
                Annulla
              </button>
              <button
                className="button danger"
                type="button"
                disabled={Boolean(busyAction)}
                onClick={() => void removeShare(shareToRemove)}
              >
                {busyAction === `delete:${shareToRemove.id}` ? (
                  <RefreshCw className="spin" size={17} />
                ) : (
                  <Trash2 size={17} />
                )}
                Rimuovi accesso
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
