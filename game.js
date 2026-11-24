'use strict';

/* =========================================================
 * 취준생 치와와 - 게임 로직
 * 흐름: 이름 → 외형 → 의상 → [0 지원 → 1 자소서 → 2 스펙 쌓기 → 3 서류 전형 → 4 인적성 → 5 면접 → 6 결과]
 * 스펙 쌓기 ~ 면접 동안 스트레스·피곤이 쌓이고, 하나라도 100이 되면 쉼터로 이동한다.
 * ========================================================= */

const STAGES = ['지원', '자소서', '스펙 쌓기', '서류 전형', '인적성', '면접', '결과'];
const SAVE_KEY = 'chihuahua-jobseeker-save-v2';
const FAST = /[?&]fast=1/.test(location.search); // 테스트용: 쉼터 회복을 빠르게
const SPEC_WEEKS = 8;
const DOC_PASS = 50;
const ESSAY_MIN = 10;
const ESSAY_MAX = 400;

/* ---------- 캐릭터 꾸미기 데이터 ---------- */
const COLORS = [
  { id: 'white', name: '흰색', hex: '#FFFFFF' },
  { id: 'black', name: '검은색', hex: '#111111' },
  { id: 'green', name: '초록색', hex: '#00C853' },
  { id: 'blue', name: '파란색', hex: '#0057FF' },
  { id: 'red', name: '빨간색', hex: '#FF1A1A' },
  { id: 'yellow', name: '노란색', hex: '#FFE100' },
  { id: 'purple', name: '보라색', hex: '#8A2BE2' },
  { id: 'gray', name: '회색', hex: '#8C8C8C' },
  { id: 'pink', name: '핑크색', hex: '#FF4FA3' },
];
const FURS = [
  { id: 'white', name: '하얀 치와와', swatch: '#FAF7F2', fur: '#FAF7F2', inner: '#F6C2B8', patch: '#FFFFFF', line: '#C9BBAA' },
  { id: 'black', name: '검은 치와와', swatch: '#2B2624', fur: '#2B2624', inner: '#7A5148', patch: '#C98B52', line: '#141110' },
  { id: 'beige', name: '베이지 치와와', swatch: '#E0AA6E', fur: '#E0AA6E', inner: '#F4C6B0', patch: '#F6DCB8', line: '#B9844C' },
];
const GENDERS = [{ id: 'f', name: '여자' }, { id: 'm', name: '남자' }];
const BOTTOM_TYPES = [{ id: 'skirt', name: '치마' }, { id: 'pants', name: '바지' }];
const JACKETS = [{ id: 'none', name: '없음', hex: null }, ...COLORS];

const COMPANIES = [
  { name: '삼성전자', req: 70 },
  { name: 'SK하이닉스', req: 70 },
  { name: '현대자동차', req: 70 },
  { name: '기아', req: 70 },
  { name: 'LG전자', req: 68 },
  { name: '네이버', req: 68 },
  { name: '카카오', req: 68 },
];
const CUSTOM_REQ = 60;

/* ---------- 유틸 ---------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// 받침에 따라 조사 선택: josa('초코', '은', '는') → '초코는'
const josa = (word, withBatchim, without) => {
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return word + without;
  return word + ((c - 0xac00) % 28 ? withBatchim : without);
};
const byId = (list, id) => list.find((x) => x.id === id);
const colorHex = (id) => byId(COLORS, id).hex;

/* ---------- 상태 & 저장 ---------- */
let S = null;

function newState(name, look) {
  return {
    name, look, stage: 0,
    company: null, companyReq: CUSTOM_REQ,
    stress: 0, fatigue: 0, money: 40,
    toeic: 0, cert: 0, intern: 0,
    essayAnswers: [], essay: 0, spec: 0, doc: 0,
    apt: 0, nback: 0, potion: 0, interview: 0, total: 0,
  };
}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* 저장 불가 환경 */ } }
function loadSave() { try { const r = localStorage.getItem(SAVE_KEY); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 무시 */ } }

function fixStats() {
  S.stress = clamp(S.stress, 0, 100);
  S.fatigue = clamp(S.fatigue, 0, 100);
  S.money = Math.max(0, S.money);
}
// 게이지 변화 (스펙 쌓기 ~ 면접에서 사용)
function gauge(stress, fatigue) { S.stress += stress; S.fatigue += fatigue; fixStats(); }

/* ---------- 타이머 관리 (화면 전환 시 모두 정리) ---------- */
let timers = [];
function later(fn, ms) { const id = setTimeout(fn, ms); timers.push(id); return id; }
function every(fn, ms) { const id = setInterval(fn, ms); timers.push(id); return id; }
function clearTimers() { timers.forEach((id) => { clearTimeout(id); clearInterval(id); }); timers = []; }

/* ---------- 화면 그리기 ---------- */
const app = document.getElementById('app');

function show(html, actions = {}, keepScroll = false) {
  clearTimers();
  app.innerHTML = html;
  app.querySelectorAll('[data-act]').forEach((el) => {
    const fn = actions[el.dataset.act];
    if (fn) el.addEventListener('click', () => { if (!el.disabled) fn(el.dataset.arg, el); });
  });
  if (!keepScroll) window.scrollTo({ top: 0 });
}

function intro(stageIdx, emoji, title, desc, onStart, extraHtml = '', extraActions = {}) {
  S.stage = stageIdx;
  save();
  updateHUD();
  show(`
    <div class="card">
      <div class="step">${stageIdx + 1}단계 · ${STAGES[stageIdx]}</div>
      <div class="big-emoji">${emoji}</div>
      <h2 class="center">${title}</h2>
      <p class="muted center">${desc}</p>
      ${extraHtml}
      <button class="btn" data-act="start">시작하기</button>
    </div>`, { start: onStart, ...extraActions });
}

/* =========================================================
 * 캐릭터 그림 (SVG 레이어: 꼬리 → 다리/하의 → 상의 → 자켓 → 팔 → 머리)
 * 옷 모양은 하나씩만 그려두고 색만 바꿔 끼운다.
 * ========================================================= */
