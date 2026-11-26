import { clamp } from './world.js';

const consumed=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight',
  'KeyQ','KeyE','KeyG','KeyF','KeyM','Escape','Space','Enter']);
const axis=(n,dead=.08)=>Math.sign(n)*Math.max(0,(Math.abs(n)-dead)/(1-dead));

export class PilotInput {
  constructor(canvas,actions) {
    this.keys=new Set();
    this.drag=null;
    this.invert=false;
    this.active=false;
    window.addEventListener('keydown',e=>{
      const onButton=(e.target instanceof HTMLButtonElement)&&(e.code==='Enter'||e.code==='Space');
      if(!consumed.has(e.code)||onButton) return;
      if(this.active || e.code==='Escape') e.preventDefault();
      this.keys.add(e.code);
      if(!e.repeat) actions[e.code]?.();
    });
    window.addEventListener('keyup',e=>this.keys.delete(e.code));
    canvas.addEventListener('pointerdown',e=>{
      if(!this.active || e.button!==0) return;
      this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,dx:0,dy:0};
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor='grabbing';
    });
    canvas.addEventListener('pointermove',e=>{
      if(e.pointerId!==this.drag?.id) return;
      this.drag.dx=clamp((e.clientX-this.drag.x)/115,-1,1);
      this.drag.dy=clamp((e.clientY-this.drag.y)/95,-1,1);
    });
    for(const type of ['pointerup','pointercancel','lostpointercapture'])
      canvas.addEventListener(type,e=>{
        if(e.pointerId===this.drag?.id) this.drag=null;
        canvas.style.cursor='';
      });
    window.addEventListener('blur',()=>{this.clear();canvas.style.cursor='';actions.blur?.();});
    this.canvas=canvas;
  }
  clear() { this.keys.clear(); this.drag=null; if(this.canvas) this.canvas.style.cursor=''; }
  sample() {
    const has=(...codes)=>+codes.some(code=>this.keys.has(code));
    const drag=this.drag;
    return {
      roll:clamp(has('KeyA','ArrowLeft')-has('KeyD','ArrowRight')-axis(drag?.dx??0),-1,1),
      pitch:(this.invert?-1:1)*clamp(has('KeyW','ArrowUp')-has('KeyS','ArrowDown')-axis(drag?.dy??0),-1,1),
      power:has('KeyE')-has('KeyQ'),
      brake:Boolean(has('Space'))
    };
  }
}
