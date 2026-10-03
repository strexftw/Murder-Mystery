/* =========================================================
   PARTITA.JS — logica della partita (partita.html)
   v1.0: rivelazione privata del ruolo (carta che si gira),
   codice di riconoscimento personale, parola segreta
   (nascosta all'assassino), timer di partita, tavolo vivo,
   chat. Heartbeat 0.5s · successione capo · Politica A.
   I segreti nel DB sono offuscati (scramble): il ruolo si
   decifra solo con il proprio uid, la parola solo con
   l'id della stanza — e l'assassino non la decifra mai.
   ========================================================= */
(function(){
  console.log('[PARTITA] partita.js caricato');

  if(!guardConfig()) return;

  const uid    = getUid();
  const myName = getPlayerName() || 'Sconosciuto';
  const stored = getCurrentRoom();
  if(!stored){
    console.warn('[PARTITA] nessuna stanza salvata: torno al menu');
    location.replace('index.html');
    return;
  }
  const roomId = stored.id;

  const el = {
    roomName:      document.getElementById('roomName'),
    codeText:      document.getElementById('codeText'),
    codeChip:      document.getElementById('codeChip'),
    copyHint:      document.getElementById('copyHint'),
    btnExit:       document.getElementById('btnExit'),
    timerText:     document.getElementById('timerText'),
    roleTag:       document.getElementById('roleTag'),
    myRole:        document.getElementById('myRole'),
    myCode:        document.getElementById('myCode'),
    myWordRow:     document.getElementById('myWordRow'),
    myWord:        document.getElementById('myWord'),
    myHint:        document.getElementById('myHint'),
    playerList:    document.getElementById('playerList'),
    playerCount:   document.getElementById('playerCount'),
    chatLog:       document.getElementById('chatLog'),
    chatForm:      document.getElementById('chatForm'),
    chatInput:     document.getElementById('chatInput'),
    reveal:        document.getElementById('reveal'),
    flipCard:      document.getElementById('flipCard'),
    revealRole:    document.getElementById('revealRole'),
    revealDesc:    document.getElementById('revealDesc'),
    revealCode:    document.getElementById('revealCode'),
    revealWordRow: document.getElementById('revealWordRow'),
    revealWord:    document.getElementById('revealWord'),
    btnEnter:      document.getElementById('btnEnter')
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
    if(/does not exist/i.test(m))     return 'tabelle mancanti: esegui database.sql.';
    if(/role|secret_word|started_at|alive/i.test(m)) return 'mancano le colonne della partita: esegui il nuovo database.sql.';
    if(/Failed to fetch|NetworkError/i.test(m)) return 'Supabase non raggiungibile.';
    if(/JWT|API key|apikey/i.test(m)) return 'anon key sbagliata in config.js.';
    return m;
  }

  const miss = Object.keys(el).filter(function(k){ return !el[k]; });
  if(miss.length){
    loud('partita.html incompleta: mancano ' + miss.join(', '));
    return;
  }

  /* ---------------- RUOLI ---------------- */
  const ROLE_INFO = {
    assassino: {
      tag:  'Assassino',
      desc: 'Colpisci nell\'ombra e non farti scoprire. Gli altri conoscono una parola segreta: osserva, ascolta e fingi di conoscerla anche tu.'
    },
    detective: {
      tag:  'Detective',
      desc: 'Conosci la parola segreta. Usala per riconoscere gli innocenti e smascherare l\'assassino prima che colpisca.'
    },
    innocente: {
      tag:  'Innocente',
      desc: 'Conosci la parola segreta. Diffida di chi non sa ripeterla: l\'assassino è seduto al tuo stesso tavolo.'
    }
  };

  let running = true, beatN = 0, lastChatId = 0;
  let room = null;
  let myRole = 'innocente', myCode = '—', myWord = null;
  let isHost = false;
  const seenPlayers = new Set();

  /* un giocatore è "vivo" (connesso) se il suo battito è recente */
  function isFresh(p){
    return (Date.now() - Date.parse(p.last_seen)) <= OFFLINE_AFTER_MS;
  }
  function deviceText(p){
    return p.device ? deviceLabel(p.device) : '❓ Sconosciuto';
  }

  init();

  /* ---------------- INIT ---------------- */
  async function init(){
    console.log('[PARTITA] init, stanza:', roomId);
    try{
      const res = await db.from('rooms').select('*').eq('id', roomId).maybeSingle();
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
      room = res.data;

      /* la partita non è (più) in corso: torno dove devo stare */
      if(room.status !== 'playing'){
        location.replace(room.status === 'lobby' ? 'lobby.html' : 'index.html');
        return;
      }

      const meRes = await db.from('players').select('*')
        .eq('room_id', roomId).eq('uid', uid).maybeSingle();
      if(meRes.error || !meRes.data){
        console.warn('[PARTITA] non sono al tavolo: torno in lobby');
        location.replace('lobby.html');
        return;
      }

      isHost = room.host_uid === uid;

      /* decifro SOLO i miei segreti: la chiave del ruolo è il mio uid */
      myRole = unscramble(meRes.data.role, uid) || 'innocente';
      if(!ROLE_INFO[myRole]) myRole = 'innocente';
      myCode = meRes.data.code || '—';
      /* la parola la decifro solo se NON sono l'assassino */
      myWord = (myRole === 'assassino') ? null
                                       : unscramble(room.secret_word || '', roomId);

      console.log('[PARTITA] ruolo:', myRole, '| codice:', myCode, '| parola:', myWord ? 'sì' : 'no (assassino)');

      el.roomName.textContent = room.name;
      el.codeText.textContent = room.code;

      fillReveal();
      fillMyCard();
      startTimer(room.started_at);

      /* mostro la carta coperta, poi si gira da sola */
      el.reveal.hidden = false;
      setTimeout(function(){ el.flipCard.classList.add('flipped'); }, 650);

      beat();
    }catch(err){
      console.error('[PARTITA] init fallita:', err);
      loud('Errore di connessione: ' + explain(err));
    }
  }

  /* ---------------- RIVELAZIONE + LA TUA CARTA ---------------- */
  function fillReveal(){
    const info = ROLE_INFO[myRole];
    el.revealRole.textContent = info.tag;
    el.revealRole.className = 'reveal-role ' + myRole;
    el.revealDesc.textContent = info.desc;
    el.revealCode.textContent = myCode;
    if(myWord){
      el.revealWord.textContent = myWord;
      el.revealWordRow.hidden = false;
    } else {
      el.revealWordRow.hidden = true;
    }
  }

  function fillMyCard(){
    const info = ROLE_INFO[myRole];
    el.roleTag.textContent = info.tag;
    el.roleTag.className = 'count role-tag ' + myRole;
    el.myRole.textContent = info.tag;
    el.myRole.className = 'my-role ' + myRole;
    el.myCode.textContent = myCode;
    if(myWord){
      el.myWord.textContent = myWord;
      el.myWordRow.hidden = false;
    } else {
      el.myWordRow.hidden = true;
    }
    el.myHint.textContent = info.desc;
  }

  el.btnEnter.addEventListener('click', function(){
    el.reveal.hidden = true;
    showToast('Buona caccia, ' + myName);
  });

  /* ---------------- TIMER (uguale per tutti: parte da started_at) ---------------- */
  function startTimer(startedAt){
    const t0 = Date.parse(startedAt) || Date.now();
    const pad = function(n){ return String(n).padStart(2, '0'); };
    const tick = function(){
      const s  = Math.max(0, Math.floor((Date.now() - t0) / 1000));
      const h  = Math.floor(s / 3600);
      const m  = Math.floor((s % 3600) / 60);
      const ss = s % 60;
      el.timerText.textContent = h
        ? h + ':' + pad(m) + ':' + pad(ss)
        : pad(m) + ':' + pad(ss);
    };
    tick();
    setInterval(function(){ if(running) tick(); }, 1000);
  }

  /* ---------------- SUCCESSIONE DEL CAPO ---------------- */
  async function promoteNewHost(candidates){
    if(!candidates || !candidates.length) return null;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    console.log('[PARTITA] nuovo capo stanza proclamato:', pick.name);

    await db.from('rooms').update({ host_uid: pick.uid }).eq('id', roomId);
    await db.from('players').update({ is_host: false }).eq('room_id', roomId);
    await db.from('players').update({ is_host: true }).eq('id', pick.id);
    await sysMessage(roomId, '♛ ' + escapeHtml(pick.name) + ' è ora il capo stanza.');
    return pick;
  }

  /* ---------------- HEARTBEAT (ogni 0.5s) ---------------- */
  async function beat(){
    if(!running) return;
    beatN++;
    try{
      /* 1) il mio battito. Se la mia riga è sparita, sono stato
            rimosso dal tavolo: esco dalla partita */
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

      /* 2) scheda nascosta: il cuore batte, la grafica no */
      if(document.hidden){ schedule(); return; }

      /* 3) il tavolo */
      const pl = await db.from('players').select('*').eq('room_id', roomId);
      if(!pl.error && pl.data){
        let players = pl.data;
        if(iAmCleaner(players)){
          players = await cleanup(players);

          /* se il capo non è più tra noi, proclamane uno nuovo a caso */
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

      /* 4) chat */
      await refreshChat();

      /* 5) stato stanza: chiusa? tornata in lobby? cambio capo? */
      if(beatN % PRESENCE_EVERY === 2){
        const st = await db.from('rooms')
          .select('status, host_uid').eq('id', roomId).maybeSingle();
        if(st.data){
          if(st.data.status !== 'playing'){ location.replace('lobby.html'); return; }
          const nowHost = (st.data.host_uid === uid);
          if(nowHost !== isHost){
            isHost = nowHost;
            if(isHost) showToast('♛ Sei tu il nuovo capo stanza!');
          }
        } else {
          /* stanza cancellata (l'ultimo uscito ha spento la luce) */
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

  /* Chi fa le pulizie: il capo stanza vivo; se il capo è un fantasma
     (o non c'è), il giocatore VIVO in linea da più tempo. */
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

  /* chi non batte più da OFFLINE_AFTER_MS viene tolto dal tavolo */
  async function cleanup(players){
    const kept = [];
    for(const p of players){
      if(!isFresh(p)){
        const del = await db.from('players').delete().eq('id', p.id);
        if(del.error){
          console.warn('[PARTITA] rimozione fallita per', p.name, del.error);
          kept.push(p);
        } else {
          await sysMessage(roomId, escapeHtml(p.name) + ' ha perso la connessione.');
          seenPlayers.delete(p.uid);
          console.log('[PARTITA] rimosso dal tavolo:', p.name);
        }
      } else {
        kept.push(p);
      }
    }
    return kept;
  }

  /* ---------------- IL TAVOLO (nessun ruolo visibile!) ---------------- */
  function renderPlayers(players){
    const presenti = players
      .filter(function(p){ return p.online !== false; })
      .sort(function(a, b){
        return ((b.alive !== false) - (a.alive !== false))     // prima i vivi
            || (b.is_host - a.is_host)                          // poi il capo
            || (new Date(a.joined_at) - new Date(b.joined_at)); // poi per ingresso
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
        (dead ? '<span class="badge-dead">ELIMINATO</span>' : '') +
        (p.is_host ? '<span class="badge-host">CAPO STANZA</span>' : '');

      const dot = document.createElement('span');
      dot.className = 'dot ' + (dead ? 'off' : 'on');

      li.appendChild(avatar);
      li.appendChild(meta);
      li.appendChild(dot);
      el.playerList.appendChild(li);
    }
  }

  /* ---------------- CHAT ---------------- */
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

  /* ---------------- COPIA CODICE ---------------- */
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
    showToast('Codice ' + code + ' copiato');
    setTimeout(function(){
      el.codeChip.classList.remove('copied');
      el.copyHint.textContent = 'COPIA';
    }, 1600);
  });

  /* ---------------- ESCI (Politica A) ---------------- */
  el.btnExit.addEventListener('click', async function(){
    running = false;
    try{
      const pl = await db.from('players').select('*').eq('room_id', roomId);
      const altriVivi = (pl.data || []).filter(function(p){
        return p.uid !== uid && isFresh(p);
      });

      if(altriVivi.length === 0){
        /* sono l'ultimo: spengo la luce */
        console.log('[PARTITA] ero l\'ultimo giocatore: elimino la stanza');
        await db.from('rooms').delete().eq('id', roomId);
      } else {
        if(isHost){
          await promoteNewHost(altriVivi);
        }
        await db.from('players').delete().eq('room_id', roomId).eq('uid', uid);
        await sysMessage(roomId, escapeHtml(myName) + ' ha abbandonato la partita.');
      }
    }catch(e){}
    clearCurrentRoom();
    location.href = 'index.html';
  });

  /* chiusura scheda durante la partita: NON cancello la mia riga qui
     (la richiesta non farebbe in tempo comunque); ci pensa la pulizia
     degli altri giocatori entro ~5s. */
})();
