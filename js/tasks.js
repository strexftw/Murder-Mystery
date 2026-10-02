/* ══════════════════════════════════════════════════════════════
   PROTOCOLLO OMBRA — js/tasks.js
   Tutti i minigiochi: task singole (GAMES), task spettro (GGAMES)
   e task di coppia (ponte / codice / valvole).
   Dipendenze: config.js, utils.js, audio.js, state.js.
   ══════════════════════════════════════════════════════════════ */

/* ═══ APRI UNA TASK (singola o spettro) ═══ */
function openTask(tid){
  if(!tid) return;
  const me = PUB && PUB.players.find(p => p.id === I.id);
  // Task DOPPA in attesa di essere inviata: il pulsante «SVOLGI TASK» della
  // card gestisce l'invio (coopRequest), non apre nessun minigioco singolo.
  if(me && me.alive && me.task && typeof me.task==='object' && me.task.type==='coop'){
    if(me.task.coopState==='needRequest' || me.task.coopState==='needInvite' || me.task.coopState==='inviting'){
      SFX.ok(); act({t:'coopRequest'});
      banner('🤝 Task doppia inviata: in attesa di un compagno…', 'grn', 3000);
      return;
    }
    openCoopGame();
    return;
  }
  const ghost = me && !me.alive;
  $('#task-title').textContent = ghost ? (GNAME[tid]||'RITUALE') : ((TASKS.find(t=>t.id===tid)||{}).name || 'TASK');
  $('#task-desc').textContent = ghost ? (GDESC[tid]||'') : ((TASKS.find(t=>t.id===tid)||{}).desc || '');
  $('#task-msg').textContent = '';
  $('#task-stage').innerHTML = '';
  show($('#m-task'));
  SFX.click();
  if(ghost) (GGAMES[GMAP[tid]] || GGAMES.ouija)($('#task-stage'), taskSuccess);
  else      (GAMES[tid] || GAMES.circ)($('#task-stage'), taskSuccess);
}

/* ═══ TASK COMPLETATA ═══ */
function taskSuccess(){
  $('#task-msg').textContent = '✓ COMPLETATA +1';
  SFX.ok();
  act({t:'taskDone'});
  setTimeout(()=>hide($('#m-task')), 800);
}

/* ══════════════════════════════════════════════════
   TASK SINGOLE (GAMES) — per i vivi
   ══════════════════════════════════════════════════ */
