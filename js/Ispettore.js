// ISPETTORE.JS v2.8.1 - indagine "cieca" + timer sbloccato SOLO da
// Chiudi (dopo aver visto il valore) o da No/skip.
// Flusso: vittima -> "Hai letto?" -> Si -> scegli persona -> scegli
// caratteristica (SENZA valore) -> FINE ISPEZIONE (esce il valore,
// timer ANCORA bloccato) -> CHIUDI (il timer PARTE).
console.log('[ISPETTORE] caricato v2.8.1');
(function(){
  const KILL_MS = 12000;
  let el = null, clue = null, seenKill = null;
  let bersaglioIndagine = null, campoScelto = null, bersaglioElimina = null;
  let faseEsito = false;   // true dopo Fine ispezione: il bottone diventa Chiudi

  const CAMPI = [
    ['nascita', 'Anno di nascita'],
    ['luogo',   'Luogo di nascita'],
    ['lavoro',  'Lavoro'],
    ['hobby',   'Hobby'],
    ['altezza', 'Altezza'],
    ['extra',   'Segno particolare'],
    ['nome',    'Nome completo'],
    ['cf',      'Codice fiscale']
  ];

  function boot(){
    if(typeof PARTITA === 'undefined' || !PARTITA.on){ setTimeout(boot, 120); return; }
    PARTITA.on('ready', setup);
    PARTITA.on('room', onRoom);
    PARTITA.on('reset', function(){
      seenKill = null; bersaglioIndagine = null; campoScelto = null; bersaglioElimina = null;
      faseEsito = false;
      if(el){
        el.leggi.hidden = true;
        el.notif.hidden = true;
        el.ind.hidden = true;
        el.elim.hidden = true;
      }
    });
  }

  function tabKey(){ return 'tabella_' + PARTITA.getRoomId(); }
  function leggiTabella(){
    try{ return JSON.parse(localStorage.getItem(tabKey())) || []; }catch(e){ return []; }
  }
  function aggiungiTabella(nome){
    const t = leggiTabella();
    if(t.indexOf(nome) === -1){ t.push(nome); localStorage.setItem(tabKey(), JSON.stringify(t)); }
    if(el && !el.tab.hidden) renderTabella();
  }
  function renderTabella(){
    const t = leggiTabella();
    el.tabList.innerHTML = t.length
      ? t.map(function(n){ return '<li class="tab-voce">✓ ' + escapeHtml(n) + '</li>'; }).join('')
      : '<li class="tab-voce">Nessun sospetto escluso.</li>';
  }

  function setup(){
    if(PARTITA.getRole() !== 'detective') return;
    el = {
      clueRow:   document.getElementById('clueRow'),
      clueText:  document.getElementById('clueText'),
      btnTab:    document.getElementById('btnTabella'),
      btnElim:   document.getElementById('btnElimina'),
      leggi:     document.getElementById('overlayLeggiIndizio'),
      btnLeggi:  document.getElementById('btnHaiLetto'),
      notif:     document.getElementById('overlayNotifica'),
      notifTesto:document.getElementById('notifTesto'),
      btnSi:     document.getElementById('btnNotifSi'),
      btnNo:     document.getElementById('btnNotifNo'),
      ind:       document.getElementById('overlayIndagine'),
      indList:   document.getElementById('indagineList'),
      indCampi:  document.getElementById('indagineCampi'),
      indEsito:  document.getElementById('indagineEsito'),
      indOk:     document.getElementById('btnIndagineOk'),
      tab:       document.getElementById('overlayTabella'),
      tabList:   document.getElementById('tabellaList'),
      tabChiudi: document.getElementById('btnTabellaChiudi'),
      elim:      document.getElementById('overlayElimina'),
      elimList:  document.getElementById('eliminaList'),
      elimConf:  document.getElementById('btnEliminaConferma'),
      elimAnn:   document.getElementById('btnEliminaAnnulla')
    };
    const room = PARTITA.getRoom();
    clue = JSON.parse(unscramble(room.clue, PARTITA.getUid()) || 'null');
    if(clue){
      el.clueText.textContent = clue.testo;
      el.clueRow.hidden = false;
    }
    el.btnTab.hidden = false;
    el.btnElim.hidden = false;
    aggiornaElimina();

    el.btnTab.addEventListener('click', function(){ el.tab.hidden = false; renderTabella(); });
    el.tabChiudi.addEventListener('click', function(){ el.tab.hidden = true; });
    el.btnLeggi.addEventListener('click', mostraNotifica);
    el.btnSi.addEventListener('click', doSi);
    el.btnNo.addEventListener('click', doNo);
    // il bottone fa due cose: Fine ispezione, poi Chiudi
    el.indOk.addEventListener('click', function(){
      if(faseEsito){ chiudiIndagine(); } else { commitIndagine(); }
    });
    el.btnElim.addEventListener('click', apriElimina);
    el.elimAnn.addEventListener('click', function(){ el.elim.hidden = true; });
    el.elimConf.addEventListener('click', confermaElimina);
  }

  function aggiornaElimina(){
    const room = PARTITA.getRoom();
    if(el) el.btnElim.disabled = !(room && (room.indagini_usate || 0) >= 1);
  }

  function onRoom(room){
    if(!el || PARTITA.getRole() !== 'detective') return;
    aggiornaElimina();
    if(room.phase !== 'live' || !room.last_kill_at) return;
    if(room.last_kill_at === seenKill) return;
    seenKill = room.last_kill_at;

    const ps = PARTITA.getPlayers() || [];
    const vit = ps.find(function(p){ return p.uid === room.last_kill_uid; });
    if(vit) aggiungiTabella(vit.name);

    const ind = room.indagini_usate || 0, sk = room.skip_usati || 0;
    if(ind >= 3 && sk >= 2) return;
    apriLeggiIndizio();
  }

  function apriLeggiIndizio(){
    el.leggi.hidden = false;
    el.notif.hidden = true;
  }

  // "Hai letto?": mostra solo la notifica. TIMER RESTA BLOCCATO.
  async function mostraNotifica(){
    el.leggi.hidden = true;
    try{
      await PARTITA.dbRef().from('rooms').update({
        clue_read_at: new Date().toISOString()
      }).eq('id', PARTITA.getRoomId());
    }catch(e){ console.warn('[ISPETTORE] clue_read_at:', e); }
    const room = PARTITA.getRoom();
    const ind = room.indagini_usate || 0, sk = room.skip_usati || 0;
    el.notifTesto.textContent = 'Nuova vittima. Il timer di eliminazione è BLOCCATO.';
    el.btnSi.textContent = 'Sì, indago (' + (3 - ind) + ' rimaste)';
    el.btnNo.textContent = 'No, skip (' + (2 - sk) + ' rimasti)';
    el.btnSi.disabled = ind >= 3;
    el.btnNo.disabled = sk >= 2;
    el.notif.hidden = false;
  }

  // sblocca il timer: chiamato SOLO da Chiudi e da No
  async function sbloccaTimer(){
    await PARTITA.dbRef().from('rooms').update({
      next_kill_at: new Date(Date.now() + KILL_MS).toISOString()
    }).eq('id', PARTITA.getRoomId());
  }

  // PASSO: scegli persona. TIMER BLOCCATO.
  function doSi(){
    el.notif.hidden = true;
    bersaglioIndagine = null; campoScelto = null; faseEsito = false;
    el.indEsito.textContent = 'Scegli una persona.';
    el.indEsito.className = 'indagine-esito';
    el.indOk.disabled = true;
    el.indOk.textContent = 'Fine ispezione';
    el.indList.hidden = false;
    el.indCampi.hidden = false;
    el.indList.innerHTML = '';
    el.indCampi.innerHTML = '';
    const ps = (PARTITA.getPlayers() || []).filter(function(p){
      return p.alive !== false && p.uid !== PARTITA.getUid();
    });
    ps.forEach(function(p){
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bersaglio-card';
      b.textContent = p.name;
      b.addEventListener('click', function(){
        if(faseEsito) return;
        bersaglioIndagine = p; campoScelto = null;
        const tots = el.indList.querySelectorAll('.bersaglio-card');
        for(let i = 0; i < tots.length; i++){ tots[i].classList.remove('scelto'); }
        b.classList.add('scelto');
        mostraCampi(p);
      });
      el.indList.appendChild(b);
    });
    el.ind.hidden = false;
  }

  // PASSO: scegli caratteristica SENZA vedere il valore. TIMER BLOCCATO.
  function mostraCampi(p){
    el.indEsito.textContent = 'Ora scegli quale informazione verificare. Il valore uscirà solo con FINE ISPEZIONE.';
    el.indEsito.className = 'indagine-esito';
    el.indOk.disabled = true;
    el.indCampi.innerHTML = '';
    CAMPI.forEach(function(c){
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bersaglio-card campo';
      b.textContent = c[1];
      b.addEventListener('click', function(){
        if(faseEsito) return;
        campoScelto = c[0];
        const tots = el.indCampi.querySelectorAll('.bersaglio-card');
        for(let i = 0; i < tots.length; i++){ tots[i].classList.remove('scelto'); }
        b.classList.add('scelto');
        // NON mostro il valore: solo conferma della scelta
        el.indEsito.textContent = p.name + ' — ' + c[1] + ' selezionata. Premi FINE ISPEZIONE per rivelare.';
        el.indEsito.className = 'indagine-esito';
        el.indOk.disabled = false;
      });
      el.indCampi.appendChild(b);
    });
  }

  // FINE ISPEZIONE: rivela il valore ma NON sblocca ancora il timer.
  async function commitIndagine(){
    if(!bersaglioIndagine || !campoScelto) return;
    const room = PARTITA.getRoom();
    const n = (room.indagini_usate || 0) + 1;
    await PARTITA.dbRef().from('rooms').update({ indagini_usate: n }).eq('id', PARTITA.getRoomId());
    room.indagini_usate = n;

    // legge il valore SOLO adesso
    let card = null;
    try{ card = JSON.parse(bersaglioIndagine.card || 'null'); }catch(e){ card = null; }
    const val = card ? String(card[campoScelto] || '—') : '—';
    const etichetta = (CAMPI.find(function(c){ return c[0] === campoScelto; }) || [,''])[1];

    if(clue && campoScelto === clue.campo){
      if(card && String(card[clue.campo]) !== String(clue.valore)){
        aggiungiTabella(bersaglioIndagine.name);
      }
    }

    // mostra il risultato e nasconde le scelte
    faseEsito = true;
    el.indList.hidden = true;
    el.indCampi.hidden = true;
    el.indEsito.textContent = bersaglioIndagine.name + ' — ' + etichetta + ': ' + val;
    el.indEsito.className = 'indagine-esito si';
    el.indOk.textContent = 'Chiudi';
    el.indOk.disabled = false;

    // TIMER ANCORA BLOCCATO: partira solo con Chiudi
    aggiornaElimina();
    showToast('Ispezione (' + n + '/3): premi Chiudi per far ripartire il timer');
  }

  // CHIUDI: chiude il referto E SBLOCCA il timer.
  async function chiudiIndagine(){
    faseEsito = false;
    el.ind.hidden = true;
    el.indOk.textContent = 'Fine ispezione';
    await sbloccaTimer();
    showToast('Timer sbloccato');
  }

  // No: sblocca subito, skip consumato
  async function doNo(){
    el.notif.hidden = true;
    const room = PARTITA.getRoom();
    if((room.skip_usati || 0) < 2){
      const n = (room.skip_usati || 0) + 1;
      await PARTITA.dbRef().from('rooms').update({ skip_usati: n }).eq('id', PARTITA.getRoomId());
      room.skip_usati = n;
    }
    await sbloccaTimer();
  }

  function apriElimina(){
    if((PARTITA.getRoom().indagini_usate || 0) < 1) return;
    bersaglioElimina = null;
    el.elimConf.disabled = true;
    el.elimList.innerHTML = '';
    const ps = (PARTITA.getPlayers() || []).filter(function(p){
      return p.alive !== false && p.uid !== PARTITA.getUid();
    });
    ps.forEach(function(p){
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bersaglio-card';
      b.textContent = p.name;
      b.addEventListener('click', function(){
        bersaglioElimina = p;
        const tots = el.elimList.querySelectorAll('.bersaglio-card');
        for(let i = 0; i < tots.length; i++){ tots[i].classList.remove('scelto'); }
        b.classList.add('scelto');
        el.elimConf.disabled = false;
      });
      el.elimList.appendChild(b);
    });
    el.elim.hidden = false;
  }

  async function confermaElimina(){
    if(!bersaglioElimina) return;
    const vero = unscramble(bersaglioElimina.role, bersaglioElimina.uid);
    const winner = (vero === 'assassino') ? 'ispettore' : 'assassino';
    el.elim.hidden = true;
    await PARTITA.dbRef().from('rooms').update({
      winner: winner, phase: 'fine'
    }).eq('id', PARTITA.getRoomId());
    await sysMessage(PARTITA.getRoomId(),
      (winner === 'assassino') ? "🏆 Vince l'Assassino!" : "🏆 Vince l'Ispettore!");
  }

  boot();
})();