/* =========================================================
   UTILS.JS — identità dispositivo, codici, toast, messaggi
   ========================================================= */

/* --- identità del giocatore (persistita su questo dispositivo) --- */
function getUid(){
  let u = localStorage.getItem('assassino_uid');
  if(!u){
    u = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now();
    localStorage.setItem('assassino_uid', u);
  }
  return u;
}
function getPlayerName(){ return localStorage.getItem('assassino_name') || ''; }
function savePlayerName(n){ localStorage.setItem('assassino_name', n.trim()); }

/* --- stanza corrente --- */
function saveCurrentRoom(room){ localStorage.setItem('assassino_room', JSON.stringify(room)); }
function getCurrentRoom(){
  try { return JSON.parse(localStorage.getItem('assassino_room')); }
  catch (e) { return null; }
}
function clearCurrentRoom(){ localStorage.removeItem('assassino_room'); }

/* --- codice stanza: niente caratteri ambigui (0/O, 1/I) --- */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateRoomCode(len = 6){
  const a = new Uint32Array(len);
  crypto.getRandomValues(a);
  let s = '';
  for(let i = 0; i < len; i++) s += CODE_ALPHABET[a[i] % CODE_ALPHABET.length];
  return s;
}

/* --- escape HTML --- */
function escapeHtml(s){
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* --- toast --- */
function showToast(msg, ok = true){
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg;
  t.className = 'toast show ' + (ok ? 'ok' : 'ko');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2400);
}

/* --- controllo configurazione (a prova di file mancante) --- */
function configReady(){
  // se config.js non è stato caricato, queste costanti non esistono:
  if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_ANON_KEY === 'undefined') return false;
  return /supabase\.co\/?$/.test(SUPABASE_URL)
      && SUPABASE_ANON_KEY.length > 30
      && SUPABASE_URL.indexOf('IL-TUO-PROGETTO') === -1;
}

function guardConfig(){
  const ok = configReady() && (typeof db !== 'undefined') && !!db;
  if (ok) return true;

  const d = document.createElement('div');
  d.className = 'config-warning';
  if (typeof SUPABASE_URL === 'undefined'){
    d.innerHTML = '⚠ <b>js/config.js</b> non risulta caricato: controlla percorso e nome del file.';
  } else if (!configReady()){
    d.innerHTML = '⚠ Compila <b>js/config.js</b> con URL e anon key del tuo progetto Supabase, poi ricarica.';
  } else {
    d.innerHTML = '⚠ Libreria Supabase non disponibile: controlla la connessione (CDN) e ricarica.';
  }
  document.body.appendChild(d);
  return false;
}

/* --- messaggio di sistema nella chat della lobby --- */
async function sysMessage(roomId, text){
  if (typeof db === 'undefined' || !db) return;
  await db.from('chat_messages').insert({
    room_id: roomId, sender: 'SISTEMA', message: text, is_system: true
  });
}