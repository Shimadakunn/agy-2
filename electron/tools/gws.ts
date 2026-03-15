import { google } from "googleapis";
import { FunctionTool } from "@google/adk";
import { z } from "zod";

const gmail = google.gmail("v1");
const calendar = google.calendar("v3");
const drive = google.drive("v3");
const sheets = google.sheets("v4");

export const createEmailDraft = new FunctionTool({
  name: "create_email_draft",
  description:
    "Create a Gmail draft email. Returns the draft ID. After creating, open Gmail drafts in the browser so the user can review and send manually.",
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

    try {
      const res = await gmail.users.drafts.create({
        userId: "me",
        requestBody: { message: { raw } },
      });
      return { status: "success", draftId: res.data.id, messageId: res.data.message?.id };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "error", error: message };
    }
  },
});

export const listEmails = new FunctionTool({
  name: "list_emails",
  description: "List recent emails from the user's Gmail inbox. Returns subject, sender, snippet, and date.",
  parameters: z.object({
    query: z.string().optional().describe("Gmail search query (e.g. 'from:alice', 'is:unread', 'subject:report')"),
    maxResults: z.number().optional().describe("Max number of emails to return (default 10)"),
  }),
  execute: async ({ query, maxResults }) => {
    try {
      const list = await gmail.users.messages.list({
        userId: "me",
        maxResults: maxResults ?? 10,
        q: query ?? undefined,
      });

      const messages = list.data.messages ?? [];
      if (messages.length === 0)
        return { status: "success", messages: [], note: "No emails found" };

      const details = await Promise.all(
        messages.map(async (msg) => {
          try {
            const detail = await gmail.users.messages.get({
              userId: "me",
              id: msg.id!,
              format: "metadata",
              metadataHeaders: ["From", "Subject", "Date"],
            });
            const headers = detail.data.payload?.headers ?? [];
            const get = (name: string) => headers.find((h) => h.name === name)?.value ?? "";
            return { id: msg.id, from: get("From"), subject: get("Subject"), date: get("Date"), snippet: detail.data.snippet };
          } catch {
            return null;
          }
        })
      );

      return { status: "success", messages: details.filter(Boolean) };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "error", error: message };
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

    try {
      const res = await calendar.events.list({
        calendarId: "primary",
        timeMin: now.toISOString(),
        timeMax: future.toISOString(),
        maxResults: maxResults ?? 10,
        singleEvents: true,
        orderBy: "startTime",
      });

      const events = (res.data.items ?? []).map((e) => ({
        id: e.id,
        summary: e.summary,
        start: e.start?.dateTime ?? e.start?.date,
        end: e.end?.dateTime ?? e.end?.date,
        location: e.location,
        htmlLink: e.htmlLink,
      }));

      return { status: "success", events };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "error", error: message };
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
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    try {
      const res = await calendar.events.insert({
        calendarId: "primary",
        requestBody: {
          summary,
          start: { dateTime: startDateTime, timeZone },
          end: { dateTime: endDateTime, timeZone },
          description: description ?? undefined,
          location: location ?? undefined,
          attendees: attendees?.map((email) => ({ email })),
        },
      });

      return { status: "success", eventId: res.data.id, htmlLink: res.data.htmlLink };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "error", error: message };
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
    try {
      const res = await drive.files.list({
        pageSize: maxResults ?? 10,
        fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
        q: query ?? undefined,
      });

      return { status: "success", files: res.data.files ?? [] };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "error", error: message };
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
    try {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
      return { status: "success", range: res.data.range, values: res.data.values ?? [] };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "error", error: message };
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
