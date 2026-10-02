/* ══════════════════════════════════════════════════════════════
   PROTOCOLLO OMBRA — js/ui.js
   Gestione UI interattiva: modali d'azione (scan/kill/sab/abilità),
   chat privata, jumpscare, hack, fine partita, collegamento pulsanti.
   QUI vivono (canonicali): showScanRes, showSeanceVote, showCoopInvite,
   chat, doJump, doHack, renderEnd. (Rimosse da client.js.)
   Dipendenze: config.js, utils.js, audio.js, state.js, client.js.
   ══════════════════════════════════════════════════════════════ */

/* ── SCAN (detective) ── */
function openScan(){
  if(!PUB) return;
  if((SYNC.chg||0)<=0){ banner('⚡ CARICHE SCANSIONE ESAURITE', 'amber'); return; }
  const alive = PUB.players.filter(p=>p.alive && p.id!==I.id);
  $('#scan-body').innerHTML = '<h2 class="mt amb">SCANSIONE CODICE</h2><p class="sub">Hai <b class="amb">⚡ '+(SYNC.chg||0)+
    '</b> cariche. Scegli chi scansionare.</p><div class="vlist">'+
    alive.map(p=>'<button class="vbtn" data-id="'+p.id+'">⬡ '+esc(p.name)+(p.q?' ⛔':'')+'</button>').join('')+
    '</div><button class="btn ghost" id="sc-x" style="margin-top:12px;width:100%">ANNULLA</button>';
  $('#sc-x').onclick = ()=>hide($('#m-scan'));
  $$('#scan-body .vbtn').forEach(b=>b.onclick=()=>{ hide($('#m-scan')); runScan(b.dataset.id); });
  show($('#m-scan'));
}
function runScan(tid){
  show($('#m-scan'));
  SFX.scan();
  $('#scan-body').innerHTML = '<div class="scanfx"><div class="scanring"></div>'+
    '<div class="mono amb">ANALISI DEL CODICE DI RICONOSCIMENTO…</div>'+
    '<div class="bar wide"><i id="sbar" style="width:0%"></i></div></div>';
  let w=0;
  const iv=setInterval(()=>{
    w+=2;
    const b=$('#sbar'); if(b) b.style.width=w+'%';
    if(w>=100) clearInterval(iv);
  },50);
  setTimeout(()=>act({t:'scan', tgt:tid}), 2600);
}
function showScanRes(m){
  show($('#m-scan'));
  let inner;
  if(m.q){
    SFX.alarm();
    inner = '<h2 class="mt red">ESITO SCANSIONE</h2><div class="rescard badq">'+
      '<div class="big">⛔ CODICE = QUELLO DELL\'ASSASSINO</div>'+
      '<div class="mono" style="font-size:.8rem">OPERATORE: '+esc(m.target)+' → MESSO IN QUARANTENA</div>'+
      '<div class="mono" style="font-size:.8rem;margin:8px 0">CODICE LETTO: <b class="oc">'+esc(m.code)+'</b></div>'+
      '<div class="mono amb" style="font-size:.8rem;margin-top:8px">⚡ CARICHE RIMASTE: '+m.chg+'</div></div>';
  } else if(m.released){
    SFX.ok();
    inner = '<h2 class="mt amb">ESITO VERIFICA</h2><div class="rescard cut">'+
      '<div class="big">✅ RILASCIATO: NON È L\'ASSASSINO</div>'+
      '<div class="mono" style="font-size:.8rem">OPERATORE: '+esc(m.target)+'</div>'+
      '<div class="mono amb" style="font-size:.8rem;margin-top:8px">⚡ CARICHE RIMASTE: '+m.chg+'</div></div>';
  } else {
    SFX.ok();
    inner = '<h2 class="mt amb">ESITO SCANSIONE</h2><div class="rescard cut">'+
      '<div class="big">✓ CODICE PULITO</div><div class="mono" style="font-size:.8rem">OPERATORE: '+esc(m.target)+'</div>'+
      '<div class="mono" style="font-size:.8rem;margin:8px 0">CODICE LETTO: <b class="oc">'+esc(m.code)+'</b></div>'+
      '<div class="mono" style="font-size:.8rem">TASK: <b>'+m.tasks+'</b></div>'+
      '<div class="mono amb" style="font-size:.8rem;margin-top:8px">⚡ CARICHE RIMASTE: '+m.chg+'</div></div>';
  }
  $('#scan-body').innerHTML = inner+'<button class="btn wide" id="sc-ok" style="margin-top:12px">CHIUDI</button>';
  $('#sc-ok').onclick = ()=>hide($('#m-scan'));
}

