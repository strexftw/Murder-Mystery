// =========================================================
// CONFIG.JS v2.3 - credenziali Supabase + costanti globali.
// =========================================================

// log di controllo: se NON vedi questa riga in console, il file
// non e' stato caricato (cache vecchia o SyntaxError).
console.log('[CONFIG] config.js v2.3 in caricamento');

// ---------- credenziali Supabase ----------
const SUPABASE_URL      = "https://amrutsqjzlkjllodqjjj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtcnV0c3Fqemxramxsb2RxampqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNTI3MTIsImV4cCI6MjEwNzYyODcxMn0.MLfLTQ_ENcmJYnVxdjyO0hEmacGe3lmXUrikzKiYvoM";

// ---------- heartbeat e presenza ----------
// PRESENCE_EVERY deve essere >= 3: il codice controlla sia
// beatN % PRESENCE_EVERY === 1 (presenza) sia === 2 (stato stanza);
// con 2 il resto === 2 non si verifica MAI.
const HEARTBEAT_MS     = 500;
const PRESENCE_EVERY   = 4;
const OFFLINE_AFTER_MS = 5000;
const MAX_NAME_LENGTH  = 20;

// ---------- intro video ----------
const INTRO_FILE = 'intro.mp4';

// ---------- client Supabase (globale: db) ----------
let db = null;

if (typeof window.supabase === "undefined") {
  console.error("[CONFIG] Libreria Supabase non caricata: controlla lo script CDN nell'HTML o la connessione.");
} else {
  try {
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('[CONFIG] client Supabase creato OK');
  } catch (e) {
    console.error("[CONFIG] Impossibile creare il client Supabase:", e);
  }
}