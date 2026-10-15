// SISTEMA.JS v3 - loop uccisioni del motore Step 5.
// UNA sola vittima per scadenza: lo stato (next_kill_at,
// last_kill_at) viene letto FRESCO dal database a ogni ciclo
// e risincronizzato in memoria subito dopo ogni scrittura,
// cosi nessuna scadenza vecchia puo scatenare una cascata.
// Prima vittima: 20s dall'inizio live (la imposta partita.js).
// Vittime successive: 12s dalla risposta dell'Ispettore.
// Pausa: dopo ogni colpo next_kill_at = null finche il
// detective non decide (watchdog 20s anti-stallo).
(function(){
  const KILL_MS = 12000;      // intervallo tra una vittima e la successiva
  const WATCHDOG_MS = 20000;  // se il detective non risponde, riprendo comunque
  let ultimaVittimaTs = 0;    // guardia locale: al massimo 1 colpo per intervallo

  function boot(){
    if(typeof PARTITA === 'undefined' || !PARTITA.on){ setTimeout(boot, 120); return; }
    PARTITA.on('cleaner', onCleaner);
  }

  function roleOf(p){ return unscramble(p.role, p.uid) || 'innocente'; }

  async function fine(winner){
    const db = PARTITA.dbRef(), roomId = PARTITA.getRoomId();
    // controllo fresco: la fine la scriviamo una volta sola
    const rr = await db.from('rooms').select('winner').eq('id', roomId).maybeSingle();
    if(rr.data && rr.data.winner) return;
    await db.from('rooms')
      .update({ winner: winner, phase: 'fine' })
      .eq('id', roomId);
    await sysMessage(roomId,
      (winner === 'assassino') ? "🏆 Vince l'Assassino!" : "🏆 Vince l'Ispettore!");
    console.log('[SISTEMA] fine partita, vince:', winner);
  }

  async function onCleaner(players){
    const roomLocal = PARTITA.getRoom();
    if(!roomLocal || roomLocal.phase !== 'live' || roomLocal.winner) return;
    const db = PARTITA.dbRef(), roomId = PARTITA.getRoomId();
    const now = Date.now();

    // STATO FRESCO DAL DB: niente deadline vecchi in memoria
    const rr = await db.from('rooms')
      .select('phase, winner, next_kill_at, last_kill_at, last_kill_uid')
      .eq('id', roomId).maybeSingle();
    if(rr.error || !rr.data) return;
    const room = rr.data;
    if(room.phase !== 'live' || room.winner) return;

    // vittime possibili: SOLO innocenti vivi (mai detective, mai assassino)
    const vittime = players.filter(function(p){
      return p.alive !== false && roleOf(p) === 'innocente';
    });
    if(vittime.length === 0){ await fine('assassino'); return; }

    // TIMER IN PAUSA (il detective sta decidendo): watchdog anti-stallo
    if(!room.next_kill_at){
      if(room.last_kill_at && (now - Date.parse(room.last_kill_at)) > WATCHDOG_MS){
        const iso = new Date(now + KILL_MS).toISOString();
        await db.from('rooms').update({ next_kill_at: iso }).eq('id', roomId);
        Object.assign(roomLocal, { next_kill_at: iso });
        console.log('[SISTEMA] watchdog: timer ripreso senza risposta');
      }
      return;
    }

    // non e ancora scaduto: non fare nulla
    if(now < Date.parse(room.next_kill_at)) return;

    // guardia anti-cascata: mai due colpi nello stesso intervallo
    if(ultimaVittimaTs && (now - ultimaVittimaTs) < KILL_MS) return;

    // COLPO UNICO: pesca UNA vittima e la segna
    const r = new Uint32Array(1);
    crypto.getRandomValues(r);
    const vit = vittime[r[0] % vittime.length];

    await db.from('players').update({ alive: false }).eq('id', vit.id);
    const ora = new Date(now).toISOString();
    await db.from('rooms').update({
      last_kill_uid: vit.uid,
      last_kill_at:  ora,
      next_kill_at:  null          // pausa fino alla risposta del detective
    }).eq('id', roomId);

    // sincronizzo SUBITO la memoria: niente scadenza vecchia in giro
    Object.assign(roomLocal, {
      last_kill_uid: vit.uid,
      last_kill_at:  ora,
      next_kill_at:  null
    });
    ultimaVittimaTs = now;

    await sysMessage(roomId, '☠ ' + escapeHtml(vit.name) + ' è stato trovato senza vita.');
    console.log('[SISTEMA] vittima unica:', vit.name);

    // se era l'ultimo innocente possibile, vince l'assassino
    if(vittime.length - 1 <= 0){ await fine('assassino'); }
  }

  boot();
})();