/* ── KILL (assassino) ── */
function openKill(){
  if(!PUB) return;
  const alive = PUB.players.filter(p=>p.alive && p.id!==I.id);
  let sel=null;
  $('#kill-body').innerHTML = '<h2 class="mt red">BERSAGLIO</h2><p class="sub">Scegli chi eliminare. Primo tocco: seleziona · Secondo tocco: conferma.</p>'+
    '<div class="vlist">'+alive.map(p=>'<button class="vbtn" data-id="'+p.id+'">⬡ '+esc(p.name)+'</button>').join('')+'</div>'+
    '<button class="btn ghost" id="k-x" style="margin-top:12px;width:100%">ANNULLA</button>';
  $('#k-x').onclick = ()=>hide($('#m-kill'));
  $$('#kill-body .vbtn').forEach(b=>{
    b.dataset.n = b.textContent.replace('⬡ ','');
    b.onclick = ()=>{
      if(sel===b.dataset.id){ act({t:'kill', tgt:sel}); hide($('#m-kill')); SFX.alarm(); return; }
      sel = b.dataset.id;
      $$('#kill-body .vbtn').forEach(x=>{ x.classList.remove('pick'); x.textContent='⬡ '+x.dataset.n; });
      b.classList.add('pick');
      b.textContent='⚠ CONFERMA ELIMINAZIONE?';
    };
  });
  show($('#m-kill'));
}

/* ── SABOTAGGIO (assassino) ── */
function openSab(){
  if(!PUB) return;
  const all = PUB.players.filter(p=>p.alive);
  $('#sab-body').innerHTML = '<h2 class="mt red">SABOTAGGIO CODICI</h2>'+
    '<p class="sub">Anonimo · <b>TUTTI</b> adottano il codice del bersaglio (resiste a 2 scan). Bersaglio Detective → hackeraggio + riuso istantaneo + cifra rivelata.</p>'+
    '<div class="vlist">'+all.map(p=>'<button class="vbtn" data-id="'+p.id+'">'+(p.id===I.id?'⬡ '+esc(p.name)+' — TU (autosabotaggio)':'⬡ '+esc(p.name))+'</button>').join('')+'</div>'+
    '<button class="btn ghost" id="sb-x" style="margin-top:12px;width:100%">ANNULLA</button>';
  $('#sb-x').onclick = ()=>hide($('#m-sab'));
  $$('#sab-body .vbtn').forEach(b=>b.onclick=()=>{ act({t:'sab', tgt:b.dataset.id}); hide($('#m-sab')); });
  show($('#m-sab'));
}

