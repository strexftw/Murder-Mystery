// INNOCENTE.JS v1.8 - jumpscare + indizio + chiusura automatica
// quando il detective clicca "Hai letto?" (clue_read_at).
// v1.8: NUOVO - quando la partita finisce (phase 'fine' o winner
// impostato), chiude jumpscare + overlay morte cosi la vittima
// puo vedere l'overlay di fine partita e tornare in lobby.
(function(){
  let el = null, visto = null, audioCtx = null;
  let t1 = null;
  let muto = localStorage.getItem('assassino_muto') === '1';
  let clueLetto = false;
  let finita = false;   // true quando la partita e conclusa

  function boot(){
    if(typeof PARTITA === 'undefined' || !PARTITA.on){ setTimeout(boot, 120); return; }
    PARTITA.on('ready', setup);
    PARTITA.on('room', onRoom);
    PARTITA.on('reset', function(){
      visto = null; clueLetto = false; finita = false;
      if(t1) clearTimeout(t1);
      if(el){
        el.jump.hidden = true;
        el.overlayMorte.hidden = true;
      }
    });
  }

  function setup(){
    el = {
      jump: document.getElementById('jumpscare'),
      mute: document.getElementById('btnMute'),
      overlayMorte: document.getElementById('overlayMorte'),
      morteClue: document.getElementById('morteClue')
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

  // chiude tutto cio che riguarda morte/jumpscare
  function chiudiTutto(){
    if(t1) clearTimeout(t1);
    if(el){
      el.jump.hidden = true;
      el.overlayMorte.hidden = true;
    }
  }

  function onRoom(room){
    if(!el) return;

    // FINE PARTITA: la vittima deve poter tornare in lobby.
    // Chiudo jumpscare + overlay morte, cosi overlayFine e cliccabile.
    if(room && (room.phase === 'fine' || room.winner)){
      if(!finita){
        finita = true;
        chiudiTutto();
        console.log('[INNOCENTE] fine partita: overlay morte chiuso');
      }
      return;
    }

    // Il detective ha letto l'indizio di QUESTO turno: chiudi l'overlay
    if(room && room.clue_read_at && !clueLetto){
      clueLetto = true;
      el.overlayMorte.hidden = true;
      console.log('[INNOCENTE] overlay morte chiuso (clue_read_at letto)');
    }

    if(!room || !room.last_kill_at) return;
    if(room.last_kill_uid !== PARTITA.getUid()) return;
    if(room.last_kill_at === visto) return;
    visto = room.last_kill_at;
    clueLetto = false;

    // se per qualche motivo la partita e gia finita, non mostrare niente
    if(finita) return;

    const clueTesto = room.last_victim_clue || "L'assassino è tra voi.";

    suono();
    el.jump.hidden = false;
    el.overlayMorte.hidden = true;

    t1 = setTimeout(function(){
      el.jump.hidden = true;
      // guardia: se nel frattempo il detective ha letto o la partita e finita, non mostrare
      if(clueLetto || finita){
        console.log('[INNOCENTE] salto overlay morte (letto o finita)');
        return;
      }
      if(el.morteClue) el.morteClue.textContent = clueTesto;
      el.overlayMorte.hidden = false;
    }, 3000);
  }

  boot();
})();