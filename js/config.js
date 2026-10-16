// =========================================================
// CONFIG.JS v2.5 - credenziali Supabase + costanti globali.
// SOSTITUISCI TUTTO IL FILE: non aggiungere blocchi in fondo,
// le costanti duplicate fanno morire lo script (SyntaxError).
// =========================================================
console.log('[CONFIG] config.js v2.5 in caricamento');

// ---------- credenziali Supabase ----------
const SUPABASE_URL      = "https://amrutsqjzlkjllodqjjj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtcnV0c3Fqemxramxsb2RxampqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNTI3MTIsImV4cCI6MjEwNzYyODcxMn0.MLfLTQ_ENcmJYnVxdjyO0hEmacGe3lmXUrikzKiYvoM";

// ---------- heartbeat e presenza ----------
const HEARTBEAT_MS     = 500;
const PRESENCE_EVERY   = 4;
const OFFLINE_AFTER_MS = 5000;
const MAX_NAME_LENGTH  = 20;

// ---------- intro video ----------
const INTRO_FILE = 'intro.mp4';

// ---------- ritmo di caccia (CENTRALIZZATO) ----------
const CONFIG_KILL_MS = 18000;        // secondi tra le vittime
const CONFIG_FIRST_KILL_MS = 20000;  // attesa prima vittima

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