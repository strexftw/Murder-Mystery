/* ══════════════════════════════════════════════════════════════
   PROTOCOLLO OMBRA — js/client.js
   Rendering lato client: lobby, regole, reveal, gioco, chat,
   banner, task card, dock, riunioni, séance, fine partita.
   Dipendenze: config.js, utils.js, audio.js, state.js.
   ══════════════════════════════════════════════════════════════ */

/* ═══ DISPATCHER MESSAGGI ═══ */
function onMsg(m){
  if(!m || !m.k) return;
  if(m.k === 'pub'){ clockOff = m.now - Date.now(); PUB = m; onPub(); }
  else if(m.k === 'priv'){ if(m.to && m.to !== I.id) return; onPriv(m); }
  else if(m.k === 'act'){ if(isHost) hostAct(m); }
}

/* ═══ CHIUDI I MODALI D'AZIONE ═══ */
function closeActionModals(){
  ['m-task','m-scan','m-kill','m-sab','m-ab','m-invite'].forEach(id => hide($('#'+id)));
}

/* ═══ RESET DEL ROUND LATO CLIENT ═══ */
function resetClientRound(){
  SEC = {}; SYNC = {};
  SCANLIST = []; SCANCLUES = [];
  CHATS = {}; activeChat = null;
  hideChatPanel();
  document.body.classList.remove('deadmode');
  endPlayed = false;
  myAlivePrev = true; myQPrev = false;
  myCoopState = null;
  sentW = 0; sentV = 0; sentSeanceVote = 0;
  const br = $('#btn-ready'); if(br) br.disabled = false;
  const bo = $('#btn-rules-ok');
  if(bo){ bo.disabled = false; bo.textContent = '✓ HO LETTO E HO CAPITO'; }
}

/* ═══ GESTORE MESSAGGI PRIVATI ═══ */
function onPriv(m){
  switch(m.type){
    case 'init':
      SEC = { role:m.role, word:m.word, code:m.code };
      SYNC = {};
      SCANLIST = []; SCANCLUES = [];
      CHATS = {}; activeChat = null; hideChatPanel();
      myAlivePrev = true; myQPrev = false;
      const br = $('#btn-ready'); if(br) br.disabled = false;
      SFX.reveal();
      break;
    case 'init2':
      SEC.role = 'detective';
      SCANLIST = []; SCANCLUES = [];
      banner('SEI IL NUOVO DETECTIVE', 'amber');
      SFX.reveal();
      break;
    case 'puttanaPromo':
      banner('💋 SEI STATO PROMOSSO: LA PUTTANA', 'pink');
      SFX.reveal();
      break;
    case 'seanceMedium':
      banner('🕯 SEI IL MEDIO: il pulsante SÉANCE è apparso SOLO a te', 'violet', 6000);
      SFX.seance();
      break;
    case 'seanceVote':
      showSeanceVote(m.target, m.endsAt);
      break;
    case 'sync':
      SYNC = m;
      break;
    case 'fx':
      if(m.fx==='jump'){ closeActionModals(); doJump(m.letter, m.by); }
      if(m.fx==='hack') doHack();
      break;
    case 'found':
      showFound(m.ab, m.old || null);
      break;
    case 'critAlert':
      banner('🚨 TASK CRITICA: 30 SECONDI!', 'red', 4000);
      SFX.crit();
      break;
    case 'coopInvite':
      showCoopInvite(m);
      break;
    case 'coopStart':
      myCoopState = m;
      hide($('#m-invite'));
      banner('🤝 TASK DI COPPIA con '+m.partnerName+'!', 'cyan', 3000);
      SFX.coop();
      break;
    case 'whisperMsg':{
      const pid = m.from;
      if(!CHATS[pid]) CHATS[pid] = { name:m.fromName, msgs:[], unread:0 };
      CHATS[pid].msgs.push({ from:pid, text:m.text });
      if(activeChat===pid && isChatVisible()){ renderChatMsgs(); }
      else{
        CHATS[pid].unread++;
        if(CHATS[pid].msgs.length===1) banner('🤫 '+m.fromName+' TI SUSSURRA', 'cyan', 3000);
      }
      SFX.msg();
      updateFab();
      if(isChatVisible()) renderChatTabs();
      break;
    }
    case 'scanRes':{
      const ex = SCANLIST.find(e => e.id === m.id);
      if(ex){ ex.code=m.code; ex.tasks=m.tasks; ex.n=(ex.n||1)+1; SCANLIST.splice(SCANLIST.indexOf(ex),1); SCANLIST.push(ex); }
      else{ SCANLIST.push({id:m.id, name:m.target, code:m.code, tasks:m.tasks, n:1}); }
      showScanRes(m);
      renderArchive();
      break;
    }
    case 'scanFail':
      hide($('#m-scan'));
      banner('SCANSIONE ANNULLATA', 'amber');
      SFX.err();
      break;
    case 'clue':
      SCANCLUES.push({char:m.char, pos:m.pos});
      banner('🕵 INDIZIO HACK: cifra "'+m.char+'" in posizione '+m.pos, 'amber');
      SFX.reveal();
      renderArchive();
      break;
    case 'note':
      banner(m.txt, 'cyan', 5000);
      break;
  }
}