/* ── ABILITÀ / SÉANCE / SUSSURRI ── */
function openAb(kind){
  if(!PUB) return;
  const B = $('#ab-body');
  if(kind==='whisper'){ openWhisperList(); return; }
  if(kind==='seance'){
    const alive = PUB.players.filter(p=>p.alive && p.id!==I.id);
    B.innerHTML = '<h2 class="mt" style="color:'+VIO+'">🕯 LA SÉANCE</h2><p class="sub">Su chi interroghi gli spiriti? Tutti i morti voteranno SÌ/NO.</p>'+
      '<div class="vlist">'+alive.map(p=>'<button class="vbtn" data-id="'+p.id+'">⬡ '+esc(p.name)+'</button>').join('')+'</div>'+
      '<button class="btn ghost" id="ab-x" style="margin-top:12px;width:100%">ANNULLA</button>';
    $('#ab-x').onclick = ()=>hide($('#m-ab'));
    $$('#ab-body .vbtn').forEach(b=>b.onclick=()=>{ SFX.seance(); act({t:'seanceTarget', tgt:b.dataset.id}); hide($('#m-ab')); });
    show($('#m-ab'));
    return;
  }
  if(kind==='puttana' || kind==='gesu' || kind==='merde'){
    let dead;
    if(kind==='puttana'||kind==='gesu') dead = PUB.players.filter(p=>!p.alive && (p.deadBy==='kill'||p.deadBy==='spalm'));
    else dead = PUB.players.filter(p=>!p.alive && p.deadBy==='vote');
    if(!dead.length){ banner('NESSUN BERSAGLIO RESUSCITABILE', 'amber'); return; }
    const col = ABS[kind].c;
    const titles = {puttana:'LA PUTTANA', gesu:'CHE GESÙ STA CON TE', merde:'SONO TORNATO MERDE'};
    const subs = {
      puttana:'Chi riporti in vita? (solo uccisi da assassino/spalmatore · riuso 4 min)',
      gesu:'RESURREZIONE ATTIVA: chi riporti in vita? (solo uccisi da assassino/spalmatore · consuma)',
      merde:'RESURREZIONE ATTIVA: chi riporti in vita? (solo espulsi dai voti · consuma)'
    };
    B.innerHTML = '<h2 class="mt" style="color:'+col+'">'+titles[kind]+'</h2><p class="sub">'+subs[kind]+'</p>'+
      '<div class="vlist">'+dead.map(p=>'<button class="vbtn" data-id="'+p.id+'">✨ '+esc(p.name)+'</button>').join('')+'</div>'+
      '<button class="btn ghost" id="ab-x" style="margin-top:12px;width:100%">ANNULLA</button>';
    $('#ab-x').onclick = ()=>hide($('#m-ab'));
    const t = kind==='puttana'?'abPutt':kind==='gesu'?'abGesuRev':'abMerdeRev';
    $$('#ab-body .vbtn').forEach(b=>b.onclick=()=>{ act({t:t, tgt:b.dataset.id}); hide($('#m-ab')); });
    show($('#m-ab'));
    return;
  }
  const alive = PUB.players.filter(p=>p.alive && p.id!==I.id && !p.q);
  const col = kind==='spalmatore' ? ABS.spalmatore.c : ABS.sparlatore.c;
  const title = kind==='spalmatore' ? 'LO SPALMATORE PAZZO' : 'LO SPARLATORE';
  const sub = kind==='spalmatore'
    ? 'Chi spalmi? Se era l\'ASSASSINO vincete subito.'
    : 'Di chi sveli PUBBLICAMENTE il ruolo nel registro?';
  B.innerHTML = '<h2 class="mt" style="color:'+col+'">'+title+'</h2><p class="sub">'+sub+'</p>'+
    '<div class="vlist">'+alive.map(p=>'<button class="vbtn" data-id="'+p.id+'">⬡ '+esc(p.name)+'</button>').join('')+'</div>'+
    '<button class="btn ghost" id="ab-x" style="margin-top:12px;width:100%">ANNULLA</button>';
  $('#ab-x').onclick = ()=>hide($('#m-ab'));
  const t = kind==='spalmatore' ? 'abSpalm' : 'abSpar';
  $$('#ab-body .vbtn').forEach(b=>b.onclick=()=>{ act({t:t, tgt:b.dataset.id}); hide($('#m-ab')); });
  show($('#m-ab'));
}

/* ── SÉANCE (voto spiriti) ── */
function showSeanceVote(target, endsAt){
  SFX.seance();
  const B = $('#ab-body');
  B.innerHTML = '<h2 class="mt" style="color:'+VIO+'">🕯 SÉANCE · VOTO DEGLI SPIRITI</h2>'+
    '<p class="sub">Il Medio chiede: <b style="color:'+VIO+'">'+esc(target)+' È L\'ASSASSINO?</b><br>Rispondi SÌ o NO.</p>'+
    '<div style="display:flex;gap:12px;justify-content:center">'+
    '<button class="btn grn" id="sv-yes">SÌ</button>'+
    '<button class="btn red" id="sv-no">NO</button></div>';
  $('#sv-yes').onclick = ()=>{ sentSeanceVote=endsAt; SFX.click(); act({t:'seanceBallot', vote:'yes'}); hide($('#m-ab')); };
  $('#sv-no').onclick  = ()=>{ sentSeanceVote=endsAt; SFX.click(); act({t:'seanceBallot', vote:'no'});  hide($('#m-ab')); };
  show($('#m-ab'));
}

