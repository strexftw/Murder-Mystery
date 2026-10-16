  // ---------------- INTRO VIDEO ----------------
  function costruisciIntro(){
    const wrap = document.createElement('div');
    wrap.className = 'overlay intro';
    wrap.id = 'overlayIntro';
    wrap.hidden = true;
    wrap.innerHTML =
      '<video id="introVideo" playsinline preload="auto"></video>' +
      '<button class="intro-btn intro-skip" id="btnSaltaIntro" type="button">Salta ›</button>' +
      '<button class="intro-btn intro-mute" id="btnIntroMute" type="button">🔊 Muta</button>' +
      '<button class="intro-tap" id="introTap" type="button" hidden>▶ Tocca per riprodurre</button>';
    document.body.appendChild(wrap);
    return wrap;
  }

  // Parte CON audio. Se il browser blocca l'autoplay audio (nessuna
  // gesture su questa pagina), mostra "Tocca per riprodurre": il tap
  // e' un gesto e sblocca l'audio. Sta all'utente mutare o saltare.
  async function avviaIntro(done){
    introInCorso = true;
    const wrap    = costruisciIntro();
    const video   = document.getElementById('introVideo');
    const btnSkip = document.getElementById('btnSaltaIntro');
    const btnMute = document.getElementById('btnIntroMute');
    const tap     = document.getElementById('introTap');
    let chiuso = false;

    const chiudi = function(){
      if(chiuso) return;
      chiuso = true;
      introInCorso = false;
      try{ video.pause(); }catch(e){}
      wrap.hidden = true;
      done();
    };

    btnSkip.addEventListener('click', chiudi);
    btnMute.addEventListener('click', function(){
      video.muted = !video.muted;
      btnMute.textContent = video.muted ? '🔇 Attiva audio' : '🔊 Muta';
    });
    tap.addEventListener('click', function(){
      tap.hidden = true;
      const p = video.play();
      if(p && p.catch) p.catch(function(){ chiudi(); });
    });
    video.addEventListener('ended', chiudi);
    video.addEventListener('error', function(){
      console.warn('[PARTITA] intro: errore video, salto');
      chiudi();
    });
    setTimeout(chiudi, 120000);

    try{
      const nomeIntro = (typeof INTRO_FILE !== 'undefined' && INTRO_FILE) ? INTRO_FILE : 'intro.mp4';
      const res = db.storage.from('video').getPublicUrl(nomeIntro);
      const url = (res && res.data) ? res.data.publicUrl : null;
      if(!url){ chiudi(); return; }
      video.src = url;
      video.muted = false;   // AUDIO ATTIVO di default
      wrap.hidden = false;
      console.log('[PARTITA] intro: riproduzione (con audio)', nomeIntro);
      const p = video.play();
      if(p && p.catch) p.catch(function(){ tap.hidden = false; });
    }catch(e){
      console.warn('[PARTITA] intro: storage non raggiungibile, salto', e);
      chiudi();
    }
  }

  // ---------------- VIDEO DI VITTORIA ----------------
  function costruisciVideoFine(){
    const wrap = document.createElement('div');
    wrap.className = 'overlay intro';
    wrap.id = 'overlayVideoFine';
    wrap.hidden = true;
    wrap.innerHTML =
      '<video id="fineVideo" playsinline preload="auto"></video>' +
      '<button class="intro-btn intro-skip" id="btnSaltaFine" type="button">Salta ›</button>' +
      '<button class="intro-btn intro-mute" id="btnFineMute" type="button">🔊 Muta</button>' +
      '<button class="intro-tap" id="fineTap" type="button" hidden>▶ Tocca per riprodurre</button>';
    document.body.appendChild(wrap);
    return wrap;
  }

  async function avviaVideoFine(winner, done){
    const wrap    = costruisciVideoFine();
    const video   = document.getElementById('fineVideo');
    const btnSkip = document.getElementById('btnSaltaFine');
    const btnMute = document.getElementById('btnFineMute');
    const tap     = document.getElementById('fineTap');
    let chiuso = false;

    const chiudi = function(){
      if(chiuso) return;
      chiuso = true;
      try{ video.pause(); }catch(e){}
      wrap.hidden = true;
      done();
    };

    btnSkip.addEventListener('click', chiudi);
    btnMute.addEventListener('click', function(){
      video.muted = !video.muted;
      btnMute.textContent = video.muted ? '🔇 Attiva audio' : '🔊 Muta';
    });
    tap.addEventListener('click', function(){
      tap.hidden = true;
      const p = video.play();
      if(p && p.catch) p.catch(function(){ chiudi(); });
    });
    video.addEventListener('ended', chiudi);
    video.addEventListener('error', function(){
      console.warn('[PARTITA] video vittoria: errore (nome file?), salto al tabellone');
      chiudi();
    });
    setTimeout(chiudi, 120000);

    try{
      const nome = (winner === 'assassino') ? WIN_VIDEO_ASSASSINO : WIN_VIDEO_ISPETTORE;
      const res = db.storage.from('video').getPublicUrl(nome);
      const url = (res && res.data) ? res.data.publicUrl : null;
      if(!url){ chiudi(); return; }
      video.src = url;
      video.muted = false;   // AUDIO ATTIVO di default
      wrap.hidden = false;
      console.log('[PARTITA] video vittoria: riproduzione (con audio)', nome);
      const p = video.play();
      if(p && p.catch) p.catch(function(){ tap.hidden = false; });
    }catch(e){
      console.warn('[PARTITA] video vittoria: storage non raggiungibile, salto', e);
      chiudi();
    }
  }