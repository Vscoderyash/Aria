import { near, normalizeSpokenText, parseCmd, scoreLabel, splitCmds, toks } from '@jarvis/grammar';

type PageElement = HTMLElement & {
  autocomplete?: string;
  form?: HTMLFormElement | null;
  href?: string;
  name?: string;
  options?: HTMLOptionsCollection;
  placeholder?: string;
  type?: string;
  value?: string;
};
type AgentReply = { text?: string; error?: string; say?: string; reply?: Record<string, any> };
type SpeechRecognitionLike = any;
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    __jarvisAgent?: { alive: () => boolean; host?: HTMLElement };
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_idle',
  main() {
(() => {
  // After the extension is reloaded/updated, old copies in open tabs go dead. Replace them instead of bailing out.
  const alive = () => { try { return !!chrome.runtime.id; } catch { return false; } };
  if (!alive()) return;
  if (window.__jarvisAgent) { if (window.__jarvisAgent.alive()) return; try { window.__jarvisAgent.host.remove(); } catch {} }
  window.__jarvisAgent = { alive };
  const host = document.createElement('div');
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;top:0;left:0;width:0;height:0';
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `<style>
  *{box-sizing:border-box;font-family:system-ui,sans-serif}
  #orb{position:fixed;width:56px;height:56px;border-radius:50%;cursor:grab;touch-action:none;background:radial-gradient(circle,#fff 0 12%,#ffb08f 30%,#ff5a1f 55%,#14181c 58%);box-shadow:0 0 24px #ff5a1f99,0 6px 20px #0008;transition:filter .3s}
  #orb:before,#orb:after{content:"";position:absolute;inset:-6px;border-radius:50%;border:2px dashed #ff5a1f;animation:sp 9s linear infinite}
  #orb:after{inset:-13px;border:2px solid #ff5a1f55;border-top-color:transparent;animation-duration:3s;animation-direction:reverse}
  #orb.busy:before{animation-duration:1.4s}#orb.busy{filter:brightness(1.25)}
  @keyframes sp{to{transform:rotate(360deg)}}
  .ghost{position:fixed;width:30px;height:30px;border-radius:50%;background:#ff5a1f;pointer-events:none;animation:gh .6s forwards}
  @keyframes gh{to{opacity:0;transform:scale(.2)}}
  #panel{position:fixed;width:340px;max-width:92vw;background:#14181c;color:#e7ece9;border-radius:16px;box-shadow:0 20px 60px #000a;display:none;flex-direction:column;overflow:hidden;border:1px solid #2a3138}
  #panel.open{display:flex}
  #hd{display:flex;align-items:center;padding:10px 14px;font-weight:700;border-bottom:1px solid #2a3138}#hd span{flex:1}#hd button{background:none;border:0;color:#9aa6ae;cursor:pointer;font-size:16px}#mic.on{color:#ff5a1f;animation:pl 1.2s infinite}#vo.off{opacity:.35}@keyframes pl{50%{transform:scale(1.3)}}
  #log{max-height:260px;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:8px;font-size:13px;line-height:1.45}
  .m{padding:8px 11px;border-radius:10px;max-width:92%}.a{background:#1f262c}.u{background:#ff5a1f;align-self:flex-end}.e{background:#3a1f1f;color:#ffb4a8}.s{color:#9aa6ae;font-size:12px}
  #ap{display:none;gap:8px;padding:0 12px 10px}#ap.on{display:flex}#ap button,#go,#st{background:#ff5a1f;color:#fff;border:0;border-radius:999px;padding:7px 14px;cursor:pointer;font-size:13px}#ap #no,#st{background:#38414a}
  #bar{display:flex;gap:8px;padding:10px;border-top:1px solid #2a3138}#in{flex:1;background:#0e1215;border:1px solid #2f383f;border-radius:10px;color:#fff;padding:8px 10px;font-size:13px;outline:0}
  #orb:before,#orb:after{display:none}
  #orb{width:96px;height:96px;background:none;box-shadow:none;filter:drop-shadow(0 10px 12px #0009)}#orb.busy{filter:drop-shadow(0 0 14px #19d3ff) drop-shadow(0 10px 12px #0009)}
  #rig{transform-origin:50px 90px;transform:scaleX(var(--f,1)) rotate(var(--t,0deg));transition:transform .35s}
  .hv{animation:hv 2.2s ease-in-out infinite}@keyframes hv{50%{transform:translateY(-4px)}}
  .gl{animation:gl 2.2s ease-in-out infinite;transform-origin:50px 92px}@keyframes gl{50%{transform:scale(.75);opacity:.25}}
  .core{animation:cr 1.6s ease-in-out infinite}#orb.busy .core{animation-duration:.45s}@keyframes cr{50%{opacity:.35}}
  .ey{animation:bk 4.5s infinite;transform-origin:50px 26px}@keyframes bk{0%,94%,100%{transform:scaleY(1)}97%{transform:scaleY(.1)}}
  .an{animation:cr 1s infinite}.arm{transform-origin:72px 42px}#orb.busy .arm,#orb.listen .arm{animation:wv .6s ease-in-out infinite}@keyframes wv{50%{transform:rotate(-40deg)}}
  .wh{transform-box:fill-box}.wh circle{transform-box:fill-box;transform-origin:center}#orb.moving .wh circle{animation:sp .25s linear infinite}
  #orb.listen:after{display:block;content:"";position:absolute;inset:6px;border-radius:50%;border:2px solid #19d3ff;animation:rp 1.4s infinite;pointer-events:none}@keyframes rp{to{transform:scale(1.7);opacity:0}}
  #panel{background:linear-gradient(160deg,#0b1722ee,#14181cee);backdrop-filter:blur(14px);border:1px solid #19d3ff55;box-shadow:0 0 40px #19d3ff2a,0 20px 60px #000a}
  #hd{font-family:"Courier New",monospace;letter-spacing:.22em;color:#19d3ff}.m.a{border-left:2px solid #19d3ff}#st{background:#38414a}
  #boot{position:fixed;inset:0;display:none;place-items:center;background:radial-gradient(circle,#042033ee,#000000f2);opacity:1;transition:opacity .7s}#boot.on{display:grid}
  #boot:after{content:"";position:absolute;left:0;right:0;height:110px;background:linear-gradient(transparent,#19d3ff40,transparent);animation:sc 1.6s linear infinite}@keyframes sc{from{top:-120px}to{top:100%}}
  #jarvisPet{position:fixed;left:14px;bottom:12px;width:66px;height:74px;border:0;background:none;padding:0;cursor:pointer;filter:drop-shadow(0 6px 8px #0009);animation:petBob 2.7s ease-in-out infinite}#jarvisPet svg{width:100%;height:100%;image-rendering:pixelated}#jarvisPet .pet-body{fill:#3266ef}#jarvisPet .pet-light{fill:#75a5ff}#jarvisPet .pet-screen{fill:#101b38}#jarvisPet .pet-eye{fill:#8efff3}#jarvisPet .pet-laptop{fill:#192d6a;stroke:#8ad7ff;stroke-width:2}#jarvisPet .pet-pointer{fill:#a0ffff}#jarvisPet[data-mood="thinking"]{animation:petThink .4s ease-in-out infinite alternate}#jarvisPet[data-mood="happy"] .pet-eye{fill:#e0ffff}#jarvisPet[data-mood="oops"]{animation:petOops .3s ease-in-out 2}@keyframes petBob{50%{transform:translateY(-4px)}}@keyframes petThink{to{transform:translateY(-4px) rotate(4deg)}}@keyframes petOops{50%{transform:rotate(-7deg)}}#petPanel{position:fixed;left:18px;bottom:98px;width:292px;max-width:calc(100vw - 36px);display:none;flex-direction:column;gap:12px;padding:14px;border:1px solid #ffffff18;border-radius:16px;background:#202123;color:#ececec;font:13px/1.45 system-ui,sans-serif;box-shadow:0 16px 48px #0009}#petPanel:not([hidden]){display:flex}#petHead{display:flex;align-items:center;gap:10px}#petAvatar{width:42px;height:46px;flex:none;filter:drop-shadow(0 3px 5px #0008)}#petHead div{display:flex;flex:1;min-width:0;flex-direction:column}#petHead strong{font-size:14px;font-weight:600}#petHead small{color:#a5a5a5;font-size:11px}#petClose,#petMore{width:30px;height:30px;border:0;border-radius:8px;background:transparent;color:#aaa;font-size:18px;cursor:pointer}#petClose:hover,#petMore:hover{background:#ffffff12;color:#fff}#petNote{min-height:58px;padding:11px 12px;border:1px solid #ffffff10;border-radius:12px;background:#292a2c;color:#e6e6e6;font:13px/1.5 system-ui,sans-serif}#petStatus{display:flex;align-items:center;gap:7px;color:#a7a7a7;font-size:11px}#petStatus i{width:7px;height:7px;border-radius:50%;background:#74d99f;box-shadow:0 0 8px #74d99f77}#petActions{display:flex;align-items:center;gap:8px}#petTalk{flex:1;padding:9px 12px;border:0;border-radius:10px;background:#f4f4f4;color:#191919;font:600 12px system-ui,sans-serif;cursor:pointer}#petTalk:hover{background:#ddd}#petMore{font-size:16px}#jarvisPet[aria-expanded=true]{filter:drop-shadow(0 0 10px #6d9dff)}
  .r{position:absolute;border-radius:50%;border:2px solid #19d3ff;box-shadow:0 0 30px #19d3ff77,inset 0 0 30px #19d3ff33}
  .r1{width:300px;height:300px;border-style:dashed;animation:sp 8s linear infinite}.r2{width:220px;height:220px;border-color:#ff5a1f;border-top-color:transparent;border-bottom-color:transparent;animation:sp 2.4s linear infinite reverse}.r3{width:120px;height:120px;background:radial-gradient(circle,#fff,#19d3ff 50%,transparent 72%);animation:cr 1s infinite}
  #bt{position:absolute;top:calc(50% + 190px);font:700 18px "Courier New",monospace;letter-spacing:.3em;color:#19d3ff;text-shadow:0 0 14px #19d3ff;text-align:center;width:100%}
  #bot{width:100%;height:100%}#hear{padding:0 14px 6px;font-size:12px;color:#19d3ff;font-style:italic;min-height:0}#orb.hear .hv{animation-duration:.5s}#orb.ack{animation:ak .35s}@keyframes ak{50%{transform:scale(1.15)}}
  #bot [fill="#fff"]{fill:#c4161c}#bot [fill="#cfd3d6"]{fill:#e0a93b}#bot [fill="#ff5a1f"]{fill:#ffc247}
  #iris{position:fixed;inset:0;display:none;pointer-events:none;background:radial-gradient(circle at 50% 50%,#02070cf2,#02070c)}#iris.on{display:block}
  #ring{position:fixed;border-radius:50%;border:3px solid #ffc247;box-shadow:0 0 40px #ff3b2f,inset 0 0 30px #ff3b2f66;pointer-events:none;display:none}
  #wl{position:fixed;left:50%;top:-60px;transform:translateX(-50%);padding:10px 22px;color:#ffc247;background:#12070af0;border:1px solid #ffc24788;font:700 14px "Courier New",monospace;letter-spacing:.25em;white-space:nowrap;clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px);pointer-events:none}
  .shock{position:fixed;width:60px;height:60px;margin:-30px;border-radius:50%;border:3px solid #ffc247;box-shadow:0 0 24px #ff3b2f;pointer-events:none}
  </style><div id="orb" title="JARVIS (Alt+J)"><svg id="bot" viewBox="0 0 100 100" width="96" height="96"><g id="rig"><ellipse class="gl" cx="50" cy="92" rx="30" ry="5" fill="#19d3ff" opacity=".5"/><g class="hv"><path d="M8 74 Q8 80 16 80 L84 80 Q92 80 92 74 L86 76 L14 76 Z" fill="#ff5a1f"/><rect x="14" y="76" width="72" height="3.5" rx="1.7" fill="#14181c"/><g class="wh"><circle cx="28" cy="85" r="4.5" fill="#fff" stroke="#14181c" stroke-width="2"/><circle cx="72" cy="85" r="4.5" fill="#fff" stroke="#14181c" stroke-width="2"/></g><rect x="38" y="62" width="8" height="14" rx="3" fill="#cfd3d6" stroke="#14181c" stroke-width="2"/><rect x="55" y="62" width="8" height="14" rx="3" fill="#cfd3d6" stroke="#14181c" stroke-width="2"/><rect x="24" y="40" width="9" height="22" rx="4.5" fill="#cfd3d6" stroke="#14181c" stroke-width="2" transform="rotate(14 28 42)"/><g class="arm"><rect x="68" y="40" width="9" height="22" rx="4.5" fill="#cfd3d6" stroke="#14181c" stroke-width="2" transform="rotate(-14 72 42)"/></g><rect x="33" y="38" width="34" height="29" rx="10" fill="#fff" stroke="#14181c" stroke-width="2.5"/><circle class="core" cx="50" cy="52" r="6.5" fill="#19d3ff"/><circle cx="50" cy="52" r="10" fill="none" stroke="#ff5a1f" stroke-width="1.5" stroke-dasharray="3 3"/><line x1="50" y1="14" x2="50" y2="8" stroke="#14181c" stroke-width="2.5"/><circle class="an" cx="50" cy="6" r="3.5" fill="#ff5a1f"/><rect x="35" y="14" width="30" height="25" rx="11" fill="#fff" stroke="#14181c" stroke-width="2.5"/><rect x="39" y="21" width="22" height="10" rx="5" fill="#14181c"/><circle class="ey" cx="45.5" cy="26" r="2.4" fill="#19d3ff"/><circle class="ey" cx="54.5" cy="26" r="2.4" fill="#19d3ff"/></g></g></svg></div><div id="iris"></div><div id="ring"></div><div id="wl"></div><div id="boot"><i class="r r1"></i><i class="r r2"></i><i class="r r3"></i><div id="bt"></div></div>
  <button id="jarvisPet" type="button" aria-label="Pip, your browser AI pet" aria-expanded="false" aria-controls="petPanel" title="Pip, your browser AI pet" data-mood="idle"><svg viewBox="0 0 84 92" aria-hidden="true"><path class="pet-body" d="M27 56h29v17h8v8h-8v4h-9v-9h-9v9h-9v-5h-7v-8h5z"/><path class="pet-light" d="M22 13h8V8h24v5h9v8h6v27h-6v7h-9v5H29v-5h-8v-7h-6V22h7z"/><path class="pet-body" d="M19 21h6v29h-6v-5h-5V27h5zm44 0h6v6h5v18h-5v5h-6z"/><path class="pet-screen" d="M25 22h35v27H25z"/><path class="pet-eye" d="M31 32h9v4h-3v3h-3v-3h-3zm15 0h9v4h-3v3h-3v-3h-3z"/><path class="pet-laptop" d="M48 55h27v22H48z"/><path class="pet-pointer" d="m59 60 8 6-4 1 3 5-3 2-3-5-3 3z"/><path fill="#75a5ff" d="M43 77h36l-4 5H39z"/></svg></button><section id="petPanel" role="dialog" aria-label="Pip AI pet" hidden><div id="petHead"><svg id="petAvatar" viewBox="0 0 84 92" aria-hidden="true"><path fill="#3266ef" d="M27 56h29v17h8v8h-8v4h-9v-9h-9v9h-9v-5h-7v-8h5z"/><path fill="#75a5ff" d="M22 13h8V8h24v5h9v8h6v27h-6v7h-9v5H29v-5h-8v-7h-6V22h7z"/><path fill="#101b38" d="M25 22h35v27H25z"/><path fill="#8efff3" d="M31 32h9v4h-3v3h-3v-3h-3zm15 0h9v4h-3v3h-3v-3h-3z"/><path fill="#192d6a" stroke="#8ad7ff" stroke-width="2" d="M48 55h27v22H48z"/><path fill="#a0ffff" d="m59 60 8 6-4 1 3 5-3 2-3-5-3 3z"/></svg><div><strong>Pip</strong><small>Your JARVIS companion</small></div><button id="petClose" type="button" aria-label="Close pet panel">×</button></div><div id="petNote" role="status" aria-live="polite">Hello! Pip here. I will keep you company while JARVIS works.</div><div id="petStatus"><i></i><span>Ready when you are</span></div><div id="petActions"><button id="petTalk" type="button">Talk to JARVIS</button><button id="petMore" type="button" aria-label="Show another pet tip">↻</button></div></section><div id="panel"><div id="hd"><span>JARVIS</span><button id="mic" title="Listen (hands-free)">🎤</button><button id="vo" title="Voice replies">🔊</button><button id="x">✕</button></div><div id="log"></div>
  <div id="hear"></div><div id="ap"><button id="yes">Approve</button><button id="no">Cancel</button></div>
  <div id="bar"><input id="in" placeholder="Tell JARVIS what to do…"><button id="go">Go</button><button id="st">Stop</button></div></div>`;
  document.documentElement.appendChild(host);
  window.__jarvisAgent.host = host;
  const $ = <T extends HTMLElement = HTMLElement>(s: string): T => root.querySelector(s) as T;
  const orb = $('#orb'), panel = $('#panel'), logEl = $('#log'), pet = $('#jarvisPet'), petPanel = $('#petPanel'), petNote = $('#petNote'), petStatus = $('#petStatus span');
  let petLine = 0;
  const petLines = ['I can keep you company while JARVIS works on this page.', 'Try a quick command like “open YouTube” or “click that”.', 'Choose voice and reply languages in the extension popup.'];
  pet.onclick = () => { const opening = petPanel.hidden; petPanel.hidden = !opening; pet.setAttribute('aria-expanded', String(opening)); if (opening) { petNote.textContent = 'Hello! Pip here. I will keep you company while JARVIS works.'; petStatus.textContent = 'Ready when you are'; pet.dataset.mood = 'happy'; } };
  $('#petClose').onclick = () => { petPanel.hidden = true; pet.setAttribute('aria-expanded', 'false'); };
  $('#petMore').onclick = () => { petNote.textContent = petLines[petLine++ % petLines.length]; pet.dataset.mood = 'happy'; };
  $('#petTalk').onclick = () => { petPanel.hidden = true; pet.setAttribute('aria-expanded', 'false'); toggle(true); };
  const bg = <T = AgentReply>(m: Record<string, unknown>) => new Promise<T | null>(r => { try { chrome.runtime.sendMessage(m, res => { void chrome.runtime.lastError; r(res as T); }); } catch { r(null); } });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const store = { get: async <T = unknown>(k: string): Promise<T | undefined> => { const values = await chrome.storage.local.get(k); return values[k] as T | undefined; }, set: (k: string, v: unknown) => chrome.storage.local.set({ [k]: v }) };
  type TargetMemory = { el: HTMLElement; label: string; href: string };
  let pos = { x: 0.92, y: 0.82 }, job: any = null, tabId: number | null = null, running = false, approveResolve: ((approved: boolean) => void) | null = null, lastTarget: TargetMemory | null = null;

  /* ---- orb: position, drag, fly ---- */
  const px = () => ({ x: Math.min(innerWidth - (orb.offsetWidth || 96) - 8, Math.max(8, pos.x * innerWidth)), y: Math.min(innerHeight - (orb.offsetHeight || 96) - 8, Math.max(8, pos.y * innerHeight)) });
  function place(x, y) { orb.style.left = x + 'px'; orb.style.top = y + 'px'; }
  function home() { const p = px(); place(p.x, p.y); }
  function trail(ms) { const t = setInterval(() => { const r = orb.getBoundingClientRect(), g = document.createElement('div'); g.className = 'ghost'; g.style.left = r.left + 13 + 'px'; g.style.top = r.top + 13 + 'px'; root.appendChild(g); setTimeout(() => g.remove(), 650); }, 45); setTimeout(() => clearInterval(t), ms); }
  async function flyTo(x, y, ms = 900) {
    const r = orb.getBoundingClientRect(), dx = x - r.left, dy = y - r.top;
    trail(ms); orb.style.setProperty('--f', dx < 0 ? '-1' : '1'); orb.style.setProperty('--t', Math.max(-14, Math.min(14, dx / 25)) + 'deg'); orb.classList.add('moving');
    const a = orb.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${dx * .5}px,${dy * .5 - 90}px) scale(1.2)` }, { transform: `translate(${dx}px,${dy}px) scale(1)` }], { duration: ms, easing: 'cubic-bezier(.5,0,.2,1)' });
    await a.finished.catch(() => {}); place(x, y); orb.classList.remove('moving'); orb.style.setProperty('--t', '0deg'); if (panel.classList.contains('open')) fit();
  }
  async function flyIn() { const p = px(); place(innerWidth + 30, -60); await flyTo(p.x, p.y, 900); shock(p.x + orb.offsetWidth / 2, p.y + orb.offsetHeight / 2); }
  function fit() { const o = orb.getBoundingClientRect(), h = panel.offsetHeight || 300; panel.style.left = Math.max(8, Math.min(innerWidth - 348, o.left - 290)) + 'px'; panel.style.top = (o.top > h + 20 ? o.top - h - 12 : o.bottom + 12) + 'px'; }
  let drag = null;
  orb.onpointerdown = e => { drag = { sx: e.clientX, sy: e.clientY, ox: orb.offsetLeft, oy: orb.offsetTop, moved: false }; orb.setPointerCapture(e.pointerId); orb.style.cursor = 'grabbing'; };
  orb.onpointermove = e => { if (!drag) return; const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy; if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true; if (drag.moved) { place(drag.ox + dx, drag.oy + dy); if (panel.classList.contains('open')) fit(); } };
  orb.onpointerup = () => { orb.style.cursor = 'grab'; if (!drag) return; if (drag.moved) { pos = { x: orb.offsetLeft / innerWidth, y: orb.offsetTop / innerHeight }; store.set('orbPos', pos); } else toggle(); drag = null; };
  function toggle(on = !panel.classList.contains('open')) { panel.classList.toggle('open', on); if (panel.classList.contains('open')) { fit(); $('#in').focus(); } }
  addEventListener('keydown', e => { if (e.altKey && e.key.toLowerCase() === 'j') { e.preventDefault(); toggle(); } });
  $('#x').onclick = () => toggle(false);
  const applySize = () => { const s = size === 's' ? 64 : size === 'm' ? 96 : size === 'l' ? 128 : (innerWidth < 700 ? 64 : innerWidth > 1800 ? 120 : 96); orb.style.width = orb.style.height = s + 'px'; };
  addEventListener('resize', () => { applySize(); home(); });
  chrome.storage.onChanged.addListener(ch => {
    if (ch.size) { size = (ch.size.newValue as string) || 'auto'; applySize(); home(); }
    if (ch.brain) brain = ch.brain.newValue === 'smart' ? 'smart' : 'fast';
    if (ch.companion) companionOn = !!ch.companion.newValue;
    if (ch.voiceName) { voiceName = (ch.voiceName.newValue as string) || ''; pv(); }
    if (ch.lang) lang = (ch.lang.newValue as string) || navigator.language || 'en-US';
    if (ch.replyLanguage) { replyLanguage = (ch.replyLanguage.newValue as string) || ''; pv(); }
    if (ch.skills) skills = (ch.skills.newValue as Record<string, string>) || {};
    if (ch.facts) facts = (ch.facts.newValue as string[]) || [];
    if (ch.aliases) aliases = (ch.aliases.newValue as Record<string, string>) || {};
    if (ch.exp) exp = (ch.exp.newValue as any[]) || [];
    if (ch.lessons) lessons = (ch.lessons.newValue as Array<{ goal: string; lesson: string }>) || [];
  });

  /* ---- chat log ---- */
  let voice: SpeechSynthesisVoice | null = null, speakOn = true, lang = navigator.language || 'en-US', replyLanguage = '', size = 'auto', companionOn = false, voiceName = '', brain: 'fast' | 'smart' = 'fast', skills: Record<string, string> = {}, facts: string[] = [], aliases: Record<string, string> = {}, exp: any[] = [], lessons: Array<{ goal: string; lesson: string }> = [], lastGoal = '', awaitingLesson = false;
  function pv() { const vs = speechSynthesis.getVoices(), target = replyLanguage.toLowerCase(); voice = (voiceName && vs.find(v => v.name === voiceName)) || (target && vs.find(v => v.lang.toLowerCase() === target)) || (target && vs.find(v => v.lang.toLowerCase().startsWith(target.split('-')[0]))) || vs.find(v => /(Ryan|Guy|Prabhat|Christopher|Brian|Andrew|Eric|Davis).*Natural|Natural.*(Ryan|Guy|Prabhat|Christopher|Brian|Andrew|Eric)/i.test(v.name)) || vs.find(v => /Google UK English Male/i.test(v.name)) || vs.find(v => /David|Daniel|Mark|George|Ravi/i.test(v.name)) || vs.find(v => /^en/i.test(v.lang)) || vs[0] || null; }
  if (window.speechSynthesis) { pv(); speechSynthesis.onvoiceschanged = pv; }
  function speak(t: string, long = false) { if (!speakOn) return; if (companionOn) { bg({ type: 'say', text: String(t).slice(0, 300) }); return; } if (!window.speechSynthesis) return; try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(String(t).slice(0, long ? 1800 : 220)); if (voice) { u.voice = voice; u.lang = voice.lang; } else if (replyLanguage) u.lang = replyLanguage; u.rate = long ? 1 : 1.04; u.pitch = 1; speechSynthesis.speak(u); } catch {} }
  function say(cls, text) {
    if (cls === 'a') { speak(text); pet.dataset.mood = 'happy'; petStatus.textContent = 'JARVIS finished a task'; } else if (cls === 'e') { pet.dataset.mood = 'oops'; petStatus.textContent = 'JARVIS needs a retry'; } else if (cls === 's' && /thinking|working/i.test(text)) { pet.dataset.mood = 'thinking'; petStatus.textContent = 'JARVIS is working'; } const d = document.createElement('div'); d.className = 'm ' + cls; d.textContent = text; logEl.appendChild(d); logEl.scrollTop = logEl.scrollHeight; if (panel.classList.contains('open')) fit(); }
  const approve = (text: string) => new Promise<boolean>(res => { say('s', 'Needs your OK: ' + text); $('#ap').classList.add('on'); toggle(true); approveResolve = ok => { $('#ap').classList.remove('on'); approveResolve = null; res(ok); }; });
  $('#yes').onclick = () => approveResolve && approveResolve(true);
  $('#no').onclick = () => approveResolve && approveResolve(false);

  /* ---- reading the page ---- */
  function rememberTarget(el: HTMLElement) {
    if (host.contains(el)) return;
    const target = el as PageElement;
    const label = (target.getAttribute('aria-label') || target.innerText || target.value || target.title || '').trim().replace(/\s+/g, ' ').slice(0, 100);
    lastTarget = { el, label, href: target.href || (el instanceof HTMLAnchorElement ? el.href : '') };
  }
  document.addEventListener('pointermove', event => {
    const source = event.target;
    if (!(source instanceof Element)) return;
    const el = source.closest<HTMLElement>('a[href],button,input,textarea,select,[role=button],[role=link],[onclick]');
    if (el && !host.contains(el)) rememberTarget(el);
  }, { capture: true, passive: true });
  function snap() {
    document.querySelectorAll('[data-jv]').forEach(x => x.removeAttribute('data-jv'));
    const out: Array<{ id: number; tag: string; type?: string; label: string; href?: string; onScreen: boolean }> = [];
    document.querySelectorAll<HTMLElement>('a[href],button,input,textarea,select,[role=button],[role=link],[onclick]').forEach(e => {
      if (out.length >= 160 || host.contains(e)) return;
      const r = e.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || getComputedStyle(e).visibility === 'hidden') return;
      const node = e as PageElement;
      const id = out.length; e.setAttribute('data-jv', String(id));
      out.push({ id, tag: e.tagName.toLowerCase(), type: node.type || undefined, label: (e.getAttribute('aria-label') || e.innerText || node.value || node.placeholder || node.name || e.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 80), href: node.href ? String(node.href).slice(0, 90) : undefined, onScreen: r.top < innerHeight && r.bottom > 0 });
    });
    return out;
  }
  const parse = t => { try { return JSON.parse((String(t).match(/\{[\s\S]*\}/) || [''])[0]); } catch { return null; } };
  const SENSITIVE = /(buy|purchase|pay|place order|checkout|delete|remove|confirm|send|submit|book|transfer|subscribe|post|publish)/i;
  const SECRET = /(password|passwd|card|cc-|cvv|cvc|iban|ssn|otp|pin)/i;
  const PERSONAL_FIELD = /(email|e-mail|phone|mobile|address|first.?name|last.?name|full.?name|personal.?data)/i;
  function submissionNeedsApproval(el: HTMLElement) {
    const form = (el as PageElement).form || el.closest('form');
    if (!form) return false;
    const submitters = [...form.querySelectorAll<HTMLElement>('button[type="submit"],input[type="submit"]')];
    const submitText = submitters.map(button => button.innerText || (button as PageElement).value || button.getAttribute('aria-label') || '').join(' ');
    const personalFields = [...form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input,textarea,select')]
      .some(field => PERSONAL_FIELD.test([field.type, field.name, field.id, field.getAttribute('autocomplete'), field.getAttribute('aria-label'), field.getAttribute('placeholder')].join(' ')));
    return SENSITIVE.test(submitText) || personalFields;
  }
  async function mayClick(el: HTMLElement, label: string) {
    if (!SENSITIVE.test(label) && !submissionNeedsApproval(el)) return true;
    const ok = await approve(`continue with "${label || 'this action'}" on ${location.hostname}`);
    if (!ok) say('s', 'Cancelled.');
    return ok;
  }
  function typeInto(el: HTMLElement, text: string) {
    el.focus();
    const control = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(control), 'value'); set && set.set ? set.set.call(control, text) : (control.value = text);
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const enter = (el: HTMLElement) => { ['keydown', 'keypress', 'keyup'].forEach(t => el.dispatchEvent(new KeyboardEvent(t, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }))); const form = (el as PageElement).form; if (form) form.requestSubmit ? form.requestSubmit() : form.submit(); };

  /* ---- agent loop (survives page navigation) ---- */
  const save = () => store.set('job' + tabId, job);
  async function finish(msg = '') { if (msg) say('a', msg); if (job) { job.status = 'idle'; await save(); } orb.classList.remove('busy'); home && flyTo(px().x, px().y, 800); }
  async function act(a) {
    const el = a.id != null ? document.querySelector<HTMLElement>(`[data-jv="${a.id}"]`) : null;
    if (a.action === 'done' || a.action === 'ask') { job.awaiting = a.action === 'ask'; if (a.action === 'done') rememberExp(); await finish(); return 'stop'; }
    if (a.action === 'navigate') {
      if (!/^https?:\/\//i.test(a.url || '')) { job.history.push('bad url'); return 'go'; }
      job.history.push('navigate ' + a.url); await save(); await jump(a.url); return 'nav';
    }
    if (a.action === 'scroll') { scrollBy({ top: (a.dir === 'up' ? -1 : 1) * innerHeight * .8, behavior: brain === 'smart' ? 'smooth' : 'auto' }); job.history.push('scroll ' + (a.dir || 'down')); await sleep(brain === 'smart' ? 900 : 180); return 'go'; }
    if (a.action === 'wait') { await sleep(Math.min(5000, (+a.seconds || 2) * 1000)); job.history.push('waited'); return 'go'; }
    if (a.action === 'back') { job.history.push('went back'); await save(); history.back(); return 'nav'; }
    if (a.action === 'read') { const t = (el ? el.innerText : document.body.innerText).replace(/\s+/g, ' ').trim().slice(0, 1500); job.last = 'READ: ' + t; job.history.push('read ' + (a.id ?? 'page')); return 'go'; }
    if (a.action === 'key') { const tgt = (el || document.activeElement || document.body) as HTMLElement, k = String(a.key || 'Enter'); if (/^enter$/i.test(k)) { if (submissionNeedsApproval(tgt) && !(await approve(`submit this form on ${location.hostname}`))) { await finish('Cancelled.'); return 'stop'; } enter(tgt); } else for (const t of ['keydown', 'keypress', 'keyup']) tgt.dispatchEvent(new KeyboardEvent(t, { key: k, bubbles: true })); job.history.push('pressed ' + k); await sleep(brain === 'smart' ? 500 : 100); return 'go'; }
    if (!el) { job.history.push('element ' + a.id + ' not found'); return 'go'; }
    const r = el.getBoundingClientRect(), node = el as PageElement, label = (el.innerText || node.value || el.getAttribute('aria-label') || '').trim().slice(0, 40);
    if (SECRET.test([node.type, node.name, el.id, node.autocomplete].join(' '))) { say('e', 'I never fill passwords or payment fields. Please do this step yourself, then tell me to continue.'); job.history.push('blocked: secret field'); await finish(); return 'stop'; }
    el.scrollIntoView({ block: 'center', behavior: brain === 'smart' ? 'smooth' : 'auto' });
    if (brain === 'smart') { await sleep(260); const r2 = el.getBoundingClientRect(); await flyTo(Math.max(8, r2.left - 20), Math.max(8, r2.top - 40), 450); }
    el.style.outline = '3px solid #ff5a1f'; window.setTimeout(() => (el.style.outline = ''), 1200);
    if (a.action === 'type') { if (a.submit && submissionNeedsApproval(el) && !(await approve(`submit this form on ${location.hostname}`))) { await finish('Cancelled.'); return 'stop'; } typeInto(el, String(a.text || '')); job.history.push(`typed "${String(a.text || '').slice(0, 30)}" into ${a.id}`); if (a.submit) { await sleep(300); enter(el); } }
    else if (a.action === 'click') {
      if (!(await mayClick(el, label))) { job.history.push('user declined click ' + label); await finish(); return 'stop'; }
      el.click(); job.history.push('clicked "' + label + '"');
    } else if (a.action === 'select') {
      if (el instanceof HTMLSelectElement) { const want = String(a.text || '').toLowerCase(), op = [...el.options].find(o => o.text.toLowerCase().includes(want) || o.value.toLowerCase() === want); if (op) { el.value = op.value; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); job.history.push('selected ' + op.text); } else job.history.push('option not found: ' + a.text); } else { el.click(); job.history.push('opened dropdown'); }
    } else job.history.push('unknown action');
    await sleep(700); return 'go';
  }
  const sigPage = () => location.href + '|' + document.title + '|' + document.body.innerText.length + '|' + document.body.innerText.slice(0, 200);
  async function loop() {
    if (running) return; running = true; orb.classList.add('busy');
    try {
      if (brain === 'smart' && !job.plan && !job.noplan && job.goal.split(/\s+/).length > 5) {   // Smart mode plans first; Fast mode starts acting immediately.
        job.noplan = true;
        const pr = await bg({ type: 'ask', phase: 'plan', messages: [{ role: 'user', content: JSON.stringify({ goal: job.goal, playbook: playbookFor(), userFacts: facts.slice(0, 15), examples: recall(job.goal).examples, lessons: recall(job.goal).lessons, url: location.href, title: document.title, visible: snap().filter(e => e.onScreen).slice(0, 25).map(e => e.label).filter(Boolean) }) }] });
        const pl = pr && !pr.error && parse(pr.text);
        if (pl && Array.isArray(pl.steps)) { job.plan = pl; say('s', 'Plan: ' + pl.steps.slice(0, 6).join(' → ')); await save(); }
      }
      while (job && job.status === 'running') {
        if (job.steps >= 35) { await finish('Step limit reached. Tell me to continue if needed.'); break; }
        const rc = recall(job.goal), payload = { goal: job.goal, playbook: playbookFor(), examples: rc.examples, lessons: rc.lessons, userFacts: facts.slice(0, 15), plan: job.plan, lastResult: job.last, hint: job.hint, url: location.href, title: document.title, text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 1200), elements: (() => { const all = snap(); return [...all.filter(e => e.onScreen), ...all.filter(e => !e.onScreen)].slice(0, 60); })(), history: job.history.slice(-8) };
        const res = await bg({ type: 'ask', messages: [{ role: 'user', content: JSON.stringify(payload) }] });
        if (!res || res.error) { if (job.status !== 'running') break; say('e', (res && res.error) || 'No response from JARVIS server.'); await finish(); break; }
        const a = res.reply || parse(res.text); job.steps++;
        if (!a) { job.history.push('unreadable reply'); job.bad = (job.bad || 0) + 1; await save(); if (job.bad >= 2) { say('e', 'JARVIS could not get a usable reply. Open the toolbar popup, check the API address, and press Test. If it still fails, push the latest website files so Vercel redeploys.'); await finish(); break; } await sleep(600); continue; }
        job.hint = '';
        if (a.thought) say('s', '💭 ' + a.thought);
        if (a.say) say('a', a.say);
        const before = sigPage(), key = a.action + ':' + (a.id ?? a.url ?? a.text ?? '');
        job.keys = [...(job.keys || []), key].slice(-6);
        const out = await act(a);
        if (out === 'go') { await sleep(brain === 'smart' ? 250 : 40); job.last = a.action === 'scroll' ? 'scrolled' : (sigPage() !== before ? 'page changed after ' : 'NOTHING visibly changed after ') + a.action; }
        if (job.keys.length >= 3 && new Set(job.keys.slice(-3)).size === 1) job.hint = 'You repeated the same action 3 times with no progress. Choose a different element, scroll, navigate directly, or ask the user.';
        await save();
        if (out === 'stop' || out === 'nav') break;
      }
    } finally { running = false; if (!job || job.status !== 'running') orb.classList.remove('busy'); }
  }
  async function start(text) {
    text = text.trim(); if (!text) return;
    if (job && job.awaiting) { job.goal += ' (user replied: ' + text + ')'; job.awaiting = false; job.status = 'running'; }
    else if (job && job.status === 'idle' && job.history.length && /^(continue|go on|resume)\b/i.test(text)) job.status = 'running';
    else job = { goal: text, steps: 0, history: [], status: 'running' };
    job.steps = 0; job.bad = 0;
    say('s', brain === 'smart' ? 'Thinking through the steps…' : 'Working…');
    await save(); await loop();
  }
  $('#go').onclick = () => { const i = $<HTMLInputElement>('#in'); const t = i.value; i.value = ''; handle(t); };
  for (const ev of ['keydown', 'keypress', 'keyup']) addEventListener(ev, event => { const e = event as KeyboardEvent; if (e.composedPath().includes(host) && !(e.altKey && e.key.toLowerCase() === 'j')) e.stopImmediatePropagation(); }, true);
  $<HTMLInputElement>('#in').onkeydown = e => { if (e.key === 'Enter') $('#go').click(); e.stopPropagation(); };
  $<HTMLInputElement>('#in').onkeyup = e => e.stopPropagation();
  $('#st').onclick = () => { void store.set('q' + tabId, []); if (job) { job.status = 'idle'; void save(); } void bg({ type: 'stop' }); try { speechSynthesis.cancel(); } catch {} approveResolve && approveResolve(false); say('s', 'Stopped.'); orb.classList.remove('busy'); };
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && job?.status === 'running') { event.preventDefault(); $('#st').click(); } }, true);
  chrome.runtime.onMessage.addListener(m => { if (m.type === 'activated') flyIn(); if (m.type === 'wake') activate(true); if (m.type === 'command') { toggle(true); handle(m.text); } });



  /* ---- page-to-page animation: iris closes around the bot, shockwave on arrival ---- */
  const host_ = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
  async function warpOut(label) {
    if (matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    const o = orb.getBoundingClientRect(), x = o.left + o.width / 2, y = o.top + o.height / 2, far = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 40;
    const iris = $('#iris'), ring = $('#ring'), wl = $('#wl'); wl.textContent = '▶ ' + label; iris.classList.add('on'); ring.style.display = 'block';
    wl.animate([{ top: '-60px' }, { top: '28px' }], { duration: 350, fill: 'forwards', easing: 'ease-out' });
    const t0 = performance.now(), D = 520;
    await new Promise<void>(res => { (function f(t: number) { const k = Math.min(1, (t - t0) / D), e = k * k * k, r = far * (1 - e) + 36 * e; iris.style.webkitMaskImage = iris.style.maskImage = `radial-gradient(circle at ${x}px ${y}px, transparent ${r}px, #000 ${r + 2}px)`; ring.style.cssText = `display:block;left:${x - r}px;top:${y - r}px;width:${2 * r}px;height:${2 * r}px`; k < 1 ? requestAnimationFrame(f) : res(); })(t0); });
  }
  function shock(x, y) { if (matchMedia('(prefers-reduced-motion:reduce)').matches) return; for (let i = 0; i < 3; i++) { const s = document.createElement('div'); s.className = 'shock'; s.style.left = x + 'px'; s.style.top = y + 'px'; root.appendChild(s); s.animate([{ transform: 'scale(.3)', opacity: 1 }, { transform: 'scale(14)', opacity: 0 }], { duration: 900, delay: i * 140, easing: 'ease-out', fill: 'backwards' }).finished.then(() => s.remove()).catch(() => s.remove()); } }
  function banner(text) { const wl = $('#wl'); wl.textContent = text; wl.animate([{ top: '-60px', opacity: 1 }, { top: '24px', opacity: 1, offset: .2 }, { top: '24px', opacity: 1, offset: .8 }, { top: '-60px', opacity: 0 }], { duration: 2200, fill: 'forwards' }); }
  async function jump(url) { if (brain === 'smart') await warpOut(host_(url)); await store.set('warp', { host: host_(url), t: Date.now() }); await bg({ type: 'nav', url }); }

  /* ---- direct commands: no AI needed, so "click X" just clicks ---- */
  const norm = (input: string) => normalizeSpokenText(input, aliases);
  async function touch(el: HTMLElement) { rememberTarget(el); el.scrollIntoView({ block: 'center', behavior: brain === 'smart' ? 'smooth' : 'auto' }); if (brain === 'smart') { await sleep(240); const r = el.getBoundingClientRect(); await flyTo(Math.max(8, r.left - 20), Math.max(8, r.top - 40), 450); } el.style.outline = '3px solid #ff5a1f'; window.setTimeout(() => (el.style.outline = ''), 1200); }
  function pick(q: string, ok?: (element: { tag: string; type?: string; onScreen: boolean }) => boolean): HTMLElement | null {
    const w = q.toLowerCase().replace(/^(the|a|an)\s+/, '').replace(/\s+(button|link|tab|icon|field|box|option)$/, '').trim(); let best = null, bs = 0;
    for (const e of snap()) { if (ok && !ok(e)) continue; if (!e.label) continue; let sc = scoreLabel(e.label, w); if (sc < .6) continue; sc += (e.onScreen ? .05 : 0) - e.label.length / 20000; if (sc > bs) { bs = sc; best = e; } }
    return best ? document.querySelector<HTMLElement>(`[data-jv="${best.id}"]`) : null;
  }
  function nthEl(kind, n) {
    const vid = /video|song|short/.test(kind), seen = new Set(), list = [];
    for (const a of document.querySelectorAll<HTMLAnchorElement>('a[href]')) {
      if (host.contains(a) || a.closest('nav,header,footer,[role=navigation]')) continue;
      const r = a.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue;
      const lab = (a.getAttribute('title') || a.getAttribute('aria-label') || a.innerText || '').trim(); if (lab.length < 6) continue;
      const href = a.href.split('#')[0]; if (vid && !/\/watch\?|\/shorts\/|\/video\/|\/reel\//.test(href)) continue;
      if (seen.has(href)) continue; seen.add(href); list.push(a);
    }
    return n < 0 ? list[list.length - 1] : list[n - 1];
  }
  async function go(u) { say('a', 'Opening ' + u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)); await jump(u); }
  async function local(text) {
    const c = parseCmd(text); if (!c) return false;
    if (c.t === 'wake') { activate(false); return true; }
    if (c.t === 'teach') { const k = keyOf(c.phrase); if (!k) return true; skills[k] = norm(c.action); await put('skills', skills); say('a', `Learned. When you say "${c.phrase}", I will ${c.action}.`); return true; }
    if (c.t === 'alias') { aliases[c.from.toLowerCase()] = c.to; await put('aliases', aliases); say('a', `Got it. When I hear "${c.from}", I will read it as "${c.to}".`); return true; }
    if (c.t === 'fact') { if (SECRETISH.test(c.text)) { say('e', 'I will not store passwords, PINs or card details.'); return true; } facts = [c.text.slice(0, 200), ...facts.filter(f => f !== c.text)].slice(0, 30); await put('facts', facts); say('a', 'I will remember that.'); return true; }
    if (c.t === 'forget') {
      if (c.q === '*') { if (!(await approve('erase everything I have learned'))) return true; skills = {}; facts = []; aliases = {}; exp = []; lessons = []; await store.set('skills', {}); await store.set('facts', []); await store.set('aliases', {}); await store.set('exp', []); await store.set('lessons', []); say('a', 'Memory cleared.'); return true; }
      const q = c.q.toLowerCase(); let n = 0;
      for (const k of Object.keys(skills)) if (scoreLabel(k, q) >= .8) { delete skills[k]; n++; }
      for (const k of Object.keys(aliases)) if (k === q) { delete aliases[k]; n++; }
      const nf = facts.filter(f => scoreLabel(f, q) < .8); n += facts.length - nf.length; facts = nf;
      await put('skills', skills); await put('aliases', aliases); await put('facts', facts); say(n ? 'a' : 'e', n ? `Forgot ${n} item${n > 1 ? 's' : ''}.` : `I have nothing learned about "${c.q}".`); return true;
    }
    if (c.t === 'listskills') { const sk = Object.entries(skills).map(([k, v]) => `"${k}" → ${v}`), lines = [...sk, ...facts.map(f => 'fact: ' + f), ...Object.entries(aliases).map(([k, v]) => `hear "${k}" as "${v}"`)]; say('s', lines.length ? 'I have learned:\n' + lines.slice(0, 12).join('\n') : 'Nothing yet. Try: "when I say good morning, open gmail then open youtube".'); return true; }
    if (c.t === 'good') { if (exp[0] && exp[0].goal === lastGoal) { exp[0].good = true; await put('exp', exp); } say('a', 'Glad that worked. I will repeat that approach.'); return true; }
    if (c.t === 'bad') { if (!lastGoal) { say('a', 'Tell me what went wrong and I will remember it.'); } else { say('a', 'Sorry about that. What should I have done instead?'); } awaitingLesson = true; return true; }

    if (c.t === 'stop') { $('#st').click(); return true; }
    if (job && job.status === 'running') { job.status = 'idle'; await save(); }
    if (c.t === 'reference') {
      const target = lastTarget;
      const el = target?.el.isConnected ? target.el : target?.label ? pick(target.label) : null;
      if (!el) { say('e', 'Point at the link or button, then say “click that” or tell me its label.'); return true; }
      rememberTarget(el);
      if (c.op === 'newtab') {
        const href = (el as PageElement).href || (el instanceof HTMLAnchorElement ? el.href : '');
        if (!/^https?:\/\//i.test(href)) { say('e', 'That target does not have a safe web link to open in a new tab.'); return true; }
        const result = await bg<AgentReply>({ type: 'tabs', op: 'new', url: href });
        say(result?.say ? 'a' : 'e', result?.say || 'I could not open that in a new tab.'); return true;
      }
      if (!(await mayClick(el, target?.label || 'that item'))) return true;
      await touch(el); el.click(); say('a', (c.op === 'open' ? 'Opened ' : 'Clicked ') + (target?.label || 'that item') + '.'); return true;
    }
    if (c.t === 'nav') { await go(c.url); return true; }
    if (c.t === 'tabs') { if (['next', 'prev', 'switch'].includes(c.op)) await flyTo(innerWidth + 40, -60, 450); const r = await bg({ type: 'tabs', op: c.op, q: c.q, url: c.url }); if (r && r.say) say('a', r.say); return true; }
    if (c.t === 'hist') { say('a', c.op === 'back' ? 'Going back.' : c.op === 'forward' ? 'Going forward.' : 'Reloading.'); await sleep(300); c.op === 'back' ? history.back() : c.op === 'forward' ? history.forward() : location.reload(); return true; }
    if (c.t === 'scroll') { c.d === 'top' ? scrollTo({ top: 0, behavior: 'smooth' }) : c.d === 'bottom' ? scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }) : scrollBy({ top: (c.d === 'up' ? -1 : 1) * innerHeight * .8, behavior: 'smooth' }); say('a', 'Scrolling ' + c.d + '.'); return true; }
    if (c.t === 'enter') { const el = document.activeElement && document.activeElement !== document.body ? document.activeElement as HTMLElement : null; if (!el) { say('e', 'Nothing is focused. Tell me where to type first.'); return true; } if (submissionNeedsApproval(el) && !(await approve(`submit this form on ${location.hostname}`))) return true; enter(el); say('a', 'Enter pressed.'); return true; }
    if (c.t === 'media') {
      const v = [...document.querySelectorAll<HTMLMediaElement>('video,audio')].sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0];
      if (c.op === 'next') { const nb = document.querySelector<HTMLElement>('.ytp-next-button'); if (nb) { nb.click(); say('a', 'Next video.'); } else say('e', 'No next button here.'); return true; }
      if (!v) { say('e', 'I cannot find a video or audio player on this page.'); return true; }
      const o = c.op, amount = c.n ?? 0;
      if (o === 'pause') { v.pause(); say('a', 'Paused.'); } else if (o === 'play') { v.play(); say('a', 'Playing.'); } else if (o === 'mute') { v.muted = true; say('a', 'Muted.'); } else if (o === 'unmute') { v.muted = false; say('a', 'Unmuted.'); }
      else if (o === 'volup') { v.muted = false; v.volume = Math.min(1, v.volume + .2); say('a', 'Volume ' + Math.round(v.volume * 100) + '%.'); } else if (o === 'voldown') { v.volume = Math.max(0, v.volume - .2); say('a', 'Volume ' + Math.round(v.volume * 100) + '%.'); } else if (o === 'volset') { v.muted = false; v.volume = amount / 100; say('a', 'Volume ' + amount + '%.'); }
      else if (o === 'fs') { if (document.fullscreenElement) document.exitFullscreen(); else (v.closest('#movie_player') || v).requestFullscreen().catch(() => {}); say('a', 'Fullscreen toggled.'); }
      else if (o === 'skip') { v.currentTime = Math.max(0, v.currentTime + amount); say('a', (amount > 0 ? 'Skipped ' : 'Rewound ') + Math.abs(amount) + ' seconds.'); } else if (o === 'faster') { v.playbackRate = Math.min(4, v.playbackRate + .25); say('a', 'Speed ' + v.playbackRate + 'x.'); } else if (o === 'slower') { v.playbackRate = Math.max(.25, v.playbackRate - .25); say('a', 'Speed ' + v.playbackRate + 'x.'); } else if (o === 'normal') { v.playbackRate = 1; say('a', 'Normal speed.'); }
      return true;
    }
    if (c.t === 'page') {
      const de = document.documentElement, z = parseFloat(de.style.zoom || '1');
      if (c.op === 'zin') { de.style.zoom = String(Math.min(3, z + .1)); say('a', 'Zoomed in.'); } else if (c.op === 'zout') { de.style.zoom = String(Math.max(.3, z - .1)); say('a', 'Zoomed out.'); } else if (c.op === 'zreset') { de.style.zoom = '1'; say('a', 'Zoom reset.'); }
      else if (c.op === 'dark') { const on = document.body.style.filter ? '' : 'invert(1) hue-rotate(180deg)'; document.body.style.filter = on; say('a', on ? 'Dark mode on.' : 'Dark mode off.'); }
      else if (c.op === 'read') { const sel = String(getSelection()), el = document.querySelector<HTMLElement>('article,main') || document.body, txt = (sel || el.innerText).replace(/\s+/g, ' ').trim().slice(0, 1800); say('s', 'Reading…'); speak(txt, true); }
      else if (c.op === 'copylink') { await navigator.clipboard.writeText(location.href).catch(() => {}); say('a', 'Link copied.'); } else if (c.op === 'copysel') { await navigator.clipboard.writeText(String(getSelection())).catch(() => {}); say('a', 'Copied.'); }
      else if (c.op === 'selall') { getSelection().selectAllChildren(document.body); say('a', 'Selected everything.'); } else if (c.op === 'print') { say('a', 'Printing.'); setTimeout(() => print(), 300); }
      return true;
    }
    if (c.t === 'find') { const query = c.q.toLowerCase(); const match = [...document.querySelectorAll<HTMLElement>('body *')].find(el => el.children.length === 0 && (el.innerText || '').toLowerCase().includes(query)); match?.scrollIntoView({ block: 'center', behavior: 'auto' }); say(match ? 'a' : 'e', match ? 'Found "' + c.q + '".' : 'I can’t find "' + c.q + '" on this page.'); return true; }
    if (c.t === 'info') {
      const n = new Date();
      if (c.op === 'time') say('a', 'It is ' + n.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '.'); else if (c.op === 'date') say('a', n.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + '.');
      else say('s', 'Teach me: "when I say good morning, open gmail then youtube", "remember that I like jazz", "when you hear gmale I mean gmail", "forget good morning", "what have you learned". Say "good job" or "that was wrong" after a task and I learn from it. I can: open sites, search, click, type, scroll, go back/forward/reload, control tabs (next, previous, switch to X, new, duplicate, pin, mute, close, reopen), control video (pause, play, mute, volume, skip, speed, fullscreen, next video), zoom, dark mode, read aloud, find text, copy link, summarize, calculate, tell time. Say several in one breath.');
      return true;
    }
    if (c.t === 'math') { let r; try { r = Function('"use strict";return (' + c.e + ')')(); } catch { r = NaN; } say(isFinite(r) ? 'a' : 'e', isFinite(r) ? c.e.replace(/\s+/g, '') + ' = ' + +r.toFixed(6) : 'I could not work that out.'); return true; }
    if (c.t === 'agent') { await start(c.goal); return true; }
    if (c.t === 'nth') { const el = nthEl(c.kind, c.n); if (!el) { say('e', `I can't find that ${c.kind} on this page.`); return true; } const lab = (el.getAttribute('title') || el.getAttribute('aria-label') || el.innerText || '').trim().slice(0, 50); if (!(await mayClick(el, lab))) return true; await touch(el); el.click(); say('a', 'Opening ' + lab + '.'); return true; }
    if (c.t === 'click') {
      const el = pick(c.q); if (!el) { const sw = c.q; say('e', `I can't see "${sw}" on this page. Say "scroll down" and try again, or describe it differently.`); return true; }
      const label = (el.innerText || (el as PageElement).value || el.getAttribute('aria-label') || c.q).trim().slice(0, 40); if (!(await mayClick(el, label))) return true; await touch(el); el.click(); say('a', 'Clicked ' + label + '.'); return true;
    }
    if (c.t === 'type') {
      const field = (e: { tag: string; type?: string }) => /^(input|textarea)$/.test(e.tag) && !/^(hidden|checkbox|radio|submit|button|file)$/.test(e.type || '');
      let el = c.q ? pick(c.q, field) : null;
      if (!el && !c.q) { const a = document.activeElement; el = a && /^(INPUT|TEXTAREA)$/.test(a.tagName) ? a as HTMLElement : (() => { const f = snap().find(e => field(e) && e.onScreen); return f ? document.querySelector<HTMLElement>(`[data-jv="${f.id}"]`) : null; })(); }
      if (!el) { say('e', 'I could not find a text box to type in.'); return true; }
      const node = el as PageElement;
      if (SECRET.test([node.type, node.name, el.id, node.autocomplete].join(' '))) { say('e', 'I never fill passwords or payment fields. Please type that yourself.'); return true; }
      if (c.submit && submissionNeedsApproval(el) && !(await approve(`submit this form on ${location.hostname}`))) return true;
      await touch(el); typeInto(el, c.text); if (c.submit) { await sleep(300); enter(el); } say('a', 'Typed it' + (c.submit ? ' and pressed enter.' : '.')); return true;
    }
    return false;
  }
  function ack() { orb.classList.add('ack'); setTimeout(() => orb.classList.remove('ack'), 380); }
  let draining = false;
  async function drain() {
    if (draining || tabId == null) return; draining = true;
    try {
      for (;;) {
        const q = (await store.get<string[]>('q' + tabId)) || []; if (!q.length) break;
        await store.set('q' + tabId, q.slice(1));   // remove first, so a page change never repeats a command
        say('u', q[0]);
        if (!(await local(q[0]))) await start(q[0]);
        await sleep(250);
      }
    } finally { draining = false; }
  }
  async function handle(text) { text = norm((text || '').trim()); if (!text) return;
    if (awaitingLesson) { awaitingLesson = false; if (!/^(cancel|never mind|stop)$/i.test(text)) { lessons.unshift({ goal: lastGoal || 'general', lesson: text.slice(0, 240) }); lessons = lessons.slice(0, 40); await put('lessons', lessons); say('u', text); say('a', 'Understood. I will do it that way next time.'); } return; }
    text = expandSkill(text); const q = (await store.get<string[]>('q' + tabId)) || []; await store.set('q' + tabId, [...q, ...splitCmds(text)]); drain(); }

  /* ---- voice input: wait for final results and recover from mic/network errors ---- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; let rec: SpeechRecognitionLike = null, listening = false, restartTimer = 0, restartDelay = 350, handledFinal = -1;
  function mk() {
    if (!listening || document.visibilityState !== 'visible' || !SR) return;
    const current = new SR(); rec = current; handledFinal = -1; current.lang = lang; current.continuous = true; current.interimResults = true; current.maxAlternatives = 5;
    current.onspeechstart = () => { orb.classList.add('hear'); try { speechSynthesis.cancel(); } catch {} }; current.onspeechend = () => orb.classList.remove('hear');
    current.onresult = e => {
      if (window.speechSynthesis && speechSynthesis.speaking) return;
      const score = x => splitCmds(norm(x)).filter(p => parseCmd(p)).length;
      for (let i = Math.max(e.resultIndex || 0, handledFinal + 1); i < e.results.length; i++) {
        const result = e.results[i], alternatives = [...result].map(x => ({ text: x.transcript.trim(), confidence: Number(x.confidence) || 0 }));
        if (!result.isFinal) { $('#hear').textContent = alternatives[0]?.text ? '🎤 ' + alternatives[0].text : ''; continue; }
        handledFinal = i; restartDelay = 350;
        const best = alternatives.reduce((chosen, item) => score(item.text) > score(chosen.text) || (score(item.text) === score(chosen.text) && item.confidence > chosen.confidence) ? item : chosen, alternatives[0] || { text: '', confidence: 0 });
        $('#hear').textContent = '';
        if (best.text) { ack(); void handle(best.text); }
      }
    };
    current.onerror = e => {
      if (rec !== current) return;
      const error = String(e.error || '');
      if (error === 'not-allowed' || error === 'service-not-allowed') { listening = false; $('#mic').classList.remove('on'); orb.classList.remove('listen'); void store.set('listen', false); $('#hear').textContent = 'Allow microphone access in the site settings, then press 🎤 again.'; }
      else if (error === 'audio-capture') { listening = false; $('#mic').classList.remove('on'); orb.classList.remove('listen'); void store.set('listen', false); $('#hear').textContent = 'No microphone detected. Check the selected input device.'; }
      else if (error === 'network') { $('#hear').textContent = 'Voice recognition connection interrupted; retrying…'; restartDelay = Math.min(restartDelay * 2, 5000); }
    };
    current.onend = () => {
      if (rec === current) rec = null;
      orb.classList.remove('hear');
      if (listening && document.visibilityState === 'visible') { window.clearTimeout(restartTimer); restartTimer = window.setTimeout(() => { restartTimer = 0; mk(); }, restartDelay); restartDelay = Math.min(restartDelay * 2, 5000); }
    };
    try { current.start(); } catch { if (rec === current) rec = null; if (listening) { window.clearTimeout(restartTimer); restartTimer = window.setTimeout(mk, restartDelay); restartDelay = Math.min(restartDelay * 2, 5000); } }
  }
  function listen(on) { orb.classList.toggle('listen', on); if (on && !SR) return say('e', 'Voice input is not supported in this browser.'); listening = on; $('#mic').classList.toggle('on', on); void store.set('listen', on); window.clearTimeout(restartTimer); if (on) mk(); else { $('#hear').textContent = ''; try { rec && rec.abort(); } catch {} rec = null; } }
  $('#mic').onclick = () => listen(!listening);
  $('#vo').onclick = () => { speakOn = !speakOn; $('#vo').classList.toggle('off', !speakOn); if (!speakOn) speechSynthesis.cancel(); };
  document.addEventListener('visibilitychange', async () => { if (document.visibilityState === 'hidden') { window.clearTimeout(restartTimer); try { rec && rec.abort(); } catch {} rec = null; } else if (SR && !companionOn && (await store.get('listen'))) { listening = true; $('#mic').classList.add('on'); orb.classList.add('listen'); mk(); } });

  /* ---- Tony Stark style activation ---- */
  async function activate(long = true) {
    const b = $('#boot'), bt = $('#bt'); b.style.opacity = '1'; b.classList.add('on'); orb.style.visibility = 'hidden';
    const lines = long ? ['INITIALIZING J.A.R.V.I.S.', 'LOADING NEURAL CORE', 'ALL SYSTEMS ONLINE', 'GOOD DAY, SIR.'] : ['J.A.R.V.I.S. ONLINE'];
    for (const l of lines) { bt.textContent = ''; for (const ch of l) { bt.textContent += ch; await sleep(28); } await sleep(long ? 420 : 500); }
    if (speakOn && window.speechSynthesis) { try { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance('Good day, sir. JARVIS online.')); } catch {} }
    b.style.opacity = '0'; await sleep(700); b.classList.remove('on'); orb.style.visibility = ''; await flyIn();
  }


  /* ---- learning: shortcuts, facts, voice fixes, experience, site playbooks ---- */
  const PLAYBOOKS: Array<[RegExp, string]> = [
    [/youtube\./, 'Search by navigating to https://www.youtube.com/results?search_query=QUERY. Video titles are links: click the title to play. Skip ads with the button labelled Skip. Fullscreen: key f. Use action read for descriptions or comments.'],
    [/(^|\.)google\.[a-z.]+$/, 'Search by navigating to https://www.google.com/search?q=QUERY. Result titles are links. Use the Images, News, Maps tabs by clicking their labels.'],
    [/mail\.google/, 'Compose button is labelled Compose. Recipient field label To, then Subject, then the message body. The Send button sends for real: ALWAYS ask before sending.'],
    [/amazon\./, 'Search box placeholder Search Amazon. Result titles are links. Add to Cart is safe; Buy Now / Place your order spends money: ALWAYS ask first.'],
    [/github\.com/, 'Top search box searches repos. Tabs: Code, Issues, Pull requests, Actions. Repo URLs look like github.com/OWNER/REPO.'],
    [/web\.whatsapp/, 'Use the search box to find a chat, click the chat, type in the box labelled Type a message. Pressing Enter sends for real: ALWAYS ask before sending.'],
    [/linkedin\./, 'Search box at top. Connect / Message / Post buttons act on real people: ask before using them.'],
    [/(^|\.)(x|twitter)\.com$/, 'Post / Reply send publicly: ALWAYS ask before posting. Search box at top right.'],
    [/reddit\./, 'Search box at top. Sort tabs Hot / New / Top. Post titles are links.'],
    [/wikipedia\./, 'Search box top right. Article text is in the page text: use read to get more of it.'],
    [/maps\.google|google\.[a-z.]+\/maps/, 'Search box labelled Search Google Maps; the Directions button starts a route; type the start and destination into the two boxes.'],
    [/flipkart\.|myntra\.|ajio\./, 'Search box at top, results are product links. Add to cart is safe; Buy now / Place order spends money: ask first.'],
    [/./, 'Forms: fill one field at a time, then ask before submitting anything. If a cookie or popup banner blocks the page, click Accept/Close first.'],
  ];
  const playbookFor = () => PLAYBOOKS.find(([re]) => re.test(location.hostname))?.[1] || '';
  const keyOf = t => toks(t).join(' ');
  function expandSkill(text) {
    const k = keyOf(text), Q = toks(text); if (!Q.length) return text;
    if (skills[k]) return skills[k];
    for (const [phrase, action] of Object.entries(skills)) { const P = phrase.split(' '); if (P.length === Q.length && P.every((w, i) => near(w, Q[i]))) return action; }
    return text;
  }
  function recall(goal) {
    const sim = g => scoreLabel(g, goal) >= .6;
    const ex = exp.filter(e => sim(e.goal)).sort((a, b) => (b.good ? 1 : 0) - (a.good ? 1 : 0)).slice(0, 2).map(e => ({ goal: e.goal, steps: e.steps.slice(-6) }));
    return { examples: ex, lessons: lessons.filter(l => sim(l.goal)).slice(0, 3).map(l => l.lesson) };
  }
  const put = (k, v) => store.set(k, v);
  const SECRETISH = /(password|passcode|pin\b|otp|cvv|card number|credit card|aadhaar|ssn)/i;
  function rememberExp() {
    if (!job || job.steps < 2 || /summari[sz]e this page/i.test(job.goal)) return;
    exp.unshift({ goal: job.goal, host: location.hostname, steps: job.history.slice(-8), t: Date.now(), good: false }); exp = exp.slice(0, 40); lastGoal = job.goal; put('exp', exp);
    say('s', 'Say "good job" or "that was wrong" and I will learn from it.');
  }

  /* ---- boot ---- */
  (async () => {
    skills = (await store.get<Record<string, string>>('skills')) || {}; facts = (await store.get<string[]>('facts')) || []; aliases = (await store.get<Record<string, string>>('aliases')) || {}; exp = (await store.get<any[]>('exp')) || []; lessons = (await store.get<Array<{ goal: string; lesson: string }>>('lessons')) || [];
    size = (await store.get<string>('size')) || 'auto'; brain = (await store.get<string>('brain')) === 'smart' ? 'smart' : 'fast'; companionOn = !!(await store.get<boolean>('companion')); voiceName = (await store.get<string>('voiceName')) || ''; applySize(); pv();
    pos = (await store.get<typeof pos>('orbPos')) || pos; home();
    lang = (await store.get<string>('lang')) || lang;
    replyLanguage = (await store.get<string>('replyLanguage')) || ''; pv();
    const w = await store.get<{ host: string; t: number }>('warp');
    if (!(await store.get<boolean>('booted')) && window === top) { await store.set('booted', true); activate(true); } else { await flyIn(); if (w && Date.now() - w.t < 12000) { await store.set('warp', null); banner('ARRIVED · ' + w.host); } }
    if (SR && !companionOn && (await store.get<boolean>('listen')) && document.visibilityState === 'visible') { listening = true; $('#mic').classList.add('on'); mk(); }
    tabId = await bg<number>({ type: 'tabId' }); job = tabId != null ? await store.get<any>('job' + tabId) : null;
    if (job && job.status === 'running') { toggle(true); say('s', 'Continuing: ' + job.goal); await sleep(1200); loop(); }
    else if (((await store.get<string[]>('q' + tabId)) || []).length) { toggle(true); await sleep(brain === 'smart' ? 1500 : 250); drain(); }
    else say('s', 'JARVIS online. Try: "open youtube and search for lo-fi", "click Sign in", "scroll down", "next tab". Press 🎤 to talk.');
  })();
})();

  },
});
