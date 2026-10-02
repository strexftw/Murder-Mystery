/* ══════════════════════════════════════════════════════════════
   PROTOCOLLO OMBRA — js/background.js
   Sfondo stellato animato su canvas (#bg).
   Le stelle cambiano colore quando si è in "deadmode" (spettri).
   Dipendenze: utils.js ($), state.js (lettura body class).
   ══════════════════════════════════════════════════════════════ */

/* ═══ RIFERIMENTO CANVAS ═══ */
const bg = $('#bg');
const bx = bg.getContext('2d');

/* ═══ LISTA STELLE ═══ */
let stars = [];

/* Ridimensiona il canvas e rigenera le stelle */
function bgInit(){
  bg.width  = innerWidth;
  bg.height = innerHeight;
  stars = [];
  for(let i = 0; i < 140; i++){
    stars.push({
      x:  Math.random() * bg.width,
      y:  Math.random() * bg.height,
      z:  Math.random() + .2,          // velocità di deriva
      r:  Math.random() * 1.5 + .3,    // raggio stella
      tw: Math.random() * 6.28         // fase di scintillio
    });
  }
}
addEventListener('resize', bgInit);
bgInit();

/* Disegna un frame dello sfondo */
function bgDraw(ts){
  bx.clearRect(0, 0, bg.width, bg.height);
  // Le stelle diventano viola quando il giocatore è uno spettro (deadmode)
  const dead = document.body.classList.contains('deadmode');
  const col  = dead ? '#d9b8ff' : '#9fdcff';
  for(const s of stars){
    s.y -= s.z * .06;                  // deriva lenta verso l'alto
    if(s.y < 0) s.y = bg.height;
    bx.globalAlpha = .25 + .6 * Math.abs(Math.sin(ts/900 + s.tw));
    bx.fillStyle = col;
    bx.beginPath();
    bx.arc(s.x, s.y, s.r, 0, 7);
    bx.fill();
  }
  bx.globalAlpha = 1;
}

/* ═══ LOOP PRINCIPALE DI GIOCO ═══
   Oltre allo sfondo, aggiorna contatori e contatori di ricarica.
   (Le funzioni render/update sono definite in client.js)      */
function loop(ts){
  requestAnimationFrame(loop);
  bgDraw(ts);
  if(!PUB) return;
  const now = Date.now() + clockOff;

  if(PUB.phase === 'play'){
    // Orologio di partita
    $('#g-clock').textContent = fmt(now - PUB.t0);
    // Conto alla rovescia della prossima task per il giocatore corrente
    const me = PUB.players.find(p => p.id === I.id);
    if(me && me.alive && !me.task && !me.q){
      const n = $('#nextin');
      if(n) n.textContent = fmt((me.nextAt || 0) - now);
    }
    updateDock();
    renderMeetTimers(now);
  }
  if(PUB.meeting) renderMeetTimers(now);
}
requestAnimationFrame(loop);

/* ═══ CONTATORI DELLE RIUNIONI ═══ */
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