// PARTITA.JS v2.0 - nuovo motore: assassino occulto, loop
// uccisioni del Sistema, indagini dell'Ispettore, fine con
// ruoli veri. Rivelazione sincronizzata (ready) + reset.
// Stile anti-manomissione: commenti //, select() senza
// argomenti, apostrofi solo dentro virgolette doppie.
(function(){
  console.log('[PARTITA] partita.js caricato v2.0');

  if(!guardConfig()) return;

  const uid    = getUid();
  const myName = getPlayerName() || 'Sconosciuto';
  const stored = getCurrentRoom();
  if(!stored){ location.replace('index.html'); return; }
  const roomId = stored.id;

  const el = {
    roomName:    document.getElementById('roomName'),
    codeText:    document.getElementById('codeText'),
    codeChip:    document.getElementById('codeChip'),
    copyHint:    document.getElementById('copyHint'),
    btnExit:     document.getElementById('btnExit'),
    timerText:   document.getElementById('timerText'),
    roleTag:     document.getElementById('roleTag'),
    myRole:      document.getElementById('myRole'),
    myCode:      document.getElementById('myCode'),
    myHint:      document.getElementById('myHint'),
    playerList:  document.getElementById('playerList'),
    playerCount: document.getElementById('playerCount'),
    chatLog:     document.getElementById('chatLog'),
    chatForm:    document.getElementById('chatForm'),
    chatInput:   document.getElementById('chatInput'),
    reveal:      document.getElementById('reveal'),
    flipCard:    document.getElementById('flipCard'),
    revealRole:  document.getElementById('revealRole'),
    revealDesc:  document.getElementById('revealDesc'),
    revealCode:  document.getElementById('revealCode'),
    btnEnter:    document.getElementById('btnEnter'),
    overlayAttesa: document.getElementById('overlayAttesa'),
    attesaCount:   document.getElementById('attesaCount'),
    overlayFine:   document.getElementById('overlayFine'),
    fineTitolo:    document.getElementById('fineTitolo'),
    fineRuoli:     document.getElementById('fineRuoli'),
    btnFine:       document.getElementById('btnFine')
  };

  function loud(msg){
    console.error('[PARTITA]', msg);
    showToast(msg, false);
    const d = document.createElement('div');
    d.className = 'config-warning';
    d.textContent = '⚠ ' + msg;
    document.body.appendChild(d);
  }

  function explain(err){
    const m = (err && err.message) || String(err);
    if(/does not exist/i.test(m)) return 'tabelle mancanti: esegui database.sql.';
    if(/clue|next_kill_at|indagini_usate|skip_usati|card/i.test(m)) return 'mancano le colonne dello Step 5: esegui le righe SQL nuove.';
    if(/ready|phase|winner/i.test(m)) return 'mancano le colonne dello Step 4: esegui le righe SQL.';
    if(/Failed to fetch|NetworkError/i.test(m)) return 'Supabase non raggiungibile.';
    if(/JWT|API key|apikey/i.test(m)) return 'anon key sbagliata in config.js.';
    return m;
  }

  const miss = Object.keys(el).filter(function(k){ return !el[k]; });
  if(miss.length){ loud('partita.html incompleta: mancano ' + miss.join(', ')); return; }

  // ruoli VERI; all'assassino mostriamo "Innocente" (non sa)
  const ROLE_INFO = {
    assassino: { tag: 'Assassino', desc: "Sei l'ombra al tavolo. Nessuno sa, nemmeno tu: confonditi tra gli innocenti e lascia che il Sistema mietano le vittime." },
    detective: { tag: 'Ispettore', desc: "Solo tu vedi l'indizio sull'assassino. Indaga, escludi, e quando sei pronto: elimina. Un solo tentativo." },
    innocente: { tag: 'Innocente', desc: "Una vittima cade ogni pochi secondi. Osserva, parla, sopravvivi: l'assassino è tra voi e non sa di esserlo." }
  };
  // descrizione "pubblica" del ruolo: l'assassino si crede innocente
  function ruoloVisto(r){ return (r === 'assassino') ? 'innocente' : r; }

  let running = true, beatN = 0, lastChatId = 0;
  let room = null, lastPlayers = [];
  let myRole = 'innocente', myCode = '—';
  let isHost = false, readySent = false, timerStarted = false, fineVista = false;
  const seenPlayers = new Set();

  const BUS = {
    map: {},
    on: function(evt, fn){ (BUS.map[evt] = BUS.map[evt] || []).push(fn); },
    emit: function(evt, data){
      (BUS.map[evt] || []).forEach(function(fn){
        try{ fn(data); }catch(e){ console.warn('[BUS]', evt, e); }
      });
    }
  };

  function isFresh(p){ return (Date.now() - Date.parse(p.last_seen)) <= OFFLINE_AFTER_MS; }
  function deviceText(p){ return p.device ? deviceLabel(p.device) : '❓ Sconosciuto'; }
  function statoDi(p){
    if(!isFresh(p)) return 'disconnesso';
    return (p.alive === false) ? 'eliminato' : 'vivo';
  }
  function roleOf(p){ return unscramble(p.role, p.uid) || 'innocente'; }
  function winnerMsg(w){ return (w === 'assassino') ? "🏆 Vince l'Assassino!" : "🏆 Vince l'Ispettore!"; }

  window.PARTITA = {
    getRoomId: function(){ return roomId; },
    getUid:    function(){ return uid; },
    getMyName: function(){ return myName; },
    getRole:   function(){ return myRole; },
    getMyCode: function(){ return myCode; },
    isRunning: function(){ return running; },
    getRoom:   function(){ return room; },
    getPlayers:function(){ return lastPlayers; },
    isFresh:   function(p){ return isFresh(p); },
    dbRef:     function(){ return db; },
    on:        function(evt, fn){ BUS.on(evt, fn); }
  };

  init();

  async function init(){
    try{
      const res = await db.from('rooms').select().eq('id', roomId).maybeSingle();
      if(res.error){ loud('Errore database: ' + explain(res.error), 3000); return; }
      if(!res.data){ loud('Stanza non trovata (torno al menu tra 3s)', 3000); return; }
      room = res.data;
      if(room.status !== 'playing'){
        location.replace(room.status === 'lobby' ? 'lobby.html' : 'index.html');
        return;
      }
      const meRes = await db.from('players').select()
        .eq('room_id', roomId).eq('uid', uid).maybeSingle();
      if(meRes.error || !meRes.data){ location.replace('lobby.html'); return; }

      isHost = room.host_uid === uid;
      myRole = roleOf(meRes.data) || 'innocente';
      if(!ROLE_INFO[myRole]) myRole = 'innocente';
      myCode = meRes.data.code || '—';

      el.roomName.textContent = room.name;
      el.codeText.textContent = room.code;

      if(room.phase === 'fine'){ mostraFine(); return; }

      if(room.phase === 'live'){
        el.reveal.hidden = true;
        if(room.started_at){ startTimer(room.started_at); timerStarted = true; }
      } else if(meRes.data.ready === true){
        readySent = true;
        el.reveal.hidden = true;
        el.overlayAttesa.hidden = false;
      } else {
        fillReveal();
        el.reveal.hidden = false;
        setTimeout(function(){ el.flipCard.classList.add('flipped'); }, 650);
      }
      fillMyCard();

      BUS.emit('ready', { role: myRole });
      BUS.emit('room', room);
      beat();
    }catch(err){
      console.error('[PARTITA] init fallita:', err);
      loud('Errore di connessione: ' + explain(err));
    }
  }

  function loud2(){ } // placeholder rimosso
  // (uso diretto di loud con timeout dove serve)
  function loudMsg(msg, ms){
    loud(msg);
    setTimeout(function(){ clearCurrentRoom(); location.replace('index.html'); }, ms || 3000);
  }

  // ---------------- rivelazione (ruolo VISTO: assassino=innocente) ----------------
  function fillReveal(){
    const visto = ruoloVisto(myRole);
    const info = ROLE_INFO[visto];
    el.revealRole.textContent = info.tag;
    el.revealRole.className = 'reveal-role ' + visto;
    el.revealDesc.textContent = info.desc;
    el.revealCode.textContent = myCode;
  }
  function fillMyCard(){
    const visto = ruoloVisto(myRole);
    const info = ROLE_INFO[visto];
    el.roleTag.textContent = info.tag;
    el.roleTag.className = 'count role-tag ' + visto;
    el.myRole.textContent = info.tag;
    el.myRole.className = 'my-role ' + visto;
    el.myCode.textContent = myCode;
    el.myHint.textContent = info.desc;
  }

  el.btnEnter.addEventListener('click', async function(){
    if(readySent) return;
    readySent = true;
    el.btnEnter.disabled = true;
    await db.from('players').update({ ready: true })
      .eq('room_id', roomId).eq('uid', uid);
    el.reveal.hidden = true;
    el.overlayAttesa.hidden = false;
  });

  // ---------------- timer ----------------
  function startTimer(startedAt){
    const t0 = Date.parse(startedAt) || Date.now();
    const pad = function(n){ return String(n).padStart(2, '0'); };
    const tick = function(){
      const s = Math.max(0, Math.floor((Date.now() - t0) / 1000));
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
      el.timerText.textContent = h ? h + ':' + pad(m) + ':' + pad(ss) : pad(m) + ':' + pad(ss);
    };
    tick();
    setInterval(function(){ if(running) tick(); }, 1000);
  }

  // ---------------- successione capo ----------------
  async function promoteNewHost(candidates){
    if(!candidates || !candidates.length) return null;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    await db.from('rooms').update({ host_uid: pick.uid }).eq('id', roomId);
    await db.from('players').update({ is_host: false }).eq('room_id', roomId);
    await db.from('players').update({ is_host: true }).eq('id', pick.id);
    await sysMessage(roomId, '♛ ' + escapeHtml(pick.name) + ' è ora il capo stanza.');
    return pick;
  }

  // ---------------- annullamento (disconnessioni, niente winner) ----------------
  async function cancelGame(){
    running = false;
    try{
      await db.from('rooms').update({ status: 'lobby' }).eq('id', roomId);
      await sysMessage(roomId, '⚠ Troppo pochi agenti al tavolo: partita annullata, si torna in lobby.');
    }catch(e){}
    BUS.emit('reset');
    await resetPartita(roomId);
    showToast('Partita annullata: si torna in lobby', false);
    setTimeout(function(){ location.replace('lobby.html'); }, 1500);
  }

  // ---------------- overlay fine con ruoli VERI ----------------
  function mostraFine(){
    if(fineVista) return;
    fineVista = true;
    running = false;
    el.fineTitolo.textContent = winnerMsg(room.winner || 'assassino');
    const ps = lastPlayers.length ? lastPlayers : [];
    el.fineRuoli.innerHTML = ps.map(function(p){
      const r = roleOf(p);
      return '<li class="fine-voce"><b>' + escapeHtml(p.name) + '</b> — ' + ROLE_INFO[r].tag + '</li>';
    }).join('');
    el.overlayFine.hidden = false;
  }

  el.btnFine.addEventListener('click', async function(){
    await db.from('rooms').update({ status: 'lobby' }).eq('id', roomId);
    location.replace('lobby.html');
  });

  // ---------------- heartbeat ----------------
  async function beat(){
    if(!running) return;
    beatN++;
    try{
      if(beatN % PRESENCE_EVERY === 1){
        const t = await db.from('players')
          .update({ online: true, device: getDeviceType(), last_seen: new Date().toISOString() })
          .eq('room_id', roomId).eq('uid', uid)
          .select('id');
        if(!t.error && t.data && t.data.length === 0){
          running = false;
          showToast('Sei stato rimosso dal tavolo', false);
          clearCurrentRoom();
          setTimeout(function(){ location.replace('index.html'); }, 1800);
          return;
        }
      }

      const pl = await db.from('players').select().eq('room_id', roomId);
      if(!pl.error && pl.data){
        let players = pl.data;
        if(iAmCleaner(players)){
          players = await cleanup(players);
          const hostAlive = players.some(function(p){ return p.is_host && p.alive !== false; });
          if(!hostAlive && players.length){
            const pick = await promoteNewHost(players);
            if(pick) players.forEach(function(q){ q.is_host = (q.uid === pick.uid); });
          }
          // reveal -> live quando tutti i connessi hanno letto il ruolo
          if(room && room.phase === 'reveal'){
            const freschi = players.filter(isFresh);
            const pronti = freschi.filter(function(p){ return p.ready === true; });
            if(freschi.length > 0 && pronti.length >= freschi.length){
              const ora = new Date().toISOString();
              await db.from('rooms').update({
                phase: 'live', started_at: ora,
                next_kill_at: new Date(Date.now() + 5000).toISOString()
              }).eq('id', roomId);
              room.phase = 'live'; room.started_at = ora;
              await sysMessage(roomId, '⚔ Tutti pronti: la caccia comincia!');
            }
          }
          // il Sistema (Sistema.js) riceve il turno di pulizia
          BUS.emit('cleaner', players);
          // annullamento per disconnessioni (mai dopo una vittoria)
          if(room && room.phase !== 'fine' && !room.winner){
            const connessi = players.filter(isFresh);
            if(connessi.length < 3){ await cancelGame(); return; }
          }
        }
        lastPlayers = players;
        if(!document.hidden){
          renderPlayers(players);
          BUS.emit('players', players);
          aggiornaAttesa(players);
        }
      }

      if(document.hidden){ schedule(); return; }
      await refreshChat();

      if(beatN % PRESENCE_EVERY === 2){
        const st = await db.from('rooms')
          .select('status, host_uid, phase, started_at, winner, clue, next_kill_at, last_kill_at, last_kill_uid, indagini_usate, skip_usati')
          .eq('id', roomId).maybeSingle();
        if(st.data){
          Object.assign(room, st.data);
          if(room.phase === 'fine'){ mostraFine(); BUS.emit('room', room); return; }
          if(room.status !== 'playing'){ location.replace('lobby.html'); return; }
          if(room.phase === 'live'){
            el.overlayAttesa.hidden = true;
            if(!timerStarted && room.started_at){ startTimer(room.started_at); timerStarted = true; }
          }
          const nowHost = (room.host_uid === uid);
          if(nowHost !== isHost){
            isHost = nowHost;
            if(isHost) showToast('♛ Sei tu il nuovo capo stanza!');
          }
          BUS.emit('room', room);
        } else {
          running = false;
          showToast('La stanza è stata chiusa', false);
          clearCurrentRoom();
          setTimeout(function(){ location.replace('index.html'); }, 1800);
          return;
        }
      }
    }catch(err){
      console.warn('[PARTITA] heartbeat:', err);
    }
    schedule();
  }

  function schedule(){ setTimeout(beat, HEARTBEAT_MS); }

  function aggiornaAttesa(players){
    if(!room || room.phase !== 'reveal' || !readySent) return;
    const freschi = players.filter(isFresh);
    const pronti = freschi.filter(function(p){ return p.ready === true; });
    el.attesaCount.textContent = pronti.length + '/' + freschi.length;
  }

  function iAmCleaner(players){
    const me = players.find(function(p){ return p.uid === uid; });
    if(!me || me.alive === false) return false;
    if(isHost && isFresh(me)) return true;
    const host = players.find(function(p){ return p.is_host; });
    if(host && isFresh(host) && host.alive !== false) return false;
    const vivi = players
      .filter(function(p){ return p.online && isFresh(p) && p.alive !== false; })
      .sort(function(a, b){ return new Date(a.joined_at) - new Date(b.joined_at); });
    return vivi.length > 0 && vivi[0].uid === uid;
  }

  async function cleanup(players){
    const kept = [];
    for(const p of players){
      if(!isFresh(p)){
        const del = await db.from('players').delete().eq('id', p.id);
        if(!del.error){
          await sysMessage(roomId, escapeHtml(p.name) + ' ha perso la connessione.');
          seenPlayers.delete(p.uid);
        } else { kept.push(p); }
      } else { kept.push(p); }
    }
    return kept;
  }

  function renderPlayers(players){
    const presenti = players
      .filter(function(p){ return p.online !== false; })
      .sort(function(a, b){
        return ((b.alive !== false) - (a.alive !== false))
            || (b.is_host - a.is_host)
            || (new Date(a.joined_at) - new Date(b.joined_at));
      });
    const inGioco = presenti.filter(function(p){ return p.alive !== false; }).length;
    el.playerCount.textContent = inGioco + ' agenti in gioco';
    el.playerList.innerHTML = '';
    for(const p of presenti){
      const isNew = !seenPlayers.has(p.uid);
      seenPlayers.add(p.uid);
      const dead = (p.alive === false);
      const li = document.createElement('li');
      li.className = 'player' + (p.is_host ? ' host' : '') + (isNew ? ' new' : '') + (dead ? ' eliminated' : '');
      const avatar = document.createElement('div');
      avatar.className = 'avatar';
      avatar.textContent = dead ? '†' : p.name.charAt(0).toUpperCase();
      const meta = document.createElement('div');
      meta.className = 'p-meta';
      meta.innerHTML =
        '<span class="p-name">' + escapeHtml(p.name) + '</span>' +
        '<span class="p-device">' + deviceText(p) + '</span>' +
        (p.uid === uid ? '<span class="p-you">(TU)</span>' : '') +
        (dead ? '<span class="badge-dead">VITTIMA</span>' : '') +
        (room && room.phase === 'reveal' && p.ready === true ? '<span class="badge-ready">PRONTO</span>' : '') +
        (p.is_host ? '<span class="badge-host">CAPO STANZA</span>' : '');
      const dot = document.createElement('span');
      dot.className = 'dot ' + (dead ? 'off' : 'on');
      li.appendChild(avatar); li.appendChild(meta); li.appendChild(dot);
      el.playerList.appendChild(li);
    }
  }

  // ---------------- chat ----------------
  async function refreshChat(){
    const res = await db.from('chat_messages').select()
      .eq('room_id', roomId).order('id', { ascending: true }).limit(200);
    if(res.error || !res.data) return;
    const msgs = res.data;
    const newest = msgs.length ? msgs[msgs.length - 1].id : 0;
    if(newest === lastChatId) return;
    lastChatId = newest;
    const near = el.chatLog.scrollHeight - el.chatLog.scrollTop - el.chatLog.clientHeight < 90;
    el.chatLog.innerHTML = '';
    for(const m of msgs){
      const div = document.createElement('div');
      if(m.is_system){ div.className = 'msg system'; div.textContent = m.message; }
      else {
        div.className = 'msg' + (m.sender === myName ? ' mine' : '');
        const who = document.createElement('span');
        who.className = 'who';
        who.textContent = m.sender + (m.sender === myName ? ' · TU' : '');
        div.appendChild(who);
        div.appendChild(document.createTextNode(m.message));
      }
      el.chatLog.appendChild(div);
    }
    if(near) el.chatLog.scrollTop = el.chatLog.scrollHeight;
  }

  el.chatForm.addEventListener('submit', async function(e){
    e.preventDefault();
    const text = el.chatInput.value.trim();
    if(!text) return;
    el.chatInput.value = '';
    await db.from('chat_messages').insert({ room_id: roomId, sender: myName, message: text, is_system: false });
    refreshChat();
  });

  // ---------------- copia codice ----------------
  el.codeChip.addEventListener('click', async function(){
    const code = el.codeText.textContent.trim();
    try{ await navigator.clipboard.writeText(code); }
    catch(e){
      const ta = document.createElement('textarea');
      ta.value = code; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy'); ta.remove();
    }
    el.codeChip.classList.add('copied');
    el.copyHint.textContent = 'COPIATO ✓';
    showToast('Codice ' + code + ' copiato');
    setTimeout(function(){ el.codeChip.classList.remove('copied'); el.copyHint.textContent = 'Copia'; }, 1600);
  });

  // ---------------- esci (Politica A) ----------------
  el.btnExit.addEventListener('click', async function(){
    running = false;
    try{
      const pl = await db.from('players').select().eq('room_id', roomId);
      const altri = (pl.data || []).filter(function(p){ return p.uid !== uid && isFresh(p); });
      if(altri.length === 0){
        await db.from('rooms').delete().eq('id', roomId);
      } else {
        if(isHost) await promoteNewHost(altri);
        await db.from('players').delete().eq('room_id', roomId).eq('uid', uid);
        await sysMessage(roomId, escapeHtml(myName) + ' ha abbandonato la partita.');
      }
    }catch(e){}
    clearCurrentRoom();
    location.href = 'index.html';
  });
})();