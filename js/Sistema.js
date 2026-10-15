// SISTEMA.JS v1 - loop uccisioni (ogni 5s) + condizioni di fine.
// Gira SOLO sul client "pulitore" (evento 'cleaner' del bus),
// cosi ogni scrittura avviene una volta sola.
(function(){
  const KILL_MS = 5000;

  function boot(){
    if(typeof PARTITA === 'undefined' || !PARTITA.on){ setTimeout(boot, 120); return; }
    PARTITA.on('cleaner', onCleaner);
  }

  function roleOf(p){ return unscramble(p.role, p.uid) || 'innocente'; }

  async function fine(winner){
    const room = PARTITA.getRoom();
    if(room && room.winner) return;
    await PARTITA.dbRef().from('rooms')
      .update({ winner: winner, phase: 'fine' })
      .eq('id', PARTITA.getRoomId());
    await sysMessage(PARTITA.getRoomId(),
      (winner === 'assassino') ? "🏆 Vince l'Assassino!" : "🏆 Vince l'Ispettore!");
    console.log('[SISTEMA] fine partita, vince:', winner);
  }

  async function onCleaner(players){
    const room = PARTITA.getRoom();
    if(!room || room.phase !== 'live' || room.winner) return;
    const db = PARTITA.dbRef(), roomId = PARTITA.getRoomId();

    // vittime possibili: innocenti vivi (mai detective, mai assassino)
    const vittime = players.filter(function(p){
      return p.alive !== false && roleOf(p) === 'innocente';
    });

    // tabellone esaurito: vince l'assassino
    if(vittime.length === 0){ await fine('assassino'); return; }

    if(!room.next_kill_at) return;
    if(Date.now() < Date.parse(room.next_kill_at)) return;

    // pesca la vittima
    const r = new Uint32Array(1);
    crypto.getRandomValues(r);
    const vit = vittime[r[0] % vittime.length];

    await db.from('players').update({ alive: false }).eq('id', vit.id);
    const ora = new Date().toISOString();
    await db.from('rooms').update({
      last_kill_uid: vit.uid,
      last_kill_at:  ora,
      next_kill_at:  new Date(Date.now() + KILL_MS).toISOString()
    }).eq('id', roomId);
    await sysMessage(roomId, '☠ ' + escapeHtml(vit.name) + ' è stato trovato senza vita.');
    console.log('[SISTEMA] vittima:', vit.name);

    // se era l'ultima vittima possibile, fine
    if(vittime.length - 1 <= 0){ await fine('assassino'); }
  }

  boot();
})();