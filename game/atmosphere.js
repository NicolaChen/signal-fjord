const air = `
precision highp float;
uniform float uTime;
const vec3 sun = normalize(vec3(.335,.292,.895));
const vec3 warm = vec3(1.,.79,.58);
float hash21(vec2 p) {
  vec3 p3=fract(vec3(p.xyx)*.1031);
  p3+=dot(p3,p3.yzx+33.33);
  return fract((p3.x+p3.y)*p3.z);
}
float noise21(vec2 p){
  vec2 i=floor(p),f=fract(p);
  f=f*f*(3.-2.*f);
  return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),
             mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);
}
float billow(vec2 p) {
  return noise21(p)*.53 + noise21(p*2.14+7.1)*.26
          + noise21(p*4.37-12.)*.14 + noise21(p*8.1+14.1)*.07;
}
vec3 openSky(vec3 ray){
  float k=max(ray.y,0.);
  vec3 col=mix(vec3(.94,.68,.57),vec3(.24,.52,.69),smoothstep(-.07,.68,ray.y));
  col=mix(col,vec3(.13,.32,.47),smoothstep(.42,1.,k));
  float light=max(0.,dot(ray,sun));
  col+=vec3(.23,.133,.053)*pow(light,18.);
  col+=vec3(.26,.14,.06)*pow(light,112.);
  return col;
}
vec3 valleyHaze(vec3 ray){
  return mix(vec3(.60,.65,.70),vec3(.94,.70,.53),pow(max(0.,dot(ray,sun)),5.));
}`;

export const skyVertex = `#version 300 es
layout(location=0) in vec2 point;
out vec2 screen;
void main(){screen=point;gl_Position=vec4(point,0.,1.);}`;

export const skyFragment = `#version 300 es
${air}
in vec2 screen;
out vec4 pixel;
uniform vec3 uRight,uUp,uFront;
uniform float uAspect,uFocal;
void main(){
  vec3 ray=normalize(uFront + uRight * screen.x*uAspect/uFocal + uUp*screen.y/uFocal);
  vec3 col=openSky(ray);
  float light=max(dot(ray,sun),0.);
  float disc=smoothstep(.99928,.99948,light);
  col=mix(col,vec3(1.,.97,.79),disc);
  if(ray.y>.014){
    vec2 uv=ray.xz/(ray.y+.10);
    uv=uv*vec2(2.45,3.70)+vec2(5.4,-2.5)+vec2(uTime*.004,0.);
    float shape=billow(uv);
    float edge=smoothstep(.502,.62,shape)*smoothstep(.014,.15,ray.y);
    float relief=billow(uv+vec2(.095,-.075))-shape;
    vec3 cloud=mix(vec3(.61,.61,.69),vec3(.99,.84,.70),clamp(.43+relief*8.+.42*pow(light,8.),0.,1.));
    col=mix(col,cloud,edge*.83);
    float high=smoothstep(.61,.76,billow(uv*vec2(.84,2.1)+vec2(10.8,8.6)));
    col=mix(col,vec3(.94,.82,.75),high*.26*smoothstep(.08,.23,ray.y));
  }
  col+=.011*(1.-smoothstep(.18,1.,length(screen*vec2(.68,.62))));
  col+=(hash21(gl_FragCoord.xy)-.5)*.009;
  pixel=vec4(col,1.);
}`;

export const sceneVertex = `#version 300 es
precision highp float;
layout(location=0) in vec3 point;
layout(location=1) in vec3 normal;
layout(location=2) in vec3 color;
uniform vec3 uCamera,uRight,uUp,uFront,uOrigin;
uniform mat3 uRotation;
uniform float uScale,uAspect,uFocal;
out vec3 vWorld,vNormal,vColor;
void main(){
  vWorld=uOrigin+uRotation*(uScale*point);
  vNormal=uRotation*normal;
  vColor=color;
  vec3 r=vWorld-uCamera;
  float z=dot(r,uFront);
  gl_Position=vec4(dot(r,uRight)*uFocal/uAspect,dot(r,uUp)*uFocal,1.00019*z-2.00019,z);
}`;

