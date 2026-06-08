const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'aria-db.json');
const KNOWLEDGE_DIR = path.join(ROOT, 'knowledge');

function readEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (!process.env[key]) process.env[key] = rest.join('=').trim();
  }
}

function ensureDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) writeDb(defaultDb());
}

function readDb() {
  ensureDb();
  return ensureCollections(JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
}

function writeDb(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function ensureCollections(db) {
  db.users = Array.isArray(db.users) ? db.users : [];
  db.sessions = db.sessions && typeof db.sessions === 'object' ? db.sessions : {};
  db.knowledge = Array.isArray(db.knowledge) ? db.knowledge : [];
  db.actions = Array.isArray(db.actions) ? db.actions : [];
  db.training = Array.isArray(db.training) ? db.training : [];
  db.automations = Array.isArray(db.automations) ? db.automations : [];
  db.payments = Array.isArray(db.payments) ? db.payments : [];
  return db;
}

function defaultDb() {
  return {
    users: [],
    sessions: {},
    knowledge: [],
    actions: [],
    training: [],
    automations: [],
    payments: [],
    createdAt: new Date().toISOString()
  };
}

function walkMarkdown(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkMarkdown(full);
    return entry.isFile() && entry.name.endsWith('.md') ? [full] : [];
  });
}

function parseKnowledgeFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
  const meta = {};
  let content = raw;
  if (match) {
    for (const line of match[1].split(/\r?\n/)) {
      const [key, ...rest] = line.split(':');
      if (key && rest.length) meta[key.trim()] = rest.join(':').trim();
    }
    content = match[2].trim();
  }
  return {
    id: meta.id || path.basename(filePath, '.md'),
    title: meta.title || path.basename(filePath, '.md'),
    kind: meta.kind || 'knowledge',
    tags: String(meta.tags || '').split(',').map(tag => tag.trim()).filter(Boolean),
    content,
    sourcePath: path.relative(ROOT, filePath).replace(/\\/g, '/')
  };
}

function loadKnowledgeLibrary() {
  const files = walkMarkdown(KNOWLEDGE_DIR);
  return files.map(parseKnowledgeFile);
}

module.exports = {
  ROOT,
  DATA_DIR,
  DB_FILE,
  KNOWLEDGE_DIR,
  readEnvFile,
  ensureDb,
  readDb,
  writeDb,
  loadKnowledgeLibrary
};
