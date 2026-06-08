const PLANS = {
  free: { id: 'free', name: 'Free', price: 0, periodDays: 0, messageLimit: 40, webSearches: 5, features: ['Basic chat', 'Local memory', 'Limited knowledge cache'] },
  pro: { id: 'pro', name: 'Pro', price: 20, periodDays: 30, messageLimit: 600, webSearches: 100, features: ['Persistent profile chats', 'Web knowledge cache', 'Plugins', 'Skills', 'Projects'] },
  max5: { id: 'max5', name: 'Max 5x', price: 100, periodDays: 30, messageLimit: 3000, webSearches: 600, features: ['Higher limits', 'Coding workspace', 'Automations', 'Priority knowledge cache'] },
  max20: { id: 'max20', name: 'Max 20x', price: 200, periodDays: 30, messageLimit: 12000, webSearches: 2000, features: ['Highest limits', 'Advanced automations', 'Team-ready workspace', 'Premium connectors'] }
};

const PLUGINS = [
  { id: 'web-knowledge', name: 'Web Knowledge', plan: 'free', enabled: true, description: 'Searches web sources when local knowledge is missing, then caches answers.' },
  { id: 'coder', name: 'Coder Workspace', plan: 'max5', enabled: true, description: 'Code planning, file reasoning, and implementation workflows.' },
  { id: 'designer', name: 'Design Studio', plan: 'pro', enabled: true, description: 'UI critique, layout planning, and component design.' },
  { id: 'automation', name: 'Automations', plan: 'max5', enabled: true, description: 'Scheduled follow-ups, monitors, reminders, and repeat checks.' },
  { id: 'connectors', name: 'Connections', plan: 'pro', enabled: false, description: 'Connect Google, GitHub, Vercel, Drive, Slack, and custom tools after credentials are configured.' }
];

const SKILLS = [
  { id: 'code-review', name: 'Code Review', plan: 'pro' },
  { id: 'ui-design', name: 'UI Design', plan: 'pro' },
  { id: 'research', name: 'Research Briefs', plan: 'free' },
  { id: 'agentic-coding', name: 'Agentic Coding', plan: 'max5' },
  { id: 'workflow-automation', name: 'Workflow Automation', plan: 'max5' }
];

function planRank(planId) {
  return ['free', 'pro', 'max5', 'max20'].indexOf(planId);
}

function getPlan(user) {
  const sub = user.subscription || { plan: 'free' };
  if (sub.expiresAt && Date.now() > new Date(sub.expiresAt).getTime()) return PLANS.free;
  return PLANS[sub.plan] || PLANS.free;
}

function featuresForPlan(planId) {
  return {
    plugins: PLUGINS.filter(p => planRank(planId) >= planRank(p.plan)),
    skills: SKILLS.filter(s => planRank(planId) >= planRank(s.plan)),
    automations: planRank(planId) >= planRank('max5'),
    webKnowledge: planRank(planId) >= planRank('free'),
    codingWorkspace: planRank(planId) >= planRank('max5')
  };
}

module.exports = {
  PLANS,
  PLUGINS,
  SKILLS,
  planRank,
  getPlan,
  featuresForPlan
};
