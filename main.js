/* ══════════════════════════════════════════════════════════════
   PROTOCOLLO OMBRA — js/main.js
   Bootstrap finale: inizializza Supabase, collega la UI, avvia il gioco.
   Dipendenze: TUTTI i file precedenti (caricato per ultimo).
   ══════════════════════════════════════════════════════════════ */

/* ═══ AVVIO ═══ */
(function main(){
  // ── 1. Inizializza il client Supabase ──
  if(!SB_URL || !SB_URL.startsWith('http') || !SB_KEY || SB_KEY.length < 20){
    // Credenziali mancanti → mostra avviso di configurazione
    const w = $('#cfg-warn');
    if(w) w.classList.add('on');
    console.error('[OMBRA] Credenziali Supabase mancanti. Modifica js/config.js');
    return;
  }
  try{
    SB = window.supabase.createClient(SB_URL, SB_KEY);
  }catch(e){
    console.error('[OMBRA] Errore creazione client Supabase:', e);
    const w = $('#cfg-warn');
    if(w) w.classList.add('on');
    return;
  }

  // ── 2. Collega tutti i pulsanti della UI ──
  initUI();

  // ── 3. Il loop di rendering è già avviato da background.js ──
  // (requestAnimationFrame(loop))

  console.log('[OMBRA] Bootstrap completato. In attesa di giocatori…');
})();