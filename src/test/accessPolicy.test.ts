import { describe, expect, it } from 'vitest'
import {
  allowsCoachBackgroundSync,
  hasStoredSetupForMode
} from '../domain/accessPolicy'

const cloudConfig = {
  baseUrl: 'https://cloud.example.it',
  username: 'utente',
  appPassword: '',
  remoteFolder: ''
}

describe('politiche di accesso ai registri', () => {
  it('disattiva la sincronizzazione in background per le squadre del coordinatore', () => {
    expect(allowsCoachBackgroundSync('coordinator-managed')).toBe(false)
    expect(allowsCoachBackgroundSync('self-managed')).toBe(true)
  })

  it('considera soltanto i dati salvati per la modalità attiva', () => {
    expect(
      hasStoredSetupForMode('coach', { coordinatorConfig: cloudConfig })
    ).toBe(false)
    expect(
      hasStoredSetupForMode('coach', { coachConfig: cloudConfig })
    ).toBe(true)
    expect(
      hasStoredSetupForMode('viewer', { viewerConfig: cloudConfig })
    ).toBe(true)
    expect(
      hasStoredSetupForMode('coordinator', { coordinatorConfig: cloudConfig })
    ).toBe(true)
  })

  it('richiede il bootstrap quando non esiste ancora una modalità configurata', () => {
    expect(hasStoredSetupForMode(undefined, {})).toBe(false)
    expect(hasStoredSetupForMode('viewer', {})).toBe(false)
    expect(hasStoredSetupForMode('coach', {})).toBe(false)
  })
})