/* ═══ GESTORE STATO PUBBLICO ═══ */
function onPub(){
  const p = PUB;
  if(!p) return;
  if(p.banner && p.banner.at !== seenBanner){
    seenBanner = p.banner.at;
    banner(p.banner.txt, p.banner.tone);
  }
  if(p.reveal && p.reveal.at !== seenReveal){
    seenReveal = p.reveal.at;
    const r = p.reveal;
    banner(r.name+' ERA '+(r.role==='assassino'?"L'ASSASSINO":r.role==='detective'?'IL DETECTIVE':'INNOCENTE'),
      r.role==='assassino' ? 'red' : r.role==='detective' ? 'amber' : 'cyan');
    SFX.reveal();
  }
  $('#topbar').classList.toggle('on', p.phase !== 'lobby');
  $('#g-room').textContent = p.code;

  const scrMap = {lobby:'scr-lobby', rules:'scr-rules', reveal:'scr-reveal', play:'scr-game', ended:'scr-end'};
  let target = scrMap[p.phase];
  if(p.phase==='ended' && p.reveal && (Date.now()+clockOff)-p.reveal.at < 3300){
    target = curScr==='scr-end' ? 'scr-game' : curScr;
    setTimeout(()=>{ if(PUB && PUB.phase==='ended') showScreen('scr-end'); }, 3400);
  }
  showScreen(target);

  if(p.phase==='lobby'){ resetClientRound(); renderLobby(); }
  if(p.phase==='rules') renderRules();
  if(p.phase==='reveal') renderReveal();
  if(p.phase==='play'){ renderGame(); renderMeet(); }
  if(p.phase==='ended'){
    ['m-meet','m-scan','m-kill','m-sab','m-ab','m-task','m-invite'].forEach(id=>hide($('#'+id)));
    hideChatPanel();
    $('#pch-fab').classList.add('hidden');
    document.body.classList.remove('deadmode');
    meetKey = '';
    renderEnd();
  }
}

/* ═══ CAMBIO SCHERMATA ═══ */
function showScreen(id){
  if(curScr === id) return;
  curScr = id;
  if(id !== 'scr-game'){
    ['m-scan','m-kill','m-sab','m-ab','m-task','m-meet','m-invite'].forEach(mid=>hide($('#'+mid)));
  }
  $$('.scr').forEach(s => s.classList.remove('on'));
  $('#'+id).classList.add('on');
  if(id === 'scr-game') buildDock();
}

/* ═══ BANNER ═══ */
let bannerTimer = null;
function banner(txt, tone, dur){
  const b = $('#banner');
  b.className = tone || 'cyan';
  b.querySelector('span').textContent = txt;
  show(b);
  SFX.alarm();
  if(bannerTimer) clearTimeout(bannerTimer);
  bannerTimer = setTimeout(()=>hide(b), dur || 3200);
}
// alias usato in network.js
function showBanner(txt, tone){ banner(txt, tone); }

/* ═══ ABILITÀ TROVATA (con fuochi) ═══ */
let foundTimer = null, foundLock = false;
function showFound(ab, oldAb){
  const a = ABS[ab];
  if(!a) return;
  $('#found-name').textContent = a.n;
  $('#found-name').style.color = a.c;
  $('#found-name').style.textShadow = '0 0 34px '+a.c;
  $('#found-desc').textContent = a.d;
  const fw = $('#fw');
  fw.innerHTML = '';
  const cols = [a.c,'#38e1ff','#ffb648','#ff3b5c','#3dffa0','#ffffff'];
  for(let i=0;i<40;i++){
    const s = document.createElement('i');
    s.style.setProperty('--x', (8+rnd(84))+'%');
    s.style.setProperty('--y', (8+rnd(84))+'%');
    s.style.setProperty('--dx', (rnd(260)-130)+'px');
    s.style.setProperty('--dy', (rnd(260)-130)+'px');
    s.style.setProperty('--c', pick(cols));
    s.style.animationDelay = (rnd(70)/100)+'s';
    fw.appendChild(s);
  }
  const ch = $('#found-choice');
  if(oldAb && ABS[oldAb]){
    foundLock = true;
    $('#found-title').textContent = '🎉 HAI TROVATO UN\'ABILITÀ — MA NE HAI GIÀ UNA!';
    ch.classList.remove('hidden');
    $('#found-old').innerHTML = '<b style="color:'+ABS[oldAb].c+'">'+ABS[oldAb].n+'</b><br><span style="font-size:.9rem">'+ABS[oldAb].d+'</span>';
    $('#found-keep').textContent = '✓ TENGO: '+ABS[oldAb].n;
    $('#found-swap').textContent = '⟳ SOSTITUISCO CON: '+a.n;
    $('#found-keep').onclick = ()=>{ hide($('#found')); foundLock=false; SFX.click(); act({t:'abChoice', pick:'keep'}); };
    $('#found-swap').onclick = ()=>{ hide($('#found')); foundLock=false; SFX.ok(); act({t:'abChoice', pick:'swap'}); };
    $('#found-hint').textContent = 'SCEGLI CON ATTENZIONE: MAX 1 ABILITÀ';
    if(foundTimer) clearTimeout(foundTimer);
  } else {
    foundLock = false;
    $('#found-title').textContent = '🎉 CONGRATULAZIONI · HAI TROVATO';
    ch.classList.add('hidden');
    $('#found-hint').textContent = 'TOCCA PER CHIUDERE';
    if(foundTimer) clearTimeout(foundTimer);
    foundTimer = setTimeout(()=>hide($('#found')), 4500);
  }
  show($('#found'));
  SFX.found();
}