function charSVG(look, mood = 'normal', opt = {}) {
  const F = byId(FURS, look.fur);
  const shirt = colorHex(look.shirt);
  const jacket = look.jacket === 'none' ? null : colorHex(look.jacket);
  const bottom = colorHex(look.bottom);
  const female = look.gender === 'f';
  const edge = 'rgba(0,0,0,.3)';
  const sleeve = jacket || shirt;
  const ink = '#1b1311';

  const tail = `<path d="M128 194 Q166 190 160 152" stroke="${F.line}" stroke-width="12" fill="none" stroke-linecap="round"/>
    <path d="M128 194 Q166 190 160 152" stroke="${F.fur}" stroke-width="8" fill="none" stroke-linecap="round"/>`;

  const feet = `<ellipse cx="84" cy="252" rx="15" ry="8" fill="${F.fur}" stroke="${F.line}" stroke-width="2"/>
    <ellipse cx="116" cy="252" rx="15" ry="8" fill="${F.fur}" stroke="${F.line}" stroke-width="2"/>`;
  let lower;
  if (look.bottomType === 'pants') {
    lower = `
      <line x1="88" y1="204" x2="86" y2="244" stroke="${edge}" stroke-width="25" stroke-linecap="round"/>
      <line x1="112" y1="204" x2="114" y2="244" stroke="${edge}" stroke-width="25" stroke-linecap="round"/>
      <line x1="88" y1="204" x2="86" y2="244" stroke="${bottom}" stroke-width="22" stroke-linecap="round"/>
      <line x1="112" y1="204" x2="114" y2="244" stroke="${bottom}" stroke-width="22" stroke-linecap="round"/>
      ${feet}
      <rect x="69" y="190" width="62" height="26" rx="9" fill="${bottom}" stroke="${edge}" stroke-width="2"/>`;
  } else {
    lower = `
      <line x1="88" y1="222" x2="86" y2="246" stroke="${F.line}" stroke-width="19" stroke-linecap="round"/>
      <line x1="112" y1="222" x2="114" y2="246" stroke="${F.line}" stroke-width="19" stroke-linecap="round"/>
      <line x1="88" y1="222" x2="86" y2="246" stroke="${F.fur}" stroke-width="16" stroke-linecap="round"/>
      <line x1="112" y1="222" x2="114" y2="246" stroke="${F.fur}" stroke-width="16" stroke-linecap="round"/>
      ${feet}
      <path d="M72 190 L128 190 L146 232 Q100 242 54 232 Z" fill="${bottom}" stroke="${edge}" stroke-width="2" stroke-linejoin="round"/>`;
  }

  const torso = `<rect x="68" y="120" width="64" height="80" rx="20" fill="${shirt}" stroke="${edge}" stroke-width="2"/>`;
  let collar;
  if (female) {
    // 블라우스: 둥근 카라 + 리본
    const ribbon = look.shirt === 'pink' || look.shirt === 'red' ? '#111111' : '#FF2E8A';
    collar = `
      <path d="M100 124 Q84 118 80 132 Q92 142 100 130 Z" fill="${shirt}" stroke="${edge}" stroke-width="1.6"/>
      <path d="M100 124 Q116 118 120 132 Q108 142 100 130 Z" fill="${shirt}" stroke="${edge}" stroke-width="1.6"/>
      <path d="M100 136 L89 130 L89 143 Z M100 136 L111 130 L111 143 Z" fill="${ribbon}"/>
      <circle cx="100" cy="136" r="3.6" fill="${ribbon}"/>`;
  } else {
    // 셔츠: 뾰족 카라 + 넥타이
    const tie = look.shirt === 'blue' || look.shirt === 'purple' ? '#FF1A1A' : '#1A2A80';
    collar = `
      <path d="M100 136 L96 132 L94 172 L100 180 L106 172 L104 132 Z" fill="${tie}"/>
      <path d="M86 120 L100 132 L92 142 Z" fill="${shirt}" stroke="${edge}" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M114 120 L100 132 L108 142 Z" fill="${shirt}" stroke="${edge}" stroke-width="1.6" stroke-linejoin="round"/>`;
  }

  const jacketSvg = jacket ? `
    <path d="M68 132 Q68 120 80 120 L88 120 L100 176 L100 202 L78 202 Q68 202 68 192 Z" fill="${jacket}" stroke="${edge}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M132 132 Q132 120 120 120 L112 120 L100 176 L100 202 L122 202 Q132 202 132 192 Z" fill="${jacket}" stroke="${edge}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M88 120 L84 136 L94 148 M112 120 L116 136 L106 148" stroke="${edge}" stroke-width="2" fill="none"/>
    <circle cx="100" cy="188" r="3" fill="${edge}"/>` : '';

  const badge = opt.badge ? `
    <path d="M90 124 L106 158 M110 124 L106 158" stroke="#1A2A80" stroke-width="2.5" fill="none"/>
    <rect x="97" y="156" width="20" height="25" rx="3" fill="#fff" stroke="#1A2A80" stroke-width="2"/>
    <rect x="101" y="161" width="12" height="9" rx="2" fill="#9fc3ff"/>
    <line x1="101" y1="175" x2="113" y2="175" stroke="#1A2A80" stroke-width="1.8"/>` : '';

  const arm = (x1, x2, px) => `
    <line x1="${x1}" y1="134" x2="${x2}" y2="180" stroke="${edge}" stroke-width="21" stroke-linecap="round"/>
    <line x1="${x1}" y1="134" x2="${x2}" y2="180" stroke="${sleeve}" stroke-width="18" stroke-linecap="round"/>
    <circle cx="${px}" cy="186" r="9" fill="${F.fur}" stroke="${F.line}" stroke-width="2"/>`;
  const arms = arm(72, 57, 55) + arm(128, 143, 145);

  // 얼굴
  const eyes = mood === 'tired'
    ? `<path d="M72 78 q8 6 16 0 M112 78 q8 6 16 0" stroke="${look.fur === 'black' ? '#f3e2d0' : ink}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`
    : `<circle cx="80" cy="76" r="8.5" fill="${ink}" ${look.fur === 'black' ? 'stroke="#9b8576" stroke-width="2"' : ''}/>
       <circle cx="120" cy="76" r="8.5" fill="${ink}" ${look.fur === 'black' ? 'stroke="#9b8576" stroke-width="2"' : ''}/>
       <circle cx="83" cy="73" r="2.8" fill="#fff"/><circle cx="123" cy="73" r="2.8" fill="#fff"/>`;
  const brows = look.fur === 'black' ? `<circle cx="78" cy="60" r="4.5" fill="${F.patch}"/><circle cx="122" cy="60" r="4.5" fill="${F.patch}"/>` : '';
  const lashes = female && mood !== 'tired'
    ? `<path d="M71 71 L65 67 M72 76 L65 75 M129 71 L135 67 M128 76 L135 75" stroke="${look.fur === 'black' ? '#f3e2d0' : ink}" stroke-width="2" stroke-linecap="round"/>` : '';
  const mouths = {
    happy: 'M90 102 Q100 113 110 102',
    normal: 'M92 104 Q100 109 108 104',
    nervous: 'M89 106 q5.5 -4.5 11 0 q5.5 4.5 11 0',
    tired: 'M93 106 L107 106',
  };
  const blush = mood === 'happy'
    ? '<ellipse cx="68" cy="94" rx="7" ry="4" fill="#ff9a9a" opacity=".6"/><ellipse cx="132" cy="94" rx="7" ry="4" fill="#ff9a9a" opacity=".6"/>' : '';
  const sweat = mood === 'nervous' ? '<path d="M150 46 q6 11 0 16 q-6 -5 0 -16z" fill="#7fc8ff"/>' : '';
  const bow = female
    ? '<path d="M66 34 L53 26 L53 42 Z M66 34 L79 26 L79 42 Z" fill="#FF2E8A" stroke="rgba(0,0,0,.25)" stroke-width="1.2"/><circle cx="66" cy="34" r="4" fill="#FF2E8A"/>' : '';

  const head = `
    <polygon points="54,92 60,12 98,46" fill="${F.fur}" stroke="${F.line}" stroke-width="2" stroke-linejoin="round"/>
    <polygon points="63,80 65,30 88,48" fill="${F.inner}"/>
    <polygon points="146,92 140,12 102,46" fill="${F.fur}" stroke="${F.line}" stroke-width="2" stroke-linejoin="round"/>
    <polygon points="137,80 135,30 112,48" fill="${F.inner}"/>
    <ellipse cx="100" cy="80" rx="50" ry="44" fill="${F.fur}" stroke="${F.line}" stroke-width="2"/>
    <ellipse cx="100" cy="99" rx="24" ry="17" fill="${F.patch}"/>
    ${brows}${eyes}${lashes}${blush}
    <ellipse cx="100" cy="92" rx="6" ry="4.5" fill="${ink}"/>
    <path d="${mouths[mood]}" stroke="${ink}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    ${sweat}${bow}`;

  return `<svg class="char" viewBox="0 0 200 264" role="img" aria-label="${esc(look.fur)} 치와와">
    ${tail}${lower}${torso}${collar}${jacketSvg}${badge}${arms}${head}
  </svg>`;
}

