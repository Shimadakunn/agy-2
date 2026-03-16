import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chatTabContext } from "../tab-context";

export const execFile = promisify(execFileCb);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localBin = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "node_modules",
  ".bin",
  "agent-browser",
);

let bin = "";
let browserConnected = false;

// ── Helpers ──

export function strip(s: string): string {
  return s.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "").trim();
}

export function ok(result: string) {
  return { status: "success" as const, result };
}

export function fail(err: unknown) {
  return {
    status: "error" as const,
    error: err instanceof Error ? err.message : String(err),
  };
}

// ── Binary Resolution ──

export async function resolveBin(): Promise<string> {
  if (bin) return bin;
  for (const candidate of [
    localBin,
    "agent-browser",
    `${process.env.HOME}/Library/pnpm/agent-browser`,
  ]) {
    try {
      await execFile(candidate, ["--version"], { timeout: 5000 });
      bin = candidate;
      return bin;
    } catch {}
  }
  throw new Error(
    "agent-browser binary not found. Run: pnpm add agent-browser",
  );
}

// ── Browser Detection ──

export async function detectBrowser(): Promise<boolean> {
  try {
    const binary = await resolveBin();
    const { stdout } = await execFile(
      binary,
      ["--auto-connect", "get", "cdp-url"],
      { timeout: 10_000 },
    );
    return strip(stdout).startsWith("ws://");
  } catch {
    return false;
  }
}

export function isBrowserReady() {
  return browserConnected;
}
export function setBrowserReady(ready: boolean) {
  browserConnected = ready;
}

// ── Command Execution ──

export async function runRaw(
  args: string[],
  timeout = 30_000,
): Promise<string> {
  const binary = await resolveBin();
  if (!browserConnected) browserConnected = await detectBrowser();

  try {
    const { stdout } = await execFile(binary, args, {
      timeout,
      env: { ...process.env, AGENT_BROWSER_DEBUG: "1" },
    });
    return strip(stdout);
  } catch (err: any) {
    const out = strip(err.stdout || "");
    const errMsg = strip(err.stderr || "");

    if (out && !out.includes("Failed to connect")) return out;

    if (
      errMsg.includes("Failed to connect") ||
      out.includes("Failed to connect")
    )
      browserConnected = false;

    throw new Error(
      out || errMsg || (err instanceof Error ? err.message : String(err)),
    );
  }
}

// ── Per-chat Multi-tab Browser Management via CDP ──

export interface CdpTarget {
  id: string;
  url: string;
  type: string;
  title?: string;
}

// Each chat owns multiple browser tabs
const chatTabs = new Map<string, string[]>();
// Which tab the AI is actively working in per chat
const chatActiveTab = new Map<string, string>();
let lastSwitchedChat: string | null = null;

export function getChatTabs(): ReadonlyMap<string, string[]> {
  return chatTabs;
}

export function getChatActiveTab(): ReadonlyMap<string, string> {
  return chatActiveTab;
}

export async function listBrowserTabs(): Promise<CdpTarget[]> {
  try {
    const raw = await runRaw(["tab", "list", "--json"]);
    const parsed = JSON.parse(raw);
    const tabs = parsed?.data?.tabs ?? parsed?.tabs ?? (Array.isArray(parsed) ? parsed : []);
    return tabs.filter((t: any) => t.type === "page");
  } catch {
    return [];
  }
}

async function createBrowserTab(url = "about:blank"): Promise<CdpTarget | null> {
  try {
    const args = ["tab", "new", "--json"];
    if (url !== "about:blank") args.splice(2, 0, url);
    const raw = await runRaw(args);
    const parsed = JSON.parse(raw);
    if (!parsed?.data) return null;
    return { id: String(parsed.data.index), url: parsed.data.url ?? url, type: "page" };
  } catch {
    return null;
  }
}

async function closeBrowserTabByIndex(index: number): Promise<void> {
  try {
    await runRaw(["tab", "close", String(index)]);
  } catch {}
}

/** Prune stale target IDs that no longer exist in the browser */
async function pruneStaleTargets(
  chatId: string,
  targets: CdpTarget[],
): Promise<void> {
  const tabs = chatTabs.get(chatId);
  if (!tabs) return;
  const liveIds = new Set(targets.map((t) => t.id));
  const alive = tabs.filter((id) => liveIds.has(id));
  if (alive.length !== tabs.length) {
    console.log(
      `[Browser] pruned ${tabs.length - alive.length} stale targets for chat=${chatId}`,
    );
    if (alive.length === 0) chatTabs.delete(chatId);
    else chatTabs.set(chatId, alive);
  }
  const active = chatActiveTab.get(chatId);
  if (active && !liveIds.has(active)) {
    chatActiveTab.set(chatId, alive[alive.length - 1] ?? "");
    if (!alive.length) chatActiveTab.delete(chatId);
  }
}

