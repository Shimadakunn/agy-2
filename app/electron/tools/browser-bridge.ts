import { Client } from "@modelcontextprotocol/sdk/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { FunctionTool } from "@google/adk";
import { z } from "zod";

const MCP_CHROME_URL = "http://127.0.0.1:12306/mcp";

let client: Client | null = null;
let transport: StreamableHTTPClientTransport | null = null;
let cachedTools: FunctionTool[] | null = null;

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

async function resetConnection(): Promise<void> {
  if (client) await client.close().catch(() => {});
  client = null;
  transport = null;
}

async function getClient(): Promise<Client> {
  if (client) return client;
  transport = new StreamableHTTPClientTransport(new URL(MCP_CHROME_URL));
  client = new Client({ name: "agy", version: "1.0.0" });
  await client.connect(transport);
  return client;
}

async function callToolWithRetry(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const c = await getClient();
      const result = await c.callTool({ name, arguments: args });
      return flattenContent(result.content);
    } catch (err) {
      if (attempt === 0) {
        await resetConnection();
        continue;
      }
      throw err;
    }
  }
  throw new Error("unreachable");
}

async function discoverTools(): Promise<FunctionTool[]> {
  const c = await getClient();
  const { tools } = await c.listTools();

  return tools.map((tool) => {
    const params = tool.inputSchema
      ? jsonSchemaToZod(tool.inputSchema as Record<string, any>)
      : z.object({});

    return new FunctionTool({
      name: tool.name,
      description: tool.description || tool.name,
      parameters: params,
      execute: async (args) => {
        try {
          return await callToolWithRetry(tool.name, args);
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

export async function getBrowserTools(): Promise<FunctionTool[]> {
  if (cachedTools) return cachedTools;
  try {
    cachedTools = await discoverTools();
    console.log(
      `[BrowserBridge] Discovered ${cachedTools.length} Chrome MCP tools`,
    );
    return cachedTools;
  } catch (err) {
    console.warn(
      "[BrowserBridge] Chrome MCP not available:",
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

export async function closeBrowserToolset(): Promise<void> {
  await resetConnection();
  cachedTools = null;
}

export async function isBrowserExtensionConnected(): Promise<boolean> {
  try {
    const res = await fetch("http://127.0.0.1:12306/ping");
    return res.ok;
  } catch {
    return false;
  }
}
