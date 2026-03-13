import { FunctionTool } from "@google/adk";
import { z } from "zod";
import { run } from "./exec.js";

function gws(args: string[], timeoutMs = 30_000) {
  return run("gws", args, timeoutMs);
}

export const createEmailDraft = new FunctionTool({
  name: "create_email_draft",
  description:
    "Create a Gmail draft email. Returns the draft ID that can be used to open it in Gmail for the user to review and send manually.",
  parameters: z.object({
    to: z.string().describe("Recipient email address"),
    subject: z.string().describe("Email subject line"),
    body: z.string().describe("Email body text (plain text)"),
    cc: z.string().optional().describe("CC email address"),
    bcc: z.string().optional().describe("BCC email address"),
  }),
  execute: async ({ to, subject, body, cc, bcc }) => {
    const headers = [
      `To: ${to}`,
      `Subject: ${subject}`,
      ...(cc ? [`Cc: ${cc}`] : []),
      ...(bcc ? [`Bcc: ${bcc}`] : []),
      "Content-Type: text/plain; charset=utf-8",
      "",
      body,
    ].join("\r\n");

    const raw = Buffer.from(headers).toString("base64url");

    const result = await gws([
      "gmail", "users", "drafts", "create",
      "--params", JSON.stringify({ userId: "me" }),
      "--json", JSON.stringify({ message: { raw } }),
    ]);

    if (result.exitCode !== 0)
      return { status: "error", error: result.stderr || result.stdout };

    try {
      const data = JSON.parse(result.stdout);
      return { status: "success", draftId: data.id, messageId: data.message?.id };
    } catch {
      return { status: "error", error: "Failed to parse gws response", raw: result.stdout };
    }
  },
});

export const listEmails = new FunctionTool({
  name: "list_emails",
  description: "List recent emails from the user's Gmail inbox. Returns subject, sender, snippet, and date for each message.",
  parameters: z.object({
    query: z.string().optional().describe("Gmail search query (e.g. 'from:alice', 'is:unread', 'subject:report')"),
    maxResults: z.number().optional().describe("Max number of emails to return (default 10)"),
  }),
  execute: async ({ query, maxResults }) => {
    const params: Record<string, unknown> = {
      userId: "me",
      maxResults: maxResults ?? 10,
    };
    if (query) params.q = query;

    const result = await gws([
      "gmail", "users", "messages", "list",
      "--params", JSON.stringify(params),
    ]);

    if (result.exitCode !== 0)
      return { status: "error", error: result.stderr || result.stdout };

    try {
      const data = JSON.parse(result.stdout);
      const messages = data.messages ?? [];
      if (messages.length === 0)
        return { status: "success", messages: [], note: "No emails found" };

      const details = await Promise.all(
        messages.slice(0, maxResults ?? 10).map(async (msg: { id: string }) => {
          const detail = await gws([
            "gmail", "users", "messages", "get",
            "--params", JSON.stringify({ userId: "me", id: msg.id, format: "metadata", metadataHeaders: ["From", "Subject", "Date"] }),
          ]);
          if (detail.exitCode !== 0) return null;
          try {
            const d = JSON.parse(detail.stdout);
            const hdrs = d.payload?.headers ?? [];
            const get = (name: string) => hdrs.find((h: { name: string; value: string }) => h.name === name)?.value ?? "";
            return { id: msg.id, from: get("From"), subject: get("Subject"), date: get("Date"), snippet: d.snippet };
          } catch {
            return null;
          }
        })
      );

      return { status: "success", messages: details.filter(Boolean) };
    } catch {
      return { status: "error", error: "Failed to parse response", raw: result.stdout };
    }
  },
});

