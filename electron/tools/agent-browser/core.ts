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
let cdpPort: number | null = null;

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

// ── CDP Detection ──

export async function detectCdp(): Promise<number | null> {
  if (process.env.BROWSER_CDP_PORT)
    return parseInt(process.env.BROWSER_CDP_PORT, 10);

  for (const port of [57450]) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`, {
        signal: AbortSignal.timeout(1000),
      });
      if (res.ok) return port;
    } catch {}
  }
  return null;
}

export function getCdpPort() {
  return cdpPort;
}
export function setCdpPort(port: number | null) {
  cdpPort = port;
}

// ── Command Execution ──

export async function runRaw(
  args: string[],
  timeout = 30_000,
): Promise<string> {
  const binary = await resolveBin();
  if (!cdpPort) cdpPort = await detectCdp();

  const fullArgs = cdpPort ? ["--cdp", String(cdpPort), ...args] : args;

  try {
    const { stdout } = await execFile(binary, fullArgs, {
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
      cdpPort = null;

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

export async function fetchCdpTargets(): Promise<CdpTarget[]> {
  if (!cdpPort) cdpPort = await detectCdp();
  if (!cdpPort) return [];
  try {
    const res = await fetch(`http://127.0.0.1:${cdpPort}/json`, {
      signal: AbortSignal.timeout(2000),
    });
    return ((await res.json()) as CdpTarget[]).filter((t) => t.type === "page");
  } catch {
    return [];
  }
}

async function createCdpTab(url = "about:blank"): Promise<CdpTarget | null> {
  try {
    const res = await fetch(`http://127.0.0.1:${cdpPort}/json/new?${url}`, {
      signal: AbortSignal.timeout(5000),
    });
    return (await res.json()) as CdpTarget;
  } catch {
    return null;
  }
}

async function closeCdpTargetTab(targetId: string): Promise<void> {
  try {
    await fetch(`http://127.0.0.1:${cdpPort}/json/close/${targetId}`, {
      signal: AbortSignal.timeout(2000),
    });
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
  if (!cdpPort) cdpPort = await detectCdp();
  if (!cdpPort) return null;

  const target = await createCdpTab(url);
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
  const targets = await fetchCdpTargets();
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
  if (!cdpPort) return;

  try {
    const targets = await fetchCdpTargets();
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
  if (!cdpPort) cdpPort = await detectCdp();

  const chatId = chatTabContext.getStore();
  if (chatId && cdpPort && chatId !== lastSwitchedChat) {
    await ensureAndSwitchChat(chatId);
    lastSwitchedChat = chatId;
  }

  return runRaw(args, timeout);
}

// ── Lifecycle Utilities ──

export async function openUrlInTab(url: string): Promise<void> {
  if (!cdpPort) cdpPort = await detectCdp();

  if (cdpPort) {
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

  if (cdpPort) {
    for (const targetId of tabs) await closeCdpTargetTab(targetId);
  }
}

export async function closeBrowserToolset(): Promise<void> {
  try {
    const binary = await resolveBin();
    await execFile(binary, ["close"], { timeout: 5000 });
  } catch {}
  cdpPort = null;
}

export async function isBrowserConnected(): Promise<boolean> {
  return (await detectCdp()) !== null;
}
