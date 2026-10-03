/* =========================================================
   CONFIG.JS — collegamento a Supabase
   Dashboard Supabase → Settings → API → copia
   "Project URL" e "anon public key" (MAI la service_role).
   ========================================================= */
const SUPABASE_URL      = "https://xbzibdalrbknoagbfmak.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiemliZGFscmJrbm9hZ2JmbWFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwMTEyOTUsImV4cCI6MjEwNjU4NzI5NX0.1jtXOyaoOU5JTm3prVC2wwgwoTIOMcOY0nmC2ihEF50";

/* ---------- parametri heartbeat lobby ---------- */
const HEARTBEAT_MS     = 500;  // lista lobby aggiornata ogni 0.5s
const PRESENCE_EVERY   = 4;    // il mio "battito" parte ogni 4 beat (~2s)
const OFFLINE_AFTER_MS = 5000; // senza battito da 5s → disconnesso
const MAX_NAME_LENGTH  = 20;

/* client Supabase (nome globale: db) */
let db = null;

if (typeof window.supabase === "undefined") {
  // la CDN https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2 non è caricata
  console.error("[CONFIG] Libreria Supabase non caricata: controlla lo script CDN nell'HTML o la connessione.");
} else {
  try {
    // @ts-ignore (l'editor non conosce il globale "supabase": non è un errore reale)
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (e) {
    console.error("[CONFIG] Impossibile creare il client Supabase:", e);
  }
}