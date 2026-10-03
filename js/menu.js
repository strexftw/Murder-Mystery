/* =========================================================
   MENU.JS — file di logica del menu (index.html)
   ========================================================= */
(function(){
  if(!guardConfig()) return;

  const uid = getUid();

  const nameInput     = document.getElementById('playerName');
  const roomNameInput = document.getElementById('roomName');
  const codeInput     = document.getElementById('roomCode');
  const btnCreate     = document.getElementById('btnCreate');
  const btnJoin       = document.getElementById('btnJoin');
  const errLine       = document.getElementById('menuError');

  nameInput.value = getPlayerName();

  /* codice sempre maiuscolo e pulito mentre scrivi */
  codeInput.addEventListener('input', () => {
    codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });
  codeInput.addEventListener('keydown', e => { if(e.key === 'Enter') joinRoom(); });
  roomNameInput.addEventListener('keydown', e => { if(e.key === 'Enter') createRoom(); });
  btnCreate.addEventListener('click', createRoom);
  btnJoin.addEventListener('click', joinRoom);

  function fail(msg){
    errLine.textContent = '⚠ ' + msg;
    btnCreate.disabled = btnJoin.disabled = false;
    btnCreate.textContent = '✚ Crea stanza';
    btnJoin.textContent = '→ Entra nella stanza';
  }

  function readName(){
    const n = nameInput.value.trim();
    if(!n){ fail('Scrivi il tuo nome da assassino.'); nameInput.focus(); return null; }
    savePlayerName(n);
    return n.slice(0, MAX_NAME_LENGTH);
  }

  /* ---------------- CREA STANZA ---------------- */
  async function createRoom(){
    const name = readName(); if(!name) return;
    const roomName = roomNameInput.value.trim();
    if(!roomName){ fail('Dai un nome alla stanza.'); roomNameInput.focus(); return; }

    errLine.textContent = '';
    btnCreate.disabled = btnJoin.disabled = true;
    btnCreate.textContent = '… apertura stanza';

    try{
      /* genera un codice e riprova finché non è unico */
      let room = null;
      for(let i = 0; i < 5 && !room; i++){
        const code = generateRoomCode();
        const res = await db.from('rooms')
          .insert({ code, name: roomName, host_uid: uid })
          .select().single();
        if(res.error){
          if(res.error.code === '23505') continue; // codice duplicato: riprova
          throw res.error;
        }
        room = res.data;
      }
      if(!room) throw new Error('Codice stanza non disponibile, riprova.');

      /* l'host entra come primo giocatore */
      const p = await db.from('players').insert({
        room_id: room.id, uid, name,
        is_host: true, online: true,
        last_seen: new Date().toISOString()
      });
      if(p.error) throw p.error;

      await sysMessage(room.id, `${escapeHtml(name)} ha aperto la stanza segreta.`);
      saveCurrentRoom({ id: room.id, code: room.code, name: room.name });
      location.href = 'lobby.html';
    }catch(err){
      console.error(err);
      fail('Errore nella creazione: ' + (err.message || err));
    }
  }

  /* ---------------- ENTRA CON CODICE ---------------- */
  async function joinRoom(){
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

      /* già presente? rientro silenzioso. Altrimenti: nuovo ingresso. */
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
        await sysMessage(room.id, `${escapeHtml(name)} è entrato nella stanza.`);
      }

      saveCurrentRoom({ id: room.id, code: room.code, name: room.name });
      location.href = 'lobby.html';
    }catch(err){
      console.error(err);
      fail('Errore di connessione: ' + (err.message || err));
    }
  }
})();