const GAMES = {
  /* Collega i nodi dello stesso colore */
  circ(st, done){
    const C = [['#38e1ff','A'],['#ffb648','B'],['#ff3b5c','C'],['#3dffa0','D']];
    st.innerHTML = '<div class="circ"><div class="ccol" id="cL"></div><svg id="cSvg"></svg><div class="ccol" id="cR"></div></div>';
    const L=$('#cL'), R=$('#cR'), svg=$('#cSvg');
    let sel=null, linked=0;
    function node(c, side){
      const b = document.createElement('button');
      b.className='cnode';
      b.style.borderColor = c[0];
      b.style.boxShadow = '0 0 10px '+c[0]+'55';
      b.dataset.c = c[1];
      b.onclick = ()=>{
        SFX.click();
        if(side==='L'){
          if(b.dataset.done) return;
          $$('#cL .cnode').forEach(x=>x.classList.remove('sel'));
          sel=b; b.classList.add('sel');
        } else {
          if(!sel || b.dataset.done) return;
          if(b.dataset.c===sel.dataset.c){
            b.dataset.done=1; sel.dataset.done=1; b.classList.add('done');
            line(sel,b,c[0]);
            sel.classList.remove('sel'); sel=null;
            linked++; SFX.ok();
            if(linked===4) setTimeout(done,400);
          } else {
            SFX.err(); b.classList.add('bad');
            setTimeout(()=>b.classList.remove('bad'),350);
          }
        }
      };
      return b;
    }
    C.forEach(c=>L.appendChild(node(c,'L')));
    shuffle(C).forEach(c=>R.appendChild(node(c,'R')));
    function line(a,b,col){
      const r=st.getBoundingClientRect(), ra=a.getBoundingClientRect(), rb=b.getBoundingClientRect();
      const l=document.createElementNS('http://www.w3.org/2000/svg','line');
      l.setAttribute('x1',ra.right-r.left); l.setAttribute('y1',ra.top+ra.height/2-r.top);
      l.setAttribute('x2',rb.left-r.left);  l.setAttribute('y2',rb.top+rb.height/2-r.top);
      l.setAttribute('stroke',col); l.setAttribute('stroke-width','3');
      svg.appendChild(l);
    }
  },

  /* Tieni premuto per caricare al 100% */
  gen(st, done){
    st.innerHTML = '<div class="genwrap"><div class="genbar"><i id="gfill" style="width:0%"></i></div>'+
      '<button class="btn big amb" id="gbtn">⚡ TIENI PREMUTO</button><div id="gpct" class="mono" style="margin-top:10px">0%</div></div>';
    let v=0, hold=false, last=performance.now(), fin=false;
    const b=$('#gbtn');
    b.addEventListener('pointerdown', e=>{ hold=true; b.setPointerCapture(e.pointerId); });
    ['pointerup','pointercancel'].forEach(ev=>b.addEventListener(ev, ()=>hold=false));
    function step(t){
      if(fin) return;
      if(!$('#m-task').classList.contains('on')){ fin=true; return; }
      const dt = Math.min(40, t-last); last=t;
      v += hold ? dt/26 : -dt/14;
      v = Math.max(0, Math.min(100, v));
      $('#gfill').style.width = v+'%';
      $('#gpct').textContent = Math.round(v)+'%';
      if(hold && Math.random()<.15) SFX.tick();
      if(v>=100){ fin=true; done(); return; }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  },

  /* Trascina la scheda nello scanner alla giusta velocità */
  card(st, done){
    st.innerHTML = '<div class="slotwrap"><div class="slotcard"><i class="sline sl"></i><i class="sline sr"></i>'+
      '<div id="thecard" class="card7">ID‑7X</div></div><div id="cardmsg" class="mono dim">Trascina la scheda da sinistra a destra</div></div>';
    const c=$('#thecard');
    let drag=false, sx=0, sl=0, t0=0, crossed=false, fin=false;
    const W=220;
    c.addEventListener('pointerdown', e=>{ drag=true; c.setPointerCapture(e.pointerId); sx=e.clientX; sl=parseFloat(c.style.left)||0; });
    c.addEventListener('pointermove', e=>{
      if(!drag || fin) return;
      const nl = Math.max(0, Math.min(W, sl + e.clientX - sx));
      c.style.left = nl+'px';
      if(!crossed && nl>=40){ crossed=true; t0=performance.now(); }
      if(crossed && nl>=W-10){
        drag=false; fin=true;
        const sp = (W-50)/Math.max(1, performance.now()-t0);
        if(sp>=0.15 && sp<=0.9){
          $('#cardmsg').textContent='✓ LETTURA VALIDA';
          $('#cardmsg').style.color='var(--grn)';
          SFX.ok();
          setTimeout(done,450);
        } else {
          fin=false; SFX.err();
          $('#cardmsg').textContent = sp>0.9 ? '✗ TROPPO VELOCE — RIPROVA' : '✗ TROPPO LENTA — RIPROVA';
          $('#cardmsg').style.color='var(--red)';
          reset();
        }
      }
    });
    ['pointerup','pointercancel'].forEach(ev=>c.addEventListener(ev, ()=>{
      if(drag && !fin){ drag=false; if(!crossed) reset(); else { crossed=false; reset(); } }
    }));
    function reset(){ crossed=false; c.style.left='0px'; }
  },

  /* Memorizza e ripeti la sequenza luminosa */
  seq(st, done){
    st.innerHTML = '<div class="simon">'+[0,1,2,3].map(i=>'<button class="pad p'+i+'" id="pad'+i+'"></button>').join('')+
      '</div><div id="seqmsg" class="mono dim" style="text-align:center">OSSERVA…</div>';
    const S = Array.from({length:5}, ()=>rnd(4));
    let idx=0, input=false, fin=false;
    function flash(i){
      const p=$('#pad'+i);
      p.classList.add('lit');
      tone(300+i*120,.18,'sine',.12);
      setTimeout(()=>p.classList.remove('lit'),380);
    }
    function play(){
      input=false;
      $('#seqmsg').textContent='OSSERVA…';
      S.forEach((v,i)=>setTimeout(()=>{ if(!fin) flash(v); }, 600*i+400));
      setTimeout(()=>{ if(fin) return; input=true; idx=0; $('#seqmsg').textContent='RIPETI LA SEQUENZA'; }, 600*S.length+500);
    }
    for(let i=0;i<4;i++) $('#pad'+i).onclick = ()=>{
      if(!input || fin) return;
      flash(i);
      if(i===S[idx]){
        idx++;
        if(idx===S.length){ fin=true; $('#seqmsg').textContent='✓ SEQUENZA CORRETTA'; setTimeout(done,500); }
      } else {
        input=false; SFX.err();
        $('#seqmsg').textContent='✗ ERRORE — RIPROVA';
        setTimeout(play,900);
      }
    };
    play();
  },

  /* Colpisci le 5 scariche elettriche */
  react(st, done){
    st.innerHTML = '<div class="arena" id="arena"></div><div id="rmsg" class="mono dim" style="text-align:center;margin-top:10px">Scariche neutralizzate: 0/5</div>';
    const a=$('#arena');
    let hit=0;
    function spark(){
      a.innerHTML='';
      const s=document.createElement('button');
      s.className='spark';
      s.style.left=(8+rnd(78))+'%';
      s.style.top=(10+rnd(70))+'%';
      a.appendChild(s);
      let life=2400;
      const iv=setInterval(()=>{
        if(!$('#m-task').classList.contains('on')){ clearInterval(iv); return; }
        life-=60;
        s.style.opacity=Math.max(.15, life/2400);
        if(life<=0){ clearInterval(iv); spark(); }
      },60);
      s.onclick=()=>{
        clearInterval(iv);
        hit++; SFX.ok();
        $('#rmsg').textContent='Scariche neutralizzate: '+hit+'/5';
        if(hit>=5){ a.innerHTML=''; $('#rmsg').textContent='✓ REATTORE STABILE'; setTimeout(done,450); }
        else spark();
      };
    }
    spark();
  }
};

/* ══════════════════════════════════════════════════
   TASK SPETTRO (GGAMES) — per i morti (séance)
   ══════════════════════════════════════════════════ */
const GGAMES = {
  /* Ferma la planchette nella zona infestata 3 volte */
  ouija(st, done){
    st.innerHTML = '<div class="g-ouija"><div class="oj-zone" id="oj-zone"></div><div class="oj-mark" id="oj-mark">🔮</div></div>'+
      '<div class="g-info" id="oj-info">Ferma la planchette nella zona infestata · 0/3</div>'+
      '<button class="btn big" id="oj-btn" style="width:100%">✋ FERMA</button>';
    let pos=0, dir=1, hits=0, zoneL=30, zoneW=22, fin=false, last=performance.now();
    function newZone(){
      zoneL = 8+rnd(66); zoneW = 16+rnd(12);
      const z=$('#oj-zone'); if(z){ z.style.left=zoneL+'%'; z.style.width=zoneW+'%'; }
    }
    newZone();
    function step(t){
      if(fin) return;
      if(!$('#m-task').classList.contains('on')){ fin=true; return; }
      const dt=Math.min(40,t-last); last=t;
      pos += dir*dt*0.06;
      if(pos>96){pos=96;dir=-1;}
      if(pos<0){pos=0;dir=1;}
      const mk=$('#oj-mark'); if(mk) mk.style.left=pos+'%';
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
    $('#oj-btn').onclick=()=>{
      if(fin) return;
      if(pos>=zoneL && pos<=zoneL+zoneW){
        hits++; SFX.ok();
        $('#oj-info').textContent='Ferma la planchette nella zona infestata · '+hits+'/3';
        if(hits>=3){ fin=true; $('#oj-info').textContent='Lo spirito è libero.'; setTimeout(done,500); }
        else newZone();
      } else SFX.err();
    };
  },

  /* Tieni accese tutte le candele */
  candele(st, done){
    st.innerHTML = '<div class="g-candles">'+[0,1,2,3,4].map(i=>'<button class="candle" id="cd'+i+'"><i></i><b>🕯</b></button>').join('')+'</div>'+
      '<div class="g-info" id="cd-info">Tieni accese tutte le candele · 0/5</div>';
    let lit=[false,false,false,false,false], fin=false, winT=null;
    function paint(){
      for(let i=0;i<5;i++){ const c=$('#cd'+i); if(c) c.classList.toggle('lit', lit[i]); }
      $('#cd-info').textContent = 'Tieni accese tutte le candele · '+lit.filter(v=>v).length+'/5';
    }
    function check(){
      if(lit.every(v=>v)){
        if(!winT) winT=setTimeout(()=>{ if(fin) return; fin=true; done(); },900);
      } else if(winT){ clearTimeout(winT); winT=null; }
    }
    for(let i=0;i<5;i++) $('#cd'+i).onclick=()=>{
      if(fin) return;
      lit[i]=true; SFX.tick(); paint(); check();
      setTimeout(()=>{ if(!fin){ lit[i]=false; paint(); check(); } }, 1500+rnd(1500));
    };
    paint();
  },

  /* Afferra 5 anime erranti */
  anime(st, done){
    st.innerHTML = '<div class="g-arena" id="g-arena"></div><div class="g-info" id="an-info">Anime afferrate: 0/5</div>';
    const a=$('#g-arena');
    let hit=0, fin=false;
    function soul(){
      if(fin) return;
      const s=document.createElement('button');
      s.className='soul';
      s.style.left=(8+rnd(78))+'%';
      s.style.top=(8+rnd(70))+'%';
      s.textContent='💀';
      a.appendChild(s);
      let life=4000;
      const iv=setInterval(()=>{
        if(!$('#g-arena') || !$('#g-arena').contains(s)){ clearInterval(iv); return; }
        life-=60;
        s.style.opacity=Math.max(.15, life/4000);
        s.style.left=(Math.max(4,Math.min(88,parseFloat(s.style.left)+(rnd(9)-4))))+'%';
        s.style.top=(Math.max(4,Math.min(80,parseFloat(s.style.top)+(rnd(9)-4))))+'%';
        if(life<=0){ clearInterval(iv); if(a.contains(s)) s.remove(); soul(); }
      },60);
      s.onclick=()=>{
        clearInterval(iv);
        if(a.contains(s)) s.remove();
        hit++; SFX.ok();
        $('#an-info').textContent='Anime afferrate: '+hit+'/5';
        if(hit>=5){ fin=true; $('#an-info').textContent='Le anime trovano pace.'; setTimeout(done,450); }
        else soul();
      };
    }
    soul(); soul();
  },

  /* Memorizza e ripeti il rituale di rune */
  rune(st, done){
    st.innerHTML = '<div class="g-runes">'+RUNE_CHARS.slice(0,4).map((r,i)=>'<button class="rune" id="rn'+i+'">'+r+'</button>').join('')+'</div>'+
      '<div class="g-info" id="rn-info" style="text-align:center">OSSERVA IL RITUALE…</div>';
    const S=Array.from({length:5},()=>rnd(4));
    let idx=0, input=false, fin=false;
    function flash(i){
      const p=$('#rn'+i); if(!p) return;
      p.classList.add('lit');
      tone(150+i*60,.25,'triangle',.14);
      setTimeout(()=>p.classList.remove('lit'),380);
    }
    function play(){
      input=false;
      $('#rn-info').textContent='OSSERVA IL RITUALE…';
      S.forEach((v,i)=>setTimeout(()=>{ if(!fin) flash(v); },600*i+400));
      setTimeout(()=>{ if(fin) return; input=true; idx=0; $('#rn-info').textContent='RIPETI IL RITUALE'; },600*S.length+500);
    }
    for(let i=0;i<4;i++) $('#rn'+i).onclick=()=>{
      if(!input || fin) return;
      flash(i);
      if(i===S[idx]){
        idx++;
        if(idx===S.length){ fin=true; $('#rn-info').textContent='Il rituale è compiuto.'; setTimeout(done,500); }
      } else {
        input=false; SFX.err();
        $('#rn-info').textContent='GLI SPIRITI RIDONO… RIPROVA';
        setTimeout(play,900);
      }
    };
    play();
  },

  /* Spezza i 4 sigilli: 3 colpi rapidi ciascuno */
  catene(st, done){
    st.innerHTML = '<div class="g-seals" style="grid-template-columns:repeat(4,1fr)">'+[0,1,2,3].map(i=>
      '<button class="seal" id="se'+i+'"><b>⛓</b><span class="sc" id="sc'+i+'">0/3</span></button>').join('')+'</div>'+
      '<div class="g-info" style="text-align:center">Spezza i 4 sigilli: 3 colpi rapidi ciascuno</div>';
    let broken=0, fin=false;
    const prog=[0,0,0,0];
    for(let i=0;i<4;i++){
      let resetT=null;
      $('#se'+i).onclick=()=>{
        if(fin) return;
        prog[i]++;
        SFX.tick();
        $('#sc'+i).textContent=Math.min(3,prog[i])+'/3';
        if(resetT) clearTimeout(resetT);
        if(prog[i]>=3){
          $('#se'+i).classList.add('done');
          broken++; SFX.ok();
          if(broken>=4){ fin=true; setTimeout(done,450); }
        } else {
          resetT=setTimeout(()=>{ prog[i]=0; const sc=$('#sc'+i); if(sc) sc.textContent='0/3'; },1000);
        }
      };
    }
  }
};

/* ══════════════════════════════════════════════════
   TASK DI COPPIA (ponte / codice / valvole)
   Lo stato della sessione è in PUB.coop[sessionId].
   ══════════════════════════════════════════════════ */
function openCoopGame(){
  if(!myCoopState) return;
  const sessId = myCoopState.session;
  const type = myCoopState.type;
  $('#ab-body').innerHTML = '';
  show($('#m-ab'));
  SFX.coop();
  if(type==='ponte')   coopPonte(sessId);
  else if(type==='codice') coopCodice(sessId);
  else if(type==='valvole') coopValvole(sessId);
}

/* ── PONTE ENERGETICO: martellate insieme sulla barra ── */
function coopPonte(sessId){
  const B=$('#ab-body');
  B.innerHTML = '<h2 class="mt" style="color:var(--grn)">⚡ PONTE ENERGETICO</h2>'+
    '<p class="sub">Martellate insieme: la barra non deve svuotarsi!</p>'+
    '<div class="coopbar"><i id="cp-bar" style="width:60%"></i><div class="lbl" id="cp-pct">60%</div></div>'+
    '<button class="btn big grn" id="cp-tap" style="width:100%;min-height:90px;font-size:1.1rem">🔨 MARTELLA!</button>'+
    '<button class="btn ghost" id="cp-close" style="margin-top:12px;width:100%">CHIUDI</button>';
  $('#cp-tap').onclick=()=>{ SFX.tick(); act({t:'coopTap'}); };
  $('#cp-close').onclick=()=>hide($('#m-ab'));
  // Aggiorna la barra leggendo lo stato broadcastato
  const iv=setInterval(()=>{
    if(!PUB || !PUB.coop || !PUB.coop[sessId] || !$('#m-ab').classList.contains('on')){ clearInterval(iv); return; }
    const s=PUB.coop[sessId];
    const bar=$('#cp-bar'), pct=$('#cp-pct');
    if(bar) bar.style.width=Math.max(0,Math.min(100,s.energy))+'%';
    if(pct) pct.textContent=Math.round(Math.max(0,Math.min(100,s.energy)))+'%';
    if(s.done){ clearInterval(iv); hide($('#m-ab')); }
  },200);
}

/* ── CODICE INCROCIATO: ognuno vede metà rune ── */
function coopCodice(sessId){
  const B=$('#ab-body');
  const s=(PUB && PUB.coop && PUB.coop[sessId]) ? PUB.coop[sessId] : null;
  if(!s){ hide($('#m-ab')); return; }
  const isA=(I.id===s.a);
  const runes=s.runes||[];
  // Mostra metà rune (la tua metà), nascondi l'altra metà
  let cells='';
  for(let i=0;i<runes.length;i++){
    const mine = isA ? (i%2===0) : (i%2===1);
    cells += '<div class="rune-cell'+(mine?'':' hidden-r')+'">'+(mine?runes[i]:'?')+'</div>';
  }
  B.innerHTML = '<h2 class="mt" style="color:var(--grn)">🔮 CODICE INCROCIATO</h2>'+
    '<p class="sub">Vedi solo metà delle rune. Parla col compagno (sussurri!) e inserite entrambi la sequenza completa.</p>'+
    '<div class="runesrow">'+cells+'</div>'+
    '<input class="inp" id="cp-seq" placeholder="Inserisci la sequenza completa…" autocomplete="off" style="text-align:center">'+
    '<button class="btn grn" id="cp-sub" style="width:100%;margin-top:12px">✓ INVIA SEQUENZA</button>'+
    '<button class="btn ghost" id="cp-close" style="margin-top:12px;width:100%">CHIUDI</button>';
  $('#cp-sub').onclick=()=>{
    const seq=$('#cp-seq').value.trim();
    if(!seq) return;
    SFX.click();
    act({t:'coopRunes', seq:seq});
  };
  $('#cp-close').onclick=()=>hide($('#m-ab'));
  // Chiudi quando la sessione è completata
  const iv=setInterval(()=>{
    if(!PUB || !PUB.coop || !PUB.coop[sessId] || !$('#m-ab').classList.contains('on')){ clearInterval(iv); return; }
    const s2=PUB.coop[sessId];
    if(s2.done){ clearInterval(iv); hide($('#m-ab')); }
  },300);
}

/* ── VALVOLE GEMELLE: ferma le lancette in zona ── */
function coopValvole(sessId){
  const B=$('#ab-body');
  const s=(PUB && PUB.coop && PUB.coop[sessId]) ? PUB.coop[sessId] : null;
  if(!s){ hide($('#m-ab')); return; }
  const isA=(I.id===s.a);
  const valves=s.valves||[];
  // Costruisci le valvole
  let html='<h2 class="mt" style="color:var(--grn)">🔧 VALVOLE GEMELLE</h2>'+
    '<p class="sub">Ferma ogni lancetta nella zona verde. Entrambi i giocatori devono fermarla.</p>'+
    '<div class="valves">';
  for(let i=0;i<valves.length;i++){
    const v=valves[i];
    const stopped = isA ? v.aStopped : v.bStopped;
    html += '<div class="valve'+(v.done?' done':'')+'" id="vl'+i+'">'+
      '<div class="needle-wrap">'+
        '<div class="zone" style="bottom:'+v.zone+'%;height:'+v.zoneH+'%"></div>'+
        '<div class="needle" id="nd'+i+'" style="bottom:50%"></div>'+
      '</div>'+
      '<button id="vb'+i+'"'+(v.done?' disabled':'')+'>'+(v.done?'✓ FATTO':(stopped?'✓ TU ✓':'FERMA'))+'</button></div>';
  }
  html += '</div><button class="btn ghost" id="cp-close" style="margin-top:12px;width:100%">CHIUDI</button>';
  B.innerHTML=html;
  $('#cp-close').onclick=()=>hide($('#m-ab'));

  // Animazione delle lancette (lato client, oscillano)
  const startT=performance.now();
  function anim(){
    if(!$('#m-ab').classList.contains('on')) return;
    const elapsed=(performance.now()-startT)/1000;
    for(let i=0;i<valves.length;i++){
      const nd=$('#nd'+i);
      if(!nd) continue;
      // Oscillazione: posizione tra 5 e 95
      const pos=50+45*Math.sin(elapsed*(1.2+i*0.3));
      nd.style.bottom=pos+'%';
      nd.dataset.pos=pos;
    }
    requestAnimationFrame(anim);
  }
  requestAnimationFrame(anim);

  // Pulsanti FERMA
  for(let i=0;i<valves.length;i++){
    const btn=$('#vb'+i);
    if(btn) btn.onclick=()=>{
      const nd=$('#nd'+i);
      const pos=nd?parseFloat(nd.dataset.pos||50):50;
      SFX.tick();
      act({t:'coopValve', vidx:i, pos:pos});
    };
  }
  // Aggiorna lo stato delle valvole dal broadcast
  const iv=setInterval(()=>{
    if(!PUB || !PUB.coop || !PUB.coop[sessId] || !$('#m-ab').classList.contains('on')){ clearInterval(iv); return; }
    const s2=PUB.coop[sessId];
    for(let i=0;i<(s2.valves||[]).length;i++){
      const v=s2.valves[i];
      const btn=$('#vb'+i);
      if(btn){
        const stopped=isA?v.aStopped:v.bStopped;
        btn.textContent=v.done?'✓ FATTO':(stopped?'✓ TU ✓':'FERMA');
        btn.disabled=v.done||stopped;
      }
    }
    if(s2.done){ clearInterval(iv); hide($('#m-ab')); }
  },300);
}