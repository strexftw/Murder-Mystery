/* ══════════════════════════════════════════════════════════════
   PROTOCOLLO OMBRA — js/main.js
   Bootstrap finale: inizializza Supabase, collega la UI.
   ══════════════════════════════════════════════════════════════ */

(function main(){
  if(!SB_URL || !SB_URL.startsWith('http') || !SB_KEY || SB_KEY.length < 20){
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
  initUI();
  console.log('[OMBRA] Bootstrap completato. In attesa di giocatori…');
})();