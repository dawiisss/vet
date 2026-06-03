export class Terminal {
  element: HTMLElement | null = null
  options: Record<string, unknown> = {}

  constructor(options?: Record<string, unknown>) {
    this.options = options || {}
  }

  open = jest.fn((container: HTMLElement) => {
    this.element = container
  })
  dispose = jest.fn()
  write = jest.fn((_data: string, _callback?: () => void) => {
    if (_callback) _callback()
  })
  clear = jest.fn()
  focus = jest.fn()
  resize = jest.fn()
  scrollToLine = jest.fn()
  reset = jest.fn()
  loadAddon = jest.fn()
  onData = jest.fn()
  onResize = jest.fn()
  onScroll = jest.fn()
  getSelection = jest.fn(() => '')
  options = {}
}
