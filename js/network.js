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
        // Traccia la presenza di questo client nel canale
        chan.track({ id: I.id, name: I.name, jAt: joinAt, host: isHost });
        if(isHost && G){
          // L'host ribroadcasta lo stato appena entra nel canale
          setTimeout(()=>broadcastNow(), 600);
          setTimeout(()=>broadcastNow(), 1500);
        } else if(!isHost){
          // Il client si presenta all'host (più tentativi)
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
   client lo ignora se non è il proprio (vedi onMsg in client.js). */
function priv(id, o){
  o.k = 'priv';
  o.to = id;
  send(o);
}

/* ═══ LEGGI IL ROSTER DELLE PRESENZE ═══ */
function roster(){
  const ps = chan.presenceState();
  const out = [];
  for(const k in ps) out.push(ps[k][0]);
  return out;
}

/* ═══ HEARTBEAT DELL'HOST ═══
   Ribroadcasta periodicamente lo stato per tenere tutti sincronizzati. */
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

/* ═══ SINCRONIZZA IL ROSTER GIOCATORI DALLE PRESENZE ═══ */
function syncRosterFromPresence(){
  if(!chan || !G) return;
  const r = roster();
  if(G.phase === 'lobby'){
    const ids = new Set(r.map(p => p.id));
    let changed = false;
    G.players = G.players.filter(p => p.id === I.id || ids.has(p.id));
    r.forEach(p => {
      const ex = G.players.find(x => x.id === p.id);
      if(!ex){ G.players.push(mkPlayer(p.id, p.name)); changed = true; }
      else if(ex.name !== p.name){ ex.name = p.name; changed = true; }
    });
    if(changed) broadcastNow();
  }
}

/* ═══ GESTORE DELLA PRESENZA (sync) ═══
   - In lobby: sincronizza il roster.
   - In partita: chi entra va in SALA D'ATTESA (non spettro).
   - Se l'host cade: migrazione host (solo in lobby) o banner+reload. */
function onPres(){
  if(!chan) return;
  const r = roster();

  if(isHost && G){
    if(G.phase === 'lobby'){
      const ids = new Set(r.map(p => p.id));
      let ch = false;
      G.players = G.players.filter(p => p.id === I.id || ids.has(p.id));
      r.forEach(p => {
        const ex = G.players.find(x => x.id === p.id);
        if(!ex){ G.players.push(mkPlayer(p.id, p.name)); ch = true; }
        else if(ex.name !== p.name){ ex.name = p.name; ch = true; }
      });
      if(ch) broadcastNow();
    } else {
      /* ── IN PARTITA ── */
      const ids = new Set(r.map(p => p.id));

      /* ═══ FIX BUG "HOST DIVENTA SPETTRO ALL'AVVIO DELLA PARTITA" ═══
         L'id dell'host locale (I.id) DEVE essere sempre presente nel
         roster delle presenze del canale. Se per un race di realtime
         (track non ancora confermato al primo sync, oppure il client è
         stato ricreato con un nuovo uid) l'host non compare nella lista
         presenze, il codice sotto lo considererebbe "disconnesso" e lo
         eliminerebbe → l'host si ritrova SPETTRO senza capire cosa sia
         successo. Qui: (1) auto-ritrack di sicurezza, (2) mai
         disconnectKill sull'host stesso, (3) auto-riammissione
         nell'elenco giocatori se assente. */
      const meTracked = r.some(p => p.id === I.id);
      if(!meTracked){
        try{ chan.untrack(); }catch(e){}
        chan.track({ id: I.id, name: I.name, jAt: joinAt, host: true });
      }

      // (2)+(3) Il locale è l'host: non può mai essere eliminato come "disconnesso"
      if(!G.players.some(p => p.id === I.id)){
        G.players.push(mkPlayer(I.id, I.name || 'HOST'));
        broadcastNow();
      }
      const meP = G.players.find(p => p.id === I.id);
      if(meP && !meP.alive){ meP.alive = true; meP.deadBy = null; }

      // Chi si disconnette durante la partita viene eliminato come "disconnesso"
      // (escludendo SEMPRE l'host locale, anche se momentaneamente assente dalle presenze)
      G.players.forEach(p => {
        if(p.alive && p.id !== I.id && !ids.has(p.id)) disconnectKill(p);
      });
      // ★ SALA D'ATTESA: chi entra a partita in corso NON diventa spettro.
      if(!G.waiting) G.waiting = [];
      r.forEach(p => {
        const inGame    = G.players.some(x => x.id === p.id);
        const inWaiting = G.waiting.some(x => x.id === p.id);
        if(!inGame && !inWaiting && p.id !== I.id){
          G.waiting.push({ id: p.id, name: p.name });
          priv(p.id, { type:'note', txt:'🕒 Sei in SALA D\'ATTESA: entrerai alla prossima partita.' });
        }
      });
      // Rimuovi dalla sala d'attesa chi si è disconnesso
      // (solo se la mia presenza è confermata, per non cancellare entry valide)
      if(meTracked) G.waiting = G.waiting.filter(w => ids.has(w.id));
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
          waiting:[],
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