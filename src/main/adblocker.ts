import { ElectronBlocker, fromElectronDetails, fullLists, adsAndTrackingLists } from '@ghostery/adblocker-electron'
import { session, ipcMain, BrowserWindow, app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import { parse } from 'tldts-experimental'
import { getConfig } from './config'

let blocker: ElectronBlocker | null = null
const blockedCounts = new Map<string, number>()
const lastHostname = new Map<string, string>()
let isAdblockEnabled = true

const BLOCKER_CONFIG = {
  enableHtmlFiltering: true,
  guessRequestTypeFromUrl: true
}

// Extended filter lists: fullLists from Ghostery CDN + official sources
const EXTENDED_LISTS = [
  ...fullLists,
  // Fanboy's Annoyance (social, cookie notices, newsletter popups)
  'https://secure.fanboy.co.nz/fanboy-annoyance.txt',
  // AdGuard Base — broader cosmetic coverage than EasyList alone
  'https://filters.adtidy.org/extension/ublock/filters/2.txt',
  // AdGuard Tracking Protection
  'https://filters.adtidy.org/extension/ublock/filters/3.txt',
  // AdGuard Social Media
  'https://filters.adtidy.org/extension/ublock/filters/4.txt',
  // uBlock Origin Annoyances (live from uAssets)
  'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/annoyances.txt',
]

function patchScriptletsForYouTube(b: ElectronBlocker) {
  const origInject = b.onInjectCosmeticFilters.bind(b)
  b.onInjectCosmeticFilters = async (event, url, msg) => {
    try {
      const hostname = new URL(url).hostname
      if (hostname.endsWith('youtube.com') || hostname.endsWith('youtu.be')) {
        const p = parse(url)
        const host = p.hostname || ''
        const domain = p.domain || ''
        const isFirstRun = msg === undefined
        const { active, styles } = b.getCosmeticsFilters({
          domain, hostname: host, url,
          classes: msg?.classes,
          hrefs: msg?.hrefs,
          ids: msg?.ids,
          getBaseRules: isFirstRun,
          getInjectionRules: isFirstRun,
          getExtendedRules: false,
          getRulesFromHostname: isFirstRun,
        })
        if (active === false) return
        if (styles.length > 0) {
          event.sender.insertCSS(styles, { cssOrigin: 'user' })
        }
        // Skip scripts for YouTube — they break video playback
        return
      }
    } catch {}
    console.log('[adblocker] cosmetic filter for', url)
    return origInject(event, url, msg)
  }
}

/**
 * Register IPC handlers and event listeners that don't depend on the engine.
 * Call this early so BrowserView can get the preload path before the engine loads.
 */
export function registerAdblockerIpcHandlers() {
  // Listen for new WebContents creation to reset adblocker count when navigating
  app.on('web-contents-created', (_, wc) => {
    if (wc.getType() === 'webview') {
      wc.on('did-start-navigation', (details) => {
        if (details.isMainFrame) {
          const wcId = String(wc.id)
          let newHost = ''
          try { newHost = new URL(details.url).hostname } catch {}
          const oldHost = lastHostname.get(wcId) || ''
          if (newHost && newHost !== oldHost) {
            lastHostname.set(wcId, newHost)
            blockedCounts.set(wcId, 0)

            const windows = BrowserWindow.getAllWindows()
            for (const win of windows) {
              if (!win.isDestroyed()) {
                win.webContents.send('adblocker:blocked-event', {
                  webContentsId: wc.id,
                  url: details.url,
                  count: 0
                })
              }
            }
          }
        }
      })
    }
  })

  ipcMain.handle('adblocker:toggle', (_, enabled: boolean) => {
    isAdblockEnabled = enabled
    if (enabled) {
      enableAdblocker()
    } else {
      disableAdblocker()
    }
    return isAdblockEnabled
  })

  ipcMain.handle('adblocker:get-stats', (_, webContentsId: number) => {
    return blockedCounts.get(String(webContentsId)) || 0
  })

  ipcMain.handle('adblocker:clear-stats', (_, webContentsId: number) => {
    blockedCounts.delete(String(webContentsId))
    return 0
  })

  ipcMain.handle('adblocker:get-app-preload-path', () => {
    return `file://${join(__dirname, '../preload/index.js')}`
  })

  ipcMain.handle('adblocker:get-html-replace-rules', (_, url: string) => {
    if (!blocker) return []
    try {
      const request = fromElectronDetails({
        id: 0,
        url,
        resourceType: 'xhr',
        referrer: url,
        webContentsId: 0
      } as any)
      const htmlFilters = blocker.getHtmlFilters(request)
      const pruneKeys: string[] = []
      const replaceRules: Array<{ regex: string; flags: string; replacement: string }> = []
      for (const filter of htmlFilters) {
        if (Array.isArray(filter) && filter[0] === 'replace') {
          const [regex, replacement] = filter[1] as [RegExp, string]
          const src = regex.source
          const keyMatch = src.match(/^"(\w+)"$/)
          if (keyMatch) {
            pruneKeys.push(keyMatch[1])
          } else {
            replaceRules.push({
              regex: src,
              flags: regex.flags.includes('g') ? regex.flags : regex.flags + 'g',
              replacement
            })
          }
        }
      }
      if (pruneKeys.length > 0) {
        console.log('[adblocker] HTML prune keys for', url, ':', pruneKeys.join(', '))
      }
      return { pruneKeys, replaceRules }
    } catch (e) {
      console.error('[adblocker] Error getting html replace rules:', e)
      return { pruneKeys: [], replaceRules: [] }
    }
  })
}

/**
 * Loads the adblocker engine (from cache or network) and enables blocking.
 * Call this after IPC handlers are registered; it can run in the background.
 */
export async function initAdblocker(userDataPath: string) {
  isAdblockEnabled = getConfig().browserAdblockEnabled !== false
  const cachePath = join(userDataPath, 'adblocker_v4.bin')

  try {
    const buffer = await fs.readFile(cachePath)
    blocker = ElectronBlocker.deserialize(buffer)
    blocker.config.enableHtmlFiltering = true
    blocker.config.guessRequestTypeFromUrl = true
    patchScriptletsForYouTube(blocker)
    console.log('[adblocker] Loaded uBlock Origin and EasyList filters from local cache')
  } catch (e) {
    console.log('[adblocker] Local cache missing. Fetching uBlock Origin and EasyList filters...')
    try {
      blocker = await ElectronBlocker.fromLists(fetch, EXTENDED_LISTS, BLOCKER_CONFIG)
      patchScriptletsForYouTube(blocker)
      const buffer = blocker.serialize()
      await fs.writeFile(cachePath, buffer)
      console.log('[adblocker] Adblocking lists successfully loaded and cached')
    } catch (err) {
      console.error('[adblocker] Failed to fetch lists, loading prebuilt fallback:', err)
      try {
        blocker = await ElectronBlocker.fromLists(fetch, adsAndTrackingLists, BLOCKER_CONFIG)
        patchScriptletsForYouTube(blocker)
      } catch (fallbackErr) {
        console.error('[adblocker] Fallback loading failed:', fallbackErr)
      }
    }
  }

  if (blocker && isAdblockEnabled) {
    enableAdblocker()
  }
}

async function enableAdblocker() {
  if (!blocker) return
  
  try {
    // Enable adblocking only on the partitioned session for web browser tabs.
    // This avoids redundant registration on the defaultSession and duplicate IPC handler conflicts.
    blocker.enableBlockingInSession(session.fromPartition('persist:browser'))
    console.log('[adblocker] Enabled adblocking in browser partition')
  } catch (e) {
    console.error('[adblocker] Error enabling in persist:browser:', e)
  }

  // Track blocked requests
  blocker.on('request-blocked', (request: any) => {
    const wcId = request.tabId || request.webContentsId
    if (wcId) {
      const current = blockedCounts.get(String(wcId)) || 0
      const nextCount = current + 1
      blockedCounts.set(String(wcId), nextCount)

      // Notify the active window of the blocked request
      const windows = BrowserWindow.getAllWindows()
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send('adblocker:blocked-event', {
            webContentsId: wcId,
            url: request.url,
            count: nextCount
          })
        }
      }
    }
  })
}

async function disableAdblocker() {
  if (!blocker) return
  try {
    blocker.disableBlockingInSession(session.fromPartition('persist:browser'))
  } catch (e) {
    console.warn('[adblocker] Error disabling in persist:browser:', e)
  }
}

