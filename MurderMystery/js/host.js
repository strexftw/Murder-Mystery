/* ══════════════════════════════════════════════════════════════
   PROTOCOLLO OMBRA — js/host.js
   Tutta la logica di gioco lato HOST.
   Dipendenze: config.js, utils.js, state.js, network.js (send/priv).
   ══════════════════════════════════════════════════════════════ */

/* ═══ REGISTRO EVENTI ═══ */
function addLog(t, col){
  G.log.push({ t, ts: Date.now(), col: col || null });
  if(G.log.length > 60) G.log.shift();
}

/* ═══ BROADCAST DELLO STATO PUBBLICO + SYNC PRIVATI ═══ */
function broadcastNow(){
  if(!isHost || !G) return;
  if(!chan){ setTimeout(()=>broadcastNow(), 500); return; }
  const now = Date.now();

  // Sync privati (uno per giocatore)
  G.players.forEach(p => {
    const o = { type:'sync', cdw:p.cdw, cdv:p.cdv, ab:p.ab, used:p.usedAbs,
      isP:p.isPuttana, put:p.puttanaReadyAt, deadBy:p.deadBy,
      med:(G.seanceState==='ready' && G.seanceMedium===p.id) };
    if(p.role==='assassino'){ o.kill=p.killReadyAt; o.sab=p.sabReadyAt; o.mask=G.spoof?G.spoof.code:null; }
    if(p.role==='detective'){ o.scan=p.scanReadyAt; o.chg=p.scanCharges; o.chgAt=p.scanNextChargeAt; }
    priv(p.id, o);
  });

  // Riunione (pubblica)
  let meeting = null;
  if(G.meeting){
    const mm = G.meeting, alive = G.players.filter(p=>p.alive).length;
    meeting = {
      kind:mm.kind, byName:mm.byName, stage:mm.stage, endsAt:mm.endsAt,
      n: mm.kind==='word' ? Object.keys(mm.words).length : Object.keys(mm.votes).length,
      tot: alive,
      who: mm.kind==='word' ? G.players.filter(p=>p.alive && mm.words[p.id]).map(p=>p.id) : null,
      words: (mm.stage===2 && mm.kind==='word')
        ? G.players.filter(p=>mm.words[p.id]).map(p=>({name:p.name, word:mm.words[p.id]})) : null
    };
  }

  const tgt = G.seanceState==='voting' ? byId(G.seanceTarget) : null;

  const pub = {
    k:'pub', now, phase:G.phase, code:ROOM, t0:G.t0,
    winner:G.winner, reveal:G.reveal, banner:G.banner,
    meeting, taskTarget:G.taskTarget, taskProg:taskProg(),
    seance:{ state:G.seanceState, cur:G.seanceCur, need:CFG.SEANCE_NEED, target:tgt?tgt.name:null },
    log: G.log.slice(-14),
    players: G.players.map(p=>({
      id:p.id, name:p.name, alive:p.alive, tasks:p.tasks, task:p.task,
      deadBy:p.deadBy, q:p.quarantined,
      nextAt: p.task ? 0 : p.lastTaskAt + CFG.TASK_EVERY
    })),
    coop: G.coopSessions, coopInvites: G.coopInvites,
    ended: G.phase==='ended'
      ? G.players.map(p=>({name:p.name, role:p.role, tasks:p.tasks, alive:p.alive, isPuttana:p.isPuttana})) : null
  };
  send(pub);
  PUB = pub;
  onPub();
}

/* ══════════════════════ PUTTANA ══════════════════════ */
function puttanaTick(now){
  if(!G.puttanaActive){
    if(G.players.some(p => p.alive && !p.quarantined && p.role==='innocente' && p.tasks>=CFG.PUTTANA_TRIGGER)){
      G.puttanaActive = true;
      G.puttanaTimerAt = now + CFG.PUTTANA_TIMER;
    }
  } else if(now >= G.puttanaTimerAt){
    G.puttanaTimerAt = now + CFG.PUTTANA_TIMER;
    evaluatePuttana();
  }
}
function evaluatePuttana(){
  const cur = G.players.find(p=>p.isPuttana);
  if(cur && (!cur.alive || cur.quarantined || cur.role!=='innocente')) cur.isPuttana = false;
  const cands = G.players.filter(p => p.alive && !p.quarantined && p.role==='innocente');
  if(!cands.length) return;
  const max = Math.max.apply(null, cands.map(p=>p.tasks));
  const tied = cands.filter(p => p.tasks === max);
  const winner = pick(tied);
  const holder = G.players.find(p=>p.isPuttana);
  if(holder && holder.id === winner.id) return;
  if(holder){ holder.isPuttana = false; addLog('💋 IL RUOLO DELLA PUTTANA È PASSATO DI MANO.', ABS.puttana.c); }
  winner.isPuttana = true;
  winner.puttanaReadyAt = Date.now();
  priv(winner.id, {type:'puttanaPromo'});
  addLog('💋 UN OPERATORE È STATO PROMOSSO A PUTTANA.', ABS.puttana.c);
}

