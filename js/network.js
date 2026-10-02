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
          /* ═══ FIX "HOST DIVENTA SPETTATORE" (TRACK) ═══
             Il track è asincrono: se un sync di presenza arriva VUOTO/PARZIALE
             prima che il nostro track sia confermato, l'host si auto-elimina dal
             roster e alla partenza resta senza ruolo (= spettatore).
             Appena il track è OK, ribadiamo SUBITO il roster al channel. */
          chan.track({ id: I.id, name: I.name, jAt: joinAt, host: true }, ()=>{
            try{ onPres(); }catch(e){}
          });
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
   client lo ignora se non è il proprio (vedi onMsg in client.js).
   ★ FIX DETECTIVE (HOST): Supabase NON recapita i broadcast al proprio
   mittente. Se il destinatario coincide con il giocatore locale (host),
   il messaggio gli viene consegnato direttamente qui. Senza questo fix
   l'host-detective non riceve mai il sync con le cariche (SYNC.chg
   risulta vuoto → «SCANSIONE BLOCCATA: CARICHE ESAURITE») né i privati
   come coopInvite / coopStart / init2. */
function priv(id, o){
  o.k = 'priv';
  o.to = id;
  send(o);
  if(isHost && id === I.id){
    try{ onMsg(o); }catch(e){ console.warn('priv-self', e); }
  }
}

/* ═══ INVIA UN PRIVATO A PIÙ DESTINATARI (consegna garantita anche all'host) ═══
   Supabase NON recapita i broadcast al proprio mittente: se uno dei
   destinatari è l'host stesso, il messaggio gli arriva solo tramite la
   consegna locale di priv() (★ FIX DETECTIVE). privBoth() incapsula il
   pattern «stesso evento per entrambi i membri della coppia» usato dalle
   task di coppia (coopOpen / coopEnd): ogni destinatario riceve una copia
   con il proprio «to», così nessuno resta senza il messaggio. */
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

/* ═══ SINCRONIZZA IL ROSTER GIOCATORI DALLE PRESENZE ═══
   ⚠️ REGOLA D'ORO: le presenze realtime sono VOLATILI (un micro-drop di
   rete le consegna VUOTE o PARZIALI). Quindi:
     - MAI rimuovere un giocatore dal roster (soprattutto l'HOST stesso):
       se l'host si auto-elimina da G.players, alla partenza non riceve più
       il messaggio privato "init" (ruolo + parola) → resta senza ruolo →
       il gioco lo mostra come SPETTRO / SPETTATORE. Ecco il bug che hai visto.
     - Si aggiungono solo i presenti confermati (id presente in roster). */
