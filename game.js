'use strict';

/* =========================================================
 * 취준생 치와와 - 게임 로직
 * 단계: 0 자소서 → 1 스펙 쌓기 → 2 서류 전형 → 3 인적성 → 4 면접 → 5 결과
 * ========================================================= */

const STAGES = ['자소서', '스펙 쌓기', '서류 전형', '인적성', '면접', '결과'];
const SAVE_KEY = 'chihuahua-jobseeker-save-v1';
const SPEC_WEEKS = 8;

/* ---------- 유틸 ---------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
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

/* ---------- 상태 & 저장 ---------- */
let S = null;

function newState(name) {
  return {
    name, stage: 0,
    hp: 100, stress: 20, money: 40, snack: 0,
    toeic: 0, cert: 0, intern: 0,
    essay: 0, essayLines: [], spec: 0, doc: 0,
    company: null, apt: 0, interview: 0, total: 0,
  };
}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* 저장 불가 환경 */ } }
function loadSave() { try { const r = localStorage.getItem(SAVE_KEY); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 무시 */ } }

function fixStats() {
  S.hp = clamp(S.hp, 0, 100);
  S.stress = clamp(S.stress, 0, 100);
  S.money = Math.max(0, S.money);
}

/* ---------- 타이머 관리 (화면 전환 시 모두 정리) ---------- */
let timers = [];
function later(fn, ms) { const id = setTimeout(fn, ms); timers.push(id); return id; }
function every(fn, ms) { const id = setInterval(fn, ms); timers.push(id); return id; }
function clearTimers() { timers.forEach((id) => { clearTimeout(id); clearInterval(id); }); timers = []; }

/* ---------- 화면 그리기 ---------- */
const app = document.getElementById('app');

function show(html, actions = {}) {
  clearTimers();
  app.innerHTML = html;
  app.querySelectorAll('[data-act]').forEach((el) => {
    const fn = actions[el.dataset.act];
    if (fn) el.addEventListener('click', () => { if (!el.disabled) fn(el.dataset.arg, el); });
  });
  window.scrollTo({ top: 0 });
}

function intro(stageIdx, emoji, title, desc, onStart, extraButtons = '', extraActions = {}) {
  S.stage = stageIdx;
  save();
  updateHUD();
  show(`
    <div class="card">
      <div class="step">${stageIdx + 1}단계 · ${STAGES[stageIdx]}</div>
      <div class="big-emoji">${emoji}</div>
      <h2 class="center">${title}</h2>
      <p class="muted center">${desc}</p>
      ${extraButtons}
      <button class="btn" data-act="start">시작하기</button>
    </div>`, { start: onStart, ...extraActions });
}

/* ---------- 치와와 그림 (SVG) ---------- */
function dogSVG(mood, tie) {
  const eyes = mood === 'tired'
    ? `<path d="M40 61 q6 4 12 0 M68 61 q6 4 12 0" stroke="#2b1d14" stroke-width="3" fill="none" stroke-linecap="round"/>`
    : `<circle cx="46" cy="60" r="6.5" fill="#2b1d14"/><circle cx="74" cy="60" r="6.5" fill="#2b1d14"/>
       <circle cx="48" cy="58" r="2.2" fill="#fff"/><circle cx="76" cy="58" r="2.2" fill="#fff"/>`;
  const mouths = {
    happy: 'M51 80 Q60 90 69 80',
    normal: 'M53 82 Q60 86 67 82',
    nervous: 'M51 83 q4.5 -4 9 0 q4.5 4 9 0',
    tired: 'M54 84 L66 84',
  };
  const blush = mood === 'happy'
    ? '<ellipse cx="36" cy="74" rx="6" ry="3.5" fill="#f7a8a0" opacity=".7"/><ellipse cx="84" cy="74" rx="6" ry="3.5" fill="#f7a8a0" opacity=".7"/>' : '';
  const sweat = mood === 'nervous'
    ? '<path d="M96 40 q5 9 0 13 q-5 -4 0 -13z" fill="#7fc8ff"/>' : '';
  const tieSvg = tie
    ? '<path d="M50 98 L70 98 L60 106 Z" fill="#fff"/><path d="M57 104 L63 104 L66 126 L60 132 L54 126 Z" fill="#3d6fd1"/>' : '';
  return `<svg class="dog" viewBox="0 0 120 134" aria-label="치와와">
    <ellipse cx="60" cy="118" rx="26" ry="16" fill="#e0aa6e"/>
    ${tieSvg}
    <polygon points="20,52 28,4 56,38" fill="#d9a066"/><polygon points="27,45 31,16 48,38" fill="#f4c6b0"/>
    <polygon points="100,52 92,4 64,38" fill="#d9a066"/><polygon points="93,45 89,16 72,38" fill="#f4c6b0"/>
    <ellipse cx="60" cy="64" rx="38" ry="34" fill="#e0aa6e"/>
    <ellipse cx="60" cy="80" rx="20" ry="15" fill="#f6dcb8"/>
    ${eyes}${blush}
    <ellipse cx="60" cy="74" rx="5" ry="3.6" fill="#2b1d14"/>
    <path d="${mouths[mood]}" stroke="#2b1d14" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    ${sweat}
  </svg>`;
}