/* ══════════════════════ SÉANCE ══════════════════════ */
function ensureMedium(){
  if(G.seanceState!=='ready') return;
  const m = byId(G.seanceMedium);
  if(m && m.alive && !m.quarantined && m.role==='innocente') return;
  G.seanceMedium = null;
  const cands = G.players.filter(p => p.alive && !p.quarantined && p.role==='innocente');
  if(cands.length){ G.seanceMedium = pick(cands).id; priv(G.seanceMedium, {type:'seanceMedium'}); }
}
function resolveSeance(){
  const t = byId(G.seanceTarget);
  const tname = t ? t.name : '?';
  const entries = Object.values(G.seanceVotes);
  const yes = entries.filter(v=>v).length, no = entries.length - yes;
  let msg;
  if(entries.length===0)      msg = '🕯 GLI SPIRITI TACCIONO su '+tname+'.';
  else if(yes===no)           msg = '🕯 GLI SPIRITI SONO DIVISI su '+tname+' ('+yes+'/'+no+').';
  else if(yes>no)             msg = '🕯 GLI SPIRITI: "SÌ, '+tname+' È L\'ASSASSINO" ('+yes+'/'+no+').';
  else                        msg = '🕯 GLI SPIRITI: "NO, '+tname+' NON È L\'ASSASSINO" ('+yes+'/'+no+').';
  addLog(msg, VIO);
  G.seanceState='charge'; G.seanceCur=0; G.seanceContrib=[];
  G.seanceMedium=null; G.seanceTarget=null; G.seanceVotes={}; G.seanceEndsAt=0;
  broadcastNow();
}

/* ══════════════════════ TASK DI COPPIA ══════════════════════ */
function coopTick(now){
  // Scadenza inviti coop
  for(const k in G.coopInvites){
    const inv = G.coopInvites[k];
    if(inv && now >= inv.expiresAt){
      delete G.coopInvites[k];
      advanceCoopPartner(inv.requester);
    }
  }
  // Sessioni coop attive (aggiornamento ponte energetico)
  for(const k in G.coopSessions){
    const s = G.coopSessions[k];
    if(!s || s.done) continue;
    const pa = byId(s.a), pb = byId(s.b);
    if(!pa || !pb || !pa.alive || !pb.alive){ delete G.coopSessions[k]; continue; }
    if(s.type==='ponte'){
      if(now >= s.endsAt){ s.done = true; coopComplete(s); }
      else if(s.energy <= 0){
        s.done = true; s.fail = true;
        addLog('💥 PONTE ENERGETICO FALLITO: la barra si è svuotata.', ABS.sparlatore.c);
        delete G.coopSessions[k];
      } else {
        s.energy = Math.max(0, s.energy - CFG.COOP_BRIDGE_DRAIN);
      }
    }
  }
}

/* ═══ TICK PRINCIPALE HOST ═══ */
function hostTick(){
  if(!isHost || !G) return;
  // Le riunioni scadono anche fuori dalla fase 'play' (es. revealed during ended)
  if(G.meeting && G.phase !== 'lobby') meetTick(Date.now());
  if(G.phase !== 'play') return;
  const now = Date.now();
  puttanaTick(now);
  coopTick(now);
  if(G.seanceState==='ready') ensureMedium();
  else if(G.seanceState==='voting' && now>=G.seanceEndsAt) resolveSeance();

  // Assegnazione task + scadenza task critiche (vivi) / rituali spettro (morti)
  G.players.forEach(p=>{
    if(!p.alive){
      cancelTask(p); // estingue eventuali residui coop della vita precedente
      if(p.task) return;
      if(now - p.lastTaskAt < CFG.TASK_EVERY) return;
      assignGhostTask(p, now);
      return;
    }
    if(p.quarantined) return;
    if(p.task && p.task.critical && now >= p.task.criticalAt){ killByStation(p); return; }
    if(p.task) return;
    if(now - p.lastTaskAt < CFG.TASK_EVERY) return;
    assignTask(p, now);
  });

  // Ricarica cariche detective
  G.players.forEach(p=>{
    if(p.role==='detective' && p.alive && now >= p.scanNextChargeAt){
      p.scanNextChargeAt = now + CFG.SCAN_RECHARGE;
      if(p.scanCharges < CFG.SCAN_MAX) p.scanCharges++;
    }
  });
}
setInterval(()=>hostTick(), 1000);

/* ═══ ASSEGNA UNA TASK (singola, critica o di coppia) ═══ */
function assignTask(p, now){
  const isCrit = Math.random() < CFG.CRIT_CHANCE;
  const base = pick(TASKS).id;
  if(isCrit){
    p.task = { id:base, type:'single', critical:true, criticalAt:now+CFG.CRIT_TIME, partner:null, coopState:null };
    addLog('🚨 '+p.name+' ha una TASK CRITICA: 30 secondi!', ABS.sparlatore.c);
    priv(p.id, {type:'critAlert'});
  } else if(Math.random() < CFG.COOP_CHANCE &&
            G.players.filter(q => q.alive && !q.quarantined && q.id!==p.id).length > 0){
    p.task = { id:base, type:'coop', critical:false, criticalAt:0, partner:null, coopState:'needInvite' };
    requestCoopInvite(p, now);
  } else {
    p.task = { id:base, type:'single', critical:false, criticalAt:0, partner:null, coopState:null };
  }
  p.lastTaskAt = now;
}

