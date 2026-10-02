/* ══════════════════════════════════════════════════════════════
   PROTOCOLLO OMBRA — js/background.js
   Sfondo stellato + loop principale (contatori/refresh UI throttled).
   ══════════════════════════════════════════════════════════════ */

const bg = $('#bg');
const bx = bg.getContext('2d');
let stars = [];

function bgInit(){
  bg.width  = innerWidth;
  bg.height = innerHeight;
  stars = [];
  for(let i = 0; i < 140; i++){
    stars.push({
      x: Math.random() * bg.width,
      y: Math.random() * bg.height,
      z: Math.random() + .2,
      r: Math.random() * 1.5 + .3,
      tw: Math.random() * 6.28
    });
  }
}
addEventListener('resize', bgInit);
bgInit();

function bgDraw(ts){
  bx.clearRect(0, 0, bg.width, bg.height);
  const dead = document.body.classList.contains('deadmode');
  const col  = dead ? '#d9b8ff' : '#9fdcff';
  for(const s of stars){
    s.y -= s.z * .06;
    if(s.y < 0) s.y = bg.height;
    bx.globalAlpha = .25 + .6 * Math.abs(Math.sin(ts/900 + s.tw));
    bx.fillStyle = col;
    bx.beginPath();
    bx.arc(s.x, s.y, s.r, 0, 7);
    bx.fill();
  }
  bx.globalAlpha = 1;
}

/* ★ FIX PERFORMANCE: refresh UI pesante max 5 volte al secondo */
let lastUiTick = 0;

function loop(ts){
  requestAnimationFrame(loop);
  bgDraw(ts);
  if(!PUB) return;
  const now = Date.now() + clockOff;

  if(PUB.phase === 'play'){
    $('#g-clock').textContent = fmt(now - PUB.t0);
    const me = PUB.players.find(p => p.id === I.id);
    if(me && me.alive && !me.task && !me.q){
      const n = $('#nextin');
      if(n) n.textContent = fmt((me.nextAt || 0) - now);
    }
    if(ts - lastUiTick > 200){
      lastUiTick = ts;
      updateDock();
      renderMeetTimers(now);
    }
  } else if(PUB.meeting && ts - lastUiTick > 200){
    lastUiTick = ts;
    renderMeetTimers(now);
  }
}
requestAnimationFrame(loop);

function renderMeetTimers(now){
  const m = PUB.meeting;
  if(!m) return;
  const tot = m.stage === 1
    ? (m.kind === 'word' ? CFG.WORD_TIME : CFG.VOTE_TIME)
    : (m.kind === 'word' ? CFG.WORD_SHOW : CFG.VOTE_REVEAL);
  const bar = $('#meet-bar');
  if(bar) bar.style.width = Math.max(0, Math.min(100, (m.endsAt - now) / tot * 100)) + '%';
  const tm = $('#meet-timer');
  if(tm) tm.textContent = fmt(m.endsAt - now);
  const cd = $('#meet-count');
  if(cd) cd.textContent = Math.max(0, Math.ceil((m.endsAt - now) / 1000));
}