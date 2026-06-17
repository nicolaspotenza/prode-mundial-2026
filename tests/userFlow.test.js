import { describe, it, expect, beforeEach } from 'vitest'
import { storage } from '../src/lib/storage.js'
import { registerOrSelectAlias, aliasExists } from '../src/hooks/useCurrentUser.js'

beforeEach(() => storage._resetForTests())

describe('alias flow', () => {
  it('creates a new user and sets current_user', async () => {
    const u = await registerOrSelectAlias('Nico')
    expect(u.alias).toBe('Nico')
    expect(await storage.get('current_user')).toBe('Nico')
    expect((await storage.get('users')).length).toBe(1)
  })
  it('selecting an existing alias does not duplicate', async () => {
    await registerOrSelectAlias('Nico')
    await registerOrSelectAlias('Nico')
    expect((await storage.get('users')).length).toBe(1)
  })
  it('aliasExists detects registered aliases case-insensitively', async () => {
    await registerOrSelectAlias('Nico')
    expect(await aliasExists('nico')).toBe(true)
    expect(await aliasExists('Otro')).toBe(false)
  })
})
