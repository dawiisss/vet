import { ipcMain, shell } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'

export function initWorkspaceManager() {
  ipcMain.handle('workspace:getScripts', async (_, cwd?: string) => {
    try {
      // Find package.json in cwd or its parents up to 3 levels
      let currentDir = cwd || process.cwd()
      for (let i = 0; i < 3; i++) {
        const pkgPath = path.join(currentDir, 'package.json')
        try {
          const content = await fs.readFile(pkgPath, 'utf-8')
          const pkg = JSON.parse(content)
          if (pkg && pkg.scripts) {
            return { cwd: currentDir, scripts: pkg.scripts }
          }
        } catch (err) {
          // not found or not parsable, go up
          const parentDir = path.dirname(currentDir)
          if (parentDir === currentDir) break
          currentDir = parentDir
        }
      }
      return null
    } catch (err) {
      console.error('Failed to get workspace scripts', err)
      return null
    }
  })

  ipcMain.handle('workspace:list-dir', async (_, dirPath: string) => {
    try {
      let targetPath = dirPath
      if (targetPath.startsWith('~') && process.env.HOME) {
        targetPath = targetPath.replace(/^~/, process.env.HOME)
      }
      
      const files = await fs.readdir(targetPath)
      const items: any[] = []
      
      for (const file of files) {
        // Skip reading stats for heavy files to avoid PTY/Main blocks
        if (file === '.git' || file === 'node_modules') {
          items.push({
            name: file,
            isDirectory: true,
            size: 0,
            ext: ''
          })
          continue
        }
        
        try {
          const fullPath = path.join(targetPath, file)
          const stat = await fs.stat(fullPath)
          items.push({
            name: file,
            isDirectory: stat.isDirectory(),
            size: stat.size,
            ext: path.extname(file).toLowerCase()
          })
        } catch {
          // Ignore files that fail stat (e.g. broken symlinks)
        }
      }
      
      // Sort: folders first, then alphabetically
      items.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })
      
      return items
    } catch (err) {
      console.error(`Failed to list directory: ${dirPath}`, err)
      return []
    }
  })

  ipcMain.handle('workspace:reveal-path', async (_, itemPath: string) => {
    try {
      let targetPath = itemPath
      if (targetPath.startsWith('~') && process.env.HOME) {
        targetPath = targetPath.replace(/^~/, process.env.HOME)
      }
      shell.showItemInFolder(targetPath)
    } catch (err) {
      console.error(`Failed to reveal path: ${itemPath}`, err)
    }
  })

  ipcMain.handle('workspace:read-file-head', async (_, filePath: string) => {
    try {
      let targetPath = filePath
      if (targetPath.startsWith('~') && process.env.HOME) {
        targetPath = targetPath.replace(/^~/, process.env.HOME)
      }
      
      // Read first 50KB only to prevent main process memory bloat
      const fileHandle = await fs.open(targetPath, 'r')
      try {
        const buffer = Buffer.alloc(50 * 1024)
        const { bytesRead } = await fileHandle.read(buffer, 0, buffer.length, 0)
        return buffer.toString('utf8', 0, bytesRead)
      } finally {
        await fileHandle.close()
      }
    } catch (err: any) {
      console.error(`Failed to read file head: ${filePath}`, err)
      return `Error: Failed to read file. ${err.message}`
    }
  })
}
