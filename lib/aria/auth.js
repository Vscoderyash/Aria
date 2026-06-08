const crypto = require('crypto');
const { getPlan, featuresForPlan } = require('./plans');

function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').filter(Boolean).map(part => {
    const [k, ...rest] = part.trim().split('=');
    return [k, decodeURIComponent(rest.join('='))];
  }));
}

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(12).toString('hex')}`;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  return hashPassword(password, salt).split(':')[1] === hash;
}

function publicUser(user) {
  if (!user) return null;
  const plan = getPlan(user);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    subscription: user.subscription,
    plan,
    usage: user.usage || { messages: 0, webSearches: 0 },
    enabledFeatures: featuresForPlan(plan.id)
  };
}

function createGuestUser(db) {
  const guestNumber = db.users.filter(u => u.email.startsWith('guest-')).length + 1;
  const user = {
    id: id('user'),
    email: `guest-${Date.now()}-${guestNumber}@aria.local`,
    name: 'Guest',
    passwordHash: '',
    subscription: { plan: 'free', status: 'active', startedAt: new Date().toISOString(), expiresAt: null },
    settings: { trainFromChats: true },
    usage: { messages: 0, webSearches: 0 },
    chats: [],
    connections: [],
    guest: true,
    createdAt: new Date().toISOString()
  };
  db.users.push(user);
  return user;
}

module.exports = {
  parseCookies,
  id,
  hashPassword,
  verifyPassword,
  publicUser,
  createGuestUser
};