/* ── INVITO TASK DI COPPIA ── */
function showCoopInvite(m){
  const B = $('#invite-body');
  B.innerHTML = '<h2 class="mt" style="color:var(--grn)">🤝 INVITO TASK DI COPPIA</h2>'+
    '<p class="sub"><b>'+esc(m.fromName)+'</b> ti invita a fare una <b>task di coppia</b>. Accetti? (hai 20 secondi)</p>'+
    '<div style="display:flex;gap:12px;justify-content:center">'+
    '<button class="btn grn" id="inv-yes">✓ ACCETTA</button>'+
    '<button class="btn red" id="inv-no">✗ RIFIUTA</button></div>';
  $('#inv-yes').onclick = ()=>{ SFX.ok();  act({t:'coopAccept', inviteId:m.inviteId, accept:true});  hide($('#m-invite')); };
  $('#inv-no').onclick  = ()=>{ SFX.err(); act({t:'coopAccept', inviteId:m.inviteId, accept:false}); hide($('#m-invite')); };
  show($('#m-invite'));
  SFX.coop();
}

/* ══════════════════════════════════════════════════
   CHAT PRIVATA (SUSSURRI)
   ══════════════════════════════════════════════════ */
function isChatVisible(){ return !$('#pchat').classList.contains('hidden'); }
function totalUnread(){ let n=0; for(const k in CHATS) n+=CHATS[k].unread; return n; }
function hideChatPanel(){ $('#pchat').classList.add('hidden'); updateFab(); }
function updateFab(){
  const me = PUB && PUB.players.find(p => p.id === I.id);
  const fab = $('#pch-fab');
  if(!me || !me.alive || !PUB || PUB.phase!=='play'){ fab.classList.add('hidden'); return; }
  if(isChatVisible()){ fab.classList.add('hidden'); return; }
  const has = Object.keys(CHATS).length>0;
  if(has){
    fab.classList.remove('hidden');
    const u = totalUnread();
    const ub = $('#pch-ub');
    if(u>0){ ub.classList.remove('hidden'); ub.textContent=u; }
    else ub.classList.add('hidden');
  } else fab.classList.add('hidden');
}
function openWhisperList(){
  const B = $('#ab-body');
  const alive = PUB.players.filter(p=>p.alive && p.id!==I.id);
  B.innerHTML = '<h2 class="mt cyn">🤫 SUSSURRI</h2><p class="sub">Con chi vuoi aprire un canale segreto? L\'apertura è annunciata, il contenuto resta privato.</p>'+
    '<div class="vlist">'+alive.map(p=>'<button class="vbtn" data-id="'+p.id+'">⬡ '+esc(p.name)+'</button>').join('')+'</div>'+
    '<button class="btn ghost" id="ab-x" style="margin-top:12px;width:100%">ANNULLA</button>';
  $('#ab-x').onclick = ()=>hide($('#m-ab'));
  $$('#ab-body .vbtn').forEach(b=>b.onclick=()=>{ hide($('#m-ab')); openChat(b.dataset.id, true); });
  show($('#m-ab'));
}
function openChat(pid, announce){
  const me = PUB && PUB.players.find(p => p.id === I.id);
  if(!me || !me.alive) return;
  const partner = PUB.players.find(p => p.id === pid);
  if(!partner || !partner.alive || pid===I.id) return;
  if(!CHATS[pid]) CHATS[pid] = { name:partner.name, msgs:[], unread:0 };
  CHATS[pid].unread = 0;
  activeChat = pid;
  $('#pch-fab').classList.add('hidden');
  renderChatPanel();
  if(announce) act({t:'whisperOpen', tgt:pid});
}
function renderChatPanel(){
  const p = $('#pchat');
  p.classList.remove('hidden');
  renderChatTabs();
  renderChatMsgs();
  const inp = $('#pch-in');
  inp.value = '';
  inp.onkeydown = e=>{ if(e.key==='Enter') sendChat(); };
  $('#pch-send').onclick = sendChat;
  updateFab();
}
function renderChatTabs(){
  const t = $('#pch-tabs');
  if(!t) return;
  const ids = Object.keys(CHATS);
  t.innerHTML = ids.map(id=>'<button class="pch-tab'+(id===activeChat?' on':'')+'" data-id="'+id+'">'+esc(CHATS[id].name)+
    (CHATS[id].unread?' ('+CHATS[id].unread+')':'')+'</button>').join('')+
    '<button class="pch-tab add" id="pch-add" title="Nuova chat">+</button>'+
    '<button class="pch-tab x" id="pch-x" title="Chiudi">✕</button>';
  $$('#pch-tabs .pch-tab[data-id]').forEach(b=>b.onclick=()=>openChat(b.dataset.id, true));
  $('#pch-add').onclick = ()=>{ hideChatPanel(); SFX.click(); openWhisperList(); };
  $('#pch-x').onclick = ()=>{ hideChatPanel(); };
}
function renderChatMsgs(){
  const box = $('#pch-msgs');
  if(!box || !activeChat) return;
  const c = CHATS[activeChat];
  if(!c) return;
  $('#pch-head').textContent = '🤫 CANALE SEGRETO CON '+c.name;
  box.innerHTML = c.msgs.map(m=>'<div class="pch-msg'+(m.from===I.id?' me':'')+'"><b>'+esc(m.from===I.id?'TU':c.name)+
    ':</b> '+esc(m.text)+'</div>').join('');
  box.scrollTop = box.scrollHeight;
}
function sendChat(){
  const inp = $('#pch-in');
  const v = inp.value.trim();
  if(!v || !activeChat) return;
  inp.value = '';
  CHATS[activeChat].msgs.push({ from:I.id, text:v });
  renderChatMsgs();
  SFX.click();
  act({t:'whisperMsg', tgt:activeChat, text:v});
}

