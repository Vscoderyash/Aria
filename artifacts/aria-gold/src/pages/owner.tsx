import React from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area
} from "recharts";
import { 
  Activity, Users, Database, DollarSign, Brain, Zap, ArrowUpRight, ArrowDownRight, Settings 
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  useGetOwnerStats, 
  useGetUsageAnalytics,
  useListAgents 
} from "@workspace/api-client-react";

export default function Owner() {
  const { data: stats } = useGetOwnerStats();
  const { data: analytics = [] } = useGetUsageAnalytics();
  const { data: agents = [] } = useListAgents();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Header */}
      <header className="h-16 border-b border-white/5 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <div className="w-8 h-8 rounded bg-gradient-gold flex items-center justify-center font-bold text-background cursor-pointer">A</div>
            </Link>
            <span className="font-bold text-xl tracking-tight">ARIA</span>
            <Badge variant="outline" className="ml-2 bg-primary/10 text-primary border-primary/20">Owner Panel</Badge>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mr-4">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              System Status: {stats?.systemHealth || 'Healthy'}
            </div>
            <Link href="/workspace">
              <Button variant="outline" className="border-white/10 hover:bg-white/5">Workspace</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Command Center</h1>
          <p className="text-muted-foreground">Monitor system intelligence, agent health, and token usage.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card/40 border-white/5 shadow-none hover:bg-card/60 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Tokens Used</CardTitle>
              <Zap className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {(stats?.totalTokensUsed || 0).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center">
                <ArrowUpRight className="h-3 w-3 text-emerald-400 mr-1" />
                <span className="text-emerald-400">+12.5%</span> from last week
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-white/5 shadow-none hover:bg-card/60 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">API Cost</CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                ${(stats?.totalCostUsd || 0).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center">
                <ArrowDownRight className="h-3 w-3 text-primary mr-1" />
                <span className="text-primary">-2.4%</span> optimization applied
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-white/5 shadow-none hover:bg-card/60 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Agents</CardTitle>
              <Brain className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.activeAgents || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Across all instances</p>
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-white/5 shadow-none hover:bg-card/60 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Repositories</CardTitle>
              <Database className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.totalRepositories || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Under management</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="col-span-1 lg:col-span-2 bg-card/40 border-white/5 shadow-none">
            <CardHeader>
              <CardTitle>Intelligence Usage</CardTitle>
              <CardDescription>Daily token consumption across all autonomous tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.length ? analytics : mockAnalytics}>
                    <defs>
                      <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value / 1000}k`} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Area type="monotone" dataKey="tokensUsed" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorTokens)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-white/5 shadow-none">
            <CardHeader>
              <CardTitle>Agent Fleet Health</CardTitle>
              <CardDescription>Status of specialized intelligence nodes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(stats?.agentHealth || agents).map((agent: any, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                        <Brain className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">{agent.name}</div>
                        <div className="text-xs text-muted-foreground">{agent.tasksCompleted || 0} tasks completed</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${agent.status === 'active' || agent.status === 'idle' ? 'bg-emerald-400' : 'bg-primary'}`} />
                      <span className="text-xs uppercase tracking-wider font-medium text-muted-foreground">{agent.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

const mockAnalytics = [
  { date: 'Mon', tokensUsed: 120000, costUsd: 2.4, requestCount: 450 },
  { date: 'Tue', tokensUsed: 150000, costUsd: 3.0, requestCount: 520 },
  { date: 'Wed', tokensUsed: 180000, costUsd: 3.6, requestCount: 610 },
  { date: 'Thu', tokensUsed: 140000, costUsd: 2.8, requestCount: 480 },
  { date: 'Fri', tokensUsed: 210000, costUsd: 4.2, requestCount: 750 },
  { date: 'Sat', tokensUsed: 90000, costUsd: 1.8, requestCount: 300 },
  { date: 'Sun', tokensUsed: 110000, costUsd: 2.2, requestCount: 380 },
];