function moodOf() {
  if (!S) return 'happy';
  if (S.stress >= 70) return 'nervous';
  if (S.fatigue >= 70) return 'tired';
  if (S.stress <= 35 && S.fatigue <= 35) return 'happy';
  return 'normal';
}
function moodLine(mood) {
  return {
    nervous: '너무 떨려요… 짖을 것 같아요',
    tired: '헥헥… 너무 피곤해요',
    happy: '오늘도 힘내볼게요!',
    normal: '취업… 할 수 있겠죠?',
  }[mood];
}

function updateHUD(line) {
  const hud = document.getElementById('hud');
  const prog = document.getElementById('progress');
  if (!S) { hud.hidden = true; prog.hidden = true; return; }
  fixStats();
  hud.hidden = false;
  prog.hidden = false;
  prog.innerHTML = STAGES.map((n, i) =>
    `<li class="${i < S.stage ? 'done' : i === S.stage ? 'now' : ''}">${n}</li>`).join('');
  const mood = moodOf();
  const st = Math.round(S.stress), fa = Math.round(S.fatigue);
  const bar = (label, cls, v) => `
    <div class="stat"><div class="stat-label"><span>${label}</span><span>${v}</span></div>
    <div class="bar ${cls}"><span style="width:${v}%"></span></div></div>`;
  hud.innerHTML = `
    <div class="dog-wrap">${charSVG(S.look, mood)}<div class="bubble">${esc(line || moodLine(mood))}</div></div>
    <div class="stats">
      <div class="muted"><b>${esc(S.name)}</b> · 취준생</div>
      ${S.company ? `<div class="specs" style="margin:2px 0 6px"><span class="chip company">🏢 ${esc(S.company)}</span></div>` : ''}
      ${bar('😵 스트레스', 'stress', st)}
      ${bar('🥱 피곤', 'hp', fa)}
      <div class="stat-row"><span>💰 ${S.money}만원</span></div>
    </div>`;
}

/* =========================================================
 * 쉼터: 스트레스나 피곤이 100이 되면 강제로 이동.
 * 둘 다 50 이하가 되어야 돌아갈 수 있다. (약 5분이면 저절로 회복)
 * ========================================================= */
const REST_PER_SEC = (FAST ? 600 : 10) / 60; // 1분에 10씩 → 100에서 50까지 5분
const REST_COOLDOWN = FAST ? 1 : 20;

function gate(next) {
  fixStats();
  if (S.stress >= 100 || S.fatigue >= 100) shelter(next);
  else next();
}

function shelter(back) {
  const why = S.stress >= 100 ? '스트레스가 한계에 달했어요!' : '너무 피곤해서 쓰러졌어요!';
  const cool = { walk: 0, nap: 0 };
  updateHUD('쉼터에 왔어요…');
  show(`
    <div class="card shelter">
      <div class="step">🛋️ 쉼터</div>
      <h2>${why}</h2>
      <p class="muted">하던 단계가 멈췄어요. 스트레스와 피곤이 <b>둘 다 50 이하</b>가 되면 하던 곳부터 다시 이어서 할 수 있어요.
      가만히 있어도 약 5분이면 회복되고, 산책이나 낮잠으로 더 빨리 회복할 수 있어요.</p>
      <div class="log" id="restInfo"></div>
      <div class="shelter-acts">
        <button class="choice act" data-act="walk" id="walkBtn"><span class="ico">🌳</span><b>산책하기</b><small id="walkTxt">스트레스 -15</small></button>
        <button class="choice act" data-act="nap" id="napBtn"><span class="ico">😴</span><b>낮잠 자기</b><small id="napTxt">피곤 -15</small></button>
      </div>
      <button class="btn" data-act="back" id="backBtn" disabled>다시 하러 가기</button>
    </div>`, {
    walk: () => { S.stress -= 15; cool.walk = REST_COOLDOWN; refresh('산책했더니 기분이 좋아졌어요!'); },
    nap: () => { S.fatigue -= 15; cool.nap = REST_COOLDOWN; refresh('쿨쿨… 개운해요!'); },
    back: () => { updateHUD('다시 힘내볼게요!'); back(); },
  });
  refresh();
  every(() => {
    S.stress -= REST_PER_SEC;
    S.fatigue -= REST_PER_SEC;
    cool.walk = Math.max(0, cool.walk - 1);
    cool.nap = Math.max(0, cool.nap - 1);
    refresh();
  }, 1000);

  function refresh(line) {
    fixStats();
    if (line !== undefined) updateHUD(line);
    else if (Math.round(Date.now() / 1000) % 5 === 0) updateHUD();
    // HUD 게이지는 매초 갱신
    const bars = document.querySelectorAll('#hud .bar > span');
    const nums = document.querySelectorAll('#hud .stat-label span:last-child');
    if (bars.length === 2) {
      bars[0].style.width = `${S.stress}%`; nums[0].textContent = Math.round(S.stress);
      bars[1].style.width = `${S.fatigue}%`; nums[1].textContent = Math.round(S.fatigue);
    }
    const ready = S.stress <= 50 && S.fatigue <= 50;
    const need = Math.max(S.stress - 50, S.fatigue - 50, 0);
    const secs = Math.ceil(need / REST_PER_SEC);
    const info = document.getElementById('restInfo');
    if (!info) return;
    info.textContent = ready
      ? '✅ 충분히 쉬었어요! 이제 돌아갈 수 있어요.'
      : `⏳ 저절로 회복까지 약 ${Math.floor(secs / 60)}분 ${secs % 60}초`;
    document.getElementById('backBtn').disabled = !ready;
    const w = document.getElementById('walkBtn'), n = document.getElementById('napBtn');
    w.disabled = cool.walk > 0; n.disabled = cool.nap > 0;
    document.getElementById('walkTxt').textContent = cool.walk > 0 ? `${cool.walk}초 후 다시 가능` : '스트레스 -15';
    document.getElementById('napTxt').textContent = cool.nap > 0 ? `${cool.nap}초 후 다시 가능` : '피곤 -15';
  }
}

/* =========================================================
 * 시작: 이름 → 외형 → 의상
 * ========================================================= */