/* ═══ TASK SPETTRO (per i morti, alimentano la SÉANCE) ═══ */
function assignGhostTask(p, now){
  const base = pick(TASKS).id; // id in comune con GNAME/GDESC/GMAP
  p.task = { id:base, type:'ghost', critical:false, criticalAt:0, partner:null, coopState:null };
  p.lastTaskAt = now;
}
function seanceAddProgress(){
  G.seanceCur++;
  if(G.seanceState === 'charge' && G.seanceCur >= CFG.SEANCE_NEED){
    G.seanceState = 'ready';
    ensureMedium();
    G.banner = { txt:'🕯 LA SÉANCE È PRONTA — I MORTI HANNO FINITO I RITUALI', tone:'violet', at:Date.now() };
    addLog('🕯 La séance è pronta: il Medio può interrogare gli spiriti.', VIO);
  }
}
function ghostTaskDone(p){
  p.task = null;
  p.lastTaskAt = Date.now();
  seanceAddProgress();
  addLog('🕯 Uno spettro ha completato un rituale ('+G.seanceCur+'/'+CFG.SEANCE_NEED').', VIO);
}

/* ═══ ELIMINAZIONE DALLA STAZIONE (task critica scaduta) ═══ */
function killByStation(p){
  if(!p.alive) return;
  p.alive = false; p.deadBy = 'station'; cancelTask(p);
  priv(p.id, {type:'fx', fx:'jump', letter:'', by:'station'});
  addLog('🚨 LA STAZIONE HA ELIMINATO '+p.name+': TASK CRITICA SCADUTA.', ABS.sparlatore.c);
  if(p.role==='assassino'){ endGame('innocenti'); return; }
  checkWin();
  if(G.phase==='play' && p.role==='detective') promote();
  broadcastNow();
}

/* ═══ INVITO TASK DI COPPIA ═══ */
function requestCoopInvite(p, now){
  const candidates = G.players.filter(q => q.alive && !q.quarantined && q.id!==p.id && !q.task);
  if(!candidates.length){
    p.task = null;
    addLog('↫ Task di coppia annullata: nessun compagno disponibile.', ABS.sparlatore.c);
    priv(p.id, {type:'note', txt:'↫ Task di coppia annullata: nessun compagno disponibile.'});
    return;
  }
  const partner = pick(candidates);
  const invId = p.id + '_' + now;
  G.coopInvites[invId] = { requester:p.id, partner:partner.id, expiresAt:now+CFG.COOP_INVITE_TIME, base:p.task.id };
  p.task.partner = partner.id;
  p.task.coopState = 'inviting';
  p.task.inviteId = invId;
  priv(partner.id, {type:'coopInvite', from:p.id, fromName:p.name, inviteId:invId, base:p.task.id});
}
function advanceCoopPartner(requesterId){
  const p = byId(requesterId);
  if(!p || !p.task || p.task.type!=='coop') return;
  requestCoopInvite(p, Date.now());
}
function acceptCoopInvite(inviteId, accept){
  const inv = G.coopInvites[inviteId];
  if(!inv) return;
  delete G.coopInvites[inviteId];
  const requester = byId(inv.requester), partner = byId(inv.partner);
  if(!requester || !partner || !requester.task) return;
  if(!accept){
    addLog('↫ Invito coop rifiutato da '+partner.name+'.', ABS.sparlatore.c);
    advanceCoopPartner(requester.id);
    return;
  }
  const coopType = pick(COOP_TYPES);
  const sessId = inviteId;
  const state = { type:coopType, a:requester.id, b:partner.id, done:false, fail:false };
  if(coopType==='ponte'){ state.energy=60; state.endsAt=Date.now()+CFG.COOP_BRIDGE_TIME; }
  if(coopType==='codice'){
    const runes = []; for(let i=0;i<CFG.COOP_RUNES;i++) runes.push(pick(RUNE_CHARS));
    state.runes=runes; state.inputA=''; state.inputB=''; state.subA=false; state.subB=false;
  }
  if(coopType==='valvole'){
    state.valves=[];
    for(let i=0;i<CFG.COOP_VALVES;i++){
      const zoneStart = 20 + rnd(50);
      state.valves.push({zone:zoneStart, zoneH:18, pos:50, dir:1, aStopped:false, bStopped:false, aOk:false, bOk:false, done:false});
    }
  }
  G.coopSessions[sessId] = state;
  requester.task.partner = partner.id;
  requester.task.coopState = 'active';
  requester.task.coopSession = sessId;
  partner.task = { id:coopType, type:'coop', critical:false, criticalAt:0, partner:requester.id,
                   coopState:'active', coopSession:sessId, lastTaskAt:Date.now() };
  priv(requester.id, {type:'coopStart', session:sessId, type:coopType, partner:partner.id, partnerName:partner.name, state:state});
  priv(partner.id,  {type:'coopStart', session:sessId, type:coopType, partner:requester.id, partnerName:requester.name, state:state});
  addLog('🤝 TASK DI COPPIA avviata: '+COOPNAMES[coopType]+'.', ABS.puttana.c);
}
function coopComplete(s){
  const pa = byId(s.a), pb = byId(s.b);
  if(pa){ pa.tasks++; pa.task=null; pa.lastTaskAt=Date.now(); }
  if(pb){ pb.tasks++; pb.task=null; pb.lastTaskAt=Date.now(); }
  for(const k in G.coopSessions){ if(G.coopSessions[k]===s) delete G.coopSessions[k]; }
  addLog('🤝 TASK DI COPPIA completata da '+pa.name+' e '+pb.name+'!', ABS.puttana.c);
  if(pa.role!=='assassino' && taskProg()>=G.taskTarget){ addLog('🏆 INTEGRITÀ STAZIONE COMPLETA!'); endGame('innocenti'); }
  broadcastNow();
}
function HcoopTap(id){
  const p = byId(id);
  if(!p || !p.task || p.task.type!=='coop' || !p.task.coopSession) return;
  const s = G.coopSessions[p.task.coopSession];
  if(!s || s.done) return;
  if(s.type==='ponte'){ s.energy = Math.min(100, s.energy + CFG.COOP_TAP); broadcastNow(); }
}

