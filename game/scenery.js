import { terrainHeight, noise, smooth, strip } from './world.js';
import { Mesh, rgb, add, sub, mul, cross, unit } from './geometry.js';

function buildTerrain(gl) {
  const ground=new Mesh(), sea=new Mesh();
  const step=44, nx=228, nz=250, x0=-5016, z0=-4940;
  const points=Array.from({length:nz+1},(_,j)=>Array.from({length:nx+1},(_,i)=>{
    const x=x0+i*step,z=z0+j*step,h=terrainHeight(x,z);
    const normal=unit([terrainHeight(x-13,z)-terrainHeight(x+13,z),26,terrainHeight(x,z-13)-terrainHeight(x,z+13)]);
    const vein=noise(x/260+4,z/170), mix=noise(x/80,z/67);
    return {x,z,h,normal,color:[vein,mix,noise(x/151,z/164)]};
  }));
  const face=(a,b,c)=>{
    const pa=[a.x,a.h,a.z], pb=[b.x,b.h,b.z], pc=[c.x,c.h,c.z], n=unit(cross(sub(pb,pa),sub(pc,pa)));
    if(Math.max(a.h,b.h,c.h)>.5) for(const p of [a,b,c])
      ground.vertex([p.x,p.h,p.z],unit(add(mul(n,.43),mul(p.normal,.57))),p.color);
    if(Math.min(a.h,b.h,c.h)<=.5) for(const p of [a,b,c])
      sea.vertex([p.x,.5,p.z],[0,1,0],[p.h,0,0]);
  };
  for(let j=0;j<nz;j++) for(let i=0;i<nx;i++){
    const a=points[j][i],b=points[j][i+1],c=points[j+1][i+1],d=points[j+1][i];
    if((i+j)%2){face(a,d,b);face(b,d,c);}
    else {face(a,d,c);face(a,c,b);}
  }
  return {terrain:ground.upload(gl),water:sea.upload(gl)};
}

const C=rgb;
function slab(m,x,z,w,d,y,color) {
  m.quad([x-w/2,y,z-d/2],[x-w/2,y,z+d/2],[x+w/2,y,z+d/2],[x+w/2,y,z-d/2],color);
}

function cabin(m,x,z,w,d,wall,roof) {
  const y=Math.max(0,terrainHeight(x,z))-1.3,h=w*.42;
  m.box(x,y,z,w,h,d,wall);
  const a=[x-w*.57,y+h,z-d*.57],b=[x+w*.57,y+h,z-d*.57],
    c=[x+w*.57,y+h,z+d*.57],e=[x-w*.57,y+h,z+d*.57],
    front=[x,y+h+w*.29,z-d*.57],back=[x,y+h+w*.29,z+d*.57];
  m.quad(a,e,back,front,roof); m.quad(front,back,c,b,mul(roof,.76));
  m.tri(a,front,b,wall); m.tri(c,back,e,wall);
  m.box(x,y+h*.26,z-d*.505,w*.34,h*.35,.26,C('ffe8a5'));
  m.box(x-w*.505,y+h*.35,z,w*.022,h*.26,d*.28,C('ffd68b'));
  m.box(x+w*.17,y+h*.85,z+2,w*.12,h*.71,w*.13,C('6d5148'));
}