export const sceneFragment = `#version 300 es
${air}
uniform vec3 uCamera,uTint;
uniform float uEmission,uAlpha;
uniform int uMaterial;
in vec3 vWorld,vNormal,vColor;
out vec4 pixel;

vec3 mountains(vec3 p,vec3 n) {
  float bumps=noise21(p.xz*.015)*.56+noise21(p.xz*.056)*.26+vColor.y*.18;
  float folds=noise21(vec2(p.x*.010+p.y*.005,p.z*.013))*vColor.x;
  float slope=1.-n.y;
  float exposed=smoothstep(.21,.60,slope+folds*.20)+smoothstep(350.,950.,p.y)*.32;
  vec3 weed=mix(vec3(.19,.37,.35),vec3(.47,.55,.38),bumps);
  vec3 pine=mix(vec3(.12,.29,.27),vec3(.30,.43,.34),bumps);
  vec3 grass=mix(weed,pine,smoothstep(85.,200.,p.y)*(1.-smoothstep(320.,620.,p.y)));
  vec3 slate=mix(vec3(.28,.31,.36),vec3(.58,.49,.42),clamp(bumps+vColor.x*.29,0.,1.));
  float strat=sin(p.y*.058+p.z*.011+vColor.z*8.+bumps*4.);
  float grain=noise21(vec2(p.x*.048+p.y*.019,p.z*.043));
  slate *= .82+.065*strat+folds*.35+grain*.15;
  vec3 base=mix(grass,slate,clamp(exposed,0.,1.));
  float snow=smoothstep(632.,1010.,p.y-vColor.x*158.-slope*230.+bumps*155.);
  base=mix(base,mix(vec3(.62,.72,.80),vec3(.99,.92,.80),bumps),snow);
  float sand=(1.-smoothstep(3.2,17.,p.y))*(.78+.22*bumps);
  base=mix(base,mix(vec3(.36,.40,.37),vec3(.72,.64,.47),bumps),sand);
  float light=.69+.39*dot(n,sun) + .15*max(0.,dot(n,normalize(vec3(-.8,.55,-.4))));
  return base*light*(vec3(.88,.97,1.05)+warm*.17*max(0.,dot(n,sun)));
}

vec3 tide(vec3 p, vec3 ray) {
  vec2 q=p.xz;
  float d=distance(p,uCamera), detailWeight=1.-smoothstep(450.,4000.,d);
  float drift=noise21(q*vec2(.013,.016)), chop=noise21(q*vec2(.035,.025)+vec2(5.2,13.));
  float w1=sin(dot(q,vec2(.036,.045))+uTime*1.72+drift*5.8);
  float w2=sin(dot(q,vec2(-.095,.032))-uTime*1.24+chop*4.9);
  float w3=sin(dot(q,vec2(.219,.165))+uTime*2.94+drift*4.1);
  vec3 n=normalize(vec3(.052*w1+.029*w2+.022*w3*detailWeight,1.,.067*w1-.018*w2+.035*w3*detailWeight));
  float fresnel=pow(1.-max(0.,dot(n,-ray)),3.);
  vec3 reflectRay=reflect(ray,n);
  vec3 top=openSky(reflectRay);
  float glint=pow(max(0.,dot(reflectRay,sun)),42.);
  float edge=smoothstep(-41.,-1.,vColor.x);
  float sediment=noise21(q*.018+vec2(13.,1.))*.43+noise21(q*.037)*.28;
  vec3 deep=mix(vec3(.047,.275,.36),vec3(.088,.53,.49),edge*.8+sediment*.16);
  vec3 col=mix(deep,top,.42*fresnel+.11)+vec3(.89,.47,.19)*glint*.35;
  float shore=1.-smoothstep(1.2,5.5,abs(vColor.x+2.+sin(w2-w1)*1.6));
  float ripple=(.19*w1+.30*w2+.19*w3)*.045*detailWeight*chop;
  col+=ripple;
  return mix(col,vec3(.62,.76,.68),shore*(.43+.36*sediment));
}

void main(){
  vec3 ray=normalize(vWorld-uCamera);
  vec3 n=normalize(vNormal);
  float d=distance(vWorld,uCamera);
  vec3 c;
  if(uMaterial==1) c=mountains(vWorld,n);
  else if(uMaterial==2) c=tide(vWorld,ray);
  else {
    float lum=.67+.27*dot(n,sun)+.21*max(0.,dot(n,normalize(vec3(-.24,.71,-.63))));
    c=mix(vColor*uTint*lum,vColor*uTint,uEmission);
  }
  float height=clamp(vWorld.y,0.,1600.);
  float fog=1.-exp(-d*(.000146-.000059*smoothstep(0.,1050.,height)));
  c=mix(c,valleyHaze(ray),min(.91,fog));
  c+=(hash21(gl_FragCoord.xy)-.5)*.007;
  pixel=vec4(c,uAlpha);
}`;