/* ══════════════════════════════════════════════════
   JUMPSCARE / HACK
   ══════════════════════════════════════════════════ */
function doJump(letter, by){
  SFX.jump();
  $('#jump-info').classList.add('hidden');
  $('#jump-face').style.display = '';
  if(by==='spalm'){
    $('#jump-who').textContent = 'Lo Spalmatore Pazzo ti ha spalmato. Nessuna lettera, nessun onore.';
    $('#jump-cluebox').classList.add('hidden');
  } else if(by==='station'){
    $('#jump-who').textContent = 'LA STAZIONE TI HA ELIMINATO: TASK CRITICA SCADUTA.';
    $('#jump-cluebox').classList.add('hidden');
  } else {
    $('#jump-who').textContent = "L'assassino ti ha colpito nell'ombra.";
    $('#jump-cluebox').classList.remove('hidden');
  }
  show($('#jump'));
  setTimeout(()=>{
    $('#jump-face').style.display = 'none';
    $('#jl').textContent = letter || '?';
    $('#jump-info').classList.remove('hidden');
  }, 1400);
}
let hackTimer = null;
function doHack(){
  SFX.hack();
  const h = $('#hack');
  show(h);
  if(hackTimer) clearTimeout(hackTimer);
  hackTimer = setTimeout(()=>hide(h), 2000);
}

/* ══════════════════════════════════════════════════
   FINE PARTITA
   ══════════════════════════════════════════════════ */
function renderEnd(){
  if(!PUB || (!PUB.winner && !PUB.ended)) return;
  const w = PUB.winner, ass = (PUB.ended||[]).find(p=>p.role==='assassino');
  const t = $('#end-title');
  t.textContent = w==='innocenti' ? 'VITTORIA INNOCENTI' : 'VITTORIA ASSASSINO';
  t.dataset.t = t.textContent;
  t.style.color = w==='innocenti' ? 'var(--cyan)' : 'var(--red)';
  $('#end-sub').textContent = 'L\'assassino era: '+(ass?ass.name.toUpperCase():'—');
  $('#end-table').innerHTML = (PUB.ended||[]).map(p=>{
    const r = ROLE[p.role] || {l:'—', c:'var(--dim)'};
    return '<div style="display:flex;justify-content:space-between;padding:9px 4px;border-bottom:1px solid rgba(255,255,255,.06)">'+
      '<b>'+esc(p.name)+(p.alive?'':' <span class="dim">☠</span>')+'</b>'+
      '<span class="mono" style="font-size:.7rem;color:'+r.c+'">'+r.l+(p.isPuttana?' · PUTTANA':'')+' · '+p.tasks+' task</span></div>';
  }).join('');
  $('#btn-again').style.display = isHost ? '' : 'none';
  $('#end-wait').textContent = isHost ? '' : 'In attesa dell\'host per tornare alla lobby…';
  if(!endPlayed){
    endPlayed = true;
    const iWon = (w==='innocenti' && SEC.role!=='assassino') || (w==='assassino' && SEC.role==='assassino');
    (iWon ? SFX.win : SFX.lose)();
  }
}

