const { loadKnowledgeLibrary } = require('./db-store');
const { id } = require('./auth');

function normalizeText(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240);
}

function score(query, text) {
  const words = normalizeText(query).split(' ').filter(w => w.length > 2);
  const hay = normalizeText(text);
  return words.reduce((sum, w) => sum + (hay.includes(w) ? 1 : 0), 0);
}

function findKnowledge(db, user, message) {
  const key = normalizeText(message);
  const library = loadKnowledgeLibrary().map(item => ({
    id: item.id,
    ownerId: 'aria-library',
    question: `${item.title} ${item.kind} ${item.tags.join(' ')}`,
    answer: item.content,
    type: item.kind,
    shared: true,
    library: true,
    sourcePath: item.sourcePath
  }));
  return [...db.knowledge, ...library]
    .filter(k => k.ownerId === user.id || k.shared)
    .map(k => ({ ...k, score: Math.max(score(key, k.question), score(key, k.answer), score(key, k.type || '')) }))
    .filter(k => k.score > 0)
    .sort((a, b) => b.score - a.score)[0] || null;
}

function isSelfImproveRequest(message) {
  return /\b(add|create|save|write|learn|remember|update|improve|upgrade|make)\b[\s\S]{0,80}\b(file|files|knowledge|memory|brain|server|yourself|skill|plugin|connection|ability)\b/i.test(message);
}

function createSelfImproveAction(db, user, message) {
  const clean = String(message || '').replace(/\s+/g, ' ').trim();
  const title = clean.length > 70 ? `${clean.slice(0, 67)}...` : clean;
  const action = {
    id: id('act'),
    userId: user.id,
    type: 'self-improvement',
    status: 'needs approval',
    title: `Learn: ${title}`,
    summary: 'ARIA prepared a self-improvement knowledge update. Approve it before ARIA saves it.',
    requestedText: clean,
    draft: {
      question: normalizeText(clean),
      type: 'self-improvement',
      answer: `Self-improvement note from user request:\n\n${clean}\n\nAfter approval, ARIA will use this knowledge for future answers.`,
      tags: ['self-improvement', 'user-request', 'permission']
    },
    createdAt: new Date().toISOString()
  };
  db.actions.unshift(action);
  return action;
}

function applyAction(db, user, action) {
  if (action.type !== 'self-improvement' || action.appliedAt) return null;
  const knowledge = {
    id: id('know'),
    ownerId: user.id,
    question: action.draft.question,
    type: action.draft.type,
    answer: action.draft.answer,
    links: [],
    shared: false,
    createdAt: new Date().toISOString(),
    sourceActionId: action.id,
    hits: 0,
    updatedAt: new Date().toISOString()
  };
  db.knowledge.unshift(knowledge);
  action.appliedAt = new Date().toISOString();
  return knowledge;
}

function userActions(db, user) {
  return db.actions.filter(action => action.userId === user.id).slice(0, 50);
}

module.exports = {
  normalizeText,
  score,
  findKnowledge,
  isSelfImproveRequest,
  createSelfImproveAction,
  applyAction,
  userActions
};
