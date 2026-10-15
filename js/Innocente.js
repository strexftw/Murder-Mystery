// INNOCENTE.JS v1.2 - jumpscare per chi viene ucciso dal Sistema,
// poi gancio spettro (TODO: Spettro.js). Audio WebAudio con mute.
(function(){
  let el = null, visto = null, audioCtx = null;
  let t1 = null, t2 = null;
  let muto = localStorage.getItem('assassino_muto') === '1';

  // TODO: modalita spettro - punto di aggancio per Spettro.js
  window.entraInModalitaSpettro = window.entraInModalitaSpettro || function(){
    console.log('[SPETTRO] TODO: modalita spettro non ancora implementata');
    showToast('Sei eliminato: la modalita spettro arrivera con Spettro.js', false);
  };

  function boot(){
    if(typeof PARTITA === 'undefined' || !PARTITA.on){ setTimeout(boot, 120); return; }
    PARTITA.on('ready', setup);
    PARTITA.on('room', onRoom);
    PARTITA.on('reset', function(){
      visto = null;
      if(t1) clearTimeout(t1);
      if(t2) clearTimeout(t2);
      if(el) el.jump.hidden = true;
    });
  }

  function setup(){
    el = {
      jump: document.getElementById('jumpscare'),
      mute: document.getElementById('btnMute')
    };
    aggiornaMute();
    el.mute.addEventListener('click', function(){
      muto = !muto;
      localStorage.setItem('assassino_muto', muto ? '1' : '0');
      aggiornaMute();
    });
    const unlock = function(){
      ctx();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  function aggiornaMute(){ if(el && el.mute) el.mute.textContent = muto ? '🔇' : '🔊'; }

  function ctx(){
    if(!audioCtx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if(AC) audioCtx = new AC();
    }
    if(audioCtx && audioCtx.state === 'suspended'){ audioCtx.resume(); }
    return audioCtx;
  }

  function suono(){
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
    src.connect(g1); g1.connect(c.destination); src.start(t0);
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

  function onRoom(room){
    if(!el || !room || !room.last_kill_at) return;
    if(room.last_kill_uid !== PARTITA.getUid()) return;
    if(room.last_kill_at === visto) return;
    visto = room.last_kill_at;
    suono();
    el.jump.hidden = false;
    t1 = setTimeout(function(){
      el.jump.hidden = true;
      if(typeof window.entraInModalitaSpettro === 'function') window.entraInModalitaSpettro();
    }, 3000);
  }

  boot();
})();