export class CockpitSound {
  constructor() { this.muted=false; }
  wake() {
    if(this.muted) return;
    if(!this.audio){
      const Audio=window.AudioContext || window.webkitAudioContext;
      if(!Audio) return;
      const a=this.audio=new Audio();
      const motor=this.motor=a.createOscillator(), low=a.createBiquadFilter();
      const engine=this.engine=a.createGain(), rush=this.rush=a.createGain();
      const gust=a.createBuffer(1,a.sampleRate*2,a.sampleRate);
      let n=0;
      const samples=gust.getChannelData(0);
      for(let i=0;i<samples.length;i++){
        n=.91*n+.09*(Math.random()*2-1);
        samples[i]=n;
      }
      const stream=a.createBufferSource();
      stream.buffer=gust;stream.loop=true;
      const high=a.createBiquadFilter();high.type='highpass';high.frequency.value=275;
      motor.type='triangle';motor.frequency.value=44;
      low.type='lowpass';low.frequency.value=136;
      engine.gain.value=0;rush.gain.value=0;
      motor.connect(low).connect(engine).connect(a.destination);
      stream.connect(high).connect(rush).connect(a.destination);
      motor.start();stream.start();
    }
    this.audio.resume().catch(()=>{});
  }
  mix(flight,active) {
    if(!this.audio) return;
    const now=this.audio.currentTime;
    const audible=active&&!this.muted;
    this.motor.frequency.setTargetAtTime(37+flight.throttle*32,now,.12);
    this.engine.gain.setTargetAtTime(audible&&flight.fuel>0?.031+flight.throttle*.064:0,now,.12);
    this.rush.gain.setTargetAtTime(audible?flight.speed*.0013:0,now,.18);
  }
  signal(kind) {
    const a=this.audio;
    if(!a||this.muted||a.state!=='running') return;
    const upward=[440,587.33,659.25], downward=[311.13,261.63], arrival=[329.63,440,587.33,880];
    const pitches=kind==='good'?upward:kind==='clear'?arrival:kind==='warn'?downward:[392];
    for(const [i,f] of pitches.entries()){
      const o=a.createOscillator(),g=a.createGain();
      const t=a.currentTime+i*.11;
      o.type='sine';o.frequency.value=f;
      o.connect(g).connect(a.destination);
      g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(.07,t+.025);
      g.gain.exponentialRampToValueAtTime(.001,t+.34);
      o.start(t);o.stop(t+.35);
    }
  }
}
