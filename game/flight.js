import {angleDelta, clamp, lerp, radians, smooth, strip, approach, terrainHeight} from './world.js';

export const knots = mps => Math.round(mps * 1.94384);
export const feet = m => Math.round(m * 3.28084);
export const bearing = yaw => (Math.round(yaw * 180 / Math.PI) + 360) % 360;
const planeSide = (p, gate) => (p.z-gate.z)*Math.cos(gate.tilt) + (p.x-gate.x)*Math.sin(gate.tilt);

export class Flight {
  constructor(sortie) {
    this.sortie = sortie;
    const {x,y,z,heading,speed} = sortie.start;
    Object.assign(this, {x,y,z,heading,speed,pitch:0,roll:0,throttle:.59,vSpeed:-1.8,
      fuel:sortie.fuel, hull:100, gateIndex:0, time:0, score:0, phase:'route',
      gear:false, brake:false, ground:false, done:null, toast:null, retryGate:false, flare:0, drops:[]});
  }

  get target() {
    if (this.phase === 'route') return this.sortie.gates[this.gateIndex];
    if (this.phase === 'approach') return approach;
    if (this.phase === 'landing') return {id:'01',name:'Runway 01 · touchdown',x:0,y:strip.y+5,z:strip.start+40};
    return {id:'01',name:'Runway 01 · stop',x:0,y:strip.y+2,z:strip.end};
  }

  notice(title, body, type='good') { this.toast={title,body,type,until:this.time+3.4}; }
  finish(success, reason) { this.done={success,reason}; }

  toggleGear() {
    if (this.ground || this.done) return;
    this.gear=!this.gear;
    this.notice(this.gear?'GEAR DOWN':'GEAR UP', this.gear?'More drag · ready for the runway':'Clean configuration', 'info');
  }

  nextGate(quality) {
    const gate=this.target;
    const reward = Math.round(500 + 450*quality);
    this.score+=reward;
    this.gateIndex++;
    this.retryGate=false;
    this.notice(gate.drop?'RELIEF CRATE DELIVERED':'BEACON '+gate.id+' VERIFIED', '+'+reward+' points');
    if (this.gateIndex === this.sortie.gates.length) {
      if (!this.sortie.land) return this.finish(true,'Every sounding logged. Survey data transmitted.');
      this.phase='approach';
    }
  }

  releaseCrate() {
    const g=this.target;
    if(this.done || !g?.drop) return;
    const along=planeSide(this,g);
    const cross=(this.x-g.x)*Math.cos(g.tilt)-(this.z-g.z)*Math.sin(g.tilt);
    const distance=Math.hypot(cross,this.y-g.y);
    if(Math.abs(along)>60||distance>g.r) return this.notice('OUTSIDE DROP CORRIDOR','Release with F when the drop ring is green.','warn');
    if(this.speed>g.maxSpeed) return this.notice('TOO FAST TO DROP','Ease the throttle or use the air brake.','warn');
    this.drops.push({x:this.x,y:this.y-4,z:this.z,time:this.time});
    this.nextGate(clamp(1-Math.hypot(distance,along*.52)/g.r,0,1));
  }

  get readyToDrop() {
    const g=this.target;
    if(!g?.drop) return false;
    const cross=(this.x-g.x)*Math.cos(g.tilt)-(this.z-g.z)*Math.sin(g.tilt);
    return Math.abs(planeSide(this,g))<=60&&Math.hypot(cross,this.y-g.y)<=g.r&&this.speed<=g.maxSpeed;
  }

  checkGate(before) {
    if (this.phase !== 'route' && this.phase !== 'approach') return;
    const g=this.target, side0=planeSide(before,g), side1=planeSide(this,g);
    if (side1 < -15) this.retryGate=false;
    if(g.drop) {
      if(side0<=60&&side1>60) {
        this.retryGate=true;
        this.notice('DROP WINDOW MISSED','Turn back to the corridor and press F within it.','warn');
      }
      return;
    }
    if (side0 > 0 || side1 <= 0 || this.done) return;
    const t=side0/(side0-side1);
    const across=(lerp(before.x,this.x,t)-g.x)*Math.cos(g.tilt)-(lerp(before.z,this.z,t)-g.z)*Math.sin(g.tilt);
    const distance=Math.hypot(across,lerp(before.y,this.y,t)-g.y);
    if (distance > g.r) {
      this.retryGate = true;
      this.notice('GATE MISSED','Turn back and cross from the south.','warn');
      return;
    }
    if (this.phase==='route') this.nextGate(1-distance/g.r);
    else {
      this.phase='landing';
      this.retryGate=false;
      this.notice('FINAL APPROACH','Gear down · 85–130 kt · flare before contact');
    }
  }

