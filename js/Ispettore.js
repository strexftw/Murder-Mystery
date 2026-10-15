// ISPETTORE.JS v2 - notifica vittima, indagine con scelta
// dell'informazione, tabella, accusa finale.
// Ogni risposta (Si o No) FA RIPARTIRE il clock uccisioni (12s).
(function(){
  const KILL_MS = 12000;     // deve combaciare con Sistema.js
  const AUTO_NO_SEC = 10;
  let el = null, clue = null, seenKill = null;
  let autoTick = null;
  let bersaglioIndagine = null, campoScelto = null, bersaglioElimina = null;

  // etichette delle informazioni indagabili
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
      if(autoTick) clearInterval(autoTick);
      if(el){
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
      notif:     document.getElementById('overlayNotifica'),
      notifTesto:document.getElementById('notifTesto'),
      notifCount:document.getElementById('notifCount'),
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
    el.btnSi.addEventListener('click', doSi);
    el.btnNo.addEventListener('click', function(){ doNo(false); });
    el.indOk.addEventListener('click', commitIndagine);
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
    if(ind >= 3 && sk >= 2) return;   // budget finito: niente notifica
    apriNotifica(vit ? vit.name : 'Qualcuno', ind, sk);
  }

  function apriNotifica(nomeVittima, ind, sk){
    el.notifTesto.textContent = 'Nuova vittima: ' + nomeVittima + '. Il tempo è FERMO finché non decidi.';
    el.btnSi.textContent = 'Sì, indago (' + (3 - ind) + ' rimaste)';
    el.btnNo.textContent = 'No, skip (' + (2 - sk) + ' rimasti)';
    el.btnSi.disabled = ind >= 3;
    el.btnNo.disabled = sk >= 2;
    el.notif.hidden = false;
    let rest = AUTO_NO_SEC;
    el.notifCount.textContent = 'Auto-No tra ' + rest + 's';
    if(autoTick) clearInterval(autoTick);
    autoTick = setInterval(function(){
      rest--;
      el.notifCount.textContent = 'Auto-No tra ' + Math.max(0, rest) + 's';
      if(rest <= 0){ clearInterval(autoTick); doNo(true); }
    }, 1000);
  }

  function chiudiNotifica(){
    if(autoTick) clearInterval(autoTick);
    el.notif.hidden = true;
  }

  // ogni risposta fa ripartire il clock uccisioni
  async function resetClock(){
    await PARTITA.dbRef().from('rooms').update({
      next_kill_at: new Date(Date.now() + KILL_MS).toISOString()
    }).eq('id', PARTITA.getRoomId());
  }

  function doSi(){
    chiudiNotifica();
    bersaglioIndagine = null; campoScelto = null;
    el.indEsito.textContent = '';
    el.indOk.disabled = true;
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

  // scegli QUALE informazione vedere della carta
  function mostraCampi(p){
    el.indEsito.textContent = 'Scegli quale informazione verificare.';
    el.indEsito.className = 'indagine-esito';
    el.indOk.disabled = true;
    el.indCampi.innerHTML = '';
    let card = null;
    try{ card = JSON.parse(p.card || 'null'); }catch(e){ card = null; }
    CAMPI.forEach(function(c){
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bersaglio-card campo';
      b.textContent = c[1];
      b.addEventListener('click', function(){
        campoScelto = c[0];
        const tots = el.indCampi.querySelectorAll('.bersaglio-card');
        for(let i = 0; i < tots.length; i++){ tots[i].classList.remove('scelto'); }
        b.classList.add('scelto');
        const val = card ? String(card[c[0]] || '—') : '—';
        el.indEsito.textContent = p.name + ' — ' + c[1] + ': ' + val;
        el.indEsito.className = 'indagine-esito no';
        el.indOk.disabled = false;
      });
      el.indCampi.appendChild(b);
    });
  }

  async function commitIndagine(){
    const room = PARTITA.getRoom();
    const n = (room.indagini_usate || 0) + 1;
    await PARTITA.dbRef().from('rooms').update({ indagini_usate: n }).eq('id', PARTITA.getRoomId());
    room.indagini_usate = n;
    await resetClock();
    el.ind.hidden = true;
    aggiornaElimina();
    showToast('Indagine registrata (' + n + '/3)');
  }

  async function doNo(auto){
    chiudiNotifica();
    const room = PARTITA.getRoom();
    if(!auto && (room.skip_usati || 0) < 2){
      const n = (room.skip_usati || 0) + 1;
      await PARTITA.dbRef().from('rooms').update({ skip_usati: n }).eq('id', PARTITA.getRoomId());
      room.skip_usati = n;
    }
    await resetClock();
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