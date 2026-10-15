  async function startGame(){
    try{
      const res = await db.from('players').select().eq('room_id', roomId);
      if(res.error) throw res.error;

      const vivi = (res.data || []).filter(function(p){ return p.online && isFresh(p); });
      if(vivi.length < 3){
        showToast('Servono almeno 3 agenti al tavolo per giocare', false);
        resetStartButton();
        return;
      }

      // reset completo prima di assegnare
      await resetPartita(roomId);

      // mescola
      const mescolati = vivi.slice();
      const rnd = new Uint32Array(mescolati.length);
      crypto.getRandomValues(rnd);
      for(let i = mescolati.length - 1; i > 0; i--){
        const j = rnd[i] % (i + 1);
        const tmp = mescolati[i]; mescolati[i] = mescolati[j]; mescolati[j] = tmp;
      }

      // carte identita + ruoli + codici
      const carte = generaCarte(mescolati.length);
      const usati = new Set();
      let uidDetective = null;
      for(let i = 0; i < mescolati.length; i++){
        const ruolo = (i === 0) ? 'assassino' : (i === 1) ? 'detective' : 'innocente';
        if(ruolo === 'detective') uidDetective = mescolati[i].uid;
        let code;
        do { code = generatePlayerCode(); } while(usati.has(code));
        usati.add(code);
        const up = await db.from('players').update({
          role:  scramble(ruolo, mescolati[i].uid),
          code:  code,
          card:  JSON.stringify(carte[i]),
          alive: true
        }).eq('id', mescolati[i].id);
        if(up.error) throw up.error;
      }

      // indizio preso dalla carta dell'assassino, offuscato col uid del detective
      const indizio = scegliIndizio(carte, 0);
      const rm = await db.from('rooms').update({
        status:      'playing',
        phase:       'reveal',
        started_at:  null,
        winner:      null,
        clue:        scramble(JSON.stringify(indizio), uidDetective),
        secret_word: null
      }).eq('id', roomId);
      if(rm.error) throw rm.error;

      await sysMessage(roomId, '☠ La partita sta per iniziare…');
      console.log('[LOBBY] partita avviata con', mescolati.length, 'giocatori');
      startOverlay();
    }catch(err){
      console.error('[LOBBY] avvio fallito:', err);
      showToast('Avvio fallito: ' + explain(err), false);
      resetStartButton();
    }
  }