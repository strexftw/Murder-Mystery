/* =========================================================
   MENU.JS — logica del menu (index.html)
   v3: Politica A — spazzino delle stanze morte + nessun
   nome precompilato + diagnostica visibile
   ========================================================= */
(function(){
  console.log('[MENU] menu.js caricato');

  if(!guardConfig()){
    console.warn('[MENU] Config Supabase mancante: pulsanti inattivi (vedi barra rossa in alto).');
    return;
  }

  const uid = getUid();

  const nameInput     = document.getElementById('playerName');
  const roomNameInput = document.getElementById('roomName');
  const codeInput     = document.getElementById('roomCode');
  const btnCreate     = document.getElementById('btnCreate');
  const btnJoin       = document.getElementById('btnJoin');
  const errLine       = document.getElementById('menuError');

  const missing = [
    ['playerName', nameInput], ['roomName', roomNameInput], ['roomCode', codeInput],
    ['btnCreate', btnCreate], ['btnJoin', btnJoin], ['menuError', errLine]
  ].filter(function(x){ return !x[1]; }).map(function(x){ return x[0]; });
  if(missing.length){
    console.error('[MENU] Elementi mancanti in index.html:', missing);
    if(errLine) errLine.textContent = '⚠ index.html incompleta: mancano ' + missing.join(', ');
    return;
  }

  codeInput.addEventListener('input', function(){
    codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });
  codeInput.addEventListener('keydown', function(e){ if(e.key === 'Enter') joinRoom(); });
  roomNameInput.addEventListener('keydown', function(e){ if(e.key === 'Enter') createRoom(); });
  btnCreate.addEventListener('click', createRoom);
  btnJoin.addEventListener('click', joinRoom);
  console.log('[MENU] ascoltatori collegati: pronto');

  /* ---------------- SPAZZINO (Politica A) ---------------- */
  /* Al caricamento del menu: stanze senza nessun giocatore vivo
     (e create da più di 60s) = morte → cancellate con tutta la chat. */
  async function sweepDeadRooms(){
    try{
      const res = await Promise.all([
        db.from('rooms').select('id, created_at'),
        db.from('players').select('room_id, last_seen')
      ]);
      const roomsRes = res[0], playersRes = res[1];
      if(roomsRes.error || playersRes.error) return;

      const cutoff = Date.now() - OFFLINE_AFTER_MS;
      const viviPerStanza = {};
      (playersRes.data || []).forEach(function(p){
        if(Date.parse(p.last_seen) > cutoff) viviPerStanza[p.room_id] = true;
      });

      const morte = (roomsRes.data || []).filter(function(r){
        return !viviPerStanza[r.id] && (Date.now() - Date.parse(r.created_at) > 60000);
      });
      for(const r of morte){
        await db.from('rooms').delete().eq('id', r.id);
        console.log('[MENU] stanza morta eliminata:', r.id);
      }
      if(morte.length) console.log('[MENU] pulizie fatte:', morte.length, 'stanze eliminate');
    }catch(e){
      console.warn('[MENU] sweep saltato:', e);
    }
  }
  sweepDeadRooms(); // parte da solo, una volta per visita al menu

  function explain(err){
    const m = (err && err.message) || String(err);
    if(/does not exist/i.test(m))               return 'le tabelle non esistono: esegui database.sql su Supabase.';
    if(/PGRST116|no rows/i.test(m))             return 'operazione bloccata (RLS senza policy): ricontrolla database.sql.';
    if(/Failed to fetch|NetworkError/i.test(m)) return 'Supabase non raggiungibile: controlla URL in config.js e la rete.';
    if(/JWT|API key|apikey/i.test(m))           return 'anon key sbagliata in config.js.';
    return m;
  }

  function fail(msg){
    console.error('[MENU]', msg);
    errLine.textContent = '⚠ ' + msg;
    btnCreate.disabled = btnJoin.disabled = false;
    btnCreate.textContent = 'Crea la stanza';
    btnJoin.textContent = 'Entra con il codice';
  }

  function readName(){
    const n = nameInput.value.trim();
    if(!n){ fail('Scrivi il tuo nome da assassino.'); nameInput.focus(); return null; }
    savePlayerName(n);
    return n.slice(0, MAX_NAME_LENGTH);
  }

  /* ---------------- CREA STANZA ---------------- */
  async function createRoom(){
    console.log('[MENU] clic → Crea stanza');
    const name = readName(); if(!name) return;
    const roomName = roomNameInput.value.trim();
    if(!roomName){ fail('Dai un nome alla stanza.'); roomNameInput.focus(); return; }

    errLine.textContent = '';
    btnCreate.disabled = btnJoin.disabled = true;
    btnCreate.textContent = '… apertura stanza';

    try{
      let room = null;
      for(let i = 0; i < 5 && !room; i++){
        const code = generateRoomCode();
        console.log('[MENU] tentativo insert rooms, codice:', code);
        const res = await db.from('rooms')
          .insert({ code, name: roomName, host_uid: uid })
          .select().single();
        if(res.error){
          console.error('[MENU] errore insert rooms:', res.error);
          if(res.error.code === '23505') continue;
          throw res.error;
        }
        room = res.data;
      }
      if(!room) throw new Error('Codice stanza non disponibile, riprova.');
      console.log('[MENU] stanza creata:', room.code);

      const p = await db.from('players').insert({
        room_id: room.id, uid, name,
        is_host: true, online: true,
        last_seen: new Date().toISOString()
      });
      if(p.error) throw p.error;
      console.log('[MENU] host inserito come giocatore');

      await sysMessage(room.id, escapeHtml(name) + ' ha aperto la stanza segreta.');
      saveCurrentRoom({ id: room.id, code: room.code, name: room.name });
      console.log('[MENU] → vado a lobby.html');
      location.href = 'lobby.html';
    }catch(err){
      console.error('[MENU] creazione fallita:', err);
      fail('Creazione fallita: ' + explain(err));
    }
  }

  /* ---------------- ENTRA CON CODICE ---------------- */
  async function joinRoom(){
    console.log('[MENU] clic → Entra nella stanza');
    const name = readName(); if(!name) return;
    const code = codeInput.value.trim();
    if(code.length < 4){ fail('Il codice stanza è di 6 caratteri.'); codeInput.focus(); return; }

    errLine.textContent = '';
    btnCreate.disabled = btnJoin.disabled = true;
    btnJoin.textContent = '… ricerca stanza';

    try{
      const res = await db.from('rooms').select('*').eq('code', code).maybeSingle();
      if(res.error) throw res.error;
      const room = res.data;
      if(!room) return fail('Nessuna stanza con codice ' + code + '.');
      if(room.status !== 'lobby') return fail('In questa stanza la partita è già iniziata.');
      console.log('[MENU] stanza trovata:', room.name);

      /* Politica A: stanza senza nessun giocatore vivo = stanza morta.
         La cancelliamo e lo diciamo chiaramente. */
      const soglia = new Date(Date.now() - OFFLINE_AFTER_MS).toISOString();
      const vivi = await db.from('players').select('id')
        .eq('room_id', room.id).gte('last_seen', soglia);
      if(!vivi.error && (vivi.data || []).length === 0){
        await db.from('rooms').delete().eq('id', room.id);
        console.log('[MENU] stanza morta eliminata al tentativo di ingresso:', room.code);
        return fail('Questa stanza non esiste più: tutti erano già usciti. Creane una nuova.');
      }

      const me = await db.from('players')
        .select('id').eq('room_id', room.id).eq('uid', uid).maybeSingle();
      if(me.data){
        await db.from('players').update({
          online: true, name, last_seen: new Date().toISOString()
        }).eq('id', me.data.id);
      } else {
        const p = await db.from('players').insert({
          room_id: room.id, uid, name,
          is_host: room.host_uid === uid,
          online: true, last_seen: new Date().toISOString()
        });
        if(p.error) throw p.error;
        await sysMessage(room.id, escapeHtml(name) + ' è entrato nella stanza.');
      }

      saveCurrentRoom({ id: room.id, code: room.code, name: room.name });
      console.log('[MENU] → vado a lobby.html');
      location.href = 'lobby.html';
    }catch(err){
      console.error('[MENU] ingresso fallito:', err);
      fail('Ingresso fallito: ' + explain(err));
    }
  }
})();