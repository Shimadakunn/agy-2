import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chatTabContext } from "../tab-context";

export const execFile = promisify(execFileCb);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localBin = path.resolve(
  __dirname, "..", "..", "..", "node_modules", ".bin", "agent-browser",
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
  throw new Error("agent-browser binary not found. Run: pnpm add agent-browser");
}

// ── CDP Detection ──

export async function detectCdp(): Promise<number | null> {
  if (process.env.BROWSER_CDP_PORT)
    return parseInt(process.env.BROWSER_CDP_PORT, 10);

  for (const port of [9222, 9229, 9333]) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`, {
        signal: AbortSignal.timeout(1000),
      });
      if (res.ok) return port;
    } catch {}
  }
  return null;
}

export function getCdpPort() { return cdpPort; }
export function setCdpPort(port: number | null) { cdpPort = port; }

// ── Command Execution ──

export async function runRaw(args: string[], timeout = 30_000): Promise<string> {
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

    if (errMsg.includes("Failed to connect") || out.includes("Failed to connect"))
      cdpPort = null;

    throw new Error(out || errMsg || (err instanceof Error ? err.message : String(err)));
  }
}

// ── Per-chat-tab Browser Tab Management via CDP ──

export interface CdpTarget {
  id: string;
  url: string;
  type: string;
  title?: string;
}

export const tabTargets = new Map<string, string>();
let lastSwitchedTab: string | null = null;

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

async function ensureAndSwitchTab(chatTabId: string): Promise<void> {
  if (!cdpPort) return;

  try {
    let targetId = tabTargets.get(chatTabId);
    let targets = await fetchCdpTargets();
    console.log(
      `[Browser] ensureTab: chat=${chatTabId} existing=${targetId ?? "none"} pages=${targets.length}`,
    );

    if (targetId && !targets.some((t) => t.id === targetId)) {
      console.log(`[Browser] stale target ${targetId}, clearing`);
      tabTargets.delete(chatTabId);
      targetId = undefined;
    }

    if (!targetId) {
      const newTarget = await createCdpTab();
      if (!newTarget) {
        console.warn("[Browser] createCdpTab returned null");
        return;
      }
      console.log(`[Browser] created CDP tab ${newTarget.id} (${newTarget.url})`);
      targetId = newTarget.id;
      tabTargets.set(chatTabId, targetId);
      targets = await fetchCdpTargets();
    }

    const index = targets.findIndex((t) => t.id === targetId);
    console.log(`[Browser] switching to tab index=${index} for chat=${chatTabId}`);
    if (index >= 0) await runRaw(["tab", String(index)]);
  } catch (err) {
    console.warn(
      "[Browser] ensureAndSwitchTab failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

export async function run(args: string[], timeout = 30_000): Promise<string> {
  if (!cdpPort) cdpPort = await detectCdp();

  const chatTabId = chatTabContext.getStore();
  if (chatTabId && cdpPort && chatTabId !== lastSwitchedTab) {
    console.log(
      `[Browser] run: switching context to chat=${chatTabId} (was ${lastSwitchedTab})`,
    );
    await ensureAndSwitchTab(chatTabId);
    lastSwitchedTab = chatTabId;
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
      console.warn("[Browser] tab-aware open failed:", err instanceof Error ? err.message : err);
    }

    try {
      await runRaw(["open", url]);
      console.log(`[Browser] opened ${url} (raw fallback)`);
      return;
    } catch (err) {
      console.warn("[Browser] raw open failed:", err instanceof Error ? err.message : err);
    }
  }

  try {
    await execFile("open", [url], { timeout: 5000 });
    console.log(`[Browser] opened ${url} in system browser`);
  } catch (err) {
    console.warn("[Browser] system open failed:", err instanceof Error ? err.message : err);
  }
}

export async function cleanupBrowserTab(chatTabId: string): Promise<void> {
  const targetId = tabTargets.get(chatTabId);
  if (!targetId) return;
  tabTargets.delete(chatTabId);
  if (lastSwitchedTab === chatTabId) lastSwitchedTab = null;
  if (cdpPort) await closeCdpTargetTab(targetId);
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