let lastPresenceFull = 0;   // timestamp ultimo sync con roster non vuoto
function syncRosterFromPresence(force){
  if(!chan || !G) return;
  const r = roster();
  // Presenza vuota = glitch (capita appena dopo il track): ignora il tick,
  // riprova al prossimo heartbeat, altrimenti si aspetta 15s e si autopulisce.
  if(!r.length && !force){
    if(Date.now() - lastPresenceFull > 15000) lastPresenceFull = Date.now();
    return;
  }
  lastPresenceFull = Date.now();
  if(G.phase === 'lobby'){
    const ids = new Set(r.map(p => p.id));
    let changed = false;
    // Nessuna rimozione qui: chi esce davvero viene gestito da onPres/leave.
    r.forEach(p => {
      const ex = G.players.find(x => x.id === p.id);
      if(!ex){ G.players.push(mkPlayer(p.id, p.name)); changed = true; }
      else if(ex.name !== p.name){ ex.name = p.name; changed = true; }
    });
    // Sicurezza: l'host locale deve SEMPRE essere nel roster giocatori.
    if(!G.players.some(p => p.id === I.id)){
      G.players.unshift(mkPlayer(I.id, I.name || 'HOST'));
      changed = true;
    }
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
      /* ═══ FIX "HOST DIVENTA SPETTATORE" (LOBBY) ═══
         Prima, a ogni sync di presenza, l'host filtrava G.players tenendo solo
         chi compariva nelle presenze. Le presenze Supabase sono volatili: se un
         sync arriva VUOTO o PARZIALE (micro-drop, track non ancora confermato),
         l'host cancellava sé stesso dal roster → alla partenza della partita
         HrulesOk() non mandava più a lui il privato "init" con ruolo e parola →
         SEC.role resta null → chip "SPETTRO" + modalità spettatore.
         Ora: niente rimozioni qui (chi esce davvero viene ripulito alla ripresa
         del gioco / in Hstart), e l'host è SEMPRE garantito nel roster. */
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
      /* ═══ FIX BUG "HOST DIVENTA SPETTRO / NON CAPISCE COSA È SUCCESSO" ═══
         Causa profonda: le presenze realtime sono VOLATILI (un drop di rete
         le svuota tutte, anche dei giocatori collegati) e Supabase può
         consegnare un sync PARZIALE/STALE (roster vuoto o senza di me) prima
         che il track sia confermato. Il vecchio codice, a ogni sync,
         confrontava il roster presenze con G.players e:
           - eliminava come "disconnesso" chiunque non comparisse (persone
             in realtà online → morti inspiegabili);
           - metteva in SALA D'ATTESA chi era già in partita ma temporanea-
             mente assente dalle presenze (→ "non capisci cosa è");
           - filtrava la sala d'attesa sul roster volatile (svuotandola).
         Ora: (1) auto-ritrack di sicurezza se la mia presenza manca;
         (2) mai disconnectKill sul giocatore locale; (3) i giocatori della
         partita in corso NON vengono rimossi dal roster presenze — le
         uscite definitive le rileva il protocollo di sopravvivenza (hi +
         heartbeat ACK in hostAct); (4) la sala d'attesa accoglie solo chi
         è davvero NUOVO (mai visto in questa partita), così un glitch di
         presenze non retrocede in attesa un giocatore già in partita. */
      const ids = new Set(r.map(p => p.id));
      const meTracked = r.some(p => p.id === I.id);
      if(!meTracked){
        try{ chan.untrack(); }catch(e){}
        chan.track({ id: I.id, name: I.name, jAt: joinAt, host: true });
      }

      // Sicurezza: l'host locale deve sempre essere nell'elenco giocatori
      // (e mai marcato morto per errore) — altrimenti resterebbe senza
      // identità visibile, cioè di fatto uno spettro.
      if(!G.players.some(p => p.id === I.id)){
        G.players.push(mkPlayer(I.id, I.name || 'HOST'));
        broadcastNow();
      }
      const meP = G.players.find(p => p.id === I.id);
      if(meP && !meP.alive){ meP.alive = true; meP.deadBy = null; }

      // ★ SALA D'ATTESA: solo chi NON ha mai giocato questa partita entra.
      //     I giocatori già in partita non vengono MAI retrocessi in attesa
      //     a causa di un sync di presenza parziale o volatile.
      if(!G.waiting) G.waiting = [];
      if(!G.seenInGame) G.seenInGame = {};
      G.players.forEach(p => { G.seenInGame[p.id] = 1; });
      r.forEach(p => {
        const inGame    = G.players.some(x => x.id === p.id);
        const inWaiting = G.waiting.some(x => x.id === p.id);
        if(!inGame && !inWaiting && !G.seenInGame[p.id] && p.id !== I.id){
          G.waiting.push({ id: p.id, name: p.name });
          priv(p.id, { type:'note', txt:'🕒 Sei in SALA D\'ATTESA: entrerai alla prossima partita.' });
        }
      });
      // Nessuna rimozione dai G.players qui: le disconnessioni definitive
      // sono gestite da hi/heartbeat (hostAct in host.js), non dal roster
      // volatile delle presenze.
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