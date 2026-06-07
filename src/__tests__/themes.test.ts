import { builtinThemes, resolveTheme } from '../renderer/src/themes'

const REQUIRED_COLORS = [
  'background', 'foreground', 'cursor', 'cursorAccent', 'selection',
  'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
  'brightBlack', 'brightRed', 'brightGreen', 'brightYellow',
  'brightBlue', 'brightMagenta', 'brightCyan', 'brightWhite',
]

describe('themes', () => {
  describe.each(Object.keys(builtinThemes))('%s', (themeName) => {
    let theme: Record<string, string>

    beforeAll(() => {
      theme = builtinThemes[themeName]
    })

    it('has all required color keys', () => {
      for (const key of REQUIRED_COLORS) {
        expect(theme).toHaveProperty(key)
        expect(typeof theme[key]).toBe('string')
      }
    })

    it('all colors are valid hex strings', () => {
      for (const key of REQUIRED_COLORS) {
        expect(theme[key]).toMatch(/^#[0-9a-fA-F]{6}$/)
      }
    })

    it('has exactly the expected number of keys', () => {
      expect(Object.keys(theme)).toHaveLength(REQUIRED_COLORS.length)
    })
  })

  it('contains at least 4 built-in themes', () => {
    expect(Object.keys(builtinThemes).length).toBeGreaterThanOrEqual(4)
  })

  it('includes catppuccin-mocha', () => {
    expect(builtinThemes).toHaveProperty('catppuccin-mocha')
  })

  it('includes nord', () => {
    expect(builtinThemes).toHaveProperty('nord')
  })

  it('includes dracula', () => {
    expect(builtinThemes).toHaveProperty('dracula')
  })

  it('includes onedark', () => {
    expect(builtinThemes).toHaveProperty('onedark')
  })

  it('all themes have cursor color', () => {
    for (const theme of Object.values(builtinThemes)) {
      expect(theme.cursor).toBeTruthy()
    }
  })

  it('all themes have selection color', () => {
    for (const theme of Object.values(builtinThemes)) {
      expect(theme.selection).toBeTruthy()
    }
  })
})

describe('resolveTheme', () => {
  const defaultTheme = builtinThemes['catppuccin-mocha']

  it('returns builtin theme by string key', () => {
    expect(resolveTheme('dracula')).toEqual(builtinThemes['dracula'])
  })

  it('returns custom theme by string key', () => {
    const custom = { ...defaultTheme, background: '#000000' }
    expect(resolveTheme('my-custom', { 'my-custom': custom })).toEqual(custom)
  })

  it('builtin theme takes precedence over custom with the same name', () => {
    const customNord = { ...defaultTheme, background: '#111111' }
    expect(resolveTheme('nord', { nord: customNord })).toEqual(builtinThemes['nord'])
  })

  it('returns the theme object directly when passed an object', () => {
    const obj = { ...defaultTheme, foreground: '#ffffff' }
    expect(resolveTheme(obj)).toEqual(obj)
  })

  it('returns default theme when string is unknown (no customThemes)', () => {
    expect(resolveTheme('nonexistent')).toEqual(defaultTheme)
  })

  it('returns default theme when string is unknown (with customThemes)', () => {
    expect(resolveTheme('nonexistent', { 'other': defaultTheme })).toEqual(defaultTheme)
  })

  it('returns the passed object as-is when theme is an object (even if empty)', () => {
    const empty = {} as ThemeConfig
    expect(resolveTheme(empty)).toBe(empty)
  })

  it('returns custom theme over builtin when customThemes is provided with nullish fallback', () => {
    const custom = { ...defaultTheme, background: '#abcdef' }
    expect(resolveTheme('test-custom', { 'test-custom': custom })).toEqual(custom)
  })
})
