// ASSASSINO.JS v1 — carta coltello ed eliminazione.
// Attivo SOLO in partita e SOLO se il mio ruolo e assassino.
// Flusso: click/tap sulla carta -> scelta vittima -> conferma
// -> la carta esce di scena -> dopo 50 secondi animazione del
// taglio (eliminazione). Carta usabile UNA sola volta.
// Si aggancia alla partita tramite il bus PARTITA (partita.js).
(function(){
  const COLPO_ATTESA_MS = 50000; // 50 secondi tra conferma e colpo

  let el = null;
  let scelto = null;       // uid della vittima scelta
  let usada = false;       // carta gia usata (kill_at esistente)
  let slashVista = false;  // animazione del taglio gia mostrata
  let scadenza = null;     // timestamp del colpo
  let chipTimer = null;

  function boot(){
    if(typeof PARTITA === 'undefined' || !PARTITA.on){ setTimeout(boot, 120); return; }
    PARTITA.on('ready', setup);
    PARTITA.on('room', onRoom);
    PARTITA.on('players', onPlayers);
  }

  function setup(){
    el = {
      mano:     document.getElementById('manoAssassino'),
      carta:    document.getElementById('cartaColtello'),
      overlay:  document.getElementById('overlayBersaglio'),
      lista:    document.getElementById('bersaglioList'),
      annulla:  document.getElementById('btnAnnullaBersaglio'),
      conferma: document.getElementById('btnConfermaBersaglio'),
      chip:     document.getElementById('colpoChip'),
      chipT:    document.getElementById('colpoTimer'),
      slash:    document.getElementById('slashOverlay')
    };
    const miss = Object.keys(el).filter(function(k){ return !el[k]; });
    if(miss.length){ console.warn('[ASSASSINO] elementi mancanti:', miss); return; }

    // non sono l'assassino: niente carta, niente modulo
    if(PARTITA.getRole() !== 'assassino') return;

    el.carta.addEventListener('click', apriScelta);
    el.annulla.addEventListener('click', chiudiScelta);
    el.conferma.addEventListener('click', confermaColpo);
    mostraStato();
  }

  function trovaMe(){
    const ps = PARTITA.getPlayers() || [];
    for(let i = 0; i < ps.length; i++){
      if(ps[i].uid === PARTITA.getUid()) return ps[i];
    }
    return null;
  }
  function sonoVivo(){
    const me = trovaMe();
    return !!me && me.alive !== false;
  }

  // mostra la mano solo se: partita in corso + sono vivo + carta non usata
  function mostraStato(){
    if(!el) return;
    const room = PARTITA.getRoom();
    usada = !!(room && room.kill_at);
    if(usada && room && room.kill_at){
      scadenza = Date.parse(room.kill_at);
      avviaChip();
    }
    el.mano.hidden = !(PARTITA.isRunning() && sonoVivo() && !usada);
  }

  function onPlayers(){
    if(!el || PARTITA.getRole() !== 'assassino') return;
    mostraStato();
  }

  // ---------------- SCELTA VITTIMA ----------------
  function apriScelta(){
    if(!el || usada || !sonoVivo() || !PARTITA.isRunning()) return;
    const room = PARTITA.getRoom();
    if(room && room.status !== 'playing') return;

    scelto = null;
    el.conferma.disabled = true;
    el.lista.innerHTML = '';

    const ps = PARTITA.getPlayers() || [];
    const vivi = ps.filter(function(p){
      return p.uid !== PARTITA.getUid() && p.alive !== false && PARTITA.isFresh(p);
    });

    if(!vivi.length){
      el.lista.innerHTML = '<p class="bersaglio-void">Nessuna vittima disponibile al tavolo.</p>';
    }

    vivi.forEach(function(p){
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bersaglio-card';
      b.innerHTML =
        '<span class="b-name">' + escapeHtml(p.name) + '</span>' +
        '<span class="b-device">' + (p.device ? deviceLabel(p.device) : '❓ Sconosciuto') + '</span>';
      b.addEventListener('click', function(){
        scelto = p.uid;
        const tots = el.lista.querySelectorAll('.bersaglio-card');
        for(let i = 0; i < tots.length; i++){ tots[i].classList.remove('scelto'); }
        b.classList.add('scelto');
        el.conferma.disabled = false;
      });
      el.lista.appendChild(b);
    });

    el.overlay.hidden = false;
  }

  function chiudiScelta(){
    if(!el) return;
    el.overlay.hidden = true;
    scelto = null;
    el.conferma.disabled = true;
  }

  // ---------------- CONFERMA COLPO ----------------
  async function confermaColpo(){
    if(!el || !scelto || usada || !sonoVivo()) return;
    const room = PARTITA.getRoom();
    if(!room || room.status !== 'playing') return;

    el.conferma.disabled = true;
    const scadenzaIso = new Date(Date.now() + COLPO_ATTESA_MS).toISOString();
    const up = await PARTITA.dbRef().from('rooms').update({
      kill_target_uid: scelto,
      kill_by_uid:     PARTITA.getUid(),
      kill_at:         scadenzaIso
    }).eq('id', PARTITA.getRoomId());

    if(up.error){
      console.error('[ASSASSINO] conferma fallita:', up.error);
      showToast('Colpo fallito: ' + up.error.message, false);
      el.conferma.disabled = false;
      return;
    }

    usada = true;
    scadenza = Date.parse(scadenzaIso);
    chiudiScelta();

    // prima animazione: la carta esce di scena e sparisce dalla mano
    el.carta.classList.add('usata');
    setTimeout(function(){ el.mano.hidden = true; }, 900);

    avviaChip();
    showToast('Il colpo arriverà tra 50 secondi');
    console.log('[ASSASSINO] colpo pianificato per', scadenzaIso);
  }

  // ---------------- CONTEGGIO + TAGLIO ----------------
  function avviaChip(){
    if(!el || !el.chip) return;
    if(chipTimer) clearInterval(chipTimer);
    const tick = function(){
      if(!scadenza){ clearInterval(chipTimer); return; }
      const rest = Math.max(0, Math.ceil((scadenza - Date.now()) / 1000));
      el.chip.hidden = false;
      el.chipT.textContent = String(rest);
      if(rest <= 0){ clearInterval(chipTimer); el.chip.hidden = true; }
    };
    tick();
    chipTimer = setInterval(tick, 250);
  }

  function onRoom(room){
    if(!el || !room || !room.kill_at) return;
    scadenza = Date.parse(room.kill_at);

    // se ho ricaricato la pagina a colpo gia pianificato
    if(!usada){
      usada = true;
      el.mano.hidden = true;
      avviaChip();
    }

    // seconda animazione: il taglio, solo per chi ha sferrato il colpo
    if(!slashVista && Date.now() >= scadenza && PARTITA.getUid() === room.kill_by_uid){
      slashVista = true;
      el.chip.hidden = true;
      el.slash.hidden = false;
      setTimeout(function(){
        el.slash.hidden = true;
        showToast('Il colpo è andato a segno');
      }, 1600);
    }
  }

  boot();
})();