/* ═══ INVITO TASK DI COPPIA ═══ */
function showCoopInvite(m){
  const B = $('#invite-body');
  B.innerHTML = '<h2 class="mt" style="color:var(--grn)">🤝 INVITO TASK DI COPPIA</h2>'+
    '<p class="sub"><b>'+esc(m.fromName)+'</b> ti invita a fare una <b>task di coppia</b>.<br>Accetti? (hai 20 secondi)</p>'+
    '<div style="display:flex;gap:12px;justify-content:center">'+
    '<button class="btn grn" id="inv-yes">✓ ACCETTA</button>'+
    '<button class="btn red" id="inv-no">✗ RIFIUTA</button></div>';
  $('#inv-yes').onclick = ()=>{ SFX.ok(); act({t:'coopAccept', inviteId:m.inviteId, accept:true}); hide($('#m-invite')); };
  $('#inv-no').onclick  = ()=>{ SFX.err(); act({t:'coopAccept', inviteId:m.inviteId, accept:false}); hide($('#m-invite')); };
  show($('#m-invite'));
  SFX.coop();
}

/* ═══ RENDER LOBBY ═══ */
function renderLobby(){
  const data = PUB || (G ? {players: G.players.map(p=>({id:p.id,name:p.name,alive:p.alive,tasks:p.tasks,task:p.task,nextAt:0}))} : null);
  if(!data) return;
  $('#lobby-code').textContent = ROOM.split('').join(' ');
  const n = data.players.length;
  $('#lobby-count').textContent = n+'/'+CFG.MAX;
  let h = '';
  for(let i=0;i<CFG.MAX;i++){
    const p = data.players[i];
    h += p
      ? '<div class="slot fill cut"><span class="nm">'+esc(p.name)+(p.id===I.id?' ◂':'')+'</span><span class="dim" style="font-size:.7rem">OPERATORE</span></div>'
      : '<div class="slot cut">SLOT LIBERO</div>';
  }
  $('#slots').innerHTML = h;
  const can = isHost && n>=CFG.MIN && n<=CFG.MAX;
  $('#btn-start').style.display = isHost ? '' : 'none';
  $('#btn-start').disabled = !can;

  // ★ SALA D'ATTESA: se sei in attesa (non in partita), mostra il messaggio d'attesa
  const inGame = PUB && PUB.players.some(x => x.id === I.id);
  if(PUB && PUB.phase!=='lobby' && !inGame){
    $('#lobby-wait').textContent = '🕒 Sei in SALA D\'ATTESA: entrerai alla prossima partita.';
    return;
  }
  $('#lobby-wait').textContent = isHost
    ? (n<CFG.MIN ? 'Servono almeno '+CFG.MIN+' giocatori per iniziare.' : 'Pronto al lancio.')
    : 'In attesa che l\'host avvii la partita…';
}

/* ═══ RENDER REGOLE ═══ */
function renderRules(){
  if(!PUB) return;
  const ok = PUB.players.filter(p=>p.rulesOk).length;
  $('#rules-status').textContent = 'Operatori pronti: '+ok+'/'+PUB.players.length;
  $('#btn-rules-ok').disabled = !!SEC._ok;
  $('#btn-rules-ok').textContent = SEC._ok ? '✓ IN ATTESA DEGLI ALTRI…' : '✓ HO LETTO E HO CAPITO';
}

/* ═══ RENDER REVEAL (RUOLO) ═══ */
function renderReveal(){
  if(!SEC.role) return;
  const r = ROLE[SEC.role];
  $('#role-card').className = 'rolecard cut panel '+SEC.role;
  $('#role-name').textContent = r.l;
  $('#role-name').style.color = r.c;
  $('#role-desc').textContent = SEC.role==='assassino'
    ? 'Il SABOTAGGIO CODICI si sblocca dopo 30s (riuso 60s, resiste a 2 scan). UCCISIONE dopo 50s, ricarica 45s. La vittima vede una lettera casuale del tuo nome. NON conosci la parola segreta. Hai 2 SUSSURRI.'
    : SEC.role==='detective'
    ? 'SCAN dopo 20s: 3 cariche (+1 ogni 2,5 min), ricarica 20s. Se leggi un codice = assassino → QUARANTENA, poi verifica. Hai 2 SUSSURRI.'
    : 'Completa le task (una ogni 50s): possono essere SINGOLE, DI COPPIA o CRITICHE (6%). Puoi trovare ABILITÀ CASUALI. Hai 2 SUSSURRI.';
  $('#role-word').textContent = SEC.word || '??? — SCONOSCIUTA';
  $('#role-word').style.color = SEC.word ? 'var(--grn)' : 'var(--red)';
  $('#role-code').textContent = SEC.code;
}

