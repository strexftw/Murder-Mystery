// UTILS.JS v4.3 - identita, codici, toast, messaggi, reset.
// v4.3: resetPartita azzera anche intro_at (nuova intro a ogni partita).
// Stile anti-manomissione: solo commenti //, niente entita letterali,
// niente backslash problematici. Richiede database.txt Step 1 -> 8.

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

function getPlayerName(){ return sessionStorage.getItem('assassino_name') || ''; }
function savePlayerName(n){ sessionStorage.setItem('assassino_name', n.trim()); }

function saveCurrentRoom(room){ sessionStorage.setItem('assassino_room', JSON.stringify(room)); }
function getCurrentRoom(){
  try { return JSON.parse(sessionStorage.getItem('assassino_room')); }
  catch (e) { return null; }
}
function clearCurrentRoom(){ sessionStorage.removeItem('assassino_room'); }

// codice stanza: niente caratteri ambigui (0/O, 1/I)
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateRoomCode(len = 6){
  const a = new Uint32Array(len);
  crypto.getRandomValues(a);
  let s = '';
  for(let i = 0; i < len; i++) s += CODE_ALPHABET[a[i] % CODE_ALPHABET.length];
  return s;
}

// codice personale del giocatore (seme + 2 caratteri)
const CODE_SUITS = ['\u2660','\u2665','\u2663','\u2666'];
function generatePlayerCode(){
  const r = new Uint32Array(1);
  crypto.getRandomValues(r);
  return CODE_SUITS[r[0] % CODE_SUITS.length] + generateRoomCode(2);
}

// offuscamento XOR + base64 (solo ASCII: ruoli e indizi)
function scramble(text, key){
  const k = String(key || '');
  if(!k) return btoa(text);
  let out = '';
  for(let i = 0; i < text.length; i++)
    out += String.fromCharCode(text.charCodeAt(i) ^ k.charCodeAt(i % k.length));
  return btoa(out);
}
function unscramble(enc, key){
  try{
    const raw = atob(enc);
    const k = String(key || '');
    if(!k) return raw;
    let out = '';
    for(let i = 0; i < raw.length; i++)
      out += String.fromCharCode(raw.charCodeAt(i) ^ k.charCodeAt(i % k.length));
    return out;
  }catch(e){ return null; }
}

// escape HTML senza entita letterali (immune al copia-incolla)
function escapeHtml(s){
  let t = String(s == null ? '' : s);
  t = t.split('&').join('&' + 'amp;');
  t = t.split('<').join('&' + 'lt;');
  t = t.split('>').join('&' + 'gt;');
  t = t.split('"').join('&' + 'quot;');
  t = t.split("'").join('&' + '#39;');
  return t;
}

function showToast(msg, ok = true){
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg;
  t.className = 'toast show ' + (ok ? 'ok' : 'ko');
  clearTimeout(t._h);
  t._h = setTimeout(function(){ t.classList.remove('show'); }, 2400);
}

function configReady(){
  if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_ANON_KEY === 'undefined') return false;
  return SUPABASE_URL.indexOf('supabase.co') !== -1
      && SUPABASE_ANON_KEY.length > 30
      && SUPABASE_URL.indexOf('IL-TUO-PROGETTO') === -1;
}

function guardConfig(){
  const ok = configReady() && (typeof db !== 'undefined') && !!db;
  if (ok) return true;
  const d = document.createElement('div');
  d.className = 'config-warning';
  if (typeof SUPABASE_URL === 'undefined'){
    d.innerHTML = '\u26a0 <b>js/config.js</b> non risulta caricato: controlla percorso e nome del file.';
  } else if (!configReady()){
    d.innerHTML = '\u26a0 Compila <b>js/config.js</b> con URL e anon key del tuo progetto Supabase, poi ricarica.';
  } else {
    d.innerHTML = '\u26a0 Libreria Supabase non disponibile: controlla la connessione (CDN) e ricarica.';
  }
  document.body.appendChild(d);
  return false;
}

// messaggio di sistema nella chat
async function sysMessage(roomId, text){
  if (typeof db === 'undefined' || !db) return;
  await db.from('chat_messages').insert({
    room_id: roomId, sender: 'SISTEMA', message: text, is_system: true
  });
}

// riconoscimento dispositivo: pc / phone / tablet
function getDeviceType(){
  const ua = navigator.userAgent || '';
  const touch = navigator.maxTouchPoints || 0;
  if(/iPad|Tablet|Silk|Kindle|SM-T|SM-P|GT-P|GT-N|Nexus 7|Nexus 9/i.test(ua)) return 'tablet';
  if(/Macintosh/i.test(ua) && touch > 1) return 'tablet';
  if(/iPhone|iPod|Windows Phone|IEMobile|Opera Mini|BlackBerry/i.test(ua)) return 'phone';
  if(/Android.*Mobile/i.test(ua)) return 'phone';
  if(/Android/i.test(ua)) return 'tablet';
  if(/Mobile/i.test(ua)) return 'phone';
  return 'pc';
}

function deviceLabel(type){
  if(type === 'phone')  return '\ud83d\udcf1 Telefono';
  if(type === 'tablet') return '\ud83d\udcdf Tablet';
  return '\ud83d\udcbb PC';
}

// RESET UNICO partita (DB).
// v4.3: azzera anche intro_at, last_victim_clue, clue_read_at.
async function resetPartita(roomId){
  if (typeof db === 'undefined' || !db) return;
  await db.from('players').update({
    alive: true, ready: false, role: null, code: null, card: null
  }).eq('room_id', roomId);
  await db.from('rooms').update({
    started_at: null, phase: 'reveal', winner: null,
    clue: null, next_kill_at: null, last_kill_at: null, last_kill_uid: null,
    last_victim_clue: null, clue_read_at: null, intro_at: null,
    indagini_usate: 0, skip_usati: 0
  }).eq('id', roomId);
  console.log('[UTILS] resetPartita eseguito per', roomId);
}