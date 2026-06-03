/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { setupMockedApis, workspaceApi, resetMockedApis, configApi } from '../__tests__/rendererHelpers'
import { ConfigProvider } from '../renderer/src/ConfigContext'
import FilePreviewModal from '../renderer/src/components/FilePreviewModal'

setupMockedApis()

jest.mock('../renderer/src/ConfigContext', () => ({
  ...jest.requireActual('../renderer/src/ConfigContext'),
  useConfig: () => ({
    config: {
      shell: '/bin/bash',
      fontFamily: 'monospace',
      fontSize: 14,
      theme: 'catppuccin-mocha',
    },
    updateConfig: jest.fn(),
    openConfig: jest.fn(),
  }),
}))

describe('FilePreviewModal', () => {
  const onClose = jest.fn()

  beforeEach(() => {
    resetMockedApis()
    onClose.mockClear()
    workspaceApi.readFileHead.mockResolvedValue('line1\nline2\nline3')
  })

  it('renders file path in header', async () => {
    render(<FilePreviewModal filePath="/home/user/script.sh" onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByText('/home/user/script.sh')).toBeInTheDocument()
    })
  })

  it('calls readFileHead with file path', () => {
    render(<FilePreviewModal filePath="/test/file.txt" onClose={onClose} />)
    expect(workspaceApi.readFileHead).toHaveBeenCalledWith('/test/file.txt')
  })

  it('displays file content', async () => {
    render(<FilePreviewModal filePath="/test/file.txt" onClose={onClose} />)

    await waitFor(() => {
      const content = screen.getByText((content) => content.includes('line1'))
      expect(content).toBeInTheDocument()
    })
  })

  it('closes on close button click', async () => {
    render(<FilePreviewModal filePath="/test/file.txt" onClose={onClose} />)

    await waitFor(() => {
      screen.getByText('/test/file.txt')
    })

    const closeBtn = screen.getByText('×')
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalled()
  })

  it('closes on overlay click', async () => {
    const { container } = render(
      <FilePreviewModal filePath="/test/file.txt" onClose={onClose} />
    )

    await waitFor(() => {
      screen.getByText('/test/file.txt')
    })

    const overlay = container.firstChild as HTMLElement
    fireEvent.click(overlay)
    expect(onClose).toHaveBeenCalled()
  })
})
