/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import ScriptRunnerPanel from '../renderer/src/shared/components/ScriptRunnerPanel'
import { setupMockedApis, resetMockedApis, workspaceApi } from './rendererHelpers'

setupMockedApis()

// Mock Element.prototype.scrollIntoView to prevent errors during testing
Element.prototype.scrollIntoView = jest.fn()

describe('ScriptRunnerPanel', () => {
  const onRunScript = jest.fn()

  beforeEach(() => {
    resetMockedApis()
    onRunScript.mockClear()
    jest.clearAllMocks()
  })

  it('does not fetch scripts if inactive', async () => {
    render(<ScriptRunnerPanel isActive={false} onRunScript={onRunScript} />)
    expect(workspaceApi.getScripts).not.toHaveBeenCalled()
  })

  it('shows no scripts message when api returns null', async () => {
    let resolvePromise: any;
    workspaceApi.getScripts.mockReturnValue(new Promise(resolve => { resolvePromise = resolve; }));

    render(<ScriptRunnerPanel isActive={true} onRunScript={onRunScript} />)

    await act(async () => {
      resolvePromise(null);
    });

    expect(screen.getByText('No scripts found')).toBeInTheDocument()
  })

  it('renders scripts when api returns data', async () => {
    let resolvePromise: any;
    workspaceApi.getScripts.mockReturnValue(new Promise(resolve => { resolvePromise = resolve; }));

    render(<ScriptRunnerPanel isActive={true} onRunScript={onRunScript} />)

    await act(async () => {
      resolvePromise({ scripts: { start: 'node index.js', test: 'jest' }, cwd: '/app/project' });
    });

    expect(screen.getByText('Workspace: /app/project')).toBeInTheDocument()
    expect(screen.getByText('start')).toBeInTheDocument()
    expect(screen.getByText('test')).toBeInTheDocument()
  })

  it('runs script on click', async () => {
    let resolvePromise: any;
    workspaceApi.getScripts.mockReturnValue(new Promise(resolve => { resolvePromise = resolve; }));

    render(<ScriptRunnerPanel isActive={true} onRunScript={onRunScript} />)

    await act(async () => {
      resolvePromise({ scripts: { start: 'node index.js', test: 'jest' }, cwd: '/app/project' });
    });

    const startBtn = screen.getByText('start').closest('button')
    fireEvent.click(startBtn!)

    expect(onRunScript).toHaveBeenCalledWith('npm run start', '/app/project')
  })

  it('navigates with keyboard and runs script on enter', async () => {
    let resolvePromise: any;
    workspaceApi.getScripts.mockReturnValue(new Promise(resolve => { resolvePromise = resolve; }));

    render(<ScriptRunnerPanel isActive={true} onRunScript={onRunScript} />)

    await act(async () => {
      resolvePromise({ scripts: { start: 'node index.js', test: 'jest', build: 'tsc' }, cwd: '/app/project' });
    });

    const container = screen.getByText('Project Scripts').parentElement!

    // Test ArrowDown
    fireEvent.keyDown(container, { key: 'ArrowDown' })
    fireEvent.keyDown(container, { key: 'ArrowDown' })

    // Test ArrowUp
    fireEvent.keyDown(container, { key: 'ArrowUp' })

    // Test Enter on 'test'
    fireEvent.keyDown(container, { key: 'Enter' })

    expect(onRunScript).toHaveBeenCalledWith('npm run test', '/app/project')
  })

  it('updates selection on mouse enter', async () => {
    let resolvePromise: any;
    workspaceApi.getScripts.mockReturnValue(new Promise(resolve => { resolvePromise = resolve; }));

    render(<ScriptRunnerPanel isActive={true} onRunScript={onRunScript} />)

    await act(async () => {
      resolvePromise({ scripts: { start: 'node index.js', test: 'jest' }, cwd: '/app/project' });
    });

    const testBtn = screen.getByText('test').closest('button')

    fireEvent.mouseEnter(testBtn!)

    const container = screen.getByText('Project Scripts').parentElement!
    fireEvent.keyDown(container, { key: 'Enter' })

    expect(onRunScript).toHaveBeenCalledWith('npm run test', '/app/project')
  })
})