function quayAndRunway(gl) {
  const m=new Mesh(), lights=new Mesh();
  const {start,end,width,y}=strip, center=(start+end)/2,length=end-start;
  slab(m,0,center,width+13,length+6,y+.42,C('746c60'));
  slab(m,0,center,width,length,y+.65,C('394555'));
  for(const x of [-27.5,27.5]) slab(m,x,center,1.15,length-9,y+.71,C('f7e9c9'));
  for(let z=start+75;z<end-36;z+=51) slab(m,0,z,1.45,24,y+.73,C('eae0c9'));
  for(const z of [start+12,end-12]) for(const x of [-22,-17,-12,-7,7,12,17,22])
    slab(m,x,z,2.9,13,y+.735,C('f5e3bc'));
  for(const x of [-12,12]) for(const z of [start+176,end-176])
    slab(m,x,z,3.3,22,y+.735,C('f0dfc5'));
  for(let z=start+5;z<end+5;z+=29) for(const x of [-31.5,31.5])
    lights.box(x,y+.5,z,1.44,1.3,1.44,z<start+26?C('91fbb7'):z>end-32?C('ff595f'):C('ffcb7e'));
  for(let z=start-390;z<start-6;z+=45) {
    const elevation=Math.max(1.3,terrainHeight(0,z)+1);
    m.box(0,.1,z,1.5,elevation+1,1.5,C('42525c'));
    for(const x of [-11,0,11]) {
      m.box(x,elevation,z,1.6,.68,1.6,C('4b5158'));
      lights.box(x,elevation+.68,z,1.45,1.05,1.45,C('ffc576'));
    }
  }
  // Taxiway, apron, hamlet, breakwater and a striped lighthouse.
  for(let x=-160;x<=-31;x+=14){
    slab(m,x,285,14.01,18,terrainHeight(x,285)+.56,C('55616a'));
    slab(m,x,285,14.02,.58,terrainHeight(x,285)+.62,C('e9bc67'));
  }
  for(const [x,z,w,d,body,roof] of [
    [-100,350,33,43,'c5b699','9b4940'],[-150,356,49,55,'c6bd9a','455a6a'],
    [-150,235,27,33,'d2be9b','99463d'],[-210,228,23,25,'afc7b3','465869'],
    [-198,169,18,24,'e7cda3','9e5349'],[-257,191,24,32,'c8bd99','504c4c'],
    [-90,210,24,28,'c3d1ba','426675'],[-83,134,21,28,'c2a990','99463d'],
    [-230,95,23,18,'d7bc92','88463b'],[-169,70,26,28,'d4bf9f','4e6670'],
    [81,192,24,41,'ddd2ad','536974'],[95,250,23,24,'c4b996','995444']
  ]) cabin(m,x,z,w,d,C(body),C(roof));
  const lighthouse=(x,z,scale)=>{
    const h=Math.max(.5,terrainHeight(x,z))-1;
    m.frustum([x,h,z],[x,h+4*scale,z],8*scale,7*scale,C('4a626a'),12);
    for(let i=0;i<5;i++) m.frustum([x,h+(4+i*5)*scale,z],[x,h+(9+i*5)*scale,z],
      (5.5-.35*i)*scale,(5.15-.35*i)*scale,i%2?C('b34b39'):C('f6dfb8'),12);
    m.frustum([x,h+29*scale,z],[x,h+30.5*scale,z],4.1*scale,6.1*scale,C('463a3c'),12);
    m.frustum([x,h+30.5*scale,z],[x,h+34*scale,z],3.9*scale,3.9*scale,C('344f62'),12);
    lights.frustum([x,h+31.3*scale,z],[x,h+33.2*scale,z],4*scale,4*scale,C('ffd98a'),12);
    m.frustum([x,h+34*scale,z],[x,h+39*scale,z],5.5*scale,0,C('b04a3c'),12);
  };
  lighthouse(-253,-418,1.35);
  lighthouse(394,-1866,1.12);
  for(let z=-6;z<97;z+=12){
    const x=-357-(z+6)*.43;
    m.box(x,-2,z,16,6,14,C('686057'));
    m.box(x,3.8,z,15,1.45,14,C('98847a'));
    if(z%24===18) lights.box(x,5,z,1.6,1.7,1.6,C('ffce83'));
  }
  // Working boat in the harbour with a small sunlit wheelhouse.
  const boat=(x,z)=>{
    m.box(x,1,z,9.1,3.1,25,C('b7604d'));
    m.tri([x-4.55,4,z+12.5],[x,4,z+20],[x+4.55,4,z+12.5],C('eaceaa'));
    m.box(x,4,z-2,8.1,.42,24,C('bcad89'));
    m.box(x,4.5,z-3,6,4,8,C('e6d7b3'));
    m.box(x,6.5,z+1.02,5.3,1.16,.23,C('406674'));
    m.box(x,8.4,z-3,6.5,.42,9,C('b55349'));
    m.tube([x,8.5,z-3],[x,14,z-3],.24,C('4d4d45'));
  };
  boat(-481,-107); boat(285,-700);
  return {shores:m.upload(gl),lights:lights.upload(gl)};
}

