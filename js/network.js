/* ══════════════════════════════════════════════════════════════
   PROTOCOLLO OMBRA — js/network.js
   Livello di rete: Supabase, canale realtime, presenza, heartbeat,
   sala d'attesa (chi entra a partita in corso non diventa spettro).
   Dipendenze: config.js, utils.js, state.js.
   Nota: disconnectKill è definita in host.js (chiamata solo a runtime).
   ══════════════════════════════════════════════════════════════ */

/* ═══ CREA E SOTTOSCRIVI IL CANALE REALTIME ═══ */
function enterChannel(){
  chan = SB.channel('ombra-' + ROOM)
    .on('broadcast', {event:'msg'}, e => onMsg(e.payload))
    .on('presence', {event:'sync'}, onPres)
    .subscribe(st => {
      if(st === 'SUBSCRIBED'){
        chan.track({ id: I.id, name: I.name, jAt: joinAt, host: isHost });
        if(isHost && G){
          setTimeout(()=>broadcastNow(), 600);
          setTimeout(()=>broadcastNow(), 1500);
          /* FIX "HOST DIVENTA SPETTATORE" (TRACK): il track è asincrono;
             appena confermato, ribadiamo il roster al canale. */
          chan.track({ id: I.id, name: I.name, jAt: joinAt, host: true }, ()=>{
            try{ onPres(); }catch(e){}
          });
        } else if(!isHost){
          setTimeout(()=>act({t:'hi'}), 500);
          setTimeout(()=>act({t:'hi'}), 2000);
          setTimeout(()=>act({t:'hi'}), 4000);
        }
      }
    });
}

/* ═══ INVIA UN MESSAGGIO IN BROADCAST ═══ */
function send(o){
  if(chan) chan.send({ type:'broadcast', event:'msg', payload:o });
}

/* ═══ INVIA UN MESSAGGIO PRIVATO A UN GIOCATORE ═══
   Broadcast filtrato: il payload reca il destinatario (to) e ogni
   client lo ignora se non è il proprio (vedi onMsg in client.js).
   ★ FIX DETECTIVE (HOST): Supabase NON recapita i broadcast al proprio
   mittente. Se il destinatario coincide col giocatore locale (host),
   il messaggio gli viene consegnato direttamente qui. */
function priv(id, o){
  o.k = 'priv';
  o.to = id;
  send(o);
  if(isHost && id === I.id){
    try{ onMsg(o); }catch(e){ console.warn('priv-self', e); }
  }
}

/* ═══ INVIA UN PRIVATO A PIÙ DESTINATARI ═══ */
function privBoth(ids, o){
  const seen = new Set();
  ids.forEach(id => {
    if(!id || seen.has(id)) return;
    seen.add(id);
    priv(id, Object.assign({}, o));
  });
}

/* ═══ LEGGI IL ROSTER DELLE PRESENZE ═══ */
function roster(){
  const ps = chan.presenceState();
  const out = [];
  for(const k in ps) out.push(ps[k][0]);
  return out;
}

/* ═══ HEARTBEAT DELL'HOST ═══ */
let heartbeatInterval = null;
function startHeartbeat(){
  if(heartbeatInterval) return;
  heartbeatInterval = setInterval(()=>{
    if(isHost && G){
      syncRosterFromPresence();
      broadcastNow();
    }
  }, CFG.HEARTBEAT);
}
function stopHeartbeat(){
  if(heartbeatInterval){ clearInterval(heartbeatInterval); heartbeatInterval = null; }
}

/* ═══ SINCRONIZZA IL ROSTER GIOCATORI DALLE PRESENZE ═══
   ⚠️ REGOLA D'ORO: le presenze realtime sono VOLATILI.
   - MAI rimuovere un giocatore dal roster (soprattutto l'HOST).
   - Si aggiungono solo i presenti confermati. */
let lastPresenceFull = 0;
function syncRosterFromPresence(force){
  if(!chan || !G) return;
  const r = roster();
  if(!r.length && !force){
    if(Date.now() - lastPresenceFull > 15000) lastPresenceFull = Date.now();
    return;
  }
  lastPresenceFull = Date.now();
  if(G.phase === 'lobby'){
    const ids = new Set(r.map(p => p.id));
    let changed = false;
    r.forEach(p => {
      const ex = G.players.find(x => x.id === p.id);
      if(!ex){ G.players.push(mkPlayer(p.id, p.name)); changed = true; }
      else if(ex.name !== p.name){ ex.name = p.name; changed = true; }
    });
    if(!G.players.some(p => p.id === I.id)){
      G.players.unshift(mkPlayer(I.id, I.name || 'HOST'));
      changed = true;
    }
    if(changed) broadcastNow();
  }
}

