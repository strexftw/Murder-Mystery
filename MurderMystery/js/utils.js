/* ══════════════════════════════════════════════════════════════
   PROTOCOLLO OMBRA — js/utils.js
   Funzioni utilità usate in tutto il gioco.
   Dipendenze: nessuna (caricato dopo config.js).
   ══════════════════════════════════════════════════════════════ */

/* ═══ SELETTORI DOM ═══ */
const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* ═══ CASO ═══ */
const rnd  = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];

function shuffle(a){
  a = [...a];
  for(let i = a.length - 1; i > 0; i--){
    const j = rnd(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ═══ IDENTIFICATIVI ═══ */
const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);

function mkCode(){
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = c[rnd(24)] + c[rnd(24)] + '-';
  for(let i = 0; i < 4; i++) s += c[rnd(32)];
  return s;
}

function genRoom(){
  const c = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for(let i = 0; i < 5; i++) s += c[rnd(c.length)];
  return s;
}

/* ═══ FORMATTAZIONE ═══ */
function fmt(ms){
  ms = Math.max(0, ms);
  const s = Math.ceil(ms / 1000);
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' +
         String(s % 60).padStart(2, '0');
}

function esc(s){
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

/* ═══ VISIBILITÀ ELEMENTI ═══ */
const show = el => el && el.classList.add('on');
const hide = el => el && el.classList.remove('on');

/* ═══ COLORI ═══ */
function rgba(hex, a){
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}

/* ═══ LETTERE / NOMI ═══ */
function randomLetter(name){
  const clean = String(name).replace(/[^a-zA-Z0-9àèéìòùÀÈÉÌÒÙ]/g, '');
  if(!clean.length) return '?';
  return clean.charAt(rnd(clean.length)).toUpperCase();
}

/* ═══ VALIDAZIONE NOME ═══ */
function validName(){
  const el = $('#inp-name');
  const n = el ? el.value.trim().slice(0, CFG.MAXNAME) : '';
  if(!n){ banner('INSERISCI UN NOME', 'red'); return null; }
  return n;
}

/* ═══ HELPERS GIOCO ═══ */
// Ritorna il giocatore con quell'id dentro G (definito in state.js)
function byId(id){ return G ? G.players.find(p => p.id === id) : null; }

// Annulla la task in corso di un giocatore (e la eventuale sessione coop)
function cancelTask(p){
  if(!p || !p.task) return;
  if(G && G.coopInvites){
    for(const k in G.coopInvites){
      const inv = G.coopInvites[k];
      if(inv && (inv.requester === p.id || inv.partner === p.id)) delete G.coopInvites[k];
    }
  }
  if(p.task.type === 'coop' && p.task.coopSession && G && G.coopSessions){
    const s = G.coopSessions[p.task.coopSession];
    if(s){
      s.done = true; s.fail = true;
      const other = byId(s.a === p.id ? s.b : s.a);
      if(other && other.task && other.task.coopSession === p.task.coopSession) other.task = null;
      delete G.coopSessions[p.task.coopSession];
    }
  }
  p.task = null;
}

// Pulizie alla resurrezione: nessun residuo di task/quarantena/morte
function resurrectCleanup(p){
  if(!p) return;
  p.quarantined = false;
  p.task = null;
  p.lastTaskAt = Date.now();
  priv(p.id, {type:'note', txt:'✨ SEI TORNATO IN VITA: riprendi a operare.'});
}

// Numero di giocatori vivi NON assassini (per la condizione di vittoria assassino)
function aliveNonAss(){ return G.players.filter(p => p.alive && p.role !== 'assassino').length; }

// Progresso barra stazione (solo task di innocenti+detective)
function taskProg(){
  return G.players.reduce((acc, p) => acc + ((p.role !== 'assassino') ? p.tasks : 0), 0);
}

// Crea un nuovo oggetto giocatore
function mkPlayer(id, name){
  return {
    id, name, alive:true, role:null, code:mkCode(),
    tasks:0, task:null, lastTaskAt:0,
    killReadyAt:0, sabReadyAt:0,
    scanReadyAt:0, scanCharges:0, scanNextChargeAt:0,
    cdw:0, cdv:0, rulesOk:false, revealOk:false, nextAt:0,
    quarantined:false,
    ab:null, usedAbs:[], pendingAb:null,
    isPuttana:false, puttanaReadyAt:0, deadBy:null
  };
}