function moodOf() {
  if (S.stress >= 70) return 'nervous';
  if (S.hp <= 30) return 'tired';
  if (S.stress <= 35 && S.hp >= 60) return 'happy';
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
  const bar = (label, cls, v) => `
    <div class="stat"><div class="stat-label"><span>${label}</span><span>${v}</span></div>
    <div class="bar ${cls}"><span style="width:${v}%"></span></div></div>`;
  hud.innerHTML = `
    <div class="dog-wrap">${dogSVG(mood, S.stage >= 4)}<div class="bubble">${esc(line || moodLine(mood))}</div></div>
    <div class="stats">
      <div class="muted"><b>${esc(S.name)}</b> · 취준생</div>
      ${bar('💪 체력', 'hp', S.hp)}
      ${bar('😵 스트레스', 'stress', S.stress)}
      <div class="stat-row"><span>💰 ${S.money}만원</span><span>🍖 간식력 ${S.snack}</span></div>
    </div>`;
}

/* =========================================================
 * 타이틀
 * ========================================================= */
function titleScreen() {
  S = null;
  updateHUD();
  const saved = loadSave();
  show(`
    <div class="card center">
      <div style="width:150px;margin:0 auto">${dogSVG('happy', false).replace('class="dog"', 'class="dog" style="width:150px;height:166px"')}</div>
      <h2>우리 치와와, 취업시킬 수 있을까?</h2>
      <p class="muted">자소서부터 면접까지! 치와와와 함께 6단계 취업 전쟁을 뚫고<br>꿈의 직장에 입사해 보세요.</p>
      <p style="text-align:left;margin-top:14px"><label class="muted" for="name">치와와 이름</label></p>
      <input id="name" type="text" maxlength="8" value="초코" autocomplete="off">
      <button class="btn" data-act="new">새로 시작하기</button>
      ${saved ? `<button class="btn sub" data-act="cont">이어하기 (${esc(saved.name)} · ${STAGES[saved.stage]})</button>` : ''}
    </div>`, {
    new: () => {
      const name = document.getElementById('name').value.trim() || '초코';
      S = newState(name);
      stageEssay();
    },
    cont: () => { S = saved; STAGE_FUNCS[S.stage](); },
  });
}

/* =========================================================
 * 1단계: 자기소개서 (단어 조합)
 * ========================================================= */
const ESSAY = [
  {
    tpl: '저는 ___ 지원자 {name}입니다.',
    opts: [{ t: '도전을 두려워하지 않는', s: 25 }, { t: '시키는 일은 다 하는', s: 15 }, { t: '간식만 주면 뭐든 하는', s: 5, snack: 1 }],
  },
  {
    tpl: '학창 시절, ___ 경험으로 협동심을 길렀습니다.',
    opts: [{ t: '팀 프로젝트를 이끌었던', s: 25 }, { t: '동아리 총무를 맡았던', s: 18 }, { t: '공원 비둘기를 하루 종일 쫓던', s: 5 }],
  },
  {
    tpl: '저의 가장 큰 강점은 ___입니다.',
    opts: [{ t: '끈기와 문제 해결력', s: 25 }, { t: '예민한 귀와 빠른 발', s: 15 }, { t: '간식 좋아함', s: 5, snack: 1 }],
  },
  {
    tpl: '입사 후에는 ___ 사원이 되겠습니다.',
    opts: [{ t: '회사의 성장을 이끄는', s: 25 }, { t: '맡은 일을 묵묵히 해내는', s: 18 }, { t: '탕비실 간식을 지키는', s: 5, snack: 1 }],
  },
];

