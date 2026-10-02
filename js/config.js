/* ══════════════════════════════════════════════════════════════
   PROTOCOLLO OMBRA — js/config.js
   Configurazione, costanti, abilità, parole, task, ruoli.
   ⚠️ SB_URL / SB_KEY: chiave "anon" (pubblica per design), ma se il
   repo è pubblico valuta di rigenerarla e proteggere il canale con RLS.
   ══════════════════════════════════════════════════════════════ */

const SB_URL = "https://xkvnwezcdvkrisqhuvhx.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhrdm53ZXpjZHZrcmlzcWh1dmh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NDgxNDksImV4cCI6MjEwNjQyNDE0OX0.-1QaeGq0lU8MsjtSUpLWwTRxpFzWxtxAK00BzLNC6Zg";

const CFG = {
  MIN: 3, MAX: 8, MAXNAME: 8,
  SAB_UNLOCK: 30000, FIRST_KILL: 50000, KILL_CD: 45000, SAB_CD: 60000,
  SCAN_UNLOCK: 20000, SCAN_CD: 20000, SCAN_MAX: 3, SCAN_RECHARGE: 150000, NEWDET_SCAN: 40000,
  TASK_EVERY: 50000, TASK_WIN_MULT: 8,
  CRIT_CHANCE: 0.06, CRIT_TIME: 30000,
  COOP_CHANCE: 0.25,
  COOP_REQUEST_WINDOW: 60000,
  COOP_PICK_WINDOW: 45000,
  COOP_INVITE_TIME: 20000,
  COOP_BRIDGE_TIME: 20000, COOP_BRIDGE_DRAIN: 3.2, COOP_TAP: 7,
  COOP_RUNES: 6, COOP_VALVES: 4,
  WHISPER_ANNOUNCE_CD: 10000,
  SEANCE_NEED: 4, SEANCE_VOTE: 20000,
  WORD_TIME: 40000, WORD_SHOW: 15000,
  VOTE_TIME: 40000, VOTE_REVEAL: 5000, MEET_CD: 120000,
  PUTTANA_CD: 240000, PUTTANA_TRIGGER: 5, PUTTANA_TIMER: 30000,
  REAPER_TIMEOUT: 25000,   // ★ senza segnali per 25s → disconnesso
  CLIENT_PING: 5000,       // ★ heartbeat client
  HEARTBEAT: 2000
};

const VIO = '#c26bff';

const COOP_TYPES = ['ponte', 'codice', 'valvole'];
const COOPNAMES = { ponte:'PONTE ENERGETICO', codice:'CODICE INCROCIATO', valvole:'VALVOLE GEMELLE' };
const COOPDESC = {
  ponte:'Martellate insieme sulla barra: non deve svuotarsi!',
  codice:'Ognuno vede metà rune: parlatevi e inserite la sequenza completa.',
  valvole:'Fermate le lancette in zona: entrambi, per ogni valvola.'
};

const ABS = {
  spalmatore:{ n:'LO SPALMATORE PAZZO', ch:8, c:'#b87333',
    d:"UNA VOLTA: elimina un giocatore a scelta. Se era l'ASSASSINO vincete immediatamente. Se era un innocente… hai spalmato un amico, con tanto di jumpscare." },
  puttana:{ n:'LA PUTTANA', ch:0, c:'#ff6ec7',
    d:"PROMOZIONE: resuscita un eliminato da ASSASSINO o SPALMATORE ogni 4 minuti. MAI sui votati." },
  sparlatore:{ n:'LO SPARLATORE', ch:8, c:'#c26bff',
    d:"UNA VOLTA: svela PUBBLICAMENTE nel registro il ruolo di un giocatore." },
  gesu:{ n:'CHE GESÙ STA CON TE', ch:8, c:'#ffd700',
    d:"PASSIVA: resusciti alla prima uccisione. ATTIVA: resusciti tu un ucciso da assassino/spalmatore." },
  merde:{ n:'SONO TORNATO MERDE', ch:8, c:'#ff8c42',
    d:"PASSIVA: se espulso dai voti rientri. ATTIVA: resusciti un espulso dai voti." }
};
const AB_ORDER = ['spalmatore','sparlatore','gesu','merde'];

const WORDS = ['FUOCO','OCEANO','SPECCHIO','FULMINE','DESERTO','FORESTA','GHIACCIO','VULCANO','COMETA','LABIRINTO','OROLOGIO','DIAMANTE','CORVO','SERPENTE','LANTERNA','BUSSOLA','TELEFONO','PIANOFORTE','FARO','MASCHERA','INVERNO','TEMPORALE','CASTELLO','RAGNO','VETRO','MONETA','SENTIERO','ECLISSI','DRAGO','FUMETTO','GIOSTRA','PIZZA','ANCORA','CACCIA','SEMAFORO','CASCATA','SCACCHI','LUNA','ARCOBALENO','VALIGIA'];

const TASKS = [
  { id:'circ',  name:'Cablaggio circuiti',    desc:'Collega ogni nodo al suo gemello dello stesso colore.' },
  { id:'gen',   name:'Accensione generatore', desc:'Tieni premuto finché la carica non raggiunga il 100%.' },
  { id:'card',  name:'Badge di accesso',      desc:'Trascina la scheda nello scanner alla giusta velocità.' },
  { id:'seq',   name:'Codice di sicurezza',   desc:'Memorizza e ripeti la sequenza luminosa.' },
  { id:'react', name:'Stabilizza reattore',   desc:'Colpisci le 5 scariche elettriche.' }
];

const GNAME = { circ:'TAVOLA OUIJA', gen:'CANDELE DEL RITO', card:'ANIME ERRANTI', seq:'RUNE DEL RITUALE', react:'SIGILLI SPEZZATI' };
const GDESC = {
  circ:'Ferma la planchette 🔮 nella zona infestata 3 volte.',
  gen:'Tieni accese TUTTE le candele: il vento le spegne.',
  card:'Afferra 5 anime erranti prima che svaniscano.',
  seq:'Memorizza e ripeti il rituale di rune.',
  react:'Spezza i 4 sigilli: 3 colpi rapidi ciascuno.'
};
const GMAP = { circ:'ouija', gen:'candele', card:'anime', seq:'rune', react:'catene' };

const ROLE = {
  assassino:{ l:'ASSASSINO', c:'var(--red)' },
  detective:{ l:'DETECTIVE', c:'var(--amber)' },
  innocente:{ l:'INNOCENTE', c:'var(--cyan)' }
};

const RUNE_CHARS = ['ᚠ','ᚱ','ᛗ','','ᚹ','','ᚦ',''];