/* ═══ RENDER GIOCO ═══ */
function renderGame(){
  if(!PUB) return;
  const me = PUB.players.find(p => p.id === I.id);
  if(!me) return;

  // Alla morte, chiudi i modali e attiva la deadmode
  if(me.alive !== myAlivePrev){
    closeActionModals();
    if(!me.alive) hideChatPanel();
  }
  myAlivePrev = me.alive;
  document.body.classList.toggle('deadmode', PUB.phase==='play' && !me.alive);
  if(me.q !== myQPrev){ if(me.q) closeActionModals(); myQPrev = me.q; }

  $('#g-alive').textContent = PUB.players.filter(p=>p.alive).length+'/'+PUB.players.length;
  $('#g-name').textContent = I.name;
  const chip = $('#chip-role');
  if(me.alive && SEC.role){
    chip.textContent = ROLE[SEC.role].l + (SYNC.isP ? ' · PUTTANA' : '') + (me.q ? ' · QUARANTENA' : '');
    if(me.q){ chip.style.color='var(--red)'; chip.style.borderColor='var(--red)'; }
    else{ chip.style.color=ROLE[SEC.role].c; chip.style.borderColor=ROLE[SEC.role].c; }
  } else {
    chip.textContent='SPETTRO';
    chip.style.color='var(--vio)'; chip.style.borderColor='var(--vio)';
  }
  $('#g-code').textContent = SEC.code || '—';
  const mw = $('#g-mask-wrap');
  if(SEC.role==='assassino' && SYNC.mask){
    mw.classList.remove('hidden');
    $('#g-mask').textContent = SYNC.mask;
  } else {
    mw.classList.add('hidden');
  }
  updateWord();
  renderAbList(me);
  renderArchive();

  const prog = PUB.taskProg||0, tgt = PUB.taskTarget||1;
  $('#station-bar').style.width = Math.min(100, prog/tgt*100)+'%';
  $('#station-txt').textContent = prog+'/'+tgt;

  const sl = $('#seance-line');
  const se = PUB.seance;
  if(se){
    sl.classList.remove('hidden');
    if(se.state==='charge')          sl.innerHTML='🕯 SÉANCE: '+se.cur+'/'+se.need+' (rituali degli spettri)';
    else if(se.state==='ready')      sl.innerHTML='🕯 SÉANCE: <b>PRONTA</b> — il Medio è stato scelto in segreto';
    else                             sl.innerHTML='🕯 GLI SPIRITI SI CONSULTANO SU <b>'+esc(se.target||'…')+'</b>…';
  } else sl.classList.add('hidden');

  const dockKey = (me.alive?'1':'0')+'|'+(SEC.role||'')+'|'+(SYNC.ab||'')+'|'+(SYNC.deadBy||'')+'|'+(SYNC.isP?'P':'')+'|'+(SYNC.med?'M':'');
  if(dockKey !== lastDockKey){ lastDockKey = dockKey; buildDock(); }

  const key = me.task+'|'+me.alive+'|'+(me.q?'q':'');
  if(key !== lastTaskKey){ lastTaskKey = key; buildTaskCard(me); }

  $('#g-taskcount').textContent = me.tasks+' ✓';
  $('#log').innerHTML = PUB.log.map(l =>
    '<div class="lg"'+(l.col?' style="color:'+l.col+'"':'')+'><span class="mono dim">'+
    new Date(l.ts).toLocaleTimeString('it-IT',{hour12:false})+'</span>'+esc(l.t)+'</div>').join('');
  updateDock();
  updateFab();
}

