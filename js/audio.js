/* ══════════════════════════════════════════════════════════════
   PROTOCOLLO OMBRA — js/audio.js
   Motore audio (Web Audio API) + effetti sonori SFX + ambience.
   ══════════════════════════════════════════════════════════════ */

let AC = null, MUTE = false, AMB = null;

function audio(){
  if(!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
  if(AC.state === 'suspended') AC.resume();
  return AC;
}

function tone(f, d, type = 'sine', g = .15, slide = 0, delay = 0){
  if(MUTE) return;
  try{
    const a = audio(), t = a.currentTime + delay;
    const o = a.createOscillator(), v = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + d);
    v.gain.setValueAtTime(0, t);
    v.gain.linearRampToValueAtTime(g, t + .012);
    v.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(v).connect(a.destination);
    o.start(t);
    o.stop(t + d + .05);
  }catch(e){}
}

function noise(d = .3, g = .25, fc = 1000, delay = 0){
  if(MUTE) return;
  try{
    const a = audio(), t = a.currentTime + delay;
    const b = a.createBuffer(1, a.sampleRate * d, a.sampleRate);
    const ch = b.getChannelData(0);
    for(let i = 0; i < ch.length; i++) ch[i] = (Math.random()*2 - 1) * (1 - i/ch.length);
    const s = a.createBufferSource(); s.buffer = b;
    const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = fc;
    const v = a.createGain(); v.gain.value = g;
    s.connect(f); f.connect(v); v.connect(a.destination);
    s.start(t);
  }catch(e){}
}

const SFX = {
  click(){ tone(700,.06,'square',.05); },
  ok(){ tone(660,.09,'sine',.12); tone(990,.14,'sine',.12,0,.09); },
  err(){ tone(220,.18,'sawtooth',.12,-80); },
  tick(){ tone(1200,.03,'square',.04); },
  msg(){ tone(980,.05,'sine',.07); tone(1320,.07,'sine',.06,0,.05); },
  alarm(){ tone(880,.16,'square',.1); tone(660,.16,'square',.1,0,.18); },
  meet(){ tone(520,.12,'square',.14); tone(780,.12,'square',.14,0,.14); tone(1040,.2,'square',.14,0,.28); },
  scan(){ for(let i=0;i<6;i++) tone(400 + i*180, .08, 'sine', .07, 0, i*.12); },   /* ★ FIX: i*180 */
  reveal(){ tone(300,.4,'sawtooth',.12,300); tone(600,.5,'sine',.1,200,.1); },
  jump(){ noise(.7,.5,900); tone(70,.9,'sawtooth',.4,-30); tone(1400,.3,'square',.15,-900); },
  hack(){ noise(.5,.4,2600); tone(1400,.5,'square',.18,-1200); tone(180,.7,'sawtooth',.22,60); tone(90,.9,'square',.18,-40,.1); },
  found(){ [660,784,988,1318].forEach((f,i)=>tone(f,.18,'triangle',.14,0,i*.09)); tone(1568,.4,'sine',.1,0,.36); noise(.3,.12,6000,.1); },
  seance(){ tone(220,.6,'sine',.12,80); tone(330,.6,'sine',.1,60,.2); tone(110,.9,'triangle',.14,-20,.4); },
  coop(){ tone(520,.1,'square',.1); tone(660,.1,'square',.1,0,.08); tone(880,.14,'square',.1,0,.16); },
  crit(){ tone(1000,.15,'square',.14); tone(800,.15,'square',.14,0,.16); },
  win(){ [523,659,784,1046].forEach((f,i)=>tone(f,.22,'triangle',.14,0,i*.14)); },
  lose(){ [400,340,280,190].forEach((f,i)=>tone(f,.3,'sawtooth',.12,0,i*.18)); }
};

function ambience(){
  if(MUTE || AMB || !AC) return;
  const a = AC;
  const o  = a.createOscillator();
  const o2 = a.createOscillator();
  const g  = a.createGain();
  const f  = a.createBiquadFilter();
  o.type = 'sawtooth';  o.frequency.value = 48;
  o2.type = 'sawtooth'; o2.frequency.value = 48.6;
  f.type = 'lowpass';   f.frequency.value = 150;
  g.gain.value = .03;
  o.connect(f); o2.connect(f); f.connect(g); g.connect(a.destination);
  o.start(); o2.start();
  AMB = g;
}

document.addEventListener('pointerdown', () => { audio(); ambience(); }, {passive:true});