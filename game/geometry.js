export const add = (a,b) => [a[0]+b[0],a[1]+b[1],a[2]+b[2]];
export const sub = (a,b) => [a[0]-b[0],a[1]-b[1],a[2]-b[2]];
export const mul = (a,s) => [a[0]*s,a[1]*s,a[2]*s];
export const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const unit = a => mul(a,1/(Math.hypot(...a)||1));

export const rgb = hex => {
  const n=Number.parseInt(hex.replace('#',''),16);
  return [(n>>16)/255,((n>>8)&255)/255,(n&255)/255];
};

export class Mesh {
  constructor() { this.data=[]; }
  vertex(p,n,c) { this.data.push(...p,...n,...c); }
  tri(a,b,c,color) {
    const n=unit(cross(sub(b,a),sub(c,a)));
    for(const p of [a,b,c]) this.vertex(p,n,color);
  }
  quad(a,b,c,d,color) { this.tri(a,b,c,color); this.tri(a,c,d,color); }
  box(x,y,z,w,h,d,c) {
    const a=[x-w/2,y,z-d/2],b=[x+w/2,y,z-d/2],e=[x-w/2,y,z+d/2],f=[x+w/2,y,z+d/2];
    const u=[0,h,0], A=add(a,u),B=add(b,u),E=add(e,u),F=add(f,u);
    this.quad(b,f,e,a,c); this.quad(E,F,B,A,c);
    this.quad(A,B,b,a,c); this.quad(F,E,e,f,c);
    this.quad(E,A,a,e,c); this.quad(B,F,f,b,c);
  }
  frustum(a,b,r0,r1,color,facets=10,xy=false) {
    const point=(o,r,t)=>xy?[o[0]+Math.cos(t)*r,o[1]+Math.sin(t)*r,o[2]]:
      [o[0]+Math.cos(t)*r,o[1],o[2]+Math.sin(t)*r];
    for(let i=0;i<facets;i++){
      const t=i*Math.PI*2/facets, u=(i+1)*Math.PI*2/facets;
      const p=point(a,r0,t),q=point(a,r0,u),r=point(b,r1,u),s=point(b,r1,t);
      if(xy) this.quad(p,q,r,s,color);
      else this.quad(s,r,q,p,color);
    }
  }
  tube(a,b,r,color,facets=8) {
    const axis=unit(sub(b,a)), ref=Math.abs(axis[1])>.92?[1,0,0]:[0,1,0];
    const u=unit(cross(axis,ref)),v=cross(axis,u);
    const offset=(t)=>add(mul(u,Math.cos(t)*r),mul(v,Math.sin(t)*r));
    for(let i=0;i<facets;i++){
      const lo=offset(i*2*Math.PI/facets),hi=offset((i+1)*2*Math.PI/facets);
      this.quad(add(a,lo),add(a,hi),add(b,hi),add(b,lo),color);
    }
  }
  upload(gl) {
    const buffer=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(this.data),gl.STATIC_DRAW);
    const count=this.data.length/9;
    this.data.length=0;
    return {buffer,count};
  }
}

export const identity = new Float32Array([1,0,0,0,1,0,0,0,1]);

export function attitude(yaw,pitch,roll) {
  const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),cr=Math.cos(roll),sr=Math.sin(roll);
  const east=[cy,0,-sy], forward=[sy*cp,sp,cy*cp], up=cross(forward,east);
  return new Float32Array([...add(mul(east,cr),mul(up,sr)),...add(mul(up,cr),mul(east,-sr)),...forward]);
}