function titleScreen() {
  S = null;
  updateHUD();
  const saved = loadSave();
  const sample = { fur: 'beige', gender: 'f', shirt: 'white', jacket: 'blue', bottomType: 'skirt', bottom: 'black' };
  show(`
    <div class="card center">
      <div class="preview">${charSVG(sample, 'happy')}</div>
      <h2 style="margin-top:10px">우리 치와와, 취업시킬 수 있을까?</h2>
      <p class="muted">치와와를 꾸미고, 원하는 회사를 골라<br>자소서부터 면접까지 취업에 도전해 보세요!</p>
      <p style="text-align:left;margin-top:14px"><label class="muted" for="name">치와와 이름을 입력해 주세요</label></p>
      <input id="name" type="text" maxlength="10" placeholder="예) 이것도지겨워" autocomplete="off">
      <button class="btn" data-act="new" id="newBtn" disabled>다음 → 외형 고르기</button>
      ${saved ? `<button class="btn sub" data-act="cont">이어하기 (${esc(saved.name)} · ${STAGES[saved.stage]})</button>` : ''}
    </div>`, {
    new: () => {
      const name = document.getElementById('name').value.trim();
      if (name) customize(name);
    },
    cont: () => { S = saved; STAGE_FUNCS[S.stage](); },
  });
  const input = document.getElementById('name');
  const btn = document.getElementById('newBtn');
  input.addEventListener('input', () => { btn.disabled = !input.value.trim(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && input.value.trim()) customize(input.value.trim()); });
}

// 캐러셀(좌우로 넘기며 고르기) 한 줄
function carousel(label, key, list, look, nameFn, swatchFn) {
  const idx = list.findIndex((x) => x.id === look[key]);
  const item = list[idx];
  const sw = swatchFn ? swatchFn(item) : '';
  return `
    <div class="car-label">${label}</div>
    <div class="car">
      <button class="car-btn" data-act="prev" data-arg="${key}" aria-label="${label} 이전">◀</button>
      <div class="car-mid">${sw}<span>${esc(nameFn ? nameFn(item) : item.name)}</span><small>${idx + 1}/${list.length}</small></div>
      <button class="car-btn" data-act="next" data-arg="${key}" aria-label="${label} 다음">▶</button>
    </div>`;
}
const colorSw = (c) => (c.hex ? `<span class="sw" style="background:${c.hex}"></span>` : '<span class="sw none"></span>');

function customize(name, startLook) {
  const look = startLook || { fur: 'beige', gender: 'f', shirt: 'white', jacket: 'none', bottomType: 'skirt', bottom: 'black' };
  const LISTS = { fur: FURS, gender: GENDERS, shirt: COLORS, jacket: JACKETS, bottomType: BOTTOM_TYPES, bottom: COLORS };
  let page = 'look'; // look(외형) → outfit(의상)

  const step = (key, d) => {
    const list = LISTS[key];
    const i = list.findIndex((x) => x.id === look[key]);
    look[key] = list[(i + d + list.length) % list.length].id;
    render(true);
  };
  const randomize = () => {
    if (page === 'look') { look.fur = pick(FURS).id; look.gender = pick(GENDERS).id; }
    else {
      look.shirt = pick(COLORS).id; look.jacket = pick(JACKETS).id;
      look.bottomType = pick(BOTTOM_TYPES).id; look.bottom = pick(COLORS).id;
    }
    render(true);
  };

  function render(keepScroll) {
    const shirtWord = look.gender === 'f' ? '블라우스' : '셔츠';
    const rows = page === 'look'
      ? carousel('털색', 'fur', FURS, look, null, (f) => `<span class="sw" style="background:${f.swatch}"></span>`)
        + carousel('성별', 'gender', GENDERS, look, null, (g) => (g.id === 'f' ? '♀' : '♂'))
      : carousel(`상의 · ${shirtWord}`, 'shirt', COLORS, look, (c) => `${c.name} ${shirtWord}`, colorSw)
        + carousel('상의 · 자켓', 'jacket', JACKETS, look, (c) => (c.hex ? `${c.name} 자켓` : '자켓 없음'), colorSw)
        + carousel('하의 · 종류', 'bottomType', BOTTOM_TYPES, look)
        + carousel('하의 · 색', 'bottom', COLORS, look, (c) => `${c.name} ${byId(BOTTOM_TYPES, look.bottomType).name}`, colorSw);
    show(`
      <div class="card">
        <div class="step">캐릭터 만들기 · ${page === 'look' ? '1/2 외형' : '2/2 의상'}</div>
        <h2>${esc(name)}의 ${page === 'look' ? '외형' : '의상'}을 골라주세요</h2>
        <div class="preview">${charSVG(look, 'happy')}</div>
        ${rows}
        <button class="btn sub" data-act="random">🎲 랜덤으로 고르기</button>
        <button class="btn" data-act="done">${page === 'look' ? '다음 → 의상 고르기' : '완성! 지원하러 가기 →'}</button>
        ${page === 'outfit' ? '<button class="btn sub" data-act="backPage">← 외형 다시 고르기</button>' : ''}
      </div>`, {
      prev: (key) => step(key, -1),
      next: (key) => step(key, +1),
      random: randomize,
      backPage: () => { page = 'look'; render(); },
      done: () => {
        if (page === 'look') { page = 'outfit'; render(); return; }
        S = newState(name, { ...look });
        stageApply();
      },
    }, keepScroll);
  }
  render();
}

/* =========================================================
 * 0단계: 지원 (회사 고르기)
 * ========================================================= */
function stageApply() {
  S.stage = 0;
  save();
  updateHUD('어디에 지원할까요?');
  show(`
    <div class="card">
      <div class="step">1단계 · 지원</div>
      <h2>🏢 지원할 회사를 골라주세요</h2>
      <p class="muted">회사마다 최종 합격선이 달라요. 원하는 회사가 없으면 '기타'에서 직접 적을 수 있어요.</p>
      <div class="company-grid">
        ${COMPANIES.map((c, i) => `<button class="choice" data-act="co" data-arg="${i}">${esc(c.name)}<small>합격선 ${c.req}점</small></button>`).join('')}
        <button class="choice" data-act="etc">✏️ 기타<small>직접 입력 · 합격선 ${CUSTOM_REQ}점</small></button>
      </div>
      <div id="etcBox" hidden style="margin-top:12px">
        <input id="etcName" type="text" maxlength="20" placeholder="회사 이름을 적어주세요" autocomplete="off">
        <button class="btn" data-act="etcOk" id="etcOk" disabled>이 회사에 지원하기</button>
      </div>
    </div>`, {
    co: (i) => choose(COMPANIES[+i].name, COMPANIES[+i].req),
    etc: () => {
      document.getElementById('etcBox').hidden = false;
      document.getElementById('etcName').focus();
    },
    etcOk: () => {
      const n = document.getElementById('etcName').value.trim();
      if (n) choose(n, CUSTOM_REQ);
    },
  });
  const inp = document.getElementById('etcName');
  inp.addEventListener('input', () => { document.getElementById('etcOk').disabled = !inp.value.trim(); });

  function choose(name, req) {
    S.company = name;
    S.companyReq = req;
    updateHUD(`${josa(name, '으로', '로')} 정했어요!`);
    stageEssay();
  }
}

/* =========================================================
 * 1단계: 자기소개서 (직접 작성, 문항당 10자 이상)
 * ========================================================= */
const ESSAY_QS = [
  (co) => `${co}에 지원한 동기를 적어주세요.`,
  () => '본인의 강점과, 그 강점을 보여준 경험을 적어주세요.',
  (co) => `${co} 입사 후 이루고 싶은 목표를 적어주세요.`,
];
const ESSAY_KEYWORDS = ['성장', '경험', '노력', '협업', '팀', '목표', '기여', '책임', '도전', '열정', '분석', '해결',
  '고객', '프로젝트', '성과', '배움', '배우', '소통', '전문', '개선', '리더', '꾸준', '역량', '가치', '비전'];
