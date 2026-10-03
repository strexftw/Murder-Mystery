/* =========================================================
   WORDS.JS — lista delle parole segrete della partita
   Solo lettere ASCII (niente accenti): l'offuscamento
   lavora carattere per carattere.
   Il capo stanza ne pesca una a caso all'avvio; la parola
   è nota a detective e innocenti, MAI all'assassino.
   ========================================================= */
const SECRET_WORDS = [
  'Vicolo','Veleno','Maschera','Bisca','Ombra','Pugnale','Lanterna','Molo',
  'Taverna','Cappello','Guanto','Sigaro','Balcone','Pozzo','Cripta','Faro',
  'Carrozza','Biglietto','Chiave','Lucchetto','Specchio','Sipario','Violino','Orologio',
  'Medaglione','Cicuta','Revolver','Dossier','Alibi','Testimone','Refurtiva','Taglia',
  'Riscatto','Delitto','Indizio','Impronta','Fune','Candela','Maniero','Locanda',
  'Fosso','Pontile','Serratura','Grimaldello','Passamontagna','Borsello','Contrabbando','Soffitta',
  'Cantina','Campanile','Cimitero','Nebbia','Pioggia','Mezzanotte','Sospetto','Movente',
  'Verdetto','Sentenza','Complotto','Tradimento','Ricatto','Fiala','Antidoto','Velo',
  'Travestimento','Ghigliottina','Carbonella','Polvere'
];

/* pesca una parola a caso (casualità crittografica) */
function pickSecretWord(){
  const r = new Uint32Array(1);
  crypto.getRandomValues(r);
  return SECRET_WORDS[r[0] % SECRET_WORDS.length];
}