/* ══════════════════════════════════════════════════
   COLLEGAMENTO PULSANTI (initUI) — chiamata da main.js
   ══════════════════════════════════════════════════ */
function initUI(){
  $('#btn-create').onclick = ()=>{
    if(!SB) return;
    const n = validName();
    if(!n) return;
    SFX.ok();
    I.name = n;
    isHost = true;
    ROOM = genRoom();
    G = {
      phase:'lobby', t0:0, word:'', winner:null, reveal:null, meeting:null, spoof:null, banner:null, log:[],
      whisperLog:{}, coopSessions:{}, coopInvites:{},
      puttanaActive:false, puttanaTimerAt:0, taskTarget:0,
      seanceState:'charge', seanceCur:0, seanceContrib:[],
      seanceMedium:null, seanceTarget:null, seanceVotes:{}, seanceEndsAt:0,
      waiting:[], seenInGame:{},
      players:[mkPlayer(I.id, n)]
    };
    PUB = { phase:'lobby', code:ROOM, t0:0, winner:null, reveal:null, banner:null, meeting:null,
      taskTarget:0, taskProg:0, seance:{state:'charge',cur:0,need:CFG.SEANCE_NEED,target:null}, log:[],
      coop:{}, coopInvites:{},
      players:G.players.map(x=>({id:x.id,name:x.name,alive:x.alive,tasks:x.tasks,task:x.task,q:false,nextAt:0})) };
    enterChannel();
    startHeartbeat();
    showScreen('scr-lobby');
    renderLobby();
  };
  $('#btn-join').onclick = ()=>{
    if(!SB) return;
    const n = validName();
    if(!n) return;
    const c = $('#inp-code').value.trim().toUpperCase();
    if(c.length!==5){ banner('CODICE STANZA NON VALIDO','red'); return; }
    SFX.ok();
    I.name = n;
    isHost = false;
    ROOM = c;
    enterChannel();
    showScreen('scr-lobby');
    setTimeout(()=>{ if(!PUB){ banner('STANZA NON TROVATA O HOST OFFLINE','red'); location.reload(); } }, 8000);
  };
  $('#btn-copy').onclick = ()=>{ navigator.clipboard&&navigator.clipboard.writeText(ROOM); SFX.ok(); banner('CODICE COPIATO ✓','cyan'); };
  $('#btn-leave').onclick = ()=>location.reload();
  $('#btn-start').onclick = ()=>{ SFX.ok(); act({t:'start'}); };
  $('#btn-rules-ok').onclick = ()=>{ SFX.ok(); act({t:'rulesOk'}); };
  $('#btn-ready').onclick = ()=>{ SFX.ok(); $('#btn-ready').disabled=true; act({t:'revealOk'}); };
  $('#btn-eye').onclick = ()=>{ wordHidden=!wordHidden; updateWord(); SFX.click(); };
  $('#btn-mute').onclick = ()=>{ MUTE=!MUTE; $('#btn-mute').textContent=MUTE?'🔇':''; if(AMB)AMB.gain.value=MUTE?0:.03; };
  $('#btn-quit').onclick = ()=>location.reload();
  $('#btn-again').onclick = ()=>{ if(isHost){ SFX.ok(); resetClientRound(); lastTaskKey=''; lastDockKey=''; act({t:'reset'}); } };
  $('#inp-code').addEventListener('keydown', e=>{ if(e.key==='Enter') $('#btn-join').click(); });
  $('#inp-name').addEventListener('input', e=>{ $('#name-count').textContent=e.target.value.length; });
  $('#j-ok').onclick = ()=>{ hide($('#jump')); SFX.click(); };
  $('#pch-fab').onclick = ()=>{ SFX.click(); openWhisperList(); };
}