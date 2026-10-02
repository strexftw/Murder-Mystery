/* ══════════════════════════════════════════════════════════════
   PROTOCOLLO OMBRA — js/config.js
   Configurazione, costanti, abilità, parole, task, ruoli.
   ⚠️ SB_URL / SB_KEY: chiave "anon" (pubblica per design), ma se il
   repo è pubblico valuta di rigenerarla e proteggere il canale con RLS.
   ══════════════════════════════════════════════════════════════ */

/* ═══ CREDENZIALI SUPABASE (OBBLIGATORIE) ═══ */
const SB_URL = "https://xkvnwezcdvkrisqhuvhx.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhrdm53ZXpjZHZrcmlzcWh1dmh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NDgxNDksImV4cCI6MjEwNjQyNDE0OX0.-1QaeGq0lU8MsjtSUpLWwTRxpFzWxtxAK00BzLNC6Zg";

/* ═══ PARAMETRI DI GIOCO ═══ */
const CFG = {
  MIN: 3, MAX: 8, MAXNAME: 8,

  // Assassino
  SAB_UNLOCK: 30000,     // sabotaggio sbloccato dopo 30s
  FIRST_KILL: 50000,     // prima uccisione dopo 50s
  KILL_CD: 45000,        // ricarica uccisione 45s
  SAB_CD: 60000,         // riuso sabotaggio 60s

  // Detective
  SCAN_UNLOCK: 20000,    // scan attivo dopo 20s
  SCAN_CD: 20000,        // ricarica scan 20s
  SCAN_MAX: 3,           // cariche max
  SCAN_RECHARGE: 150000, // +1 carica ogni 2,5 min
  NEWDET_SCAN: 40000,    // nuovo detective: primo scan dopo 40s

  // Task
  TASK_EVERY: 50000,     // una task ogni 50s
  TASK_WIN_MULT: 8,      // barra stazione = 8 × giocatori

  // Task critica (6%)
  CRIT_CHANCE: 0.06,
  CRIT_TIME: 30000,      // 30s per completarla

  // Task di coppia
  COOP_CHANCE: 0.25,           // probabilità che una task sia DOPPIA
  COOP_REQUEST_WINDOW: 60000,  // finestra «SVOLGI TASK · INVIA»
  COOP_PICK_WINDOW: 45000,     // finestra scelta compagno
  COOP_INVITE_TIME: 20000,     // finestra ACCETTA/RIFIUTA dell'invitato
  COOP_BRIDGE_TIME: 20000,     // durata ponte energetico
  COOP_BRIDGE_DRAIN: 3.2,      // drenaggio barra al secondo
  COOP_TAP: 7,                 // energia per martellata
  COOP_RUNES: 6,               // lunghezza sequenza codice incrociato
  COOP_VALVES: 4,              // numero valvole gemelle

  // Sussurri / séance
  WHISPER_ANNOUNCE_CD: 10000,  // anti-spam annuncio pubblico canale
  SEANCE_NEED: 4,              // rituali spettro per caricare la séance
  SEANCE_VOTE: 20000,          // tempo voto spiriti

  // Riunioni
  WORD_TIME: 40000, WORD_SHOW: 15000,
  VOTE_TIME: 40000, VOTE_REVEAL: 5000,
  MEET_CD: 120000,

  // Puttana
  PUTTANA_CD: 240000,
  PUTTANA_TRIGGER: 5,
  PUTTANA_TIMER: 30000,

  // ★ NEW — Rete / sopravvivenza
  CLIENT_PING: 5000,      // ogni 5s il client manda un "ping" all'host
  REAPER_TIMEOUT: 25000,  // senza ping/azioni per 25s → disconnesso

  // Heartbeat host
  HEARTBEAT: 2000
};

/* ═══ COLORE ACCENTO VIOLA (spettri / séance) ═══ */
const VIO = '#c26bff';

/* ═══ TIPI DI TASK DI COPPIA ═══ */
const COOP_TYPES = ['ponte', 'codice', 'valvole'];
const COOPNAMES = {
  ponte:   'PONTE ENERGETICO',
  codice:  'CODICE INCROCIATO',
  valvole: 'VALVOLE GEMELLE'
};
const COOPDESC = {
  ponte:   'Martellate insieme sulla barra: non deve svuotarsi!',
  codice:  'Ognuno vede metà rune: parlatevi e inserite la sequenza completa.',
  valvole: 'Fermate le lancette in zona: entrambi, per ogni valvola.'
};