/** Create a new browser tab owned by a chat. Returns the target. */
export async function createTabForChat(
  chatId: string,
  url = "about:blank",
): Promise<CdpTarget | null> {
  if (!browserConnected) browserConnected = await detectBrowser();
  if (!browserConnected) return null;

  const target = await createBrowserTab(url);
  if (!target) return null;

  const tabs = chatTabs.get(chatId) ?? [];
  tabs.push(target.id);
  chatTabs.set(chatId, tabs);
  chatActiveTab.set(chatId, target.id);
  console.log(
    `[Browser] created tab ${target.id} for chat=${chatId} (total: ${tabs.length})`,
  );
  return target;
}

/** Get info about all browser tabs owned by a chat */
export async function getChatTabInfo(
  chatId: string,
): Promise<(CdpTarget & { active: boolean })[]> {
  const targets = await listBrowserTabs();
  await pruneStaleTargets(chatId, targets);

  const tabs = chatTabs.get(chatId) ?? [];
  const activeId = chatActiveTab.get(chatId);
  const tabSet = new Set(tabs);

  return targets
    .filter((t) => tabSet.has(t.id))
    .map((t) => ({ ...t, active: t.id === activeId }));
}

/** Switch the active tab for a chat to a specific target ID */
export function setActiveChatTab(chatId: string, targetId: string): void {
  chatActiveTab.set(chatId, targetId);
  lastSwitchedChat = null; // Force re-switch on next run()
}

/** Ensure the chat has at least one browser tab and switch to the active one */
async function ensureAndSwitchChat(chatId: string): Promise<void> {
  if (!browserConnected) return;

  try {
    const targets = await listBrowserTabs();
    await pruneStaleTargets(chatId, targets);

    let tabs = chatTabs.get(chatId) ?? [];
    if (tabs.length === 0) {
      const newTarget = await createTabForChat(chatId);
      if (!newTarget) return;
      tabs = chatTabs.get(chatId) ?? [];
    }

    const activeId = chatActiveTab.get(chatId) ?? tabs[tabs.length - 1];
    const index = targets.findIndex((t) => t.id === activeId);
    if (index >= 0) {
      console.log(
        `[Browser] switching to tab index=${index} for chat=${chatId}`,
      );
      await runRaw(["tab", String(index)]);
    }
  } catch (err) {
    console.warn(
      "[Browser] ensureAndSwitchChat failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

export async function run(args: string[], timeout = 30_000): Promise<string> {
  if (!browserConnected) browserConnected = await detectBrowser();

  const chatId = chatTabContext.getStore();
  if (chatId && browserConnected && chatId !== lastSwitchedChat) {
    await ensureAndSwitchChat(chatId);
    lastSwitchedChat = chatId;
  }

  return runRaw(args, timeout);
}

// ── Lifecycle Utilities ──

export async function openUrlInTab(url: string): Promise<void> {
  if (!browserConnected) browserConnected = await detectBrowser();

  if (browserConnected) {
    try {
      await run(["open", url]);
      console.log(`[Browser] opened ${url} in tab`);
      return;
    } catch (err) {
      console.warn(
        "[Browser] tab-aware open failed:",
        err instanceof Error ? err.message : err,
      );
    }

    try {
      await runRaw(["open", url]);
      console.log(`[Browser] opened ${url} (raw fallback)`);
      return;
    } catch (err) {
      console.warn(
        "[Browser] raw open failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  try {
    await execFile("open", [url], { timeout: 5000 });
    console.log(`[Browser] opened ${url} in system browser`);
  } catch (err) {
    console.warn(
      "[Browser] system open failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

/** Close ALL browser tabs owned by a chat */
export async function cleanupChatTabs(chatId: string): Promise<void> {
  const tabs = chatTabs.get(chatId);
  if (!tabs?.length) return;

  chatTabs.delete(chatId);
  chatActiveTab.delete(chatId);
  if (lastSwitchedChat === chatId) lastSwitchedChat = null;

  if (browserConnected) {
    for (const id of tabs) await closeBrowserTabByIndex(parseInt(id, 10));
  }
}

export async function closeBrowserToolset(): Promise<void> {
  try {
    const binary = await resolveBin();
    await execFile(binary, ["close"], { timeout: 5000 });
  } catch {}
  browserConnected = false;
}

export async function isBrowserConnected(): Promise<boolean> {
  if (browserConnected) return true;
  browserConnected = await detectBrowser();
  return browserConnected;
}