const essayLen = (t) => t.replace(/\s/g, '').length;

function scoreAnswer(text) {
  const s = text.replace(/\s/g, '');
  const len = s.length;
  if (new Set(s).size < 5) return { score: 3, notes: ['같은 글자만 반복했어요'] };
  const notes = [];
  let score = len >= 150 ? 20 : len >= 80 ? 16 : len >= 40 ? 12 : 7;
  notes.push(len >= 80 ? `분량 충분 (${len}자)` : `분량이 조금 아쉬워요 (${len}자)`);
  const hits = ESSAY_KEYWORDS.filter((k) => text.includes(k));
  score += Math.min(3, hits.length) * 3;
  if (hits.length) notes.push(`좋은 키워드: ${hits.slice(0, 4).join(', ')}`);
  if (text.includes(S.company)) { score += 4; notes.push('회사 이름 언급 👍'); }
  return { score: Math.min(33, score), notes };
}

function stageEssay() {
  intro(1, '✍️', '자기소개서를 써보자!',
    `${esc(S.company)} 자기소개서 ${ESSAY_QS.length}문항을 직접 작성해요.<br>문항마다 ${ESSAY_MIN}자 이상 적어야 제출할 수 있어요. 성의 있게 쓸수록 점수가 높아요!`, run);

  function run() {
    let i = 0;
    const answers = [];
    write();

    function write() {
      if (i >= ESSAY_QS.length) return done();
      const q = ESSAY_QS[i](S.company);
      show(`
        <div class="card">
          <div class="step">문항 ${i + 1} / ${ESSAY_QS.length}</div>
          <h2 style="font-size:1.05rem">Q${i + 1}. ${esc(q)}</h2>
          <textarea id="essay" maxlength="${ESSAY_MAX}" placeholder="${ESSAY_MIN}자 이상 적어주세요"></textarea>
          <div class="counter" id="cnt">0자 (공백 제외) · 최소 ${ESSAY_MIN}자</div>
          <button class="btn" data-act="submit" id="sub" disabled>${i + 1 < ESSAY_QS.length ? '다음 문항 →' : '제출하기'}</button>
        </div>`, {
        submit: () => {
          const t = document.getElementById('essay').value.trim();
          if (essayLen(t) < ESSAY_MIN) return;
          answers.push({ q, a: t });
          i++;
          write();
        },
      });
      const ta = document.getElementById('essay');
      const cnt = document.getElementById('cnt');
      const sub = document.getElementById('sub');
      ta.addEventListener('input', () => {
        const n = essayLen(ta.value);
        cnt.textContent = `${n}자 (공백 제외) · 최소 ${ESSAY_MIN}자`;
        cnt.classList.toggle('ok', n >= ESSAY_MIN);
        sub.disabled = n < ESSAY_MIN;
      });
      ta.focus();
    }

    function done() {
      const results = answers.map((x) => ({ ...x, ...scoreAnswer(x.a) }));
      const sum = results.reduce((t, r) => t + r.score, 0);
      S.essay = Math.min(100, Math.round((sum * 100) / 99));
      S.essayAnswers = answers;
      updateHUD('자소서 완성! 뿌듯해요!');
      show(`
        <div class="card">
          <h2>📄 자소서 평가 결과</h2>
          ${results.map((r, k) => `
            <div class="log"><b>Q${k + 1}. ${esc(r.q)}</b><br>${esc(r.a.length > 80 ? r.a.slice(0, 80) + '…' : r.a)}
            <br><span class="muted">→ ${r.score}/33 · ${esc(r.notes.join(' · '))}</span></div>`).join('')}
          <table class="score-table"><tr class="total"><td>자소서 점수</td><td>${S.essay} / 100</td></tr></table>
          <p class="muted">💡 분량, 성장·경험·협업 같은 키워드, 회사 이름 언급이 점수에 반영돼요.</p>
          <button class="btn" data-act="next">스펙 쌓으러 가기 →</button>
        </div>`, { next: () => stageSpec() });
    }
  }
}

/* =========================================================
 * 2단계: 스펙 쌓기 (8주 동안 활동 선택)
 * ========================================================= */
const toeicScore = () => (S.toeic === 0 ? '미응시' : `${Math.min(990, Math.round((450 + S.toeic * 6) / 5) * 5)}점`);
const calcSpec = () => clamp(Math.round(S.toeic * 0.4 + S.cert * 15 + S.intern * 10), 0, 100);

const ACTS = [
  {
    icon: '📚', name: '토익 공부', desc: '토익↑ 스트레스+12 피곤+12',
    run() { S.toeic = clamp(S.toeic + rand(10, 18), 0, 100); gauge(12, 12); return `토익 공부를 했다! 예상 점수 ${toeicScore()}`; },
  },
  {
    icon: '📜', name: '자격증 시험', desc: '응시료 20만원 스트레스+15 피곤+12', cost: 20,
    run() {
      S.money -= 20; gauge(15, 12);
      if (Math.random() < 0.7) { S.cert++; return `자격증 합격! 🎉 (보유 ${S.cert}개)`; }
      return '아깝게 불합격… 다음엔 꼭!';
    },
  },
  {
    icon: '💼', name: '인턴 근무', desc: '경력↑ 돈+15 스트레스+14 피곤+20',
    run() { S.intern++; S.money += 15; gauge(14, 20); return `인턴 ${S.intern}주차 완료! 커피 심부름도 완벽했다.`; },
  },
  {
    icon: '🏪', name: '편의점 알바', desc: '돈+25 스트레스+8 피곤+15',
    run() { S.money += 25; gauge(8, 15); return '알바비 25만원 입금! 💸'; },
  },
  {
    icon: '🌳', name: '산책하기', desc: '스트레스-20 피곤-10',
    run() { gauge(-20, -10); return '산책 최고! 전봇대 냄새도 실컷 맡았다.'; },
  },
  {
    icon: '😴', name: '낮잠 자기', desc: '피곤-25 스트레스-5',
    run() { gauge(-5, -25); return '쿨쿨… 한숨 푹 잤다.'; },
  },
];

const EVENTS = [
  { t: '🎁 할머니가 용돈을 주셨다! (돈+20)', f() { S.money += 20; } },
  { t: '📦 택배 기사님께 짖다가 목이 쉬었다… (스트레스+10)', f() { gauge(10, 0); } },
  { t: '🤝 산책길에 인사팀장님을 만나 명함을 받았다! (인턴 경력+1)', f() { S.intern++; } },
  { t: '🌧️ 비가 와서 산책을 못 갔다… (스트레스+8)', f() { gauge(8, 0); } },
  { t: '📱 친구의 합격 소식을 들었다… (스트레스+12)', f() { gauge(12, 0); } },
  { t: '☀️ 날씨가 좋아 기분이 상쾌하다! (스트레스-10)', f() { gauge(-10, 0); } },
];

