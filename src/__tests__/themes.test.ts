import { builtinThemes } from '../renderer/src/themes'

const REQUIRED_COLORS = [
  'background', 'foreground', 'cursor', 'selection',
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
