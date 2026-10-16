// =========================================================
// CONFIG.JS v2.2 - credenziali Supabase + costanti globali.
// Dashboard Supabase -> Settings -> API -> "Project URL" e
// "anon public key" (MAI la service_role).
// ATTENZIONE: ogni costante e' dichiarata UNA SOLA volta.
// =========================================================

// ---------- credenziali Supabase ----------
const SUPABASE_URL      = "https://amrutsqjzlkjllodqjjj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtcnV0c3Fqemxramxsb2RxampqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNTI3MTIsImV4cCI6MjEwNzYyODcxMn0.MLfLTQ_ENcmJYnVxdjyO0hEmacGe3lmXUrikzKiYvoM";

// ---------- heartbeat e presenza ----------
// HEARTBEAT_MS = 500ms (0.5s) - tick client per lobby/partita
// PRESENCE_EVERY deve essere >= 3 perche' il codice controlla
// sia beatN % PRESENCE_EVERY === 1 (presenza) sia === 2 (stato
// stanza); con 2 il resto === 2 non si verifica MAI e lo stato
// della stanza non viene mai aggiornato.
const HEARTBEAT_MS     = 500;
const PRESENCE_EVERY   = 4;
const OFFLINE_AFTER_MS = 5000;
const MAX_NAME_LENGTH  = 20;

// ---------- intro video ----------
// nome ESATTO del file nel bucket Storage 'video' (con estensione)
const INTRO_FILE = 'intro.mp4';

// ---------- client Supabase (globale: db) ----------
let db = null;

if (typeof window.supabase === "undefined") {
  console.error("[CONFIG] Libreria Supabase non caricata: controlla lo script CDN nell'HTML o la connessione.");
} else {
  try {
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (e) {
    console.error("[CONFIG] Impossibile creare il client Supabase:", e);
  }
}