function stageSpec() {
  intro(2, '📚', `${SPEC_WEEKS}주 동안 스펙을 쌓자!`,
    '매주 한 가지 활동을 골라요. 토익·자격증·인턴으로 스펙을 올리되,<br>스트레스나 피곤이 100이 되면 🛋️ 쉼터로 끌려가요!', run);

  function run() {
    let week = 1, log = '첫 주가 시작됐다. 무엇을 할까?';
    turn();

    function turn() {
      if (week > SPEC_WEEKS) return done();
      updateHUD();
      show(`
        <div class="card">
          <div class="step">${week}주차 / ${SPEC_WEEKS}주</div>
          <h2>이번 주엔 뭘 할까?</h2>
          <div class="log">${esc(log)}</div>
          <div class="specs">
            <span class="chip">📚 토익 ${toeicScore()}</span>
            <span class="chip">📜 자격증 ${S.cert}개</span>
            <span class="chip">💼 인턴 ${S.intern}주</span>
          </div>
          <div class="grid2">
            ${ACTS.map((a, k) => {
              const lack = a.cost && S.money < a.cost;
              return `<button class="choice act" data-act="do" data-arg="${k}" ${lack ? 'disabled' : ''}>
                <span class="ico">${a.icon}</span><b>${a.name}</b><small>${lack ? '돈이 부족해요' : a.desc}</small></button>`;
            }).join('')}
          </div>
        </div>`, {
        do: (k) => {
          const msgs = [ACTS[+k].run()];
          if (Math.random() < 0.3) { const e = pick(EVENTS); e.f(); msgs.push(e.t); }
          fixStats();
          log = msgs.join('\n');
          week++;
          gate(turn); // 한 주가 끝날 때 게이지 확인
        },
      });
    }

    function done() {
      S.spec = calcSpec();
      updateHUD('스펙 쌓기 끝! 고생했어요');
      show(`
        <div class="card">
          <h2>📋 ${SPEC_WEEKS}주간의 스펙 정리</h2>
          <div class="log">${esc(log)}</div>
          <table class="score-table">
            <tr><td>📚 토익</td><td>${toeicScore()}</td></tr>
            <tr><td>📜 자격증</td><td>${S.cert}개</td></tr>
            <tr><td>💼 인턴 경력</td><td>${S.intern}주</td></tr>
            <tr class="total"><td>스펙 점수</td><td>${S.spec} / 100</td></tr>
          </table>
          <button class="btn" data-act="next">서류 제출하러 가기 →</button>
        </div>`, { next: () => stageDoc() });
    }
  }
}

/* =========================================================
 * 3단계: 서류 전형 (자소서×0.4 + 스펙×0.6 ≥ 50 이면 합격)
 * ========================================================= */
function stageDoc() {
  intro(3, '📮', '서류 전형',
    `자소서와 스펙을 합친 서류 점수가 <b>${DOC_PASS}점 이상</b>이면 합격이에요.<br>못 넘으면… 서류 탈락 엔딩이에요!`, run);

  function run() {
    gauge(10, 5); // 결과 기다리는 긴장감
    gate(reveal);
  }
  function reveal() {
    S.doc = Math.round(S.essay * 0.4 + S.spec * 0.6);
    const pass = S.doc >= DOC_PASS;
    updateHUD('두근두근…');
    show(`<div class="card center"><div class="big-emoji">📨</div><h2>${esc(S.company)} 서류 결과 발표 중…</h2><p class="muted">두근두근</p></div>`);
    later(() => {
      updateHUD(pass ? '서류 붙었어요!! 멍!' : '흑…');
      show(`
        <div class="card">
          <div class="center"><p><span class="stamp ${pass ? 'pass' : ''}">${pass ? '서류 합격' : '서류 탈락'}</span></p></div>
          <table class="score-table">
            <tr><td>자소서 ${S.essay}점 × 0.4</td><td>${Math.round(S.essay * 0.4)}</td></tr>
            <tr><td>스펙 ${S.spec}점 × 0.6</td><td>${Math.round(S.spec * 0.6)}</td></tr>
            <tr class="total"><td>서류 점수 (합격선 ${DOC_PASS})</td><td>${S.doc}</td></tr>
          </table>
          <button class="btn" data-act="next">${pass ? '인적성 검사 보러 가기 →' : '결과 보기'}</button>
        </div>`, { next: () => (pass ? stageApt() : ending('docFail')) });
    }, FAST ? 300 : 1500);
  }
}

/* =========================================================
 * 4단계: 인적성 (N-back 50점 + 마법약 만들기 50점)
 * 문제 하나가 끝날 때마다 게이지를 확인한다.
 * ========================================================= */
const NB_N = 2, NB_ITEMS = 20, NB_SEC = 3;
const NB_SYMBOLS = [
  { s: '●', c: '#FF1A1A' }, { s: '▲', c: '#0057FF' }, { s: '■', c: '#00C853' },
  { s: '★', c: '#FFB800' }, { s: '◆', c: '#8A2BE2' },
];
const HERBS = [
  { icon: '🌿', name: '잎새풀' }, { icon: '🍄', name: '버섯' }, { icon: '🌸', name: '꽃잎' }, { icon: '🍀', name: '네잎' },
];
const POT_TRIALS = 24, POT_SEC = 3, POT_SWITCH = 12;