/* ═══ ✅ CORRETTO: accetta la posizione della lancetta (pos) ═══ */
function HcoopValve(id, vidx, pos){
  const p = byId(id);
  if(!p || !p.task || p.task.type!=='coop' || !p.task.coopSession) return;
  const s = G.coopSessions[p.task.coopSession];
  if(!s || s.done || s.type!=='valvole') return;
  const v = s.valves[vidx];
  if(!v || v.done) return;
  const isA = (p.id === s.a);
  // Registra il fermo solo se non già fermato da questo giocatore
  if(isA){
    if(v.aStopped) return;
    v.aStopped = true;
    v.aOk = (pos >= v.zone && pos <= v.zone + v.zoneH);
  } else {
    if(v.bStopped) return;
    v.bStopped = true;
    v.bOk = (pos >= v.zone && pos <= v.zone + v.zoneH);
  }
  // Valvola completata solo se ENTRAMBI i giocatori l'hanno fermata in zona
  if(v.aStopped && v.bStopped && v.aOk && v.bOk) v.done = true;
  if(s.valves.every(v=>v.done)){ s.done = true; coopComplete(s); }
  broadcastNow();
}

function HcoopSubmitRunes(id, seq){
  const p = byId(id);
  if(!p || !p.task || p.task.type!=='coop' || !p.task.coopSession) return;
  const s = G.coopSessions[p.task.coopSession];
  if(!s || s.done || s.type!=='codice') return;
  const isA = (p.id === s.a);
  if(isA){ s.inputA=seq; s.subA=true; } else { s.inputB=seq; s.subB=true; }
  if(s.subA && s.subB){
    const target = s.runes.join('');
    if(s.inputA===target && s.inputB===target){ s.done=true; coopComplete(s); }
    else{
      s.done=true; s.fail=true;
      addLog('✗ CODICE INCROCIATO errato: la sequenza era '+target+'.', ABS.sparlatore.c);
      for(const k in G.coopSessions){ if(G.coopSessions[k]===s) delete G.coopSessions[k]; }
      if(byId(s.a)) byId(s.a).task = null;
      if(byId(s.b)) byId(s.b).task = null;
    }
  }
  broadcastNow();
}

/* ══════════════════════ AVVIAMENTO PARTITA ══════════════════════ */
function Hstart(){
  if(!G || G.phase!=='lobby' || G.players.length<CFG.MIN || G.players.length>CFG.MAX) return;
  G.word = pick(WORDS);
  G.players.forEach(p=>{ p.rulesOk=false; p.revealOk=false; });
  G.phase='rules';
  broadcastNow();
}
function HrulesOk(id){
  const p = byId(id);
  if(!p || G.phase!=='rules') return;
  p.rulesOk = true;
  if(G.players.every(x=>x.rulesOk)){
    const ids = shuffle(G.players.map(p=>p.id));
    G.players.forEach(p=>{
      p.role = p.id===ids[0] ? 'assassino' : p.id===ids[1] ? 'detective' : 'innocente';
      priv(p.id, {type:'init', role:p.role, word:p.role==='assassino'?null:G.word, code:p.code});
    });
    G.phase='reveal';
  }
  broadcastNow();
}
function HrevealOk(id){
  const p = byId(id);
  if(!p || G.phase!=='reveal') return;
  p.revealOk = true;
  if(G.players.every(x=>x.revealOk)) startPlay();
  broadcastNow();
}
function startPlay(){
  const now = Date.now();
  G.phase='play';
  G.t0 = now;
  G.puttanaActive=false; G.puttanaTimerAt=0;
  G.seanceState='charge'; G.seanceCur=0; G.seanceContrib=[];
  G.seanceMedium=null; G.seanceTarget=null; G.seanceVotes={}; G.seanceEndsAt=0;
  G.whisperLog={};
  G.coopSessions={}; G.coopInvites={};
  G.taskTarget = G.players.length * CFG.TASK_WIN_MULT;
  const a = G.players.find(p=>p.role==='assassino');
  const d = G.players.find(p=>p.role==='detective');
  a.sabReadyAt = now + CFG.SAB_UNLOCK;
  a.killReadyAt = now + CFG.FIRST_KILL;
  d.scanReadyAt = now + CFG.SCAN_UNLOCK;
  d.scanCharges = CFG.SCAN_MAX;
  d.scanNextChargeAt = now + CFG.SCAN_RECHARGE;
  G.players.forEach(p=>{ p.lastTaskAt=now; p.cdw=0; p.cdv=0; });
  addLog('Sistemi della stazione attivi. Buona fortuna, operatori.');
  broadcastNow();
}

/* ══════════════════════ ABILITÀ "GESÙ" ══════════════════════ */
function consumeGesu(t, src){
  if(!t || (src!=='kill' && src!=='spalm')) return false;
  if(t.ab!=='gesu') return false;
  t.usedAbs.push('gesu');
  t.ab = null;
  addLog('✝ GESÙ STA CON '+t.name+': L\'ELIMINAZIONE È STATA ANNULLATA!', ABS.gesu.c);
  return true;
}

