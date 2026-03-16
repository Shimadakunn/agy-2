import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import path from "node:path";
import { FunctionTool } from "@google/adk";
import { z } from "zod";
import { getAccessToken } from "../auth";
import { openUrlInTab } from "./agent-browser";

const execFile = promisify(execFileCb);
const MAX_BUFFER = 10 * 1024 * 1024; // 10MB — schema responses can be large

let bin = "";

async function resolveBin(): Promise<string> {
  if (bin) return bin;

  const require = createRequire(import.meta.url);
  let directBin: string | undefined;
  try {
    const pkgDir = path.dirname(require.resolve("@googleworkspace/cli/package.json"));
    directBin = path.join(pkgDir, "node_modules", ".bin_real", "gws");
    console.log("[GWS] resolved binary:", directBin);
  } catch (e) {
    console.warn("[GWS] require.resolve failed:", e instanceof Error ? e.message : e);
  }

  for (const candidate of [directBin, "gws"].filter(Boolean) as string[]) {
    try {
      const { stdout } = await execFile(candidate, ["--version"], { timeout: 5000 });
      bin = candidate;
      console.log("[GWS] binary found:", bin, "version:", stdout.trim());
      return bin;
    } catch (e) {
      console.warn("[GWS] candidate failed:", candidate, e instanceof Error ? e.message : e);
    }
  }
  throw new Error("gws binary not found. Run: pnpm add @googleworkspace/cli");
}

function strip(s: string): string {
  return s.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "").trim();
}

async function runGws(args: string[], timeout = 30_000): Promise<string> {
  const binary = await resolveBin();
  const token = await getAccessToken();

  console.log("[GWS] exec:", args.join(" "));

  try {
    const { stdout, stderr } = await execFile(binary, args, {
      timeout,
      maxBuffer: MAX_BUFFER,
      env: { ...process.env, GOOGLE_WORKSPACE_CLI_TOKEN: token },
    });
    if (stderr) console.warn("[GWS] stderr:", strip(stderr));
    console.log("[GWS] stdout:", strip(stdout).slice(0, 500));
    return strip(stdout);
  } catch (err: any) {
    const out = strip(err.stdout || "");
    const errMsg = strip(err.stderr || "");
    console.error("[GWS] exec failed — code:", err.code, "signal:", err.signal);
    console.error("[GWS] stdout:", out.slice(0, 500));
    console.error("[GWS] stderr:", errMsg.slice(0, 500));
    if (out) return out;
    throw new Error(errMsg || (err instanceof Error ? err.message : String(err)));
  }
}

const WRITE_METHODS = new Set(["create", "insert"]);

