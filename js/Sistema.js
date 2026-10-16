// SISTEMA.JS v3.5 - loop uccisioni + indizio vittima.
// v3.5: RIMOSSO il watchdog a tempo che sbloccava il timer da solo.
// Dopo una vittima next_kill_at = null e RESTA null finche l'Ispettore
// non preme Fine ispezione o No. Unica eccezione: se il detective e
// DISCONNESSO, il tavolo si sblocca per non restare fermo per sempre.
(function(){
  const KILL_MS = 12000;
  let ultimaVittimaTs = 0;

  function boot(){
    if(typeof PARTITA === 'undefined' || !PARTITA.on){ setTimeout(boot, 120); return; }
    PARTITA.on('cleaner', onCleaner);
  }

  function roleOf(p){ return unscramble(p.role, p.uid) || 'innocente'; }

  async function fine(winner){
    const db = PARTITA.dbRef(), roomId = PARTITA.getRoomId();
    const rr = await db.from('rooms').select('winner').eq('id', roomId).maybeSingle();
    if(rr.data && rr.data.winner) return;
    await db.from('rooms')
      .update({ winner: winner, phase: 'fine' })
      .eq('id', roomId);
    await sysMessage(roomId,
      (winner === 'assassino') ? "🏆 Vince l'Assassino!" : "🏆 Vince l'Ispettore!");
  }

  async function onCleaner(players){
    const roomLocal = PARTITA.getRoom();
    if(!roomLocal || roomLocal.phase !== 'live' || roomLocal.winner) return;
    const db = PARTITA.dbRef(), roomId = PARTITA.getRoomId();
    const now = Date.now();

    const rr = await db.from('rooms')
      .select('phase, winner, next_kill_at, last_kill_at, last_kill_uid, assassin_card, clue_field')
      .eq('id', roomId).maybeSingle();
    if(rr.error || !rr.data) return;
    const room = rr.data;
    if(room.phase !== 'live' || room.winner) return;

    const vittime = players.filter(function(p){
      return p.alive !== false && roleOf(p) === 'innocente';
    });
    if(vittime.length === 0){ await fine('assassino'); return; }

    // TIMER BLOCCATO (next_kill_at null): resta bloccato finche
    // l'Ispettore non decide. Sblocco SOLO se il detective e assente.
    if(!room.next_kill_at){
      const det = players.find(function(p){ return roleOf(p) === 'detective'; });
      const detAttivo = det && det.alive !== false && PARTITA.isFresh(det);
      if(!detAttivo){
        const iso = new Date(now + KILL_MS).toISOString();
        await db.from('rooms').update({ next_kill_at: iso }).eq('id', roomId);
        Object.assign(roomLocal, { next_kill_at: iso });
        console.log('[SISTEMA] detective assente: timer sbloccato d ufficio');
      }
      return;
    }

    if(now < Date.parse(room.next_kill_at)) return;
    if(ultimaVittimaTs && (now - ultimaVittimaTs) < KILL_MS) return;

    const r = new Uint32Array(1);
    crypto.getRandomValues(r);
    const vit = vittime[r[0] % vittime.length];

    let vittimaClue = "L'assassino è tra voi.";
    try{
      const assassinCard = room.assassin_card ? JSON.parse(room.assassin_card) : null;
      if(assassinCard){
        const campiDisponibili = ['nascita','luogo','lavoro','hobby','altezza','extra','nome','cf'];
        const campoEvitato = room.clue_field || '';
        const campiUsabili = campiDisponibili.filter(function(c){ return c !== campoEvitato; });
        const r2 = new Uint32Array(1);
        crypto.getRandomValues(r2);
        const campoScelto = campiUsabili.length > 0 ? campiUsabili[r2[0] % campiUsabili.length] : 'nome';
        const valore = assassinCard[campoScelto] || '—';
        const etichette = {
          nascita: 'è nato nel',
          luogo: 'è nato a',
          lavoro: 'lavora come',
          hobby: 'nel tempo libero',
          altezza: 'è alto',
          extra: 'ha come segno particolare',
          nome: 'si chiama',
          cf: 'ha codice fiscale'
        };
        vittimaClue = "L'assassino " + (etichette[campoScelto] || campoScelto) + " " + valore;
      }
    }catch(e){
      vittimaClue = "L'assassino è tra voi.";
    }

    await db.from('players').update({ alive: false }).eq('id', vit.id);
    const ora = new Date(now).toISOString();
    await db.from('rooms').update({
      last_kill_uid: vit.uid,
      last_kill_at:  ora,
      next_kill_at:  null,
      last_victim_clue: vittimaClue,
      clue_read_at:  null
    }).eq('id', roomId);

    Object.assign(roomLocal, {
      last_kill_uid: vit.uid,
      last_kill_at:  ora,
      next_kill_at:  null,
      last_victim_clue: vittimaClue,
      clue_read_at:  null
    });
    ultimaVittimaTs = now;

    await sysMessage(roomId, '☠ ' + escapeHtml(vit.name) + ' è stato trovato senza vita.');

    if(vittime.length - 1 <= 0){ await fine('assassino'); }
  }

  boot();
})();