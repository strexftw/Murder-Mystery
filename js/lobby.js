/* =========================================================
   LOBBY.JS — file di logica della lobby (lobby.html)
   heartbeat 0.5s · lista giocatori · chat · avvio (solo host)
   ========================================================= */
(function(){
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

  let isHost = false, running = true, beatN = 0, lastChatId = 0;
  const seenPlayers = new Set();

  /* paint immediato con i dati salvati (poi init conferma dal DB) */
  el.roomName.textContent = stored.name || '…';
  el.codeText.textContent = stored.code || '······';

  init();

  async function init(){
    try{
      const res = await db.from('rooms').select('*').eq('id', roomId).maybeSingle();
      if(res.error || !res.data){ clearCurrentRoom(); location.replace('index.html'); return; }
      const room = res.data;

      el.roomName.textContent = room.name;
      el.codeText.textContent = room.code;
      isHost = room.host_uid === uid;
      el.hostZone.hidden = !isHost;
      el.waitNote.hidden = isHost;

      if(room.status === 'playing'){ startOverlay(); return; }

      await ensurePresence();
      beat();
    }catch(err){
      console.error(err);
      showToast('Errore di connessione a Supabase', false);
    }
  }

  /* se il mio giocatore non esiste più (es. rientro), lo ricreo */
  async function ensurePresence(){
    const me = await db.from('players')
      .select('id').eq('room_id', roomId).eq('uid', uid).maybeSingle();
    if(me.data){
      await db.from('players').update({
        online: true, name: myName, last_seen: new Date().toISOString()
      }).eq('id', me.data.id);
    } else {
      await db.from('players').insert({
        room_id: roomId, uid, name: myName, is_host: isHost,
        online: true, last_seen: new Date().toISOString()
      });
      await sysMessage(roomId, `${escapeHtml(myName)} è rientrato nella stanza.`);
    }
  }

  /* ---------------- HEARTBEAT (ogni 0.5s) ---------------- */
  async function beat(){
    if(!running) return;
    beatN++;
    try{
      /* 1) il mio battito: ogni ~2s (non serve a ogni beat, risparmia query) */
      if(beatN % PRESENCE_EVERY === 1){
        await db.from('players').update({
          online: true, last_seen: new Date().toISOString()
        }).eq('room_id', roomId).eq('uid', uid);
      }

      /* 2) tab nascosta: il cuore batte, ma non aggiorno la grafica */
      if(document.hidden){ schedule(); return; }

      /* 3) lista giocatori — aggiornata ogni 0.5s */
      const pl = await db.from('players').select('*').eq('room_id', roomId);
      if(pl.data){
        const players = isHost ? await hostCleanup(pl.data) : pl.data;
        renderPlayers(players);
      }

      /* 4) chat */
      await refreshChat();

      /* 5) controllo avvio partita (ogni ~2s) */
      if(beatN % PRESENCE_EVERY === 2){
        const st = await db.from('rooms').select('status').eq('id', roomId).maybeSingle();
        if(st.data && st.data.status === 'playing'){ startOverlay(); return; }
      }
    }catch(err){ console.warn('heartbeat:', err); }
    schedule();
  }
  function schedule(){ setTimeout(beat, HEARTBEAT_MS); }

  /* Solo il CAPO STANZA rileva disconnessioni/ritorni:
     così i messaggi di sistema non vengono duplicati dai vari client.
     Chi chiude il tab senza salutare sparisce dopo OFFLINE_AFTER_MS. */
  async function hostCleanup(players){
    const now = Date.now();
    for(const p of players){
      const stale = now - Date.parse(p.last_seen) > OFFLINE_AFTER_MS;
      if(p.online && stale){
        await db.from('players').update({ online: false }).eq('id', p.id);
        await sysMessage(roomId, `${escapeHtml(p.name)} ha perso la connessione.`);
        p.online = false;
      } else if(!p.online && !stale){
        await db.from('players').update({ online: true }).eq('id', p.id);
        await sysMessage(roomId, `${escapeHtml(p.name)} è tornato in linea.`);
        p.online = true;
      }
    }
    return players;
  }

  /* ---------------- LISTA GIOCATORI ---------------- */
  function renderPlayers(players){
    players.sort((a, b) =>
      (b.is_host - a.is_host) ||
      (a.online === b.online
        ? new Date(a.joined_at) - new Date(b.joined_at)
        : (a.online ? -1 : 1))
    );

    const online = players.filter(p => p.online).length;
    el.playerCount.textContent = `${online} in linea · ${players.length} agenti`;

    el.playerList.innerHTML = '';
    for(const p of players){
      const isNew = !seenPlayers.has(p.uid);
      seenPlayers.add(p.uid);

      const li = document.createElement('li');
      li.className = 'player'
        + (p.is_host ? ' host' : '')
        + (p.online ? '' : ' offline')
        + (isNew ? ' new' : '');

      const avatar = document.createElement('div');
      avatar.className = 'avatar';
      avatar.textContent = p.name.charAt(0).toUpperCase();

      const meta = document.createElement('div');
      meta.className = 'p-meta';
      meta.innerHTML =
        `<span class="p-name">${escapeHtml(p.name)}</span>` +
        (p.uid === uid ? `<span class="p-you">(TU)</span>` : '') +
        (p.is_host ? `<span class="badge-host">CAPO STANZA</span>` : '') +
        (!p.online ? `<span class="p-off">OFFLINE</span>` : '');

      const dot = document.createElement('span');
      dot.className = 'dot ' + (p.online ? 'on' : 'off');

      li.append(avatar, meta, dot);
      el.playerList.appendChild(li);
    }
  }

  /* ---------------- CHAT DI LOBBY ---------------- */
  async function refreshChat(){
    const res = await db.from('chat_messages').select('*')
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

  el.chatForm.addEventListener('submit', async e => {
    e.preventDefault();
    const text = el.chatInput.value.trim();
    if(!text) return;
    el.chatInput.value = '';
    await db.from('chat_messages').insert({
      room_id: roomId, sender: myName, message: text, is_system: false
    });
    refreshChat(); // mostra subito, senza aspettare il prossimo beat
  });

  /* ---------------- COPIA CODICE STANZA ---------------- */
  el.codeChip.addEventListener('click', async () => {
    const code = el.codeText.textContent.trim();
    try{
      await navigator.clipboard.writeText(code);
    }catch{
      const ta = document.createElement('textarea');
      ta.value = code; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy'); ta.remove();
    }
    el.codeChip.classList.add('copied');
    el.copyHint.textContent = 'COPIATO ✓';
    showToast('Codice ' + code + ' copiato: passalo agli altri agenti');
    setTimeout(() => {
      el.codeChip.classList.remove('copied');
      el.copyHint.textContent = 'COPIA';
    }, 1600);
  });

  /* ---------------- AVVIA PARTITA (solo host) ---------------- */
  let armed = false, armTimer = null;
  el.btnStart.addEventListener('click', async () => {
    if(!armed){ // doppia conferma anti-click accidentale
      armed = true;
      el.btnStart.textContent = 'Sicuro? Clicca di nuovo';
      el.btnStart.classList.add('armed');
      armTimer = setTimeout(() => {
        armed = false;
        el.btnStart.classList.remove('armed');
        el.btnStart.textContent = '☠ Avvia partita';
      }, 3000);
      return;
    }
    clearTimeout(armTimer);
    el.btnStart.disabled = true;
    await db.from('rooms').update({ status: 'playing' }).eq('id', roomId);
    await sysMessage(roomId, '☠ La partita sta per iniziare…');
    startOverlay();
  });

  function startOverlay(){
    running = false;
    el.overlay.hidden = false;
  }

  /* ---------------- ESCI ---------------- */
  el.btnExit.addEventListener('click', async () => {
    running = false;
    try{
      await db.from('players').update({ online: false })
        .eq('room_id', roomId).eq('uid', uid);
      await sysMessage(roomId, `${escapeHtml(myName)} ha abbandonato la stanza.`);
    }catch(e){}
    clearCurrentRoom();
    location.href = 'index.html';
  });

  /* chiusura tab: provo a segnalare l'uscita (poi ci pensa l'heartbeat) */
  window.addEventListener('beforeunload', () => {
    try{
      db.from('players').update({ online: false })
        .eq('room_id', roomId).eq('uid', uid);
    }catch(e){}
  });
})();