// LOBBY.JS v4.2 - logica della lobby (lobby.html)
// Stile anti-manomissione: solo commenti //, select() senza
// argomenti (equivale a tutte le colonne), apostrofi solo
// dentro virgolette doppie.
// Il capo assegna ruoli, codici e parola segreta all'avvio.
// heartbeat 0.5s, chat, successione capo, Politica A.
(function(){
  console.log('[LOBBY] lobby.js caricato v4.2');

  if(!guardConfig()) return;

  const uid    = getUid();
  const myName = getPlayerName() || 'Sconosciuto';
  const stored = getCurrentRoom();
  if(!stored){
    console.warn('[LOBBY] nessuna stanza salvata: torno al menu');
    location.replace('index.html');
    return;
  }

  const roomId = stored.id;

  const el = {
    roomName:    document.getElementById('roomName'),
    codeText:    document.getElementById('codeText'),
    codeChip:    document.getElementById('codeChip'),
    copyHint:    document.getElementById('copyHint'),
    btnExit:     document.getElementById('btnExit'),
    playerList:  document.getElementById('playerList'),
    playerCount: document.getElementById('playerCount'),
    hostZone:    document.getElementById('hostZone'),
    waitNote:    document.getElementById('waitNote'),
    btnStart:    document.getElementById('btnStart'),
    chatLog:     document.getElementById('chatLog'),
    chatForm:    document.getElementById('chatForm'),
    chatInput:   document.getElementById('chatInput'),
    overlay:     document.getElementById('overlay')
  };

  function loud(msg){
    console.error('[LOBBY]', msg);
    showToast(msg, false);
    const d = document.createElement('div');
    d.className = 'config-warning';
    d.textContent = '⚠ ' + msg;
    document.body.appendChild(d);
  }

  function explain(err){
    const m = (err && err.message) || String(err);
    if(/does not exist/i.test(m))     return 'tabelle mancanti: esegui database.sql.';
    if(/role|secret_word|started_at|alive/i.test(m)) return 'mancano le colonne della partita: esegui il nuovo database.sql.';
    if(/device/i.test(m))             return 'manca la colonna device: esegui la riga SQL alter table players.';
    if(/Failed to fetch|NetworkError/i.test(m)) return 'Supabase non raggiungibile.';
    if(/JWT|API key|apikey/i.test(m)) return 'anon key sbagliata in config.js.';
    return m;
  }

  const miss = Object.keys(el).filter(function(k){ return !el[k]; });
  if(miss.length){
    loud('lobby.html incompleta: mancano ' + miss.join(', '));
    return;
  }

  let isHost = false, running = true, beatN = 0, lastChatId = 0;
  let stayAtTable = false;
  const seenPlayers = new Set();

  el.roomName.textContent = stored.name || '…';
  el.codeText.textContent = stored.code || '······';

  function isFresh(p){
    return (Date.now() - Date.parse(p.last_seen)) <= OFFLINE_AFTER_MS;
  }
  function deviceText(p){
    return p.device ? deviceLabel(p.device) : '❓ Sconosciuto';
  }

  init();

  // ---------------- INIT ----------------
  async function init(){
    console.log('[LOBBY] init, cerco la stanza:', roomId);
    try{
      const res = await db.from('rooms').select().eq('id', roomId).maybeSingle();
      if(res.error){
        loud('Errore database: ' + explain(res.error) + ' (torno al menu tra 3s)');
        setTimeout(function(){ clearCurrentRoom(); location.replace('index.html'); }, 3000);
        return;
      }
      if(!res.data){
        loud('Stanza non trovata su Supabase (torno al menu tra 3s)');
        setTimeout(function(){ clearCurrentRoom(); location.replace('index.html'); }, 3000);
        return;
      }

      const room = res.data;
      console.log('[LOBBY] stanza trovata:', room.code, '- sono host?', room.host_uid === uid);

      el.roomName.textContent = room.name;
      el.codeText.textContent = room.code;
      isHost = room.host_uid === uid;
      el.hostZone.hidden = !isHost;
      el.waitNote.hidden = isHost;

      if(room.status === 'playing'){ startOverlay(); return; }

      await ensurePresence();
      beat();
    }catch(err){
      console.error('[LOBBY] init fallita:', err);
      loud('Errore di connessione: ' + explain(err));
    }
  }

  // se la mia riga non esiste piu (rimosso mentre ero via), la ricreo
  async function ensurePresence(){
    const me = await db.from('players')
      .select('id').eq('room_id', roomId).eq('uid', uid).maybeSingle();
    if(me.error){ console.warn('[LOBBY] ensurePresence select:', me.error); return; }

    if(me.data){
      await db.from('players').update({
        online: true, name: myName, device: getDeviceType(),
        last_seen: new Date().toISOString()
      }).eq('id', me.data.id);
    } else {
      const ins = await db.from('players').insert({
        room_id: roomId, uid: uid, name: myName, is_host: isHost,
        device: getDeviceType(),
        online: true, last_seen: new Date().toISOString()
      });
      if(ins.error){ console.error('[LOBBY] ensurePresence insert:', ins.error); return; }
      await sysMessage(roomId, escapeHtml(myName) + ' è rientrato nella stanza.');
      console.log('[LOBBY] riga giocatore ricreata');
    }
  }

  // ---------------- SUCCESSIONE DEL CAPO ----------------
  async function promoteNewHost(candidates){
    if(!candidates || !candidates.length) return null;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    console.log('[LOBBY] nuovo capo stanza proclamato:', pick.name);
    await db.from('rooms').update({ host_uid: pick.uid }).eq('id', roomId);
    await db.from('players').update({ is_host: false }).eq('room_id', roomId);
    await db.from('players').update({ is_host: true }).eq('id', pick.id);
    await sysMessage(roomId, '♛ ' + escapeHtml(pick.name) + ' è ora il capo stanza.');
    return pick;
  }

  // ---------------- HEARTBEAT (ogni 0.5s) ----------------
  async function beat(){
    if(!running) return;
    beatN++;
    try{
      // 1) il mio battito: riscrive sempre anche il dispositivo
      if(beatN % PRESENCE_EVERY === 1){
        const t = await db.from('players')
          .update({ online: true, device: getDeviceType(), last_seen: new Date().toISOString() })
          .eq('room_id', roomId).eq('uid', uid)
          .select('id');
        if(!t.error && t.data && t.data.length === 0){
          console.log('[LOBBY] ero stato rimosso dal tavolo: rientro');
          await ensurePresence();
        }
      }

      // 2) scheda nascosta: il cuore batte, la grafica no
      if(document.hidden){ schedule(); return; }

      // 3) lista giocatori (aggiornata ogni 0.5s)
      const pl = await db.from('players').select().eq('room_id', roomId);
      if(!pl.error && pl.data){
        let players = pl.data;
        if(iAmCleaner(players)){
          players = await cleanup(players);
          const hostAlive = players.some(function(p){ return p.is_host; });
          if(!hostAlive && players.length){
            const pick = await promoteNewHost(players);
            if(pick){
              players.forEach(function(q){ q.is_host = (q.uid === pick.uid); });
            }
          }
        }
        renderPlayers(players);
      }

      // 4) chat
      await refreshChat();

      // 5) stato stanza + sincronizzazione del mio ruolo di capo
      if(beatN % PRESENCE_EVERY === 2){
        const st = await db.from('rooms')
          .select('status, host_uid').eq('id', roomId).maybeSingle();
        if(st.data){
          if(st.data.status === 'playing'){ startOverlay(); return; }
          const nowHost = (st.data.host_uid === uid);
          if(nowHost !== isHost){
            isHost = nowHost;
            el.hostZone.hidden = !isHost;
            el.waitNote.hidden = isHost;
            console.log('[LOBBY] ruolo capo stanza aggiornato:', isHost);
            if(isHost) showToast('♛ Sei tu il nuovo capo stanza!');
          }
        }
      }
    }catch(err){
      console.warn('[LOBBY] heartbeat:', err);
    }
    schedule();
  }

  function schedule(){ setTimeout(beat, HEARTBEAT_MS); }

  // Chi fa le pulizie: il capo vivo; se il capo e un fantasma
  // (o non c'e), il giocatore VIVO in linea da piu tempo.
  function iAmCleaner(players){
    const me = players.find(function(p){ return p.uid === uid; });
    if(!me) return false;
    if(isHost && isFresh(me)) return true;

    const host = players.find(function(p){ return p.is_host; });
    const hostFresh = host && isFresh(host);
    if(hostFresh) return false;

    const vivi = players
      .filter(function(p){ return p.online && isFresh(p); })
      .sort(function(a, b){ return new Date(a.joined_at) - new Date(b.joined_at); });
    return vivi.length > 0 && vivi[0].uid === uid;
  }

  // chi non batte piu da OFFLINE_AFTER_MS viene tolto dal tavolo
  async function cleanup(players){
    const kept = [];
    for(const p of players){
      if(!isFresh(p)){
        const del = await db.from('players').delete().eq('id', p.id);
        if(del.error){
          console.warn('[LOBBY] rimozione fallita per', p.name, del.error);
          kept.push(p);
        } else {
          await sysMessage(roomId, escapeHtml(p.name) + ' ha perso la connessione.');
          seenPlayers.delete(p.uid);
          console.log('[LOBBY] rimosso dal tavolo:', p.name);
        }
      } else {
        kept.push(p);
      }
    }
    return kept;
  }

  // ---------------- LISTA GIOCATORI ----------------
  function renderPlayers(players){
    const presenti = players
      .filter(function(p){ return p.online !== false; })
      .sort(function(a, b){
        return (b.is_host - a.is_host) || (new Date(a.joined_at) - new Date(b.joined_at));
      });

    el.playerCount.textContent = presenti.length + ' agenti al tavolo';
    el.playerList.innerHTML = '';

    for(const p of presenti){
      const isNew = !seenPlayers.has(p.uid);
      seenPlayers.add(p.uid);

      const li = document.createElement('li');
      li.className = 'player' + (p.is_host ? ' host' : '') + (isNew ? ' new' : '');

      const avatar = document.createElement('div');
      avatar.className = 'avatar';
      avatar.textContent = p.name.charAt(0).toUpperCase();

      const meta = document.createElement('div');
      meta.className = 'p-meta';
      meta.innerHTML =
        '<span class="p-name">' + escapeHtml(p.name) + '</span>' +
        '<span class="p-device">' + deviceText(p) + '</span>' +
        (p.uid === uid ? '<span class="p-you">(TU)</span>' : '') +
        (p.is_host ? '<span class="badge-host">CAPO STANZA</span>' : '');

      const dot = document.createElement('span');
      dot.className = 'dot on';

      li.appendChild(avatar);
      li.appendChild(meta);
      li.appendChild(dot);
      el.playerList.appendChild(li);
    }
  }

  // ---------------- CHAT ----------------
  async function refreshChat(){
    const res = await db.from('chat_messages').select()
      .eq('room_id', roomId).order('id', { ascending: true }).limit(200);
    if(res.error || !res.data) return;

    const msgs = res.data;
    const newest = msgs.length ? msgs[msgs.length - 1].id : 0;
    if(newest === lastChatId) return;
    lastChatId = newest;

    const nearBottom =
      el.chatLog.scrollHeight - el.chatLog.scrollTop - el.chatLog.clientHeight < 90;

    el.chatLog.innerHTML = '';
    for(const m of msgs){
      const div = document.createElement('div');
      if(m.is_system){
        div.className = 'msg system';
        div.textContent = m.message;
      } else {
        div.className = 'msg' + (m.sender === myName ? ' mine' : '');
        const who = document.createElement('span');
        who.className = 'who';
        who.textContent = m.sender + (m.sender === myName ? ' · TU' : '');
        div.appendChild(who);
        div.appendChild(document.createTextNode(m.message));
      }
      el.chatLog.appendChild(div);
    }
    if(nearBottom) el.chatLog.scrollTop = el.chatLog.scrollHeight;
  }

  el.chatForm.addEventListener('submit', async function(e){
    e.preventDefault();
    const text = el.chatInput.value.trim();
    if(!text) return;
    el.chatInput.value = '';
    await db.from('chat_messages').insert({
      room_id: roomId, sender: myName, message: text, is_system: false
    });
    refreshChat();
  });

  // ---------------- COPIA CODICE ----------------
  el.codeChip.addEventListener('click', async function(){
    const code = el.codeText.textContent.trim();
    try{
      await navigator.clipboard.writeText(code);
    }catch(e){
      const ta = document.createElement('textarea');
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    el.codeChip.classList.add('copied');
    el.copyHint.textContent = 'COPIATO ✓';
    showToast('Codice ' + code + ' copiato: passalo agli altri agenti');
    setTimeout(function(){
      el.codeChip.classList.remove('copied');
      el.copyHint.textContent = 'COPIA';
    }, 1600);
  });

  // ---------------- AVVIA PARTITA (solo host) ----------------
  let armed = false, armTimer = null;
  el.btnStart.addEventListener('click', async function(){
    if(!armed){
      armed = true;
      el.btnStart.textContent = 'Sicuro? Clicca di nuovo';
      el.btnStart.classList.add('armed');
      armTimer = setTimeout(function(){
        armed = false;
        el.btnStart.classList.remove('armed');
        el.btnStart.textContent = 'Avvia la partita';
      }, 3000);
      return;
    }
    clearTimeout(armTimer);
    armed = false;
    el.btnStart.disabled = true;
    el.btnStart.classList.remove('armed');
    el.btnStart.textContent = '… assegnazione ruoli';
    await startGame();
  });

  function resetStartButton(){
    el.btnStart.disabled = false;
    el.btnStart.classList.remove('armed');
    el.btnStart.textContent = 'Avvia la partita';
  }

  // ASSEGNAZIONE RUOLI (solo il capo la esegue):
  // mescola i vivi, 1 assassino + 1 detective + resto innocenti,
  // codice unico per ognuno, ruolo offuscato con l'uid,
  // parola segreta offuscata con l'id stanza, status playing.
  async function startGame(){
    try{
      const res = await db.from('players').select().eq('room_id', roomId);
      if(res.error) throw res.error;

      const vivi = (res.data || []).filter(function(p){ return p.online && isFresh(p); });
      if(vivi.length < 3){
        showToast('Servono almeno 3 agenti al tavolo per giocare', false);
        resetStartButton();
        return;
      }

      const mescolati = vivi.slice();
      const rnd = new Uint32Array(mescolati.length);
      crypto.getRandomValues(rnd);
      for(let i = mescolati.length - 1; i > 0; i--){
        const j = rnd[i] % (i + 1);
        const tmp = mescolati[i]; mescolati[i] = mescolati[j]; mescolati[j] = tmp;
      }

      const usati = new Set();
      for(let i = 0; i < mescolati.length; i++){
        const ruolo = (i === 0) ? 'assassino' : (i === 1) ? 'detective' : 'innocente';
        let code;
        do { code = generatePlayerCode(); } while(usati.has(code));
        usati.add(code);
        const up = await db.from('players').update({
          role:  scramble(ruolo, mescolati[i].uid),
          code:  code,
          alive: true
        }).eq('id', mescolati[i].id);
        if(up.error) throw up.error;
        console.log('[LOBBY]', mescolati[i].name, '→ ruolo assegnato, codice', code);
      }

      const word = pickSecretWord();
      const rm = await db.from('rooms').update({
        status:      'playing',
        started_at:  new Date().toISOString(),
        secret_word: scramble(word, roomId)
      }).eq('id', roomId);
      if(rm.error) throw rm.error;

      await sysMessage(roomId, '☠ La partita sta per iniziare…');
      console.log('[LOBBY] partita avviata con', mescolati.length, 'giocatori');
      startOverlay();
    }catch(err){
      console.error('[LOBBY] avvio fallito:', err);
      showToast('Avvio fallito: ' + explain(err), false);
      resetStartButton();
    }
  }

  // overlay + passaggio a partita.html per TUTTI
  function startOverlay(){
    running = false;
    stayAtTable = true;
    el.overlay.hidden = false;
    setTimeout(function(){ location.href = 'partita.html'; }, 2400);
  }

  // ---------------- ESCI (Politica A) ----------------
  el.btnExit.addEventListener('click', async function(){
    running = false;
    try{
      const pl = await db.from('players').select().eq('room_id', roomId);
      const altriVivi = (pl.data || []).filter(function(p){
        return p.uid !== uid && isFresh(p);
      });

      if(altriVivi.length === 0){
        console.log("[LOBBY] ero l'ultimo giocatore: elimino la stanza");
        await db.from('rooms').delete().eq('id', roomId);
      } else {
        if(isHost){
          await promoteNewHost(altriVivi);
        }
        await db.from('players').delete().eq('room_id', roomId).eq('uid', uid);
        await sysMessage(roomId, escapeHtml(myName) + ' ha abbandonato la stanza.');
      }
    }catch(e){}
    clearCurrentRoom();
    location.href = 'index.html';
  });

  // chiusura scheda: mi rimuovo subito se posso.
  // Con partita avviata (stayAtTable) NON rimuovo: il redirect non e un abbandono.
  window.addEventListener('beforeunload', function(){
    if(stayAtTable) return;
    try{
      db.from('players').delete().eq('room_id', roomId).eq('uid', uid);
    }catch(e){}
  });
})();