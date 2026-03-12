import { EventEmitter } from "node:events";
import type {
  Adapter,
  AdapterPostableMessage,
  ChatInstance,
  EmojiValue,
  FetchOptions,
  FetchResult,
  RawMessage,
  ThreadInfo,
  WebhookOptions,
} from "chat";
import { Message, BaseFormatConverter, parseMarkdown, stringifyMarkdown } from "chat";
import type { Root } from "chat";

interface LocalThreadId {
  channelId: string;
  threadId?: string;
}

interface LocalRawMessage {
  id: string;
  text: string;
  author: string;
  timestamp: number;
}

function extractText(message: AdapterPostableMessage): string {
  if (typeof message === "string") return message;
  if ("markdown" in message) return message.markdown;
  if ("raw" in message) return message.raw;
  return "";
}

class LocalFormatConverter extends BaseFormatConverter {
  toAst(text: string): Root {
    return parseMarkdown(text);
  }
  fromAst(ast: Root): string {
    return stringifyMarkdown(ast);
  }
}

const THREAD_ID = "local:main";
const CHANNEL_ID = "local:main";

export class LocalAdapter implements Adapter<LocalThreadId, LocalRawMessage> {
  readonly name = "local";
  readonly userName: string;
  readonly botUserId = "bot";

  private chat: ChatInstance | null = null;
  private converter = new LocalFormatConverter();
  private messages: LocalRawMessage[] = [];
  private msgCounter = 0;

  readonly events = new EventEmitter();

  constructor(userName = "Bot") {
    this.userName = userName;
  }

  async initialize(chat: ChatInstance): Promise<void> {
    this.chat = chat;
  }

  encodeThreadId(data: LocalThreadId): string {
    return data.threadId ? `local:${data.channelId}:${data.threadId}` : `local:${data.channelId}`;
  }

  decodeThreadId(threadId: string): LocalThreadId {
    const parts = threadId.split(":");
    return { channelId: parts[1] || "main", threadId: parts[2] };
  }

  channelIdFromThreadId(threadId: string): string {
    const parts = threadId.split(":");
    return `local:${parts[1] || "main"}`;
  }

  async handleWebhook(_request: Request, _options?: WebhookOptions): Promise<Response> {
    return new Response("OK", { status: 200 });
  }

  parseMessage(raw: LocalRawMessage): Message<LocalRawMessage> {
    return new Message({
      id: raw.id,
      threadId: THREAD_ID,
      text: raw.text,
      formatted: this.converter.toAst(raw.text),
      raw,
      author: {
        userId: raw.author,
        userName: raw.author,
        fullName: raw.author,
        isBot: raw.author === "bot",
        isMe: raw.author === "bot",
      },
      metadata: {
        dateSent: new Date(raw.timestamp),
        edited: false,
      },
      attachments: [],
    });
  }

  async postMessage(_threadId: string, message: AdapterPostableMessage): Promise<RawMessage<LocalRawMessage>> {
    const id = `msg_${++this.msgCounter}`;
    const text = extractText(message);

    const raw: LocalRawMessage = { id, text, author: "bot", timestamp: Date.now() };
    this.messages.push(raw);
    this.events.emit("bot-message", { id, text, timestamp: raw.timestamp });

    return { raw, id, threadId: THREAD_ID };
  }

  async editMessage(_threadId: string, messageId: string, message: AdapterPostableMessage): Promise<RawMessage<LocalRawMessage>> {
    const text = extractText(message);
    const existing = this.messages.find((m) => m.id === messageId);
    if (existing) {
      existing.text = text;
      existing.timestamp = Date.now();
    }

    const raw: LocalRawMessage = existing ?? { id: messageId, text, author: "bot", timestamp: Date.now() };
    this.events.emit("bot-edit", { id: messageId, text, timestamp: raw.timestamp });

    return { raw, id: messageId, threadId: THREAD_ID };
  }

  async deleteMessage(_threadId: string, messageId: string): Promise<void> {
    this.messages = this.messages.filter((m) => m.id !== messageId);
    this.events.emit("bot-delete", { id: messageId });
  }

  async addReaction(_threadId: string, _messageId: string, _emoji: EmojiValue | string): Promise<void> {}
  async removeReaction(_threadId: string, _messageId: string, _emoji: EmojiValue | string): Promise<void> {}

  async fetchMessages(_threadId: string, _options?: FetchOptions): Promise<FetchResult<LocalRawMessage>> {
    return { messages: this.messages.map((m) => this.parseMessage(m)), nextCursor: undefined };
  }

  async fetchThread(threadId: string): Promise<ThreadInfo> {
    return { id: threadId, channelId: CHANNEL_ID, metadata: {} };
  }

  async startTyping(_threadId: string): Promise<void> {
    this.events.emit("bot-typing");
  }

  renderFormatted(content: Root): string {
    return this.converter.fromAst(content);
  }

  async injectUserMessage(text: string): Promise<void> {
    if (!this.chat) return;

    const id = `user_${++this.msgCounter}`;
    const raw: LocalRawMessage = { id, text, author: "user", timestamp: Date.now() };
    this.messages.push(raw);

    const factory = async () => {
      const msg = this.parseMessage(raw);
      msg.isMention = true;
      return msg;
    };

    this.chat.processMessage(this, THREAD_ID, factory);
  }
}
