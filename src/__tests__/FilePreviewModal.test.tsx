/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { setupMockedApis, workspaceApi, resetMockedApis } from '../__tests__/rendererHelpers'
import FilePreviewModal from '../renderer/src/features/workspace/components/FilePreviewModal'

setupMockedApis()

jest.mock('../renderer/src/features/settings/useConfigStore', () => ({
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
    await act(async () => {
      render(<FilePreviewModal filePath="/home/user/script.sh" onClose={onClose} />)
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(screen.getByText('/home/user/script.sh')).toBeInTheDocument()
    })
  })

  it('calls readFileHead with file path', async () => {
    await act(async () => {
      render(<FilePreviewModal filePath="/test/file.txt" onClose={onClose} />)
      await Promise.resolve()
    })
    expect(workspaceApi.readFileHead).toHaveBeenCalledWith('/test/file.txt')
  })

  it('displays file content', async () => {
    await act(async () => {
      render(<FilePreviewModal filePath="/test/file.txt" onClose={onClose} />)
      await Promise.resolve()
    })

    await waitFor(() => {
      const content = screen.getByText((content) => content.includes('line1'))
      expect(content).toBeInTheDocument()
    })
  })

  it('closes on close button click', async () => {
    await act(async () => {
      render(<FilePreviewModal filePath="/test/file.txt" onClose={onClose} />)
      await Promise.resolve()
    })

    await waitFor(() => {
      screen.getByText('/test/file.txt')
    })

    const closeBtn = screen.getByText('×')
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalled()
  })

  it('closes on overlay click', async () => {
    let container: any;
    await act(async () => {
      const res = render(
        <FilePreviewModal filePath="/test/file.txt" onClose={onClose} />
      )
      container = res.container;
      await Promise.resolve()
    })

    await waitFor(() => {
      screen.getByText('/test/file.txt')
    })

    const overlay = container.firstChild as HTMLElement
    fireEvent.click(overlay)
    expect(onClose).toHaveBeenCalled()
  })

  it('displays error message when file reading fails', async () => {
    workspaceApi.readFileHead.mockRejectedValue(new Error('Permission denied'));

    await act(async () => {
      render(<FilePreviewModal filePath="/test/error.txt" onClose={onClose} />)
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(screen.getByText(/Failed to read file: Error: Permission denied/)).toBeInTheDocument()
    })
  })

  it('closes on Escape key press', async () => {
    await act(async () => {
      render(<FilePreviewModal filePath="/test/file.txt" onClose={onClose} />)
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(screen.getByText(/line1/)).toBeInTheDocument()
    })

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
