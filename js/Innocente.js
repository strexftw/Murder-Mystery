// INNOCENTE.JS v1 — ricezione dell'eliminazione.
// Quando il colpo dell'assassino scade, la VITTIMA (innocente o
// detective) vede un jumpscare a schermo intero con suono
// generato via WebAudio (niente file esterni), disattivabile
// col pulsante mute. Al termine chiama il gancio della
// modalita spettro (TODO: Spettro.js).
(function(){
  let el = null;
  let visto = false;   // jumpscare gia mostrato
  let audioCtx = null;
  let muto = localStorage.getItem('assassino_muto') === '1';

  // TODO: modalita spettro — punto di aggancio per il futuro Spettro.js.
  // Quando lo creerai, bastera che Spettro.js ridefinisca questa funzione.
  window.entraInModalitaSpettro = window.entraInModalitaSpettro || function(){
    console.log('[SPETTRO] TODO: modalita spettro non ancora implementata');
    showToast('Sei eliminato: la modalita spettro arrivera con Spettro.js', false);
  };

  function boot(){
    if(typeof PARTITA === 'undefined' || !PARTITA.on){ setTimeout(boot, 120); return; }
    PARTITA.on('ready', setup);
    PARTITA.on('room', onRoom);
  }

  function setup(){
    el = {
      jump: document.getElementById('jumpscare'),
      face: document.getElementById('jumpFace'),
      text: document.getElementById('jumpText'),
      mute: document.getElementById('btnMute')
    };
    const miss = Object.keys(el).filter(function(k){ return !el[k]; });
    if(miss.length){ console.warn('[INNOCENTE] elementi mancanti:', miss); return; }

    aggiornaIconaMute();
    el.mute.addEventListener('click', function(){
      muto = !muto;
      localStorage.setItem('assassino_muto', muto ? '1' : '0');
      aggiornaIconaMute();
    });

    // i browser bloccano l'audio finche non c'e un gesto utente:
    // lo sblochiamo al primo tocco/click sulla pagina
    const unlock = function(){
      ctx();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  function aggiornaIconaMute(){
    if(el && el.mute) el.mute.textContent = muto ? '🔇' : '🔊';
  }

  // ---------------- AUDIO (WebAudio, nessun file) ----------------
  function ctx(){
    if(!audioCtx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if(AC) audioCtx = new AC();
    }
    if(audioCtx && audioCtx.state === 'suspended'){ audioCtx.resume(); }
    return audioCtx;
  }

  // urla del jumpscare: rumore bianco + sega discendente
  function suonoJumpscare(){
    if(muto) return;
    const c = ctx();
    if(!c) return;
    const t0 = c.currentTime;

    const len = Math.floor(c.sampleRate * 0.9);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const dat = buf.getChannelData(0);
    for(let i = 0; i < len; i++){ dat[i] = (Math.random() * 2 - 1) * (1 - i / len); }
    const src = c.createBufferSource(); src.buffer = buf;
    const g1 = c.createGain();
    g1.gain.setValueAtTime(0.9, t0);
    g1.gain.exponentialRampToValueAtTime(0.001, t0 + 0.9);
    src.connect(g1); g1.connect(c.destination);
    src.start(t0);

    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, t0);
    osc.frequency.exponentialRampToValueAtTime(90, t0 + 1.1);
    const g2 = c.createGain();
    g2.gain.setValueAtTime(0.5, t0);
    g2.gain.exponentialRampToValueAtTime(0.001, t0 + 1.1);
    osc.connect(g2); g2.connect(c.destination);
    osc.start(t0); osc.stop(t0 + 1.15);
  }

  // ---------------- SCADENZA DEL COLPO ----------------
  function onRoom(room){
    if(visto || !el || !room || !room.kill_at) return;
    if(room.kill_target_uid !== PARTITA.getUid()) return;
    if(Date.now() < Date.parse(room.kill_at)) return;
    visto = true;
    eliminaMe();
  }

  async function eliminaMe(){
    // jumpscare subito
    suonoJumpscare();
    el.jump.hidden = false;

    // dopo 1.5s: se il pulitore non ha ancora scritto la mia morte,
    // la scrivo io (lettura fresca dal DB: niente messaggi duplicati)
    setTimeout(async function(){
      try{
        const meRes = await PARTITA.dbRef().from('players')
          .select('id, alive')
          .eq('room_id', PARTITA.getRoomId())
          .eq('uid', PARTITA.getUid())
          .maybeSingle();
        if(meRes.data && meRes.data.alive !== false){
          const up = await PARTITA.dbRef().from('players')
            .update({ alive: false }).eq('id', meRes.data.id);
          if(!up.error){
            await sysMessage(PARTITA.getRoomId(),
              '☠ ' + escapeHtml(PARTITA.getMyName()) + ' è stato eliminato.');
          }
        }
      }catch(e){ console.warn('[INNOCENTE] auto-esecuzione:', e); }
    }, 1500);

    // fine jumpscare -> gancio spettro
    setTimeout(function(){
      el.jump.hidden = true;
      if(typeof window.entraInModalitaSpettro === 'function'){
        window.entraInModalitaSpettro();
      }
    }, 3000);
  }

  boot();
})();