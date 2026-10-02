/* ══════════════════════════════════════════════════════════════
   PROTOCOLLO OMBRA — js/state.js
   Stato globale del gioco (variabili condivise tra tutti i file).
   ══════════════════════════════════════════════════════════════ */

const I = { id: uid(), name: '' };

let SB = null;
let chan = null;
let ROOM = '';
let isHost = false;

let G = null;
let PUB = null;
let SEC = {};
let SYNC = {};

let clockOff = 0;

let curScr = '';
let sentW = 0;
let sentV = 0;
let seenBanner = 0;
let seenReveal = 0;
let meetKey = '';
let lastTaskKey = '';
let endPlayed = false;
let lastDockKey = '';
let myAlivePrev = true;
let myQPrev = false;
let sentSeanceVote = 0;

let SCANLIST = [];
let SCANCLUES = [];

let CHATS = {};
let activeChat = null;

let myCoopState = null;

/* ★ NEW: ultima attività vista per giocatore (reaper disconnessioni) */
let LASTSEEN = {};

const joinAt = Date.now();