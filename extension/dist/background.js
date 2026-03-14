var Ge = Object.defineProperty;
var Ke = (a, o, e) => o in a ? Ge(a, o, { enumerable: !0, configurable: !0, writable: !0, value: e }) : a[o] = e;
var _ = (a, o, e) => Ke(a, typeof o != "symbol" ? o + "" : o, e);
const E = {
  GET_WINDOWS_AND_TABS: "get_windows_and_tabs",
  NAVIGATE: "chrome_navigate",
  SCREENSHOT: "chrome_screenshot",
  CLOSE_TABS: "chrome_close_tabs",
  SWITCH_TAB: "chrome_switch_tab",
  WEB_FETCHER: "chrome_get_web_content",
  CLICK: "chrome_click_element",
  FILL: "chrome_fill_or_select",
  GET_INTERACTIVE_ELEMENTS: "chrome_get_interactive_elements",
  NETWORK_CAPTURE: "chrome_network_capture",
  NETWORK_CAPTURE_START: "chrome_network_capture_start",
  NETWORK_CAPTURE_STOP: "chrome_network_capture_stop",
  NETWORK_REQUEST: "chrome_network_request",
  NETWORK_DEBUGGER_START: "chrome_network_debugger_start",
  NETWORK_DEBUGGER_STOP: "chrome_network_debugger_stop",
  KEYBOARD: "chrome_keyboard",
  HISTORY: "chrome_history",
  BOOKMARK_SEARCH: "chrome_bookmark_search",
  BOOKMARK_ADD: "chrome_bookmark_add",
  BOOKMARK_DELETE: "chrome_bookmark_delete",
  JAVASCRIPT: "chrome_javascript",
  CONSOLE: "chrome_console",
  FILE_UPLOAD: "chrome_upload_file",
  READ_PAGE: "chrome_read_page",
  HANDLE_DIALOG: "chrome_handle_dialog",
  HANDLE_DOWNLOAD: "chrome_handle_download",
  INJECT_SCRIPT: "chrome_inject_script",
  SEND_COMMAND_TO_INJECT_SCRIPT: "chrome_send_command_to_inject_script"
}, m = (a = "Unknown error, please try again") => ({
  content: [
    {
      type: "text",
      text: a
    }
  ],
  isError: !0
}), Me = {
  DEFAULT_WAIT: 1e3,
  KEYBOARD_DELAY: 50
}, Ve = {
  MAX_NETWORK_REQUESTS: 100
}, q = {
  NATIVE_CONNECTION_FAILED: "Failed to connect to native host",
  NATIVE_DISCONNECTED: "Native connection disconnected",
  SERVER_STATUS_LOAD_FAILED: "Failed to load server status",
  SERVER_STATUS_SAVE_FAILED: "Failed to save server status",
  TOOL_EXECUTION_FAILED: "Tool execution failed",
  INVALID_PARAMETERS: "Invalid parameters provided",
  PERMISSION_DENIED: "Permission denied",
  TAB_NOT_FOUND: "Tab not found",
  ELEMENT_NOT_FOUND: "Element not found",
  NETWORK_ERROR: "Network error occurred"
}, W = {
  EXCLUDED_DOMAINS: [
    "google-analytics.com",
    "googletagmanager.com",
    "analytics.google.com",
    "doubleclick.net",
    "googlesyndication.com",
    "googleads.g.doubleclick.net",
    "stats.g.doubleclick.net",
    "adservice.google.com",
    "pagead2.googlesyndication.com",
    "amazon-adsystem.com",
    "bat.bing.com",
    "clarity.ms",
    "connect.facebook.net",
    "facebook.com/tr",
    "analytics.twitter.com",
    "ads-twitter.com",
    "ads.yahoo.com",
    "adroll.com",
    "adnxs.com",
    "criteo.com",
    "quantserve.com",
    "scorecardresearch.com",
    "segment.io",
    "amplitude.com",
    "mixpanel.com",
    "optimizely.com",
    "static.hotjar.com",
    "script.hotjar.com",
    "crazyegg.com",
    "clicktale.net",
    "mouseflow.com",
    "fullstory.com",
    "linkedin.com/px"
  ],
  STATIC_RESOURCE_EXTENSIONS: [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".svg",
    ".webp",
    ".ico",
    ".bmp",
    ".cur",
    ".css",
    ".scss",
    ".less",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".map",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".otf",
    ".mp3",
    ".mp4",
    ".avi",
    ".mov",
    ".wmv",
    ".flv",
    ".webm",
    ".ogg",
    ".wav",
    ".pdf",
    ".zip",
    ".rar",
    ".7z",
    ".iso",
    ".dmg",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx"
  ],
  STATIC_MIME_TYPES_TO_FILTER: [
    "image/",
    "font/",
    "audio/",
    "video/",
    "text/css",
    "text/javascript",
    "application/javascript",
    "application/x-javascript",
    "application/pdf",
    "application/zip",
    "application/octet-stream"
  ],
  API_MIME_TYPES: [
    "application/json",
    "application/xml",
    "text/xml",
    "text/plain",
    "text/event-stream",
    "application/x-www-form-urlencoded",
    "application/graphql",
    "application/grpc",
    "application/protobuf",
    "application/x-protobuf",
    "application/x-json",
    "application/ld+json",
    "application/problem+json",
    "application/problem+xml",
    "application/soap+xml",
    "application/vnd.api+json"
  ],
  STATIC_RESOURCE_TYPES: ["stylesheet", "image", "font", "media", "other"]
};
var X = /* @__PURE__ */ ((a) => (a.ISOLATED = "ISOLATED", a.MAIN = "MAIN", a))(X || {});
const Ye = 300;
class D {
  async injectContentScript(o, e, t = !1, n = "ISOLATED", r = !1, s) {
    console.log(`Injecting ${e.join(", ")} into tab ${o}`);
    try {
      const i = s == null ? void 0 : s[0], c = await Promise.race([
        typeof i == "number" ? chrome.tabs.sendMessage(
          o,
          { action: `${this.name}_ping` },
          { frameId: i }
        ) : chrome.tabs.sendMessage(o, { action: `${this.name}_ping` }),
        new Promise(
          (u, l) => setTimeout(
            () => l(new Error(`${this.name} Ping action to tab ${o} timed out`)),
            Ye
          )
        )
      ]);
      if (c && c.status === "pong") {
        console.log(
          `pong received for action '${this.name}' in tab ${o}. Assuming script is active.`
        );
        return;
      } else
        console.warn(`Unexpected ping response in tab ${o}:`, c);
    } catch (i) {
      console.error(
        `ping content script failed: ${i instanceof Error ? i.message : String(i)}`
      );
    }
    try {
      const i = { tabId: o };
      s && s.length > 0 ? i.frameIds = s : r && (i.allFrames = !0), await chrome.scripting.executeScript({
        target: i,
        files: e,
        injectImmediately: t,
        world: n
      }), console.log(`'${e.join(", ")}' injection successful for tab ${o}`);
    } catch (i) {
      const c = i instanceof Error ? i.message : String(i);
      throw console.error(
        `Content script '${e.join(", ")}' injection failed for tab ${o}: ${c}`
      ), new Error(
        `${q.TOOL_EXECUTION_FAILED}: Failed to inject content script in tab ${o}: ${c}`
      );
    }
  }
  async sendMessageToTab(o, e, t) {
    try {
      const n = typeof t == "number" ? await chrome.tabs.sendMessage(o, e, { frameId: t }) : await chrome.tabs.sendMessage(o, e);
      if (n && n.error)
        throw new Error(String(n.error));
      return n;
    } catch (n) {
      const r = n instanceof Error ? n.message : String(n);
      throw console.error(
        `Error sending message to tab ${o} for action ${(e == null ? void 0 : e.action) || "unknown"}: ${r}`
      ), n instanceof Error ? n : new Error(r);
    }
  }
  async tryGetTab(o) {
    if (typeof o != "number") return null;
    try {
      return await chrome.tabs.get(o);
    } catch {
      return null;
    }
  }
  async getActiveTabOrThrow() {
    const [o] = await chrome.tabs.query({ active: !0, currentWindow: !0 });
    if (!o || !o.id) throw new Error("Active tab not found");
    return o;
  }
  async ensureFocus(o, e = {}) {
    const t = e.activate === !0;
    e.focusWindow === !0 && typeof o.windowId == "number" && await chrome.windows.update(o.windowId, { focused: !0 }), t && typeof o.id == "number" && await chrome.tabs.update(o.id, { active: !0 });
  }
  async getActiveTabInWindow(o) {
    if (typeof o == "number") {
      const t = await chrome.tabs.query({ active: !0, windowId: o });
      return t && t[0] ? t[0] : null;
    }
    const e = await chrome.tabs.query({ active: !0, currentWindow: !0 });
    return e && e[0] ? e[0] : null;
  }
  async getActiveTabOrThrowInWindow(o) {
    const e = await this.getActiveTabInWindow(o);
    if (!e || !e.id) throw new Error("Active tab not found");
    return e;
  }
}
class ze extends D {
  constructor() {
    super(...arguments);
    _(this, "name", E.GET_WINDOWS_AND_TABS);
  }
  async execute() {
    try {
      const e = await chrome.windows.getAll({ populate: !0 });
      let t = 0;
      const n = e.map((s) => {
        var c;
        const i = ((c = s.tabs) == null ? void 0 : c.map((u) => (t++, {
          tabId: u.id || 0,
          url: u.url || "",
          title: u.title || "",
          active: u.active || !1
        }))) || [];
        return {
          windowId: s.id || 0,
          tabs: i
        };
      }), r = {
        windowCount: e.length,
        tabCount: t,
        windows: n
      };
      return {
        content: [{ type: "text", text: JSON.stringify(r) }],
        isError: !1
      };
    } catch (e) {
      return console.error("Error in WindowTool.execute:", e), m(
        `Error getting windows and tabs information: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }
}
const Je = new ze(), he = 1280, ge = 720;
class Xe extends D {
  constructor() {
    super(...arguments);
    _(this, "name", E.NAVIGATE);
  }
  async execute(e) {
    const {
      newWindow: t = !1,
      width: n,
      height: r,
      url: s,
      refresh: i = !1,
      tabId: c,
      background: u,
      windowId: l
    } = e;
    console.log(
      `Attempting to ${i ? "refresh current tab" : `open URL: ${s}`} with options:`,
      e
    );
    try {
      if (i) {
        const y = await this.tryGetTab(c) || await this.getActiveTabOrThrowInWindow(l);
        if (!y.id) return m("No target tab found to refresh");
        await chrome.tabs.reload(y.id);
        const S = await chrome.tabs.get(y.id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: !0,
                message: "Successfully refreshed current tab",
                tabId: S.id,
                windowId: S.windowId,
                url: S.url
              })
            }
          ],
          isError: !1
        };
      }
      if (!s)
        return m("URL parameter is required when refresh is not true");
      if (s === "back" || s === "forward") {
        const y = await this.tryGetTab(c) || await this.getActiveTabOrThrowInWindow(l);
        if (!y.id)
          return m("No target tab found for history navigation");
        await this.ensureFocus(y, {
          activate: u !== !0,
          focusWindow: u !== !0
        }), s === "forward" ? await chrome.tabs.goForward(y.id) : await chrome.tabs.goBack(y.id);
        const S = await chrome.tabs.get(y.id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: !0,
                message: `Successfully navigated ${s} in browser history`,
                tabId: S.id,
                windowId: S.windowId,
                url: S.url
              })
            }
          ],
          isError: !1
        };
      }
      const p = ((w) => {
        const y = /* @__PURE__ */ new Set();
        try {
          if (w.includes("*"))
            y.add(w);
          else {
            const S = new URL(w), C = "/*", I = S.host.replace(/^www\./, ""), x = I.startsWith("www.") ? I : `www.${I}`;
            y.add(`${S.protocol}//${S.host}${C}`), y.add(`${S.protocol}//${I}${C}`), y.add(`${S.protocol}//${x}${C}`);
            const R = S.protocol === "https:" ? "http:" : "https:";
            y.add(`${R}//${S.host}${C}`), y.add(`${R}//${I}${C}`), y.add(`${R}//${x}${C}`);
          }
        } catch {
          y.add(w.endsWith("/") ? `${w}*` : `${w}/*`);
        }
        return Array.from(y);
      })(s), f = await chrome.tabs.query({ url: p }), b = (w, y) => {
        let S;
        try {
          S = new URL(w);
        } catch {
          return y[0];
        }
        const C = (k) => {
          if (!k) return "/";
          const L = k.startsWith("/") ? k : `/${k}`;
          return L !== "/" && L.endsWith("/") ? L.slice(0, -1) : L;
        }, I = (k) => k.replace(/^www\./, "").toLowerCase(), x = C(S.pathname), R = S.search || "", v = I(S.host);
        let N = { score: -1 };
        for (const k of y) {
          let L;
          try {
            L = new URL(k.url || "");
          } catch {
            continue;
          }
          if (I(L.host) !== v) continue;
          const ie = C(L.pathname), je = L.search || "";
          let Y = -1;
          const me = ie === x;
          if (me && (!R || je === R) ? Y = 3 : me && !R && (Y = 2), Y > N.score && (N = { tab: k, score: Y }, Y === 3))
            break;
        }
        return N.tab;
      }, T = await this.tryGetTab(c), g = T || b(s, f);
      if ((g == null ? void 0 : g.id) !== void 0) {
        T && typeof T.id == "number" && await chrome.tabs.update(T.id, { url: s }), await this.ensureFocus(g, {
          activate: u !== !0,
          focusWindow: u !== !0
        });
        const w = await chrome.tabs.get(g.id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: !0,
                message: "Activated existing tab",
                tabId: w.id,
                windowId: w.windowId,
                url: w.url
              })
            }
          ],
          isError: !1
        };
      }
      if (t || typeof n == "number" || typeof r == "number") {
        const w = await chrome.windows.create({
          url: s,
          width: typeof n == "number" ? n : he,
          height: typeof r == "number" ? r : ge,
          focused: u !== !0
        });
        if (w && w.id !== void 0)
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: !0,
                  message: "Opened URL in new window",
                  windowId: w.id,
                  tabs: w.tabs ? w.tabs.map((y) => ({ tabId: y.id, url: y.url })) : []
                })
              }
            ],
            isError: !1
          };
      } else {
        let w = null;
        if (typeof l == "number" && (w = await chrome.windows.get(l, { populate: !1 })), w || (w = await chrome.windows.getLastFocused({ populate: !1 })), w && w.id !== void 0) {
          const y = await chrome.tabs.create({
            url: s,
            windowId: w.id,
            active: u !== !0
          });
          return u !== !0 && await chrome.windows.update(w.id, { focused: !0 }), {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: !0,
                  message: "Opened URL in new tab in existing window",
                  tabId: y.id,
                  windowId: w.id,
                  url: y.url
                })
              }
            ],
            isError: !1
          };
        } else {
          const y = await chrome.windows.create({
            url: s,
            width: he,
            height: ge,
            focused: !0
          });
          if (y && y.id !== void 0)
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    success: !0,
                    message: "Opened URL in new window",
                    windowId: y.id,
                    tabs: y.tabs ? y.tabs.map((S) => ({ tabId: S.id, url: S.url })) : []
                  })
                }
              ],
              isError: !1
            };
        }
      }
      return m("Failed to open URL: Unknown error occurred");
    } catch (d) {
      return chrome.runtime.lastError ? m(`Chrome API Error: ${chrome.runtime.lastError.message}`) : m(
        `Error navigating to URL: ${d instanceof Error ? d.message : String(d)}`
      );
    }
  }
}
const Qe = new Xe();
class Ze extends D {
  constructor() {
    super(...arguments);
    _(this, "name", E.CLOSE_TABS);
  }
  async execute(e) {
    const { tabIds: t, url: n } = e;
    let r = n;
    try {
      if (r) {
        try {
          if (!r.includes("*"))
            try {
              const u = new URL(r), l = u.pathname || "/", d = l.endsWith("/") ? `${l}*` : `${l}/*`;
              r = `${u.protocol}//${u.host}${d}`;
            } catch {
              r = r.endsWith("/") ? `${r}*` : `${r}/*`;
            }
        } catch {
          r = r.endsWith("*") ? r : r.endsWith("/") ? `${r}*` : `${r}/*`;
        }
        const i = await chrome.tabs.query({ url: r });
        if (!i || i.length === 0)
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: !1,
                  message: `No tabs found with URL pattern: ${r}`,
                  closedCount: 0
                })
              }
            ],
            isError: !1
          };
        const c = i.map((u) => u.id).filter((u) => u !== void 0);
        return c.length === 0 ? m("Found tabs but could not get their IDs") : (await chrome.tabs.remove(c), {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: !0,
                message: `Closed ${c.length} tabs with URL: ${n}`,
                closedCount: c.length,
                closedTabIds: c
              })
            }
          ],
          isError: !1
        });
      }
      if (t && t.length > 0) {
        const c = (await Promise.all(
          t.map(async (u) => {
            try {
              return await chrome.tabs.get(u);
            } catch {
              return null;
            }
          })
        )).filter((u) => u !== null).map((u) => u.id).filter((u) => u !== void 0);
        return c.length === 0 ? {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: !1,
                message: "None of the provided tab IDs exist",
                closedCount: 0
              })
            }
          ],
          isError: !1
        } : (await chrome.tabs.remove(c), {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: !0,
                message: `Closed ${c.length} tabs`,
                closedCount: c.length,
                closedTabIds: c,
                invalidTabIds: t.filter((u) => !c.includes(u))
              })
            }
          ],
          isError: !1
        });
      }
      const [s] = await chrome.tabs.query({ active: !0, currentWindow: !0 });
      return !s || !s.id ? m("No active tab found") : (await chrome.tabs.remove(s.id), {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: !0,
              message: "Closed active tab",
              closedCount: 1,
              closedTabIds: [s.id]
            })
          }
        ],
        isError: !1
      });
    } catch (s) {
      return m(
        `Error closing tabs: ${s instanceof Error ? s.message : String(s)}`
      );
    }
  }
}
const et = new Ze();
class tt extends D {
  constructor() {
    super(...arguments);
    _(this, "name", E.SWITCH_TAB);
  }
  async execute(e) {
    const { tabId: t, windowId: n } = e;
    try {
      n !== void 0 && await chrome.windows.update(n, { focused: !0 }), await chrome.tabs.update(t, { active: !0 });
      const r = await chrome.tabs.get(t);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: !0,
              message: `Successfully switched to tab ID: ${t}`,
              tabId: r.id,
              windowId: r.windowId,
              url: r.url
            })
          }
        ],
        isError: !1
      };
    } catch (r) {
      return chrome.runtime.lastError ? m(`Chrome API Error: ${chrome.runtime.lastError.message}`) : m(
        `Error switching tab: ${r instanceof Error ? r.message : String(r)}`
      );
    }
  }
}
const rt = new tt(), O = {
  SCREENSHOT_PREPARE_PAGE_FOR_CAPTURE: "preparePageForCapture",
  SCREENSHOT_GET_PAGE_DETAILS: "getPageDetails",
  SCREENSHOT_GET_ELEMENT_DETAILS: "getElementDetails",
  SCREENSHOT_SCROLL_PAGE: "scrollPage",
  SCREENSHOT_RESET_PAGE_AFTER_CAPTURE: "resetPageAfterCapture",
  WEB_FETCHER_GET_HTML_CONTENT: "getHtmlContent",
  WEB_FETCHER_GET_TEXT_CONTENT: "getTextContent",
  CLICK_ELEMENT: "clickElement",
  FILL_ELEMENT: "fillElement",
  SIMULATE_KEYBOARD: "simulateKeyboard",
  GET_INTERACTIVE_ELEMENTS: "getInteractiveElements",
  GENERATE_ACCESSIBILITY_TREE: "generateAccessibilityTree",
  RESOLVE_REF: "resolveRef",
  ENSURE_REF_FOR_SELECTOR: "ensureRefForSelector",
  VERIFY_FINGERPRINT: "verifyFingerprint",
  DISPATCH_HOVER_FOR_REF: "dispatchHoverForRef",
  NETWORK_SEND_REQUEST: "sendPureNetworkRequest",
  WAIT_FOR_TEXT: "waitForText"
};
class nt extends D {
  constructor() {
    super(...arguments);
    _(this, "name", E.KEYBOARD);
  }
  async execute(e) {
    const { keys: t, selector: n, selectorType: r = "css", delay: s = Me.KEYBOARD_DELAY } = e;
    if (!t)
      return m(
        q.INVALID_PARAMETERS + ": Keys parameter must be provided"
      );
    try {
      const c = await this.tryGetTab(e.tabId) || await this.getActiveTabOrThrowInWindow(e.windowId);
      if (!c.id)
        return m(q.TAB_NOT_FOUND + ": Active tab has no ID");
      let u = n, l;
      if (await this.injectContentScript(c.id, ["inject-scripts/accessibility-tree-helper.js"]), n && r === "xpath")
        try {
          const f = await this.sendMessageToTab(c.id, {
            action: O.ENSURE_REF_FOR_SELECTOR,
            selector: n,
            isXPath: !0
          });
          if (!f || !f.success || !f.ref)
            return m(
              `Failed to resolve XPath selector: ${(f == null ? void 0 : f.error) || "unknown error"}`
            );
          l = f.ref;
          const b = await this.sendMessageToTab(c.id, {
            action: O.RESOLVE_REF,
            ref: f.ref
          });
          b && b.success && b.selector && (u = b.selector, l = void 0);
        } catch (f) {
          return m(
            `Error resolving XPath: ${f instanceof Error ? f.message : String(f)}`
          );
        }
      if (l) {
        const f = await this.sendMessageToTab(c.id, {
          action: "focusByRef",
          ref: l
        });
        if (f && !f.success)
          return m(
            `Failed to focus element by ref: ${f.error || "unknown error"}`
          );
        u = void 0;
      }
      const d = typeof e.frameId == "number" ? [e.frameId] : void 0;
      await this.injectContentScript(
        c.id,
        ["inject-scripts/keyboard-helper.js"],
        !1,
        "ISOLATED",
        !1,
        d
      );
      const p = await this.sendMessageToTab(
        c.id,
        {
          action: O.SIMULATE_KEYBOARD,
          keys: t,
          selector: u,
          delay: s
        },
        e.frameId
      );
      return p.error ? m(p.error) : {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: !0,
              message: p.message || "Keyboard operation successful",
              targetElement: p.targetElement,
              results: p.results
            })
          }
        ],
        isError: !1
      };
    } catch (i) {
      return m(
        `Error simulating keyboard events: ${i instanceof Error ? i.message : String(i)}`
      );
    }
  }
}
const st = new nt(), ot = 1440 * 60 * 1e3;
function ye(a) {
  if (!a) return null;
  const o = /* @__PURE__ */ new Date(), e = a.toLowerCase().trim();
  if (e === "now") return o.getTime();
  if (e === "today") return new Date(o.getFullYear(), o.getMonth(), o.getDate()).getTime();
  if (e === "yesterday")
    return new Date(o.getFullYear(), o.getMonth(), o.getDate() - 1).getTime();
  const t = e.match(
    /^(\d+)\s+(day|days|week|weeks|month|months|year|years)\s+ago$/
  );
  if (t) {
    const r = parseInt(t[1], 10), s = t[2], i = new Date(o);
    if (s.startsWith("day")) i.setDate(i.getDate() - r);
    else if (s.startsWith("week")) i.setDate(i.getDate() - r * 7);
    else if (s.startsWith("month")) i.setMonth(i.getMonth() - r);
    else if (s.startsWith("year")) i.setFullYear(i.getFullYear() - r);
    else return null;
    return i.getTime();
  }
  const n = new Date(a);
  return isNaN(n.getTime()) ? null : n.getTime();
}
function we(a) {
  const o = new Date(a), e = (t) => String(t).padStart(2, "0");
  return `${o.getFullYear()}-${e(o.getMonth() + 1)}-${e(o.getDate())} ${e(o.getHours())}:${e(o.getMinutes())}:${e(o.getSeconds())}`;
}
class it extends D {
  constructor() {
    super(...arguments);
    _(this, "name", E.HISTORY);
  }
  async execute(e) {
    try {
      const { text: t = "", maxResults: n = 100, excludeCurrentTabs: r = !1 } = e, s = Date.now();
      let i, c;
      if (e.startTime) {
        const p = ye(e.startTime);
        if (p === null)
          return m(
            `Invalid format for start time: "${e.startTime}". Supported formats: ISO (YYYY-MM-DD), "today", "yesterday", "X days/weeks/months/years ago".`
          );
        i = p;
      } else
        i = s - ot;
      if (e.endTime) {
        const p = ye(e.endTime);
        if (p === null)
          return m(
            `Invalid format for end time: "${e.endTime}". Supported formats: ISO (YYYY-MM-DD), "today", "yesterday", "X days/weeks/months/years ago".`
          );
        c = p;
      } else
        c = s;
      if (i > c)
        return m("Start time cannot be after end time.");
      const u = await chrome.history.search({
        text: t,
        startTime: i,
        endTime: c,
        maxResults: n
      });
      let l = u;
      if (r && u.length > 0) {
        const p = await chrome.tabs.query({}), f = /* @__PURE__ */ new Set();
        p.forEach((b) => {
          b.url && f.add(b.url);
        }), f.size > 0 && (l = u.filter((b) => !(b.url && f.has(b.url))));
      }
      const d = {
        items: l.map((p) => ({
          id: p.id,
          url: p.url,
          title: p.title,
          lastVisitTime: p.lastVisitTime,
          visitCount: p.visitCount,
          typedCount: p.typedCount
        })),
        totalCount: l.length,
        timeRange: {
          startTime: i,
          endTime: c,
          startTimeFormatted: we(i),
          endTimeFormatted: we(c)
        }
      };
      return t && (d.query = t), {
        content: [{ type: "text", text: JSON.stringify(d, null, 2) }],
        isError: !1
      };
    } catch (t) {
      return m(
        `Error retrieving browsing history: ${t instanceof Error ? t.message : String(t)}`
      );
    }
  }
}
const at = new it();
async function fe(a) {
  const o = [];
  try {
    const e = await chrome.bookmarks.get(a);
    if (e.length > 0 && e[0]) {
      let t = e[0].parentId;
      for (; t; ) {
        const n = await chrome.bookmarks.get(t);
        if (n.length === 0) break;
        const r = n[0];
        if (r.title && o.unshift(r.title), !r.parentId) break;
        t = r.parentId;
      }
    }
  } catch (e) {
    return console.error(`Error getting bookmark path for node ID ${a}:`, e), o.join(" > ") || "Error getting path";
  }
  return o.join(" > ");
}
async function Pe(a) {
  try {
    const r = await chrome.bookmarks.get(a);
    if (r && r.length > 0 && !r[0].url) return r[0];
  } catch {
  }
  const o = a.split("/").map((r) => r.trim()).filter((r) => r.length > 0);
  if (o.length === 0) return null;
  let t = await chrome.bookmarks.getChildren("0"), n = null;
  for (let r = 0; r < o.length; r++) {
    const s = o[r];
    n = null;
    let i = null;
    for (const c of t)
      if (!c.url && c.title.toLowerCase() === s.toLowerCase()) {
        i = c;
        break;
      }
    if (i)
      r === o.length - 1 ? n = i : t = await chrome.bookmarks.getChildren(i.id);
    else
      return null;
  }
  return n;
}
async function ct(a, o) {
  const e = a.split("/").map((r) => r.trim()).filter((r) => r.length > 0);
  if (e.length === 0) throw new Error("Folder path cannot be empty");
  let t = "";
  if (!t) {
    const s = (await chrome.bookmarks.getChildren("0")).find(
      (i) => !i.url && (i.title === "Bookmarks bar" || i.title === "Bookmarks Bar")
    );
    t = (s == null ? void 0 : s.id) || "1";
  }
  let n = null;
  for (const r of e) {
    const i = (await chrome.bookmarks.getChildren(t)).find(
      (c) => !c.url && c.title.toLowerCase() === r.toLowerCase()
    );
    i ? (n = i, t = i.id) : (n = await chrome.bookmarks.create({
      parentId: t,
      title: r
    }), t = n.id);
  }
  if (!n) throw new Error("Failed to create folder path");
  return n;
}
function be(a) {
  const o = [], e = [...a];
  for (; e.length > 0; ) {
    const t = e.pop();
    if (t && (t.url && o.push(t), t.children))
      for (let n = t.children.length - 1; n >= 0; n--)
        e.push(t.children[n]);
  }
  return o;
}
async function ut(a, o) {
  const e = await chrome.bookmarks.search({ url: a });
  if (!o) return e;
  const t = o.toLowerCase();
  return e.filter(
    (n) => n.title && n.title.toLowerCase().includes(t)
  );
}
class lt extends D {
  constructor() {
    super(...arguments);
    _(this, "name", E.BOOKMARK_SEARCH);
  }
  async execute(e) {
    const { query: t = "", maxResults: n = 50, folderPath: r } = e;
    try {
      let s = [], i = null;
      if (r) {
        if (i = await Pe(r), !i)
          return m(`Specified folder not found: "${r}"`);
        const d = await chrome.bookmarks.getSubTree(i.id);
        s = d.length > 0 ? be(d[0].children || []) : [];
      }
      let c;
      if (t)
        if (i) {
          const d = t.toLowerCase();
          c = s.filter(
            (p) => p.title && p.title.toLowerCase().includes(d) || p.url && p.url.toLowerCase().includes(d)
          );
        } else
          c = await chrome.bookmarks.search({ query: t }), c = c.filter((d) => !!d.url);
      else {
        if (!i) {
          const d = await chrome.bookmarks.getTree();
          s = be(d);
        }
        c = s;
      }
      const u = c.slice(0, n), l = await Promise.all(
        u.map(async (d) => {
          const p = await fe(d.id);
          return {
            id: d.id,
            title: d.title,
            url: d.url,
            dateAdded: d.dateAdded,
            folderPath: p
          };
        })
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: !0,
              totalResults: l.length,
              query: t || null,
              folderSearched: i ? i.title || i.id : "All bookmarks",
              bookmarks: l
            }, null, 2)
          }
        ],
        isError: !1
      };
    } catch (s) {
      return m(
        `Error searching bookmarks: ${s instanceof Error ? s.message : String(s)}`
      );
    }
  }
}
class dt extends D {
  constructor() {
    super(...arguments);
    _(this, "name", E.BOOKMARK_ADD);
  }
  async execute(e) {
    const { url: t, title: n, parentId: r, createFolder: s = !1 } = e;
    try {
      let i = t, c = n;
      if (!i) {
        const p = await chrome.tabs.query({ active: !0, currentWindow: !0 });
        if (!p[0] || !p[0].url)
          return m("No active tab with valid URL found, and no URL provided");
        i = p[0].url, c || (c = p[0].title || i);
      }
      if (!i) return m("URL is required to create bookmark");
      let u;
      if (r) {
        let p = await Pe(r);
        if (!p && s)
          try {
            p = await ct(r);
          } catch (f) {
            return m(
              `Failed to create folder path: ${f instanceof Error ? f.message : String(f)}`
            );
          }
        if (p)
          u = p.id;
        else
          try {
            const f = await chrome.bookmarks.get(r);
            if (f && f.length > 0 && !f[0].url)
              u = f[0].id;
            else
              return m(
                `Specified parent folder (ID/path: "${r}") not found or is not a folder${s ? ", and creation failed" : ". You can set createFolder=true to auto-create folders"}`
              );
          } catch {
            return m(
              `Specified parent folder (ID/path: "${r}") not found or invalid${s ? ", and creation failed" : ". You can set createFolder=true to auto-create folders"}`
            );
          }
      } else {
        const f = (await chrome.bookmarks.getChildren("0")).find(
          (b) => !b.url && (b.title === "Bookmarks bar" || b.title === "Bookmarks Bar")
        );
        u = (f == null ? void 0 : f.id) || "1";
      }
      const l = await chrome.bookmarks.create({
        parentId: u,
        title: c || i,
        url: i
      }), d = await fe(l.id);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: !0,
              message: "Bookmark added successfully",
              bookmark: {
                id: l.id,
                title: l.title,
                url: l.url,
                dateAdded: l.dateAdded,
                folderPath: d
              },
              folderCreated: s && r ? "Folder created if necessary" : !1
            }, null, 2)
          }
        ],
        isError: !1
      };
    } catch (i) {
      const c = i instanceof Error ? i.message : String(i);
      return c.includes("Can't bookmark URLs of type") ? m(
        `Error adding bookmark: Cannot bookmark this type of URL (e.g., chrome:// system pages). ${c}`
      ) : m(`Error adding bookmark: ${c}`);
    }
  }
}
class pt extends D {
  constructor() {
    super(...arguments);
    _(this, "name", E.BOOKMARK_DELETE);
  }
  async execute(e) {
    const { bookmarkId: t, url: n, title: r } = e;
    if (!t && !n)
      return m("Must provide bookmark ID or URL to delete bookmark");
    try {
      let s = [];
      if (t)
        try {
          const l = await chrome.bookmarks.get(t);
          if (l && l.length > 0 && l[0].url)
            s = l;
          else
            return m(
              `Bookmark with ID "${t}" not found, or the ID does not correspond to a bookmark`
            );
        } catch {
          return m(`Invalid bookmark ID: "${t}"`);
        }
      else if (n && (s = await ut(n, r), s.length === 0))
        return m(
          `No bookmark found with URL "${n}"${r ? ` (title contains: "${r}")` : ""}`
        );
      const i = [], c = [];
      for (const l of s)
        try {
          const d = await fe(l.id);
          await chrome.bookmarks.remove(l.id), i.push({
            id: l.id,
            title: l.title,
            url: l.url,
            folderPath: d
          });
        } catch (d) {
          c.push(
            `Failed to delete bookmark "${l.title}" (ID: ${l.id}): ${d instanceof Error ? d.message : String(d)}`
          );
        }
      if (i.length === 0)
        return m(`Failed to delete bookmarks: ${c.join("; ")}`);
      const u = {
        success: !0,
        message: `Successfully deleted ${i.length} bookmark(s)`,
        deletedBookmarks: i
      };
      return c.length > 0 && (u.partialSuccess = !0, u.errors = c), {
        content: [{ type: "text", text: JSON.stringify(u, null, 2) }],
        isError: !1
      };
    } catch (s) {
      return m(
        `Error deleting bookmark: ${s instanceof Error ? s.message : String(s)}`
      );
    }
  }
}
const ft = new lt(), mt = new dt(), ht = new pt(), gt = "1.3";
class yt {
  constructor() {
    _(this, "sessions", /* @__PURE__ */ new Map());
  }
  getState(o) {
    return this.sessions.get(o);
  }
  setState(o, e) {
    this.sessions.set(o, e);
  }
  async attach(o, e = "unknown") {
    const t = this.getState(o);
    if (t && t.attachedByUs) {
      t.refCount += 1, t.owners.add(e);
      return;
    }
    const r = (await chrome.debugger.getTargets()).find((s) => s.tabId === o && s.attached);
    if (r) {
      if (r.extensionId === chrome.runtime.id) {
        this.setState(o, {
          refCount: t ? t.refCount + 1 : 1,
          owners: /* @__PURE__ */ new Set([...(t == null ? void 0 : t.owners) || [], e]),
          attachedByUs: !0
        });
        return;
      }
      throw new Error(
        `Debugger is already attached to tab ${o} by another client (e.g., DevTools/extension)`
      );
    }
    await chrome.debugger.attach({ tabId: o }, gt), this.setState(o, { refCount: 1, owners: /* @__PURE__ */ new Set([e]), attachedByUs: !0 });
  }
  async detach(o, e = "unknown") {
    const t = this.getState(o);
    if (t && (t.owners.has(e) && t.owners.delete(e), t.refCount = Math.max(0, t.refCount - 1), !(t.refCount > 0)))
      try {
        t.attachedByUs && await chrome.debugger.detach({ tabId: o });
      } catch {
      } finally {
        this.sessions.delete(o);
      }
  }
  async withSession(o, e, t) {
    await this.attach(o, e);
    try {
      return await t();
    } finally {
      await this.detach(o, e);
    }
  }
  async sendCommand(o, e, t) {
    const n = this.getState(o);
    return n && n.attachedByUs ? await chrome.debugger.sendCommand({ tabId: o }, e, t) : await this.withSession(o, `send:${e}`, async () => await chrome.debugger.sendCommand({ tabId: o }, e, t));
  }
}
const A = new yt(), wt = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  cdpSessionManager: A
}, Symbol.toStringTag, { value: "Module" }));
class bt extends D {
  constructor() {
    super(...arguments);
    _(this, "name", E.HANDLE_DIALOG);
  }
  async execute(e) {
    const { action: t, promptText: n } = e || {};
    if (!t || t !== "accept" && t !== "dismiss")
      return m('action must be "accept" or "dismiss"');
    try {
      const [r] = await chrome.tabs.query({ active: !0, currentWindow: !0 });
      if (!(r != null && r.id)) return m("No active tab found");
      const s = r.id;
      return await A.withSession(s, "dialog", async () => {
        await A.sendCommand(s, "Page.enable"), await A.sendCommand(s, "Page.handleJavaScriptDialog", {
          accept: t === "accept",
          promptText: t === "accept" ? n : void 0
        });
      }), {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: !0, action: t, promptText: n || null })
          }
        ],
        isError: !1
      };
    } catch (r) {
      return m(
        `Failed to handle dialog: ${r instanceof Error ? r.message : String(r)}`
      );
    }
  }
}
const Tt = new bt();
class Et extends D {
  constructor() {
    super(...arguments);
    _(this, "name", E.HANDLE_DOWNLOAD);
  }
  async execute(e) {
    const t = String((e == null ? void 0 : e.filenameContains) || "").trim(), n = (e == null ? void 0 : e.waitForComplete) !== !1, r = Math.max(1e3, Math.min(Number((e == null ? void 0 : e.timeoutMs) ?? 6e4), 3e5));
    try {
      const s = await St({ filenameContains: t, waitForComplete: n, timeoutMs: r });
      return {
        content: [{ type: "text", text: JSON.stringify({ success: !0, download: s }) }],
        isError: !1
      };
    } catch (s) {
      return m(`Handle download failed: ${(s == null ? void 0 : s.message) || String(s)}`);
    }
  }
}
async function St(a) {
  const { filenameContains: o, waitForComplete: e, timeoutMs: t } = a;
  return new Promise((n, r) => {
    let s = null;
    const i = (f) => {
      c(), r(f instanceof Error ? f : new Error(String(f)));
    }, c = () => {
      try {
        s && clearTimeout(s);
      } catch {
      }
      try {
        chrome.downloads.onCreated.removeListener(d);
      } catch {
      }
      try {
        chrome.downloads.onChanged.removeListener(p);
      } catch {
      }
    }, u = (f) => o ? ((f.filename || "").split(/[/\\]/).pop() || "").includes(o) || (f.url || "").includes(o) : !0, l = async (f) => {
      try {
        const [b] = await chrome.downloads.search({ id: f.id }), T = b || f;
        c(), n({
          id: T.id,
          filename: T.filename,
          url: T.url,
          mime: T.mime || void 0,
          fileSize: T.fileSize ?? T.totalBytes ?? void 0,
          state: T.state,
          danger: T.danger,
          startTime: T.startTime,
          endTime: T.endTime || void 0,
          exists: T.exists
        });
      } catch {
        c(), n({ id: f.id, filename: f.filename, url: f.url, state: f.state });
      }
    }, d = (f) => {
      try {
        if (!u(f)) return;
        e || l(f);
      } catch {
      }
    }, p = (f) => {
      try {
        if (!f || typeof f.id != "number") return;
        chrome.downloads.search({ id: f.id }).then((b) => {
          const T = b && b[0];
          T && u(T) && e && T.state === "complete" && l(T);
        }).catch(() => {
        });
      } catch {
      }
    };
    chrome.downloads.onCreated.addListener(d), chrome.downloads.onChanged.addListener(p), s = setTimeout(() => i(new Error("Download wait timed out")), t), chrome.downloads.search({ state: e ? "in_progress" : void 0 }).then((f) => {
      const b = (f || []).find((T) => u(T));
      b && !e && l(b);
    }).catch(() => {
    });
  });
}
const Ct = new Et();
async function oe(a) {
  const e = await (await fetch(a)).blob();
  return await createImageBitmap(e);
}
async function xt(a, o, e) {
  const t = new OffscreenCanvas(o, e), n = t.getContext("2d");
  if (!n)
    throw new Error("Unable to get canvas context");
  n.fillStyle = "#FFFFFF", n.fillRect(0, 0, t.width, t.height);
  for (const r of a)
    try {
      const s = await oe(r.dataUrl), i = 0, c = 0, u = s.width;
      let l = s.height;
      const d = r.y;
      if (d + l > e && (l = e - d), l <= 0) continue;
      n.drawImage(s, i, c, u, l, 0, d, u, l);
    } catch (s) {
      console.error("Error stitching image part:", s, r);
    }
  return t;
}
async function _t(a, o, e = 1, t, n) {
  const r = await oe(a);
  let s = o.x, i = o.y, c = o.width, u = o.height;
  if (s < 0 && (c += s, s = 0), i < 0 && (u += i, i = 0), s + c > r.width && (c = r.width - s), i + u > r.height && (u = r.height - i), c <= 0 || u <= 0)
    throw new Error(
      "Invalid calculated crop size (<=0). Element may not be visible or fully captured."
    );
  const l = t ? t * e : c, d = n ? n * e : u, p = new OffscreenCanvas(l, d), f = p.getContext("2d");
  if (!f)
    throw new Error("Unable to get canvas context");
  return f.drawImage(r, s, i, c, u, 0, 0, l, d), p;
}
async function Te(a, o = "image/png", e) {
  const t = await a.convertToBlob({
    type: o,
    quality: o === "image/jpeg" ? e : void 0
  });
  return new Promise((n, r) => {
    const s = new FileReader();
    s.onloadend = () => n(s.result), s.onerror = r, s.readAsDataURL(t);
  });
}
async function Rt(a, o) {
  const { scale: e = 1, quality: t = 0.8, format: n = "image/jpeg" } = o, r = await oe(a), s = Math.round(r.width * e), i = Math.round(r.height * e), c = new OffscreenCanvas(s, i), u = c.getContext("2d");
  if (!u)
    throw new Error("Failed to get 2D context from OffscreenCanvas");
  u.drawImage(r, 0, 0, s, i);
  const l = await c.convertToBlob({ type: n, quality: t });
  return { dataUrl: await new Promise((p) => {
    const f = new FileReader();
    f.onloadend = () => p(f.result), f.readAsDataURL(l);
  }), mimeType: n };
}
const vt = 300 * 1e3, ee = /* @__PURE__ */ new Map(), At = {
  setContext(a, o) {
    ee.set(a, { ...o, timestamp: Date.now() });
  },
  getContext(a) {
    const o = ee.get(a);
    if (o) {
      if (Date.now() - o.timestamp > vt) {
        ee.delete(a);
        return;
      }
      return o;
    }
  },
  clear(a) {
    ee.delete(a);
  }
}, U = {
  SCROLL_DELAY_MS: 350,
  CAPTURE_STITCH_DELAY_MS: 50,
  MAX_CAPTURE_PARTS: 50,
  MAX_CAPTURE_HEIGHT_PX: 5e4,
  PIXEL_TOLERANCE: 1,
  SCRIPT_INIT_DELAY: 100
};
var Le;
const ae = (Le = chrome.tabs) == null ? void 0 : Le.MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND;
if (typeof ae == "number" && ae > 0) {
  const a = Math.ceil(1e3 / ae), o = Math.max(0, a - U.SCROLL_DELAY_MS);
  U.CAPTURE_STITCH_DELAY_MS = Math.max(
    o,
    U.CAPTURE_STITCH_DELAY_MS
  );
}
const It = [
  "totalWidth",
  "totalHeight",
  "viewportWidth",
  "viewportHeight",
  "devicePixelRatio",
  "currentScrollX",
  "currentScrollY"
];
function Dt(a) {
  if (!a || typeof a != "object")
    throw new Error(
      "Screenshot helper did not respond. The content script may not be injected or cannot run on this page."
    );
  const o = a, e = It.filter(
    (t) => typeof o[t] != "number" || !Number.isFinite(o[t])
  );
  if (e.length > 0)
    throw new Error(
      `Screenshot helper returned invalid page details (missing/invalid: ${e.join(", ")}).`
    );
  return o;
}
class kt extends D {
  constructor() {
    super(...arguments);
    _(this, "name", E.SCREENSHOT);
  }
  async execute(e) {
    var h, w, y, S;
    const {
      name: t = "screenshot",
      selector: n,
      storeBase64: r = !1,
      fullPage: s = !1,
      savePng: i = !0
    } = e;
    console.log("Starting screenshot with options:", e);
    const u = await this.tryGetTab(e.tabId) || await this.getActiveTabOrThrowInWindow(e.windowId);
    if ((h = u.url) != null && h.startsWith("chrome://") || (w = u.url) != null && w.startsWith("edge://") || (y = u.url) != null && y.startsWith("https://chrome.google.com/webstore") || (S = u.url) != null && S.startsWith("https://microsoftedge.microsoft.com/"))
      return m(
        "Cannot capture special browser pages or web store pages due to security restrictions."
      );
    let l, d, p;
    const f = { base64: null, fileSaved: !1 };
    let b = null, T = !1, g;
    try {
      if (e.background === !0 && !s && !n)
        try {
          const x = u.id, { cdpSessionManager: R } = await Promise.resolve().then(() => wt);
          await R.withSession(x, "screenshot", async () => {
            const v = await R.sendCommand(
              x,
              "Page.getLayoutMetrics",
              {}
            ), N = (v == null ? void 0 : v.layoutViewport) || (v == null ? void 0 : v.visualViewport) || {
              clientWidth: 800,
              clientHeight: 600,
              pageX: 0,
              pageY: 0
            }, k = await R.sendCommand(x, "Page.captureScreenshot", {
              format: "png"
            }), L = typeof (k == null ? void 0 : k.data) == "string" ? k.data : "";
            if (!L)
              throw new Error("CDP Page.captureScreenshot returned empty data");
            l = `data:image/png;base64,${L}`, d = Math.round(N.clientWidth || 800), p = Math.round(N.clientHeight || 600);
          });
        } catch (x) {
          console.warn("CDP viewport capture failed, falling back to helper path:", x);
        }
      if (!l) {
        await this.injectContentScript(u.id, ["inject-scripts/screenshot-helper.js"]), await new Promise((v) => setTimeout(v, U.SCRIPT_INIT_DELAY));
        const x = await this.sendMessageToTab(u.id, {
          action: O.SCREENSHOT_PREPARE_PAGE_FOR_CAPTURE,
          options: { fullPage: s }
        });
        if (!x || x.success !== !0)
          throw new Error(
            "Screenshot helper did not acknowledge page preparation. The content script may not be injected or cannot run on this page."
          );
        T = !0;
        const R = await this.sendMessageToTab(u.id, {
          action: O.SCREENSHOT_GET_PAGE_DETAILS
        });
        if (g = Dt(R), b = { x: g.currentScrollX, y: g.currentScrollY }, s)
          if (l = await this._captureFullPage(u.id, e, g), e.width && e.height)
            d = e.width, p = e.height;
          else if (e.width && !e.height) {
            d = e.width;
            const v = g.totalHeight / g.totalWidth;
            p = Math.round(e.width * v);
          } else if (!e.width && e.height) {
            p = e.height;
            const v = g.totalWidth / g.totalHeight;
            d = Math.round(e.height * v);
          } else
            d = g.totalWidth, p = g.totalHeight;
        else n ? (l = await this._captureElement(
          u.id,
          e,
          g.devicePixelRatio
        ), e.width && e.height ? (d = e.width, p = e.height) : (d = g.viewportWidth, p = g.viewportHeight)) : (l = await chrome.tabs.captureVisibleTab(u.windowId, { format: "png" }), d = g.viewportWidth, p = g.viewportHeight);
      }
      if (!l)
        throw new Error("Failed to capture image data");
      try {
        if (typeof d == "number" && typeof p == "number") {
          let x = "";
          try {
            x = u.url ? new URL(u.url).hostname : "";
          } catch {
          }
          const R = (g == null ? void 0 : g.viewportWidth) ?? d, v = (g == null ? void 0 : g.viewportHeight) ?? p;
          At.setContext(u.id, {
            screenshotWidth: d,
            screenshotHeight: p,
            viewportWidth: R,
            viewportHeight: v,
            devicePixelRatio: g == null ? void 0 : g.devicePixelRatio,
            hostname: x
          });
        }
      } catch (x) {
        console.warn("Failed to set screenshot context:", x);
      }
      if (r === !0) {
        const x = await Rt(l, {
          scale: 0.7,
          quality: 0.8,
          format: "image/jpeg"
        }), R = x.dataUrl.replace(/^data:image\/[^;]+;base64,/, "");
        return f.base64 = R, {
          content: [
            {
              type: "text",
              text: JSON.stringify({ base64Data: R, mimeType: x.mimeType })
            }
          ],
          isError: !1
        };
      }
      if (i === !0)
        try {
          const x = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-"), R = `${t.replace(/[^a-z0-9_-]/gi, "_") || "screenshot"}_${x}.png`, v = await chrome.downloads.download({
            url: l,
            filename: R,
            saveAs: !1
          });
          f.downloadId = v, f.filename = R, f.fileSaved = !0;
          try {
            await new Promise((k) => setTimeout(k, 100));
            const [N] = await chrome.downloads.search({ id: v });
            N && N.filename && (f.fullPath = N.filename);
          } catch (N) {
            console.warn("Could not get full file path:", N);
          }
        } catch (x) {
          console.error("Error saving PNG file:", x), f.saveError = String(x instanceof Error ? x.message : x);
        }
    } catch (C) {
      return console.error("Error during screenshot execution:", C), m(
        `Screenshot error: ${C instanceof Error ? C.message : JSON.stringify(C)}`
      );
    } finally {
      if (T)
        try {
          const C = {
            action: O.SCREENSHOT_RESET_PAGE_AFTER_CAPTURE
          };
          b && (C.scrollX = b.x, C.scrollY = b.y), await this.sendMessageToTab(u.id, C);
        } catch (C) {
          console.warn("Failed to reset page, tab might have closed:", C);
        }
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: !0,
            message: `Screenshot [${t}] captured successfully`,
            tabId: u.id,
            url: u.url,
            name: t,
            ...f
          })
        }
      ],
      isError: !1
    };
  }
  async _captureElement(e, t, n) {
    const r = await this.sendMessageToTab(e, {
      action: O.SCREENSHOT_GET_ELEMENT_DETAILS,
      selector: t.selector
    }), s = r.devicePixelRatio || n || 1, i = {
      x: r.rect.x * s,
      y: r.rect.y * s,
      width: r.rect.width * s,
      height: r.rect.height * s
    };
    await new Promise((l) => setTimeout(l, U.SCRIPT_INIT_DELAY));
    const c = await chrome.tabs.captureVisibleTab({ format: "png" });
    if (!c)
      throw new Error("Failed to capture visible tab for element cropping");
    const u = await _t(
      c,
      i,
      s,
      t.width,
      t.height
    );
    return Te(u);
  }
  async _captureFullPage(e, t, n) {
    const r = n.devicePixelRatio, s = t.width || n.totalWidth, i = n.totalHeight, c = t.maxHeight || U.MAX_CAPTURE_HEIGHT_PX, u = Math.min(i, c / r), l = s * r, d = u * r, p = n.viewportHeight, f = [];
    let b = 0, T = 0, g = 0;
    for (; T < d && g < U.MAX_CAPTURE_PARTS; ) {
      b > 0 && (b = (await this.sendMessageToTab(e, {
        action: O.SCREENSHOT_SCROLL_PAGE,
        x: 0,
        y: b,
        scrollDelay: U.SCROLL_DELAY_MS
      })).newScrollY), await new Promise(
        (x) => setTimeout(x, U.CAPTURE_STITCH_DELAY_MS)
      );
      const y = await chrome.tabs.captureVisibleTab({ format: "png" });
      if (!y) throw new Error("captureVisibleTab returned empty during full page capture");
      const S = b * r;
      f.push({ dataUrl: y, y: S });
      const C = await oe(y), I = Math.min(C.height, d - S);
      if (T = S + I, T >= d - U.PIXEL_TOLERANCE) break;
      b += p, b > i - p && b < i && (b = i - p), g++;
    }
    const h = await xt(f, l, d);
    let w = h;
    if (t.width && !t.height) {
      const y = t.width * r, S = h.height / h.width, C = y * S;
      w = new OffscreenCanvas(y, C);
      const I = w.getContext("2d");
      I && I.drawImage(h, 0, 0, y, C);
    } else if (t.height && !t.width) {
      const y = t.height * r, S = h.width / h.height, C = y * S;
      w = new OffscreenCanvas(C, y);
      const I = w.getContext("2d");
      I && I.drawImage(h, 0, 0, C, y);
    } else if (t.width && t.height) {
      const y = t.width * r, S = t.height * r;
      w = new OffscreenCanvas(y, S);
      const C = w.getContext("2d");
      C && C.drawImage(h, 0, 0, y, S);
    }
    return Te(w);
  }
}
const Nt = new kt();
class Ot extends D {
  constructor() {
    super(...arguments);
    _(this, "name", E.READ_PAGE);
  }
  async execute(e) {
    const { filter: t, depth: n, refId: r } = e || {}, s = typeof r == "string" ? r.trim() : "";
    if (r !== void 0 && !s)
      return m(
        `${q.INVALID_PARAMETERS}: refId must be a non-empty string`
      );
    const i = n === void 0 ? void 0 : Number(n);
    if (i !== void 0 && (!Number.isInteger(i) || i < 0))
      return m(
        `${q.INVALID_PARAMETERS}: depth must be a non-negative integer`
      );
    const c = i !== void 0 || !!s;
    try {
      const u = "If the specific element you need is missing from the returned data, use the 'screenshot' tool to capture the current viewport and confirm the element's on-screen coordinates.", d = await this.tryGetTab(e == null ? void 0 : e.tabId) || await this.getActiveTabOrThrowInWindow(e == null ? void 0 : e.windowId);
      if (!d.id)
        return m(q.TAB_NOT_FOUND + ": Active tab has no ID");
      await this.injectContentScript(
        d.id,
        ["inject-scripts/accessibility-tree-helper.js"],
        !1,
        "ISOLATED",
        !0
      );
      const p = await this.sendMessageToTab(d.id, {
        action: O.GENERATE_ACCESSIBILITY_TREE,
        filter: t || null,
        depth: i,
        refId: s || void 0
      }), f = p && p.success === !0, b = p && typeof p.pageContent == "string" ? p.pageContent : "", T = f && (p != null && p.stats) ? {
        processed: p.stats.processed ?? 0,
        included: p.stats.included ?? 0,
        durationMs: p.stats.durationMs ?? 0
      } : null, g = b ? b.split(`
`).filter((C) => C.trim().length > 0).length : 0, h = Array.isArray(p == null ? void 0 : p.refMap) ? p.refMap.length : 0, w = !c && g < 10 && h < 3, y = (C) => {
        const I = [];
        for (const x of C || []) {
          const R = typeof (x == null ? void 0 : x.type) == "string" && x.type ? x.type : "element", v = typeof (x == null ? void 0 : x.text) == "string" ? x.text.trim() : "", N = v.length > 0 ? ` "${v.replace(/\s+/g, " ").slice(0, 100).replace(/"/g, '\\"')}"` : "", k = typeof (x == null ? void 0 : x.selector) == "string" && x.selector ? ` selector="${x.selector}"` : "", L = x != null && x.coordinates && Number.isFinite(x.coordinates.x) && Number.isFinite(x.coordinates.y) ? ` (x=${Math.round(x.coordinates.x)},y=${Math.round(x.coordinates.y)})` : "";
          if (I.push(`- ${R}${N}${k}${L}`), I.length >= 150) break;
        }
        return I.join(`
`);
      }, S = {
        success: !0,
        filter: t || "all",
        pageContent: b,
        tips: u,
        viewport: f ? p.viewport : { width: null, height: null, dpr: null },
        stats: T || { processed: 0, included: 0, durationMs: 0 },
        refMapCount: h,
        sparse: f ? w : !1,
        depth: i ?? null,
        focus: s ? { refId: s, found: f } : null,
        markedElements: [],
        elements: [],
        count: 0,
        fallbackUsed: !1,
        fallbackSource: null,
        reason: null
      };
      if (f && !w)
        return {
          content: [{ type: "text", text: JSON.stringify(S) }],
          isError: !1
        };
      if (s)
        return m((p == null ? void 0 : p.error) || `refId "${s}" not found or expired`);
      if (i !== void 0)
        return m((p == null ? void 0 : p.error) || "Failed to generate accessibility tree");
      try {
        await this.injectContentScript(d.id, ["inject-scripts/interactive-elements-helper.js"]);
        const C = await this.sendMessageToTab(d.id, {
          action: O.GET_INTERACTIVE_ELEMENTS,
          includeCoordinates: !0
        });
        if (C && C.success && Array.isArray(C.elements)) {
          const I = C.elements.slice(0, 150);
          return S.fallbackUsed = !0, S.fallbackSource = "get_interactive_elements", S.reason = f ? "sparse_tree" : (p == null ? void 0 : p.error) || "tree_failed", S.elements = I, S.count = C.elements.length, S.pageContent || (S.pageContent = y(I)), {
            content: [{ type: "text", text: JSON.stringify(S) }],
            isError: !1
          };
        }
      } catch (C) {
        console.warn("read_page fallback failed:", C);
      }
      return m(
        f ? "Accessibility tree is too sparse and fallback failed" : (p == null ? void 0 : p.error) || "Failed to generate accessibility tree and fallback failed"
      );
    } catch (u) {
      return console.error("Error in read page tool:", u), m(
        `Error generating accessibility tree: ${u instanceof Error ? u.message : String(u)}`
      );
    }
  }
}
const Lt = new Ot(), qe = 50 * 1024, Mt = 6, Pt = 200, qt = 200, Ut = 1e4, Ft = [
  "cookie",
  "setcookie",
  "authorization",
  "proxyauthorization",
  "bearer",
  "token",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "password",
  "passwd",
  "pwd",
  "secret",
  "clientsecret",
  "apikey",
  "session",
  "sessionid",
  "sid",
  "csrf",
  "xsrf",
  "credential",
  "privatekey",
  "accesskey",
  "auth",
  "oauth"
];
function Ue(a, o = {}) {
  const e = z(o.maxBytes, qe), t = z(o.maxDepth, Mt), n = z(o.maxArrayLength, Pt), r = z(o.maxObjectKeys, qt), s = z(o.maxStringLength, Ut), { value: i, redacted: c } = Ht(a, {
    maxDepth: t,
    maxArrayLength: n,
    maxObjectKeys: r,
    maxStringLength: s
  }), u = Gt(i), l = Vt(u, e);
  return {
    text: l.text,
    truncated: l.truncated,
    redacted: c,
    originalBytes: l.originalBytes
  };
}
function B(a) {
  let o = a, e = !1;
  const t = (n, r) => {
    const s = o.replace(n, r);
    s !== o && (o = s, e = !0);
  };
  if (o.includes("=") && (o.includes(";") || o.includes("&"))) {
    if (jt(o))
      return { text: "[BLOCKED: Cookie/query string data]", redacted: !0 };
    if ($t(o))
      return { text: "[BLOCKED: Cookie/query string data]", redacted: !0 };
  }
  return /^[A-Za-z0-9+/]{20,}={0,2}$/.test(o) ? { text: "[BLOCKED: Base64 encoded data]", redacted: !0 } : /^[a-f0-9]{32,}$/i.test(o) ? { text: "[BLOCKED: Hex credential]", redacted: !0 } : (t(/\bBearer\s+([A-Za-z0-9._~+/=-]+)\b/gi, "Bearer <redacted>"), t(/\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, "<redacted_jwt>"), t(
    /(^|[?&])(access_token|refresh_token|id_token|token|api_key|apikey|password|passwd|pwd|secret|session|sid|credential|auth|oauth)=([^&#\s]+)/gi,
    (n, r, s) => `${r}${s}=<redacted>`
  ), t(
    /\b(authorization|cookie|set-cookie|x-api-key|api_key|apikey|password|passwd|pwd|secret|token|access_token|refresh_token|id_token|session|sid|credential|private_key|oauth)\b\s*[:=]\s*([^\s,;"']+)/gi,
    (n, r) => `${r}=<redacted>`
  ), t(/\b[A-Za-z0-9+/]{40,}={0,2}\b/g, "<redacted_base64>"), t(/\b[a-f0-9]{40,}\b/gi, "<redacted_hex>"), { text: o, redacted: e });
}
function $t(a) {
  const o = (a || "").trim();
  if (!o || !o.includes("=") || !o.includes("&")) return !1;
  const e = o.split("&");
  if (e.length < 2) return !1;
  let t = 0;
  for (const n of e)
    n.indexOf("=") > 0 && (t += 1);
  return t >= 2;
}
function Ht(a, o) {
  const { maxDepth: e, maxArrayLength: t, maxObjectKeys: n, maxStringLength: r } = o, s = /* @__PURE__ */ new WeakMap();
  let i = !1;
  const c = (u, l) => {
    if (l < 0) return "[MaxDepth]";
    if (typeof u == "string") {
      const T = B(u);
      T.redacted && (i = !0);
      let g = T.text;
      return g.length > r && (g = `${g.slice(0, r)}... [truncated ${g.length - r} chars]`), g;
    }
    if (u === null || typeof u == "number" || typeof u == "boolean" || typeof u == "bigint" || typeof u > "u")
      return u;
    if (typeof u == "symbol") return u.toString();
    if (typeof u == "function") return `[Function${u.name ? `: ${u.name}` : ""}]`;
    if (typeof u != "object") return String(u);
    const d = u;
    if (s.has(d)) return "[Circular]";
    if (Array.isArray(d)) {
      const T = [];
      s.set(d, T);
      const g = Math.min(d.length, t);
      for (let h = 0; h < g; h++)
        T.push(c(d[h], l - 1));
      return d.length > t && T.push("[...truncated]"), T;
    }
    const p = {};
    s.set(d, p);
    const f = Object.keys(d), b = Math.min(f.length, n);
    for (let T = 0; T < b; T++) {
      const g = f[T];
      if (Wt(g)) {
        p[g] = "<redacted>", i = !0;
        continue;
      }
      p[g] = c(d[g], l - 1);
    }
    return f.length > n && (p.__truncated__ = !0), p;
  };
  return { value: c(a, e), redacted: i };
}
function Wt(a) {
  const o = Bt(a);
  return Ft.some((e) => o.includes(e));
}
function Bt(a) {
  return (a || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function jt(a) {
  const o = (a || "").trim();
  if (!o || !o.includes("=") || !o.includes(";")) return !1;
  const e = o.split(";");
  if (e.length < 2) return !1;
  let t = 0;
  for (const n of e)
    n.indexOf("=") > 0 && (t += 1);
  return t >= 2;
}
function Gt(a) {
  if (typeof a == "string") return a;
  if (typeof a > "u") return "undefined";
  try {
    return Kt(a);
  } catch {
    return String(a);
  }
}
function Kt(a) {
  const o = /* @__PURE__ */ new WeakSet();
  return JSON.stringify(a, (e, t) => {
    if (typeof t == "bigint") return `${t.toString()}n`;
    if (typeof t == "symbol") return t.toString();
    if (typeof t == "function") return `[Function${t.name ? `: ${t.name}` : ""}]`;
    if (t && typeof t == "object") {
      if (o.has(t)) return "[Circular]";
      o.add(t);
    }
    return t;
  });
}
function Vt(a, o) {
  const e = ce(a);
  if (e <= o)
    return { text: a, truncated: !1, originalBytes: e };
  const t = `
... [truncated to ${o} bytes; original ${e} bytes]`, n = ce(t), r = Math.max(0, o - n);
  let s = 0, i = a.length;
  for (; s < i; ) {
    const u = Math.ceil((s + i) / 2), l = a.slice(0, u);
    ce(l) <= r ? s = u : i = u - 1;
  }
  return { text: a.slice(0, s) + t, truncated: !0, originalBytes: e };
}
function ce(a) {
  try {
    return new TextEncoder().encode(a).length;
  } catch {
    return a.length;
  }
}
function z(a, o) {
  const e = typeof a == "number" && Number.isFinite(a) ? Math.floor(a) : o;
  return Math.max(1, e);
}
const Yt = 15e3, zt = "javascript";
class Jt extends Error {
  constructor(o) {
    super(`Execution timed out after ${o}ms`), this.name = "TimeoutError";
  }
}
function Ee(a, o) {
  return typeof a != "number" || !Number.isFinite(a) ? o : Math.max(1, Math.floor(a));
}
function Fe(a, o) {
  return new Promise((e, t) => {
    const n = setTimeout(() => {
      t(new Jt(o));
    }, o);
    a.then(e).catch(t).finally(() => clearTimeout(n));
  });
}
function $e(a) {
  return a instanceof Error && a.name === "TimeoutError";
}
function Xt(a) {
  const o = a instanceof Error ? a.message : String(a);
  return /Debugger is already attached|Another debugger is already attached|Cannot attach to this target/i.test(
    o
  );
}
function Qt(a) {
  return `(async () => {
${a}
})()`;
}
function Zt(a) {
  if (a) {
    if ("value" in a) return a.value;
    if ("unserializableValue" in a) return a.unserializableValue;
    if (typeof a.description == "string") return a.description;
  }
}
function er(a) {
  var c, u, l;
  const o = ((c = a.exception) == null ? void 0 : c.className) ?? "", e = ((u = a.exception) == null ? void 0 : u.description) ?? "", t = ((l = a.exception) == null ? void 0 : l.value) ?? "", n = a.text ?? "", r = e || t || n || "JavaScript execution failed", s = B(r).text;
  return {
    kind: o === "SyntaxError" || /SyntaxError/i.test(r) ? "syntax_error" : "runtime_error",
    message: s,
    details: {
      url: a.url,
      lineNumber: a.lineNumber,
      columnNumber: a.columnNumber
    }
  };
}
async function tr(a, o, e) {
  try {
    const t = Qt(o), n = await Fe(
      A.withSession(a, zt, async () => await A.sendCommand(a, "Runtime.evaluate", {
        expression: t,
        returnByValue: !0,
        awaitPromise: !0,
        timeout: e.timeoutMs
      })),
      e.timeoutMs + 1e3
    );
    if (n != null && n.exceptionDetails)
      return {
        ok: !1,
        engine: "cdp",
        error: er(n.exceptionDetails)
      };
    const r = Zt(n == null ? void 0 : n.result), s = Ue(r, { maxBytes: e.maxOutputBytes });
    return {
      ok: !0,
      engine: "cdp",
      output: s.text,
      truncated: s.truncated,
      redacted: s.redacted
    };
  } catch (t) {
    return $e(t) ? {
      ok: !1,
      engine: "cdp",
      error: { kind: "timeout", message: t.message }
    } : Xt(t) ? {
      ok: !1,
      engine: "cdp",
      error: { kind: "debugger_conflict", message: B(t instanceof Error ? t.message : String(t)).text }
    } : {
      ok: !1,
      engine: "cdp",
      error: { kind: "cdp_error", message: B(t instanceof Error ? t.message : String(t)).text }
    };
  }
}
async function rr(a, o, e) {
  const t = async () => {
    var c, u, l;
    const n = await chrome.scripting.executeScript({
      target: { tabId: a },
      world: "ISOLATED",
      func: async (d) => {
        try {
          const p = Object.getPrototypeOf(async function() {
          }).constructor;
          return { ok: !0, value: await new p(d)() };
        } catch (p) {
          const f = p;
          return {
            ok: !1,
            error: {
              name: (f == null ? void 0 : f.name) ?? void 0,
              message: (f == null ? void 0 : f.message) ?? String(p),
              stack: (f == null ? void 0 : f.stack) ?? void 0
            }
          };
        }
      },
      args: [o]
    }), r = n == null ? void 0 : n[0], s = r == null ? void 0 : r.result;
    if (!s || typeof s != "object")
      return {
        ok: !1,
        engine: "scripting",
        error: { kind: "scripting_error", message: "No result returned from executeScript" }
      };
    if (!s.ok) {
      const d = ((c = s.error) == null ? void 0 : c.message) ?? "JavaScript execution failed", p = (u = s.error) == null ? void 0 : u.stack, f = B(d).text, b = p ? B(p).text : void 0;
      return {
        ok: !1,
        engine: "scripting",
        error: {
          kind: ((l = s.error) == null ? void 0 : l.name) === "SyntaxError" || /SyntaxError/i.test(d) ? "syntax_error" : "runtime_error",
          message: b ? `${f}
${b}` : f
        }
      };
    }
    const i = Ue(s.value, { maxBytes: e.maxOutputBytes });
    return {
      ok: !0,
      engine: "scripting",
      output: i.text,
      truncated: i.truncated,
      redacted: i.redacted
    };
  };
  try {
    return await Fe(t(), e.timeoutMs);
  } catch (n) {
    return $e(n) ? {
      ok: !1,
      engine: "scripting",
      error: { kind: "timeout", message: n.message }
    } : {
      ok: !1,
      engine: "scripting",
      error: { kind: "scripting_error", message: B(n instanceof Error ? n.message : String(n)).text }
    };
  }
}
class nr extends D {
  constructor() {
    super(...arguments);
    _(this, "name", E.JAVASCRIPT);
  }
  async execute(e) {
    const t = performance.now();
    try {
      const n = typeof (e == null ? void 0 : e.code) == "string" ? e.code.trim() : "";
      if (!n)
        return m("Parameter [code] is required");
      const r = await this.resolveTargetTab(e.tabId);
      if (!r)
        return m(
          typeof e.tabId == "number" ? `Tab not found: ${e.tabId}` : "No active tab found"
        );
      if (!r.id)
        return m("Tab has no ID");
      const s = r.id, i = {
        timeoutMs: Ee(e.timeoutMs, Yt),
        maxOutputBytes: Ee(e.maxOutputBytes, qe)
      }, c = [], u = await tr(s, n, i);
      if (u.ok)
        return this.buildSuccessResponse(s, u, t);
      if (u.error.kind !== "debugger_conflict")
        return this.buildErrorResponse(s, u, t);
      c.push(
        "Debugger is busy (DevTools or another extension attached). Falling back to chrome.scripting.executeScript (runs in ISOLATED world, not page context)."
      );
      const l = await rr(s, n, i);
      return l.ok ? this.buildSuccessResponse(s, l, t, c) : this.buildErrorResponse(s, l, t, c);
    } catch (n) {
      return console.error("JavaScriptTool.execute error:", n), m(
        `JavaScript tool error: ${n instanceof Error ? n.message : String(n)}`
      );
    }
  }
  async resolveTargetTab(e) {
    if (typeof e == "number")
      return this.tryGetTab(e);
    try {
      return await this.getActiveTabOrThrow();
    } catch {
      return null;
    }
  }
  buildSuccessResponse(e, t, n, r) {
    const s = {
      success: !0,
      tabId: e,
      engine: t.engine,
      result: t.output,
      truncated: t.truncated || void 0,
      redacted: t.redacted || void 0,
      warnings: r != null && r.length ? r : void 0,
      metrics: { elapsedMs: Math.round(performance.now() - n) }
    };
    return {
      content: [{ type: "text", text: JSON.stringify(s) }],
      isError: !1
    };
  }
  buildErrorResponse(e, t, n, r) {
    const s = {
      success: !1,
      tabId: e,
      engine: t.engine,
      error: t.error,
      warnings: r != null && r.length ? r : void 0,
      metrics: { elapsedMs: Math.round(performance.now() - n) }
    };
    return {
      content: [{ type: "text", text: JSON.stringify(s) }],
      isError: !0
    };
  }
}
const sr = new nr(), or = 2e3, ir = 500;
function Se(a) {
  if (!a) return "";
  try {
    return new URL(a).hostname;
  } catch {
    return "";
  }
}
function ar(a) {
  const o = (a || "").toLowerCase();
  return o === "error" || o === "assert";
}
function Ce(a, o) {
  return a.lastIndex = 0, a.test(o);
}
function cr(a) {
  return !a || a.length === 0 ? "" : a.map((o) => {
    const e = o;
    return e.type === "string" ? e.value || "" : e.type === "number" || e.type === "boolean" ? String(e.value ?? "") : e.type === "object" ? e.description || "[Object]" : e.type === "undefined" ? "undefined" : e.type === "function" ? e.description || "[Function]" : e.description || e.value || String(o);
  }).join(" ");
}
function ur(a) {
  const o = a;
  if (!o || typeof o != "object") return a;
  const e = { type: o.type };
  return "value" in o && (e.value = o.value), "unserializableValue" in o && (e.unserializableValue = o.unserializableValue), "description" in o && (e.description = o.description), "subtype" in o && (e.subtype = o.subtype), "className" in o && (e.className = o.className), e;
}
function xe(a) {
  return typeof a == "number" && Number.isFinite(a) ? a : Date.now();
}
function F(a) {
  return typeof a == "string" ? a : "";
}
function te(a) {
  return typeof a == "number" ? a : void 0;
}
const G = class G {
  constructor() {
    _(this, "buffers", /* @__PURE__ */ new Map());
    _(this, "starting", /* @__PURE__ */ new Map());
    if (G.instance)
      return G.instance;
    G.instance = this, chrome.debugger.onEvent.addListener(this.handleDebuggerEvent.bind(this)), chrome.debugger.onDetach.addListener(this.handleDebuggerDetach.bind(this)), chrome.tabs.onRemoved.addListener(this.handleTabRemoved.bind(this)), chrome.tabs.onUpdated.addListener(this.handleTabUpdated.bind(this));
  }
  isCapturing(o) {
    return this.buffers.has(o);
  }
  async ensureStarted(o) {
    if (this.buffers.has(o)) return;
    const e = this.starting.get(o);
    if (e) return e;
    const t = this.startCapture(o).finally(() => {
      this.starting.delete(o);
    });
    return this.starting.set(o, t), t;
  }
  clear(o, e = "manual") {
    const t = this.buffers.get(o);
    if (!t) return null;
    const n = t.messages.length, r = t.exceptions.length;
    return t.messages.length = 0, t.exceptions.length = 0, t.droppedMessageCount = 0, t.droppedExceptionCount = 0, t.captureStartTime = Date.now(), console.log(
      `ConsoleBuffer: Cleared buffer for tab ${o} (reason=${e}). ${n} messages, ${r} exceptions.`
    ), { clearedMessages: n, clearedExceptions: r };
  }
  read(o, e = {}) {
    const t = this.buffers.get(o);
    if (!t) return null;
    const { pattern: n, onlyErrors: r = !1, limit: s, includeExceptions: i = !0 } = e, c = t.messages.length, u = t.exceptions.length;
    let l = t.messages;
    r && (l = l.filter((T) => ar(T.level))), n && (l = l.filter((T) => Ce(n, T.text || ""))), l = [...l].sort((T, g) => T.timestamp - g.timestamp);
    let d = !1;
    const p = typeof s == "number" && Number.isFinite(s) ? Math.max(0, Math.floor(s)) : null;
    p !== null && l.length > p && (d = !0, l = l.slice(l.length - p));
    let f = [];
    i && (f = t.exceptions, n && (f = f.filter((T) => Ce(n, T.text || ""))), f = [...f].sort((T, g) => T.timestamp - g.timestamp));
    const b = Date.now();
    return {
      tabId: o,
      tabUrl: t.tabUrl,
      tabTitle: t.tabTitle,
      captureStartTime: t.captureStartTime,
      captureEndTime: b,
      totalDurationMs: b - t.captureStartTime,
      messages: l,
      exceptions: f,
      totalBufferedMessages: c,
      totalBufferedExceptions: u,
      messageCount: l.length,
      exceptionCount: f.length,
      messageLimitReached: d,
      droppedMessageCount: t.droppedMessageCount,
      droppedExceptionCount: t.droppedExceptionCount
    };
  }
  async startCapture(o) {
    const e = await chrome.tabs.get(o), t = e.url || "", n = e.title || "", r = Se(t), s = {
      tabId: o,
      tabUrl: t,
      tabTitle: n,
      hostname: r,
      captureStartTime: Date.now(),
      messages: [],
      exceptions: [],
      droppedMessageCount: 0,
      droppedExceptionCount: 0
    };
    this.buffers.set(o, s);
    try {
      await A.attach(o, "console-buffer"), await A.sendCommand(o, "Runtime.enable"), await A.sendCommand(o, "Log.enable");
    } catch (i) {
      throw this.buffers.delete(o), await A.detach(o, "console-buffer").catch(() => {
      }), i;
    }
  }
  handleTabRemoved(o) {
    this.buffers.has(o) && this.stopCapture(o, "tab_closed");
  }
  handleTabUpdated(o, e, t) {
    const n = this.buffers.get(o);
    if (!n) return;
    const r = e.url ?? t.url, s = t.title;
    if (typeof r == "string") {
      const i = Se(r);
      i !== n.hostname && (this.clear(o, "domain_changed"), n.hostname = i), n.tabUrl = r;
    }
    typeof s == "string" && (n.tabTitle = s);
  }
  handleDebuggerDetach(o, e) {
    typeof o.tabId == "number" && this.buffers.has(o.tabId) && (console.log(
      `ConsoleBuffer: Debugger detached from tab ${o.tabId} (reason=${e}), cleaning up.`
    ), this.buffers.delete(o.tabId), this.starting.delete(o.tabId), A.detach(o.tabId, "console-buffer").catch(() => {
    }));
  }
  handleDebuggerEvent(o, e, t) {
    var i;
    const n = o.tabId;
    if (typeof n != "number") return;
    const r = this.buffers.get(n);
    if (!r) return;
    const s = t;
    if (e === "Log.entryAdded" && (s != null && s.entry)) {
      const c = s.entry;
      r.messages.push({
        timestamp: xe(c.timestamp),
        level: F(c.level) || "log",
        text: F(c.text),
        source: F(c.source),
        url: F(c.url),
        lineNumber: te(c.lineNumber),
        stackTrace: c.stackTrace
      }), this.trimMessages(r);
      return;
    }
    if (e === "Runtime.consoleAPICalled" && s) {
      const c = s.stackTrace, u = (i = c == null ? void 0 : c.callFrames) == null ? void 0 : i[0], l = s.args || [];
      r.messages.push({
        timestamp: xe(s.timestamp),
        level: F(s.type) || "log",
        text: cr(l),
        source: "console-api",
        url: F(u == null ? void 0 : u.url),
        lineNumber: te(u == null ? void 0 : u.lineNumber),
        stackTrace: c,
        args: l.map(ur)
      }), this.trimMessages(r);
      return;
    }
    if (e === "Runtime.exceptionThrown" && (s != null && s.exceptionDetails)) {
      const c = s.exceptionDetails, u = c.exception;
      r.exceptions.push({
        timestamp: Date.now(),
        text: F(c.text) || F(u == null ? void 0 : u.description) || "Unknown exception",
        url: F(c.url),
        lineNumber: te(c.lineNumber),
        columnNumber: te(c.columnNumber),
        stackTrace: c.stackTrace
      }), this.trimExceptions(r);
    }
  }
  trimMessages(o) {
    const e = o.messages.length - or;
    e <= 0 || (o.messages.splice(0, e), o.droppedMessageCount += e);
  }
  trimExceptions(o) {
    const e = o.exceptions.length - ir;
    e <= 0 || (o.exceptions.splice(0, e), o.droppedExceptionCount += e);
  }
  async stopCapture(o, e) {
    if (this.buffers.has(o)) {
      this.buffers.delete(o), this.starting.delete(o);
      try {
        await A.sendCommand(o, "Runtime.disable");
      } catch {
      }
      try {
        await A.sendCommand(o, "Log.disable");
      } catch {
      }
      await A.detach(o, "console-buffer").catch(() => {
      }), console.log(`ConsoleBuffer: Stopped buffer for tab ${o} (reason=${e}).`);
    }
  }
};
_(G, "instance", null);
let ue = G;
const J = new ue(), _e = 100;
function Re(a, o) {
  const e = typeof a == "number" && Number.isFinite(a) ? Math.floor(a) : o;
  return Math.max(0, e);
}
function lr(a) {
  if (typeof a != "string") return;
  const o = a.trim();
  if (!o) return;
  const e = o.match(/^\/(.+)\/([gimsuy]*)$/);
  try {
    return e ? new RegExp(e[1], e[2]) : new RegExp(o);
  } catch (t) {
    const n = t instanceof Error ? t.message : String(t);
    throw new Error(`Invalid regex pattern: ${n}`);
  }
}
function ve(a, o) {
  return a.lastIndex = 0, a.test(o);
}
function dr(a) {
  const o = (a || "").toLowerCase();
  return o === "error" || o === "assert";
}
function pr(a, o) {
  const { pattern: e, onlyErrors: t = !1, includeExceptions: n } = o;
  let r = a.messages;
  t && (r = r.filter((i) => dr(i.level))), e && (r = r.filter((i) => ve(e, i.text || "")));
  let s = n ? a.exceptions : [];
  return n && e && (s = s.filter((i) => ve(e, i.text || ""))), {
    ...a,
    messages: r,
    exceptions: s,
    messageCount: r.length,
    exceptionCount: s.length
  };
}
function Ae(a) {
  const o = (a instanceof Error ? a.message : String(a)).toLowerCase();
  return o.includes("debugger is already attached") || o.includes("another client");
}
function Ie(a, o) {
  return `Failed to attach Chrome Debugger to tab ${a}: another debugger client is already attached (likely DevTools or another extension). Close DevTools for this tab or disable the conflicting extension, then retry. Original error: ${o}`;
}
class fr extends D {
  constructor() {
    super(...arguments);
    _(this, "name", E.CONSOLE);
  }
  async execute(e) {
    const {
      url: t,
      tabId: n,
      windowId: r,
      background: s = !1,
      includeExceptions: i = !0,
      maxMessages: c = _e,
      mode: u = "snapshot",
      buffer: l,
      clear: d = !1,
      clearAfterRead: p = !1,
      pattern: f,
      onlyErrors: b = !1,
      limit: T
    } = e;
    let g, h, w;
    try {
      w = lr(f);
    } catch (y) {
      const S = y instanceof Error ? y.message : String(y);
      return m(S);
    }
    try {
      if (typeof n == "number") {
        const R = await chrome.tabs.get(n);
        if (!(R != null && R.id)) return m("Failed to identify target tab.");
        g = R;
      } else if (t)
        g = await this.navigateToUrl(t, s === !0, r);
      else {
        const [R] = typeof r == "number" ? await chrome.tabs.query({ active: !0, windowId: r }) : await chrome.tabs.query({ active: !0, currentWindow: !0 });
        if (!(R != null && R.id))
          return m("No active tab found and no URL provided.");
        g = R;
      }
      if (!(g != null && g.id))
        return m("Failed to identify target tab.");
      h = g.id;
      const y = u === "buffer" || l === !0 ? "buffer" : "snapshot", S = Re(c, _e), C = typeof T == "number" ? Re(T, S) : S;
      if (y === "buffer") {
        try {
          await J.ensureStarted(h);
        } catch (j) {
          const ie = j instanceof Error ? j.message : String(j);
          if (Ae(j))
            return m(Ie(h, ie));
          throw j;
        }
        let R = null;
        d === !0 && (R = J.clear(h, "manual"));
        const v = J.read(h, {
          pattern: w,
          onlyErrors: b,
          limit: C,
          includeExceptions: i
        });
        if (!v)
          return m("Console buffer is not available for this tab.");
        let N = null;
        p === !0 && (N = J.clear(h, "manual"));
        let k = "";
        R && (k += ` Cleared ${R.clearedMessages} messages and ${R.clearedExceptions} exceptions before reading.`), N && (k += ` Cleared ${N.clearedMessages} messages and ${N.clearedExceptions} exceptions after reading.`);
        const L = {
          success: !0,
          message: `Console buffer read for tab ${h}.` + k + ` Returned ${v.messageCount} messages and ${v.exceptionCount} exceptions.`,
          tabId: h,
          tabUrl: v.tabUrl || "",
          tabTitle: v.tabTitle || "",
          captureStartTime: v.captureStartTime,
          captureEndTime: v.captureEndTime,
          totalDurationMs: v.totalDurationMs,
          messages: v.messages,
          exceptions: v.exceptions,
          messageCount: v.messageCount,
          exceptionCount: v.exceptionCount,
          messageLimitReached: v.messageLimitReached,
          droppedMessageCount: v.droppedMessageCount,
          droppedExceptionCount: v.droppedExceptionCount
        };
        return {
          content: [{ type: "text", text: JSON.stringify(L) }],
          isError: !1
        };
      }
      const I = await this.captureConsoleMessages(h, {
        includeExceptions: i,
        maxMessages: C
      }), x = pr(I, {
        pattern: w,
        onlyErrors: b,
        includeExceptions: i
      });
      return {
        content: [{ type: "text", text: JSON.stringify(x) }],
        isError: !1
      };
    } catch (y) {
      console.error("ConsoleTool: Critical error during execute:", y);
      const S = y instanceof Error ? y.message : String(y);
      return typeof h == "number" && Ae(y) ? m(Ie(h, S)) : m(`Error in ConsoleTool: ${S}`);
    }
  }
  async navigateToUrl(e, t = !1, n) {
    var s;
    const r = await chrome.tabs.query({ url: e });
    if (r.length > 0 && ((s = r[0]) != null && s.id)) {
      const i = r[0];
      return t || (await chrome.tabs.update(i.id, { active: !0 }), await chrome.windows.update(i.windowId, { focused: !0 })), i;
    } else {
      const i = { url: e, active: !t };
      typeof n == "number" && (i.windowId = n);
      const c = await chrome.tabs.create(i);
      return await this.waitForTabReady(c.id), c;
    }
  }
  async waitForTabReady(e) {
    return new Promise((t) => {
      const n = async () => {
        try {
          (await chrome.tabs.get(e)).status === "complete" ? t() : setTimeout(n, 100);
        } catch {
          t();
        }
      };
      n();
    });
  }
  formatConsoleArgs(e) {
    return !e || e.length === 0 ? "" : e.map((t) => t.type === "string" ? t.value || "" : t.type === "number" || t.type === "boolean" ? String(t.value || "") : t.type === "object" ? t.description || "[Object]" : t.type === "undefined" ? "undefined" : t.type === "function" ? t.description || "[Function]" : t.description || t.value || String(t)).join(" ");
  }
  async captureConsoleMessages(e, t) {
    var l;
    const { includeExceptions: n, maxMessages: r } = t, s = Date.now(), i = [], c = [];
    let u = !1;
    try {
      const d = await chrome.tabs.get(e);
      await A.attach(e, "console");
      const p = [], f = [], b = (g, h, w) => {
        var y, S, C, I, x, R;
        if (g.tabId === e)
          if (h === "Log.entryAdded" && (w != null && w.entry))
            p.push(w.entry);
          else if (h === "Runtime.consoleAPICalled" && w) {
            const v = {
              timestamp: w.timestamp,
              level: w.type || "log",
              text: this.formatConsoleArgs(w.args || []),
              source: "console-api",
              url: (C = (S = (y = w.stackTrace) == null ? void 0 : y.callFrames) == null ? void 0 : S[0]) == null ? void 0 : C.url,
              lineNumber: (R = (x = (I = w.stackTrace) == null ? void 0 : I.callFrames) == null ? void 0 : x[0]) == null ? void 0 : R.lineNumber,
              stackTrace: w.stackTrace,
              args: w.args
            };
            p.push(v);
          } else h === "Runtime.exceptionThrown" && n && (w != null && w.exceptionDetails) && f.push(w.exceptionDetails);
      };
      chrome.debugger.onEvent.addListener(b);
      try {
        await A.sendCommand(e, "Runtime.enable"), await A.sendCommand(e, "Log.enable"), await new Promise((h) => setTimeout(h, 2e3));
        const g = async (h) => {
          var w;
          try {
            if (!h) return h;
            if (Object.prototype.hasOwnProperty.call(h, "unserializableValue"))
              return h.unserializableValue;
            if (Object.prototype.hasOwnProperty.call(h, "value"))
              return h.value;
            if (h.objectId) {
              const y = await A.sendCommand(e, "Runtime.callFunctionOn", {
                objectId: h.objectId,
                functionDeclaration: `function(maxDepth, maxProps){
  const seen=new WeakSet();
  function S(v,d){
    try{
      if(d<0) return "[MaxDepth]";
      if(v===null) return null;
      const t=typeof v;
      if(t!=="object"){
        if(t==="bigint") return v.toString()+"n";
        return v;
      }
      if(seen.has(v)) return "[Circular]";
      seen.add(v);
      if(Array.isArray(v)){
        const out=[];
        for(let i=0;i<v.length;i++){
          if(i>=maxProps){ out.push("[...truncated]"); break; }
          out.push(S(v[i], d-1));
        }
        return out;
      }
      if(v instanceof Date) return {__type:"Date", value:v.toISOString()};
      if(v instanceof RegExp) return {__type:"RegExp", value:String(v)};
      if(v instanceof Map){
        const out={__type:"Map", entries:[]}; let c=0;
        for(const [k,val] of v.entries()){
          if(c++>=maxProps){ out.entries.push(["[...truncated]","[...truncated]"]); break; }
          out.entries.push([S(k,d-1), S(val,d-1)]);
        }
        return out;
      }
      if(v instanceof Set){
        const out={__type:"Set", values:[]}; let c=0;
        for(const val of v.values()){
          if(c++>=maxProps){ out.values.push("[...truncated]"); break; }
          out.values.push(S(val,d-1));
        }
        return out;
      }
      const out={}; let c=0;
      for(const key in v){
        if(c++>=maxProps){ out.__truncated__=true; break; }
        try{ out[key]=S(v[key], d-1); }catch(e){ out[key]="[Thrown]"; }
      }
      return out;
    }catch(e){ return "[Unserializable]" }
  }
  return S(this, maxDepth);
}`,
                arguments: [{ value: 3 }, { value: 100 }],
                silent: !0,
                returnByValue: !0
              });
              return ((w = y == null ? void 0 : y.result) == null ? void 0 : w.value) ?? "[Unavailable]";
            }
            return "[Unknown]";
          } catch {
            return "[SerializeError]";
          }
        };
        for (const h of p) {
          if (i.length >= r) {
            u = !0;
            break;
          }
          const w = {
            timestamp: h.timestamp,
            level: h.level || "log",
            text: h.text || "",
            source: h.source,
            url: h.url,
            lineNumber: h.lineNumber
          };
          if (h.stackTrace && (w.stackTrace = h.stackTrace), h.args && Array.isArray(h.args)) {
            w.args = h.args;
            const y = [];
            for (const S of h.args)
              y.push(await g(S));
            w.argsSerialized = y;
          }
          i.push(w);
        }
        for (const h of f) {
          const w = {
            timestamp: Date.now(),
            text: h.text || ((l = h.exception) == null ? void 0 : l.description) || "Unknown exception",
            url: h.url,
            lineNumber: h.lineNumber,
            columnNumber: h.columnNumber
          };
          h.stackTrace && (w.stackTrace = h.stackTrace), c.push(w);
        }
      } finally {
        if (chrome.debugger.onEvent.removeListener(b), !J.isCapturing(e)) {
          try {
            await A.sendCommand(e, "Runtime.disable");
          } catch (h) {
            console.warn(`ConsoleTool: Error disabling Runtime for tab ${e}:`, h);
          }
          try {
            await A.sendCommand(e, "Log.disable");
          } catch (h) {
            console.warn(`ConsoleTool: Error disabling Log for tab ${e}:`, h);
          }
        }
        try {
          await A.detach(e, "console");
        } catch (h) {
          console.warn(`ConsoleTool: Error detaching debugger for tab ${e}:`, h);
        }
      }
      const T = Date.now();
      return i.sort((g, h) => g.timestamp - h.timestamp), c.sort((g, h) => g.timestamp - h.timestamp), {
        success: !0,
        message: `Console capture completed for tab ${e}. ${i.length} messages, ${c.length} exceptions captured.`,
        tabId: e,
        tabUrl: d.url || "",
        tabTitle: d.title || "",
        captureStartTime: s,
        captureEndTime: T,
        totalDurationMs: T - s,
        messages: i,
        exceptions: c,
        messageCount: i.length,
        exceptionCount: c.length,
        messageLimitReached: u,
        droppedMessageCount: 0,
        droppedExceptionCount: 0
      };
    } catch (d) {
      throw console.error(`ConsoleTool: Error capturing console messages for tab ${e}:`, d), d;
    }
  }
}
const mr = new fr();
class hr extends D {
  constructor() {
    super(...arguments);
    _(this, "name", E.CLICK);
  }
  async execute(e) {
    const {
      selector: t,
      selectorType: n = "css",
      coordinates: r,
      waitForNavigation: s = !1,
      timeout: i = Me.DEFAULT_WAIT * 5,
      frameId: c,
      button: u,
      bubbles: l,
      cancelable: d,
      modifiers: p
    } = e;
    if (console.log("Starting click operation with options:", e), !t && !r && !e.ref)
      return m(
        q.INVALID_PARAMETERS + ": Provide ref or selector or coordinates"
      );
    try {
      const b = await this.tryGetTab(e.tabId) || await this.getActiveTabOrThrowInWindow(e.windowId);
      if (!b.id)
        return m(q.TAB_NOT_FOUND + ": Active tab has no ID");
      let T = e.ref, g = t;
      if (t && n === "xpath") {
        await this.injectContentScript(b.id, ["inject-scripts/accessibility-tree-helper.js"]);
        try {
          const y = await this.sendMessageToTab(
            b.id,
            {
              action: O.ENSURE_REF_FOR_SELECTOR,
              selector: t,
              isXPath: !0
            },
            c
          );
          if (y && y.success && y.ref)
            T = y.ref, g = void 0;
          else
            return m(
              `Failed to resolve XPath selector: ${(y == null ? void 0 : y.error) || "unknown error"}`
            );
        } catch (y) {
          return m(
            `Error resolving XPath: ${y instanceof Error ? y.message : String(y)}`
          );
        }
      }
      await this.injectContentScript(b.id, ["inject-scripts/click-helper.js"]);
      const h = await this.sendMessageToTab(
        b.id,
        {
          action: O.CLICK_ELEMENT,
          selector: g,
          coordinates: r,
          ref: T,
          waitForNavigation: s,
          timeout: i,
          double: e.double === !0,
          button: u,
          bubbles: l,
          cancelable: d,
          modifiers: p
        },
        c
      );
      let w;
      return r ? w = "coordinates" : T ? w = "ref" : g ? w = "selector" : w = "unknown", {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: !0,
              message: h.message || "Click operation successful",
              elementInfo: h.elementInfo,
              navigationOccurred: h.navigationOccurred,
              clickMethod: w
            })
          }
        ],
        isError: !1
      };
    } catch (f) {
      return console.error("Error in click operation:", f), m(
        `Error performing click: ${f instanceof Error ? f.message : String(f)}`
      );
    }
  }
}
const gr = new hr();
class yr extends D {
  constructor() {
    super(...arguments);
    _(this, "name", E.FILL);
  }
  async execute(e) {
    const { selector: t, selectorType: n = "css", ref: r, value: s, frameId: i } = e;
    if (console.log("Starting fill operation with options:", e), !t && !r)
      return m(q.INVALID_PARAMETERS + ": Provide ref or selector");
    if (s == null)
      return m(q.INVALID_PARAMETERS + ": Value must be provided");
    try {
      const u = await this.tryGetTab(e.tabId) || await this.getActiveTabOrThrowInWindow(e.windowId);
      if (!u.id)
        return m(q.TAB_NOT_FOUND + ": Active tab has no ID");
      let l = r, d = t;
      if (t && n === "xpath") {
        await this.injectContentScript(u.id, ["inject-scripts/accessibility-tree-helper.js"]);
        try {
          const f = await this.sendMessageToTab(
            u.id,
            {
              action: O.ENSURE_REF_FOR_SELECTOR,
              selector: t,
              isXPath: !0
            },
            i
          );
          if (f && f.success && f.ref)
            l = f.ref, d = void 0;
          else
            return m(
              `Failed to resolve XPath selector: ${(f == null ? void 0 : f.error) || "unknown error"}`
            );
        } catch (f) {
          return m(
            `Error resolving XPath: ${f instanceof Error ? f.message : String(f)}`
          );
        }
      }
      await this.injectContentScript(u.id, ["inject-scripts/fill-helper.js"]);
      const p = await this.sendMessageToTab(
        u.id,
        {
          action: O.FILL_ELEMENT,
          selector: d,
          ref: l,
          value: s
        },
        i
      );
      return p && p.error ? m(p.error) : {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: !0,
              message: p.message || "Fill operation successful",
              elementInfo: p.elementInfo
            })
          }
        ],
        isError: !1
      };
    } catch (c) {
      return console.error("Error in fill operation:", c), m(
        `Error filling element: ${c instanceof Error ? c.message : String(c)}`
      );
    }
  }
}
const wr = new yr();
class br extends D {
  constructor() {
    super(...arguments);
    _(this, "name", E.WEB_FETCHER);
  }
  async execute(e) {
    const t = e.htmlContent === !0, n = t ? !1 : e.textContent !== !1, r = e.url, s = e.selector, i = e.tabId, c = e.background === !0, u = e.windowId;
    console.log("Starting web fetcher with options:", { htmlContent: t, textContent: n, url: r, selector: s });
    try {
      let l;
      if (typeof i == "number")
        l = await chrome.tabs.get(i);
      else if (r) {
        console.log(`Checking if URL is already open: ${r}`);
        const f = (await chrome.tabs.query({})).filter((b) => {
          var h;
          const T = (h = b.url) != null && h.endsWith("/") ? b.url.slice(0, -1) : b.url, g = r.endsWith("/") ? r.slice(0, -1) : r;
          return T === g;
        });
        f.length > 0 ? l = f[0] : (l = await chrome.tabs.create({ url: r, active: !c }), await new Promise((b) => setTimeout(b, 3e3)));
      } else {
        const p = typeof u == "number" ? await chrome.tabs.query({ active: !0, windowId: u }) : await chrome.tabs.query({ active: !0, currentWindow: !0 });
        if (!p[0])
          return m("No active tab found");
        l = p[0];
      }
      if (!l.id)
        return m("Tab has no ID");
      c || (await chrome.tabs.update(l.id, { active: !0 }), await chrome.windows.update(l.windowId, { focused: !0 }));
      const d = {
        success: !0,
        url: l.url,
        title: l.title
      };
      if (await this.injectContentScript(l.id, ["inject-scripts/web-fetcher-helper.js"]), t) {
        const p = await this.sendMessageToTab(l.id, {
          action: O.WEB_FETCHER_GET_HTML_CONTENT,
          selector: s
        });
        p.success ? d.htmlContent = p.htmlContent : (console.error("Failed to get HTML content:", p.error), d.htmlContentError = p.error);
      }
      if (n) {
        const p = await this.sendMessageToTab(l.id, {
          action: O.WEB_FETCHER_GET_TEXT_CONTENT,
          selector: s
        });
        p.success ? (d.textContent = p.textContent, p.article && (d.article = {
          title: p.article.title,
          byline: p.article.byline,
          siteName: p.article.siteName,
          excerpt: p.article.excerpt,
          lang: p.article.lang
        }), p.metadata && (d.metadata = p.metadata)) : (console.error("Failed to get text content:", p.error), d.textContentError = p.error);
      }
      return {
        content: [{ type: "text", text: JSON.stringify(d) }],
        isError: !1
      };
    } catch (l) {
      return console.error("Error in web fetcher:", l), m(
        `Error fetching web content: ${l instanceof Error ? l.message : String(l)}`
      );
    }
  }
}
const Tr = new br();
class Er extends D {
  constructor() {
    super(...arguments);
    _(this, "name", E.GET_INTERACTIVE_ELEMENTS);
  }
  async execute(e) {
    const { textQuery: t, selector: n, includeCoordinates: r = !0, types: s } = e;
    console.log("Starting get interactive elements with options:", e);
    try {
      const i = await chrome.tabs.query({ active: !0, currentWindow: !0 });
      if (!i[0])
        return m("No active tab found");
      const c = i[0];
      if (!c.id)
        return m("Active tab has no ID");
      await this.injectContentScript(c.id, ["inject-scripts/interactive-elements-helper.js"]);
      const u = await this.sendMessageToTab(c.id, {
        action: O.GET_INTERACTIVE_ELEMENTS,
        textQuery: t,
        selector: n,
        includeCoordinates: r,
        types: s
      });
      return u.success ? {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: !0,
              elements: u.elements,
              count: u.elements.length,
              query: {
                textQuery: t,
                selector: n,
                types: s || "all"
              }
            })
          }
        ],
        isError: !1
      } : m(u.error || "Failed to get interactive elements");
    } catch (i) {
      return console.error("Error in get interactive elements operation:", i), m(
        `Error getting interactive elements: ${i instanceof Error ? i.message : String(i)}`
      );
    }
  }
}
const Sr = new Er(), Cr = 3e4;
class xr extends D {
  constructor() {
    super(...arguments);
    _(this, "name", E.NETWORK_REQUEST);
  }
  async execute(e) {
    var c;
    const {
      url: t,
      method: n = "GET",
      headers: r = {},
      body: s,
      timeout: i = Cr
    } = e;
    if (console.log("NetworkRequestTool: Executing with options:", e), !t)
      return m("URL parameter is required.");
    try {
      const u = await chrome.tabs.query({ active: !0, currentWindow: !0 });
      if (!((c = u[0]) != null && c.id))
        return m("No active tab found or tab has no ID.");
      const l = u[0].id;
      await this.injectContentScript(l, ["inject-scripts/network-helper.js"]), console.log(
        `NetworkRequestTool: Sending to content script: URL=${t}, Method=${n}, Headers=${Object.keys(r).join(",")}, BodyType=${typeof s}`
      );
      const d = await this.sendMessageToTab(l, {
        action: O.NETWORK_SEND_REQUEST,
        url: t,
        method: n,
        headers: r,
        body: s,
        formData: e.formData || null,
        timeout: i
      });
      return console.log("NetworkRequestTool: Response from content script:", d), {
        content: [{ type: "text", text: JSON.stringify(d) }],
        isError: !(d != null && d.success)
      };
    } catch (u) {
      return console.error("NetworkRequestTool: Error sending network request:", u), m(
        `Error sending network request: ${u.message || String(u)}`
      );
    }
  }
}
const _r = new xr(), Rr = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".svg",
  ".webp",
  ".ico",
  ".bmp",
  ".css",
  ".scss",
  ".less",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".otf",
  ".mp3",
  ".mp4",
  ".avi",
  ".mov",
  ".wmv",
  ".flv",
  ".ogg",
  ".wav",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx"
], vr = W.EXCLUDED_DOMAINS, P = class P extends D {
  constructor() {
    super();
    _(this, "name", E.NETWORK_CAPTURE_START);
    _(this, "captureData", /* @__PURE__ */ new Map());
    _(this, "captureTimers", /* @__PURE__ */ new Map());
    _(this, "inactivityTimers", /* @__PURE__ */ new Map());
    _(this, "lastActivityTime", /* @__PURE__ */ new Map());
    _(this, "requestCounters", /* @__PURE__ */ new Map());
    _(this, "listeners", {});
    if (P.instance)
      return P.instance;
    P.instance = this, chrome.tabs.onRemoved.addListener(this.handleTabRemoved.bind(this)), chrome.tabs.onCreated.addListener(this.handleTabCreated.bind(this));
  }
  handleTabRemoved(e) {
    this.captureData.has(e) && (console.log(`NetworkCaptureV2: Tab ${e} was closed, cleaning up resources.`), this.cleanupCapture(e));
  }
  async handleTabCreated(e) {
    try {
      if (this.captureData.size === 0) return;
      const t = e.openerTabId;
      if (!t || !this.captureData.has(t)) return;
      const n = e.id;
      if (!n) return;
      const r = this.captureData.get(t);
      if (!r) return;
      await new Promise((s) => setTimeout(s, 500)), await this.startCaptureForTab(n, {
        maxCaptureTime: r.maxCaptureTime,
        inactivityTimeout: r.inactivityTimeout,
        includeStatic: r.includeStatic
      });
    } catch (t) {
      console.error("NetworkCaptureV2: Error extending capture to new tab:", t);
    }
  }
  shouldFilterRequest(e, t) {
    const n = String(e || "").toLowerCase();
    if (!n) return !1;
    if (vr.some((r) => n.includes(r)))
      return !0;
    if (!t)
      try {
        const s = new URL(e).pathname.toLowerCase();
        if (Rr.some((i) => s.endsWith(i)))
          return !0;
      } catch {
        return !1;
      }
    return !1;
  }
  shouldFilterByMimeType(e, t) {
    return !e || P.API_MIME_TYPES.some((n) => e.startsWith(n)) ? !1 : !!(!t && (P.STATIC_MIME_TYPES_TO_FILTER.some((n) => e.startsWith(n)) || e.startsWith("text/")));
  }
  updateLastActivityTime(e) {
    const t = this.captureData.get(e);
    t && (this.lastActivityTime.set(e, Date.now()), this.inactivityTimers.has(e) && clearTimeout(this.inactivityTimers.get(e)), t.inactivityTimeout > 0 && this.inactivityTimers.set(
      e,
      setTimeout(() => this.checkInactivity(e), t.inactivityTimeout)
    ));
  }
  checkInactivity(e) {
    const t = this.captureData.get(e);
    if (!t) return;
    const n = this.lastActivityTime.get(e) || t.startTime, s = Date.now() - n;
    if (s >= t.inactivityTimeout)
      this.stopCaptureByInactivity(e);
    else {
      const i = t.inactivityTimeout - s;
      this.inactivityTimers.set(
        e,
        setTimeout(() => this.checkInactivity(e), i)
      );
    }
  }
  async stopCaptureByInactivity(e) {
    this.captureData.get(e) && await this.stopCapture(e);
  }
  cleanupCapture(e) {
    this.captureTimers.has(e) && (clearTimeout(this.captureTimers.get(e)), this.captureTimers.delete(e)), this.inactivityTimers.has(e) && (clearTimeout(this.inactivityTimers.get(e)), this.inactivityTimers.delete(e)), this.lastActivityTime.delete(e), this.captureData.delete(e), this.requestCounters.delete(e);
  }
  setupListeners() {
    this.listeners.onBeforeRequest || (this.listeners.onBeforeRequest = (e) => {
      const t = this.captureData.get(e.tabId);
      if (!t || this.shouldFilterRequest(e.url, t.includeStatic)) return;
      const n = this.requestCounters.get(e.tabId) || 0;
      if (n >= P.MAX_REQUESTS_PER_CAPTURE) {
        t.limitReached = !0;
        return;
      }
      if (this.requestCounters.set(e.tabId, n + 1), this.updateLastActivityTime(e.tabId), !t.requests[e.requestId] && (t.requests[e.requestId] = {
        requestId: e.requestId,
        url: e.url,
        method: e.method,
        type: e.type,
        requestTime: e.timeStamp
      }, e.requestBody)) {
        const r = this.processRequestBody(e.requestBody);
        r && (t.requests[e.requestId].requestBody = r);
      }
    }, this.listeners.onSendHeaders = (e) => {
      const t = this.captureData.get(e.tabId);
      if (!(!t || !t.requests[e.requestId]) && e.requestHeaders) {
        const n = {};
        e.requestHeaders.forEach((r) => {
          n[r.name] = r.value || "";
        }), t.requests[e.requestId].requestHeaders = n;
      }
    }, this.listeners.onHeadersReceived = (e) => {
      var r, s;
      const t = this.captureData.get(e.tabId);
      if (!t || !t.requests[e.requestId]) return;
      const n = t.requests[e.requestId];
      if (n.status = e.statusCode, n.statusText = e.statusLine, n.responseTime = e.timeStamp, n.mimeType = (s = (r = e.responseHeaders) == null ? void 0 : r.find(
        (i) => i.name.toLowerCase() === "content-type"
      )) == null ? void 0 : s.value, n.mimeType && this.shouldFilterByMimeType(n.mimeType, t.includeStatic)) {
        delete t.requests[e.requestId];
        const i = this.requestCounters.get(e.tabId) || 0;
        i > 0 && this.requestCounters.set(e.tabId, i - 1);
        return;
      }
      if (e.responseHeaders) {
        const i = {};
        e.responseHeaders.forEach((c) => {
          i[c.name] = c.value || "";
        }), n.responseHeaders = i;
      }
      this.updateLastActivityTime(e.tabId);
    }, this.listeners.onCompleted = (e) => {
      const t = this.captureData.get(e.tabId);
      !t || !t.requests[e.requestId] || this.updateLastActivityTime(e.tabId);
    }, this.listeners.onErrorOccurred = (e) => {
      const t = this.captureData.get(e.tabId);
      !t || !t.requests[e.requestId] || (t.requests[e.requestId].errorText = e.error, this.updateLastActivityTime(e.tabId));
    }, chrome.webRequest.onBeforeRequest.addListener(
      this.listeners.onBeforeRequest,
      { urls: ["<all_urls>"] },
      ["requestBody"]
    ), chrome.webRequest.onSendHeaders.addListener(
      this.listeners.onSendHeaders,
      { urls: ["<all_urls>"] },
      ["requestHeaders"]
    ), chrome.webRequest.onHeadersReceived.addListener(
      this.listeners.onHeadersReceived,
      { urls: ["<all_urls>"] },
      ["responseHeaders"]
    ), chrome.webRequest.onCompleted.addListener(
      this.listeners.onCompleted,
      { urls: ["<all_urls>"] }
    ), chrome.webRequest.onErrorOccurred.addListener(
      this.listeners.onErrorOccurred,
      { urls: ["<all_urls>"] }
    ));
  }
  removeListeners() {
    this.captureData.size > 0 || (this.listeners.onBeforeRequest && chrome.webRequest.onBeforeRequest.removeListener(this.listeners.onBeforeRequest), this.listeners.onSendHeaders && chrome.webRequest.onSendHeaders.removeListener(this.listeners.onSendHeaders), this.listeners.onHeadersReceived && chrome.webRequest.onHeadersReceived.removeListener(this.listeners.onHeadersReceived), this.listeners.onCompleted && chrome.webRequest.onCompleted.removeListener(this.listeners.onCompleted), this.listeners.onErrorOccurred && chrome.webRequest.onErrorOccurred.removeListener(this.listeners.onErrorOccurred), this.listeners = {});
  }
  processRequestBody(e) {
    if (e.raw && e.raw.length > 0)
      return "[Binary data]";
    if (e.formData)
      return JSON.stringify(e.formData);
  }
  async startCaptureForTab(e, t) {
    const { maxCaptureTime: n, inactivityTimeout: r, includeStatic: s } = t;
    this.captureData.has(e) && await this.stopCapture(e);
    try {
      const i = await chrome.tabs.get(e);
      this.captureData.set(e, {
        tabId: e,
        tabUrl: i.url || "",
        tabTitle: i.title || "",
        startTime: Date.now(),
        requests: {},
        maxCaptureTime: n,
        inactivityTimeout: r,
        includeStatic: s,
        limitReached: !1
      }), this.requestCounters.set(e, 0), this.setupListeners(), this.updateLastActivityTime(e), n > 0 && this.captureTimers.set(
        e,
        setTimeout(async () => {
          await this.stopCapture(e);
        }, n)
      );
    } catch (i) {
      throw this.captureData.has(e) && this.cleanupCapture(e), i;
    }
  }
  async stopCapture(e) {
    const t = this.captureData.get(e);
    if (!t)
      return { success: !1, message: `No capture in progress for tab ${e}` };
    try {
      t.endTime = Date.now();
      const n = Object.values(t.requests), r = this.analyzeCommonHeaders(n, "requestHeaders"), s = this.analyzeCommonHeaders(n, "responseHeaders"), i = n.map((u) => {
        const l = { ...u };
        return l.requestHeaders ? (l.specificRequestHeaders = this.filterOutCommonHeaders(l.requestHeaders, r), delete l.requestHeaders) : l.specificRequestHeaders = {}, l.responseHeaders ? (l.specificResponseHeaders = this.filterOutCommonHeaders(l.responseHeaders, s), delete l.responseHeaders) : l.specificResponseHeaders = {}, l;
      });
      i.sort((u, l) => (u.requestTime || 0) - (l.requestTime || 0)), this.removeListeners();
      const c = {
        captureStartTime: t.startTime,
        captureEndTime: t.endTime,
        totalDurationMs: t.endTime - t.startTime,
        settingsUsed: {
          maxCaptureTime: t.maxCaptureTime,
          inactivityTimeout: t.inactivityTimeout,
          includeStatic: t.includeStatic,
          maxRequests: P.MAX_REQUESTS_PER_CAPTURE
        },
        commonRequestHeaders: r,
        commonResponseHeaders: s,
        requests: i,
        requestCount: i.length,
        totalRequestsReceived: this.requestCounters.get(e) || 0,
        requestLimitReached: t.limitReached || !1,
        tabUrl: t.tabUrl,
        tabTitle: t.tabTitle
      };
      return this.cleanupCapture(e), { success: !0, data: c };
    } catch (n) {
      return this.cleanupCapture(e), { success: !1, message: `Error stopping capture: ${n.message || String(n)}` };
    }
  }
  analyzeCommonHeaders(e, t) {
    if (!e || e.length === 0) return {};
    const n = {}, r = e.find(
      (c) => c[t] && Object.keys(c[t] || {}).length > 0
    );
    if (!r || !r[t])
      return {};
    const s = r[t], i = Object.keys(s);
    for (const c of i) {
      const u = s[c];
      e.every((d) => {
        const p = d[t];
        return p && p[c] === u;
      }) && (n[c] = u);
    }
    return n;
  }
  filterOutCommonHeaders(e, t) {
    if (!e || typeof e != "object") return {};
    const n = {};
    return Object.keys(e).forEach((r) => {
      (!(r in t) || e[r] !== t[r]) && (n[r] = e[r]);
    }), n;
  }
  async execute(e) {
    const {
      url: t,
      maxCaptureTime: n = 180 * 1e3,
      inactivityTimeout: r = 60 * 1e3,
      includeStatic: s = !1
    } = e;
    try {
      let i;
      if (t) {
        const c = await chrome.tabs.query({ url: t });
        c.length > 0 ? i = c[0] : (i = await chrome.tabs.create({ url: t, active: !0 }), await new Promise((u) => setTimeout(u, 1e3)));
      } else {
        const c = await chrome.tabs.query({ active: !0, currentWindow: !0 });
        if (!c[0])
          return m("No active tab found");
        i = c[0];
      }
      if (!(i != null && i.id))
        return m("Failed to identify or create a tab");
      try {
        await this.startCaptureForTab(i.id, { maxCaptureTime: n, inactivityTimeout: r, includeStatic: s });
      } catch (c) {
        return m(
          `Failed to start capture for tab ${i.id}: ${c.message || String(c)}`
        );
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: !0,
              message: "Network capture V2 started successfully, waiting for stop command.",
              tabId: i.id,
              url: i.url,
              maxCaptureTime: n,
              inactivityTimeout: r,
              includeStatic: s,
              maxRequests: P.MAX_REQUESTS_PER_CAPTURE
            })
          }
        ],
        isError: !1
      };
    } catch (i) {
      return m(`Error in NetworkCaptureStartTool: ${i.message || String(i)}`);
    }
  }
};
_(P, "instance", null), _(P, "MAX_REQUESTS_PER_CAPTURE", Ve.MAX_NETWORK_REQUESTS), _(P, "STATIC_MIME_TYPES_TO_FILTER", [
  "image/",
  "font/",
  "audio/",
  "video/",
  "text/css",
  "text/javascript",
  "application/javascript",
  "application/x-javascript",
  "application/pdf",
  "application/zip",
  "application/octet-stream"
]), _(P, "API_MIME_TYPES", [
  "application/json",
  "application/xml",
  "text/xml",
  "application/x-www-form-urlencoded",
  "application/graphql",
  "application/grpc",
  "application/protobuf",
  "application/x-protobuf",
  "application/x-json",
  "application/ld+json",
  "application/problem+json",
  "application/problem+xml",
  "application/soap+xml",
  "application/vnd.api+json"
]);
let ne = P;
const K = class K extends D {
  constructor() {
    super();
    _(this, "name", E.NETWORK_CAPTURE_STOP);
    if (K.instance)
      return K.instance;
    K.instance = this;
  }
  async execute() {
    var e, t, n, r, s, i, c, u, l, d, p, f, b, T;
    try {
      const g = ne.instance;
      if (!g)
        return m("Network capture V2 start tool instance not found");
      const h = Array.from(g.captureData.keys());
      if (h.length === 0)
        return m("No active network captures found in any tab.");
      const y = (e = (await chrome.tabs.query({ active: !0, currentWindow: !0 }))[0]) == null ? void 0 : e.id;
      let S;
      y && g.captureData.has(y) ? S = y : (h.length, S = h[0]);
      const C = await g.stopCapture(S);
      if (!C.success)
        return m(
          C.message || `Failed to stop network capture for tab ${S}`
        );
      if (h.length > 1) {
        const I = h.filter((x) => x !== S);
        for (const x of I)
          try {
            await g.stopCapture(x);
          } catch (R) {
            console.error(`NetworkCaptureStopTool: Error stopping capture on tab ${x}:`, R);
          }
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: !0,
              message: `Capture complete. ${((t = C.data) == null ? void 0 : t.requestCount) || 0} requests captured.`,
              tabId: S,
              tabUrl: ((n = C.data) == null ? void 0 : n.tabUrl) || "N/A",
              tabTitle: ((r = C.data) == null ? void 0 : r.tabTitle) || "Unknown Tab",
              requestCount: ((s = C.data) == null ? void 0 : s.requestCount) || 0,
              commonRequestHeaders: ((i = C.data) == null ? void 0 : i.commonRequestHeaders) || {},
              commonResponseHeaders: ((c = C.data) == null ? void 0 : c.commonResponseHeaders) || {},
              requests: ((u = C.data) == null ? void 0 : u.requests) || [],
              captureStartTime: (l = C.data) == null ? void 0 : l.captureStartTime,
              captureEndTime: (d = C.data) == null ? void 0 : d.captureEndTime,
              totalDurationMs: (p = C.data) == null ? void 0 : p.totalDurationMs,
              settingsUsed: ((f = C.data) == null ? void 0 : f.settingsUsed) || {},
              totalRequestsReceived: ((b = C.data) == null ? void 0 : b.totalRequestsReceived) || 0,
              requestLimitReached: ((T = C.data) == null ? void 0 : T.requestLimitReached) || !1,
              remainingCaptures: Array.from(g.captureData.keys())
            })
          }
        ],
        isError: !1
      };
    } catch (g) {
      return m(`Error in NetworkCaptureStopTool: ${g.message || String(g)}`);
    }
  }
};
_(K, "instance", null);
let le = K;
const He = new ne(), Ar = new le(), De = 1 * 1024 * 1024, Ir = 180 * 1e3, Dr = 60 * 1e3, $ = class $ extends D {
  constructor() {
    super();
    _(this, "name", E.NETWORK_DEBUGGER_START);
    _(this, "captureData", /* @__PURE__ */ new Map());
    _(this, "captureTimers", /* @__PURE__ */ new Map());
    _(this, "inactivityTimers", /* @__PURE__ */ new Map());
    _(this, "lastActivityTime", /* @__PURE__ */ new Map());
    _(this, "pendingResponseBodies", /* @__PURE__ */ new Map());
    _(this, "requestCounters", /* @__PURE__ */ new Map());
    if ($.instance)
      return $.instance;
    $.instance = this, chrome.debugger.onEvent.addListener(this.handleDebuggerEvent.bind(this)), chrome.debugger.onDetach.addListener(this.handleDebuggerDetach.bind(this)), chrome.tabs.onRemoved.addListener(this.handleTabRemoved.bind(this)), chrome.tabs.onCreated.addListener(this.handleTabCreated.bind(this));
  }
  handleTabRemoved(e) {
    this.captureData.has(e) && this.cleanupCapture(e);
  }
  async handleTabCreated(e) {
    try {
      if (this.captureData.size === 0) return;
      const t = e.openerTabId;
      if (!t || !this.captureData.has(t)) return;
      const n = e.id;
      if (!n) return;
      const r = this.captureData.get(t);
      if (!r) return;
      await new Promise((s) => setTimeout(s, 500)), await this.startCaptureForTab(n, {
        maxCaptureTime: r.maxCaptureTime,
        inactivityTimeout: r.inactivityTimeout,
        includeStatic: r.includeStatic
      });
    } catch (t) {
      console.error("NetworkDebuggerStartTool: Error extending capture to new tab:", t);
    }
  }
  async startCaptureForTab(e, t) {
    const { maxCaptureTime: n, inactivityTimeout: r, includeStatic: s } = t;
    this.captureData.has(e) && await this.stopCapture(e);
    try {
      const i = await chrome.tabs.get(e);
      await A.attach(e, "network-capture");
      try {
        await A.sendCommand(e, "Network.enable");
      } catch (c) {
        throw await A.detach(e, "network-capture").catch(() => {
        }), c;
      }
      this.captureData.set(e, {
        startTime: Date.now(),
        tabUrl: i.url,
        tabTitle: i.title,
        maxCaptureTime: n,
        inactivityTimeout: r,
        includeStatic: s,
        requests: {},
        limitReached: !1
      }), this.requestCounters.set(e, 0), this.updateLastActivityTime(e), n > 0 && this.captureTimers.set(
        e,
        setTimeout(async () => {
          await this.stopCapture(e, !0);
        }, n)
      );
    } catch (i) {
      throw this.captureData.has(e) && (await A.detach(e, "network-capture").catch(() => {
      }), this.cleanupCapture(e)), i;
    }
  }
  handleDebuggerEvent(e, t, n) {
    if (!e.tabId) return;
    const r = e.tabId;
    if (this.captureData.get(r))
      switch (this.updateLastActivityTime(r), t) {
        case "Network.requestWillBeSent":
          this.handleRequestWillBeSent(r, n);
          break;
        case "Network.responseReceived":
          this.handleResponseReceived(r, n);
          break;
        case "Network.loadingFinished":
          this.handleLoadingFinished(r, n);
          break;
        case "Network.loadingFailed":
          this.handleLoadingFailed(r, n);
          break;
      }
  }
  handleDebuggerDetach(e, t) {
    e.tabId && this.captureData.has(e.tabId) && this.cleanupCapture(e.tabId);
  }
  updateLastActivityTime(e) {
    this.lastActivityTime.set(e, Date.now());
    const t = this.captureData.get(e);
    t && t.inactivityTimeout > 0 && (this.inactivityTimers.has(e) && clearTimeout(this.inactivityTimers.get(e)), this.inactivityTimers.set(
      e,
      setTimeout(() => this.checkInactivity(e), t.inactivityTimeout)
    ));
  }
  checkInactivity(e) {
    const t = this.captureData.get(e);
    if (!t) return;
    const n = this.lastActivityTime.get(e) || t.startTime, r = Date.now() - n;
    if (r >= t.inactivityTimeout)
      this.stopCapture(e, !0);
    else {
      const s = Math.max(0, t.inactivityTimeout - r);
      this.inactivityTimers.set(
        e,
        setTimeout(() => this.checkInactivity(e), s)
      );
    }
  }
  shouldFilterRequestByUrl(e) {
    const t = String(e || "").toLowerCase();
    return t ? W.EXCLUDED_DOMAINS.some((n) => t.includes(n)) : !1;
  }
  shouldFilterRequestByExtension(e, t) {
    if (t) return !1;
    try {
      const r = new URL(e).pathname.toLowerCase();
      return W.STATIC_RESOURCE_EXTENSIONS.some((s) => r.endsWith(s));
    } catch {
      return !1;
    }
  }
  shouldFilterByMimeType(e, t) {
    return !e || W.API_MIME_TYPES.some((n) => e.startsWith(n)) || t ? !1 : W.STATIC_MIME_TYPES_TO_FILTER.some((n) => e.startsWith(n));
  }
  handleRequestWillBeSent(e, t) {
    const n = this.captureData.get(e);
    if (!n) return;
    const { requestId: r, request: s, timestamp: i, type: c } = t;
    if (this.shouldFilterRequestByUrl(s.url) || this.shouldFilterRequestByExtension(s.url, n.includeStatic))
      return;
    if ((this.requestCounters.get(e) || 0) >= $.MAX_REQUESTS_PER_CAPTURE) {
      n.limitReached = !0;
      return;
    }
    if (!n.requests[r])
      n.requests[r] = {
        requestId: r,
        url: s.url,
        method: s.method,
        requestHeaders: s.headers,
        requestTime: i * 1e3,
        type: c || "Other",
        status: "pending"
      }, s.postData && (n.requests[r].requestBody = s.postData);
    else {
      const l = n.requests[r];
      l.url = s.url, l.requestTime = i * 1e3, s.headers && (l.requestHeaders = s.headers), s.postData ? l.requestBody = s.postData : delete l.requestBody;
    }
  }
  handleResponseReceived(e, t) {
    const n = this.captureData.get(e);
    if (!n) return;
    const { requestId: r, response: s, timestamp: i, type: c } = t, u = n.requests[r];
    if (!u) return;
    if (this.shouldFilterByMimeType(s.mimeType, n.includeStatic)) {
      delete n.requests[r];
      return;
    }
    const l = Object.keys(n.requests).length;
    this.requestCounters.set(e, l), u.status = s.status === 0 ? "pending" : "complete", u.statusCode = s.status, u.statusText = s.statusText, u.responseHeaders = s.headers, u.mimeType = s.mimeType, u.responseTime = i * 1e3, c && (u.type = c);
  }
  async handleLoadingFinished(e, t) {
    const n = this.captureData.get(e);
    if (!n) return;
    const { requestId: r, encodedDataLength: s } = t, i = n.requests[r];
    if (i && (i.encodedDataLength = s, i.status === "pending" && (i.status = "complete"), this.shouldCaptureResponseBody(i)))
      try {
        const c = await this.getResponseBody(e, r);
        c && (c.body && c.body.length > De ? i.responseBody = c.body.substring(0, De) + `

... [Response truncated, total size: ${c.body.length} bytes] ...` : i.responseBody = c.body, i.base64Encoded = c.base64Encoded);
      } catch (c) {
        i.errorText = (i.errorText || "") + ` Failed to get body: ${c instanceof Error ? c.message : String(c)}`;
      }
  }
  shouldCaptureResponseBody(e) {
    const t = e.mimeType || "";
    if (W.API_MIME_TYPES.some((r) => t.startsWith(r)))
      return !0;
    const n = e.url.toLowerCase();
    return /\/(api|service|rest|graphql|query|data|rpc|v[0-9]+)\//i.test(n) || n.includes(".json") || n.includes("json=") || n.includes("format=json") ? !(t && W.STATIC_MIME_TYPES_TO_FILTER.some((r) => t.startsWith(r))) : !1;
  }
  handleLoadingFailed(e, t) {
    const n = this.captureData.get(e);
    if (!n) return;
    const { requestId: r, errorText: s, canceled: i, type: c } = t, u = n.requests[r];
    u && (u.status = "error", u.errorText = s, u.canceled = i, c && (u.type = c));
  }
  async getResponseBody(e, t) {
    const n = `${e}_${t}`;
    if (this.pendingResponseBodies.has(n))
      return this.pendingResponseBodies.get(n);
    const r = (async () => {
      try {
        return await A.sendCommand(e, "Network.getResponseBody", {
          requestId: t
        });
      } finally {
        this.pendingResponseBodies.delete(n);
      }
    })();
    return this.pendingResponseBodies.set(n, r), r;
  }
  cleanupCapture(e) {
    this.captureTimers.has(e) && (clearTimeout(this.captureTimers.get(e)), this.captureTimers.delete(e)), this.inactivityTimers.has(e) && (clearTimeout(this.inactivityTimers.get(e)), this.inactivityTimers.delete(e)), this.lastActivityTime.delete(e), this.captureData.delete(e), this.requestCounters.delete(e);
    const t = [];
    this.pendingResponseBodies.forEach((n, r) => {
      r.startsWith(`${e}_`) && t.push(r);
    }), t.forEach((n) => this.pendingResponseBodies.delete(n));
  }
  async stopCapture(e, t = !1) {
    const n = this.captureData.get(e);
    if (!n)
      return { success: !1, message: "No capture in progress for this tab." };
    try {
      try {
        await A.sendCommand(e, "Network.disable");
      } catch {
      }
      try {
        await A.detach(e, "network-capture");
      } catch {
      }
    } catch {
    }
    const r = Object.values(n.requests), s = this.analyzeCommonHeaders(r, "requestHeaders"), i = this.analyzeCommonHeaders(r, "responseHeaders"), c = r.map((l) => {
      const d = { ...l };
      return d.requestHeaders ? (d.specificRequestHeaders = this.filterOutCommonHeaders(d.requestHeaders, s), delete d.requestHeaders) : d.specificRequestHeaders = {}, d.responseHeaders ? (d.specificResponseHeaders = this.filterOutCommonHeaders(d.responseHeaders, i), delete d.responseHeaders) : d.specificResponseHeaders = {}, d;
    });
    c.sort((l, d) => (l.requestTime || 0) - (d.requestTime || 0));
    const u = {
      captureStartTime: n.startTime,
      captureEndTime: Date.now(),
      totalDurationMs: Date.now() - n.startTime,
      commonRequestHeaders: s,
      commonResponseHeaders: i,
      requests: c,
      requestCount: c.length,
      requestLimitReached: !!n.limitReached,
      stoppedBy: t ? "auto" : "user_request",
      tabUrl: n.tabUrl,
      tabTitle: n.tabTitle
    };
    return this.cleanupCapture(e), { success: !0, message: `Capture stopped. ${u.requestCount} requests.`, data: u };
  }
  analyzeCommonHeaders(e, t) {
    if (!e || e.length === 0) return {};
    const n = /* @__PURE__ */ new Map();
    let r = 0;
    for (const i of e) {
      const c = i[t];
      if (c && Object.keys(c).length > 0) {
        r++;
        for (const u in c) {
          const l = u.toLowerCase(), d = c[u];
          n.has(l) || n.set(l, /* @__PURE__ */ new Map());
          const p = n.get(l);
          p.set(d, (p.get(d) || 0) + 1);
        }
      }
    }
    if (r === 0) return {};
    const s = {};
    return n.forEach((i, c) => {
      i.forEach((u, l) => {
        if (u === r) {
          let d = c;
          for (const p of e) {
            const f = p[t];
            if (f) {
              const b = Object.keys(f).find((T) => T.toLowerCase() === c);
              if (b) {
                d = b;
                break;
              }
            }
          }
          s[d] = l;
        }
      });
    }), s;
  }
  filterOutCommonHeaders(e, t) {
    if (!e || typeof e != "object") return {};
    const n = {};
    Object.keys(t).forEach((s) => {
      n[s.toLowerCase()] = t[s];
    });
    const r = {};
    return Object.keys(e).forEach((s) => {
      const i = s.toLowerCase();
      (!(i in n) || e[s] !== n[i]) && (r[s] = e[s]);
    }), r;
  }
  async execute(e) {
    var c, u;
    const {
      url: t,
      maxCaptureTime: n = Ir,
      inactivityTimeout: r = Dr,
      includeStatic: s = !1
    } = e;
    let i;
    try {
      if (t) {
        const d = await chrome.tabs.query({
          url: t.startsWith("http") ? t : `*://*/*${t}*`
        });
        d.length > 0 && ((c = d[0]) != null && c.id) ? (i = d[0], await chrome.windows.update(i.windowId, { focused: !0 }), await chrome.tabs.update(i.id, { active: !0 })) : (i = await chrome.tabs.create({ url: t, active: !0 }), await new Promise((p) => setTimeout(p, 500)));
      } else {
        const d = await chrome.tabs.query({ active: !0, currentWindow: !0 });
        if (d.length > 0 && ((u = d[0]) != null && u.id))
          i = d[0];
        else
          return m("No active tab found and no URL provided.");
      }
      if (!(i != null && i.id))
        return m("Failed to identify or create a target tab.");
      const l = i.id;
      try {
        await this.startCaptureForTab(l, { maxCaptureTime: n, inactivityTimeout: r, includeStatic: s });
      } catch (d) {
        return m(`Failed to start capture for tab ${l}: ${d.message || String(d)}`);
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: !0,
              message: `Network capture started on tab ${l}. Waiting for stop command or timeout.`,
              tabId: l,
              url: i.url,
              maxCaptureTime: n,
              inactivityTimeout: r,
              includeStatic: s,
              maxRequests: $.MAX_REQUESTS_PER_CAPTURE
            })
          }
        ],
        isError: !1
      };
    } catch (l) {
      const d = i == null ? void 0 : i.id;
      return d && this.captureData.has(d) && (await A.detach(d, "network-capture").catch(() => {
      }), this.cleanupCapture(d)), m(`Error in NetworkDebuggerStartTool: ${l.message || String(l)}`);
    }
  }
};
_($, "MAX_REQUESTS_PER_CAPTURE", 100), _($, "instance", null);
let se = $;
const V = class V extends D {
  constructor() {
    super();
    _(this, "name", E.NETWORK_DEBUGGER_STOP);
    if (V.instance)
      return V.instance;
    V.instance = this;
  }
  async execute() {
    var c;
    const e = se.instance;
    if (!e)
      return m("NetworkDebuggerStartTool instance not available. Cannot stop capture.");
    const t = Array.from(e.captureData.keys());
    if (t.length === 0)
      return m("No active network captures found in any tab.");
    const r = (c = (await chrome.tabs.query({ active: !0, currentWindow: !0 }))[0]) == null ? void 0 : c.id;
    let s;
    r && e.captureData.has(r) ? s = r : (t.length, s = t[0]);
    const i = await this.performStop(e, s);
    if (t.length > 1) {
      const u = t.filter((l) => l !== s);
      for (const l of u)
        try {
          await e.stopCapture(l);
        } catch (d) {
          console.error(`NetworkDebuggerStopTool: Error stopping capture on tab ${l}:`, d);
        }
    }
    return i;
  }
  async performStop(e, t) {
    const n = await e.stopCapture(t);
    if (!(n != null && n.success))
      return m(
        (n == null ? void 0 : n.message) || `Failed to stop network capture for tab ${t}.`
      );
    const r = n.data || {};
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: !0,
            message: `Capture for tab ${t} stopped. ${r.requestCount || 0} requests captured.`,
            tabId: t,
            tabUrl: r.tabUrl || "N/A",
            tabTitle: r.tabTitle || "Unknown Tab",
            requestCount: r.requestCount || 0,
            commonRequestHeaders: r.commonRequestHeaders || {},
            commonResponseHeaders: r.commonResponseHeaders || {},
            requests: r.requests || [],
            captureStartTime: r.captureStartTime,
            captureEndTime: r.captureEndTime,
            totalDurationMs: r.totalDurationMs,
            remainingCaptures: Array.from(e.captureData.keys()),
            requestLimitReached: r.requestLimitReached || !1
          })
        }
      ],
      isError: !1
    };
  }
};
_(V, "instance", null);
let de = V;
const We = new se(), kr = new de();
function Nr(a) {
  var e;
  const o = (e = a.content) == null ? void 0 : e[0];
  return o && o.type === "text" ? o.text : void 0;
}
function ke(a, o) {
  const e = Nr(a);
  if (typeof e != "string") return a;
  try {
    const t = JSON.parse(e);
    if (t && typeof t == "object" && !Array.isArray(t))
      return {
        ...a,
        content: [{ type: "text", text: JSON.stringify({ ...t, ...o }) }]
      };
  } catch {
  }
  return a;
}
function Or() {
  const a = We.captureData;
  return a instanceof Map && a.size > 0;
}
function Lr() {
  return He.captureData.size > 0;
}
class Mr extends D {
  constructor() {
    super(...arguments);
    _(this, "name", E.NETWORK_CAPTURE);
  }
  async execute(e) {
    const t = e == null ? void 0 : e.action;
    if (t !== "start" && t !== "stop")
      return m("Parameter [action] is required and must be one of: start, stop");
    const n = (e == null ? void 0 : e.needResponseBody) === !0, r = Or(), s = Lr();
    return t === "start" ? this.handleStart(e, n, r, s) : this.handleStop(e, r, s);
  }
  async handleStart(e, t, n, r) {
    if (n || r)
      return m(
        `Network capture is already active in ${n ? "debugger" : "webRequest"} mode. Stop it before starting a new capture.`
      );
    const s = t ? We : He, i = t ? "debugger" : "webRequest", c = await s.execute({
      url: e.url,
      maxCaptureTime: e.maxCaptureTime,
      inactivityTimeout: e.inactivityTimeout,
      includeStatic: e.includeStatic
    });
    return ke(c, { backend: i, needResponseBody: t });
  }
  async handleStop(e, t, n) {
    let r = null;
    if ((e == null ? void 0 : e.needResponseBody) === !0 ? r = t ? "debugger" : null : (e == null ? void 0 : e.needResponseBody) === !1 && (r = n ? "webRequest" : null), r || (t ? r = "debugger" : n && (r = "webRequest")), !r)
      return m("No active network captures found in any tab.");
    const i = await (r === "debugger" ? kr : Ar).execute();
    return ke(i, {
      backend: r,
      needResponseBody: r === "debugger"
    });
  }
}
const Pr = new Mr();
class qr extends D {
  constructor() {
    super(...arguments);
    _(this, "name", E.FILE_UPLOAD);
  }
  async execute(e) {
    const { selector: t, filePath: n, fileUrl: r, base64Data: s, fileName: i, multiple: c = !1 } = e;
    if (console.log("Starting file upload operation with options:", e), !t)
      return m("Selector is required for file upload");
    if (!n && !r && !s)
      return m("One of filePath, fileUrl, or base64Data must be provided");
    try {
      const l = await this.tryGetTab(e.tabId) || await this.getActiveTabOrThrowInWindow(e.windowId);
      if (!l.id) return m("No active tab found");
      const d = l.id;
      let p = [];
      if (n)
        p = [n];
      else if (r || s) {
        const f = await this.prepareFileFromRemote({
          fileUrl: r,
          base64Data: s,
          fileName: i || "uploaded-file"
        });
        if (!f)
          return m("Failed to prepare file for upload");
        p = [f];
      }
      return await A.withSession(d, "file-upload", async () => {
        await A.sendCommand(d, "DOM.enable", {}), await A.sendCommand(d, "Runtime.enable", {});
        const { root: f } = await A.sendCommand(d, "DOM.getDocument", {
          depth: -1,
          pierce: !0
        }), { nodeId: b } = await A.sendCommand(d, "DOM.querySelector", {
          nodeId: f.nodeId,
          selector: t
        });
        if (!b || b === 0)
          throw new Error(`Element with selector "${t}" not found`);
        const { node: T } = await A.sendCommand(d, "DOM.describeNode", {
          nodeId: b
        });
        if (T.nodeName !== "INPUT")
          throw new Error(`Element with selector "${t}" is not an input element`);
        const g = T.attributes || [];
        let h = !1;
        for (let w = 0; w < g.length; w += 2)
          if (g[w] === "type" && g[w + 1] === "file") {
            h = !0;
            break;
          }
        if (!h)
          throw new Error(`Element with selector "${t}" is not a file input (type="file")`);
        await A.sendCommand(d, "DOM.setFileInputFiles", {
          nodeId: b,
          files: p
        }), await A.sendCommand(d, "Runtime.evaluate", {
          expression: `
            (function() {
              const element = document.querySelector('${t.replace(/'/g, "\\'")}');
              if (element) {
                const event = new Event('change', { bubbles: true });
                element.dispatchEvent(event);
                return true;
              }
              return false;
            })()
          `
        });
      }), {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: !0,
              message: "File(s) uploaded successfully",
              files: p,
              selector: t,
              fileCount: p.length
            })
          }
        ],
        isError: !1
      };
    } catch (u) {
      return console.error("Error in file upload operation:", u), m(
        `Error uploading file: ${u instanceof Error ? u.message : String(u)}`
      );
    }
  }
  async prepareFileFromRemote(e) {
    const { fileUrl: t, base64Data: n, fileName: r } = e;
    return new Promise((s) => {
      const i = `file-upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, c = setTimeout(() => {
        console.error("File preparation request timed out"), s(null);
      }, 3e4), u = (l) => {
        var d, p, f;
        l.type === "file_operation_response" && l.responseToRequestId === i && (clearTimeout(c), chrome.runtime.onMessage.removeListener(u), (d = l.payload) != null && d.success && ((p = l.payload) != null && p.filePath) ? s(l.payload.filePath) : (console.error(
          "Native host failed to prepare file:",
          l.error || ((f = l.payload) == null ? void 0 : f.error)
        ), s(null)));
      };
      chrome.runtime.onMessage.addListener(u), chrome.runtime.sendMessage({
        type: "forward_to_native",
        message: {
          type: "file_operation",
          requestId: i,
          payload: {
            action: "prepareFile",
            fileUrl: t,
            base64Data: n,
            fileName: r
          }
        }
      }).catch((l) => {
        console.error("Error sending message to background:", l), clearTimeout(c), chrome.runtime.onMessage.removeListener(u), s(null);
      });
    });
  }
}
const Ur = new qr(), H = /* @__PURE__ */ new Map();
class Fr extends D {
  constructor() {
    super(...arguments);
    _(this, "name", E.INJECT_SCRIPT);
  }
  async execute(e) {
    try {
      const { url: t, type: n, jsScript: r, tabId: s, windowId: i, background: c } = e;
      let u;
      if (!n || !r)
        return m("Param [type] and [jsScript] is required");
      if (typeof s == "number")
        u = await chrome.tabs.get(s);
      else if (t) {
        const p = (await chrome.tabs.query({})).filter((f) => {
          var g;
          const b = (g = f.url) != null && g.endsWith("/") ? f.url.slice(0, -1) : f.url, T = t.endsWith("/") ? t.slice(0, -1) : t;
          return b === T;
        });
        p.length > 0 ? u = p[0] : (u = await chrome.tabs.create({
          url: t,
          active: c !== !0,
          windowId: i
        }), await new Promise((f) => setTimeout(f, 3e3)));
      } else {
        const d = typeof i == "number" ? await chrome.tabs.query({ active: !0, windowId: i }) : await chrome.tabs.query({ active: !0, currentWindow: !0 });
        if (!d[0])
          return m("No active tab found");
        u = d[0];
      }
      if (!u.id)
        return m("Tab has no ID");
      c !== !0 && (await chrome.tabs.update(u.id, { active: !0 }), await chrome.windows.update(u.windowId, { focused: !0 }));
      const l = await Wr(u.id, { ...e });
      return {
        content: [{ type: "text", text: JSON.stringify(l) }],
        isError: !1
      };
    } catch (t) {
      return console.error("Error in InjectScriptTool.execute:", t), m(
        `Inject script error: ${t instanceof Error ? t.message : String(t)}`
      );
    }
  }
}
class $r extends D {
  constructor() {
    super(...arguments);
    _(this, "name", E.SEND_COMMAND_TO_INJECT_SCRIPT);
  }
  async execute(e) {
    try {
      const { tabId: t, eventName: n, payload: r } = e;
      if (!n)
        return m("Param [eventName] is required");
      if (t && !await Hr(t))
        return m("The tab:[tabId] is not exists");
      let s = t;
      if (s === void 0) {
        const c = await chrome.tabs.query({ active: !0 });
        if (!c[0])
          return m("No active tab found");
        s = c[0].id;
      }
      if (!s)
        return m("No active tab found");
      if (!H.has(s))
        throw new Error("No script injected in this tab.");
      const i = await chrome.tabs.sendMessage(s, {
        action: n,
        payload: r,
        targetWorld: H.get(s).type
      });
      return {
        content: [{ type: "text", text: JSON.stringify(i) }],
        isError: !1
      };
    } catch (t) {
      return console.error("Error in SendCommandToInjectScriptTool.execute:", t), m(
        `Inject script error: ${t instanceof Error ? t.message : String(t)}`
      );
    }
  }
}
async function Hr(a) {
  try {
    return await chrome.tabs.get(a), !0;
  } catch {
    return !1;
  }
}
async function Wr(a, o) {
  H.has(a) && await Br(a);
  const { type: e, jsScript: t } = o;
  return e === X.MAIN ? (await chrome.scripting.executeScript({
    target: { tabId: a },
    files: ["inject-scripts/inject-bridge.js"],
    world: X.ISOLATED
  }), await chrome.scripting.executeScript({
    target: { tabId: a },
    // eslint-disable-next-line no-new-func
    func: (r) => Function(r)(),
    args: [t],
    world: X.MAIN
  })) : await chrome.scripting.executeScript({
    target: { tabId: a },
    // eslint-disable-next-line no-new-func
    func: (r) => Function(r)(),
    args: [t],
    world: X.ISOLATED
  }), H.set(a, o), { injected: !0 };
}
async function Br(a) {
  H.has(a) && (chrome.tabs.sendMessage(a, { type: "chrome-mcp:cleanup" }).catch(() => {
  }), H.delete(a));
}
const jr = new Fr(), Gr = new $r();
chrome.tabs.onRemoved.addListener((a) => {
  H.has(a) && H.delete(a);
});
const Kr = /* @__PURE__ */ new Map([
  [E.GET_WINDOWS_AND_TABS, Je],
  [E.NAVIGATE, Qe],
  [E.SCREENSHOT, Nt],
  [E.CLOSE_TABS, et],
  [E.SWITCH_TAB, rt],
  [E.WEB_FETCHER, Tr],
  [E.CLICK, gr],
  [E.FILL, wr],
  [E.GET_INTERACTIVE_ELEMENTS, Sr],
  [E.NETWORK_CAPTURE, Pr],
  [E.NETWORK_REQUEST, _r],
  [E.KEYBOARD, st],
  [E.HISTORY, at],
  [E.BOOKMARK_SEARCH, ft],
  [E.BOOKMARK_ADD, mt],
  [E.BOOKMARK_DELETE, ht],
  [E.JAVASCRIPT, sr],
  [E.CONSOLE, mr],
  [E.FILE_UPLOAD, Ur],
  [E.READ_PAGE, Lt],
  [E.HANDLE_DIALOG, Tt],
  [E.HANDLE_DOWNLOAD, Ct],
  [E.INJECT_SCRIPT, jr],
  [E.SEND_COMMAND_TO_INJECT_SCRIPT, Gr]
]), Vr = [
  {
    name: E.GET_WINDOWS_AND_TABS,
    description: "Get all currently open browser windows and tabs",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: E.NAVIGATE,
    description: "Navigate to a URL, refresh the current tab, or navigate browser history (back/forward)",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: 'URL to navigate to. Special values: "back" or "forward" to navigate browser history.' },
        newWindow: { type: "boolean", description: "Create a new window (default: false)" },
        tabId: { type: "number", description: "Target an existing tab by ID" },
        windowId: { type: "number", description: "Target window by ID" },
        background: { type: "boolean", description: "Do not steal focus (default: false)" },
        width: { type: "number", description: "Window width in pixels (default: 1280)" },
        height: { type: "number", description: "Window height in pixels (default: 720)" },
        refresh: { type: "boolean", description: "Refresh current tab (default: false)" }
      },
      required: []
    }
  },
  {
    name: E.SCREENSHOT,
    description: "Take a screenshot of the current page or a specific element",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name for the screenshot" },
        selector: { type: "string", description: "CSS selector for element to screenshot" },
        tabId: { type: "number", description: "Target tab ID" },
        windowId: { type: "number", description: "Target window ID" },
        background: { type: "boolean", description: "Capture without bringing to foreground (default: false)" },
        width: { type: "number", description: "Width in pixels (default: 800)" },
        height: { type: "number", description: "Height in pixels (default: 600)" },
        storeBase64: { type: "boolean", description: "Return screenshot in base64 (default: false)" },
        fullPage: { type: "boolean", description: "Capture entire page (default: true)" },
        savePng: { type: "boolean", description: "Save as PNG file (default: true)" }
      },
      required: []
    }
  },
  {
    name: E.CLOSE_TABS,
    description: "Close one or more browser tabs",
    inputSchema: {
      type: "object",
      properties: {
        tabIds: { type: "array", items: { type: "number" }, description: "Array of tab IDs to close" },
        url: { type: "string", description: "Close tabs matching this URL" }
      },
      required: []
    }
  },
  {
    name: E.SWITCH_TAB,
    description: "Switch to a specific browser tab",
    inputSchema: {
      type: "object",
      properties: {
        tabId: { type: "number", description: "The ID of the tab to switch to" },
        windowId: { type: "number", description: "The window ID" }
      },
      required: ["tabId"]
    }
  },
  {
    name: E.WEB_FETCHER,
    description: "Fetch content from a web page",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to fetch from (default: active tab)" },
        tabId: { type: "number", description: "Target tab by ID" },
        background: { type: "boolean", description: "Do not activate tab (default: false)" },
        htmlContent: { type: "boolean", description: "Get HTML content (default: false)" },
        textContent: { type: "boolean", description: "Get text content (default: true)" },
        selector: { type: "string", description: "CSS selector for specific element" }
      },
      required: []
    }
  },
  {
    name: E.CLICK,
    description: "Click on an element in a web page. Supports CSS selector, XPath, element ref, or viewport coordinates.",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector or XPath for the element" },
        selectorType: { type: "string", enum: ["css", "xpath"], description: 'Type of selector (default: "css")' },
        ref: { type: "string", description: "Element ref from chrome_read_page" },
        coordinates: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, description: "Viewport coordinates" },
        double: { type: "boolean", description: "Double click (default: false)" },
        button: { type: "string", enum: ["left", "right", "middle"], description: 'Mouse button (default: "left")' },
        modifiers: { type: "object", properties: { altKey: { type: "boolean" }, ctrlKey: { type: "boolean" }, metaKey: { type: "boolean" }, shiftKey: { type: "boolean" } } },
        waitForNavigation: { type: "boolean", description: "Wait for navigation after click (default: false)" },
        timeout: { type: "number", description: "Timeout in ms (default: 5000)" },
        tabId: { type: "number", description: "Target tab ID" },
        windowId: { type: "number", description: "Window ID" },
        frameId: { type: "number", description: "Target frame ID" }
      },
      required: []
    }
  },
  {
    name: E.FILL,
    description: "Fill or select a form element on a web page",
    inputSchema: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector or XPath" },
        selectorType: { type: "string", enum: ["css", "xpath"], description: 'Type of selector (default: "css")' },
        ref: { type: "string", description: "Element ref from chrome_read_page" },
        value: { type: ["string", "number", "boolean"], description: "Value to fill" },
        tabId: { type: "number", description: "Target tab ID" },
        windowId: { type: "number", description: "Window ID" },
        frameId: { type: "number", description: "Target frame ID" }
      },
      required: ["value"]
    }
  },
  {
    name: E.GET_INTERACTIVE_ELEMENTS,
    description: "Get interactive elements on the current page",
    inputSchema: {
      type: "object",
      properties: {
        tabId: { type: "number", description: "Target tab ID" },
        windowId: { type: "number", description: "Window ID" }
      },
      required: []
    }
  },
  {
    name: E.NETWORK_CAPTURE,
    description: 'Unified network capture tool. Use action="start" to begin capturing, action="stop" to end and retrieve results.',
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["start", "stop"], description: 'Action: "start" or "stop"' },
        needResponseBody: { type: "boolean", description: "Capture response body via Debugger API (default: false)" },
        url: { type: "string", description: "URL to capture from (default: active tab)" },
        maxCaptureTime: { type: "number", description: "Max capture time in ms (default: 180000)" },
        inactivityTimeout: { type: "number", description: "Stop after inactivity in ms (default: 60000)" },
        includeStatic: { type: "boolean", description: "Include static resources (default: false)" }
      },
      required: ["action"]
    }
  },
  {
    name: E.NETWORK_REQUEST,
    description: "Send a network request from the browser with cookies and browser context",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to send request to" },
        method: { type: "string", description: "HTTP method (default: GET)" },
        headers: { type: "object", description: "Request headers" },
        body: { type: "string", description: "Request body" },
        timeout: { type: "number", description: "Timeout in ms (default: 30000)" },
        formData: { type: "object", description: "Multipart/form-data descriptor" }
      },
      required: ["url"]
    }
  },
  {
    name: E.KEYBOARD,
    description: "Simulate keyboard input on a web page",
    inputSchema: {
      type: "object",
      properties: {
        keys: { type: "string", description: "Keys or key combinations to simulate" },
        selector: { type: "string", description: "CSS selector or XPath for target element" },
        selectorType: { type: "string", enum: ["css", "xpath"], description: 'Type of selector (default: "css")' },
        delay: { type: "number", description: "Delay between keystrokes in ms (default: 50)" },
        tabId: { type: "number", description: "Target tab ID" },
        windowId: { type: "number", description: "Window ID" },
        frameId: { type: "number", description: "Target frame ID" }
      },
      required: ["keys"]
    }
  },
  {
    name: E.HISTORY,
    description: "Retrieve and search browsing history from Chrome",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to search for in history URLs and titles" },
        startTime: { type: "string", description: "Start time (ISO, relative, or keyword). Default: 24h ago" },
        endTime: { type: "string", description: "End time (ISO, relative, or keyword). Default: now" },
        maxResults: { type: "number", description: "Max history entries to return (default: 100)" },
        excludeCurrentTabs: { type: "boolean", description: "Exclude currently open URLs (default: false)" }
      },
      required: []
    }
  },
  {
    name: E.BOOKMARK_SEARCH,
    description: "Search Chrome bookmarks by title and URL",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        maxResults: { type: "number", description: "Max results (default: 50)" },
        folderPath: { type: "string", description: "Folder path or ID to limit search" }
      },
      required: []
    }
  },
  {
    name: E.BOOKMARK_ADD,
    description: "Add a new bookmark to Chrome",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to bookmark (default: active tab)" },
        title: { type: "string", description: "Bookmark title" },
        parentId: { type: "string", description: "Parent folder path or ID" },
        createFolder: { type: "boolean", description: "Create parent folder if missing (default: false)" }
      },
      required: []
    }
  },
  {
    name: E.BOOKMARK_DELETE,
    description: "Delete a bookmark from Chrome",
    inputSchema: {
      type: "object",
      properties: {
        bookmarkId: { type: "string", description: "Bookmark ID" },
        url: { type: "string", description: "Bookmark URL (used if ID not provided)" },
        title: { type: "string", description: "Title for matching when deleting by URL" }
      },
      required: []
    }
  },
  {
    name: E.JAVASCRIPT,
    description: "Execute JavaScript code in a browser tab and return the result",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "JavaScript code to execute" },
        tabId: { type: "number", description: "Target tab ID" },
        timeoutMs: { type: "number", description: "Execution timeout in ms (default: 15000)" },
        maxOutputBytes: { type: "number", description: "Max output size in bytes (default: 51200)" }
      },
      required: ["code"]
    }
  },
  {
    name: E.CONSOLE,
    description: "Capture console output from a browser tab. Supports snapshot and buffer modes.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to navigate to and capture from" },
        tabId: { type: "number", description: "Target tab ID" },
        windowId: { type: "number", description: "Target window ID" },
        background: { type: "boolean", description: "Do not activate tab (default: false)" },
        includeExceptions: { type: "boolean", description: "Include uncaught exceptions (default: true)" },
        maxMessages: { type: "number", description: "Max messages in snapshot mode (default: 100)" },
        mode: { type: "string", enum: ["snapshot", "buffer"], description: "Capture mode (default: snapshot)" },
        buffer: { type: "boolean", description: 'Alias for mode="buffer"' },
        clear: { type: "boolean", description: "Buffer mode: clear before reading (default: false)" },
        clearAfterRead: { type: "boolean", description: "Buffer mode: clear after reading (default: false)" },
        pattern: { type: "string", description: "Regex filter for messages" },
        onlyErrors: { type: "boolean", description: "Only error-level messages (default: false)" },
        limit: { type: "number", description: "Limit returned messages" }
      },
      required: []
    }
  },
  {
    name: E.FILE_UPLOAD,
    description: "Upload files to web forms with file input elements",
    inputSchema: {
      type: "object",
      properties: {
        tabId: { type: "number", description: "Target tab ID" },
        windowId: { type: "number", description: "Target window ID" },
        selector: { type: "string", description: "CSS selector for file input element" },
        filePath: { type: "string", description: "Local file path to upload" },
        fileUrl: { type: "string", description: "URL to download file from" },
        base64Data: { type: "string", description: "Base64 encoded file data" },
        fileName: { type: "string", description: 'Filename (default: "uploaded-file")' },
        multiple: { type: "boolean", description: "Accept multiple files (default: false)" }
      },
      required: ["selector"]
    }
  },
  {
    name: E.READ_PAGE,
    description: "Get an accessibility tree representation of visible elements on the page",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: 'Filter: "interactive" for buttons/links/inputs only' },
        depth: { type: "number", description: "Maximum DOM depth to traverse" },
        refId: { type: "string", description: "Focus on subtree rooted at this element refId" },
        tabId: { type: "number", description: "Target tab ID" },
        windowId: { type: "number", description: "Target window ID" }
      },
      required: []
    }
  },
  {
    name: E.HANDLE_DIALOG,
    description: "Handle JavaScript dialogs (alert/confirm/prompt) via CDP",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", description: "accept | dismiss" },
        promptText: { type: "string", description: "Optional prompt text when accepting" }
      },
      required: ["action"]
    }
  },
  {
    name: E.HANDLE_DOWNLOAD,
    description: "Wait for a browser download and return details",
    inputSchema: {
      type: "object",
      properties: {
        filenameContains: { type: "string", description: "Filter by substring in filename or URL" },
        timeoutMs: { type: "number", description: "Timeout in ms (default: 60000, max: 300000)" },
        waitForComplete: { type: "boolean", description: "Wait until completed (default: true)" }
      },
      required: []
    }
  }
];
function Yr() {
  return Vr;
}
async function zr(a, o) {
  const e = Kr.get(a);
  return e ? e.execute(o) : {
    content: [{ type: "text", text: `Unknown tool: ${a}` }],
    isError: !0
  };
}
const Ne = "ws://127.0.0.1:12307", pe = "ws-keepalive", Jr = 0.33, Be = "ws-reconnect";
let M = null, re = 1e3;
const Xr = 3e4;
function Q(a) {
  return !M || M.readyState !== WebSocket.OPEN ? !1 : (M.send(JSON.stringify(a)), !0);
}
async function Qr(a) {
  let o;
  try {
    o = JSON.parse(a);
  } catch {
    return;
  }
  if (o.type === "ping") {
    Q({ type: "pong" });
    return;
  }
  if (o.type === "list_tools") {
    const e = Yr();
    Q({ type: "tool_list", id: o.id, tools: e });
    return;
  }
  if (o.type === "call_tool") {
    try {
      const e = await zr(o.name, o.args || {});
      Q({ type: "tool_result", id: o.id, content: e.content, isError: e.isError });
    } catch (e) {
      Q({
        type: "tool_result",
        id: o.id,
        content: [{ type: "text", text: `Tool execution error: ${e instanceof Error ? e.message : String(e)}` }],
        isError: !0
      });
    }
    return;
  }
}
function Oe() {
  chrome.alarms.create(Be, { delayInMinutes: re / 6e4 }), re = Math.min(re * 2, Xr);
}
function Z() {
  if (!(M && (M.readyState === WebSocket.OPEN || M.readyState === WebSocket.CONNECTING))) {
    try {
      M = new WebSocket(Ne);
    } catch {
      console.warn("[WS] Failed to create WebSocket, scheduling reconnect"), Oe();
      return;
    }
    M.onopen = () => {
      console.log("[WS] Connected to", Ne), re = 1e3, chrome.alarms.create(pe, { periodInMinutes: Jr });
    }, M.onmessage = (a) => {
      Qr(typeof a.data == "string" ? a.data : String(a.data));
    }, M.onclose = () => {
      console.log("[WS] Disconnected"), M = null, chrome.alarms.clear(pe), Oe();
    }, M.onerror = (a) => {
      console.warn("[WS] Error:", a);
    };
  }
}
function Zr(a) {
  if (a.name === pe) {
    (M == null ? void 0 : M.readyState) === WebSocket.OPEN ? Q({ type: "pong" }) : Z();
    return;
  }
  if (a.name === Be) {
    Z();
    return;
  }
}
console.log("[Agy] Background service worker starting...");
Z();
chrome.runtime.onInstalled.addListener(() => {
  console.log("[Agy] Extension installed/updated, connecting..."), Z();
});
chrome.alarms.onAlarm.addListener(Zr);
chrome.runtime.onStartup.addListener(() => {
  console.log("[Agy] Browser startup, connecting..."), Z();
});
