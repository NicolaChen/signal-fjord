import { Flight } from './flight.js';
import { sorties } from './world.js';
import { unit, cross } from './geometry.js';
import { FjordRenderer } from './renderer.js';
import { ChaseCamera } from './camera.js';
import { PilotInput } from './input.js';
import { byId, InstrumentPanel } from './instruments.js';
import { CockpitSound } from './sound.js';

const game=byId('game'), canvas=byId('scene'), menu=byId('sortie-menu');
const briefing=byId('briefing'),hud=byId('hud'),debrief=byId('debrief'),pauseCard=byId('pause');
const sound=new CockpitSound(), panel=new InstrumentPanel();
let mode='brief', chosen=0, flight=new Flight(sorties[0]), camera=new ChaseCamera();
let seenToast=null, renderer, input, tick=0, previous=0, debt=0, recorded=-1;

function syncMode(next){
  mode=next;recorded=-1;
  game.dataset.mode=mode;
  game.classList.toggle('playing',mode!=='brief');
  briefing.hidden=mode!=='brief';
  byId('aircraft-plate').hidden=briefing.hidden;
  hud.hidden=mode==='brief';
  debrief.hidden=mode!=='done';
  pauseCard.hidden=mode!=='pause';
  input.active=mode==='flight';
  input.clear();
}
function choose(i){
  chosen=i;
  [...menu.children].forEach((el,j)=>el.setAttribute('aria-pressed',String(i===j)));
  byId('launch').title=sorties[i].brief;
  byId('launch').setAttribute('aria-label','Fly '+sorties[i].title+'. '+sorties[i].brief);
  byId('dispatch-order').textContent=sorties[i].brief;
  flight=new Flight(sorties[chosen]);
}
function launch(){
  flight=new Flight(sorties[chosen]);camera=new ChaseCamera();seenToast=null;debt=0;
  byId('launch').blur();byId('again').blur();
  syncMode('flight');sound.wake();sound.signal('info');
}
function home(){
  choose(chosen);syncMode('brief');
  menu.children[chosen].focus();
}
function hold(){
  if(mode==='flight') syncMode('pause');
  else if(mode==='pause') {byId('resume').blur();syncMode('flight');sound.wake();}
}
function toggleSound(){
  sound.muted=!sound.muted;
  if(!sound.muted) sound.wake();
  byId('sound').textContent=sound.muted?'Sound off':'Sound on';
  byId('sound').setAttribute('aria-pressed',String(!sound.muted));
  byId('sound').blur();
}
function setInvert(){
  input.invert=!input.invert;
  byId('invert').textContent='Invert pitch: '+(input.invert?'on':'off');
  byId('invert').setAttribute('aria-pressed',String(input.invert));
}
function previewCamera(dt){
  camera.pos=null;camera.forward=null;
  camera.follow(flight,dt);
  const sway=Math.sin(tick*.32)*.028;
  camera.forward=unit([Math.sin(flight.heading-.43+sway),-.063,Math.cos(flight.heading-.43+sway)]);
  camera.right=unit(cross([0,1,0],camera.forward));
  camera.up=cross(camera.forward,camera.right);
}
function frame(now){
  const dt=Math.min(.09,(now-previous)/1000);
  previous=now;
  if(mode!=='pause') tick+=dt;
  if(mode==='flight'){
    debt+=dt;
    const state=input.sample();
    while(debt>=1/90){flight.step(1/90,state);debt-=1/90;}
    if(flight.toast&&flight.toast!==seenToast){seenToast=flight.toast;sound.signal(seenToast.type);}
    if(flight.done){
      syncMode('done');panel.report(flight);
      sound.signal(flight.done.success?'clear':'warn');
    }
  }
  if(mode==='brief') previewCamera(dt);
  else if(mode!=='pause') camera.follow(flight,dt);
  renderer.render(camera,flight,tick);
  if(mode!=='brief') panel.update(flight,camera,canvas.clientWidth,canvas.clientHeight);
  // A read-only instrument event keeps the rendered instruments and flight logging decoupled.
  const slice=Math.floor(flight.time*20);
  if(slice!==recorded||mode==='done'&&game.dataset.phase!=='done'){
    recorded=slice;
    game.dataset.phase=mode==='done'?'done':flight.phase;
    game.dispatchEvent(new CustomEvent('flight-reading',{detail:Object.freeze({
      x:flight.x,y:flight.y,z:flight.z,heading:flight.heading,speed:flight.speed,roll:flight.roll,pitch:flight.pitch,
      vSpeed:flight.vSpeed,time:flight.time,throttle:flight.throttle,gear:flight.gear,gateIndex:flight.gateIndex,
      phase:flight.phase,target:flight.target?Object.freeze({...flight.target}):null,cleared:flight.done?.success
    })}));
  }
  sound.mix(flight,mode==='flight');
  requestAnimationFrame(frame);
}

function boot(){
  renderer=new FjordRenderer(canvas);
  input=new PilotInput(canvas,{
    Enter:()=>{if(mode==='brief'||mode==='done') launch();else if(mode==='pause') hold();},
    KeyG:()=>{if(mode==='flight') flight.toggleGear();},
    KeyF:()=>{if(mode==='flight') flight.releaseCrate();},
    KeyM:toggleSound, Escape:hold, blur:()=>{if(mode==='flight') hold();}
  });
  byId('resume').onclick=hold;byId('launch').onclick=launch;
  byId('again').onclick=launch;byId('quit').onclick=home;byId('home').onclick=home;
  byId('sound').onclick=toggleSound;byId('invert').onclick=setInvert;
  for(const [i,m] of sorties.entries()){
    const button=document.createElement('button');
    button.type='button'; button.className='sortie'; button.title=m.brief+' '+m.pilot;
    button.innerHTML='<b>0'+(i+1)+'</b><strong>'+m.title+'</strong><small>'+m.tag+'</small>';
    button.onclick=()=>choose(i);menu.append(button);
  }
  choose(0);syncMode('brief');byId('boot').hidden=true;
  previous=performance.now();requestAnimationFrame(frame);
}

try {boot();} catch(error) {
  byId('boot').textContent=error.message;
  console.error(error);
}
