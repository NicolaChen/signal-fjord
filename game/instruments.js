import { angleDelta, clamp } from './world.js';
import { bearing, feet, knots } from './flight.js';

export const byId = id => document.getElementById(id);
const pad = n => String(n).padStart(3,'0');
const put = (node,text)=>{ if(node.textContent!==text) node.textContent=text; };

export class InstrumentPanel {
  constructor() {
    this.nodes=Object.fromEntries(['heading','compass-scale','sortie-code','sortie-title','route-steps','mission-note',
      'target','toast','tower-link','nav-mode','range','nav-diamond','nav-caption','speed','speed-help','speed-dial','altitude','vertical-speed',
      'power','power-rail','fuel','fuel-rail','gear','brake','hull','flight-hint','reticle','report-code','report-title',
      'report-reason','report-stats'].map(id=>[id,byId(id)]));
    for(let i=-9;i<=9;i++){
      const el=document.createElement('span');
      el.className='tick'+(i%3===0?' major':'');
      if(i%3===0) el.append(document.createElement('b'));
      this.nodes['compass-scale'].append(el);
    }
  }

  update(flight,camera,w,h) {
    const n=this.nodes;
    const p=flight;
    const seaSpeed=knots(p.speed),alt=feet(p.y), hdg=bearing(p.heading);
    put(n.speed,seaSpeed+'');put(n.altitude,alt+'');put(n.heading,pad(hdg)+'°');
    put(n['vertical-speed'],p.ground?'ON GROUND':(p.vSpeed>=0?'↑ ':'↓ ')+Math.abs(feet(p.vSpeed*60))+' FT/MIN');
    put(n.power,Math.round(p.throttle*100)+'%');n['power-rail'].style.width=(p.throttle*100)+'%';
    put(n.fuel,Math.ceil(p.fuel)+'%');n['fuel-rail'].style.width=p.fuel+'%';
    put(n.gear,p.gear?'◆ GEAR DOWN':'◇ GEAR UP');n.gear.classList.toggle('on',p.gear);
    put(n.brake,p.brake?'◆ BRAKE ON':'◇ BRAKE OFF');n.brake.classList.toggle('on',p.brake);
    put(n.hull,'◆ HULL '+Math.max(0,Math.round(p.hull)));n.hull.classList.toggle('warn',p.hull<48);
    const a=p.heading*180/Math.PI,slot=Math.floor(a/5), offset=(a/5-slot)*13.5;
    [...n['compass-scale'].children].forEach((tick,j)=>{
      const k=j-9, v=((slot+k)%72+72)%72;
      tick.style.transform='translateX('+(k*13.5-offset)+'px)';
      tick.classList.toggle('major',v%3===0);
      if(v%3===0){
        if(!tick.firstChild) tick.append(document.createElement('b'));
        put(tick.firstChild,({0:'N',18:'E',36:'S',54:'W'})[v]??pad(v*5));
      }else if(tick.firstChild) tick.firstChild.remove();
    });
    n.reticle.style.transform='rotate('+(-p.roll*19)+'deg)';
    n.reticle.hidden=p.ground||Boolean(p.done);
    put(n['tower-link'],p.done?'CLOSED':'LIVE');
    n['tower-link'].classList.toggle('closed',Boolean(p.done));
    put(n['sortie-code'],p.sortie.code);
    put(n['sortie-title'],p.sortie.title);
    const key=[p.sortie.key,p.gateIndex,p.phase,p.done?.success].join(':');
    if(key!==this.lastRoute){
      n['route-steps'].replaceChildren(...[...p.sortie.gates.map(g=>g.id),...(p.sortie.land?['RWY']:[])].map((id,i)=>{
        const tag=document.createElement('span');tag.textContent=id;
        tag.className=i<p.gateIndex||p.done?.success?'past':i===p.gateIndex?'now':'future';
        return tag;
      }));
      this.lastRoute=key;
    }
    const note=p.done?(p.done.success?'DISPATCH COMPLETE':'DISPATCH INCOMPLETE'):p.sortie.limit?Math.max(0,p.sortie.limit-p.time).toFixed(1)+' SEC LEFT  ·  '+p.gateIndex+' / '+p.sortie.gates.length:
      p.phase==='route'?p.gateIndex+' / '+p.sortie.gates.length+(p.sortie.key==='supply'?' CRATES DELIVERED':' BEACONS VERIFIED'):
        p.phase==='approach'?'DESCEND TO THE BLUE GATE':p.phase==='landing'?'CLEARED TO LAND · 01':'ON STRIP · BRAKE TO STOP';
    put(n['mission-note'],note);
    n.toast.hidden=!p.toast || p.time>p.toast.until||Boolean(p.done);
    if(!n.toast.hidden){
      n.toast.dataset.type=p.toast.type;
      put(n.toast.children[0],p.toast.title);put(n.toast.children[1],p.toast.body);
    }
    const g=p.target;
    const travel=g?Math.hypot(g.x-p.x,g.z-p.z):0;
    const localizer=p.phase==='landing'||p.ground;
    const within=localizer?seaSpeed>=85&&seaSpeed<=130:!g?.drop||p.speed<=g.maxSpeed;
    n['speed-dial'].toggleAttribute('data-warn',!p.ground&&(!within||seaSpeed<92));
    put(n['speed-help'],p.ground?'GROUND SPEED':localizer?'FINAL 85–130 KT':g?.drop?'DROP ≤ '+knots(g.maxSpeed)+' KT':seaSpeed<92?'STALL RISK':'INDICATED');
    const glide=32+Math.max(0,-230-p.z)*.064;
    const heightError=p.y-glide;
    put(n['flight-hint'],p.done?'':p.ground?'THROTTLE IDLE · HOLD SPACE TO BRAKE':p.phase==='landing'?
      (travel<140&&p.y<44?'LEVEL THE WINGS · FLARE GENTLY':'GEAR DOWN · FOLLOW THE GLIDE DIAMOND'):
      p.retryGate?'TURN BACK · RE-ENTER FROM THE SOUTH':p.phase==='approach'?'DESCEND TO THE BLUE GATE · START SLOWING':
      g?.drop?p.readyToDrop?'RELEASE CRATE NOW · PRESS F':'FLY THROUGH BELOW '+knots(g.maxSpeed)+' KT · F TO RELEASE':'FLY THROUGH THE LIT BEACON');
    n['flight-hint'].toggleAttribute('data-ready',p.readyToDrop);
    n.target.hidden=!g||p.ground||Boolean(p.done);
    if(g){
      const turn=angleDelta(Math.atan2(g.x-p.x,g.z-p.z),p.heading);
      const dx=localizer?clamp(-p.x*.85,-84,84):clamp(turn*70,-84,84);
      const dy=p.ground?0:localizer?clamp(heightError*.48,-24,24):clamp((p.y-g.y)/(Math.max(travel,120)) * 133,-24,24);
      n['nav-diamond'].setAttribute('transform','translate('+dx.toFixed(1)+' '+dy.toFixed(1)+')');
      put(n['nav-mode'],p.done?'DISPATCH LOG':p.ground?'GROUND ROLL':localizer?'GLIDE SLOPE':g.drop?'DROP LINK':'ROUTE LINK');
      put(n.range,p.done?'END':travel>=999?(travel/1000).toFixed(2)+' KM':Math.round(travel)+' M');
      const caption=p.done?p.done.success?'FLIGHT RECORDED':'SORTIE ENDED':p.retryGate?'BEACON BEHIND AIRCRAFT':p.ground?'ROLLING · HOLD BRAKE':localizer?
        (Math.abs(heightError)<6?'ON GLIDE PATH':heightError>0?'HIGH · LOWER THE NOSE':'LOW · RAISE THE NOSE'):
        Math.abs(turn)>.14?(turn<0?'TURN LEFT':'TURN RIGHT')+' · '+pad(bearing(Math.atan2(g.x-p.x,g.z-p.z)))+'°':'BEACON ON BEARING';
      put(n['nav-caption'],caption);
      const tag=camera.project([g.x,g.y+(g.r?g.r*1.25:34),g.z],w,h);
      n.target.hidden ||= !tag.visible||tag.x<44||tag.x>w-44||tag.y<118||tag.y>h-155;
      if(!n.target.hidden){
        n.target.style.left=tag.x+'px';n.target.style.top=tag.y+'px';
        put(n.target.firstElementChild,(g.r&&g.id!=='RWY'?(g.drop?'DROP ':'BEACON ')+g.id:g.id==='RWY'?'APPROACH · 01':'RUNWAY · 01')+'  /  '+Math.round(travel)+' M');
      }
    }else if(p.done){
      put(n['nav-mode'],'DISPATCH LOG');put(n.range,'END');
      put(n['nav-caption'],p.done.success?'FLIGHT RECORDED':'SORTIE ENDED');
      n['nav-diamond'].setAttribute('transform','translate(0 0)');
    }
  }

  report(flight) {
    const p=flight,n=this.nodes;
    put(n['report-code'],p.done.success?'FLIGHT REPORT / CLEARED':'FLIGHT REPORT / INCOMPLETE');
    put(n['report-title'],p.done.success?(p.sortie.land?'Safely home.':'Signal received.'):'Sortie ended.');
    put(n['report-reason'],p.done.reason);
    const objective=p.sortie.key==='supply'?'CRATES':p.sortie.key==='weather'?'GATES':'BEACONS';
    const data=[['SCORE',Math.round(p.score).toLocaleString('en-US')],[objective,p.gateIndex+'/'+p.sortie.gates.length],['TIME',Math.round(p.time)+'s']];
    n['report-stats'].replaceChildren(...data.map(([label,value])=>{
      const div=document.createElement('div'),a=document.createElement('small'),b=document.createElement('b');
      a.textContent=label;b.textContent=value;div.append(a,b);return div;
    }));
  }
}