function treeline(gl) {
  const mesh=new Mesh();
  for(let j=0;j<92;j++) for(let i=0;i<104;i++){
    const x=(i-51.5)*76+(noise(i*1.13,j*1.03)-.5)*68;
    const z=(j-48)*87+(noise(j*1.21,i*1.23)-.5)*70;
    const y=terrainHeight(x,z);
    const hill=Math.abs(terrainHeight(x+11,z)-y)+Math.abs(terrainHeight(x,z-11)-y);
    const grove=noise(x/328,z/279);
    if(y<16 || y>622 || hill>14 || grove<.38 || (Math.abs(x)<325 && z<610 && z>-380)) continue;
    const h=9+16*noise(x*.033,z*.028)+y*.007, w=h*(.23+.14*grove);
    const tint=noise(x*.026,z*.020);
    const c=mul(C('527c6a'),.59+.45*tint);
    mesh.frustum([x,y-1,z],[x,y+h*.33,z],w*.105,w*.07,C('54473b'),5);
    mesh.frustum([x,y+h*.13,z],[x,y+h*.77,z],w,w*.02,c,5);
    mesh.frustum([x,y+h*.43,z],[x,y+h,z],w*.72,.04,mul(c,1.13),5);
  }
  return mesh.upload(gl);
}

export function buildBeacon(gl) {
  const rim=new Mesh(), accents=new Mesh(), glow=new Mesh();
  const point=(a,r,z)=>[Math.cos(a)*r,Math.sin(a)*r,z];
  for(let i=0;i<96;i++){
    const a=i*Math.PI/48,b=(i+1)*Math.PI/48;
    for(const z of [-.022,.022]){
      const color=i%12<2?C('f7c692'):C('6e645a');
      rim.quad(point(a,1.018,z),point(b,1.018,z),point(b,1.108,z),point(a,1.108,z),color);
    }
    const c=i%12<2?C('fff0bf'):C('e87a40');
    rim.quad(point(a,1.108,-.022),point(b,1.108,-.022),point(b,1.108,.022),point(a,1.108,.022),c);
    glow.quad(point(a,1.018,-.024),point(b,1.018,-.024),point(b,1.046,-.024),point(a,1.046,-.024),[1,.62,.26]);
    if(i%12===0) accents.quad(point(a,1.095,-.028),point(b+.032,1.095,-.028),
      point(b+.026,1.174,-.028),point(a+.006,1.174,-.028),[1,.79,.49]);
  }
  return {rim:rim.upload(gl),accents:accents.upload(gl),glow:glow.upload(gl)};
}

function buildReliefCrate(gl) {
  const m=new Mesh();
  m.box(0,-1.45,0,2.9,2.9,2.9,C('d48846'));
  for(const x of [-.98,.98]) m.box(x,-1.5,0,.21,3,2.98,C('ffd58b'));
  const curve=(r,y,a)=>[r*Math.cos(a),y,r*Math.sin(a)];
  for(let i=0;i<16;i++){
    const a=i*Math.PI/8,b=(i+1)*Math.PI/8,col=i%2?C('e87c52'):C('fff3c9');
    const v=curve(7.1,9.1,a),w=curve(7.1,9.1,b),p=curve(4.6,12.5,a),q=curve(4.6,12.5,b);
    m.quad(p,q,w,v,col);m.tri([0,14.1,0],q,p,col);
    if(i%2===0) m.tube(v,[0,1.47,0],.075,C('e9d7ad'),4);
  }
  return m.upload(gl);
}
export function buildScenery(gl) {
  return {...buildTerrain(gl), ...quayAndRunway(gl), trees:treeline(gl), beacon:buildBeacon(gl), relief:buildReliefCrate(gl)};
}
