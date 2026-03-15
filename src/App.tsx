import { useState, useEffect, useRef, useCallback } from "react";
import DOMPurify from "dompurify";
import { Pin, PinOff, Plus, X, ArrowRight, Unplug, Cable, Mic, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ChatMessage {
  id: string;
  text: string;
  author: "user" | "bot";
  timestamp: number;
  files?: { name: string; mimeType: string }[];
}

interface AttachedFileData {
  name: string;
  mimeType: string;
  data: string;
}

interface Tab {
  id: string;
  label: string;
}

declare global {
  interface Window {
    chatBridge: {
      sendMessage: (tabId: string, text: string, files?: AttachedFileData[]) => void;
      setPinned: (pinned: boolean) => Promise<boolean>;
      onBotMessage: (cb: (data: { id: string; text: string; timestamp: number; tabId: string }) => void) => () => void;
      onBotEdit: (cb: (data: { id: string; text: string; timestamp: number; tabId: string }) => void) => () => void;
      onBotTyping: (cb: (data: { tabId: string }) => void) => () => void;
      getAuthStatus: () => Promise<boolean>;
      connect: () => Promise<boolean>;
      disconnect: () => Promise<void>;
      onAuthChanged: (cb: (connected: boolean) => void) => () => void;
      requestMicPermission: () => Promise<boolean>;
      transcribeAudio: (audioBase64: string, mimeType: string) => Promise<{ text?: string; error?: string }>;
    };
  }
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderMarkdown(text: string) {
  const html = text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="bg-white/10 px-1 py-0.5 rounded text-[13px] font-mono">$1</code>')
    .replace(/\n/g, "<br/>");
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: ["strong", "em", "code", "br"], ALLOWED_ATTR: ["class"] });
}

function TabBar({ tabs, activeId, pinned, connected, onSelect, onClose, onNew, onTogglePin, onToggleConnect }: {
  tabs: Tab[];
  activeId: string;
  pinned: boolean;
  connected: boolean;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
  onTogglePin: () => void;
  onToggleConnect: () => void;
}) {
  return (
    <div
      className="flex items-end h-10 bg-background pl-[78px] pr-1.5 gap-px shrink-0 select-none"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onSelect(tab.id)}
          className={`group relative flex items-center gap-1.5 h-8 px-3 text-xs rounded-t-lg transition-colors cursor-default ${
            tab.id === activeId
              ? "bg-card text-foreground"
              : "text-muted-foreground hover:text-foreground/70 hover:bg-white/[0.03]"
          }`}
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <span className="truncate max-w-28">{tab.label}</span>
          {tabs.length > 1 && (
            <span
              onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
              className="ml-0.5 opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity"
            >
              <X size={10} />
            </span>
          )}
        </button>
      ))}

      <Tooltip>
        <TooltipTrigger render={<div />}>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onNew}
            className="mb-1 text-muted-foreground cursor-default"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            <Plus size={14} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">New chat</TooltipContent>
      </Tooltip>

      <div className="flex-1" />

      <Tooltip>
        <TooltipTrigger render={<div />}>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onToggleConnect}
            className={`mb-1 cursor-default ${connected ? "text-green-400" : "text-muted-foreground"}`}
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            {connected ? <Cable size={13} /> : <Unplug size={13} />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{connected ? "Google connected — click to disconnect" : "Connect Google account"}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger render={<div />}>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onTogglePin}
            className={`mb-1 cursor-default ${pinned ? "text-primary" : "text-muted-foreground"}`}
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            {pinned ? <Pin size={13} /> : <PinOff size={13} />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{pinned ? "Unpin window" : "Pin on top"}</TooltipContent>
      </Tooltip>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce-dot"
          style={{ animationDelay: `${i * 0.16}s` }}
        />
      ))}
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.author === "user";
  const sanitizedHtml = msg.text ? renderMarkdown(msg.text) : "";

  return (
    <div className={`flex gap-2 max-w-[85%] animate-fade-in ${isUser ? "self-end flex-row-reverse" : "self-start"}`}>
      <div
        className={`px-3 py-2 text-[13px] leading-relaxed rounded-2xl ${
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-card border border-border text-foreground rounded-bl-sm"
        }`}
      >
        {msg.files && msg.files.length > 0 && (
          <div className={`flex flex-wrap gap-1 ${msg.text ? "mb-1.5" : ""}`}>
            {msg.files.map((f, i) => (
              <span key={i} className={`inline-flex items-center gap-1 text-[11px] rounded px-1.5 py-0.5 ${isUser ? "bg-white/15" : "bg-secondary"}`}>
                <Paperclip size={10} />
                <span className="truncate max-w-32">{f.name}</span>
              </span>
            ))}
          </div>
        )}
        {sanitizedHtml && (
          <div
            className="break-words [&_strong]:font-semibold"
            dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
          />
        )}
        <time className={`block text-[10px] mt-1 ${isUser ? "text-right text-primary-foreground/40" : "text-muted-foreground"}`}>
          {formatTime(msg.timestamp)}
        </time>
      </div>
    </div>
  );
}