function stageApt() {
  intro(4, '🧠', '인적성 검사 (AI 역량검사)',
    `① <b>N-back</b>: ${NB_N}개 전에 나온 도형과 같은지 판단 (50점)<br>② <b>마법약 만들기</b>: 약초 조합을 보고 파란약/빨간약 예측 (50점)`, nbIntro);

  let nbScore = 0, potScore = 0;

  /* ---- ① N-back ---- */
  function nbIntro() {
    gauge(5, 5);
    gate(() => show(`
      <div class="card center">
        <div class="big-emoji">🔢</div>
        <h2>${NB_N}-back 게임</h2>
        <p class="muted">도형이 하나씩 나와요. 지금 도형이 <b>${NB_N}개 전</b> 도형과 같으면 <b>같다</b>, 다르면 <b>다르다</b>를 누르세요.<br>
        처음 ${NB_N}개는 기억만 하면 돼요. 문제당 ${NB_SEC}초!</p>
        <button class="btn" data-act="go">시작!</button>
      </div>`, { go: runNback }));
  }

  function runNback() {
    const seq = [];
    for (let i = 0; i < NB_ITEMS; i++) {
      if (i >= NB_N && Math.random() < 0.35) seq.push(seq[i - NB_N]);
      else {
        let v;
        do { v = rand(0, NB_SYMBOLS.length - 1); } while (i >= NB_N && v === seq[i - NB_N]);
        seq.push(v);
      }
    }
    let i = 0, correct = 0;
    const judged = NB_ITEMS - NB_N;
    item();

    function item() {
      if (i >= NB_ITEMS) return nbDone();
      const sym = NB_SYMBOLS[seq[i]];
      const memo = i < NB_N;
      show(`
        <div class="card">
          <div class="step">N-back ${i + 1} / ${NB_ITEMS} · 정답 ${correct}</div>
          <div class="timer"><span id="tbar" style="width:100%"></span></div>
          <div class="nback-card" id="nbCard" style="color:${sym.c}">${sym.s}</div>
          ${memo
            ? '<p class="center muted">기억하세요! 👀</p>'
            : `<div class="yn"><button class="btn" data-act="yes">같다 ⭕</button><button class="btn sub" data-act="no">다르다 ❌</button></div>`}
        </div>`, { yes: () => answer(true), no: () => answer(false) });
      if (memo) { later(() => { i++; item(); }, 1400); return; }
      let left = NB_SEC * 10, answered = false;
      const tbar = document.getElementById('tbar');
      every(() => { left--; tbar.style.width = `${(left / (NB_SEC * 10)) * 100}%`; if (left <= 0) answer(null); }, 100);

      function answer(saidSame) {
        if (answered) return;
        answered = true;
        clearTimers();
        const isSame = seq[i] === seq[i - NB_N];
        const ok = saidSame === isSame;
        if (ok) correct++;
        gauge(ok ? 0 : 1.5, 0.6);
        document.getElementById('nbCard').classList.add(ok ? 'flash-good' : 'flash-bad');
        app.querySelectorAll('.yn .btn').forEach((b) => { b.disabled = true; });
        updateHUD(ok ? '맞았어요!' : saidSame === null ? '시간 초과…' : '틀렸어요…');
        i++;
        later(() => gate(item), 450);
      }
    }

    function nbDone() {
      nbScore = Math.round((correct / judged) * 50);
      show(`
        <div class="card center">
          <h2>🔢 N-back 결과</h2>
          <p>${judged}문제 중 <b>${correct}개</b> 정답 → <b>${nbScore} / 50점</b></p>
          <button class="btn" data-act="go">다음: 마법약 만들기 →</button>
        </div>`, { go: potIntro });
    }
  }

  /* ---- ② 마법약 만들기 ---- */
  function potIntro() {
    show(`
      <div class="card center">
        <div class="big-emoji">🧪</div>
        <h2>마법약 만들기</h2>
        <p class="muted">약초 카드 4장 중 일부에 불이 들어와요. 켜진 약초 조합으로 <b>파란약</b>이 나올지 <b>빨간약</b>이 나올지 ${POT_SEC}초 안에 예측하세요.<br>
        정답은 바로 공개돼요. 약초마다 잘 만드는 약의 색이 있으니 패턴을 찾아보세요!<br>⚠️ 중간에 규칙이 바뀔 수도 있어요.</p>
        <button class="btn" data-act="go">시작!</button>
      </div>`, { go: runPotion });
  }

  function runPotion() {
    // 약초마다 파란약이 나올 확률 (중간에 일부가 뒤집힘)
    const pBlue = shuffle([0.9, 0.8, 0.2, 0.1]);
    let t = 0, correct = 0;
    trial();

    function trial() {
      if (t >= POT_TRIALS) return potDone();
      if (t === POT_SWITCH) {
        shuffle([0, 1, 2, 3]).slice(0, 2).forEach((k) => { pBlue[k] = 1 - pBlue[k]; });
      }
      // 1~3장 켜기
      let lit;
      do { lit = HERBS.map(() => Math.random() < 0.5); } while (!lit.some(Boolean) || lit.every(Boolean));
      const on = lit.map((v, k) => (v ? k : -1)).filter((k) => k >= 0);
      const p = on.reduce((s, k) => s + pBlue[k], 0) / on.length;
      const blue = Math.random() < p;

      show(`
        <div class="card">
          <div class="step">마법약 ${t + 1} / ${POT_TRIALS} · 정답 ${correct}</div>
          <div class="timer"><span id="tbar" style="width:100%"></span></div>
          <div class="herbs">${HERBS.map((h, k) => `<div class="herb ${lit[k] ? 'on' : ''}">${h.icon}<small>${h.name}</small></div>`).join('')}</div>
          <div class="cauldron" id="cauldron">어떤 약이 나올까? 🫕</div>
          <div class="potion-btns">
            <button class="btn blue" data-act="b">🔵 파란약</button>
            <button class="btn red" data-act="r">🔴 빨간약</button>
          </div>
        </div>`, { b: () => answer(true), r: () => answer(false) });
      let left = POT_SEC * 10, answered = false;
      const tbar = document.getElementById('tbar');
      every(() => { left--; tbar.style.width = `${(left / (POT_SEC * 10)) * 100}%`; if (left <= 0) answer(null); }, 100);

      function answer(saidBlue) {
        if (answered) return;
        answered = true;
        clearTimers();
        const ok = saidBlue === blue;
        if (ok) correct++;
        gauge(ok ? 0 : 1, 0.5);
        app.querySelectorAll('.potion-btns .btn').forEach((b) => { b.disabled = true; });
        document.getElementById('cauldron').innerHTML = `${blue ? '🔵 파란약' : '🔴 빨간약'}이 나왔어요! ${ok ? '⭕' : saidBlue === null ? '⏰ 시간 초과' : '❌'}`;
        t++;
        later(() => gate(trial), 750);
      }
    }

    function potDone() {
      // 확률 게임이라 만점이 어려우므로 정답률 80%면 만점
      potScore = Math.round(Math.min(1, correct / (POT_TRIALS * 0.8)) * 50);
      S.nback = nbScore;
      S.potion = potScore;
      S.apt = nbScore + potScore;
      updateHUD('인적성 끝! 이제 면접이에요…');
      show(`
        <div class="card">
          <h2>🧠 인적성 검사 결과</h2>
          <table class="score-table">
            <tr><td>N-back</td><td>${nbScore} / 50</td></tr>
            <tr><td>마법약 만들기 (${correct}/${POT_TRIALS} 정답)</td><td>${potScore} / 50</td></tr>
            <tr class="total"><td>인적성 점수</td><td>${S.apt} / 100</td></tr>
          </table>
          <button class="btn" data-act="next">면접장으로 →</button>
        </div>`, { next: () => stageInterview() });
    }
  }
}

/* =========================================================
 * 5단계: 면접 (긴장하면 짖음!)
 * ========================================================= */
const BARK = { t: '멍멍! 왈왈!', s: 0, bark: true };
function interviewQuestions() {
  const co = S.company;
  return [
    {
      q: '간단하게 자기소개 부탁드립니다.',
      a: [{ t: '자소서에 쓴 강점을 중심으로 자신 있게 소개한다', s: 20 }, { t: '이름과 나이만 말한다', s: 8 }, { t: '말없이 꼬리를 힘차게 흔든다', s: 10 }, BARK],
    },
    {
      q: `${co}에 지원한 이유가 뭔가요?`,
      a: [{ t: `${co}의 비전에 공감했고, 제 역량으로 기여하고 싶어서입니다`, s: 20 }, { t: '집에서 가까워서요', s: 6 }, { t: '연봉이 높다고 들었습니다', s: 10 }, BARK],
    },
    {
      q: '취업 준비하면서 가장 힘들었던 순간은요?',
      a: [{ t: '지쳐서 쓰러졌지만, 잘 쉬고 다시 일어난 경험이요', s: 20 }, { t: '목욕해야 했던 날이요', s: 10 }, { t: '딱히 없습니다', s: 3 }, BARK],
    },
    {
      q: '동료와 의견이 다를 때는 어떻게 하나요?',
      a: [{ t: '차분히 대화하며 서로의 입장을 맞춰갑니다', s: 20 }, { t: '일단 참습니다', s: 10 }, { t: '으르렁거려서 기선을 제압합니다', s: 2 }, BARK],
    },
    {
      q: '마지막으로 하고 싶은 말이 있나요?',
      a: [{ t: `${co}에 꼭 필요한 인재가 되겠습니다!`, s: 20 }, { t: '감사합니다', s: 14 }, { t: '앞발을 내밀며 "손!"', s: 12 }, BARK],
    },
  ];
}
const barkChance = () => (S.stress >= 50 ? (S.stress - 40) / 150 : 0);

