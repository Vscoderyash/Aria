import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, MessageSquare, ChevronDown, Send, GitCommit,
  CheckCircle, XCircle, Loader2, Copy, Check, Github,
  Cpu, Zap, ChevronRight, Menu, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListConversations,
  useGetConversation,
  useListMessages,
  useCreateConversation,
  useListAgents,
  getListConversationsQueryKey,
  getListMessagesQueryKey,
} from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const AGENT_ICONS: Record<string, string> = {
  architect: "Ar", frontend: "Fe", backend: "Be", security: "Se",
  performance: "Pe", testing: "Te", documentation: "Do", research: "Re",
};

const AGENT_COLORS: Record<string, string> = {
  architect: "from-amber-500 to-yellow-600",
  frontend: "from-blue-500 to-indigo-600",
  backend: "from-emerald-500 to-teal-600",
  security: "from-red-500 to-rose-600",
  performance: "from-purple-500 to-violet-600",
  testing: "from-cyan-500 to-sky-600",
  documentation: "from-orange-500 to-amber-600",
  research: "from-pink-500 to-fuchsia-600",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="absolute top-2 right-2 p-1.5 rounded bg-white/10 hover:bg-white/20 transition-colors text-white/60 hover:text-white"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

interface GitHubAction {
  action: string;
  filename: string;
  content: string;
  message: string;
}

interface GitHubCommitModalProps {
  action: GitHubAction;
  onClose: () => void;
}

function GitHubCommitModal({ action, onClose }: GitHubCommitModalProps) {
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; url?: string; error?: string } | null>(null);

  const handleCommit = async () => {
    if (!owner || !repo) return;
    setCommitting(true);
    try {
      const res = await fetch(`${BASE}/api/github/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo, branch, filename: action.filename, content: action.content, message: action.message }),
      });
      const data = await res.json();
      if (res.ok) setResult({ success: true, url: data.url });
      else setResult({ success: false, error: data.error });
    } catch (e) {
      setResult({ success: false, error: "Network error" });
    }
    setCommitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#0f0f1a] border border-white/10 rounded-xl w-full max-w-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
              <Github className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Commit to GitHub</h3>
              <p className="text-xs text-white/40 font-mono">{action.filename}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        {result ? (
          <div className="p-5">
            {result.success ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <CheckCircle className="w-10 h-10 text-emerald-400" />
                <p className="font-medium">Committed successfully</p>
                <a href={result.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">{result.url}</a>
                <Button onClick={onClose} size="sm" className="mt-2">Done</Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <XCircle className="w-10 h-10 text-red-400" />
                <p className="font-medium">Commit failed</p>
                <p className="text-xs text-white/40">{result.error}</p>
                <Button onClick={() => setResult(null)} size="sm" variant="outline" className="mt-2">Try again</Button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div>
              <p className="text-xs text-white/50 mb-3">Commit message: <span className="text-white/70 font-mono">{action.message}</span></p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Owner / Org</label>
                <input
                  value={owner} onChange={(e) => setOwner(e.target.value)}
                  placeholder="username"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Repository</label>
                <input
                  value={repo} onChange={(e) => setRepo(e.target.value)}
                  placeholder="repo-name"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1.5 block">Branch</label>
              <input
                value={branch} onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono"
              />
            </div>
            <Button
              onClick={handleCommit}
              disabled={!owner || !repo || committing}
              className="w-full bg-primary text-primary-foreground font-semibold"
            >
              {committing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Committing...</> : <><GitCommit className="w-4 h-4 mr-2" /> Commit file</>}
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

interface Message {
  id: number;
  role: string;
  content: string;
  agentId?: string | null;
  tokensUsed?: number | null;
  createdAt: string;
  githubAction?: GitHubAction | null;
}

interface StreamingMessage {
  content: string;
  agentId: string;
}

export default function Chat() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const activeConversationId = params.id ? parseInt(params.id) : undefined;

  const { data: conversations = [] } = useListConversations();
  const { data: agents = [] } = useListAgents();
  const { data: activeConversation } = useGetConversation(activeConversationId as number, {
    query: { enabled: !!activeConversationId },
  });
  const { data: serverMessages = [] } = useListMessages(activeConversationId as number, {
    query: { enabled: !!activeConversationId, queryKey: getListMessagesQueryKey(activeConversationId as number) },
  });

  const createConversation = useCreateConversation();

  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState<StreamingMessage | null>(null);
  const [input, setInput] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("architect");
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
  const [pendingGithubAction, setPendingGithubAction] = useState<GitHubAction | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const prevConvIdRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (prevConvIdRef.current !== activeConversationId) {
      prevConvIdRef.current = activeConversationId;
      setMessages(serverMessages.map((m) => ({ ...m, agentId: m.agentId ?? null, tokensUsed: m.tokensUsed ?? null })));
    } else if (serverMessages.length !== messages.length) {
      setMessages(serverMessages.map((m) => ({ ...m, agentId: m.agentId ?? null, tokensUsed: m.tokensUsed ?? null })));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverMessages, activeConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  useEffect(() => {
    if (activeConversation?.agentId) setSelectedAgent(activeConversation.agentId);
  }, [activeConversation]);

  const autoResize = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  };

  const handleNewChat = () => {
    createConversation.mutate(
      { data: { title: "New conversation", agentId: selectedAgent } },
      {
        onSuccess: (newConv) => {
          queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
          setLocation(`/chat/${newConv.id}`);
        },
      }
    );
  };

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || !activeConversationId || streaming) return;

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const tempUserMsg: Message = {
      id: Date.now(),
      role: "user",
      content,
      agentId: selectedAgent,
      tokensUsed: null,
      createdAt: new Date().toISOString(),
      githubAction: null,
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setStreaming({ content: "", agentId: selectedAgent });

    abortRef.current = new AbortController();

    try {
      const res = await fetch(`${BASE}/api/ai/conversations/${activeConversationId}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, agentId: selectedAgent }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        setStreaming(null);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const evt = JSON.parse(raw);
            if (evt.type === "delta") {
              setStreaming((prev) => prev ? { ...prev, content: prev.content + evt.content } : prev);
            } else if (evt.type === "done") {
              setStreaming(null);
              if (evt.github_action) setPendingGithubAction(evt.github_action);
              queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(activeConversationId) });
              queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
            } else if (evt.type === "error") {
              setStreaming(null);
            }
          } catch {}
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") setStreaming(null);
    }
  }, [input, activeConversationId, selectedAgent, streaming, queryClient]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const activeAgent = agents.find((a) => a.id === selectedAgent);
  const allMessages = messages;

  const renderContent = (content: string) => {
    const cleanContent = content.replace(/<github_action>[\s\S]*?<\/github_action>/g, "").trim();
    return (
      <ReactMarkdown
        components={{
          code({ className, children, ...props }: React.ComponentPropsWithoutRef<'code'> & { inline?: boolean }) {
            const match = /language-(\w+)/.exec(className || "");
            const isBlock = !!match;
            if (isBlock) {
              return (
                <div className="relative group my-3">
                  <div className="flex items-center justify-between bg-white/5 px-4 py-1.5 rounded-t-lg border-b border-white/10">
                    <span className="text-xs text-white/40 font-mono">{match[1]}</span>
                    <CopyButton text={String(children)} />
                  </div>
                  <SyntaxHighlighter
                    style={vscDarkPlus as Record<string, React.CSSProperties>}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{ margin: 0, borderRadius: "0 0 8px 8px", background: "rgba(0,0,0,0.4)", fontSize: "13px" }}
                  >
                    {String(children).replace(/\n$/, "")}
                  </SyntaxHighlighter>
                </div>
              );
            }
            return <code className="bg-white/10 rounded px-1.5 py-0.5 text-[13px] font-mono text-amber-300" {...props}>{children}</code>;
          },
          p: ({ children }) => <p className="mb-3 last:mb-0 leading-7">{children}</p>,
          ul: ({ children }) => <ul className="mb-3 space-y-1.5 pl-5 list-disc marker:text-white/30">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 space-y-1.5 pl-5 list-decimal marker:text-white/30">{children}</ol>,
          li: ({ children }) => <li className="leading-6">{children}</li>,
          h1: ({ children }) => <h1 className="text-xl font-bold mt-5 mb-3">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-bold mt-4 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-semibold mt-3 mb-2 text-white/90">{children}</h3>,
          blockquote: ({ children }) => <blockquote className="border-l-2 border-primary/40 pl-4 text-white/60 italic my-3">{children}</blockquote>,
          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
          a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer" className="text-primary hover:underline">{children}</a>,
        }}
      >
        {cleanContent}
      </ReactMarkdown>
    );
  };

  return (
    <div className="flex h-screen bg-[#0a0a0f] text-white overflow-hidden">
      {pendingGithubAction && (
        <GitHubCommitModal action={pendingGithubAction} onClose={() => setPendingGithubAction(null)} />
      )}

      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-shrink-0 border-r border-white/[0.06] bg-[#0d0d15] flex flex-col overflow-hidden"
          >
            <div className="p-4 flex items-center justify-between">
              <Link href="/">
                <div className="flex items-center gap-2.5 cursor-pointer">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-black font-black text-xs">A</div>
                  <span className="font-bold tracking-tight text-sm">ARIA</span>
                  <span className="text-[10px] text-white/30 font-medium tracking-widest uppercase">Gold</span>
                </div>
              </Link>
              <button onClick={() => setSidebarOpen(false)} className="text-white/30 hover:text-white/60 p-1">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="px-3 pb-3">
              <button
                onClick={handleNewChat}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 border border-white/[0.06] hover:border-white/10 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>New chat</span>
              </button>
            </div>

            <ScrollArea className="flex-1 px-2">
              <div className="py-1">
                <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest px-3 py-2">Conversations</p>
                {conversations.map((conv) => (
                  <Link key={conv.id} href={`/chat/${conv.id}`}>
                    <button
                      className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all group ${
                        activeConversationId === conv.id
                          ? "bg-white/8 text-white"
                          : "text-white/50 hover:text-white/80 hover:bg-white/4"
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
                      <span className="truncate flex-1">{conv.title}</span>
                    </button>
                  </Link>
                ))}
              </div>
            </ScrollArea>

            <div className="p-3 border-t border-white/[0.06]">
              <Link href="/owner">
                <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/40 hover:text-white/70 hover:bg-white/4 transition-all">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Owner panel</span>
                </button>
              </Link>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
          {!sidebarOpen && (
            <button onClick={() => setSidebarOpen(true)} className="text-white/30 hover:text-white/60 p-1">
              <Menu className="w-4 h-4" />
            </button>
          )}

          {/* Agent selector */}
          <div className="relative">
            <button
              onClick={() => setAgentMenuOpen((v) => !v)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/8 border border-white/[0.08] text-sm transition-all"
            >
              <div className={`w-5 h-5 rounded bg-gradient-to-br ${AGENT_COLORS[selectedAgent] ?? "from-amber-500 to-yellow-600"} flex items-center justify-center text-[9px] font-bold text-white`}>
                {AGENT_ICONS[selectedAgent] ?? "A"}
              </div>
              <span className="text-white/80">{activeAgent?.name ?? "Select agent"}</span>
              <ChevronDown className="w-3.5 h-3.5 text-white/40" />
            </button>

            <AnimatePresence>
              {agentMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full left-0 mt-1.5 w-64 bg-[#13131f] border border-white/10 rounded-xl shadow-2xl z-30 overflow-hidden py-1"
                >
                  {agents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => { setSelectedAgent(agent.id); setAgentMenuOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-white/5 transition-colors ${selectedAgent === agent.id ? "text-white" : "text-white/60"}`}
                    >
                      <div className={`w-6 h-6 rounded bg-gradient-to-br ${AGENT_COLORS[agent.id] ?? "from-amber-500 to-yellow-600"} flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0`}>
                        {AGENT_ICONS[agent.id] ?? "A"}
                      </div>
                      <div className="text-left min-w-0">
                        <div className="font-medium truncate">{agent.name}</div>
                        <div className="text-[11px] text-white/30 truncate">{agent.role}</div>
                      </div>
                      {selectedAgent === agent.id && <Check className="w-3.5 h-3.5 text-primary ml-auto flex-shrink-0" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {activeConversation && (
            <span className="text-sm text-white/30 truncate hidden sm:block">{activeConversation.title}</span>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {!activeConversationId ? (
            <div className="h-full flex flex-col items-center justify-center px-4">
              <div className="max-w-xl w-full text-center space-y-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-black font-black text-2xl mx-auto shadow-lg shadow-amber-500/20">A</div>
                <div>
                  <h1 className="text-2xl font-bold mb-2">Good to see you</h1>
                  <p className="text-white/40 text-sm leading-relaxed">
                    ARIA is your autonomous AI engineering team. Ask me to write code, review architecture, fix bugs, or commit changes directly to your GitHub repo.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-left">
                  {[
                    "Write a React hook for infinite scroll",
                    "Find security vulnerabilities in my auth code",
                    "Optimize my database queries",
                    "Generate unit tests for my API routes",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        handleNewChat();
                        setInput(suggestion);
                      }}
                      className="p-3 rounded-xl bg-white/4 hover:bg-white/7 border border-white/[0.06] text-left text-sm text-white/60 hover:text-white/80 transition-all"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
                <Button onClick={handleNewChat} className="bg-primary text-primary-foreground font-semibold">
                  Start new chat
                </Button>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
              <AnimatePresence initial={false}>
                {allMessages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role !== "user" && (
                      <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${AGENT_COLORS[msg.agentId ?? "architect"] ?? "from-amber-500 to-yellow-600"} flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5 shadow-lg`}>
                        {AGENT_ICONS[msg.agentId ?? "architect"] ?? "A"}
                      </div>
                    )}

                    <div className={`min-w-0 ${msg.role === "user" ? "max-w-[80%]" : "flex-1"}`}>
                      {msg.role === "user" ? (
                        <div className="bg-white/8 border border-white/[0.08] rounded-2xl px-4 py-3 text-sm leading-relaxed text-white/90">
                          {msg.content}
                        </div>
                      ) : (
                        <div className="text-sm text-white/85 leading-relaxed">
                          {renderContent(msg.content)}
                          {msg.githubAction && (
                            <button
                              onClick={() => setPendingGithubAction(msg.githubAction!)}
                              className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/8 border border-white/10 text-xs text-white/60 hover:text-white transition-all"
                            >
                              <GitCommit className="w-3.5 h-3.5 text-primary" />
                              Commit <span className="font-mono text-white/40">{msg.githubAction.filename}</span>
                              <ChevronRight className="w-3 h-3 ml-auto" />
                            </button>
                          )}
                          {msg.tokensUsed && (
                            <div className="flex items-center gap-1 mt-3 text-[11px] text-white/20">
                              <Zap className="w-3 h-3" />
                              {msg.tokensUsed} tokens
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {msg.role === "user" && (
                      <div className="w-8 h-8 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center text-[11px] font-semibold flex-shrink-0 mt-0.5">
                        U
                      </div>
                    )}
                  </motion.div>
                ))}

                {streaming && (
                  <motion.div
                    key="streaming"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-4"
                  >
                    <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${AGENT_COLORS[streaming.agentId] ?? "from-amber-500 to-yellow-600"} flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5 shadow-lg`}>
                      {AGENT_ICONS[streaming.agentId] ?? "A"}
                    </div>
                    <div className="flex-1 text-sm text-white/85 leading-relaxed">
                      {streaming.content ? (
                        renderContent(streaming.content)
                      ) : (
                        <div className="flex items-center gap-1.5 py-2">
                          {[0, 0.15, 0.3].map((delay, i) => (
                            <motion.div
                              key={i}
                              animate={{ opacity: [0.3, 1, 0.3] }}
                              transition={{ repeat: Infinity, duration: 1.2, delay, ease: "easeInOut" }}
                              className="w-1.5 h-1.5 rounded-full bg-primary/60"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        {activeConversationId && (
          <div className="px-4 pb-6 pt-2">
            <div className="max-w-3xl mx-auto">
              <div className="relative bg-[#13131f] border border-white/[0.09] rounded-2xl shadow-xl focus-within:border-white/20 transition-colors">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => { setInput(e.target.value); autoResize(); }}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message ${activeAgent?.name ?? "ARIA"}…`}
                  rows={1}
                  disabled={!!streaming}
                  className="w-full bg-transparent resize-none px-4 pt-3.5 pb-3 pr-14 text-sm text-white/90 placeholder:text-white/25 focus:outline-none leading-relaxed max-h-[200px] overflow-y-auto disabled:opacity-50"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || !!streaming}
                  className="absolute right-3 bottom-3 w-8 h-8 rounded-xl bg-primary flex items-center justify-center disabled:opacity-30 hover:bg-primary/80 transition-all disabled:cursor-not-allowed"
                >
                  {streaming ? (
                    <Loader2 className="w-4 h-4 text-primary-foreground animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5 text-primary-foreground" />
                  )}
                </button>
              </div>
              <p className="text-center text-[11px] text-white/20 mt-2.5">
                Enter to send · Shift+Enter for new line · ARIA can commit code directly to GitHub
              </p>
            </div>
          </div>
        )}
      </div>

      {agentMenuOpen && (
        <div className="fixed inset-0 z-20" onClick={() => setAgentMenuOpen(false)} />
      )}
    </div>
  );
}