/* ═══ GESTORE DELLA PRESENZA (sync) ═══ */
function onPres(){
  if(!chan) return;
  const r = roster();

  if(isHost && G){
    if(G.phase === 'lobby'){
      if(!r.length){ return; }   // glitch: ignora questo sync
      let ch = false;
      r.forEach(p => {
        const ex = G.players.find(x => x.id === p.id);
        if(!ex){ G.players.push(mkPlayer(p.id, p.name)); ch = true; }
        else if(ex.name !== p.name){ ex.name = p.name; ch = true; }
      });
      if(!G.players.some(p => p.id === I.id)){
        G.players.unshift(mkPlayer(I.id, I.name || 'HOST')); ch = true;
      }
      if(ch) broadcastNow();
    } else {
      /* ── IN PARTITA ── */
      const ids = new Set(r.map(p => p.id));
      const meTracked = r.some(p => p.id === I.id);
      if(!meTracked){
        try{ chan.untrack(); }catch(e){}
        chan.track({ id: I.id, name: I.name, jAt: joinAt, host: true });
      }
      // Sicurezza: l'host locale deve sempre essere nell'elenco giocatori.
      if(!G.players.some(p => p.id === I.id)){
        G.players.push(mkPlayer(I.id, I.name || 'HOST'));
        broadcastNow();
      }
      /* ★ FIX CRITICO #3 RIMOSSO: qui prima c'era
           if(meP && !meP.alive){ meP.alive = true; meP.deadBy = null; }
         che RESUSCITAVA l'host a ogni evento di presenza (anche dopo
         una kill regolare). Le morti dell'host sono gestite SOLO dalla
         logica di gioco; i glitch di presenza non le toccano più. */

      // ★ SALA D'ATTESA: solo chi NON ha mai giocato questa partita entra.
      if(!G.waiting) G.waiting = [];
      if(!G.seenInGame) G.seenInGame = {};
      G.players.forEach(p => { G.seenInGame[p.id] = 1; });
      r.forEach(p => {
        const inGame    = G.players.some(x => x.id === p.id);
        const inWaiting = G.waiting.some(x => x.id === p.id);
        if(!inGame && !inWaiting && !G.seenInGame[p.id] && p.id !== I.id){
          G.waiting.push({ id: p.id, name: p.name });
          priv(p.id, { type:'note', txt:"🕒 Sei in SALA D'ATTESA: entrerai alla prossima partita." });
        }
      });
      // Le disconnessioni definitive NON passano dalle presenze:
      // le rileva il REAPER (LASTSEEN + ping) in host.js → hostTick.
    }
  } else if(!isHost){
    /* ── MIGRAZIONE HOST (solo se la partita è in lobby) ── */
    if(!G && PUB && PUB.phase === 'lobby'){
      const h = r.length ? r.reduce((a,b) => a.jAt < b.jAt ? a : b) : null;
      if(h && h.id === I.id){
        isHost = true;
        G = {
          phase:'lobby', t0:0, word:'', winner:null, reveal:null,
          meeting:null, spoof:null, banner:null, log:[], whisperLog:{},
          coopSessions:{}, coopInvites:{},
          puttanaActive:false, puttanaTimerAt:0, taskTarget:0,
          seanceState:'charge', seanceCur:0, seanceContrib:[],
          seanceMedium:null, seanceTarget:null, seanceVotes:{}, seanceEndsAt:0,
          waiting:[], seenInGame:{},
          players: r.map(p => mkPlayer(p.id, p.name))
        };
        broadcastNow();
        startHeartbeat();
      }
    }
    // Se l'host cade durante la partita (stato perso) → banner + reload
    if(PUB && PUB.phase !== 'lobby' && !r.some(p => p.host)){
      showBanner('HOST DISCONNESSO — PARTITA TERMINATA', 'red');
      setTimeout(()=>location.reload(), 3200);
    }
  }
}