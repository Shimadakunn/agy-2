import { google } from "googleapis";
import { FunctionTool } from "@google/adk";
import { z } from "zod";

const gmail = google.gmail("v1");
const calendar = google.calendar("v3");
const drive = google.drive("v3");
const sheets = google.sheets("v4");
const docs = google.docs("v1");
const slides = google.slides("v1");
const tasks = google.tasks("v1");
const forms = google.forms("v1");
const meet = google.meet("v2");

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

// --- Gmail: send + read full ---

export const sendEmail = new FunctionTool({
  name: "send_email",
  description: "Send an email directly from the user's Gmail account.",
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
      const res = await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
      return { status: "success", messageId: res.data.id };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "error", error: message };
    }
  },
});

export const readEmail = new FunctionTool({
  name: "read_email",
  description: "Read the full content of a specific email by its ID.",
  parameters: z.object({
    messageId: z.string().describe("The Gmail message ID"),
  }),
  execute: async ({ messageId }) => {
    try {
      const res = await gmail.users.messages.get({ userId: "me", id: messageId, format: "full" });
      const hdrs = res.data.payload?.headers ?? [];
      const get = (name: string) => hdrs.find((h) => h.name === name)?.value ?? "";

      const extractBody = (payload: any): string => {
        if (payload.body?.data)
          return Buffer.from(payload.body.data, "base64url").toString("utf-8");
        if (payload.parts)
          for (const part of payload.parts)
            if (part.mimeType === "text/plain" && part.body?.data)
              return Buffer.from(part.body.data, "base64url").toString("utf-8");
        return "";
      };

      return {
        status: "success",
        from: get("From"), to: get("To"), subject: get("Subject"), date: get("Date"),
        body: extractBody(res.data.payload),
        labels: res.data.labelIds,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "error", error: message };
    }
  },
});

// --- Drive: write ---

export const uploadDriveFile = new FunctionTool({
  name: "upload_drive_file",
  description: "Create a new file in Google Drive with text content.",
  parameters: z.object({
    name: z.string().describe("File name (e.g. 'report.txt')"),
    content: z.string().describe("Text content of the file"),
    mimeType: z.string().optional().describe("MIME type (default 'text/plain')"),
    folderId: z.string().optional().describe("Parent folder ID in Drive"),
  }),
  execute: async ({ name, content, mimeType, folderId }) => {
    try {
      const res = await drive.files.create({
        requestBody: {
          name,
          mimeType: mimeType ?? "text/plain",
          ...(folderId ? { parents: [folderId] } : {}),
        },
        media: { mimeType: mimeType ?? "text/plain", body: content },
        fields: "id,name,webViewLink",
      });
      return { status: "success", fileId: res.data.id, name: res.data.name, webViewLink: res.data.webViewLink };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "error", error: message };
    }
  },
});

// --- Sheets: write ---

export const writeSpreadsheet = new FunctionTool({
  name: "write_spreadsheet",
  description: "Write data to a Google Sheets spreadsheet.",
  parameters: z.object({
    spreadsheetId: z.string().describe("The spreadsheet ID (from the URL)"),
    range: z.string().describe("The A1 notation range (e.g. 'Sheet1!A1:C10')"),
    values: z.array(z.array(z.string())).describe("2D array of values to write"),
  }),
  execute: async ({ spreadsheetId, range, values }) => {
    try {
      const res = await sheets.spreadsheets.values.update({
        spreadsheetId, range, valueInputOption: "USER_ENTERED",
        requestBody: { values },
      });
      return { status: "success", updatedRange: res.data.updatedRange, updatedCells: res.data.updatedCells };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "error", error: message };
    }
  },
});

// --- Docs ---

export const readDocument = new FunctionTool({
  name: "read_document",
  description: "Read the text content of a Google Docs document.",
  parameters: z.object({
    documentId: z.string().describe("The document ID (from the URL)"),
  }),
  execute: async ({ documentId }) => {
    try {
      const res = await docs.documents.get({ documentId });
      const extractText = (content: any[]): string =>
        content
          .flatMap((block: any) =>
            block.paragraph?.elements?.map((el: any) => el.textRun?.content ?? "") ?? []
          )
          .join("");
      return { status: "success", title: res.data.title, body: extractText(res.data.body?.content ?? []) };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "error", error: message };
    }
  },
});

export const appendToDocument = new FunctionTool({
  name: "append_to_document",
  description: "Append text to the end of a Google Docs document.",
  parameters: z.object({
    documentId: z.string().describe("The document ID"),
    text: z.string().describe("Text to append"),
  }),
  execute: async ({ documentId, text }) => {
    try {
      const doc = await docs.documents.get({ documentId });
      const endIndex = doc.data.body?.content?.at(-1)?.endIndex ?? 1;
      await docs.documents.batchUpdate({
        documentId,
        requestBody: { requests: [{ insertText: { location: { index: endIndex - 1 }, text } }] },
      });
      return { status: "success" };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "error", error: message };
    }
  },
});

// --- Slides ---