function usePushToTalk(onResult: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const isHolding = useRef(false);

  const startRecording = useCallback(async () => {
    if (isHolding.current) return;
    isHolding.current = true;

    const granted = await window.chatBridge.requestMicPermission().catch(() => false);
    if (!granted) {
      isHolding.current = false;
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      // Use webm/opus which Gemini supports
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(100); // collect chunks every 100ms
      setIsListening(true);
    } catch (err) {
      console.warn("Failed to start recording:", err);
      isHolding.current = false;
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!isHolding.current) return;
    isHolding.current = false;

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      setIsListening(false);
      return;
    }

    // Wait for the recorder to finish flushing data
    const audioBlob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(chunksRef.current, { type: recorder.mimeType }));
      };
      recorder.stop();
    });

    // Stop all microphone tracks
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    setIsListening(false);

    // Skip if too short (< 0.5s of audio ~ very small blob)
    if (audioBlob.size < 1000) return;

    // Convert to base64 and send to Gemini for transcription
    setIsTranscribing(true);
    try {
      const buffer = await audioBlob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      const result = await window.chatBridge.transcribeAudio(base64, "audio/webm");
      if (result.text) onResult(result.text);
      else if (result.error) console.warn("Transcription error:", result.error);
    } catch (err) {
      console.warn("Transcription failed:", err);
    } finally {
      setIsTranscribing(false);
    }
  }, [onResult]);

  // Control key hold detection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Control" && !e.repeat) startRecording();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control") stopRecording();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [startRecording, stopRecording]);

  return { isListening, isTranscribing };
}

let tabCounter = 1;

