import React, { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Folder, GitBranch, Terminal, Activity, Brain, Box, Play, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  useListRepositories, 
  useListAgents,
  useGetOwnerStats
} from "@workspace/api-client-react";

export default function Workspace() {
  const { data: repositories = [] } = useListRepositories();
  const { data: agents = [] } = useListAgents();
  const { data: stats } = useGetOwnerStats();
  const [activeRepoId, setActiveRepoId] = useState<number | null>(null);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {/* Header */}
      <header className="h-12 border-b border-white/5 bg-background flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Link href="/">
            <div className="w-6 h-6 rounded bg-gradient-gold flex items-center justify-center font-bold text-background text-xs cursor-pointer">A</div>
          </Link>
          <div className="h-4 w-px bg-white/10" />
          <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <span className="text-foreground">Workspace</span>
            <span className="text-white/20">/</span>
            <span>{repositories.find(r => r.id === activeRepoId)?.name || "No Repository Selected"}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-2" />
            System Online
          </Badge>
          <Link href="/owner">
            <Button variant="ghost" size="sm" className="h-8">Admin</Button>
          </Link>
        </div>
      </header>

      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Left Panel: Files & Repos */}
        <ResizablePanel defaultSize={20} minSize={15} maxSize={30} className="bg-card/20 flex flex-col border-r border-white/5">
          <div className="p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground border-b border-white/5">
            Repositories
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {repositories.map(repo => (
                <button
                  key={repo.id}
                  onClick={() => setActiveRepoId(repo.id)}
                  className={`w-full flex items-center gap-2 p-2 rounded text-sm text-left transition-colors ${
                    activeRepoId === repo.id 
                      ? "bg-primary/10 text-primary" 
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  }`}
                >
                  <Folder className={`w-4 h-4 ${activeRepoId === repo.id ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="truncate">{repo.name}</span>
                </button>
              ))}
            </div>
          </ScrollArea>

          <div className="p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground border-t border-white/5 bg-background/50">
            Active Agent
          </div>
          <div className="p-3 bg-background/50 border-t border-white/5">
            {agents[0] && (
              <div className="bg-white/5 rounded border border-white/5 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">{agents[0].name}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Status: <span className="text-emerald-400">{agents[0].status}</span>
                </div>
              </div>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle className="w-px bg-white/5 hover:bg-primary transition-colors" />

        {/* Center Panel: Main Workspace */}
        <ResizablePanel defaultSize={55} minSize={30} className="flex flex-col bg-background relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none"></div>
          
          <Tabs defaultValue="editor" className="flex-1 flex flex-col">
            <div className="h-10 border-b border-white/5 flex items-center px-2 bg-card/20 z-10">
              <TabsList className="bg-transparent h-8">
                <TabsTrigger value="editor" className="data-[state=active]:bg-white/5 data-[state=active]:text-foreground text-muted-foreground">Editor</TabsTrigger>
                <TabsTrigger value="chat" className="data-[state=active]:bg-white/5 data-[state=active]:text-foreground text-muted-foreground">Agent Chat</TabsTrigger>
                <TabsTrigger value="diff" className="data-[state=active]:bg-white/5 data-[state=active]:text-foreground text-muted-foreground">PR Diff</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="editor" className="flex-1 m-0 p-0 overflow-hidden relative z-10">
              <div className="h-full flex items-center justify-center text-muted-foreground flex-col gap-4">
                <Terminal className="w-12 h-12 opacity-20" />
                <p>Select a file to edit or ask ARIA to generate code.</p>
              </div>
            </TabsContent>
            
            <TabsContent value="chat" className="flex-1 m-0 p-0 bg-card/30">
               {/* Simplified Chat View inside Workspace */}
               <div className="h-full flex flex-col p-6 items-center justify-center">
                  <h3 className="text-xl font-medium mb-2">Workspace Chat</h3>
                  <p className="text-muted-foreground">Context is automatically synced with the selected repository.</p>
                  <Link href="/chat" className="mt-4">
                    <Button variant="outline" className="border-primary/30 text-primary">Open Full Console</Button>
                  </Link>
               </div>
            </TabsContent>
            
            <TabsContent value="diff" className="flex-1 m-0 p-0">
               <div className="h-full flex items-center justify-center text-muted-foreground">
                 No active pull requests to review.
               </div>
            </TabsContent>
          </Tabs>
        </ResizablePanel>

        <ResizableHandle className="w-px bg-white/5 hover:bg-primary transition-colors" />

        {/* Right Panel: Operations & Memory */}
        <ResizablePanel defaultSize={25} minSize={20} maxSize={35} className="bg-card/20 flex flex-col border-l border-white/5">
          <Tabs defaultValue="activity" className="flex-1 flex flex-col">
            <div className="h-10 border-b border-white/5 flex items-center px-2">
              <TabsList className="bg-transparent h-8 w-full justify-start">
                <TabsTrigger value="activity" className="data-[state=active]:bg-white/5 data-[state=active]:text-foreground text-muted-foreground text-xs uppercase tracking-wider">Activity</TabsTrigger>
                <TabsTrigger value="memory" className="data-[state=active]:bg-white/5 data-[state=active]:text-foreground text-muted-foreground text-xs uppercase tracking-wider">Memory</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="activity" className="flex-1 m-0 p-4 space-y-4">
              <div className="flex gap-3">
                <div className="mt-1"><CheckCircle2 className="w-4 h-4 text-emerald-400" /></div>
                <div>
                  <div className="text-sm">Analyzed codebase architecture</div>
                  <div className="text-xs text-muted-foreground mt-0.5">2 mins ago</div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="mt-1"><Play className="w-4 h-4 text-primary" /></div>
                <div>
                  <div className="text-sm">Running security scan</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Just now</div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="memory" className="flex-1 m-0 p-4">
               <div className="space-y-4">
                 <div className="bg-white/5 p-3 rounded border border-white/10">
                   <div className="text-xs text-primary font-mono mb-1">core_architecture.md</div>
                   <div className="text-sm">System favors hexagonal architecture patterns.</div>
                 </div>
                 <div className="bg-white/5 p-3 rounded border border-white/10">
                   <div className="text-xs text-primary font-mono mb-1">preferences.json</div>
                   <div className="text-sm">User prefers strict typing in all new TypeScript files.</div>
                 </div>
               </div>
            </TabsContent>
          </Tabs>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}