/* ══════════════════════ UCCISIONI / SPALMATORE ══════════════════════ */
function Hkill(id, tid){
  const a = byId(id), t = byId(tid), now = Date.now();
  if(!a || a.role!=='assassino' || !a.alive || a.quarantined || !t || !t.alive ||
     t.id===a.id || G.phase!=='play' || G.meeting || now<a.killReadyAt) return;
  a.killReadyAt = now + CFG.KILL_CD;
  if(consumeGesu(t, 'kill')){
    priv(a.id, {type:'note', txt:'❌ KILL ANNULLATO: GESÙ STA CON '+t.name+'.'});
    broadcastNow(); return;
  }
  t.alive=false; t.deadBy='kill'; t.quarantined=false; cancelTask(t);
  priv(t.id, {type:'fx', fx:'jump', letter:randomLetter(a.name), by:'ass'});
  addLog('☠ '+t.name+' è stato eliminato.');
  checkWin();
  if(G.phase==='play' && t.role==='detective') promote();
  broadcastNow();
}
function Hspalm(id, tid){
  const p = byId(id), t = byId(tid), now = Date.now();
  if(!p || !p.alive || p.quarantined || p.ab!=='spalmatore' || G.phase!=='play' || G.meeting) return;
  if(!t || !t.alive || t.id===p.id) return;
  p.usedAbs.push('spalmatore');
  p.ab = null;
  if(consumeGesu(t, 'spalm')){ broadcastNow(); return; }
  t.alive=false; t.deadBy='spalm'; t.quarantined=false; cancelTask(t);
  if(t.role==='assassino'){
    addLog('🩸 LO SPALMATORE HA COLPITO NEL SEGNO: '+t.name+' ERA L\'ASSASSINO!', ABS.spalmatore.c);
    G.reveal = {name:t.name, role:'assassino', at:now};
    endGame('innocenti');
  } else {
    priv(t.id, {type:'fx', fx:'jump', letter:'', by:'spalm'});
    addLog('🩸 LO SPALMATORE PAZZO HA SPALMATO '+t.name+'!', ABS.spalmatore.c);
    checkWin();
    if(G.phase==='play' && t.role==='detective') promote();
  }
  broadcastNow();
}

/* ══════════════════════ RESURREZIONI ══════════════════════ */
function Hputt(id, tid){
  const p = byId(id), t = byId(tid), now = Date.now();
  if(!p || !p.alive || p.quarantined || !p.isPuttana || now<p.puttanaReadyAt || G.phase!=='play' || G.meeting) return;
  if(!t || t.alive || (t.deadBy!=='kill' && t.deadBy!=='spalm')) return;
  t.alive=true; t.deadBy=null;
  resurrectCleanup(t);
  p.puttanaReadyAt = now + CFG.PUTTANA_CD;
  addLog('✨ '+t.name+' È TORNATO IN VITA!', ABS.puttana.c);
  broadcastNow();
}
function HabGesuRev(id, tid){
  const p = byId(id), t = byId(tid);
  if(!p || !p.alive || p.quarantined || p.ab!=='gesu' || G.phase!=='play' || G.meeting) return;
  if(!t || t.alive || (t.deadBy!=='kill' && t.deadBy!=='spalm')) return;
  p.usedAbs.push('gesu'); p.ab=null;
  t.alive=true; t.deadBy=null;
  resurrectCleanup(t);
  addLog('✝ '+t.name+' È STATO RESUSCITATO DA "CHE GESÙ STA CON TE"!', ABS.gesu.c);
  broadcastNow();
}
function HabMerdeRev(id, tid){
  const p = byId(id), t = byId(tid);
  if(!p || !p.alive || p.quarantined || p.ab!=='merde' || G.phase!=='play' || G.meeting) return;
  if(!t || t.alive || t.deadBy!=='vote') return;
  p.usedAbs.push('merde'); p.ab=null;
  t.alive=true; t.deadBy=null;
  resurrectCleanup(t);
  addLog('🔥 '+t.name+' È STATO RIPORTATO DENTRO!', ABS.merde.c);
  broadcastNow();
}
function Hmerde(id){
  const p = byId(id);
  if(!p || p.alive || p.deadBy!=='vote' || p.ab!=='merde' || G.phase!=='play') return;
  p.usedAbs.push('merde'); p.ab=null;
  p.alive=true; p.deadBy=null;
  resurrectCleanup(p);
  addLog('🔥 '+p.name+': SONO TORNATO, MERDE!', ABS.merde.c);
  broadcastNow();
}

/* ══════════════════════ SUSSURRI ══════════════════════ */
function HwhisperOpen(id, tid){
  const p = byId(id), t = byId(tid), now = Date.now();
  if(!p || !p.alive || !t || !t.alive || t.id===p.id || G.phase!=='play') return;
  if(!G.whisperLog) G.whisperLog = {};
  const key = [id, tid].sort().join('|');
  if(G.whisperLog[key] && now - G.whisperLog[key] < CFG.WHISPER_ANNOUNCE_CD) return;
  G.whisperLog[key] = now;
  addLog('🤫 '+p.name+' STA SUSSURRANDO CON '+t.name+'.', '#38e1ff');
  broadcastNow();
}
function HwhisperMsg(id, tid, text){
  const p = byId(id), t = byId(tid);
  if(!p || !p.alive || !t || !t.alive || t.id===p.id || G.phase!=='play') return;
  const txt = String(text||'').trim().slice(0,200);
  if(!txt) return;
  priv(t.id, {type:'whisperMsg', from:p.id, fromName:p.name, text:txt});
}