/** Build base64url-encoded RFC 2822 message from human-readable fields */
function buildRawEmail(fields: { to: string; subject: string; body: string; cc?: string; bcc?: string }): string {
  const lines = [
    `To: ${fields.to}`,
    ...(fields.cc ? [`Cc: ${fields.cc}`] : []),
    ...(fields.bcc ? [`Bcc: ${fields.bcc}`] : []),
    `Subject: ${fields.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    fields.body,
  ];
  return Buffer.from(lines.join('\r\n')).toString('base64url');
}

function extractCreatedUrl(data: Record<string, any>): string | null {
  // Direct URL fields returned by Google APIs
  if (data.spreadsheetUrl) return data.spreadsheetUrl;
  if (data.webViewLink) return data.webViewLink;
  if (data.htmlLink) return data.htmlLink;
  if (data.meetingUri) return data.meetingUri;

  // Construct URLs from resource IDs
  if (data.documentId)
    return `https://docs.google.com/document/d/${data.documentId}/edit`;
  if (data.presentationId)
    return `https://docs.google.com/presentation/d/${data.presentationId}/edit`;
  if (data.spreadsheetId)
    return `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`;

  return null;
}

const gwsCommand = new FunctionTool({
  name: "gws",
  description: `Execute Google Workspace API operations. This is the PRIMARY tool for all Google actions — email, calendar, drive, docs, sheets, etc.

Command format: space-separated "<service> <resource> [sub-resource] <method>".
IMPORTANT: use SPACES between all parts, never dots. Example: "gmail users drafts create" NOT "gmail users.drafts create".

Common operations (copy these exactly):
- LIST EMAILS: command="gmail users messages list", params={"userId":"me","maxResults":10}
- READ EMAIL: command="gmail users messages get", params={"userId":"me","id":"<messageId>","format":"full"}
- DRAFT EMAIL: command="gmail users drafts create", params={"userId":"me"}, body={"message":{"to":"recipient@example.com","subject":"Hello","body":"Email content here","cc":"optional@example.com"}}
- SEND EMAIL: command="gmail users messages send", params={"userId":"me"}, body={"message":{"to":"recipient@example.com","subject":"Hello","body":"Email content here"}}
- LIST CALENDAR EVENTS: command="calendar events list", params={"calendarId":"primary","maxResults":10}
- CREATE CALENDAR EVENT: command="calendar events insert", params={"calendarId":"primary"}, body={"summary":"...","start":{"dateTime":"..."},"end":{"dateTime":"..."}}
- LIST DRIVE FILES: command="drive files list", params={"pageSize":10}
- CREATE SPREADSHEET: command="sheets spreadsheets create", body={"properties":{"title":"..."}}
- READ SPREADSHEET: command="sheets spreadsheets values get", params={"spreadsheetId":"...","range":"Sheet1!A1:Z"}
- WRITE SPREADSHEET: command="sheets spreadsheets values update", params={"spreadsheetId":"...","range":"Sheet1!A1","valueInputOption":"USER_ENTERED"}, body={"values":[["a","b"],["c","d"]]}
- READ DOC: command="docs documents get", params={"documentId":"..."}
- READ SLIDES: command="slides presentations get", params={"presentationId":"..."}
- LIST TASKS: command="tasks tasks list", params={"tasklist":"@default"}
- CREATE TASK: command="tasks tasks insert", params={"tasklist":"@default"}, body={"title":"..."}
- CREATE MEETING: command="meet spaces create"
- LIST CONTACTS: command="people people connections list", params={"resourceName":"people/me","personFields":"names,emailAddresses"}

If unsure about parameters, call gws_schema first.`,
  parameters: z.object({
    command: z.string().describe("Space-separated: service resource [sub-resource] method. Example: 'sheets spreadsheets values update'"),
    params: z.record(z.string(), z.any()).optional().describe("URL/query parameters as key-value pairs"),
    body: z.record(z.string(), z.any()).optional().describe("Request body for create/update operations"),
    pageAll: z.boolean().optional().describe("Auto-paginate to fetch all results"),
  }),
  execute: async ({ command, params, body, pageAll }) => {
    // Defensive: LLM sometimes nests request body inside params
    if (params?.body && !body) {
      body = params.body as Record<string, any>;
      const { body: _, ...rest } = params;
      params = Object.keys(rest).length ? rest : undefined;
    }

    // Defensive: LLM puts body-only fields (values, requests, etc.) into params
    if (params?.values !== undefined) {
      const { values, ...rest } = params;
      body = { ...(body || {}), values };
      params = Object.keys(rest).length ? rest : undefined;
    }
    if (params?.requests !== undefined) {
      const { requests, ...rest } = params;
      body = { ...(body || {}), requests };
      params = Object.keys(rest).length ? rest : undefined;
    }

    // Strip fields the LLM leaks into body that don't belong
    if (body?.command) {
      const { command: _, ...rest } = body;
      body = Object.keys(rest).length ? rest : undefined;
    }
    if (body?.params) {
      const { params: leaked, ...rest } = body;
      if (typeof leaked === "object" && leaked !== null) {
        params = { ...(params || {}), ...leaked };
      }
      body = Object.keys(rest).length ? rest : undefined;
    }

    // Normalize values to 2D array for Sheets API
    // LLM sends flat CSV strings like ["a,b,c","d,e,f"] instead of [["a","b","c"],["d","e","f"]]
    if (body?.values && Array.isArray(body.values)) {
      body.values = (body.values as any[]).flatMap((row: any) => {
        if (Array.isArray(row)) return [row];
        if (typeof row === "string" && row.includes("\n"))
          return row.split("\n").filter(Boolean).map((line: string) => line.split(","));
        if (typeof row === "string")
          return [row.split(",")];
        if (row == null) return [];
        return [[row]];
      });
    }

    // Normalize Gmail draft/send: encode human-readable fields into base64url RFC 2822
    const isGmail = /\b(drafts\s+create|messages\s+send)\b/i.test(command);
    if (isGmail && body) {
      // Extract message fields from wherever the LLM put them
      const msg = body.message ?? body;
      if (typeof msg === "object" && msg !== null && (msg.to || msg.subject) && !msg.raw) {
        const raw = buildRawEmail({
          to: msg.to ?? "",
          subject: msg.subject ?? "",
          body: msg.body ?? msg.text ?? msg.content ?? "",
          cc: msg.cc,
          bcc: msg.bcc,
        });
        // drafts.create needs { message: { raw } }, messages.send needs { raw }
        body = command.includes("drafts") ? { message: { raw } } : { raw };
        if (!params?.userId) params = { ...(params || {}), userId: "me" };
      }
    }

    console.log("[GWS tool] called with:", { command, params, body, pageAll });
    try {
      // Split on spaces AND dots so both "spreadsheets values get" and "spreadsheets.values get" work
      const args = command.split(/[\s.]+/).filter(Boolean);
      const method = args[args.length - 1]?.toLowerCase();
      if (params && Object.keys(params).length) args.push("--params", JSON.stringify(params));
      if (body) args.push("--json", JSON.stringify(body));
      if (pageAll) args.push("--page-all");
      args.push("--format", "json");

      console.log("[GWS tool] final args:", args);
      const result = await runGws(args, pageAll ? 120_000 : 30_000);
      try {
        const parsed = JSON.parse(result);
        if (parsed.error)
          return { status: "error", error: parsed.error.message || JSON.stringify(parsed.error) };

        // Auto-open created resources in the browser
        if (method && WRITE_METHODS.has(method)) {
          const url = extractCreatedUrl(parsed);
          if (url) {
            console.log("[GWS tool] auto-opening:", url);
            openUrlInTab(url).catch(() => {});
          }
        }

        console.log("[GWS tool] success");
        return { status: "success", data: parsed };
      } catch {
        console.log("[GWS tool] success (raw, length:", result.length, ")");
        return { status: "success", data: result };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[GWS tool] error:", message);
      return { status: "error", error: message };
    }
  },
});

const gwsSchema = new FunctionTool({
  name: "gws_schema",
  description: "Look up the API schema for any Google Workspace method. Returns parameter names, types, and descriptions. Use DOT notation here (unlike the gws tool which uses spaces).",
  parameters: z.object({
    method: z.string().describe("API method in dot notation: 'sheets.spreadsheets.create', 'gmail.users.messages.send'"),
  }),
  execute: async ({ method }) => {
    console.log("[GWS schema] looking up:", method);
    try {
      // No --resolve-refs: keeps output compact and avoids maxBuffer issues
      const result = await runGws(["schema", method]);
      try {
        const parsed = JSON.parse(result);
        console.log("[GWS schema] success for:", method);
        return { status: "success", schema: parsed };
      } catch {
        console.log("[GWS schema] success (raw) for:", method);
        return { status: "success", schema: result };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[GWS schema] error:", message);
      return { status: "error", error: message };
    }
  },
});

export const gwsTools = [gwsCommand, gwsSchema];