/* ═══ LISTA ABILITÀ ═══ */
function renderAbList(me){
  const box = $('#ab-list');
  if(!box) return;
  const held = SYNC.ab, used = SYNC.used || [];
  if(!held && !used.length && !SYNC.isP){ box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  const now = Date.now()+clockOff;
  let h = '<div class="sysline grn">POTERI PRIVATI</div>';
  if(SYNC.isP){
    const st = (SYNC.put||0)>now ? 'CD '+fmt((SYNC.put||0)-now) : 'PRONTA';
    h += '<div class="lg"><b style="color:'+ABS.puttana.c+'">LA PUTTANA</b> <span class="cyn mono" style="font-size:.65rem">PROMOZIONE · '+st+
         '</span><br><span class="dim" style="font-size:.75rem">'+ABS.puttana.d+'</span></div>';
  }
  if(held){
    let st;
    if(held==='gesu')       st='PASSIVA PRONTA / ATTIVA';
    else if(held==='merde') st=(SYNC.deadBy==='vote')?'ATTIVABILE ORA':'PASSIVA / ATTIVA';
    else                    st='PRONTA';
    h += '<div class="lg"><b style="color:'+ABS[held].c+'">'+ABS[held].n+'</b> <span class="cyn mono" style="font-size:.65rem">'+st+
         '</span><br><span class="dim" style="font-size:.75rem">'+ABS[held].d+'</span></div>';
  } else if(!SYNC.isP){
    h += '<div class="lg dim">Nessuna abilità in possesso: completa task per trovarne una.</div>';
  }
  if(used.length) h += '<div class="lg dim" style="font-size:.7rem">Già usate: '+used.map(u=>ABS[u]?ABS[u].n:u).join(', ')+'</div>';
  box.innerHTML = h;
}

/* ═══ ARCHIVIO SCANSIONI ═══ */
function renderArchive(){
  const box = $('#scan-archive');
  if(!box) return;
  if(SEC.role!=='detective'){ box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  const now = Date.now()+clockOff;
  const chg = SYNC.chg||0;
  let ch = '<div class="lg" style="border:0;padding:4px 0"><span class="amb mono">⚡ CARICHE: '+chg+'/'+CFG.SCAN_MAX+'</span>';
  if(chg<CFG.SCAN_MAX) ch += ' <span class="dim" style="font-size:.7rem">· +1 tra '+fmt((SYNC.chgAt||now)-now)+'</span>';
  ch += '</div>';
  $('#scancharges').innerHTML = ch;
  const q = (PUB && PUB.players) ? PUB.players.filter(p=>p.q) : [];
  $('#scanquar').innerHTML = q.map(p=>'<div class="lg red">⛔ '+esc(p.name)+' IN QUARANTENA: scansionalo per VERIFICARLO.</div>').join('');
  $('#scanlist').innerHTML = SCANLIST.length
    ? SCANLIST.map((e,i)=>'<div class="lg"><span class="mono dim">'+String(i+1).padStart(2,'0')+'</span><b>'+esc(e.name)+
        ((e.n||1)>1?' <span class="dim mono" style="font-size:.65rem">×'+e.n+'</span>':'')+
        '</b> → <span class="cyn mono">'+esc(e.code)+'</span> <span class="dim">('+e.tasks+' task)</span></div>').join('')
    : '<div class="lg dim">Nessuna scansione effettuata.</div>';
  $('#scanclues').innerHTML = SCANCLUES.map(c=>'<div class="lg amb">🕵 INDIZIO HACK: cifra "<b>'+esc(c.char)+
    '</b>" in posizione '+c.pos+' del codice assassino</div>').join('');
}

/* ═══ PAROLA SEGRETA ═══ */
let wordHidden = false;
function updateWord(){
  const w = $('#g-word');
  if(!SEC.word){ w.textContent='??? — SCONOSCIUTA'; w.style.color='var(--red)'; return; }
  w.textContent = wordHidden ? '••••••' : SEC.word;
  w.style.color = 'var(--grn)';
}

/* ═══ TASK CARD ═══ */
function buildTaskCard(me){
  const tc = $('#task-card');
  // ── SPETTRO (morto) → task spettro per la séance ──
  if(!me.alive){
    let dh = '<div class="deadnote">☠ SPETTRO — completa i RITUALI per la SÉANCE</div>';
    if(SYNC.ab==='merde' && SYNC.deadBy==='vote'){
      const c = ABS.merde.c;
      dh += '<button class="btn big" id="db-abmer" style="margin-top:12px;color:'+c+';border-color:'+c+'">🔥 SONO TORNATO MERDE</button>';
    }
    if(me.task && GNAME[me.task]){
      dh += '<div class="taskcard cut" style="margin-top:12px"><h3>▸ '+GNAME[me.task]+'</h3><p class="dim">'+GDESC[me.task]+
            '</p><button class="btn" id="btn-task" style="margin-top:12px">COMPII IL RITUALE</button></div>';
    } else {
      dh += '<div class="taskcard cut dim" style="margin-top:12px">In attesa della prossima task spettro…</div>';
    }
    tc.innerHTML = dh;
    const bm = $('#db-abmer'); if(bm) bm.onclick = ()=>{ SFX.click(); act({t:'abMerde'}); };
    const bt = $('#btn-task'); if(bt) bt.onclick = ()=>openTask(me.task);
    return;
  }
  // ── QUARANTENA ──
  if(me.q){
    tc.innerHTML = '<div class="deadnote">⛔ IN QUARANTENA — task e abilità sospese<br><span style="font-size:.7rem">in attesa di verifica del Detective</span></div>';
    return;
  }
  // ── TASK DI COPPIA ──
  if(me.task && typeof me.task==='object' && me.task.type==='coop'){
    const cn = COOPNAMES[me.task.id] || 'TASK DI COPPIA';
    let inner = '<div class="taskcard cut"><h3 style="color:var(--grn)">🤝 '+cn+'</h3><p class="dim">'+(COOPDESC[me.task.id]||'')+'</p>';
    if(me.task.coopState==='inviting') inner += '<p class="dim" style="margin-top:8px">⏳ In attesa che il compagno accetti…</p>';
    else if(me.task.coopState==='active') inner += '<button class="btn grn" id="btn-task" style="margin-top:12px">APRI TASK DI COPPIA</button>';
    inner += '</div>';
    tc.innerHTML = inner;
    const bt = $('#btn-task'); if(bt) bt.onclick = ()=>openCoopGame();
    return;
  }
  // ── TASK SINGOLA (normale o critica) ──
  if(me.task && typeof me.task==='object'){
    const tid = me.task.id;
    const def = TASKS.find(t=>t.id===tid);
    const isCrit = me.task.critical;
    let timerHtml = '';
    if(isCrit){
      const rem = Math.max(0, me.task.criticalAt - (Date.now()+clockOff));
      timerHtml = '<div class="crit-timer">⏱ '+fmt(rem)+'</div>';
    }
    tc.innerHTML = '<div class="taskcard cut'+(isCrit?' critical':'')+'">'+
      '<h3>▸ '+(def?def.name:'TASK')+' <span class="badge '+(isCrit?'imp':'sing')+'">'+(isCrit?'IMPORTANTE':'SINGOLO')+'</span></h3>'+
      timerHtml+
      '<p class="dim">'+(def?def.desc:'')+'</p>'+
      '<button class="btn" id="btn-task" style="margin-top:12px">SVOLGI TASK</button></div>';
    const bt = $('#btn-task'); if(bt) bt.onclick = ()=>openTask(tid);
    return;
  }
  // ── NESSUNA TASK ──
  tc.innerHTML = '<div class="taskcard cut dim">Nessuna task attiva.<br>Prossima assegnazione tra <b class="cyn" id="nextin">--:--</b></div>';
}

/* ═══ DOCK (pulsanti azione) ═══ */
function dockBtn(k, l, cls, color, ring){
  const st = color ? ' style="color:'+color+';border-color:'+color+';background:linear-gradient(180deg,'+rgba(color,.16)+','+rgba(color,.04)+')"' : '';
  return '<button class="dbtn '+(cls||'')+'"'+st+' id="db-'+k+'">'+
    (ring ? '<svg class="ring" viewBox="0 0 60 60"><circle cx="30" cy="30" r="26" id="killring"/></svg>' : '')+
    '<span class="lbl">'+l+'</span><span class="sec mono"></span></button>';
}
function buildDock(){
  const d = $('#dock');
  const me = PUB && PUB.players.find(p => p.id === I.id);
  if(me && !me.alive){
    let dh = '<div class="deadnote">☠ SEI STATO ELIMINATO — MODALITÀ SPETTATORE</div>';
    if(SYNC.ab==='merde' && SYNC.deadBy==='vote'){
      const c = ABS.merde.c;
      dh += '<button class="btn big" id="db-abmer" style="margin-top:12px;color:'+c+';border-color:'+c+'">🔥 SONO TORNATO MERDE</button>';
    }
    d.innerHTML = dh;
    const bm = $('#db-abmer'); if(bm) bm.onclick = ()=>{ SFX.click(); act({t:'abMerde'}); };
    return;
  }
  let h = dockBtn('word','RIUNIONE PAROLA') + dockBtn('vote','RIUNIONE VOTO') + dockBtn('whis','SUSSURRI');
  if(SYNC.med) h += dockBtn('seance','SÉANCE','',VIO);
  if(SEC.role==='detective') h += dockBtn('scan','SCANSIONA','amb');
  if(SEC.role==='assassino') h += dockBtn('sab','SABOTAGGIO','red') + dockBtn('kill','ELIMINA','red','',true);
  const held = SYNC.ab;
  if(held==='spalmatore') h += dockBtn('absp','SPALMATORE','',ABS.spalmatore.c);
  if(held==='puttana')    h += dockBtn('abput','PUTTANA','',ABS.puttana.c);
  if(held==='sparlatore') h += dockBtn('abspa','SPARLATORE','',ABS.sparlatore.c);
  if(held==='gesu')       h += dockBtn('abgres','GESÙ: RESUSCITA','',ABS.gesu.c);
  if(held==='merde')      h += dockBtn('abmres','MERDE: RESUSCITA','',ABS.merde.c);
  d.innerHTML = h;
  wireDockBasic();
  if($('#db-seance')) $('#db-seance').onclick = ()=>{ SFX.click(); openAb('seance'); };
  if($('#db-scan'))   $('#db-scan').onclick   = ()=>{ SFX.click(); openScan(); };
  if($('#db-sab'))    $('#db-sab').onclick    = ()=>{ SFX.click(); openSab(); };
  if($('#db-kill'))   $('#db-kill').onclick   = ()=>{ SFX.click(); openKill(); };
  if($('#db-absp'))   $('#db-absp').onclick   = ()=>{ SFX.click(); openAb('spalmatore'); };
  if($('#db-abput'))  $('#db-abput').onclick  = ()=>{ SFX.click(); openAb('puttana'); };
  if($('#db-abspa'))  $('#db-abspa').onclick  = ()=>{ SFX.click(); openAb('sparlatore'); };
  if($('#db-abgres')) $('#db-abgres').onclick = ()=>{ SFX.click(); openAb('gesu'); };
  if($('#db-abmres')) $('#db-abmres').onclick = ()=>{ SFX.click(); openAb('merde'); };
}
function wireDockBasic(){
  $('#db-word').onclick = ()=>{ SFX.click(); act({t:'meet', kind:'word'}); };
  $('#db-vote').onclick = ()=>{ SFX.click(); act({t:'meet', kind:'vote'}); };
  $('#db-whis').onclick = ()=>{ SFX.click(); openAb('whisper'); };
}

/* ═══ COOLDOWN PULSANTI ═══ */
function setCd(key, until, label, baseOk){
  const b = $('#db-'+key);
  if(!b) return;
  const now = Date.now()+clockOff, rem=(until||0)-now, s=b.querySelector('.sec');
  b.querySelector('.lbl').textContent = label;
  if(rem>0){ b.disabled=true; s.textContent=fmt(rem); }
  else{ b.disabled=!baseOk; s.textContent=baseOk?'PRONTO':'—'; }
}
function updateDock(){
  if(!PUB || PUB.phase!=='play') return;
  const me = PUB.players.find(p => p.id === I.id);
  if(!me || !me.alive) return;
  const now = Date.now()+clockOff, free = !PUB.meeting;
  setCd('word', SYNC.cdw, 'RIUNIONE PAROLA', free);
  setCd('vote', SYNC.cdv, 'RIUNIONE VOTO', free);
  const bw2 = $('#db-whis'); if(bw2) bw2.disabled = false;
  const bse = $('#db-seance'); if(bse) bse.disabled = !free;
  if(SEC.role==='detective'){
    const b = $('#db-scan');
    if(b){
      const rem=(SYNC.scan||0)-now, chg=SYNC.chg||0, s=b.querySelector('.sec');
      if(rem>0){ b.disabled=true; s.textContent=fmt(rem); }
      else if(chg<=0){ b.disabled=true; s.textContent='0 ⚡'; }
      else{ b.disabled=!free; s.textContent='⚡'+chg; }
    }
  }
  if(SEC.role==='assassino'){
    setCd('sab', SYNC.sab, 'SABOTAGGIO', free);
    const b = $('#db-kill');
    if(b){
      const rem=(SYNC.kill||0)-now;
      b.disabled = rem>0 || !free;
      b.querySelector('.sec').textContent = rem>0 ? fmt(rem) : 'PRONTO';
      const span = Math.max(CFG.KILL_CD, CFG.FIRST_KILL);
      const prog = Math.max(0, Math.min(1, 1-rem/span));
      const r = $('#killring');
      if(r) r.style.strokeDashoffset = 163*(1-prog);
    }
  }
  setCd('abput', SYNC.put, 'PUTTANA', free);
  const bsp=$('#db-absp'); if(bsp) bsp.disabled=!free;
  const bspa=$('#db-abspa'); if(bspa) bspa.disabled=!free;
  const bg2=$('#db-abgres'); if(bg2) bg2.disabled=!free;
  const bm2=$('#db-abmres'); if(bm2) bm2.disabled=!free;
}

/* ═══ RIUNIONI ═══ */
function renderMeet(){
  if(!PUB) return;
  const m = PUB.meeting;
  const me = PUB.players.find(p => p.id === I.id);
  if(!m){ if(meetKey){ meetKey=''; hide($('#m-meet')); } return; }
  if(me && (!me.alive && m.stage===1)){ hide($('#m-meet')); return; }
  const key = m.kind + m.stage + m.endsAt;
  if(key !== meetKey){ meetKey = key; buildMeet(m); }
  const now = Date.now()+clockOff;
  const tot = m.stage===1 ? (m.kind==='word'?CFG.WORD_TIME:CFG.VOTE_TIME) : (m.kind==='word'?CFG.WORD_SHOW:CFG.VOTE_REVEAL);
  const bar = $('#meet-bar'); if(bar) bar.style.width = Math.max(0, Math.min(100,(m.endsAt-now)/tot*100))+'%';
  const tm = $('#meet-timer'); if(tm) tm.textContent = fmt(m.endsAt-now);
  const nn = $('#meet-n');
  if(nn){
    if(m.kind==='word') nn.textContent = m.n+'/'+m.tot+' parole';
    else if(m.stage===1) nn.textContent = m.n+'/'+m.tot+' voti';
  }
  const ww = $('#word-who');
  if(ww && m.kind==='word' && m.stage===1 && m.who){
    ww.innerHTML = PUB.players.filter(p=>p.alive).map(p=>
      m.who.indexOf(p.id)>=0
        ? '<span class="wchip ok">✓ '+esc(p.name)+'</span>'
        : '<span class="wchip pend">⏳ '+esc(p.name)+'</span>').join('');
  }
  const cd = $('#meet-count'); if(cd) cd.textContent = Math.max(0, Math.ceil((m.endsAt-now)/1000));
}
function buildMeet(m){
  show($('#m-meet'));
  SFX.meet();
  const B = $('#meet-body');
  if(m.kind==='word'){
    if(m.stage===1){
      B.innerHTML = '<h2 class="mt cyn">RIUNIONE PAROLA</h2><p class="sub">Indetta da <b>'+esc(m.byName)+
        '</b> · Scrivi UNA parola collegata all\'argomento segreto.</p>'+
        '<div id="wform" style="display:flex;gap:10px"><input class="inp" id="w-in" maxlength="24" placeholder="La tua parola…" autocomplete="off">'+
        '<button class="btn" id="w-send">INVIA</button></div>'+
        '<div class="wordwall" id="word-who" style="margin-top:14px"></div>'+
        '<div class="meet-meta mono"><span id="meet-n"></span><span id="meet-timer"></span></div><div class="bar"><i id="meet-bar"></i></div>';
      const sendW = ()=>{
        const v = $('#w-in').value.trim();
        if(!v) return;
        SFX.ok();
        act({t:'word', text:v});
        $('#wform').outerHTML = '<div class="okbig">✓ PAROLA INVIATA — IN ATTESA DEGLI ALTRI</div>';
        sentW = m.endsAt;
      };
      $('#w-send').onclick = sendW;
      $('#w-in').onkeydown = e=>{ if(e.key==='Enter') sendW(); };
      if(sentW===m.endsAt) $('#wform').outerHTML = '<div class="okbig">✓ PAROLA INVIATA — IN ATTESA DEGLI ALTRI</div>';
    } else {
      B.innerHTML = '<h2 class="mt cyn">PAROLE RIVELATE</h2><p class="sub">Ogni parola è firmata dal suo autore: chi sta bluffando?</p>'+
        '<div class="wordwall">'+(m.words||[]).map(w=>'<span class="wchip"><b>'+esc(w.name)+':</b> '+esc(w.word)+'</span>').join('')+'</div>'+
        '<div class="meet-meta mono"><span>Finestra di analisi</span><span id="meet-timer"></span></div><div class="bar"><i id="meet-bar"></i></div>';
    }
  } else {
    if(m.stage===1){
      const alive = PUB.players.filter(p=>p.alive && p.id!==I.id);
      B.innerHTML = '<h2 class="mt red">VOTAZIONE DI ESPULSIONE</h2><p class="sub">Indetta da <b>'+esc(m.byName)+
        '</b> · La maggioranza decide chi eliminare.</p><div class="vlist">'+
        alive.map(p=>'<button class="vbtn" data-id="'+p.id+'">⬡ '+esc(p.name)+(p.q?' ⛔':'')+'</button>').join('')+
        '<button class="vbtn skip" data-id="skip">SALTA VOTO</button></div>'+
        '<div class="meet-meta mono"><span id="meet-n"></span><span id="meet-timer"></span></div><div class="bar red"><i id="meet-bar"></i></div>';
      $$('#meet-body .vbtn').forEach(b=>b.onclick=()=>{
        if(sentV===m.endsAt) return;
        sentV = m.endsAt;
        SFX.click();
        act({t:'vote', tgt:b.dataset.id});
        $$('#meet-body .vbtn').forEach(x=>x.classList.remove('pick'));
        b.classList.add('pick');
        const nn = $('#meet-n'); if(nn) nn.textContent='Voto inviato ✓';
      });
    } else {
      B.innerHTML = '<h2 class="mt red">VERDETTO IN ARRIVO</h2><p class="sub">Rivelazione del ruolo tra…</p>'+
        '<div class="bignum" id="meet-count">5</div>';
    }
  }
}

/* ═══ SÉANCE (voto spiriti) ═══ */
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

/* ═══ ESITO SCAN ═══ */
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
  $('#scan-body').innerHTML = inner+'<button class="btn wide" id="sc-ok">CHIUDI</button>';
  $('#sc-ok').onclick = ()=>hide($('#m-scan'));
}

/* ═══ SUSSURRI (chat p2p) ═══ */
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
  $('#pch-add').onclick = ()=>{ hideChatPanel(); SFX.click(); openAb('whisper'); };
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

/* ═══ JUMPSCARE / HACK ═══ */
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
function doHack(){
  SFX.hack();
  const h = $('#hack');
  show(h);
  if(hackTimer) clearTimeout(hackTimer);
  hackTimer = setTimeout(()=>hide(h), 2000);
}
// NOTE: "hackTimer" è dichiarato in js/ui.js (caricato dopo client.js).
// La duplicazione con "let" causava un ReferenceError fatale a caricamento
// ("Identifier 'hackTimer' has already been declared").

/* ═══ FINE PARTITA ═══ */
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