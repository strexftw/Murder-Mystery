// PERSONAGGI.JS v1 - carte identita + indizio unico (solo ASCII).
const PG_NOMI = ['Bruno','Ada','Carlo','Delia','Ettore','Flavia','Gino','Ida','Livio','Marta','Nello','Olga'];
const PG_COGNOMI = ['Valli','Bruni','Colli','Riva','Monti','Sarti','Falco','Greco','Longhi','Mari','Neri','Poli'];
const PG_LUOGHI = ['Trieste','Mantova','Vercelli','Termoli','Spoleto','Aosta','Matera','Ravenna','Trapani','Udine','Fermo','Rieti'];
const PG_LAVORI = ['Orologiaio','Sarta','Farmacista','Campanaro','Archivista','Ciabattino','Calligrafo','Oste','Daziere','Impagliatore','Lavandaia','Notaio'];
const PG_HOBBY = ['scacchi','uncinetto','collezionare chiavi','pittura di miniature','canto corale','filatelia','tiro con l\'arco','intaglio del legno','scrittura in corsivo','osservare uccelli','riparare serrature','collezionare mappe'];
const PG_EXTRA = ['porta un guanto solo','non beve caffe','colleziona biglietti del tram','parla al proprio gatto','firma con le iniziali','teme le scale a chiocciola','non possiede specchi','conta sempre i gradini','odia le porte socchiuse','tiene un diario cifrato','non ricorda i compleanni','saluta sempre due volte'];
const PG_ALTEZZE = ['154 cm','160 cm','165 cm','169 cm','172 cm','175 cm','178 cm','181 cm','184 cm','187 cm','190 cm','192 cm'];

function pgShuffle(arr){
  const a = arr.slice();
  const r = new Uint32Array(a.length);
  crypto.getRandomValues(r);
  for(let i = a.length - 1; i > 0; i--){
    const j = r[i] % (i + 1);
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function pgCodiceFiscale(nome, cognome, anno){
  const pad = function(s, n){ return (s + 'XXXXXXX').slice(0, n); };
  const yy = String(anno).slice(2);
  const gg = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
  return (pad(cognome, 3) + pad(nome, 3) + yy + 'M' + gg + 'L2' + pad(nome, 1) + 'X').toUpperCase();
}

// genera n carte con valori UNICI per ogni campo indagabile
function generaCarte(n){
  const nomi = pgShuffle(PG_NOMI), cogn = pgShuffle(PG_COGNOMI);
  const luoghi = pgShuffle(PG_LUOGHI), lavori = pgShuffle(PG_LAVORI);
  const hobby = pgShuffle(PG_HOBBY), extra = pgShuffle(PG_EXTRA);
  const altezze = pgShuffle(PG_ALTEZZE);
  const anni = pgShuffle([1950,1953,1957,1961,1964,1968,1970,1973,1977,1981,1986,1991]);
  const carte = [];
  for(let i = 0; i < n; i++){
    const card = {
      nome: nomi[i] + ' ' + cogn[i],
      nascita: String(anni[i]),
      luogo: luoghi[i],
      lavoro: lavori[i],
      hobby: hobby[i],
      extra: extra[i],
      altezza: altezze[i],
      cf: ''
    };
    card.cf = pgCodiceFiscale(nomi[i], cogn[i], anni[i]);
    carte.push(card);
  }
  return carte;
}

// indizio preso dalla carta dell'assassino (valore unico per costruzione)
function scegliIndizio(carte, iAssassino){
  const campi = ['nascita','luogo','lavoro','hobby','altezza'];
  const r = new Uint32Array(1);
  crypto.getRandomValues(r);
  const campo = campi[r[0] % campi.length];
  const v = carte[iAssassino][campo];
  const frasi = {
    nascita: 'e nato nel ' + v,
    luogo:   'e nato a ' + v,
    lavoro:  'lavora come ' + v.toLowerCase(),
    hobby:   'nel tempo libero: ' + v,
    altezza: 'e alto ' + v
  };
  return { campo: campo, valore: v, testo: frasi[campo] };
}