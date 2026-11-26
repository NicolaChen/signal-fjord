import {add,sub,mul,cross,dot,unit} from './geometry.js';
import {terrainHeight, lerp} from './world.js';

export class ChaseCamera {
  constructor() { this.focal=1.69; this.pos=null; this.side=0; this.forward=null; }
  follow(flight,dt) {
    const {x,y,z,heading,roll,pitch}=flight;
    const far=flight.ground?47:59;
    const target=[x-Math.sin(heading)*far,y+15.5+Math.max(0,-pitch)*15,z-Math.cos(heading)*far];
    target[1]=Math.max(target[1],Math.max(0,terrainHeight(target[0],target[2]))+8);
    const ease=1-Math.exp(-6.5*dt), orient=1-Math.exp(-5*dt);
    // Follow a point ahead, not the aircraft's banking wings.
    const look=unit([Math.sin(heading),-.028+pitch*.32,Math.cos(heading)]);
    this.forward=this.forward?unit(add(mul(this.forward,1-orient),mul(look,orient))):look;
    this.pos=this.pos?this.pos.map((v,i)=>lerp(v,target[i],ease)):target;
    this.side=lerp(this.side,roll*.27,orient);
    const right=unit(cross([0,1,0],this.forward)), up=cross(this.forward,right);
    this.right=add(mul(right,Math.cos(this.side)),mul(up,Math.sin(this.side)));
    this.up=cross(this.forward,this.right);
  }

  project(point,w,h) {
    const u=sub(point,this.pos), z=dot(u,this.forward);
    return {x:w*.5+dot(u,this.right)*this.focal*h*.5/z, y:h*.5-dot(u,this.up)*this.focal*h*.5/z, visible:z>1};
  }
}
