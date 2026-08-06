import { contextBridge, ipcRenderer, webFrame } from "electron";

const invoke = <T>(channel: string) => (...args: unknown[]): Promise<T> =>
  ipcRenderer.invoke(channel, ...args);

// Minimal browser-only surface for guest pages: adblocker rule lookup only.
// Deliberately NOT exposing terminal/workspace/config/sftp/updater APIs.
const adblockerApi = {
  getHtmlReplaceRules: (url: string) =>
    invoke<unknown>("adblocker:get-html-replace-rules")(url),
};

contextBridge.exposeInMainWorld("adblockerApi", adblockerApi);

// Bridge mouse events from the webview's main world to the host renderer
// so tab drag-and-drop works over browser panes.
window.addEventListener("message", (e) => {
  try {
    if (e.data && e.data.__vetMouse) {
      ipcRenderer.sendToHost("vet-mouse", e.data.__vetMouse, e.data);
    }
  } catch { /* intentional ignore */ }
});

// Inject XHR/fetch interceptor into main world before any page scripts execute.
// webFrame.executeJavaScript runs synchronously in the main world; this preload
// runs before HTML parsing, so the interceptor is in place before inline <script> tags.
webFrame.executeJavaScript(`
(function() {
  if (window.__adblockHtmlInstalled) return
  window.__adblockHtmlInstalled = true

  var ruleCache = new Map()
  var RULE_CACHE_MAX = 500
  var pruneKeys = ['adPlacements', 'adSlots']

  // Intercept YouTube window globals the moment inline scripts set them
  ;['ytInitialPlayerResponse','ytInitialData','ytcfg'].forEach(function(name) {
    try {
      var v = window[name]
      var d = Object.getOwnPropertyDescriptor(window, name)
      if (d && d.set) return
      var _v = v
      Object.defineProperty(window, name, {
        get: function(){return _v},
        set: function(val){
          try { if (val && typeof val === 'object') pruneKeysDeep(val, pruneKeys) } catch(_){}
          _v = val
        },
        configurable:true, enumerable:true
      })
    } catch(_){}
  })

  // Immediate scan in case already set
  try { if (window.ytInitialPlayerResponse) pruneKeysDeep(window.ytInitialPlayerResponse, pruneKeys) } catch(_){}
  try { if (window.ytInitialData) pruneKeysDeep(window.ytInitialData, pruneKeys) } catch(_){}
  try { if (window.ytcfg) pruneKeysDeep(window.ytcfg, pruneKeys) } catch(_){}

  // Re-scan at DOMContentLoaded (server-rendered data is set by then)
  window.addEventListener('DOMContentLoaded', function() {
    try { if (window.ytInitialPlayerResponse) pruneKeysDeep(window.ytInitialPlayerResponse, pruneKeys) } catch(_){}
    try { if (window.ytInitialData) pruneKeysDeep(window.ytInitialData, pruneKeys) } catch(_){}
    try { if (window.ytcfg) pruneKeysDeep(window.ytcfg, pruneKeys) } catch(_){}
    try {
      if (window.ytInitialData && window.ytInitialData.contents &&
          window.ytInitialData.contents.twoColumnWatchNextResults) {
        pruneKeysDeep(window.ytInitialData.contents.twoColumnWatchNextResults, pruneKeys)
      }
    } catch(_){}
  }, { once: true })

  function cacheGet(key) {
    if (!ruleCache.has(key)) return
    var val = ruleCache.get(key)
    ruleCache.delete(key)
    ruleCache.set(key, val)
    return val
  }

  function cacheSet(key, value) {
    if (ruleCache.size >= RULE_CACHE_MAX) {
      var firstKey = ruleCache.keys().next().value
      ruleCache.delete(firstKey)
    }
    ruleCache.delete(key)
    ruleCache.set(key, value)
  }

  function getRules(url) {
    var c = cacheGet(url)
    if (c !== undefined) return Promise.resolve(c)
    if (!window.adblockerApi || !window.adblockerApi.getHtmlReplaceRules) return Promise.resolve({ pruneKeys: [], replaceRules: [] })
    return window.adblockerApi.getHtmlReplaceRules(url).then(function(r) {
      r = r || { pruneKeys: [], replaceRules: [] }
      cacheSet(url, r)
      return r
    }).catch(function(){ return { pruneKeys: [], replaceRules: [] } })
  }

  function pruneJsonKeys(text, keys) {
    if (!keys || !keys.length) return text
    try { var o = JSON.parse(text); pruneKeysDeep(o, keys); return JSON.stringify(o) } catch(_){ return text }
  }

  function pruneKeysDeep(obj, keys) {
    if (!obj || typeof obj !== 'object') return
    for (var i = 0; i < keys.length; i++) {
      if (keys[i] in obj) { obj[keys[i]] = [] }
    }
    if (Array.isArray(obj)) {
      for (var j = 0; j < obj.length; j++) pruneKeysDeep(obj[j], keys)
    } else {
      for (var k in obj) { if (obj.hasOwnProperty(k)) pruneKeysDeep(obj[k], keys) }
    }
  }

  function applyRules(text, rules) {
    if (!rules || !rules.length) return text
    for (var i = 0; i < rules.length; i++) {
      try { text = text.replace(new RegExp(rules[i].regex, rules[i].flags), rules[i].replacement) } catch(_){}
    }
    return text
  }

  function isTextType(ct) {
    if (!ct) return true
    ct = ct.split(';')[0].trim().toLowerCase()
    return ct === 'text/html' || ct === 'application/json' ||
           ct === 'text/plain' || ct === 'application/javascript' ||
           ct === 'text/javascript' || ct === 'application/x-javascript'
  }

  function shouldIntercept(url) { return /^https?:\\/\\//i.test(url) }

  // Intercept fetch
  try {
    var origFetch = window.fetch
    window.fetch = function(input, init) {
      var url = ''
      try { if (typeof input === 'string') url = input; else if (input && input.url) url = input.url } catch(_){}
      if (!url || !shouldIntercept(url)) return origFetch.apply(this, arguments)
      var rp = getRules(url)
      return origFetch.apply(this, arguments).then(function(resp) {
        return rp.then(function(result) {
          var pk = result.pruneKeys || [], rr = result.replaceRules || []
          if (!pk.length && !rr.length) return resp
          if (!isTextType(resp.headers.get('content-type'))) return resp
          try {
            return resp.text().then(function(text) {
              if (pk.length) text = pruneJsonKeys(text, pk)
              if (rr.length) text = applyRules(text, rr)
              return new Response(text, { status: resp.status, statusText: resp.statusText, headers: resp.headers })
            }).catch(function(){ return resp })
          } catch(_){ return resp }
        })
      }).catch(function(){ return origFetch.apply(window, [input, init]) })
    }
  } catch(_){}

  // Intercept XMLHttpRequest
  try {
    var OrigXHR = XMLHttpRequest
    var origOpen = OrigXHR.prototype.open
    var origSend = OrigXHR.prototype.send
    OrigXHR.prototype.open = function(method, url) {
      try { this._abUrl = (typeof url === 'string') ? url : String(url) } catch(_){ this._abUrl = '' }
      this._abRules = null
      try { return origOpen.apply(this, arguments) } catch(_){}
    }
    OrigXHR.prototype.send = function() {
      var x = this, u = x._abUrl
      if (u && shouldIntercept(u)) getRules(u).then(function(r){ x._abRules = r })
      try { return origSend.apply(this, arguments) } catch(_){}
    }
    try {
      var desc = Object.getOwnPropertyDescriptor(OrigXHR.prototype, 'responseText')
      if (desc && desc.get) {
        var origGet = desc.get
        Object.defineProperty(OrigXHR.prototype, 'responseText', {
          get: function() {
            try {
              var t = origGet.call(this), r = this._abRules
              if (r && (r.pruneKeys || r.replaceRules)) {
                if (this._abMod === undefined) {
                  var m = t
                  if (r.pruneKeys && r.pruneKeys.length) m = pruneJsonKeys(m, r.pruneKeys)
                  if (r.replaceRules && r.replaceRules.length) m = applyRules(m, r.replaceRules)
                  this._abMod = m
                }
                return this._abMod
              }
              return t
            } catch(_){ return '' }
          },
          configurable: true
        })
      }
    } catch(_){}
  } catch(_){}

  // Forward mouse events to host so tab drag-and-drop works over this webview.
  // The webview's native window captures OS-level mouse events — they never reach
  // the renderer's document. Events dispatched on window fire on the isolated
  // world's proxy, which forwards them via sendToHost.
  document.addEventListener('mousemove', function(e) {
    try { window.dispatchEvent(new CustomEvent('__vet_mouse', { detail: { type: 'move', x: e.clientX, y: e.clientY } })) } catch(_){}
  }, { capture: true, passive: true })
  document.addEventListener('mouseup', function(e) {
    try { window.dispatchEvent(new CustomEvent('__vet_mouse', { detail: { type: 'up', x: e.clientX, y: e.clientY, button: e.button } })) } catch(_){}
  }, { capture: true })
})()
`);

// Bridge mouse events from the webview's main world to the host renderer
// so tab drag-and-drop works over browser panes.
window.addEventListener("__vet_mouse", (e: Event) => {
  try {
    const customEvent = e as CustomEvent;
    if (customEvent.detail) {
      ipcRenderer.sendToHost("vet-mouse", customEvent.detail);
    }
  } catch { /* intentional ignore */ }
});
