let mockOnData: ((data: string) => void) | null = null
let mockOnExit: ((arg: { exitCode: number }) => void) | null = null

function createMockPty() {
  return {
    write: jest.fn(),
    resize: jest.fn(),
    kill: jest.fn(),
    onData: jest.fn((cb: (data: string) => void) => { mockOnData = cb }),
    onExit: jest.fn((cb: (arg: { exitCode: number }) => void) => { mockOnExit = cb }),
    pid: Math.floor(Math.random() * 10000),
    process: '/bin/bash',
  }
}

export function spawn(
  _shell: string,
  _args: string[],
  _options: Record<string, unknown>
) {
  return createMockPty()
}

export const __testExports = {
  createMockPty,
  getOnData: () => mockOnData,
  getOnExit: () => mockOnExit,
  reset: () => {
    mockOnData = null
    mockOnExit = null
  }
}