export const readPresentation = new FunctionTool({
  name: "read_presentation",
  description: "Read the structure and text content of a Google Slides presentation.",
  parameters: z.object({
    presentationId: z.string().describe("The presentation ID (from the URL)"),
  }),
  execute: async ({ presentationId }) => {
    try {
      const res = await slides.presentations.get({ presentationId });
      const slidesSummary = (res.data.slides ?? []).map((slide, i) => {
        const texts = (slide.pageElements ?? [])
          .flatMap((el) =>
            el.shape?.text?.textElements?.map((te) => te.textRun?.content ?? "").filter(Boolean) ?? []
          );
        return { slideNumber: i + 1, objectId: slide.objectId, texts };
      });
      return { status: "success", title: res.data.title, slideCount: res.data.slides?.length ?? 0, slides: slidesSummary };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "error", error: message };
    }
  },
});

// --- Tasks ---

export const listTaskLists = new FunctionTool({
  name: "list_task_lists",
  description: "List all Google Tasks task lists.",
  parameters: z.object({}),
  execute: async () => {
    try {
      const res = await tasks.tasklists.list({ maxResults: 100 });
      return { status: "success", taskLists: (res.data.items ?? []).map((t) => ({ id: t.id, title: t.title })) };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "error", error: message };
    }
  },
});

export const listTasks = new FunctionTool({
  name: "list_tasks",
  description: "List tasks from a Google Tasks task list.",
  parameters: z.object({
    taskListId: z.string().optional().describe("Task list ID (default: '@default')"),
    showCompleted: z.boolean().optional().describe("Include completed tasks (default false)"),
  }),
  execute: async ({ taskListId, showCompleted }) => {
    try {
      const res = await tasks.tasks.list({
        tasklist: taskListId ?? "@default",
        showCompleted: showCompleted ?? false,
        maxResults: 100,
      });
      return {
        status: "success",
        tasks: (res.data.items ?? []).map((t) => ({
          id: t.id, title: t.title, notes: t.notes, due: t.due, status: t.status,
        })),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "error", error: message };
    }
  },
});

export const createTask = new FunctionTool({
  name: "create_task",
  description: "Create a new task in Google Tasks.",
  parameters: z.object({
    title: z.string().describe("Task title"),
    notes: z.string().optional().describe("Task notes/description"),
    due: z.string().optional().describe("Due date in ISO 8601 (e.g. '2026-03-20T00:00:00Z')"),
    taskListId: z.string().optional().describe("Task list ID (default: '@default')"),
  }),
  execute: async ({ title, notes, due, taskListId }) => {
    try {
      const res = await tasks.tasks.insert({
        tasklist: taskListId ?? "@default",
        requestBody: { title, notes: notes ?? undefined, due: due ?? undefined },
      });
      return { status: "success", taskId: res.data.id, title: res.data.title };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "error", error: message };
    }
  },
});

// --- Forms ---

export const readForm = new FunctionTool({
  name: "read_form",
  description: "Read the structure and questions of a Google Form.",
  parameters: z.object({
    formId: z.string().describe("The form ID (from the URL)"),
  }),
  execute: async ({ formId }) => {
    try {
      const res = await forms.forms.get({ formId });
      const questions = (res.data.items ?? []).map((item) => ({
        itemId: item.itemId,
        title: item.title,
        description: item.description,
        questionType: item.questionItem?.question?.choiceQuestion ? "choice"
          : item.questionItem?.question?.textQuestion ? "text"
          : item.questionItem?.question?.scaleQuestion ? "scale"
          : item.questionItem?.question?.dateQuestion ? "date"
          : "other",
      }));
      return { status: "success", title: res.data.info?.title, description: res.data.info?.description, questions };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "error", error: message };
    }
  },
});

export const listFormResponses = new FunctionTool({
  name: "list_form_responses",
  description: "List responses submitted to a Google Form.",
  parameters: z.object({
    formId: z.string().describe("The form ID"),
  }),
  execute: async ({ formId }) => {
    try {
      const res = await forms.forms.responses.list({ formId });
      return { status: "success", responseCount: res.data.responses?.length ?? 0, responses: res.data.responses ?? [] };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "error", error: message };
    }
  },
});

// --- Meet ---

export const createMeeting = new FunctionTool({
  name: "create_meeting",
  description: "Create a new Google Meet meeting space.",
  parameters: z.object({}),
  execute: async () => {
    try {
      const res = await meet.spaces.create({ requestBody: {} });
      return { status: "success", meetingUri: res.data.meetingUri, meetingCode: res.data.meetingCode, name: res.data.name };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "error", error: message };
    }
  },
});

export const gwsTools = [
  createEmailDraft, listEmails, sendEmail, readEmail,
  listCalendarEvents, createCalendarEvent,
  listDriveFiles, uploadDriveFile,
  readSpreadsheet, writeSpreadsheet,
  readDocument, appendToDocument,
  readPresentation,
  listTaskLists, listTasks, createTask,
  readForm, listFormResponses,
  createMeeting,
];
