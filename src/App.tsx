import { useState, useEffect, useRef, useCallback } from "react";
import DOMPurify from "dompurify";
import { Pin, PinOff, Plus, X, ArrowRight, Unplug, Cable } from "lucide-react";
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
}

interface Tab {
  id: string;
  label: string;
}

declare global {
  interface Window {
    chatBridge: {
      sendMessage: (text: string) => void;
      setPinned: (pinned: boolean) => Promise<boolean>;
      onBotMessage: (cb: (data: { id: string; text: string; timestamp: number }) => void) => () => void;
      onBotEdit: (cb: (data: { id: string; text: string; timestamp: number }) => void) => () => void;
      onBotTyping: (cb: () => void) => () => void;
      getAuthStatus: () => Promise<boolean>;
      connect: () => Promise<boolean>;
      disconnect: () => Promise<void>;
      onAuthChanged: (cb: (connected: boolean) => void) => () => void;
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

  return (
    <div className={`flex gap-2 max-w-[85%] animate-fade-in ${isUser ? "self-end flex-row-reverse" : "self-start"}`}>
      <div
        className={`px-3 py-2 text-[13px] leading-relaxed rounded-2xl ${
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-card border border-border text-foreground rounded-bl-sm"
        }`}
      >
        <div
          className="break-words [&_strong]:font-semibold"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }}
        />
        <time className={`block text-[10px] mt-1 ${isUser ? "text-right text-primary-foreground/40" : "text-muted-foreground"}`}>
          {formatTime(msg.timestamp)}
        </time>
      </div>
    </div>
  );
}

let tabCounter = 1;

function App() {
  const [tabs, setTabs] = useState<Tab[]>([{ id: "tab-1", label: "Chat 1" }]);
  const [activeTab, setActiveTab] = useState("tab-1");
  const [messagesByTab, setMessagesByTab] = useState<Record<string, ChatMessage[]>>({ "tab-1": [] });
  const [pinned, setPinned] = useState(false);
  const [connected, setConnected] = useState(false);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout>>();

  const messages = messagesByTab[activeTab] ?? [];

  useEffect(() => {
    window.chatBridge.getAuthStatus().then(setConnected);
    const offAuth = window.chatBridge.onAuthChanged(setConnected);
    return offAuth;
  }, []);

  useEffect(() => {
    const offMessage = window.chatBridge.onBotMessage((data) => {
      setIsTyping(false);
      setMessagesByTab((prev) => {
        const tabMsgs = prev[activeTab] ?? [];
        return { ...prev, [activeTab]: [...tabMsgs, { id: data.id, text: data.text, author: "bot", timestamp: data.timestamp }] };
      });
    });

    const offEdit = window.chatBridge.onBotEdit((data) => {
      setMessagesByTab((prev) => {
        const tabMsgs = prev[activeTab] ?? [];
        return { ...prev, [activeTab]: tabMsgs.map((m) => (m.id === data.id ? { ...m, text: data.text, timestamp: data.timestamp } : m)) };
      });
    });

    const offTyping = window.chatBridge.onBotTyping(() => {
      setIsTyping(true);
      clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => setIsTyping(false), 3000);
    });

    return () => { offMessage(); offEdit(); offTyping(); };
  }, [activeTab]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;

    setMessagesByTab((prev) => ({ ...prev, [activeTab]: [...(prev[activeTab] ?? []), { id: `local_${Date.now()}`, text, author: "user", timestamp: Date.now() }] }));
    setInput("");
    setIsTyping(true);
    window.chatBridge.sendMessage(text);
    inputRef.current?.focus();
  }, [input, activeTab]);

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

        <ScrollArea className="flex-1">
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

        <footer className="flex items-center gap-2 px-3 py-2.5 border-t border-border shrink-0">
          <Input
            ref={inputRef}
            placeholder="Message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) handleSend();
            }}
            autoFocus
            className="flex-1 bg-secondary text-[13px]"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim()}
            className="cursor-default"
          >
            <ArrowRight size={16} strokeWidth={2.5} />
          </Button>
        </footer>
      </div>
    </TooltipProvider>
  );
}

export default App;