/* ══════════════════════ SÉANCE (azioni) ══════════════════════ */
function HseanceTarget(id, tid){
  const p = byId(id), t = byId(tid), now = Date.now();
  if(!p || !p.alive || p.quarantined || G.seanceState!=='ready' || G.seanceMedium!==p.id ||
     G.phase!=='play' || G.meeting) return;
  if(!t || !t.alive || t.id===p.id) return;
  G.seanceState='voting'; G.seanceTarget=t.id; G.seanceVotes={}; G.seanceEndsAt=now+CFG.SEANCE_VOTE;
  addLog('🕯 IL MEDIO INTERROGA GLI SPIRITI SU '+t.name+'…', VIO);
  G.players.forEach(q=>{ if(!q.alive) priv(q.id, {type:'seanceVote', target:t.name, endsAt:G.seanceEndsAt}); });
  broadcastNow();
}
function HseanceBallot(id, vote){
  const p = byId(id);
  if(!p || p.alive || G.seanceState!=='voting' || G.seanceVotes[p.id]!==undefined) return;
  G.seanceVotes[p.id] = (vote==='yes');
  const dead = G.players.filter(q=>!q.alive);
  if(dead.every(q=>G.seanceVotes[q.id]!==undefined)) resolveSeance();
  else broadcastNow();
}

/* ══════════════════════ SPARLATORE / SCELTA ABILITÀ ══════════════════════ */
function Hspar(id, tid){
  const p = byId(id), t = byId(tid);
  if(!p || !p.alive || p.quarantined || p.ab!=='sparlatore' || G.phase!=='play' || G.meeting) return;
  if(!t || !t.alive || t.id===p.id) return;
  p.usedAbs.push('sparlatore'); p.ab=null;
  const lab = t.role==='assassino' ? 'L\'ASSASSINO' : t.role==='detective' ? 'IL DETECTIVE' : 'INNOCENTE';
  addLog('🗣 SPARLATORE: '+t.name+' È '+lab+'!', ABS.sparlatore.c);
  broadcastNow();
}
function HabChoice(id, pickSel){
  const p = byId(id);
  if(!p || !p.pendingAb) return;
  if(pickSel==='swap'){ p.ab = p.pendingAb; }
  p.pendingAb = null;
  broadcastNow();
}

/* ══════════════════════ SCAN (detective) ══════════════════════ */
function Hscan(id, tid){
  const d = byId(id), t = byId(tid), now = Date.now();
  if(!d || d.role!=='detective' || !d.alive || G.phase!=='play' || G.meeting){ priv(id,{type:'scanFail'}); return; }
  if(now<d.scanReadyAt || d.scanCharges<=0 || !t || !t.alive){ priv(id,{type:'scanFail'}); return; }
  d.scanReadyAt = now + CFG.SCAN_CD;
  d.scanCharges--;
  const ass = G.players.find(p=>p.role==='assassino');
  let eff;
  if(t.quarantined){ eff = t.code; }
  else{
    eff = t.code;
    if(G.spoof){
      eff = G.spoof.code;
      G.spoof.uses--;
      if(G.spoof.uses<=0){ G.spoof=null; priv(ass.id,{type:'note',txt:'◈ Sabotaggio esaurito: codici reali ripristinati.'}); }
      else{ priv(ass.id,{type:'note',txt:'◈ Il tuo spoof ha assorbito uno scan: resiste ancora a '+G.spoof.uses+' scan.'}); }
    }
  }
  addLog('🔎 Il Detective ha scansionato '+t.name+(t.quarantined?' (VERIFICA)':'')+'.');
  priv(t.id, {type:'note', txt:'⚠ QUALCUNO HA SCANSIONATO IL TUO CODICE!'});
  if(eff===ass.code){
    if(t.quarantined){
      G.reveal = {name:t.name, role:t.role, at:now};
      addLog('🩸 VERIFICA CONFERMATA: '+t.name+' È L\'ASSASSINO!');
      endGame('innocenti');
    } else {
      t.quarantined=true;
      cancelTask(t);
      if(t.isPuttana){ t.isPuttana=false; evaluatePuttana(); }
      addLog('⛔ '+t.name+' IN QUARANTENA: codice corrisponde a quello dell\'assassino!');
      priv(d.id, {type:'scanRes', id:t.id, target:t.name, code:eff, tasks:t.tasks, chg:d.scanCharges, q:true});
      priv(t.id, {type:'note', txt:'⛔ SEI IN QUARANTENA.'});
    }
  } else {
    if(t.quarantined){
      t.quarantined=false;
      addLog('✅ '+t.name+' RILASCIATO: codice verificato.');
      priv(t.id, {type:'note', txt:'✅ SEI STATO RILASCIATO.'});
      priv(d.id, {type:'scanRes', id:t.id, target:t.name, code:eff, tasks:t.tasks, chg:d.scanCharges, released:true});
    } else {
      priv(d.id, {type:'scanRes', id:t.id, target:t.name, code:eff, tasks:t.tasks, chg:d.scanCharges});
    }
  }
  broadcastNow();
}

