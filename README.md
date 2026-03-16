# AGENTERM
AGENTERM is the next generation interface for knowledge workers. **AGENTERM is the terminal** (where you control the work), **the browser is the IDE** (where you visualize the work).
Built with **Google ADK** + **Gemini 3.1 Flash**, orchestrates **26 tools** across browser control, computer control, and Google Workspace — with push-to-talk voice and multi-tab parallel workflows.

---

## Prerequisites

- **Node.js** >= 18
- **pnpm** (package manager)
- **macOS** (required for computer control tools — AppleScript, Quartz)
- **Chromium-based browser** (Chrome >= 144, Arc, Dia, Brave, Edge)
- **Google Cloud project** with:
    - OAuth 2.0 credentials (Desktop app type)
    - Firestore database in Native mode
    - Gemini API enabled

---

## 1. Clone and Install

```bash
git clone https://github.com/<your-username>/agenterm.git
cd agenterm
pnpm install
```

---

## 2. Environment Variables

Copy the example env file and fill in the values:

```bash
cp .env.exemple .env
```

Edit `.env`:

```bash
GEMINI_API_KEY="your-gemini-api-key"
GOOGLE_CLIENT_ID="your-oauth-client-id"
GOOGLE_CLIENT_SECRET="your-oauth-client-secret"
```

### How to get these values:

**GEMINI_API_KEY:**

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Create a new API key

**GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create an OAuth 2.0 Client ID (Application type: Desktop)
3. Add the required scopes: Gmail, Calendar, Drive, Sheets, Datastore, UserInfo

---

## 3. Google Cloud Setup

### Firestore Database

1. Go to [Firestore Console](https://console.cloud.google.com/firestore)
2. Create a database in **Native mode**
3. Select the `eur3` (or your preferred) region
4. The app uses the GCP project `agy-ai` — update `electron/db.ts` if using a different project

### Enable APIs

Ensure the following APIs are enabled in your GCP project:

- Gemini API (Generative Language)
- Cloud Firestore API
- Gmail API, Calendar API, Drive API, Sheets API

---

## 4. Browser Setup

AGENTERM controls your actual browser via Chrome DevTools Protocol. The `agent-browser` package handles browser discovery automatically.

For Chrome >= 144, remote debugging is available natively. No special launch flags needed.

---

## 5. Run in Development

```bash
pnpm run dev
```

This starts Vite + Electron in development mode with hot reload.

---

## 6. Build for Production

```bash
pnpm run build
```

This compiles TypeScript, builds with Vite, and packages with electron-builder.

Output: `.dmg` (macOS), `.exe` (Windows), `.AppImage` (Linux).

---

## 7. First Launch

1. Open AGENTERM
2. Click the Google icon to sign in via OAuth
3. Grant permissions for Gmail, Calendar, Drive, Sheets
4. Start chatting — type or hold **Ctrl+1** for push-to-talk voice
5. Open new tabs with **+** for parallel workflows

---

## Google Cloud Services Used

- **Google Cloud Firestore** — Conversation and message persistence
- **Gemini API** — AI agent reasoning (3.1 Flash) + vision and voice (2.5 Flash)
- **Google OAuth2** — User authentication and API authorization

---

## Third-Party Packages

- `@google/adk` — Google Agent Development Kit
- `@google/genai` — Google Generative AI SDK
- `@googleworkspace/cli` — Google Workspace CLI for API operations
- `agent-browser` — Browser automation via CDP ([agent-browser.dev](http://agent-browser.dev))
- `electron` — Desktop application framework
- `react` / `tailwindcss` / `shadcn/ui` — Frontend UI
- `chat` / `@chat-adapter/state-memory` — Message routing framework
