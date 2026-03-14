import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "crypto";
import { FunctionTool } from "@google/adk";
import { z } from "zod";

const WS_PORT = 12307;

let wss: WebSocketServer | null = null;
let extensionSocket: WebSocket | null = null;
let cachedTools: FunctionTool[] | null = null;
const pendingRequests = new Map<
  string,
  { resolve: (v: any) => void; reject: (e: Error) => void }
>();

function jsonSchemaToZod(schema: Record<string, any>): z.ZodTypeAny {
  if (schema.enum)
    return z.enum(schema.enum as [string, ...string[]]);

  switch (schema.type) {
    case "number":
    case "integer":
      return z.number();
    case "boolean":
      return z.boolean();
    case "array":
      return z.array(schema.items ? jsonSchemaToZod(schema.items) : z.any());
    case "object": {
      if (!schema.properties) return z.record(z.string(), z.any());
      const required: string[] = schema.required ?? [];
      const shape: Record<string, z.ZodTypeAny> = {};
      for (const [key, prop] of Object.entries(
        schema.properties as Record<string, Record<string, any>>,
      )) {
        let field = jsonSchemaToZod(prop);
        if (prop.description) field = field.describe(prop.description);
        if (!required.includes(key)) field = field.optional();
        shape[key] = field;
      }
      return z.object(shape);
    }
    default:
      return z.string();
  }
}

function flattenContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return JSON.stringify(content);
  return content
    .map((c: any) =>
      typeof c === "string" ? c : (c.text ?? JSON.stringify(c)),
    )
    .join("\n");
}

function sendToExtension(msg: Record<string, unknown>): boolean {
  if (!extensionSocket || extensionSocket.readyState !== WebSocket.OPEN)
    return false;
  extensionSocket.send(JSON.stringify(msg));
  return true;
}

function requestFromExtension(
  msg: Record<string, unknown>,
  timeoutMs = 30000,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = msg.id as string;
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`Request ${msg.type} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    pendingRequests.set(id, {
      resolve: (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      reject: (e) => {
        clearTimeout(timer);
        reject(e);
      },
    });
    if (!sendToExtension(msg)) {
      clearTimeout(timer);
      pendingRequests.delete(id);
      reject(new Error("Extension not connected"));
    }
  });
}

function handleExtensionMessage(raw: string) {
  let msg: any;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }

  if (msg.type === "tool_result" || msg.type === "tool_list") {
    const pending = pendingRequests.get(msg.id);
    if (pending) {
      pendingRequests.delete(msg.id);
      pending.resolve(msg);
    }
  }
}

async function requestToolList(): Promise<FunctionTool[]> {
  const id = randomUUID();
  const response = await requestFromExtension(
    { type: "list_tools", id },
    10000,
  );
  const tools: any[] = response.tools || [];

  return tools.map((tool) => {
    const params = tool.inputSchema
      ? jsonSchemaToZod(tool.inputSchema)
      : z.object({});

    return new FunctionTool({
      name: tool.name,
      description: tool.description || tool.name,
      parameters: params,
      execute: async (args) => {
        try {
          const callId = randomUUID();
          const result = await requestFromExtension(
            { type: "call_tool", id: callId, name: tool.name, args },
            30000,
          );
          if (result.isError)
            return JSON.stringify({
              status: "error",
              error: flattenContent(result.content),
            });
          return flattenContent(result.content);
        } catch (err: unknown) {
          return JSON.stringify({
            status: "error",
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
    });
  });
}

function ensureServer(): void {
  if (wss) return;
  wss = new WebSocketServer({ host: "127.0.0.1", port: WS_PORT });
  console.log(
    `[BrowserBridge] WebSocket server listening on ws://127.0.0.1:${WS_PORT}`,
  );

  wss.on("connection", async (ws) => {
    console.log("[BrowserBridge] Extension connected");
    extensionSocket = ws;

    ws.on("message", (data) => handleExtensionMessage(data.toString()));
    ws.on("close", () => {
      console.log("[BrowserBridge] Extension disconnected");
      if (extensionSocket === ws) {
        extensionSocket = null;
        cachedTools = null;
      }
    });
    ws.on("error", (err) =>
      console.error("[BrowserBridge] WS error:", err.message),
    );

    try {
      cachedTools = await requestToolList();
      console.log(
        `[BrowserBridge] Discovered ${cachedTools.length} tools from extension`,
      );
    } catch (err) {
      console.warn("[BrowserBridge] Failed to get tool list:", err);
    }
  });

  setInterval(() => {
    if (extensionSocket?.readyState === WebSocket.OPEN)
      sendToExtension({ type: "ping" });
  }, 25000);
}

export async function getBrowserTools(): Promise<FunctionTool[]> {
  ensureServer();
  if (cachedTools) return cachedTools;
  if (extensionSocket?.readyState === WebSocket.OPEN) {
    try {
      cachedTools = await requestToolList();
      console.log(
        `[BrowserBridge] Discovered ${cachedTools.length} Chrome extension tools`,
      );
      return cachedTools;
    } catch (err) {
      console.warn(
        "[BrowserBridge] Chrome extension not ready:",
        err instanceof Error ? err.message : err,
      );
    }
  }
  return [];
}

export async function closeBrowserToolset(): Promise<void> {
  extensionSocket?.close();
  extensionSocket = null;
  cachedTools = null;
  pendingRequests.forEach((p) => p.reject(new Error("Shutting down")));
  pendingRequests.clear();
  if (wss) {
    wss.close();
    wss = null;
  }
}

export async function isBrowserExtensionConnected(): Promise<boolean> {
  ensureServer();
  return extensionSocket?.readyState === WebSocket.OPEN ?? false;
}
