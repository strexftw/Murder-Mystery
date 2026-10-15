// SISTEMA.JS v2 - loop uccisioni con PAUSA durante la scelta
// del detective: dopo un colpo next_kill_at = null e il clock
// riparte solo quando l'Ispettore risponde (o dopo il watchdog
// di 20s, per non bloccare il gioco se il detective non c'e).
// Prima vittima: 20s (la imposta partita.js al via del live).
// Vittime successive: 12s dalla risposta.
(function(){
  const KILL_MS = 12000;      // intervallo tra una vittima e la risposta successiva
  const WATCHDOG_MS = 20000;  // se il detective non risponde, riprendo comunque

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
    const now = Date.now();

    // vittime possibili: innocenti vivi
    const vittime = players.filter(function(p){
      return p.alive !== false && roleOf(p) === 'innocente';
    });
    if(vittime.length === 0){ await fine('assassino'); return; }

    // TIMER IN PAUSA (detective sta decidendo): watchdog anti-stallo
    if(!room.next_kill_at){
      if(room.last_kill_at && (now - Date.parse(room.last_kill_at)) > WATCHDOG_MS){
        await db.from('rooms').update({
          next_kill_at: new Date(now + KILL_MS).toISOString()
        }).eq('id', roomId);
        console.log('[SISTEMA] watchdog: timer ripreso senza risposta');
      }
      return;
    }

    if(now < Date.parse(room.next_kill_at)) return;

    // colpo: pesca la vittima e METTE IN PAUSA il clock
    const r = new Uint32Array(1);
    crypto.getRandomValues(r);
    const vit = vittime[r[0] % vittime.length];

    await db.from('players').update({ alive: false }).eq('id', vit.id);
    await db.from('rooms').update({
      last_kill_uid: vit.uid,
      last_kill_at:  new Date(now).toISOString(),
      next_kill_at:  null
    }).eq('id', roomId);
    await sysMessage(roomId, '☠ ' + escapeHtml(vit.name) + ' è stato trovato senza vita.');
    console.log('[SISTEMA] vittima:', vit.name, '- clock in pausa fino alla risposta');

    if(vittime.length - 1 <= 0){ await fine('assassino'); }
  }

  boot();
})();