export const listCalendarEvents = new FunctionTool({
  name: "list_calendar_events",
  description: "List upcoming events from the user's Google Calendar.",
  parameters: z.object({
    daysAhead: z.number().optional().describe("Number of days ahead to look (default 7)"),
    maxResults: z.number().optional().describe("Max events to return (default 10)"),
  }),
  execute: async ({ daysAhead, maxResults }) => {
    const now = new Date();
    const future = new Date(now.getTime() + (daysAhead ?? 7) * 86400_000);

    const result = await gws([
      "calendar", "events", "list",
      "--params", JSON.stringify({
        calendarId: "primary",
        timeMin: now.toISOString(),
        timeMax: future.toISOString(),
        maxResults: maxResults ?? 10,
        singleEvents: true,
        orderBy: "startTime",
      }),
    ]);

    if (result.exitCode !== 0)
      return { status: "error", error: result.stderr || result.stdout };

    try {
      const data = JSON.parse(result.stdout);
      const events = (data.items ?? []).map((e: Record<string, unknown>) => ({
        id: e.id,
        summary: e.summary,
        start: (e.start as Record<string, unknown>)?.dateTime ?? (e.start as Record<string, unknown>)?.date,
        end: (e.end as Record<string, unknown>)?.dateTime ?? (e.end as Record<string, unknown>)?.date,
        location: e.location,
        description: e.description,
      }));
      return { status: "success", events };
    } catch {
      return { status: "error", error: "Failed to parse response", raw: result.stdout };
    }
  },
});

export const createCalendarEvent = new FunctionTool({
  name: "create_calendar_event",
  description: "Create a new Google Calendar event.",
  parameters: z.object({
    summary: z.string().describe("Event title"),
    startDateTime: z.string().describe("Start date and time in ISO 8601 format (e.g. '2026-03-15T10:00:00')"),
    endDateTime: z.string().describe("End date and time in ISO 8601 format"),
    description: z.string().optional().describe("Event description"),
    location: z.string().optional().describe("Event location"),
    attendees: z.array(z.string()).optional().describe("List of attendee email addresses"),
  }),
  execute: async ({ summary, startDateTime, endDateTime, description, location, attendees }) => {
    const event: Record<string, unknown> = {
      summary,
      start: { dateTime: startDateTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      end: { dateTime: endDateTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    };
    if (description) event.description = description;
    if (location) event.location = location;
    if (attendees?.length) event.attendees = attendees.map((email) => ({ email }));

    const result = await gws([
      "calendar", "events", "insert",
      "--params", JSON.stringify({ calendarId: "primary" }),
      "--json", JSON.stringify(event),
    ]);

    if (result.exitCode !== 0)
      return { status: "error", error: result.stderr || result.stdout };

    try {
      const data = JSON.parse(result.stdout);
      return { status: "success", eventId: data.id, htmlLink: data.htmlLink };
    } catch {
      return { status: "error", error: "Failed to parse response", raw: result.stdout };
    }
  },
});

export const listDriveFiles = new FunctionTool({
  name: "list_drive_files",
  description: "List files from the user's Google Drive.",
  parameters: z.object({
    query: z.string().optional().describe("Drive search query (e.g. \"name contains 'report'\", \"mimeType='application/pdf'\")"),
    maxResults: z.number().optional().describe("Max files to return (default 10)"),
  }),
  execute: async ({ query, maxResults }) => {
    const params: Record<string, unknown> = {
      pageSize: maxResults ?? 10,
      fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
    };
    if (query) params.q = query;

    const result = await gws(["drive", "files", "list", "--params", JSON.stringify(params)]);

    if (result.exitCode !== 0)
      return { status: "error", error: result.stderr || result.stdout };

    try {
      const data = JSON.parse(result.stdout);
      return { status: "success", files: data.files ?? [] };
    } catch {
      return { status: "error", error: "Failed to parse response", raw: result.stdout };
    }
  },
});

export const readSpreadsheet = new FunctionTool({
  name: "read_spreadsheet",
  description: "Read data from a Google Sheets spreadsheet.",
  parameters: z.object({
    spreadsheetId: z.string().describe("The spreadsheet ID (from the URL)"),
    range: z.string().describe("The A1 notation range to read (e.g. 'Sheet1!A1:C10')"),
  }),
  execute: async ({ spreadsheetId, range }) => {
    const result = await gws([
      "sheets", "spreadsheets", "values", "get",
      "--params", JSON.stringify({ spreadsheetId, range }),
    ]);

    if (result.exitCode !== 0)
      return { status: "error", error: result.stderr || result.stdout };

    try {
      const data = JSON.parse(result.stdout);
      return { status: "success", range: data.range, values: data.values ?? [] };
    } catch {
      return { status: "error", error: "Failed to parse response", raw: result.stdout };
    }
  },
});

export const gwsTools = [
  createEmailDraft,
  listEmails,
  listCalendarEvents,
  createCalendarEvent,
  listDriveFiles,
  readSpreadsheet,
];
