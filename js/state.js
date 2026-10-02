/* ══════════════════════════════════════════════════════════════
   PROTOCOLLO OMBRA — js/state.js
   Stato globale del gioco (variabili condivise tra tutti i file).
   Dipendenze: config.js, utils.js (uid).
   ══════════════════════════════════════════════════════════════ */

/* ═══ IDENTITÀ DEL CLIENT LOCALE ═══ */
const I = { id: uid(), name: '' };

/* ═══ CONNESSIONE SUPABASE ═══ */
let SB = null;          // client Supabase
let chan = null;        // canale realtime della stanza
let ROOM = '';          // codice stanza corrente
let isHost = false;     // questo client è l'host?

/* ═══ STATO DI GIOCO ═══
   G   → stato autorevole (solo sull'host)
   PUB → ultimo stato pubblico ricevuto (tutti i client)
   SEC → informazioni private/segrete del giocatore locale
   SYNC→ stato privato sincronizzato (abilità, cooldown, ecc.)   */
let G = null;
let PUB = null;
let SEC = {};
let SYNC = {};

/* ═══ SINCRONIZZAZIONE OROLOGIO ═══ */
let clockOff = 0;   // differenza tra orologio host e locale

/* ═══ FLAG DI STATO UI / GIOCO ═══ */
let curScr = '';          // schermata attualmente visibile
let sentW = 0;            // timestamp ultima parola inviata (anti-doppio invio)
let sentV = 0;            // timestamp ultimo voto inviato (anti-doppio invio)
let seenBanner = 0;       // ultimo banner già mostrato (anti-doppio)
let seenReveal = 0;       // ultima rivelazione già mostrata (anti-doppio)
let meetKey = '';         // chiave per ricostruire la riunione solo quando cambia
let lastTaskKey = '';     // chiave per ricostruire la task card solo quando cambia
let endPlayed = false;    // il suono di fine partita è già stato riprodotto?
let lastDockKey = '';     // chiave per ricostruire il dock solo quando cambia
let myAlivePrev = true;   // ero vivo al frame precedente? (per chiudere i modali alla morte)
let myQPrev = false;      // ero in quarantena al frame precedente?
let sentSeanceVote = 0;   // timestamp ultimo voto séance (anti-doppio invio)

/* ═══ ARCHIVIO SCANSIONI DEL DETECTIVE (locale) ═══ */
let SCANLIST = [];    // lista scansioni effettuate
let SCANCLUES = [];   // indizi hacker (cifre del codice assassino)

/* ═══ SUSSURRI PRIVATI (chat p2p locale) ═══ */
let CHATS = {};        // { partnerId: {name, msgs:[], unread} }
let activeChat = null; // id del partner con cui è aperta la chat

/* ═══ TASK DI COPPIA (stato locale del client) ═══ */
let myCoopState = null;   // stato della coop in corso lato client

/* ═══ ★ NEW — REAPER DISCONNESSIONI (lato host) ═══
   Ultima attività vista per ogni giocatore (azioni o ping).
   Se un giocatore vivo non dà segnali da CFG.REAPER_TIMEOUT ms,
   l'host lo elimina come disconnesso (disconnectKill).          */
let LASTSEEN = {};

/* ═══ ★ NEW — RETRY CONFERME (rules / reveal, lato client) ═══
   Se il click «HO LETTO E HO CAPITO» / «SCHIERATI» si perde sul
   canale, il client lo rimanda ogni 2s finché non vede la propria
   conferma in PUB. Evita il bug «solo l'host riesce a confermare». */
let rulesClicked = false,  rulesRetryAt = 0;
let revealClicked = false, revealRetryAt = 0;

/* ═══ TIMESTAMP DI INGRESSO ═══ */
const joinAt = Date.now();
