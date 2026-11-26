import {Mesh, rgb, mul} from './geometry.js';

const ivory=rgb('fff2cd'), vermilion=rgb('e54f30'), belly=rgb('c29069'),
  graphite=rgb('273d4b'), glass=rgb('5094a7'), glassShade=rgb('254b65'), metal=rgb('b7bdad');

function station([z,halfWidth,halfHeight,lift],i) {
  const a=i*Math.PI/6 + Math.PI/12;
  return [Math.cos(a)*halfWidth, lift+Math.sin(a)*halfHeight,z];
}

export function buildKestrel(gl) {
  const m=new Mesh();
  // Tapered tail, framed greenhouse canopy and a round radial cowling.
  const ribs=[[-15,.34,.42,1.04],[-10,1.18,.95,.4],[-5,2.05,1.75,.22],
    [2,2.23,2.05,.30],[6,2.54,2.02,.25],[8.1,2.38,1.85,.18],[9.35,1.15,1.16,.13],[9.8,.14,.14,.13]];
  for(let r=0;r<ribs.length-1;r++) for(let i=0;i<12;i++){
    const a=station(ribs[r],i), b=station(ribs[r],(i+1)%12),
      c=station(ribs[r+1],(i+1)%12), d=station(ribs[r+1],i);
    const level=(a[1]+b[1])/2;
    const color=r>=4?vermilion:level<-.58?belly:Math.abs(level)<.37?vermilion:ivory;
    m.quad(a,b,c,d,color);
  }
  const canopy=[
    [[-1.64,1.7,-5.7],[1.64,1.7,-5.7],[-1.06,2.13,-5.7],[1.06,2.13,-5.7]],
    [[-1.77,1.81,-3.4],[1.77,1.81,-3.4],[-1.13,3.45,-3.4],[1.13,3.45,-3.4]],
    [[-1.91,1.85,.54],[1.91,1.85,.54],[-1.18,3.56,.54],[1.18,3.56,.54]],
    [[-1.73,1.82,4.2],[1.73,1.82,4.2],[-1.06,2.28,4.2],[1.06,2.28,4.2]]
  ];
  for(let i=0;i<3;i++){
    const [a,b,c,d]=canopy[i], [e,f,g,h]=canopy[i+1];
    m.quad(a,c,g,e,glassShade); m.quad(b,f,h,d,glass);
    m.quad(c,d,h,g,i===1?mul(glass,1.15):glass);
    for(const [p,q] of [[a,c],[c,d],[d,b],[a,e],[b,f],[c,g],[d,h]]) m.tube(p,q,.10,ivory,5);
  }
  for(const s of [-1,1]){
    // Swept tips, a separate flap band and a rescue stripe on each upper wing.
    const wing=(x,y,z)=>[s*x,y,z];
    const rootL=wing(1.1,.43,4.8), rootT=wing(1.0,.30,-5.9), midL=wing(15,1.04,2.8),
      midT=wing(15,1.00,-3.55), tipL=wing(20,1.43,.54),tipT=wing(20,1.36,-2.72);
    const plate=(a,b,c,d,col)=>s>0?m.quad(a,b,c,d,col):m.quad(d,c,b,a,col);
    plate(rootL,midL,midT,rootT,ivory); plate(midL,tipL,tipT,midT,vermilion);
    const lower=p=>[p[0],p[1]-.55,p[2]+.25];
    plate(lower(rootT),lower(midT),lower(midL),lower(rootL),belly);
    plate(lower(midT),lower(tipT),lower(tipL),lower(midL),vermilion);
    for(const [a,b] of [[rootL,midL],[midL,tipL],[tipL,tipT],[tipT,midT],[midT,rootT]]) plate(b,a,lower(a),lower(b),vermilion);
    plate(wing(2,.49,-4.25),wing(14.6,1.07,-2.54),wing(14.6,1.055,-3.54),wing(2,.38,-5.76),vermilion);
    plate(wing(9.3,.90,3.67),wing(10.5,.95,3.50),wing(10.5,.86,-4.26),wing(9.3,.81,-4.45),vermilion);
    plate(wing(11.0,.97,3.45),wing(11.42,.99,3.39),wing(11.42,.897,-4.13),wing(11.0,.877,-4.18),graphite);
    // Cross insignia on the inner panels and a navigation lamp at each tip.
    plate(wing(4.3,.70,1.68),wing(6.2,.80,1.68),wing(6.2,.80,.98),wing(4.3,.70,.98),vermilion);
    plate(wing(4.82,.74,2.4),wing(5.60,.79,2.4),wing(5.60,.77,.25),wing(4.82,.73,.25),vermilion);
    m.box(20*s,1.15,-.5,.56,.31,.55,s<0?rgb('ff5156'):rgb('67ffa6'));
    plate(wing(.35,1.10,-10.3),wing(7.9,1.36,-12.1),wing(7.45,1.30,-14.2),wing(.3,1.0,-14.6),ivory);
    plate(wing(5.9,1.34,-11.62),wing(7.9,1.37,-12.10),wing(7.45,1.31,-14.2),wing(5.9,1.19,-14.28),vermilion);
    for(let i=0;i<3;i++) m.box(s*2.40,.21,6.65+i*.44,.16,.18,.22,graphite);
  }
  const tail=[0,1.24,-9.2],peak=[0,6.66,-13.32],top=[0,6.56,-15.9],tip=[0,1.24,-15.1];
  m.quad(tail,peak,top,tip,vermilion); m.quad(tip,top,peak,tail,vermilion);
  for(const s of [-1,1]) {
    const panel=[[s*.04,4.67,-11.96],[s*.04,5.44,-12.58],[s*.04,5.36,-15.66],[s*.04,4.53,-15.54]];
    m.quad(...(s>0?panel:[...panel].reverse()),ivory);
  }
  m.tube([.2,2.08,-6],[.4,3.3,-7],.065,graphite,5);
  m.frustum([0,.16,9.62],[0,.16,10.55],.83,.03,ivory,12,true);
  const gear=new Mesh();
  for(const side of [-1,1]){
    gear.tube([side*1.15,-.82,.18],[side*2.25,-2.45,.68],.18,metal);
    gear.tube([side*1.59,-.9,3],[side*2.25,-2.45,.68],.11,graphite);
    wheel(gear,side*2.25,-2.45,.68,.70,.51);
  }
  gear.tube([0,.14,-12.7],[0,-1.72,-13.8],.13,metal);
  wheel(gear,0,-1.72,-13.8,.41,.34);
  const prop=new Mesh();
  for(const s of [-1,1]){
    prop.quad([-.27,.12,9.88],[.29,.15,9.88],[.60+s*.24,s*4.75,9.88],[.10+s*.24,s*4.73,9.88],graphite);
    prop.quad([.60+s*.24,s*4.36,9.883],[.60+s*.24,s*4.75,9.883],[.10+s*.24,s*4.73,9.883],[.10+s*.24,s*4.36,9.883],ivory);
  }
  return {body:m.upload(gl),gear:gear.upload(gl),prop:prop.upload(gl)};
}

function wheel(mesh,x,y,z,r,width){
  const rim=(t,side,s)=>[x+width*side,y+Math.cos(t)*r*s,z+Math.sin(t)*r*s];
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6,b=(i+1)*Math.PI/6;
    mesh.quad(rim(b,-1,1),rim(a,-1,1),rim(a,1,1),rim(b,1,1),graphite);
    for(const s of [-1,1]) mesh.tri([x+width*s,y,z],rim(a,s,1),rim(b,s,1),mul(graphite,1.18));
  }
}