function App() {
  const [tabs, setTabs] = useState<Tab[]>([{ id: "tab-1", label: "Chat 1" }]);
  const [activeTab, setActiveTab] = useState("tab-1");
  const [messagesByTab, setMessagesByTab] = useState<Record<string, ChatMessage[]>>({ "tab-1": [] });
  const [pinned, setPinned] = useState(false);
  const [connected, setConnected] = useState(false);
  const [input, setInput] = useState("");
  const [isTypingByTab, setIsTypingByTab] = useState<Record<string, boolean>>({});
  const [attachedFiles, setAttachedFiles] = useState<AttachedFileData[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const messages = messagesByTab[activeTab] ?? [];
  const isTyping = isTypingByTab[activeTab] ?? false;

  // Push-to-talk: hold Control to speak, release to send
  const handleVoiceResult = useCallback(
    (text: string) => {
      const tabId = activeTab;
      setMessagesByTab((prev) => ({
        ...prev,
        [tabId]: [
          ...(prev[tabId] ?? []),
          { id: `local_${Date.now()}`, text, author: "user", timestamp: Date.now() },
        ],
      }));
      setIsTypingByTab((prev) => ({ ...prev, [tabId]: true }));
      window.chatBridge.sendMessage(tabId, text);
    },
    [activeTab]
  );

  const { isListening, isTranscribing } = usePushToTalk(handleVoiceResult);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    Promise.all(
      files.map((file) =>
        new Promise<AttachedFileData>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = (reader.result as string).split(",")[1];
            resolve({ name: file.name, mimeType: file.type || "application/octet-stream", data: base64 });
          };
          reader.readAsDataURL(file);
        })
      )
    ).then((results) => setAttachedFiles((prev) => [...prev, ...results]));
    e.target.value = "";
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  useEffect(() => {
    window.chatBridge.getAuthStatus().then(setConnected);
    const offAuth = window.chatBridge.onAuthChanged(setConnected);
    return offAuth;
  }, []);

  useEffect(() => {
    const offMessage = window.chatBridge.onBotMessage((data) => {
      setIsTypingByTab((prev) => ({ ...prev, [data.tabId]: false }));
      setMessagesByTab((prev) => {
        const tabMsgs = prev[data.tabId] ?? [];
        return { ...prev, [data.tabId]: [...tabMsgs, { id: data.id, text: data.text, author: "bot", timestamp: data.timestamp }] };
      });
    });

    const offEdit = window.chatBridge.onBotEdit((data) => {
      setMessagesByTab((prev) => {
        const tabMsgs = prev[data.tabId] ?? [];
        return { ...prev, [data.tabId]: tabMsgs.map((m) => (m.id === data.id ? { ...m, text: data.text, timestamp: data.timestamp } : m)) };
      });
    });

    const offTyping = window.chatBridge.onBotTyping((data) => {
      setIsTypingByTab((prev) => ({ ...prev, [data.tabId]: true }));
      clearTimeout(typingTimeouts.current[data.tabId]);
      typingTimeouts.current[data.tabId] = setTimeout(() => {
        setIsTypingByTab((prev) => ({ ...prev, [data.tabId]: false }));
      }, 3000);
    });

    return () => { offMessage(); offEdit(); offTyping(); };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text && attachedFiles.length === 0) return;

    const tabId = activeTab;
    const files = attachedFiles.length > 0 ? attachedFiles : undefined;
    const filesMeta = files?.map(({ name, mimeType }) => ({ name, mimeType }));
    setMessagesByTab((prev) => ({
      ...prev,
      [tabId]: [...(prev[tabId] ?? []), { id: `local_${Date.now()}`, text, author: "user" as const, timestamp: Date.now(), files: filesMeta }],
    }));
    setInput("");
    setAttachedFiles([]);
    setIsTypingByTab((prev) => ({ ...prev, [tabId]: true }));
    window.chatBridge.sendMessage(tabId, text, files);
    inputRef.current?.focus();
  }, [input, activeTab, attachedFiles]);

  const handleTogglePin = useCallback(async () => {
    const next = !pinned;
    await window.chatBridge.setPinned(next);
    setPinned(next);
  }, [pinned]);

  const handleToggleConnect = useCallback(async () => {
    if (connected)
      await window.chatBridge.disconnect();
    else
      await window.chatBridge.connect();
  }, [connected]);

  const handleNewTab = useCallback(() => {
    tabCounter++;
    const id = `tab-${tabCounter}`;
    setTabs((prev) => [...prev, { id, label: `Chat ${tabCounter}` }]);
    setMessagesByTab((prev) => ({ ...prev, [id]: [] }));
    setActiveTab(id);
  }, []);

  const handleCloseTab = useCallback((id: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (id === activeTab && next.length > 0) {
        const idx = prev.findIndex((t) => t.id === id);
        setActiveTab(next[Math.min(idx, next.length - 1)].id);
      }
      return next;
    });
    setMessagesByTab((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
    setIsTypingByTab((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
    clearTimeout(typingTimeouts.current[id]);
    delete typingTimeouts.current[id];
  }, [activeTab]);

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen w-screen bg-card text-foreground overflow-hidden">
        <TabBar
          tabs={tabs}
          activeId={activeTab}
          pinned={pinned}
          connected={connected}
          onSelect={setActiveTab}
          onClose={handleCloseTab}
          onNew={handleNewTab}
          onTogglePin={handleTogglePin}
          onToggleConnect={handleToggleConnect}
        />

        <ScrollArea className="flex-1 min-h-0">
          <div className="flex flex-col gap-2 px-4 py-3 min-h-full">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center flex-1 min-h-[200px] gap-1 opacity-40">
                <p className="text-sm text-muted-foreground">New conversation</p>
              </div>
            )}

            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}

            {isTyping && (
              <div className="self-start animate-fade-in">
                <div className="bg-card border border-border rounded-2xl rounded-bl-sm">
                  <TypingIndicator />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <footer className="border-t border-border shrink-0">
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 pt-2.5">
              {attachedFiles.map((file, i) => (
                <span key={i} className="inline-flex items-center gap-1 bg-secondary rounded-md px-2 py-1 text-[11px] text-muted-foreground">
                  <Paperclip size={10} />
                  <span className="truncate max-w-32">{file.name}</span>
                  <button onClick={() => handleRemoveFile(i)} className="hover:text-foreground transition-colors">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-2.5">
            {(isListening || isTranscribing) && (
              <div className={`flex items-center gap-1.5 ${isListening ? "text-red-400 animate-pulse" : "text-yellow-400"}`}>
                <Mic size={14} />
                <span className="text-[11px] font-medium">
                  {isListening ? "Recording..." : "Transcribing..."}
                </span>
              </div>
            )}
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 cursor-default text-muted-foreground"
            >
              <Paperclip size={16} />
            </Button>
            <Input
              ref={inputRef}
              placeholder={
                isListening ? "Speak now... (release Control to send)"
                : isTranscribing ? "Transcribing..."
                : "Message... (hold Control to speak)"
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) handleSend();
              }}
              autoFocus
              className={`flex-1 bg-secondary text-[13px] ${isListening ? "border-red-400/50" : isTranscribing ? "border-yellow-400/50" : ""}`}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() && attachedFiles.length === 0}
              className="cursor-default"
            >
              <ArrowRight size={16} strokeWidth={2.5} />
            </Button>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  );
}

export default App;
