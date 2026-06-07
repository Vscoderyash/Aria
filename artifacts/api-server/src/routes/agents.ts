import { Router } from "express";

const router = Router();

const AGENTS = [
  {
    id: "architect",
    name: "Architect Agent",
    role: "System Architecture",
    description: "Analyzes system design, identifies architectural bottlenecks, and generates improvement roadmaps.",
    status: "active",
    goals: ["Analyze system architecture", "Identify technical debt", "Generate refactoring plans", "Ensure scalability"],
    tools: ["repository_scan", "dependency_graph", "architecture_analyzer", "plan_generator"],
    tasksCompleted: 147,
    lastActive: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: "frontend",
    name: "Frontend Agent",
    role: "UI/UX Engineering",
    description: "Reviews React components, optimizes rendering performance, and generates UI improvements.",
    status: "active",
    goals: ["Optimize component rendering", "Reduce bundle size", "Improve accessibility", "Enforce design consistency"],
    tools: ["component_analyzer", "bundle_analyzer", "a11y_scanner", "css_optimizer"],
    tasksCompleted: 89,
    lastActive: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },
  {
    id: "backend",
    name: "Backend Agent",
    role: "Server-Side Engineering",
    description: "Optimizes API performance, database queries, and implements backend features.",
    status: "active",
    goals: ["Optimize database queries", "Reduce API latency", "Implement caching", "Ensure data integrity"],
    tools: ["query_analyzer", "cache_manager", "api_profiler", "migration_generator"],
    tasksCompleted: 203,
    lastActive: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
  },
  {
    id: "security",
    name: "Security Agent",
    role: "Application Security",
    description: "Performs security audits, finds vulnerabilities, and generates security patches.",
    status: "active",
    goals: ["Find security vulnerabilities", "Audit dependencies", "Generate security patches", "Monitor threat vectors"],
    tools: ["vulnerability_scanner", "dependency_audit", "penetration_tester", "patch_generator"],
    tasksCompleted: 61,
    lastActive: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: "performance",
    name: "Performance Agent",
    role: "Performance Engineering",
    description: "Profiles application performance, identifies bottlenecks, and generates optimization strategies.",
    status: "idle",
    goals: ["Profile application performance", "Identify memory leaks", "Optimize critical paths", "Benchmark improvements"],
    tools: ["profiler", "memory_analyzer", "benchmark_runner", "optimization_planner"],
    tasksCompleted: 34,
    lastActive: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
  {
    id: "testing",
    name: "Testing Agent",
    role: "Quality Assurance",
    description: "Generates and maintains test suites, identifies coverage gaps, and ensures code quality.",
    status: "idle",
    goals: ["Generate unit tests", "Create integration tests", "Find coverage gaps", "Maintain test quality"],
    tools: ["test_generator", "coverage_analyzer", "mutation_tester", "test_runner"],
    tasksCompleted: 178,
    lastActive: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
  },
  {
    id: "documentation",
    name: "Documentation Agent",
    role: "Technical Writing",
    description: "Generates and maintains technical documentation, API docs, and code comments.",
    status: "idle",
    goals: ["Generate API documentation", "Write code comments", "Create architecture diagrams", "Maintain changelogs"],
    tools: ["doc_generator", "comment_analyzer", "diagram_creator", "changelog_generator"],
    tasksCompleted: 92,
    lastActive: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
  },
  {
    id: "research",
    name: "Research Agent",
    role: "Technical Research",
    description: "Researches best practices, evaluates libraries, and synthesizes technical knowledge.",
    status: "active",
    goals: ["Research technical solutions", "Evaluate dependencies", "Synthesize best practices", "Generate recommendations"],
    tools: ["web_search", "package_evaluator", "rfc_reader", "knowledge_synthesizer"],
    tasksCompleted: 55,
    lastActive: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
  },
];

router.get("/agents", (_req, res) => {
  res.json(AGENTS);
});

router.get("/agents/:id", (req, res) => {
  const agent = AGENTS.find((a) => a.id === req.params.id);
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  res.json(agent);
});

export default router;
