import React from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Code, Shield, Zap, Terminal, Activity, GitPullRequest, Search, CheckCircle, GitCommit, Layers, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/30">
      <header className="fixed top-0 w-full z-50 border-b border-white/5 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-gradient-gold flex items-center justify-center font-bold text-background">A</div>
            <span className="font-bold text-xl tracking-tight">ARIA</span>
            <span className="text-sm text-primary tracking-widest uppercase font-semibold hidden md:inline-block ml-2">Gold Intelligence</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-primary transition-colors">Features</a>
            <a href="#agents" className="hover:text-primary transition-colors">Agents</a>
            <a href="#intelligence" className="hover:text-primary transition-colors">Intelligence</a>
            <a href="#pricing" className="hover:text-primary transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/chat" className="text-sm font-medium hover:text-primary transition-colors hidden md:block">Console</Link>
            <Link href="/workspace">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold">
                Deploy ARIA
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-16">
        {/* Hero */}
        <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/15 via-background to-background"></div>
          
          {/* Animated background elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-[20%] left-[20%] w-[40vw] h-[40vw] rounded-full bg-primary/5 blur-[120px] animate-pulse" style={{ animationDuration: '4s' }} />
            <div className="absolute bottom-[20%] right-[20%] w-[30vw] h-[30vw] rounded-full bg-blue-500/5 blur-[100px] animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />
          </div>

          <div className="container px-6 relative z-10 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="max-w-4xl mx-auto space-y-8"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm font-medium mb-4">
                <Zap className="w-4 h-4" /> ARIA V3 is now available
              </div>
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter text-white leading-[1.1]">
                Sovereign AI <br />
                <span className="text-gradient-gold">Engineering</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground font-light max-w-2xl mx-auto leading-relaxed">
                A premium autonomous intelligence that analyzes repositories, writes code, finds bugs, and coordinates a fleet of specialized agents to ship software faster.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
                <Link href="/workspace">
                  <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold px-8 h-14 text-lg group w-full sm:w-auto">
                    Access Workspace <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Link href="/chat">
                  <Button size="lg" variant="outline" className="border-white/10 hover:bg-white/5 h-14 px-8 text-lg font-medium w-full sm:w-auto bg-background/50 backdrop-blur-md">
                    Talk to Agent
                  </Button>
                </Link>
              </div>
              <div className="pt-12 flex items-center justify-center gap-8 text-sm font-medium text-muted-foreground opacity-70">
                <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-primary" /> Autonomous PRs</div>
                <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-primary" /> Codebase Context</div>
                <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-primary" /> Fleet Coordination</div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-24 bg-card/20 border-y border-white/5 relative">
          <div className="container mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl font-bold mb-4">Precision Engineering, Automated.</h2>
              <p className="text-muted-foreground">ARIA doesn't just autocomplete lines—it understands your entire architecture and implements complex features across multiple files.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-background border border-white/5 rounded-2xl p-8 hover:border-primary/30 transition-colors group">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Search className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">Repository Intelligence</h3>
                <p className="text-muted-foreground leading-relaxed">Instantly index entire codebases. ARIA builds a semantic graph of your architecture to ensure every generated line fits perfectly into your patterns.</p>
              </div>
              
              <div className="bg-background border border-white/5 rounded-2xl p-8 hover:border-blue-500/30 transition-colors group">
                <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <GitPullRequest className="w-6 h-6 text-blue-500" />
                </div>
                <h3 className="text-xl font-bold mb-3">Autonomous PRs</h3>
                <p className="text-muted-foreground leading-relaxed">Assign a Jira ticket or plain text issue, and ARIA will branch, write the code, test it, and open a documented Pull Request without human intervention.</p>
              </div>

              <div className="bg-background border border-white/5 rounded-2xl p-8 hover:border-emerald-500/30 transition-colors group">
                <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Shield className="w-6 h-6 text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold mb-3">Security & Auditing</h3>
                <p className="text-muted-foreground leading-relaxed">Dedicated security agents constantly monitor your codebase for vulnerabilities, outdated dependencies, and bad practices, fixing them proactively.</p>
              </div>
            </div>
          </div>
        </section>

        {/* UI Showcase / Agents */}
        <section id="agents" className="py-24 relative overflow-hidden">
          <div className="container mx-auto px-6">
            <div className="flex flex-col lg:flex-row items-center gap-16">
              <div className="lg:w-1/2 space-y-6">
                <div className="text-primary font-semibold tracking-wider uppercase text-sm">The Fleet</div>
                <h2 className="text-4xl font-bold leading-tight">A Senior Engineering Team on Call 24/7</h2>
                <p className="text-xl text-muted-foreground leading-relaxed">
                  You aren't talking to a single generic model. ARIA coordinates a fleet of specialized agents—Architects, Reviewers, Security Analysts, and UI Engineers—who collaborate to solve complex problems.
                </p>
                <div className="pt-4 space-y-4">
                  {[
                    { name: "Alpha_Architect", desc: "Designs system architecture and patterns." },
                    { name: "Beta_Reviewer", desc: "Critiques PRs and finds logical flaws." },
                    { name: "Gamma_UI", desc: "Translates Figma designs to pixel-perfect React." }
                  ].map((agent, i) => (
                    <div key={i} className="flex items-center gap-4 bg-white/5 rounded-lg p-4 border border-white/5">
                      <div className="w-10 h-10 rounded bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <Cpu className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-bold">{agent.name}</div>
                        <div className="text-sm text-muted-foreground">{agent.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="lg:w-1/2 w-full">
                {/* Abstract UI Representation */}
                <div className="relative rounded-2xl border border-white/10 bg-background/50 backdrop-blur-xl p-2 shadow-2xl shadow-primary/10">
                  <div className="absolute top-0 left-10 w-3/4 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
                  <div className="bg-[#0A0A0F] rounded-xl border border-white/5 overflow-hidden">
                    <div className="h-10 border-b border-white/5 flex items-center px-4 gap-2 bg-black/40">
                      <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                      <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
                      <div className="ml-4 text-xs font-mono text-muted-foreground">aria_console ~ fleet_status</div>
                    </div>
                    <div className="p-6 font-mono text-sm space-y-3">
                      <div className="text-muted-foreground">❯ Initialize ARIA fleet coordinator...</div>
                      <div className="text-emerald-400">✓ Coordinator online. 4 agents standing by.</div>
                      <div className="text-muted-foreground">❯ Analyze ticket PROJ-842 (Refactor Auth)</div>
                      <div className="flex items-start gap-2 text-blue-400">
                        <Activity className="w-4 h-4 mt-0.5" />
                        <div>Alpha_Architect analyzing dependency graph...<br/>Found 14 affected files.</div>
                      </div>
                      <div className="flex items-start gap-2 text-primary">
                        <Code className="w-4 h-4 mt-0.5" />
                        <div>Delta_Engineer generating modifications... [████████░░] 80%</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        {/* Call to Action */}
        <section className="py-24 border-t border-white/5 relative">
          <div className="absolute inset-0 bg-primary/5"></div>
          <div className="container mx-auto px-6 relative z-10 text-center">
            <h2 className="text-4xl font-bold mb-6">Ready to upgrade your engineering?</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Stop writing boilerplate. Start architecting solutions. Let ARIA handle the implementation details.
            </p>
            <Link href="/workspace">
              <Button size="lg" className="bg-primary text-primary-foreground font-bold px-10 h-16 text-xl hover:scale-105 transition-transform">
                Enter the Workspace
              </Button>
            </Link>
          </div>
        </section>

      </main>
      
      <footer className="border-t border-white/10 bg-black py-12">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <div className="w-6 h-6 rounded bg-gradient-gold flex items-center justify-center font-bold text-background text-xs">A</div>
            <span className="font-bold tracking-tight">ARIA Gold</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Premium Autonomous AI Engineering. Built for the elite.
          </div>
        </div>
      </footer>
    </div>
  );
}