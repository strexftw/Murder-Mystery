/* =========================================================
   MENU.JS — logica del menu (index.html)
   v2.1: diagnostica visibile + nessun nome precompilato
         + dispositivo salvato nel database
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

  /* se manca anche un solo elemento della pagina, dillo a schermo */
  const missing = [
    ['playerName', nameInput], ['roomName', roomNameInput], ['roomCode', codeInput],
    ['btnCreate', btnCreate], ['btnJoin', btnJoin], ['menuError', errLine]
  ].filter(x => !x[1]).map(x => x[0]);
  if(missing.length){
    console.error('[MENU] Elementi mancanti in index.html:', missing);
    if(errLine) errLine.textContent = '⚠ index.html incompleta: mancano ' + missing.join(', ');
    return;
  }

  /* niente precompilazione: ogni visita = nuovo nome da assassino */

  codeInput.addEventListener('input', () => {
    codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });
  codeInput.addEventListener('keydown', e => { if(e.key === 'Enter') joinRoom(); });
  roomNameInput.addEventListener('keydown', e => { if(e.key === 'Enter') createRoom(); });
  btnCreate.addEventListener('click', createRoom);
  btnJoin.addEventListener('click', joinRoom);
  console.log('[MENU] ascoltatori collegati: pronto');

  /* traduce gli errori tecnici in italiano comprensibile */
  function explain(err){
    const m = (err && err.message) || String(err);
    if(/does not exist/i.test(m))             return 'le tabelle non esistono: esegui database.sql su Supabase.';
    if(/PGRST116|no rows/i.test(m))           return 'operazione bloccata (RLS senza policy): ricontrolla database.sql.';
    if(/Failed to fetch|NetworkError/i.test(m)) return 'Supabase non raggiungibile: controlla URL in config.js e la rete.';
    if(/JWT|API key|apikey/i.test(m))         return 'anon key sbagliata in config.js.';
    if(/device/i.test(m))                     return 'manca la colonna device: esegui la riga SQL alter table players.';
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
          if(res.error.code === '23505') continue; // codice duplicato: riprova
          throw res.error;
        }
        room = res.data;
      }
      if(!room) throw new Error('Codice stanza non disponibile, riprova.');
      console.log('[MENU] stanza creata:', room.code);

      const p = await db.from('players').insert({
        room_id: room.id, uid, name,
        is_host: true, online: true,
        device: getDeviceType(),
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
      if(!room) return fail('Nessuna stanza con codice ' + code + '. Se il codice è giusto, esegui/ricontrolla database.sql (policy RLS).');
      if(room.status !== 'lobby') return fail('In questa stanza la partita è già iniziata.');
      console.log('[MENU] stanza trovata:', room.name);

      const me = await db.from('players')
        .select('id').eq('room_id', room.id).eq('uid', uid).maybeSingle();
      if(me.data){
        await db.from('players').update({
          online: true, name, device: getDeviceType(),
          last_seen: new Date().toISOString()
        }).eq('id', me.data.id);
      } else {
        const p = await db.from('players').insert({
          room_id: room.id, uid, name,
          is_host: room.host_uid === uid,
          device: getDeviceType(),
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