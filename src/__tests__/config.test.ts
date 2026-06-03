jest.mock('electron', () => ({
  app: { getPath: jest.fn(() => '/mock/home/.config/vet') },
  BrowserWindow: {},
  shell: { openExternal: jest.fn() },
  ipcMain: { handle: jest.fn() },
}))

jest.mock('chokidar', () => ({
  watch: jest.fn(() => ({ on: jest.fn() })),
}))

import { sanitizeConfig } from '../main/config'

describe('sanitizeConfig', () => {
  it('populates missing customThemes', () => {
    const result = sanitizeConfig({})
    expect(result.customThemes).toEqual({})
  })

  it('replaces non-object customThemes with empty object', () => {
    const result = sanitizeConfig({ customThemes: 'string' })
    expect(result.customThemes).toEqual({})
  })

  it('preserves valid customThemes', () => {
    const result = sanitizeConfig({ customThemes: { myTheme: {} } })
    expect(result.customThemes).toEqual({ myTheme: {} })
  })

  it('populates missing keybindings with defaults', () => {
    const result = sanitizeConfig({})
    expect(result.keybindings).toBeDefined()
    expect(typeof result.keybindings).toBe('object')
    expect(result.keybindings['ctrl+b']).toBe('sidebar:toggle')
  })

  it('replaces non-object keybindings with defaults', () => {
    const result = sanitizeConfig({ keybindings: 'bad' })
    expect(result.keybindings).toBeDefined()
    expect(result.keybindings['ctrl+b']).toBe('sidebar:toggle')
  })

  it('merges user keybindings with defaults when actions dont conflict', () => {
    const result = sanitizeConfig({ keybindings: { 'ctrl+c': 'test:action' } })
    expect(result.keybindings['ctrl+c']).toBe('test:action')
    expect(result.keybindings['ctrl+b']).toBe('sidebar:toggle')
  })

  it('populates missing profiles with defaults', () => {
    const result = sanitizeConfig({})
    expect(result.profiles).toBeDefined()
    expect(Array.isArray(result.profiles)).toBe(true)
    expect(result.profiles.length).toBeGreaterThanOrEqual(1)
  })

  it('replaces non-array profiles with defaults', () => {
    const result = sanitizeConfig({ profiles: 'not-an-array' })
    expect(Array.isArray(result.profiles)).toBe(true)
  })

  it('replaces empty profiles array with defaults', () => {
    const result = sanitizeConfig({ profiles: [] })
    expect(result.profiles.length).toBeGreaterThanOrEqual(1)
  })

  it('sanitizes profile entries with missing fields', () => {
    const result = sanitizeConfig({
      profiles: [{ id: 'test', name: 'Test' }],
    })
    const profile = result.profiles[0]
    expect(profile.id).toBe('test')
    expect(profile.name).toBe('Test')
    expect(profile.shell).toBeDefined()
    expect(Array.isArray(profile.args)).toBe(true)
    expect(profile.cwd).toBe('~')
  })

  it('deduplicates profiles by id', () => {
    const result = sanitizeConfig({
      profiles: [
        { id: 'dup', name: 'First' },
        { id: 'dup', name: 'Second' },
      ],
    })
    expect(result.profiles.length).toBe(1)
  })

  it('handles profiles with env objects', () => {
    const result = sanitizeConfig({
      profiles: [{ id: 'env-test', name: 'Env', shell: '/bin/zsh', env: { FOO: 'bar' } }],
    })
    expect(result.profiles[0].env).toEqual({ FOO: 'bar' })
  })

  it('generates profile ids for profiles without them', () => {
    const result = sanitizeConfig({
      profiles: [{ name: 'NoID' }],
    })
    expect(result.profiles[0].id).toMatch(/^profile-\d+$/)
  })

  it('falls back to defaults when all profiles are deduplicated to zero', () => {
    const result = sanitizeConfig({
      profiles: [
        { id: 'dup', name: 'A' },
        { id: 'dup', name: 'B' },
      ],
    })
    expect(result.profiles.length).toBe(1)
    expect(result.profiles[0].id).toBe('dup')
  })
})
