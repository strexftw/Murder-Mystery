// PARTITA.JS v2.12 - motore Step 5 + intro + video di vittoria CON AUDIO.
// v2.12: i video partono con audio attivo; se il browser vieta
// l'autoplay sonoro compare "Tocca per riprodurre CON audio".
// Diagnostica in console: "video in riproduzione -> muted = ...".
// Ritmo prima vittima da config.js (CONFIG_FIRST_KILL_MS).
console.log('[PARTITA] partita.js caricato v2.12');
(function(){
  if(!guardConfig()) return;

  const uid    = getUid();
  const myName = getPlayerName() || 'Sconosciuto';
  const stored = getCurrentRoom();
  if(!stored){ location.replace('index.html'); return; }
  const roomId = stored.id;

  const FIRST_KILL_MS = (typeof CONFIG_FIRST_KILL_MS !== 'undefined') ? CONFIG_FIRST_KILL_MS : 20000;

  // nomi ESATTI dei video di vittoria nel bucket 'video'
  const WIN_VIDEO_ASSASSINO = 'Vittoria-assassino.mp4';
  const WIN_VIDEO_ISPETTORE = 'Vittoria-ispettore.mp4';

  const RUOLO_ICONA  = { assassino:'🗡️', detective:'🔍', innocente:'🛡️' };
  const RUOLO_ORDINE = { assassino:0, detective:1, innocente:2 };

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
    myCardLabel: document.getElementById('myCardLabel'),
    myCardId:    document.getElementById('myCardId'),
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
    if(/does not exist/i.test(m)) return 'tabelle mancanti: esegui database.txt.';
    if(/clue|next_kill_at|indagini_usate|skip_usati|card/i.test(m)) return 'mancano le colonne Step 5: esegui database.txt.';
    if(/ready|phase|winner|clue_read_at/i.test(m)) return 'mancano le colonne Step 4/7: esegui database.txt.';
    if(/Failed to fetch|NetworkError/i.test(m)) return 'Supabase non raggiungibile.';
    if(/JWT|API key|apikey/i.test(m)) return 'anon key sbagliata in config.js.';
    return m;
  }

  const miss = Object.keys(el).filter(function(k){ return !el[k]; });
  if(miss.length){ loud('partita.html incompleta: mancano ' + miss.join(', ')); return; }

  const ROLE_INFO = {
    assassino: { tag: 'Assassino', desc: "Sei l'ombra al tavolo. Nessuno lo sa, nemmeno tu: confonditi tra gli innocenti." },
    detective: { tag: 'Ispettore', desc: "Solo tu vedi l'indizio. Indaga, escludi, e quando sei pronto accusa: un solo tentativo." },
    innocente: { tag: 'Innocente', desc: "Una vittima cade ogni pochi secondi. Osserva, parla, sopravvivi." }
  };
  function ruoloVisto(r){ return (r === 'assassino') ? 'innocente' : r; }

  let running = true, beatN = 0, lastChatId = 0;
  let room = null, lastPlayers = [], myCard = null;
  let myRole = 'innocente', myCode = '—';
  let isHost = false, readySent = false, timerStarted = false, fineVista = false;
  let introInCorso = false;
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

  async function ensurePresence(){
    const me = await db.from('players')
      .select('id, role, code, card, ready').eq('room_id', roomId).eq('uid', uid).maybeSingle();
    if(me.error){ console.warn('[PARTITA] ensurePresence select:', me.error); return null; }
    if(me.data){
      await db.from('players').update({
        online: true, device: getDeviceType(), last_seen: new Date().toISOString()
      }).eq('id', me.data.id);
      return me.data;
    }
    const ins = await db.from('players').insert({
      room_id: roomId, uid: uid, name: myName, is_host: isHost,
      device: getDeviceType(), online: true, last_seen: new Date().toISOString()
    });
    if(ins.error){ console.warn('[PARTITA] ensurePresence insert:', ins.error); return null; }
    console.log('[PARTITA] riga giocatore ricreata in partita');
    const again = await db.from('players')
      .select('id, role, code, card, ready').eq('room_id', roomId).eq('uid', uid).maybeSingle();
    return again.data || null;
  }

  // ---------------- VIDEO: helper condivisi ----------------
  // collega skip / mute / tap e sorveglia lo stato audio
  function agganciaControlli(video, btnSkip, btnMute, tap, chiudi){
    btnSkip.addEventListener('click', chiudi);
    btnMute.addEventListener('click', function(){
      video.muted = !video.muted;
      btnMute.textContent = video.muted ? '🔇 Attiva audio' : '🔊 Muta';
    });
    tap.addEventListener('click', function(){
      tap.hidden = true;
      const p = video.play();
      if(p && p.catch) p.catch(function(){ chiudi(); });
    });
    video.addEventListener('ended', chiudi);
    video.addEventListener('error', chiudi);
    // DIAGNOSI: se parte muto, scoprilo e offri il toggle giusto
    video.addEventListener('playing', function(){
      console.log('[PARTITA] video in riproduzione -> muted =', video.muted);
      btnMute.textContent = video.muted ? '🔇 Attiva audio' : '🔊 Muta';
    });
  }

  // prova a partire CON audio; se il browser lo vieta, chiede un tap
  function riproduciConAudio(video, url, wrap, label){
    video.src = url;
    video.muted = false;
    video.defaultMuted = false;
    wrap.hidden = false;
    console.log('[PARTITA] riproduzione CON audio:', label);
    const p = video.play();
    if(p && p.catch){
      p.catch(function(){
        const tap = wrap.querySelector('.intro-tap');
        if(tap) tap.hidden = false;
      });
    }
  }

  // ---------------- INTRO VIDEO ----------------
  function costruisciIntro(){
    const wrap = document.createElement('div');
    wrap.className = 'overlay intro';
    wrap.id = 'overlayIntro';
    wrap.hidden = true;
    wrap.innerHTML =
      '<video id="introVideo" playsinline preload="auto"></video>' +
      '<button class="intro-btn intro-skip" id="btnSaltaIntro" type="button">Salta ›</button>' +
      '<button class="intro-btn intro-mute" id="btnIntroMute" type="button">🔊 Muta</button>' +
      '<button class="intro-tap" id="introTap" type="button" hidden>▶ Tocca per riprodurre CON audio</button>';
    document.body.appendChild(wrap);
    return wrap;
  }

  async function avviaIntro(done){
    introInCorso = true;
    const wrap    = costruisciIntro();
    const video   = document.getElementById('introVideo');
    const btnSkip = document.getElementById('btnSaltaIntro');
    const btnMute = document.getElementById('btnIntroMute');
    const tap     = document.getElementById('introTap');
    let chiuso = false;

    const chiudi = function(){
      if(chiuso) return;
      chiuso = true;
      introInCorso = false;
      try{ video.pause(); }catch(e){}
      wrap.hidden = true;
      done();
    };

    agganciaControlli(video, btnSkip, btnMute, tap, chiudi);
    setTimeout(chiudi, 120000);

    try{
      const nomeIntro = (typeof INTRO_FILE !== 'undefined' && INTRO_FILE) ? INTRO_FILE : 'intro.mp4';
      const res = db.storage.from('video').getPublicUrl(nomeIntro);
      const url = (res && res.data) ? res.data.publicUrl : null;
      if(!url){ chiudi(); return; }
      riproduciConAudio(video, url, wrap, nomeIntro);
    }catch(e){
      console.warn('[PARTITA] intro: storage non raggiungibile, salto', e);
      chiudi();
    }
  }

  // ---------------- VIDEO DI VITTORIA ----------------
  function costruisciVideoFine(){
    const wrap = document.createElement('div');
    wrap.className = 'overlay intro';
    wrap.id = 'overlayVideoFine';
    wrap.hidden = true;
    wrap.innerHTML =
      '<video id="fineVideo" playsinline preload="auto"></video>' +
      '<button class="intro-btn intro-skip" id="btnSaltaFine" type="button">Salta ›</button>' +
      '<button class="intro-btn intro-mute" id="btnFineMute" type="button">🔊 Muta</button>' +
      '<button class="intro-tap" id="fineTap" type="button" hidden>▶ Tocca per riprodurre CON audio</button>';
    document.body.appendChild(wrap);
    return wrap;
  }

  async function avviaVideoFine(winner, done){
    const wrap    = costruisciVideoFine();
    const video   = document.getElementById('fineVideo');
    const btnSkip = document.getElementById('btnSaltaFine');
    const btnMute = document.getElementById('btnFineMute');
    const tap     = document.getElementById('fineTap');
    let chiuso = false;

    const chiudi = function(){
      if(chiuso) return;
      chiuso = true;
      try{ video.pause(); }catch(e){}
      wrap.hidden = true;
      done();
    };

    agganciaControlli(video, btnSkip, btnMute, tap, chiudi);
    setTimeout(chiudi, 120000);

    try{
      const nome = (winner === 'assassino') ? WIN_VIDEO_ASSASSINO : WIN_VIDEO_ISPETTORE;
      const res = db.storage.from('video').getPublicUrl(nome);
      const url = (res && res.data) ? res.data.publicUrl : null;
      if(!url){ chiudi(); return; }
      riproduciConAudio(video, url, wrap, nome);
    }catch(e){
      console.warn('[PARTITA] video vittoria: storage non raggiungibile, salto', e);
      chiudi();
    }
  }

  init();

  async function init(){
    try{
      const res = await db.from('rooms').select().eq('id', roomId).maybeSingle();
      if(res.error){ loud('Errore database: ' + explain(res.error)); setTimeout(function(){ clearCurrentRoom(); location.replace('index.html'); }, 3000); return; }
      if(!res.data){ loud('Stanza non trovata (torno al menu tra 3s)'); setTimeout(function(){ clearCurrentRoom(); location.replace('index.html'); }, 3000); return; }
      room = res.data;
      if(room.status !== 'playing'){
        location.replace(room.status === 'lobby' ? 'lobby.html' : 'index.html');
        return;
      }

      let meRes = await db.from('players').select()
        .eq('room_id', roomId).eq('uid', uid).maybeSingle();
      if(meRes.error || !meRes.data){
        const recreated = await ensurePresence();
        if(!recreated){ location.replace('lobby.html'); return; }
        meRes = { data: recreated, error: null };
      }

      isHost = room.host_uid === uid;
      myRole = roleOf(meRes.data) || 'innocente';
      if(!ROLE_INFO[myRole]) myRole = 'innocente';
      myCode = meRes.data.code || '—';
      try{ myCard = JSON.parse(meRes.data.card || 'null'); }catch(e){ myCard = null; }

      el.roomName.textContent = room.name;
      el.codeText.textContent = room.code;

      if(room.phase === 'fine'){
        const plf = await db.from('players').select().eq('room_id', roomId);
        if(plf.data) lastPlayers = plf.data;
        mostraFine();
        return;
      }

      if(room.phase === 'live'){
        el.reveal.hidden = true;
        if(room.started_at){ startTimer(room.started_at); timerStarted = true; }
      } else if(meRes.data.ready === true){
        readySent = true;
        el.reveal.hidden = true;
        el.overlayAttesa.hidden = false;
      } else {
        avviaIntro(function(){
          fillReveal();
          el.reveal.hidden = false;
          setTimeout(function(){ el.flipCard.classList.add('flipped'); }, 650);
        });
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
    if(myCard){
      el.myCardLabel.hidden = false;
      el.myCardId.hidden = false;
      el.myCardId.innerHTML =
        '<div class="tab-voce">Nome: ' + escapeHtml(myCard.nome) + '</div>' +
        '<div class="tab-voce">Nascita: ' + escapeHtml(myCard.nascita) + ' — ' + escapeHtml(myCard.luogo) + '</div>' +
        '<div class="tab-voce">Lavoro: ' + escapeHtml(myCard.lavoro) + '</div>' +
        '<div class="tab-voce">Hobby: ' + escapeHtml(myCard.hobby) + '</div>' +
        '<div class="tab-voce">Altezza: ' + escapeHtml(myCard.altezza) + '</div>' +
        '<div class="tab-voce">Segno: ' + escapeHtml(myCard.extra) + '</div>' +
        '<div class="tab-voce">Codice fiscale: ' + escapeHtml(myCard.cf) + '</div>';
    }
  }

  el.btnEnter.addEventListener('click', async function(){
    if(readySent) return;
    if(introInCorso) return;
    readySent = true;
    el.btnEnter.disabled = true;
    await db.from('players').update({ ready: true })
      .eq('room_id', roomId).eq('uid', uid);
    el.reveal.hidden = true;
    el.overlayAttesa.hidden = false;
  });

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

  async function cancelGame(){
    if(!room || room.phase !== 'live') return;
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

  function rendiFineRuoli(players){
    const lista = (players || []).slice();
    lista.sort(function(a, b){
      const ra = roleOf(a), rb = roleOf(b);
      const oa = (RUOLO_ORDINE[ra] != null) ? RUOLO_ORDINE[ra] : 2;
      const ob = (RUOLO_ORDINE[rb] != null) ? RUOLO_ORDINE[rb] : 2;
      if(oa !== ob) return oa - ob;
      const va = (a.alive === false) ? 1 : 0;
      const vb = (b.alive === false) ? 1 : 0;
      if(va !== vb) return va - vb;
      return String(a.name).localeCompare(String(b.name));
    });
    el.fineRuoli.innerHTML = lista.map(function(p){
      const r     = roleOf(p);
      const cls   = 'ruolo-' + r;
      const icona = RUOLO_ICONA[r] || '👤';
      const tag   = (ROLE_INFO[r] ? ROLE_INFO[r].tag : r);
      const stato = (p.alive === false)
        ? '<span class="fine-stato caduto">† caduto</span>'
        : '<span class="fine-stato vivo">vivo</span>';
      return '<li class="fine-voce ' + cls + '">' +
        '<span class="fine-icona">' + icona + '</span>' +
        '<b>' + escapeHtml(p.name) + '</b>' +
        '<span class="fine-ruolo">' + escapeHtml(tag) + '</span>' +
        stato +
        '</li>';
    }).join('');
    console.log('[PARTITA] fine: renderizzati', lista.length, 'ruoli (nomi veri)');
  }

  // FINE: prima il VIDEO del vincitore (con audio), POI il tabellone.
  function mostraFine(){
    if(fineVista) return;
    fineVista = true;
    running = false;

    const j  = document.getElementById('jumpscare');    if(j)  j.hidden = true;
    const om = document.getElementById('overlayMorte'); if(om) om.hidden = true;
    const oi = document.getElementById('overlayIntro'); if(oi) oi.hidden = true;
    BUS.emit('fine');

    el.fineTitolo.textContent = winnerMsg(room.winner || 'assassino');
    rendiFineRuoli(lastPlayers);
    if(!lastPlayers || lastPlayers.length === 0){
      db.from('players').select().eq('room_id', roomId).then(function(r){
        if(r.data && r.data.length){
          lastPlayers = r.data;
          rendiFineRuoli(lastPlayers);
        }
      });
    }

    avviaVideoFine(room.winner || 'assassino', function(){
      el.overlayFine.hidden = false;
    });
  }

  el.btnFine.addEventListener('click', async function(){
    try{
      await db.from('rooms').update({ status: 'lobby' }).eq('id', roomId);
      await resetPartita(roomId);
    }catch(e){}
    location.replace('lobby.html');
  });

  async function beat(){
    if(!running) return;
    beatN++;
    try{
      if(beatN % PRESENCE_EVERY === 1){
        const t = await db.from('players')
          .update({ online: true, device: getDeviceType(), last_seen: new Date().toISOString() })
          .eq('room_id', roomId).eq('uid', uid).select('id');
        if(!t.error && t.data && t.data.length === 0){
          console.warn('[PARTITA] riga mancante: la ricreo');
          const rec = await ensurePresence();
          if(!rec){
            running = false;
            showToast('Sei stato rimosso dal tavolo', false);
            clearCurrentRoom();
            setTimeout(function(){ location.replace('index.html'); }, 1800);
            return;
          }
        }
      }

      const pl = await db.from('players').select().eq('room_id', roomId);
      if(!pl.error && pl.data){
        let players = pl.data;
        if(iAmCleaner(players)){
          if(room && room.phase === 'live'){
            players = await cleanup(players);
          }
          if(!introInCorso){
            if(room && room.phase === 'reveal'){
              const freschi = players.filter(isFresh);
              const pronti = freschi.filter(function(p){ return p.ready === true; });
              if(freschi.length > 0 && pronti.length >= freschi.length){
                const ora = new Date().toISOString();
                await db.from('rooms').update({
                  phase: 'live', started_at: ora,
                  next_kill_at: new Date(Date.now() + FIRST_KILL_MS).toISOString()
                }).eq('id', roomId);
                room.phase = 'live'; room.started_at = ora;
                await sysMessage(roomId, '⚔ Tutti pronti: la caccia comincia!');
              }
            }
            if(room && room.phase !== 'fine' && !room.winner){
              const connessi = players.filter(isFresh);
              if(connessi.length < 3){ await cancelGame(); }
            }
          }
          BUS.emit('cleaner', players);
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
          .select('status, host_uid, phase, started_at, winner, clue, next_kill_at, last_kill_at, last_kill_uid, indagini_usate, skip_usati, clue_read_at, last_victim_clue, assassin_card')
          .eq('id', roomId).maybeSingle();
        if(st.data){
          Object.assign(room, st.data);
          if(room.phase === 'fine'){ mostraFine(); BUS.emit('room', room); return; }
          if(room.status !== 'playing'){ location.replace('lobby.html'); return; }
          if(room.phase === 'live'){
            el.overlayAttesa.hidden = true;
            if(!timerStarted && room.started_at){ startTimer(room.started_at); timerStarted = true; }
          }
          isHost = (room.host_uid === uid);
          BUS.emit('room', room);
        } else {
          running = false;
          showToast('La stanza è stata chiusa', false);
          clearCurrentRoom();
          setTimeout(function(){ location.replace('index.html'); }, 1800);
          return;
        }
      }
    }catch(err){ console.warn('[PARTITA] heartbeat:', err); }
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

  el.btnExit.addEventListener('click', async function(){
    running = false;
    try{
      const pl = await db.from('players').select().eq('room_id', roomId);
      const altri = (pl.data || []).filter(function(p){ return p.uid !== uid && isFresh(p); });
      if(altri.length === 0){
        await db.from('rooms').delete().eq('id', roomId);
      } else {
        await db.from('players').delete().eq('room_id', roomId).eq('uid', uid);
        await sysMessage(roomId, escapeHtml(myName) + ' ha abbandonato la partita.');
      }
    }catch(e){}
    clearCurrentRoom();
    location.href = 'index.html';
  });
})();