/* ══════════════════════ SABOTAGGIO ══════════════════════ */
function Hsab(id, tid){
  const a = byId(id), now = Date.now();
  if(!a || a.role!=='assassino' || !a.alive || a.quarantined || G.phase!=='play' || G.meeting || now<a.sabReadyAt) return;
  const t = byId(tid);
  if(!t || !t.alive) return;
  if(t.role==='detective'){
    G.spoof = {code:t.code, uses:2};
    a.sabReadyAt = now;
    const digits=[];
    for(let i=0;i<a.code.length;i++){ if(/\d/.test(a.code[i])) digits.push(i); }
    if(digits.length){ const idx=pick(digits); priv(t.id,{type:'clue',char:a.code[idx],pos:idx+1}); }
    G.players.forEach(p=>priv(p.id,{type:'fx',fx:'hack'}));
    addLog('⚠ HACKERAGGIO: il codice del Detective è stato compromesso!');
  } else {
    G.spoof = {code:t.code, uses:2};
    a.sabReadyAt = now + CFG.SAB_CD;
    priv(id, {type:'note', txt:'◈ Codici uniformati su quello di '+t.name+'.'});
  }
  broadcastNow();
}

/* ══════════════════════ TASK COMPLETATA + ABILITÀ ══════════════════════ */
function HtaskDone(id){
  const p = byId(id);
  if(!p || G.phase!=='play') return;
  // ── SPETTRI: i rituali completati caricano la séance (niente task classiche) ──
  if(!p.alive){
    if(!p.task || p.task.type !== 'ghost') return;
    ghostTaskDone(p);
    broadcastNow();
    return;
  }
  if(p.quarantined) return;
  if(!p.task) return;
  if(p.task.type==='coop') return; // le coop si completano in coopComplete
  p.task = null;
  p.tasks++;
  p.lastTaskAt = Date.now();
  tryAbility(p);
  if(p.role!=='assassino' && taskProg()>=G.taskTarget){
    addLog('🏆 INTEGRITÀ STAZIONE COMPLETA!');
    endGame('innocenti');
  }
  broadcastNow();
}
function tryAbility(p){
  if(p.role==='assassino' || p.pendingAb) return;
  const r = Math.random()*100; let acc=0, got=null;
  for(const ab of AB_ORDER){ acc += ABS[ab].ch; if(r<acc){ got=ab; break; } }
  if(got && got!==p.ab){
    addLog('🎁 UN GIOCATORE HA TROVATO L\'ABILITÀ: '+ABS[got].n+'!', ABS[got].c);
    if(!p.ab){ p.ab=got; priv(p.id,{type:'found',ab:got}); }
    else{ p.pendingAb=got; priv(p.id,{type:'found',ab:got,old:p.ab}); }
  }
}

/* ══════════════════════ RIUNIONI ══════════════════════ */
function Hmeet(id, kind){
  const p = byId(id), now = Date.now();
  if(!p || !p.alive || G.phase!=='play' || G.meeting) return;
  if(kind==='word'){
    if(now < p.cdw) return;
    p.cdw = now + CFG.MEET_CD;
    G.meeting = {kind:'word', byName:p.name, stage:1, endsAt:now+CFG.WORD_TIME, words:{}, votes:null};
    addLog(p.name+' ha indetto una Riunione Parola.');
  } else {
    if(now < p.cdv) return;
    p.cdv = now + CFG.MEET_CD;
    G.meeting = {kind:'vote', byName:p.name, stage:1, endsAt:now+CFG.VOTE_TIME, votes:{}, words:null};
    addLog(p.name+' ha indetto una Riunione Voto.');
  }
  broadcastNow();
}
function Hword(id, text){
  const p = byId(id);
  const mm = G.meeting;
  if(!p || !p.alive || !mm || mm.kind!=='word' || mm.stage!==1 || mm.words[id]) return;
  mm.words[id] = String(text).slice(0,24);
  if(G.players.filter(q=>q.alive).every(q=>mm.words[q.id])){ mm.stage=2; mm.endsAt=Date.now()+CFG.WORD_SHOW; }
  broadcastNow();
}
function Hvote(id, tgt){
  const p = byId(id);
  const mm = G.meeting;
  if(!p || !p.alive || !mm || mm.kind!=='vote' || mm.stage!==1 || mm.votes[id]) return;
  mm.votes[id] = tgt;
  if(G.players.filter(q=>q.alive).every(q=>mm.votes[q.id]!==undefined)){
    resolveVotes(); mm.stage=2; mm.endsAt=Date.now()+CFG.VOTE_REVEAL;
  }
  broadcastNow();
}
function resolveVotes(){
  const mm = G.meeting, cnt={};
  Object.values(mm.votes).forEach(v=>{ if(v!=='skip') cnt[v]=(cnt[v]||0)+1; });
  let best=null, max=0, tie=false;
  for(const k in cnt){
    if(cnt[k]>max){ max=cnt[k]; best=k; tie=false; }
    else if(cnt[k]===max) tie=true;
  }
  mm.result = (!best || tie || max===0) ? null : {id:best};
}
function meetTick(now){
  const mm = G.meeting;
  if(mm.stage===1 && now>=mm.endsAt){
    if(mm.kind==='word'){ mm.stage=2; mm.endsAt=now+CFG.WORD_SHOW; }
    else{ resolveVotes(); mm.stage=2; mm.endsAt=now+CFG.VOTE_REVEAL; }
  } else if(mm.stage===2 && now>=mm.endsAt){
    if(mm.kind==='word'){ G.meeting=null; addLog('Riunione Parola conclusa.'); }
    else applyVote();
  }
}
function applyVote(){
  const mm = G.meeting;
  G.meeting = null;
  if(mm.result){
    const p = byId(mm.result.id);
    if(p){
      p.alive=false; p.deadBy='vote'; p.quarantined=false; cancelTask(p);
      G.reveal = {name:p.name, role:p.role, at:Date.now()};
      addLog(p.name+' è stato espulso dalla stazione.');
      if(p.ab==='merde') priv(p.id,{type:'note',txt:'🔥 Hai SONO TORNATO MERDE: attivala dal dock!'});
      if(p.role==='assassino'){ endGame('innocenti'); return; }
      checkWin();
      if(G.phase==='play' && p.role==='detective') promote();
    }
  } else {
    addLog('Nessuna espulsione: pareggio.');
  }
  broadcastNow();
}

