import { identity, attitude, Mesh } from './geometry.js';
import { skyVertex, skyFragment, sceneVertex, sceneFragment } from './atmosphere.js';
import { buildKestrel } from './airframe.js';
import { buildScenery } from './scenery.js';
import { terrainHeight } from './world.js';

function compileProgram(gl, vertex, fragment) {
  const p=gl.createProgram();
  for(const [type,code] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){
    const s=gl.createShader(type);
    gl.shaderSource(s,code);
    gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s));
    gl.attachShader(p,s);
    gl.deleteShader(s);
  }
  gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(p));
  return {program:p,uniforms:Object.fromEntries([
    'uCamera','uRight','uUp','uFront','uAspect','uFocal','uTime','uOrigin','uRotation','uScale','uAlpha','uTint','uMaterial','uEmission'
  ].map(name=>[name,gl.getUniformLocation(p,name)]))};
}

const center=[0,0,0], natural=[1,1,1];

export class FjordRenderer {
  constructor(canvas) {
    this.canvas=canvas;
    this.gl=canvas.getContext('webgl2',{alpha:false,antialias:true,powerPreference:'high-performance'});
    if(!this.gl) throw Error('Signal Fjord needs WebGL 2. Enable hardware acceleration in Chrome and reload.');
    const gl=this.gl;
    this.sky=compileProgram(gl,skyVertex,skyFragment);
    this.scene=compileProgram(gl,sceneVertex,sceneFragment);
    this.triangle=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,this.triangle);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    this.scenery=buildScenery(gl);
    this.airframe=buildKestrel(gl);
    this.shadow=makeShadow(gl);
    gl.clearColor(.38,.55,.66,1);
    gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  }

  uniforms(stage,camera,time) {
    const gl=this.gl, u=stage.uniforms;
    gl.useProgram(stage.program);
    gl.uniform3fv(u.uCamera,camera.pos);
    gl.uniform3fv(u.uRight,camera.right);
    gl.uniform3fv(u.uUp,camera.up);
    gl.uniform3fv(u.uFront,camera.forward);
    gl.uniform1f(u.uAspect,this.canvas.width/this.canvas.height);
    gl.uniform1f(u.uFocal,camera.focal);
    gl.uniform1f(u.uTime,time);
  }

  draw(mesh,material=0,origin=center,rotation=identity,scale=1,emission=0,tint=natural,alpha=1){
    const gl=this.gl,u=this.scene.uniforms;
    gl.uniform3fv(u.uOrigin,origin);
    gl.uniformMatrix3fv(u.uRotation,false,rotation);
    gl.uniform1f(u.uScale,scale);
    gl.uniform1i(u.uMaterial,material);
    gl.uniform1f(u.uEmission,emission);
    gl.uniform3fv(u.uTint,tint);
    gl.uniform1f(u.uAlpha,alpha);
    gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);
    for(let i=0;i<3;i++){
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i,3,gl.FLOAT,false,36,i*12);
    }
    gl.drawArrays(gl.TRIANGLES,0,mesh.count);
  }

  render(camera,flight,time) {
    const {canvas,gl,scenery,airframe}=this;
    const ratio=Math.min(devicePixelRatio,1.35);
    const w=Math.round(canvas.clientWidth*ratio),h=Math.round(canvas.clientHeight*ratio);
    if(canvas.width!==w||canvas.height!==h){ canvas.width=w;canvas.height=h; }
    gl.viewport(0,0,w,h);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    this.uniforms(this.sky,camera,time);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.triangle);
    gl.enableVertexAttribArray(0);
    gl.disableVertexAttribArray(1);
    gl.disableVertexAttribArray(2);
    gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    gl.drawArrays(gl.TRIANGLES,0,3);

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    this.uniforms(this.scene,camera,time);
    this.draw(scenery.terrain,1);
    this.draw(scenery.water,2);
    this.draw(scenery.trees);
    this.draw(scenery.shores);
    this.draw(scenery.lights,0,center,identity,1,.94);

    const route=flight.phase==='route'?flight.sortie.gates.slice(flight.gateIndex,flight.gateIndex+3):
      flight.phase==='approach'?[flight.target]:[];
    for(let i=route.length-1;i>=0;i--){
      const g=route[i], place=[g.x,g.y,g.z], turn=attitude(g.tilt,0,0);
      const tint=g.drop&&flight.readyToDrop&&i===0?[.47,1.58,1.43]:flight.phase==='approach'?[.29,1.50,2.15]:g.drop?[.32,1.22,1.85]:
        flight.sortie.limit?[1.02,.72,1.65]:natural;
      this.draw(scenery.beacon.rim,0,place,turn,g.r,.48,i===0?tint:[.61,.67,.72]);
      this.draw(scenery.beacon.accents,0,place,turn,g.r,1,i===0?tint:[.43,.47,.53]);
      this.draw(scenery.beacon.glow,0,place,turn,g.r,1,i===0?tint:[.53,.57,.65]);
    }
    for(const drop of flight.drops){
      const age=flight.time-drop.time, x=drop.x+Math.min(age,11)*flight.sortie.crosswind*.58, z=drop.z+32*(1-Math.exp(-age));
      const height=Math.max(terrainHeight(x,z)+2,1.9,drop.y-8*age-13*(1-Math.exp(-age*1.6)));
      const sway=age*.32,scale=.45+.55*(1-Math.exp(-age*3.7));
      this.draw(scenery.relief,0,[x,height,z],attitude(sway,0,Math.sin(sway*2.2)*.11),scale,.35);
    }
    const {x,y,z,heading,pitch,roll,gear,ground,done}=flight;
    const model=attitude(heading,pitch,roll);
    const floor=Math.max(.5,terrainHeight(x,z))+.82;
    if(y-floor<48){
      gl.enable(gl.BLEND);
      this.draw(this.shadow,0,[x,floor,z],attitude(heading,0,0),1,1,natural,.33*(1-(y-floor)/48));
      gl.disable(gl.BLEND);
    }
    this.draw(airframe.body,0,[x,y,z],model,1,.24);
    if(gear||ground) this.draw(airframe.gear,0,[x,y,z],model,1,.18);
    if(!done||done.success){
      // Multiplication keeps the prop turning around the airframe's own forward axis.
      const spin=time*(ground?10:32), c=Math.cos(spin),s=Math.sin(spin);
      const prop=new Float32Array([model[0]*c+model[3]*s,model[1]*c+model[4]*s,model[2]*c+model[5]*s,
        model[3]*c-model[0]*s,model[4]*c-model[1]*s,model[5]*c-model[2]*s,model[6],model[7],model[8]]);
      this.draw(airframe.prop,0,[x,y,z],prop,1,.4);
    }
  }
}

function makeShadow(gl) {
  const mesh=new Mesh();
  const color=[.08,.14,.17];
  for(let i=0;i<32;i++){
    const a=i*Math.PI/16,b=(i+1)*Math.PI/16;
    mesh.tri([0,0,0],[Math.cos(a)*15,0,Math.sin(a)*8],[Math.cos(b)*15,0,Math.sin(b)*8],color);
  }
  return mesh.upload(gl);
}
