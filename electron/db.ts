import { getAccessToken, getUserEmail, isConnected } from "./auth";

const PROJECT_ID = "agy-ai";
const API = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// --- Firestore Value helpers ---

type FsValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: "NULL_VALUE" }
  | { arrayValue: { values: FsValue[] } }
  | { mapValue: { fields: Record<string, FsValue> } };

function encode(val: unknown): FsValue {
  if (val === null || val === undefined) return { nullValue: "NULL_VALUE" };
  if (typeof val === "string") return { stringValue: val };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number")
    return Number.isInteger(val)
      ? { integerValue: String(val) }
      : { doubleValue: val };
  if (Array.isArray(val))
    return { arrayValue: { values: val.map(encode) } };
  if (typeof val === "object") {
    const fields: Record<string, FsValue> = {};
    for (const [k, v] of Object.entries(val))
      fields[k] = encode(v);
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function decode(val: FsValue): unknown {
  if ("stringValue" in val) return val.stringValue;
  if ("integerValue" in val) return parseInt(val.integerValue, 10);
  if ("doubleValue" in val) return val.doubleValue;
  if ("booleanValue" in val) return val.booleanValue;
  if ("nullValue" in val) return null;
  if ("arrayValue" in val)
    return (val.arrayValue.values ?? []).map(decode);
  if ("mapValue" in val) {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val.mapValue.fields ?? {}))
      obj[k] = decode(v);
    return obj;
  }
  return null;
}

function encodeFields(obj: Record<string, unknown>): Record<string, FsValue> {
  const fields: Record<string, FsValue> = {};
  for (const [k, v] of Object.entries(obj))
    if (v !== undefined) fields[k] = encode(v);
  return fields;
}

function decodeFields(fields: Record<string, FsValue>): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields))
    obj[k] = decode(v);
  return obj;
}

// --- REST helpers ---

async function headers(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function fsRequest(method: string, path: string, body?: unknown): Promise<any> {
  const res = await fetch(`${API}/${path}`, {
    method,
    headers: await headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Firestore ${method} ${path}: ${res.status} ${text}`);
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("json")) return res.json();
  return null;
}

// --- Path helpers ---

function userPath(email: string): string {
  return `users/${encodeURIComponent(email)}`;
}

function convPath(email: string, tabId: string): string {
  return `${userPath(email)}/conversations/${encodeURIComponent(tabId)}`;
}

function msgDocPath(email: string, tabId: string, msgId: string): string {
  return `${convPath(email, tabId)}/messages/${encodeURIComponent(msgId)}`;
}

// --- Public API ---

export interface StoredMessage {
  id: string;
  text: string;
  author: "user" | "bot";
  timestamp: number;
  files?: { name: string; mimeType: string }[];
}

export interface StoredConversation {
  id: string;
  label: string;
  createdAt: number;
  updatedAt: number;
  browserTabs?: BrowserTabMeta[];
}

function isAvailable(): boolean {
  return isConnected();
}

export async function saveMessage(tabId: string, msg: StoredMessage): Promise<void> {
  if (!isAvailable()) return;
  const email = await getUserEmail();
  if (!email) return;

  const path = msgDocPath(email, tabId, msg.id);
  const fields: Record<string, unknown> = {
    text: msg.text,
    author: msg.author,
    timestamp: msg.timestamp,
  };
  if (msg.files?.length) fields.files = msg.files;

  await fsRequest("PATCH", path, { fields: encodeFields(fields) });
}

export interface BrowserTabMeta {
  url: string;
  title: string;
}

export async function saveConversation(
  tabId: string,
  label: string,
  browserTabs?: BrowserTabMeta[],
): Promise<void> {
  if (!isAvailable()) return;
  const email = await getUserEmail();
  if (!email) return;

  const path = convPath(email, tabId);
  const now = Date.now();

  let createdAt = now;
  try {
    const existing = await fsRequest("GET", path);
    if (existing?.fields?.createdAt)
      createdAt = decode(existing.fields.createdAt) as number;
  } catch {}

  const data: Record<string, unknown> = { label, createdAt, updatedAt: now };
  if (browserTabs) data.browserTabs = browserTabs;

  await fsRequest("PATCH", path, { fields: encodeFields(data) });
}

export async function loadConversations(): Promise<StoredConversation[]> {
  if (!isAvailable()) return [];
  const email = await getUserEmail();
  if (!email) return [];

  try {
    const parent = userPath(email);
    const result = await fsRequest("GET", `${parent}/conversations`);
    if (!result?.documents) return [];

    return result.documents.map((doc: any) => {
      const fields = decodeFields(doc.fields ?? {});
      const id = doc.name.split("/").pop();
      return {
        id: decodeURIComponent(id),
        label: fields.label as string,
        createdAt: fields.createdAt as number,
        updatedAt: fields.updatedAt as number,
        browserTabs: fields.browserTabs as BrowserTabMeta[] | undefined,
      };
    });
  } catch {
    return [];
  }
}

export async function loadMessages(tabId: string): Promise<StoredMessage[]> {
  if (!isAvailable()) return [];
  const email = await getUserEmail();
  if (!email) return [];

  try {
    const parent = `${API}/${convPath(email, tabId)}`;
    const token = await getAccessToken();
    const res = await fetch(`${parent}:runQuery`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "messages" }],
          orderBy: [{ field: { fieldPath: "timestamp" }, direction: "ASCENDING" }],
        },
      }),
    });
    if (!res.ok) return [];

    const results: any[] = await res.json();
    return results
      .filter((r) => r.document)
      .map((r) => {
        const fields = decodeFields(r.document.fields ?? {});
        const id = r.document.name.split("/").pop();
        return {
          id: decodeURIComponent(id),
          text: fields.text as string,
          author: fields.author as "user" | "bot",
          timestamp: fields.timestamp as number,
          files: fields.files as StoredMessage["files"],
        };
      });
  } catch {
    return [];
  }
}

export async function deleteConversation(tabId: string): Promise<void> {
  if (!isAvailable()) return;
  const email = await getUserEmail();
  if (!email) return;

  try {
    // Load all message doc names first
    const dbDocBase = `projects/${PROJECT_ID}/databases/(default)/documents`;
    const msgs = await loadMessages(tabId);
    const writes = msgs.map((m) => ({
      delete: `${dbDocBase}/${msgDocPath(email, tabId, m.id)}`,
    }));

    // Delete messages in batches of 500 (Firestore limit)
    const dbPath = `projects/${PROJECT_ID}/databases/(default)`;
    const token = await getAccessToken();
    for (let i = 0; i < writes.length; i += 500) {
      const batch = writes.slice(i, i + 500);
      await fetch(`https://firestore.googleapis.com/v1/${dbPath}/documents:batchWrite`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ writes: batch }),
      });
    }

    // Delete the conversation document itself
    await fsRequest("DELETE", convPath(email, tabId));
  } catch {
    // Best-effort cleanup
  }
}
