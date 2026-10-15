// SISTEMA.JS v3.1 - loop uccisioni + indizio lasciato alla vittima.
// Quando un innocente muore, il suo dispositivo vede una caratteristica
// dell'assassino (presa dalla carta salvata in rooms.assassin_card).
(function(){
  const KILL_MS = 12000;
  const WATCHDOG_MS = 20000;
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

    if(!room.next_kill_at){
      if(room.last_kill_at && (now - Date.parse(room.last_kill_at)) > WATCHDOG_MS){
        const iso = new Date(now + KILL_MS).toISOString();
        await db.from('rooms').update({ next_kill_at: iso }).eq('id', roomId);
        Object.assign(roomLocal, { next_kill_at: iso });
      }
      return;
    }

    if(now < Date.parse(room.next_kill_at)) return;
    if(ultimaVittimaTs && (now - ultimaVittimaTs) < KILL_MS) return;

    const r = new Uint32Array(1);
    crypto.getRandomValues(r);
    const vit = vittime[r[0] % vittime.length];

    // Indizio lasciato alla vittima: una caratteristica dell'assassino
    let vittimaClue = '';
    try{
      const assassinCard = JSON.parse(room.assassin_card || '{}');
      const campiDisponibili = ['nascita','luogo','lavoro','hobby','altezza','extra','nome','cf'];
      const campoEvitato = room.clue_field || '';
      const campiUsabili = campiDisponibili.filter(function(c){ return c !== campoEvitato; });
      const r2 = new Uint32Array(1);
      crypto.getRandomValues(r2);
      const campoScelto = campiUsabili[r2[0] % campiUsabili.length];
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
    }catch(e){
      vittimaClue = "L'assassino è tra voi.";
    }

    await db.from('players').update({ alive: false }).eq('id', vit.id);
    const ora = new Date(now).toISOString();
    await db.from('rooms').update({
      last_kill_uid: vit.uid,
      last_kill_at:  ora,
      next_kill_at:  null,
      last_victim_clue: vittimaClue
    }).eq('id', roomId);

    Object.assign(roomLocal, {
      last_kill_uid: vit.uid,
      last_kill_at:  ora,
      next_kill_at:  null,
      last_victim_clue: vittimaClue
    });
    ultimaVittimaTs = now;

    await sysMessage(roomId, '☠ ' + escapeHtml(vit.name) + ' è stato trovato senza vita.');

    if(vittime.length - 1 <= 0){ await fine('assassino'); }
  }

  boot();
})();