const { getPlan } = require('./plans');
const { findKnowledge, isSelfImproveRequest, createSelfImproveAction, applyAction, userActions, normalizeText } = require('./knowledge');
const { webKnowledge } = require('./web-search');
const { publicUser } = require('./auth');

function localReply(message, hit, user) {
  const plan = getPlan(user);
  const text = String(message || '').trim();
  const lower = text.toLowerCase();
  if (hit) {
    const place = hit.library ? 'ARIA working knowledge library' : 'my saved knowledge';
    return `I found this in ${place}, so I can answer faster without searching again.\n\n${hit.answer}`;
  }
  if (/^(hi|hello|hey|yo|sup|start|are you online)\b/i.test(lower)) {
    return `I am online as ARIA Core.\n\nI can help in four modes:\n\n1. **Answer**: ask a question and I will use server memory first.\n2. **Build**: ask for code, UI, API routes, files, or debugging.\n3. **Learn**: say "learn this..." and I will prepare a permission-gated memory update.\n4. **Connect**: ask for GitHub, Vercel, Drive, Slack, or custom plugins and I will request permission before setup.\n\nGive me a real task and I will work from my server brain instead of repeating a canned message.`;
  }
  if (/\b(who are you|what are you|what can you do|help)\b/i.test(lower)) {
    return `I am ARIA, a server-backed AI workspace.\n\nMy current abilities:\n- use built-in working knowledge files before web search\n- learn approved user instructions into server memory\n- keep profile chats and subscriptions on the account\n- plan code like an agent, including files, tests, and deployment steps\n- expose plugins, skills, connections, automations, and permission gates\n\nFor sensitive actions, I will ask permission first.`;
  }
  if (/\b(code|build|html|css|javascript|debug|component|app|website)\b/i.test(message)) {
    return `I can build it.\n\n**Implementation path**\n1. Define the target behavior and UI.\n2. Split it into files, state, server routes, and styling.\n3. Generate or patch the code.\n4. Run syntax/API checks.\n5. Ask permission before deploys, external writes, or repo changes.\n\nYour current plan is **${plan.name}**. Advanced coding workspace features unlock on Max 5x and above.`;
  }
  if (/\b(design|ui|ux|screen|layout|interface|website)\b/i.test(message)) {
    return `I can design it as a clean ARIA product experience.\n\nI will focus on:\n- simple chat-first layout\n- quiet side navigation\n- clear memory/settings panel\n- responsive spacing\n- strong code/design action buttons\n\nTell me the exact page or component and I will draft the UI structure.`;
  }
  return `I do not have a strong saved memory match for that yet, so I will handle it as a fresh task.\n\n**What I understood**\n${text}\n\n**How I will proceed**\n- If you want an answer, I will explain it directly.\n- If you want code, I will turn it into files and steps.\n- If you want me to remember it, say **learn this:** and I will ask permission before saving it.\n- If this needs current web knowledge, add Google Search keys in the server environment and I will search once, cache the useful result, and answer faster next time.`;
}

async function handleChat(db, user, body) {
  const message = String(body.message || '').trim();
  if (!message) return { error: 'Message required' };
  const plan = getPlan(user);
  user.usage = user.usage || { messages: 0, webSearches: 0 };
  if (user.usage.messages >= plan.messageLimit) {
    return { error: `Message limit reached for ${plan.name}. Upgrade to continue.` };
  }
  user.usage.messages += 1;

  const chatId = body.chatId || `chat_${Math.random().toString(36).slice(2, 10)}`;
  let chat = user.chats.find(c => c.id === chatId);
  if (!chat) {
    chat = { id: chatId, title: message.slice(0, 60), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages: [] };
    user.chats.unshift(chat);
  }

  chat.messages.push({ role: 'user', content: message, ts: Date.now() });

  let answer = null;
  let hit = null;
  let source = 'local';
  let links = [];
  let action = null;

  if (isSelfImproveRequest(message)) {
    action = createSelfImproveAction(db, user, message);
    source = 'permission-required';
    answer = `I prepared a self-improvement update, but I need your permission before I save it into my server memory.\n\n**Pending action:** ${action.title}\n\nOpen the settings sheet and approve it. After approval, I will store it as ARIA knowledge and use it for future answers.`;
  } else {
    hit = findKnowledge(db, user, message);
    answer = localReply(message, hit, user);
    source = hit ? 'knowledge-cache' : 'local';
  }

  if (!action && !hit && body.useWeb !== false && user.usage.webSearches < plan.webSearches) {
    try {
      const web = await webKnowledge(message);
      user.usage.webSearches += 1;
      source = web.source;
      links = web.links;
      if (web.source !== 'local-fallback') {
        answer = `I checked web knowledge and saved this for faster future answers.\n\n${web.answer}`;
        db.knowledge.unshift({
          id: `know_${Math.random().toString(36).slice(2, 10)}`,
          ownerId: user.id,
          question: normalizeText(message),
          type: /code|design|ui|app|debug/i.test(message) ? 'build' : 'general',
          answer,
          links,
          shared: false,
          createdAt: new Date().toISOString(),
          hits: 0
        });
      }
    } catch (error) {
      answer += `\n\nWeb knowledge failed safely: ${error.message}`;
    }
  }

  chat.messages.push({ role: 'assistant', content: answer, ts: Date.now(), source, links });
  chat.updatedAt = new Date().toISOString();

  if (user.settings.trainFromChats !== false) {
    db.training.unshift({
      id: `train_${Math.random().toString(36).slice(2, 10)}`,
      userId: user.id,
      question: normalizeText(message),
      answer,
      source,
      createdAt: new Date().toISOString()
    });
  }

  return { chat, answer, source, links, action, actions: userActions(db, user), user: publicUser(user) };
}

module.exports = { handleChat, localReply };
