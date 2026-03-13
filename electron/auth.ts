import { safeStorage, shell } from "electron";
import { google, type Auth } from "googleapis";
import { createServer, type Server } from "node:http";
import { URL } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
];

const REDIRECT_PORT = 18023;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}`;

let oauth2Client: Auth.OAuth2Client | null = null;

const tokenPath = () => path.join(app.getPath("userData"), "google-token.enc");

function getClient(): Auth.OAuth2Client {
  if (!oauth2Client) {
    oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      REDIRECT_URI,
    );
    google.options({ auth: oauth2Client });

    oauth2Client.on("tokens", (tokens) => {
      if (tokens.refresh_token)
        oauth2Client!.setCredentials(tokens);
      storeToken();
    });
  }
  return oauth2Client;
}

export function getOAuth2Client() {
  return getClient();
}

export function isConnected(): boolean {
  return !!getClient().credentials?.access_token;
}

export async function loadStoredToken(): Promise<boolean> {
  try {
    const filePath = tokenPath();
    if (!fs.existsSync(filePath)) return false;

    const encrypted = fs.readFileSync(filePath);
    const decrypted = safeStorage.decryptString(encrypted);
    const tokens = JSON.parse(decrypted);

    getClient().setCredentials(tokens);
    return true;
  } catch {
    return false;
  }
}

function storeToken(): void {
  const tokens = getClient().credentials;
  if (!tokens) return;

  const json = JSON.stringify(tokens);
  const encrypted = safeStorage.encryptString(json);
  const filePath = tokenPath();

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, encrypted);
}

export function startOAuthFlow(): Promise<boolean> {
  return new Promise((resolve) => {
    const client = getClient();
    const authUrl = client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      prompt: "consent",
    });

    let server: Server | null = null;

    const cleanup = () => {
      server?.close();
      server = null;
    };

    server = createServer(async (req, res) => {
      const url = new URL(req.url ?? "/", `http://localhost:${REDIRECT_PORT}`);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error || !code) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<html><body><h2>Authentication failed.</h2><p>You can close this tab.</p></body></html>");
        cleanup();
        resolve(false);
        return;
      }

      try {
        const { tokens } = await client.getToken(code);
        client.setCredentials(tokens);
        storeToken();

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<html><body><h2>Connected!</h2><p>You can close this tab and return to Agy.</p></body></html>");
        cleanup();
        resolve(true);
      } catch {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<html><body><h2>Authentication failed.</h2><p>You can close this tab.</p></body></html>");
        cleanup();
        resolve(false);
      }
    });

    server.listen(REDIRECT_PORT, "localhost", () => {
      shell.openExternal(authUrl);
    });
  });
}

export function disconnect(): void {
  const client = getClient();
  client.revokeCredentials().catch(() => {});
  client.setCredentials({});

  const filePath = tokenPath();
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}