/* ══════════════════════ PROMOZIONE DETECTIVE ══════════════════════ */
function promote(){
  const c = G.players.filter(p => p.alive && !p.quarantined && p.role==='innocente');
  if(!c.length) return;
  const p = pick(c);
  p.role='detective';
  p.scanReadyAt = Date.now() + CFG.NEWDET_SCAN;
  p.scanCharges = CFG.SCAN_MAX;
  p.scanNextChargeAt = Date.now() + CFG.SCAN_RECHARGE;
  if(p.isPuttana){ p.isPuttana=false; }
  priv(p.id, {type:'init2'});
  G.banner = {txt:'IL DETECTIVE È CADUTO — UN NUOVO DETECTIVE AGISCE IN ANONIMATO', tone:'amber', at:Date.now()};
  addLog('Un nuovo detective è stato nominato.');
}

/* ══════════════════════ VITTORIA / FINE ══════════════════════ */
function checkWin(){
  if(G.phase!=='play') return;
  if(aliveNonAss()<=1) endGame('assassino');
}
function endGame(w){
  G.phase='ended';
  G.winner=w;
  G.meeting=null;
  addLog(w==='innocenti' ? 'Gli innocenti hanno vinto.' : "L'assassino ha vinto.");
  broadcastNow();
}

/* ══════════════════════ DISCONNESSIONE ══════════════════════ */
function disconnectKill(p){
  p.alive=false; p.deadBy='disc'; p.quarantined=false; cancelTask(p);
  addLog(p.name+' si è disconnesso.');
  if(p.role==='assassino'){ endGame('innocenti'); return; }
  checkWin();
  if(G.phase==='play' && p.role==='detective') promote();
  broadcastNow();
}

/* ══════════════════════ RESET (torna alla lobby) ══════════════════════ */
function Hreset(){
  if(!G) return;
  G.players.forEach(p=>Object.assign(p, {
    alive:true, role:null, tasks:0, task:null, rulesOk:false, revealOk:false, quarantined:false,
    ab:null, usedAbs:[], pendingAb:null, isPuttana:false, puttanaReadyAt:0, deadBy:null,
    scanCharges:0, scanNextChargeAt:0
  }));
  Object.assign(G, {
    phase:'lobby', word:'', winner:null, reveal:null, meeting:null, spoof:null,
    banner:null, log:G.log, t0:0, whisperLog:{},
    coopSessions:{}, coopInvites:{},
    puttanaActive:false, puttanaTimerAt:0, taskTarget:0,
    seanceState:'charge', seanceCur:0, seanceContrib:[],
    seanceMedium:null, seanceTarget:null, seanceVotes:{}, seanceEndsAt:0
  });
  addLog('↩ Tornati alla lobby.');
  broadcastNow();
}

/* ══════════════════════ DISPATCHER AZIONI ══════════════════════ */
function hostAct(o){
  switch(o.t){
    case 'hi':
      syncRosterFromPresence();
      setTimeout(()=>broadcastNow(), 300);
      setTimeout(()=>broadcastNow(), 1000);
      break;
    case 'start':      Hstart(); break;
    case 'rulesOk':    HrulesOk(o.id); break;
    case 'revealOk':   HrevealOk(o.id); break;
    case 'taskDone':   HtaskDone(o.id); break;
    case 'kill':       Hkill(o.id, o.tgt); break;
    case 'scan':       Hscan(o.id, o.tgt); break;
    case 'sab':        Hsab(o.id, o.tgt); break;
    case 'whisperOpen':HwhisperOpen(o.id, o.tgt); break;
    case 'whisperMsg': HwhisperMsg(o.id, o.tgt, o.text); break;
    case 'seanceTarget':HseanceTarget(o.id, o.tgt); break;
    case 'seanceBallot':HseanceBallot(o.id, o.vote); break;
    case 'abSpalm':    Hspalm(o.id, o.tgt); break;
    case 'abPutt':     Hputt(o.id, o.tgt); break;
    case 'abSpar':     Hspar(o.id, o.tgt); break;
    case 'abGesuRev':  HabGesuRev(o.id, o.tgt); break;
    case 'abMerdeRev': HabMerdeRev(o.id, o.tgt); break;
    case 'abMerde':    Hmerde(o.id); break;
    case 'abChoice':   HabChoice(o.id, o.pick); break;
    case 'coopAccept': acceptCoopInvite(o.inviteId, o.accept); break;
    case 'coopTap':    HcoopTap(o.id); break;
    case 'coopValve':  HcoopValve(o.id, o.vidx, o.pos); break;   /* ✅ corretto */
    case 'coopRunes':  HcoopSubmitRunes(o.id, o.seq); break;
    case 'meet':       Hmeet(o.id, o.kind); break;
    case 'word':       Hword(o.id, o.text); break;
    case 'vote':       Hvote(o.id, o.tgt); break;
    case 'reset':      Hreset(); break;
  }
}

/* ═══ INVIO AZIONE (usata da tutti i client) ═══ */
function act(o){
  o.k = 'act';
  o.id = I.id;
  if(isHost) hostAct(o);
  else send(o);
}