  step(dt, input) {
    if (this.done) return;
    this.time+=dt;
    if (this.sortie.limit && this.time>=this.sortie.limit) return this.finish(false,'Survey battery expired before the final sounding.');
    const before={x:this.x,y:this.y,z:this.z};
    this.throttle=clamp(this.throttle+input.power*dt*.42,0,1);
    this.brake=input.brake;
    const motor=this.fuel>0?this.throttle:0;
    this.fuel=Math.max(0,this.fuel-dt*(.21+1.60*motor*motor));
    const wind=this.sortie.crosswind*(.65+.45*Math.sin(this.time*.73+this.z*.003));
    if (this.ground) {
      this.speed=Math.max(0,this.speed + (motor*11 - (this.brake?15:4.3) - this.speed*.025)*dt);
      this.heading-=input.roll*Math.min(.24,this.speed*.018)*dt;
      this.pitch=lerp(this.pitch,0,1-Math.exp(-3.6*dt));
      this.x+=Math.sin(this.heading)*this.speed*dt;
      this.z+=Math.cos(this.heading)*this.speed*dt;
      if(this.z>strip.end || Math.abs(this.x)>strip.width*.55) return this.finish(false,'Runway excursion. Hold the wheel brake after touchdown.');
      if(this.speed<2.2) {
        this.speed=0;
        this.score+=Math.round(1100+this.hull*5+this.fuel*3+this.flare*120);
        return this.finish(true,'On the runway, stopped and cleared by the tower.');
      }
      return;
    }
    const authority=lerp(.52,1,smooth(31,64,this.speed));
    const bankAngle=input.roll*radians(58);
    this.roll=lerp(this.roll,bankAngle,1-Math.exp(-2.8*dt));
    this.heading+=dt*Math.tan(-this.roll)*authority*.22;
    this.pitch=lerp(this.pitch,input.pitch*radians(23),1-Math.exp(-2.6*dt));
    this.speed=clamp(this.speed+dt*(12.4*motor- .089*this.speed - .95 - this.pitch*6
      - (this.gear?1.45:0) - (this.brake?3:0) - .94*Math.abs(this.roll)),28,119);
    const strain=smooth(89,114,this.speed)*Math.max(Math.abs(this.roll),Math.abs(this.pitch)*1.9);
    if(strain>.24) {
      this.hull-=dt*strain*12;
      if(this.hull<=0) return this.finish(false,'Airframe overstressed. Ease off the controls at high speed.');
    }
    const stall = 1-smooth(35,49,this.speed);
    this.vSpeed=lerp(this.vSpeed,Math.sin(this.pitch)*this.speed-2.0-22*stall-2.6*Math.abs(this.roll),1-Math.exp(-2.15*dt));
    this.x+=(Math.sin(this.heading)*this.speed*Math.cos(this.pitch)+wind)*dt;
    this.z+=Math.cos(this.heading)*this.speed*Math.cos(this.pitch)*dt;
    this.y+=this.vSpeed*dt;
    this.checkGate(before);
    if (this.done) return;
    if(Math.abs(this.x)>4510 || this.z>5450 || this.z<-4620)
      return this.finish(false,'You left the North Reach control area. Follow the active beacon back into the fjord.');

    const surface=Math.max(0,terrainHeight(this.x,this.z));
    const onStrip=Math.abs(this.x)<strip.width/2 && this.z>strip.start && this.z<strip.end;
    if(this.y > surface+(this.gear?3.2:1.8)) return;
    if(onStrip && this.phase==='landing') {
      const aligned=Math.abs(angleDelta(this.heading, strip.heading))<radians(18);
      if(this.gear && aligned && this.speed<=70 && this.vSpeed>-10.6 && Math.abs(this.roll)<.36) {
        this.phase='rollout';
        this.ground=true;
        this.flare=clamp(this.pitch*9,0,1);
        this.hull=clamp(this.hull-Math.max(0,-this.vSpeed-3.3)*4,20,100);
        this.y=strip.y+3.2;
        this.vSpeed=0;
        this.roll=0;
        this.notice('WHEELS DOWN','Cut power and hold Space to stop.');
        return;
      }
      return this.finish(false,!this.gear?'Gear-up impact. Lower the gear before final.':
        this.speed>70?'Too fast at contact. Reduce speed and brake in the air.':'Hard landing. Align with the strip and flare.');
    }
    return this.finish(false,onStrip?'Touchdown out of sequence. Complete the beacon route and approach first.':
      surface>0?'Terrain strike. Climb early and use the beacon path.':'Ditched in the fjord. Keep airspeed above the stall.');
  }
}
