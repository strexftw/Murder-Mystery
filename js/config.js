// =========================================================
// CONFIG.JS v2.4 - credenziali Supabase + costanti globali.
// Dashboard Supabase -> Settings -> API -> "Project URL" e
// "anon public key" (MAI la service_role).
// ATTENZIONE: ogni costante e' dichiarata UNA SOLA volta.
// =========================================================
console.log('[CONFIG] config.js v2.4 in caricamento');

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
// nome ESATTO del file nel bucket Storage 'video' (con estensione)
const INTRO_FILE = 'intro.mp4';

// ---------- ritmo di caccia (CENTRALIZZATO) ----------
// Seconds tra un'uccisione e l'altra (dopo Chiudi / No / sblocco).
// Durante l'indagine il timer e' BLOCCATO, quindi questo valore
// regola solo ritmo e pressione, non il tempo di pensiero.
const CONFIG_KILL_MS = 18000;        // 18s tra le vittime
// Attesa della PRIMA vittima dall'inizio della fase live.
const CONFIG_FIRST_KILL_MS = 20000;  // 20s avvio morbido

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
}