function stageEssay() {
  intro(0, '✍️', '자기소개서를 써보자!',
    '빈칸에 들어갈 말을 골라 자소서를 완성해요.<br>너무 솔직하게 쓰면… 곤란할지도? (대신 간식력이 올라요)', run);

  function run() {
    let i = 0, score = 0;
    const lines = [];
    step();

    function step() {
      if (i >= ESSAY.length) return done();
      const q = ESSAY[i];
      const opts = shuffle(q.opts);
      const tpl = q.tpl.replace('{name}', S.name);
      show(`
        <div class="card">
          <div class="step">문장 ${i + 1} / ${ESSAY.length}</div>
          <div class="paper">
            ${lines.map((l) => `<p>${esc(l)}</p>`).join('')}
            <p>${esc(tpl).replace('___', '<u>&nbsp;</u>')}</p>
          </div>
          <div class="choices">
            ${opts.map((o, k) => `<button class="choice" data-act="pick" data-arg="${k}">${esc(o.t)}</button>`).join('')}
          </div>
        </div>`, {
        pick: (k) => {
          const o = opts[+k];
          lines.push(tpl.replace('___', o.t));
          score += o.s;
          if (o.snack) S.snack += o.snack;
          i++;
          updateHUD(o.s >= 25 ? '오, 이 문장 멋있다!' : o.s <= 5 ? '헤헤… 솔직하게 썼어요' : '음, 괜찮겠죠?');
          step();
        },
      });
    }

    function done() {
      S.essay = score;
      S.essayLines = lines;
      const grade = score >= 90 ? ['S', '완벽한 자소서! 인사팀이 감동할 거예요.']
        : score >= 65 ? ['A', '꽤 괜찮은 자소서예요.']
          : score >= 40 ? ['B', '평범한 자소서… 스펙으로 만회해 봐요.']
            : ['C', '간식 이야기뿐인 자소서… 그래도 진심은 느껴져요.'];
      updateHUD(grade[0] === 'S' ? '자소서 완성! 뿌듯해요!' : '자소서 완성!');
      show(`
        <div class="card">
          <h2>📄 ${esc(S.name)}의 자기소개서</h2>
          <div class="paper">${lines.map((l) => `<p>${esc(l)}</p>`).join('')}</div>
          <table class="score-table">
            <tr><td>자소서 점수</td><td>${score} / 100</td></tr>
            <tr class="total"><td>등급 ${grade[0]}</td><td></td></tr>
          </table>
          <p class="muted">${grade[1]}</p>
          <button class="btn" data-act="next">다음 단계로 →</button>
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
    icon: '📚', name: '토익 공부', desc: '토익↑ 체력-10 스트레스+12',
    run() { S.toeic = clamp(S.toeic + rand(10, 18), 0, 100); S.hp -= 10; S.stress += 12; return `토익 공부를 했다! 예상 점수 ${toeicScore()}`; },
  },
  {
    icon: '📜', name: '자격증 시험', desc: '응시료 20만원 체력-12 스트레스+15', cost: 20,
    run() {
      S.money -= 20; S.hp -= 12; S.stress += 15;
      if (Math.random() < 0.7) { S.cert++; return `자격증 합격! 🎉 (보유 ${S.cert}개)`; }
      return '아깝게 불합격… 다음엔 꼭!';
    },
  },
  {
    icon: '💼', name: '인턴 근무', desc: '경력↑ 돈+15 체력-20 스트레스+15',
    run() { S.intern++; S.money += 15; S.hp -= 20; S.stress += 15; return `인턴 ${S.intern}주차 완료! 커피 심부름도 완벽했다.`; },
  },
  {
    icon: '🏪', name: '편의점 알바', desc: '돈+25 체력-15 스트레스+8',
    run() { S.money += 25; S.hp -= 15; S.stress += 8; return '알바비 25만원 입금! 💸'; },
  },
  {
    icon: '🌳', name: '산책하기', desc: '체력+25 스트레스-20',
    run() { S.hp += 25; S.stress -= 20; return '산책 최고! 전봇대 냄새도 실컷 맡았다.'; },
  },
  {
    icon: '🍖', name: '간식 타임', desc: '돈-10 스트레스-30 간식력+1', cost: 10,
    run() { S.money -= 10; S.stress -= 30; S.hp += 5; S.snack++; return '육포를 먹었다. 행복해…'; },
  },
];

const EVENTS = [
  { t: '🎁 할머니가 용돈을 주셨다! (돈+20)', f() { S.money += 20; } },
  { t: '📦 택배 기사님께 짖다가 목이 쉬었다… (스트레스+10)', f() { S.stress += 10; } },
  { t: '🍗 주인이 치킨을 나눠줬다! (간식력+1, 스트레스-10)', f() { S.snack++; S.stress -= 10; } },
  { t: '🤝 산책길에 인사팀장님을 만나 명함을 받았다! (인턴 경력+1)', f() { S.intern++; } },
  { t: '🌧️ 비가 와서 산책을 못 갔다… (스트레스+8)', f() { S.stress += 8; } },
  { t: '😴 꿀잠을 잤다! (체력+15)', f() { S.hp += 15; } },
];

function stageSpec() {
  intro(1, '📚', `${SPEC_WEEKS}주 동안 스펙을 쌓자!`,
    '매주 한 가지 활동을 골라요. 토익·자격증·인턴으로 스펙을 올리되,<br>체력이 0이 되거나 스트레스가 100이 되면 한 주를 쉬어야 해요!', run);

  function run() {
    let week = 1, rest = false, log = '첫 주가 시작됐다. 무엇을 할까?';
    turn();

    function turn() {
      if (week > SPEC_WEEKS) return done();
      updateHUD();
      const specChips = `<div class="specs">
        <span class="chip">📚 토익 ${toeicScore()}</span>
        <span class="chip">📜 자격증 ${S.cert}개</span>
        <span class="chip">💼 인턴 ${S.intern}주</span></div>`;

      if (rest) {
        show(`
          <div class="card">
            <div class="step">${week}주차 / ${SPEC_WEEKS}주</div>
            <h2>🛌 강제 휴식 주간</h2>
            <div class="log">${esc(log)}</div>
            <p class="muted">이번 주는 아무것도 못 하고 쉬어야 해요…</p>
            ${specChips}
            <button class="btn" data-act="rest">푹 쉬기 (체력+20, 스트레스-20)</button>
          </div>`, {
          rest: () => { S.hp += 20; S.stress -= 20; rest = false; week++; log = '푹 쉬었더니 조금 살 것 같다.'; turn(); },
        });
        return;
      }

      show(`
        <div class="card">
          <div class="step">${week}주차 / ${SPEC_WEEKS}주</div>
          <h2>이번 주엔 뭘 할까?</h2>
          <div class="log">${esc(log)}</div>
          ${specChips}
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
          if (S.hp <= 0) { S.hp = 20; rest = true; msgs.push('💥 체력이 바닥나 쓰러졌다! 다음 주는 강제 휴식…'); }
          else if (S.stress >= 100) { S.stress = 70; rest = true; msgs.push('🔥 번아웃이 왔다! 다음 주는 강제 휴식…'); }
          if (Math.random() < 0.3) { const e = EVENTS[rand(0, EVENTS.length - 1)]; e.f(); msgs.push(e.t); }
          fixStats();
          log = msgs.join('\n');
          week++;
          turn();
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
          <button class="btn" data-act="next">서류 넣으러 가기 →</button>
        </div>`, { next: () => stageDoc() });
    }
  }
}

/* =========================================================
 * 3단계: 서류 전형 (지원 회사 선택)
 * ========================================================= */
const COMPANIES = {
  big: { icon: '🏢', name: '멍성전자', type: '대기업', finalReq: 72, unlock: () => S.doc >= 70, req: '서류 점수 70점 이상' },
  startup: { icon: '🚀', name: '왈왈랩스', type: '스타트업', finalReq: 58, unlock: () => S.doc >= 45, req: '서류 점수 45점 이상' },
  snack: { icon: '🍖', name: '츄르푸드', type: '간식회사', finalReq: 45, unlock: () => S.snack >= 3, req: '간식력 3 이상' },
  small: { icon: '🏭', name: '댕댕물산', type: '중소기업', finalReq: 40, unlock: () => true, req: '누구나 지원 가능' },
};

function stageDoc() {
  intro(2, '📮', '서류를 넣어보자!',
    '자소서와 스펙으로 서류 점수가 정해져요.<br>점수에 따라 지원할 수 있는 회사가 달라져요!', run);

  function run() {
    S.doc = Math.round(S.essay * 0.4 + S.spec * 0.6);
    updateHUD();
    show(`
      <div class="card">
        <h2>📊 서류 점수</h2>
        <table class="score-table">
          <tr><td>자소서 ${S.essay}점 × 0.4</td><td>${Math.round(S.essay * 0.4)}</td></tr>
          <tr><td>스펙 ${S.spec}점 × 0.6</td><td>${Math.round(S.spec * 0.6)}</td></tr>
          <tr class="total"><td>서류 점수</td><td>${S.doc} / 100</td></tr>
        </table>
        <p class="muted" style="margin-top:12px">어느 회사에 지원할까요? (한 곳만 지원 가능)</p>
        <div class="choices">
          ${Object.entries(COMPANIES).map(([id, c]) => {
            const ok = c.unlock();
            return `<button class="choice" data-act="apply" data-arg="${id}" ${ok ? '' : 'disabled'}>
              ${c.icon} <b>${c.name}</b> · ${c.type}
              <small>${ok ? '✅ 지원 가능' : '🔒'} ${c.req} · 최종 합격선 ${c.finalReq}점</small></button>`;
          }).join('')}
        </div>
      </div>`, {
      apply: (id) => {
        S.company = id;
        const c = COMPANIES[id];
        updateHUD('두근두근…');
        show(`<div class="card center"><div class="big-emoji">📨</div><h2>${c.name} 서류 결과 발표 중…</h2><p class="muted">두근두근</p></div>`);
        later(() => {
          updateHUD('서류 붙었어요!! 멍!');
          show(`
            <div class="card center">
              <div class="big-emoji">${c.icon}</div>
              <h2>${c.name} ${c.type}</h2>
              <p><span class="stamp pass">서류 합격</span></p>
              <p class="muted">다음은 인적성 검사예요. 최종 합격선은 <b>${c.finalReq}점</b>!</p>
              <button class="btn" data-act="next">인적성 검사 보러 가기 →</button>
            </div>`, { next: () => stageApt() });
        }, 1500);
      },
    });
  }
}

/* =========================================================
 * 4단계: 인적성 검사 (시간제한 퀴즈 + 반응속도)
 * ========================================================= */
const QUIZ = [
  { q: '사과 3개가 1,200원이면, 사과 5개는 얼마일까요?', a: ['1,800원', '2,000원', '2,400원', '1,500원'], c: 1 },
  { q: '다음 수열의 빈칸은? 2, 4, 8, 16, ( )', a: ['24', '30', '32', '20'], c: 2 },
  { q: '"모든 치와와는 개다. 초코는 치와와다." 맞는 결론은?', a: ['초코는 고양이다', '초코는 개다', '모든 개는 초코다', '알 수 없다'], c: 1 },
  { q: '시속 4km로 걷는 치와와가 30분 산책하면 몇 km를 걸을까요?', a: ['1km', '2km', '4km', '8km'], c: 1 },
  { q: '다음 중 나머지와 성격이 다른 하나는?', a: ['사과', '포도', '당근', '배'], c: 2 },
  { q: '회의 중 상사가 내 간식을 먹었다. 가장 적절한 행동은?', a: ['으르렁거린다', '웃으며 넘어간다', '바로 퇴사한다', '상사 간식을 먹는다'], c: 1 },
  { q: '시계가 3시 정각을 가리킬 때, 시침과 분침 사이의 각도는?', a: ['60°', '90°', '120°', '180°'], c: 1 },
  { q: '뼈다귀 12개를 치와와 4마리가 똑같이 나누면 한 마리당 몇 개?', a: ['2개', '3개', '4개', '6개'], c: 1 },
];
const QUIZ_COUNT = 5, QUIZ_SEC = 10, REACT_ROUNDS = 5;

function stageApt() {
  intro(3, '🧠', '인적성 검사',
    `① 문제당 ${QUIZ_SEC}초! 퀴즈 ${QUIZ_COUNT}문제 (60점)<br>② 뼈다귀가 나타나면 바로 터치! 반응속도 ${REACT_ROUNDS}회 (40점)`, runQuiz);

  let quizScore = 0, reactScore = 0;

  function runQuiz() {
    const qs = shuffle(QUIZ).slice(0, QUIZ_COUNT);
    let i = 0;
    ask();

    function ask() {
      if (i >= qs.length) return reactIntro();
      const q = qs[i];
      let left = QUIZ_SEC * 10, answered = false;
      show(`
        <div class="card">
          <div class="step">퀴즈 ${i + 1} / ${qs.length} · 현재 ${quizScore}점</div>
          <div class="timer"><span id="tbar" style="width:100%"></span></div>
          <h2 style="font-size:1.05rem">${esc(q.q)}</h2>
          <div class="choices">
            ${q.a.map((t, k) => `<button class="choice" data-act="ans" data-arg="${k}">${esc(t)}</button>`).join('')}
          </div>
        </div>`, { ans: (k) => answer(+k) });
      const tbar = document.getElementById('tbar');
      every(() => {
        left--;
        tbar.style.width = `${(left / (QUIZ_SEC * 10)) * 100}%`;
        if (left <= 0) answer(-1);
      }, 100);

      function answer(k) {
        if (answered) return;
        answered = true;
        clearTimers();
        const btns = app.querySelectorAll('.choice');
        btns.forEach((b, idx) => {
          b.disabled = true;
          if (idx === q.c) b.classList.add('correct');
          else if (idx === k) b.classList.add('wrong');
        });
        if (k === q.c) { quizScore += 12; updateHUD('정답! 멍!'); }
        else { S.stress += 4; updateHUD(k === -1 ? '시간 초과… 😢' : '틀렸어요… 😢'); }
        i++;
        later(ask, 900);
      }
    }
  }

  function reactIntro() {
    show(`
      <div class="card center">
        <div class="big-emoji">🦴</div>
        <h2>반응속도 테스트</h2>
        <p>퀴즈 점수: <b>${quizScore} / 60</b></p>
        <p class="muted">“기다려…”가 나오면 참고, <b>🦴 지금!</b>이 나오면 최대한 빨리 터치하세요.<br>너무 일찍 누르면 그 판은 0점이에요!</p>
        <button class="btn" data-act="go">준비 완료!</button>
      </div>`, { go: () => round(0) });
  }

  function round(r) {
    if (r >= REACT_ROUNDS) return done();
    show(`
      <div class="card">
        <div class="step">반응속도 ${r + 1} / ${REACT_ROUNDS} · 현재 ${reactScore}점</div>
        <button id="pad" class="react wait">기다려… ✋</button>
      </div>`);
    const pad = document.getElementById('pad');
    let ready = false, t0 = 0, finished = false;
    later(() => { ready = true; t0 = performance.now(); pad.className = 'react go'; pad.textContent = '🦴 지금!'; }, rand(1000, 2800));
    pad.addEventListener('pointerdown', () => {
      if (finished) return;
      finished = true;
      clearTimers();
      if (!ready) {
        pad.className = 'react miss';
        pad.textContent = '너무 빨랐어요! 🐾';
        updateHUD('참을성이 부족했어요…');
      } else {
        const ms = Math.round(performance.now() - t0);
        const pts = ms < 350 ? 8 : ms < 500 ? 6 : ms < 700 ? 4 : 2;
        reactScore += pts;
        pad.textContent = `${ms}ms · +${pts}점`;
        updateHUD(pts >= 8 ? '번개처럼 빨랐어요!' : '덥석!');
      }
      later(() => round(r + 1), 1000);
    });
  }

  function done() {
    S.apt = quizScore + reactScore;
    updateHUD('인적성 끝! 이제 면접이에요…');
    show(`
      <div class="card">
        <h2>🧠 인적성 검사 결과</h2>
        <table class="score-table">
          <tr><td>퀴즈</td><td>${quizScore} / 60</td></tr>
          <tr><td>반응속도</td><td>${reactScore} / 40</td></tr>
          <tr class="total"><td>인적성 점수</td><td>${S.apt} / 100</td></tr>
        </table>
        <button class="btn" data-act="next">면접장으로 →</button>
      </div>`, { next: () => stageInterview() });
  }
}

/* =========================================================
 * 5단계: 면접 (대화 선택, 긴장하면 짖음!)
 * ========================================================= */
const BARK = { t: '멍멍! 왈왈!', s: 0, bark: true };
function interviewQuestions() {
  const isSnack = S.company === 'snack';
  return [
    {
      q: '간단하게 자기소개 부탁드립니다.',
      a: [{ t: '자소서에 쓴 강점을 중심으로 자신 있게 소개한다', s: 20 }, { t: '이름과 나이만 말한다', s: 8 }, { t: '말없이 꼬리를 힘차게 흔든다', s: 12 }, BARK],
    },
    {
      q: `우리 ${COMPANIES[S.company].name}에 지원한 이유가 뭔가요?`,
      a: [{ t: '회사의 비전에 깊이 공감해서입니다', s: 20 }, { t: '집에서 가까워서요', s: 6 }, { t: '간식이 맛있다고 들어서요!', s: isSnack ? 20 : 4 }, BARK],
    },
    {
      q: '살면서 가장 힘들었던 경험은 무엇인가요?',
      a: [{ t: '스펙을 쌓으며 체력의 한계를 극복한 경험', s: 20 }, { t: '목욕을 해야 했던 날', s: 10 }, { t: '딱히 없습니다', s: 3 }, BARK],
    },
    {
      q: '동료와 의견이 다를 때는 어떻게 하나요?',
      a: [{ t: '차분히 대화하며 서로의 입장을 맞춰갑니다', s: 20 }, { t: '일단 참습니다', s: 10 }, { t: '으르렁거려서 기선을 제압합니다', s: 2 }, BARK],
    },
    {
      q: '마지막으로 하고 싶은 말이 있나요?',
      a: [{ t: '꼭 필요한 인재가 되겠습니다. 뽑아주세요!', s: 20 }, { t: '감사합니다', s: 14 }, { t: '앞발을 내밀며 "손!"', s: 12 }, BARK],
    },
  ];
}
const barkChance = () => (S.stress >= 50 ? (S.stress - 40) / 150 : 0);

function stageInterview() {
  const warn = () => (barkChance() > 0
    ? `<p class="warn">⚠️ 스트레스 ${S.stress}! 긴장해서 답변 중 짖을 확률 ${Math.round(barkChance() * 100)}%</p>`
    : '<p class="muted">마음이 편안해요. 실수 없이 답할 수 있을 것 같아요.</p>');
  let breathed = false;
  intro(4, '👔', '드디어 면접!',
    '면접관의 질문에 알맞은 답을 골라요. 짖으면 감점!<br>스트레스가 높으면 나도 모르게 짖어버릴 수도 있어요.',
    run, `${warn()}<button class="btn sub" data-act="breath">🧘 심호흡하기 (스트레스-20, 1회)</button>`, {
      breath: (_, el) => {
        if (breathed) return;
        breathed = true;
        S.stress -= 20;
        fixStats();
        save();
        updateHUD('후우… 조금 진정됐어요');
        el.disabled = true;
        el.textContent = '🧘 심호흡 완료!';
        el.insertAdjacentHTML('beforebegin', warn());
        el.previousElementSibling.previousElementSibling.remove();
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
          if (o.bark) S.stress += 5;
          else S.stress -= 3;
          fixStats();
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
            </div>`, { next: () => { i++; ask(); } });
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
        </div>`, { next: () => stageResult() });
    }
  }
}

/* =========================================================
 * 6단계: 최종 결과 & 엔딩
 * ========================================================= */
function endingOf(pass) {
  const n = S.name;
  if (!pass) {
    return { title: '📮 아쉽지만 불합격…', text: `이번엔 인연이 아니었나 봐요. 하지만 ${n}의 꼬리는 아직 힘차게 흔들리고 있어요! 다시 도전해 볼까요?` };
  }
  return {
    big: { title: '🏢 멍성전자 신입사원', text: `사원증을 목에 건 ${josa(n, '이', '')}! 오늘부터 대기업 사원이에요. 첫 월급으로 주인님께 소고기를 사드렸대요.` },
    startup: { title: '🚀 왈왈랩스 1호 직원', text: `작지만 꿈은 큰 스타트업! ${josa(n, '은', '는')} CTO(Chief Treat Officer)로 임명되었어요.` },
    snack: { title: '🍖 츄르푸드 수석 맛 테스터', text: `간식에 대한 진심이 통했다! ${josa(n, '은', '는')} 매일 신제품 간식을 맛보는 꿈의 직장에 입사했어요.` },
    small: { title: '🏭 댕댕물산의 든든한 막내', text: `모두에게 사랑받는 막내 사원! 칼퇴하고 매일 저녁 산책을 즐기는 워라밸 최고의 직장이에요.` },
  }[S.company];
}

function stageResult() {
  S.stage = 5;
  S.total = Math.round(S.doc * 0.3 + S.apt * 0.3 + S.interview * 0.4);
  const c = COMPANIES[S.company];
  const pass = S.total >= c.finalReq;
  const end = endingOf(pass);
  // 결과를 본 뒤에는 저장을 지워 다음 판을 새로 시작하게 한다
  clearSave();
  if (pass) { S.stress = 0; S.hp = 100; }
  updateHUD(pass ? '합격이에요!!! 멍멍!!' : '흑… 다음엔 꼭 붙을 거예요');
  const weakest = [['서류', S.doc], ['인적성', S.apt], ['면접', S.interview]].sort((a, b) => a[1] - b[1])[0][0];

  show(`<div class="card center"><div class="big-emoji">✉️</div><h2>${c.name} 최종 결과 발표 중…</h2></div>`);
  later(() => {
    show(`
      <div class="card">
        <div class="center">
          <p><span class="stamp ${pass ? 'pass' : ''}">${pass ? '최종 합격' : '불합격'}</span></p>
          <h2 style="margin-top:14px">${end.title}</h2>
          <p>${esc(end.text)}</p>
        </div>
        <table class="score-table">
          <tr><td>지원 회사</td><td>${c.icon} ${c.name}</td></tr>
          <tr><td>서류 ${S.doc}점 × 0.3</td><td>${Math.round(S.doc * 0.3)}</td></tr>
          <tr><td>인적성 ${S.apt}점 × 0.3</td><td>${Math.round(S.apt * 0.3)}</td></tr>
          <tr><td>면접 ${S.interview}점 × 0.4</td><td>${Math.round(S.interview * 0.4)}</td></tr>
          <tr class="total"><td>최종 점수 (합격선 ${c.finalReq})</td><td>${S.total}</td></tr>
        </table>
        ${pass ? '' : `<p class="muted">💡 가장 아쉬웠던 부분은 <b>${weakest}</b>이에요. 다음엔 여기를 노려보세요!</p>`}
        <p class="muted">🔓 엔딩은 회사마다 달라요. 간식회사 엔딩은 간식력이 있어야 열려요!</p>
        <button class="btn" data-act="again">처음부터 다시 하기</button>
      </div>`, { again: () => titleScreen() });
  }, 1600);
}

const STAGE_FUNCS = [stageEssay, stageSpec, stageDoc, stageApt, stageInterview, stageResult];

titleScreen();