function stageInterview() {
  const warnHtml = () => (barkChance() > 0
    ? `<p class="warn" id="warn">⚠️ 스트레스 ${Math.round(S.stress)}! 긴장해서 답변 중 짖을 확률 ${Math.round(barkChance() * 100)}%</p>`
    : '<p class="muted" id="warn">마음이 편안해요. 실수 없이 답할 수 있을 것 같아요.</p>');
  let breathed = false;
  intro(5, '👔', `${esc(S.company)} 면접`,
    '면접관의 질문에 알맞은 답을 골라요. 짖으면 감점!<br>스트레스가 높으면 나도 모르게 짖어버릴 수도 있어요.',
    run, `${warnHtml()}<button class="btn sub" data-act="breath">🧘 심호흡하기 (스트레스-20, 1회)</button>`, {
      breath: (_, el) => {
        if (breathed) return;
        breathed = true;
        gauge(-20, 0);
        save();
        updateHUD('후우… 조금 진정됐어요');
        el.disabled = true;
        el.textContent = '🧘 심호흡 완료!';
        document.getElementById('warn').outerHTML = warnHtml();
      },
    });

  function run() {
    const qs = interviewQuestions();
    let i = 0, score = 0;
    ask();

    function ask() {
      if (i >= qs.length) return done();
      const q = qs[i];
      const opts = shuffle(q.a);
      updateHUD();
      show(`
        <div class="card">
          <div class="step">질문 ${i + 1} / ${qs.length}</div>
          <div class="interviewer"><div class="face">🧑‍💼</div><div class="say">${esc(q.q)}</div></div>
          ${barkChance() > 0 ? `<p class="warn">⚠️ 짖을 확률 ${Math.round(barkChance() * 100)}%</p>` : ''}
          <div class="choices">
            ${opts.map((o, k) => `<button class="choice" data-act="ans" data-arg="${k}">${esc(o.t)}</button>`).join('')}
          </div>
        </div>`, {
        ans: (k) => {
          let o = opts[+k];
          let accident = false;
          if (!o.bark && Math.random() < barkChance()) { o = BARK; accident = true; }
          score += o.s;
          gauge(o.bark ? 8 : o.s >= 20 ? -2 : o.s >= 10 ? 3 : 6, 4);
          const face = o.bark ? '😱' : o.s >= 20 ? '😊' : o.s >= 10 ? '🙂' : '😐';
          const react = o.bark ? '…방금 짖으셨나요?' : o.s >= 20 ? '아주 좋은 답변이네요!' : o.s >= 10 ? '그렇군요. 알겠습니다.' : '음… 그렇군요.';
          updateHUD(o.bark ? (accident ? '앗… 긴장해서 그만…' : '멍!') : o.s >= 20 ? '잘 대답한 것 같아요!' : '괜찮았을까…?');
          show(`
            <div class="card">
              <div class="step">질문 ${i + 1} / ${qs.length}</div>
              <div class="interviewer"><div class="face">🧑‍💼</div><div class="say">${esc(q.q)}</div></div>
              <div class="answer">🐶 ${accident ? '<span class="warn">(긴장한 나머지…)</span> ' : ''}“${esc(o.t)}”</div>
              <div class="interviewer" style="margin-top:10px"><div class="face">${face}</div><div class="say">${react}</div></div>
              <button class="btn" data-act="next">${i + 1 < qs.length ? '다음 질문' : '면접 마치기'}</button>
            </div>`, { next: () => { i++; gate(ask); } });
        },
      });
    }

    function done() {
      S.interview = score;
      updateHUD('면접 끝… 결과가 궁금해요');
      show(`
        <div class="card">
          <h2>👔 면접 종료</h2>
          <p class="muted">면접관: “수고하셨습니다. 결과는 곧 알려드릴게요.”</p>
          <table class="score-table"><tr class="total"><td>면접 점수</td><td>${score} / 100</td></tr></table>
          <button class="btn" data-act="next">최종 결과 확인하기 →</button>
        </div>`, { next: () => ending('final') });
    }
  }
}

/* =========================================================
 * 6단계: 결과 & 엔딩
 * ========================================================= */
function ending(kind) {
  S.stage = 6;
  clearSave(); // 결과를 본 뒤에는 저장을 지워 다음 판을 새로 시작하게 한다
  const co = S.company;
  let pass = false, title, text, table;

  if (kind === 'docFail') {
    title = '📮 서류 탈락…';
    text = `서류 점수 ${S.doc}점으로 합격선 ${DOC_PASS}점에 미치지 못했어요. 자소서를 더 꼼꼼히 쓰고 스펙을 쌓아 다시 도전해 봐요!`;
    table = `
      <tr><td>자소서</td><td>${S.essay}</td></tr>
      <tr><td>스펙</td><td>${S.spec}</td></tr>
      <tr class="total"><td>서류 점수 (합격선 ${DOC_PASS})</td><td>${S.doc}</td></tr>`;
  } else {
    S.total = Math.round(S.apt * 0.4 + S.interview * 0.6);
    pass = S.total >= S.companyReq;
    const weakest = S.apt * 0.4 / 40 < S.interview * 0.6 / 60 ? '인적성' : '면접';
    title = pass ? `🎉 ${co} 최종 합격!` : '📮 최종 불합격…';
    text = pass
      ? `${josa(S.name, '이', '가')} 드디어 ${co} 신입사원이 되었어요! 사원증을 목에 걸고 첫 출근하는 날, 꼬리가 멈추질 않아요.`
      : `이번엔 ${josa(co, '과', '와')} 인연이 아니었나 봐요. 가장 아쉬웠던 부분은 ${weakest}이에요. 다음엔 꼭 붙을 수 있어요!`;
    table = `
      <tr><td>서류 (통과)</td><td>${S.doc}</td></tr>
      <tr><td>인적성 ${S.apt}점 × 0.4</td><td>${Math.round(S.apt * 0.4)}</td></tr>
      <tr><td>면접 ${S.interview}점 × 0.6</td><td>${Math.round(S.interview * 0.6)}</td></tr>
      <tr class="total"><td>최종 점수 (합격선 ${S.companyReq})</td><td>${S.total}</td></tr>`;
  }

  if (pass) { S.stress = 0; S.fatigue = 0; }
  updateHUD(pass ? '합격이에요!!! 멍멍!!' : '흑… 다음엔 꼭 붙을 거예요');
  show(`<div class="card center"><div class="big-emoji">✉️</div><h2>${esc(co)} 최종 결과 발표 중…</h2></div>`);
  later(() => {
    show(`
      <div class="card">
        <div class="center">
          <p><span class="stamp ${pass ? 'pass' : ''}">${pass ? '최종 합격' : '불합격'}</span></p>
          <div class="preview">${charSVG(S.look, pass ? 'happy' : 'tired', { badge: pass })}</div>
          <h2 style="margin-top:10px">${esc(title)}</h2>
          <p>${esc(text)}</p>
        </div>
        <table class="score-table">${table}</table>
        <button class="btn" data-act="again">같은 치와와로 다시 도전</button>
        <button class="btn sub" data-act="home">처음으로</button>
      </div>`, {
      again: () => { S = newState(S.name, S.look); stageApply(); },
      home: () => titleScreen(),
    });
  }, FAST ? 300 : 1600);
}

const STAGE_FUNCS = [stageApply, stageEssay, stageSpec, stageDoc, stageApt, stageInterview, () => titleScreen()];

titleScreen();