/* ═══ ABILITÀ CASUALI DALLE TASK ═══ */
const ABS = {
  spalmatore: { n:'LO SPALMATORE PAZZO', ch:8, c:'#b87333',
    d:"UNA VOLTA: elimina un giocatore a scelta. Se era l'ASSASSINO vincete immediatamente. Se era un innocente… hai spalmato un amico, con tanto di jumpscare." },
  puttana: { n:'LA PUTTANA', ch:0, c:'#ff6ec7',
    d:"PROMOZIONE: resuscita un eliminato da ASSASSINO o SPALMATORE ogni 4 minuti. MAI sui votati." },
  sparlatore: { n:'LO SPARLATORE', ch:8, c:'#c26bff',
    d:"UNA VOLTA: svela PUBBLICAMENTE nel registro il ruolo di un giocatore." },
  gesu: { n:'CHE GESÙ STA CON TE', ch:8, c:'#ffd700',
    d:"PASSIVA: resusciti alla prima uccisione. ATTIVA: resusciti tu un ucciso da assassino/spalmatore." },
  merde: { n:'SONO TORNATO MERDE', ch:8, c:'#ff8c42',
    d:"PASSIVA: se espulso dai voti rientri. ATTIVA: resusciti un espulso dai voti." }
};
const AB_ORDER = ['spalmatore','sparlatore','gesu','merde'];

/* ═══ PAROLE SEGRETE ═══ */
const WORDS = ['FUOCO','OCEANO','SPECCHIO','FULMINE','DESERTO','FORESTA','GHIACCIO','VULCANO','COMETA','LABIRINTO','OROLOGIO','DIAMANTE','CORVO','SERPENTE','LANTERNA','BUSSOLA','TELEFONO','PIANOFORTE','FARO','MASCHERA','INVERNO','TEMPORALE','CASTELLO','RAGNO','VETRO','MONETA','SENTIERO','ECLISSI','DRAGO','FUMETTO','GIOSTRA','PIZZA','ANCORA','CACCIA','SEMAFORO','CASCATA','SCACCHI','LUNA','ARCOBALENO','VALIGIA'];

/* ═══ TASK SINGOLE (vivi) ═══ */
const TASKS = [
  { id:'circ',  name:'Cablaggio circuiti',    desc:'Collega ogni nodo al suo gemello dello stesso colore.' },
  { id:'gen',   name:'Accensione generatore', desc:'Tieni premuto finché la carica non raggiunga il 100%.' },
  { id:'card',  name:'Badge di accesso',      desc:'Trascina la scheda nello scanner alla giusta velocità.' },
  { id:'seq',   name:'Codice di sicurezza',   desc:'Memorizza e ripeti la sequenza luminosa.' },
  { id:'react', name:'Stabilizza reattore',   desc:'Colpisci le 5 scariche elettriche.' }
];

/* ═══ TASK SPETTRO (morti, per la séance) ═══ */
const GNAME = { circ:'TAVOLA OUIJA', gen:'CANDELE DEL RITO', card:'ANIME ERRANTI', seq:'RUNE DEL RITUALE', react:'SIGILLI SPEZZATI' };
const GDESC = {
  circ:  'Ferma la planchette 🔮 nella zona infestata 3 volte.',
  gen:   'Tieni accese TUTTE le candele: il vento le spegne.',
  card:  'Afferra 5 anime erranti prima che svaniscano.',
  seq:   'Memorizza e ripeti il rituale di rune.',
  react: 'Spezza i 4 sigilli: 3 colpi rapidi ciascuno.'
};
const GMAP = { circ:'ouija', gen:'candele', card:'anime', seq:'rune', react:'catene' };

/* ═══ RUOLI ═══ */
const ROLE = {
  assassino: { l:'ASSASSINO', c:'var(--red)' },
  detective: { l:'DETECTIVE', c:'var(--amber)' },
  innocente: { l:'INNOCENTE', c:'var(--cyan)' }
};

/* ═══ RUNE PER IL CODICE INCROCIATO ═══ */
const RUNE_CHARS = ['ᚠ','ᚱ','ᛗ','ᛟ','ᚹ','','ᚦ',''];
