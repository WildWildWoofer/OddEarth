import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const canvas=document.querySelector('#world');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;

const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0x050908,0.055);
const camera=new THREE.PerspectiveCamera(36,innerWidth/innerHeight,.1,100);
camera.position.set(0,.08,7.6);

const MOBILE=innerWidth<760;
const D=MOBILE?.52:1;
const TAU=Math.PI*2;
const C={
  bone:new THREE.Color('#d9d3c8'),
  warm:new THREE.Color('#bca47a'),
  moss:new THREE.Color('#7fa28f'),
  brass:new THREE.Color('#b59b68'),
  blood:new THREE.Color('#9b5f58'),
  teal:new THREE.Color('#79a8a1'),
  dim:new THREE.Color('#53625b'),
  dark:new THREE.Color('#26332e')
};

const groups={},chapters=[...document.querySelectorAll('.chapter')];
const animators=[];
let activeName='origin',pointerX=0,pointerY=0,time=0;

const vert=`
attribute float aSize;
attribute float aPhase;
attribute float aGlow;
uniform float uTime;
uniform float uOpacity;
uniform float uMotion;
varying float vAlpha;
varying float vGlow;
void main(){
  vec3 p=position;
  float breathe=sin(uTime*.72+aPhase)*uMotion;
  p.y += breathe*.008;
  p.x += sin(uTime*.31+aPhase*1.7)*uMotion*.003;
  vec4 mv=modelViewMatrix*vec4(p,1.0);
  gl_PointSize=max(1.0,aSize*(205.0/-mv.z));
  gl_Position=projectionMatrix*mv;
  vAlpha=uOpacity;
  vGlow=aGlow;
}`;
const frag=`
uniform vec3 uColor;
varying float vAlpha;
varying float vGlow;
void main(){
  vec2 uv=gl_PointCoord-.5;
  float r=length(uv);
  if(r>.5)discard;
  float core=smoothstep(.5,.06,r);
  float halo=smoothstep(.5,.22,r)*.32;
  float a=(core+halo)*vAlpha*(.68+.32*vGlow);
  vec3 col=uColor*(.76+.45*core+.18*vGlow);
  gl_FragColor=vec4(col,a);
}`;

function particleMaterial(color,opacity=.8,motion=.15){
  const m=new THREE.ShaderMaterial({
    uniforms:{
      uColor:{value:color.clone()},
      uTime:{value:0},
      uOpacity:{value:opacity},
      uMotion:{value:motion}
    },
    vertexShader:vert,fragmentShader:frag,transparent:true,depthWrite:false,
    blending:THREE.AdditiveBlending
  });
  m.userData.baseOpacity=opacity;
  return m;
}
function cloud(group,pos,color=C.bone,size=5.3,opacity=.78,motion=.12){
  const n=pos.length/3,sizes=new Float32Array(n),phase=new Float32Array(n),glow=new Float32Array(n);
  for(let i=0;i<n;i++){sizes[i]=size*(.58+Math.random()*.72);phase[i]=Math.random()*TAU;glow[i]=Math.random()}
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));
  g.setAttribute('aPhase',new THREE.BufferAttribute(phase,1));
  g.setAttribute('aGlow',new THREE.BufferAttribute(glow,1));
  const p=new THREE.Points(g,particleMaterial(color,opacity,motion));
  group.add(p);return p;
}
function line(group,pts,color=C.moss,opacity=.22){
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
  const m=new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending});
  m.userData.baseOpacity=opacity;
  const l=new THREE.Line(g,m);group.add(l);return l;
}
const rnd=(a,b)=>a+Math.random()*(b-a);
function gauss(){let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(TAU*v)}
function push(a,p){a.push(p.x,p.y,p.z)}
function ellipsoidSurface(cx,cy,cz,rx,ry,rz,n,j=.015,bias=1){
  const out=[];n=Math.floor(n*D);
  for(let i=0;i<n;i++){
    const u=Math.random(),v=Math.random(),th=Math.acos(1-2*u),ph=TAU*v;
    const s=Math.pow(.82+.18*Math.random(),bias);
    out.push(cx+rx*s*Math.sin(th)*Math.cos(ph)+gauss()*j,
      cy+ry*s*Math.cos(th)+gauss()*j,
      cz+rz*s*Math.sin(th)*Math.sin(ph)+gauss()*j);
  }return out
}
function taperedTube(a,b,r1,r2,n,j=.006){
  const out=[];n=Math.floor(n*D);
  const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),axis=B.clone().sub(A),len=axis.length(),z=new THREE.Vector3(0,0,1);
  const q=new THREE.Quaternion().setFromUnitVectors(z,axis.clone().normalize());
  for(let i=0;i<n;i++){
    const t=Math.random(),ang=TAU*Math.random(),r=(r1+(r2-r1)*t)*(.88+.12*Math.random());
    const p=new THREE.Vector3(Math.cos(ang)*r,Math.sin(ang)*r,t*len).applyQuaternion(q).add(A);
    p.x+=gauss()*j;p.y+=gauss()*j;p.z+=gauss()*j;push(out,p);
  }return out
}
function taperedTorso(x=0,n=2600){
  const out=[];n=Math.floor(n*D);
  for(let i=0;i<n;i++){
    const y=rnd(.0,1.18),t=y/1.18,ang=rnd(0,TAU);
    const shoulder=.34+.29*Math.exp(-Math.pow((t-.83)/.22,2));
    const waist=.34-.08*Math.exp(-Math.pow((t-.22)/.23,2));
    const hip=.13*Math.exp(-Math.pow((t-.03)/.20,2));
    const rx=(shoulder+waist+hip)*(.92+.08*Math.random());
    const rz=(.24+.055*Math.exp(-Math.pow((t-.65)/.30,2)))*(.9+.1*Math.random());
    out.push(x+Math.cos(ang)*rx+gauss()*.006,y+.02*Math.sin(ang*2)+gauss()*.006,Math.sin(ang)*rz+gauss()*.006);
  }return out
}
function humanAnatomy(group,x=-.55,accent='none'){
  let surf=[];
  surf.push(...ellipsoidSurface(x,1.62,0,.28,.34,.255,900,.008));
  surf.push(...ellipsoidSurface(x,1.40,.025,.22,.17,.20,420,.006));
  surf.push(...taperedTube([x,1.30,0],[x,1.15,0],.12,.16,250));
  surf.push(...taperedTorso(x,3000));
  surf.push(...ellipsoidSurface(x,.0,0,.45,.28,.27,900,.007));
  const shoulderY=1.03;
  surf.push(...taperedTube([x-.46,shoulderY,0],[x-.71,.57,.015],.145,.118,700));
  surf.push(...taperedTube([x-.71,.57,.015],[x-.78,.10,.025],.115,.085,650));
  surf.push(...taperedTube([x+.46,shoulderY,0],[x+.71,.57,.015],.145,.118,700));
  surf.push(...taperedTube([x+.71,.57,.015],[x+.78,.10,.025],.115,.085,650));
  surf.push(...ellipsoidSurface(x-.79,.0,.03,.115,.17,.075,280,.004));
  surf.push(...ellipsoidSurface(x+.79,.0,.03,.115,.17,.075,280,.004));
  surf.push(...taperedTube([x-.24,-.12,0],[x-.30,-.78,.015],.19,.145,900));
  surf.push(...taperedTube([x-.30,-.78,.015],[x-.31,-1.48,.04],.14,.095,900));
  surf.push(...taperedTube([x+.24,-.12,0],[x+.30,-.78,.015],.19,.145,900));
  surf.push(...taperedTube([x+.30,-.78,.015],[x+.31,-1.48,.04],.14,.095,900));
  surf.push(...ellipsoidSurface(x-.31,-1.55,.13,.13,.09,.27,360,.004));
  surf.push(...ellipsoidSurface(x+.31,-1.55,.13,.13,.09,.27,360,.004));
  const body=cloud(group,surf,C.bone,5.7,.80,.16);

  let inner=[];
  inner.push(...ellipsoidSurface(x,.77,.08,.28,.36,.15,700,.004));
  inner.push(...ellipsoidSurface(x,.50,.10,.16,.20,.105,430,.004));
  cloud(group,inner,C.warm,4.1,.24,.10);

  const spine=[];for(let i=0;i<=70;i++){const y=1.25-i/70*1.3;spine.push(x,y,-.16+Math.sin(i*.24)*.008)}
  line(group,spine,C.brass,.13);
  line(group,[x-.47,1.09,.17,x-.15,1.16,.20,x,1.13,.21,x+.15,1.16,.20,x+.47,1.09,.17],C.brass,.16);

  const sensor=[];
  if(accent==='vision')sensor.push(...ellipsoidSurface(x-.095,1.68,.235,.055,.028,.018,120,.002),...ellipsoidSurface(x+.095,1.68,.235,.055,.028,.018,120,.002));
  if(accent==='hearing')sensor.push(...ellipsoidSurface(x-.27,1.63,.03,.035,.085,.045,100,.002),...ellipsoidSurface(x+.27,1.63,.03,.035,.085,.045,100,.002));
  if(accent==='smell')sensor.push(...ellipsoidSurface(x,1.57,.255,.055,.075,.045,120,.002));
  if(accent==='touch')sensor.push(...ellipsoidSurface(x-.79,-.01,.04,.12,.18,.08,180,.002),...ellipsoidSurface(x+.79,-.01,.04,.12,.18,.08,180,.002));
  if(accent==='field')sensor.push(...ellipsoidSurface(x,.55,.24,.30,.50,.03,340,.002));
  if(accent==='inner')sensor.push(...ellipsoidSurface(x,.72,.08,.14,.18,.10,280,.002),...ellipsoidSurface(x,.39,.10,.23,.17,.10,300,.002));
  if(sensor.length)cloud(group,sensor,accent==='inner'?C.blood:C.brass,6.4,.88,.22);
  return body;
}

function wingSheet(a,b,c,n,curve=.12){
  const out=[];n=Math.floor(n*D);
  const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),C0=new THREE.Vector3(...c);
  for(let i=0;i<n;i++){let u=Math.random(),v=Math.random();if(u+v>1){u=1-u;v=1-v}
    const p=A.clone().add(B.clone().sub(A).multiplyScalar(u)).add(C0.clone().sub(A).multiplyScalar(v));
    p.z+=Math.sin(u*Math.PI)*Math.sin(v*Math.PI)*curve+gauss()*.009;push(out,p)}
  return out
}
function eagle(group,x=1.30){
  let s=[];
  s.push(...ellipsoidSurface(x,.40,0,.40,.61,.31,1050,.008));
  s.push(...ellipsoidSurface(x+.04,1.00,.02,.25,.28,.22,520,.006));
  s.push(...ellipsoidSurface(x+.22,.94,.17,.17,.13,.12,250,.004));
  s.push(...wingSheet([x-.18,.75,.02],[x-1.72,.95,.20],[x-.64,-.04,.10],1700,.11));
  s.push(...wingSheet([x+.18,.75,.02],[x+1.72,.95,.20],[x+.64,-.04,.10],1700,.11));
  s.push(...wingSheet([x-.13,-.05,.01],[x-.55,-.75,.08],[x,.0,.0],430,.04));
  s.push(...wingSheet([x+.13,-.05,.01],[x+.55,-.75,.08],[x,.0,.0],430,.04));
  cloud(group,s,C.warm,5.1,.78,.16);
  cloud(group,wingSheet([x+.18,1.02,.15],[x+.56,.95,.17],[x+.23,.85,.17],260,.01),C.brass,4.7,.84,.08);
  for(let j=-3;j<=3;j++)line(group,[x+.22,1.00,.24,x+2.65,1.02+j*.085,.55+j*.035],C.brass,.12);
}
function bat(group,x=1.28){
  let s=[];
  s.push(...ellipsoidSurface(x,.35,0,.24,.52,.20,650,.006));
  s.push(...ellipsoidSurface(x,.94,0,.18,.21,.17,300,.004));
  s.push(...wingSheet([x-.12,.74,.02],[x-1.68,1.02,.18],[x-.54,-.47,.10],1700,.06));
  s.push(...wingSheet([x+.12,.74,.02],[x+1.68,1.02,.18],[x+.54,-.47,.10],1700,.06));
  cloud(group,s,C.moss,4.9,.76,.18);
  cloud(group,wingSheet([x-.09,1.04,.02],[x-.34,1.36,.04],[x-.01,1.17,.04],170,.01).concat(wingSheet([x+.09,1.04,.02],[x+.34,1.36,.04],[x+.01,1.17,.04],170,.01)),C.brass,4.5,.78,.10);
  for(let j=0;j<8;j++){const pts=[],r=.38+j*.24;for(let i=0;i<=130;i++){const a=i/130*TAU;pts.push(x+.10+Math.cos(a)*r,.90+Math.sin(a)*r*.38,.26+Math.sin(a*2)*.04)}const l=line(group,pts,C.teal,.18-j*.015);animators.push({type:'pulse',obj:l,phase:j*.55})}
}
function dog(group,x=1.22){
  let s=[];
  s.push(...ellipsoidSurface(x,.28,0,.76,.48,.35,1200,.008));
  s.push(...ellipsoidSurface(x+.43,.66,0,.29,.40,.29,520,.006));
  s.push(...ellipsoidSurface(x+.76,.82,.0,.34,.31,.27,570,.006));
  s.push(...ellipsoidSurface(x+1.03,.71,.10,.31,.16,.18,360,.004));
  for(const lx of [x-.45,x-.08,x+.42,x+.63])s.push(...taperedTube([lx,.10,0],[lx-.02,-.78,.03],.10,.07,380));
  s.push(...taperedTube([x-.66,.43,0],[x-1.13,.84,.04],.08,.045,260));
  s.push(...wingSheet([x+.58,1.00,.03],[x+.45,1.38,.02],[x+.78,1.08,.08],210,.01));
  s.push(...wingSheet([x+.84,1.01,.03],[x+.96,1.37,.02],[x+1.08,.96,.08],210,.01));
  cloud(group,s,C.warm,5.0,.77,.14);
  const plume=[];for(let i=0;i<Math.floor(1900*D);i++){const t=Math.random(),a=rnd(0,TAU),spread=.05+.68*t*Math.random();plume.push(x+1.24+t*2.45,.72+Math.sin(a)*spread*.30,Math.cos(a)*spread)}const p=cloud(group,plume,C.brass,3.6,.25,.32);animators.push({type:'drift',obj:p,phase:0});
}
function mole(group,x=1.18){
  let s=[];
  s.push(...ellipsoidSurface(x,.14,0,.80,.38,.34,1200,.007));
  s.push(...ellipsoidSurface(x+.66,.28,.02,.34,.29,.26,480,.005));
  s.push(...taperedTube([x-.45,.02,.12],[x-.58,-.42,.22],.09,.06,280));
  s.push(...taperedTube([x+.33,.03,.12],[x+.43,-.44,.25],.09,.06,280));
  cloud(group,s,C.dim,5.0,.80,.13);
  let star=[];for(let i=0;i<22;i++){const a=i/22*TAU;star.push(...taperedTube([x+.92,.30,.03],[x+1.35,.30+Math.sin(a)*.39,Math.cos(a)*.40],.024,.010,115,.002))}cloud(group,star,C.brass,4.5,.87,.18);
  const terrain=[];for(let i=0;i<Math.floor(1400*D);i++){const px=rnd(-2.4,2.5),pz=rnd(-.72,.82),py=-.95+.035*Math.sin(px*10)+.022*Math.cos(pz*13);terrain.push(px,py,pz)}cloud(group,terrain,C.moss,3.0,.20,.04);
}
function shark(group,x=1.18){
  let s=[];
  s.push(...ellipsoidSurface(x,.22,0,1.20,.42,.47,1600,.008));
  s.push(...wingSheet([x-.96,.21,.0],[x-1.66,.88,.02],[x-1.52,.17,.0],500,.03));
  s.push(...wingSheet([x-.96,.16,.0],[x-1.68,-.52,.02],[x-1.52,.17,.0],500,.03));
  s.push(...wingSheet([x,.40,.0],[x-.20,1.04,.02],[x+.35,.42,.02],430,.03));
  s.push(...wingSheet([x+.05,.11,.26],[x+.37,-.58,.71],[x+.57,.15,.27],400,.02));
  cloud(group,s,C.teal,5.1,.78,.12);
  for(let j=0;j<9;j++){const pts=[],r=.62+j*.25;for(let i=0;i<=120;i++){const a=i/120*TAU;pts.push(x+.1+Math.sin(a*2)*.03,.22+Math.sin(a)*r*.55,Math.cos(a)*r)}const l=line(group,pts,j%2?C.moss:C.teal,.12-j*.008);animators.push({type:'field',obj:l,phase:j*.6})}
}
function migratoryBird(group,x=1.20){
  let s=[];
  s.push(...ellipsoidSurface(x,.34,0,.38,.53,.25,650,.006));
  s.push(...ellipsoidSurface(x+.28,.82,0,.19,.23,.17,280,.004));
  s.push(...wingSheet([x-.06,.60,.03],[x-1.35,.98,.13],[x-.49,.02,.06],980,.07));
  s.push(...wingSheet([x+.10,.56,.03],[x+1.35,.91,.13],[x+.53,-.03,.06],980,.07));
  s.push(...wingSheet([x-.05,.05,0],[x-.43,-.62,.02],[x+.13,.10,.01],320,.02));
  cloud(group,s,C.warm,4.8,.77,.16);
  for(let j=0;j<10;j++){const pts=[],r=.72+j*.23;for(let i=0;i<=130;i++){const a=i/130*TAU;pts.push(.1+Math.cos(a)*r,.05+Math.sin(a)*r*.55,Math.sin(a*.5)*.30)}const l=line(group,pts,j%2?C.brass:C.moss,.075);l.rotation.x=.55;animators.push({type:'field',obj:l,phase:j*.45})}
}
function rings(group,cx,cy,cz,color,count=6,axis='z',opacity=.11){
  for(let j=0;j<count;j++){const pts=[],r=.52+j*.26;for(let i=0;i<=120;i++){const a=i/120*TAU;let x=cx,y=cy,z=cz;if(axis==='z'){x+=Math.cos(a)*r;y+=Math.sin(a)*r*.55;z+=Math.sin(a*2)*.06}else if(axis==='x'){z+=Math.cos(a)*r;y+=Math.sin(a)*r*.55;x+=Math.sin(a*2)*.06}else{x+=Math.cos(a)*r;z+=Math.sin(a)*r*.68;y+=Math.sin(a*2)*.05}pts.push(x,y,z)}const l=line(group,pts,color,opacity*(1-j/(count+3)));animators.push({type:'ring',obj:l,phase:j*.45})}
}
function specimen(name,builder){
  const g=new THREE.Group();g.userData.name=name;builder(g);scene.add(g);groups[name]=g;
  g.traverse(o=>{if(o.material?.uniforms?.uOpacity)o.material.uniforms.uOpacity.value=0;else if(o.material){o.material.opacity=0}});
}
specimen('origin',g=>{humanAnatomy(g,0,'none');rings(g,0,.56,0,C.moss,6,'y',.055)});
specimen('thesis',g=>{humanAnatomy(g,0,'none');rings(g,0,.56,0,C.brass,8,'y',.05)});
specimen('eagle',g=>{humanAnatomy(g,-.72,'vision');eagle(g,1.30)});
specimen('bat',g=>{humanAnatomy(g,-.72,'hearing');bat(g,1.25)});
specimen('dog',g=>{humanAnatomy(g,-.72,'smell');dog(g,1.16)});
specimen('mole',g=>{humanAnatomy(g,-.72,'touch');mole(g,1.06)});
specimen('shark',g=>{humanAnatomy(g,-.72,'field');shark(g,1.12)});
specimen('bird',g=>{humanAnatomy(g,-.72,'field');migratoryBird(g,1.13)});
specimen('inner',g=>{humanAnatomy(g,0,'inner');rings(g,0,.69,.08,C.blood,5,'z',.14);rings(g,0,.38,.06,C.moss,4,'x',.09)});
specimen('human',g=>{humanAnatomy(g,0,'inner');rings(g,0,.70,0,C.moss,5,'z',.08);rings(g,0,.72,0,C.brass,5,'x',.065)});
specimen('final',g=>{humanAnatomy(g,0,'inner');rings(g,0,.62,0,C.brass,9,'y',.05)});

const meta={
 origin:['HOMO SAPIENS','BIOLOGICAL INTELLIGENCE','INFORMATION → PERCEPTION'],
 thesis:['GENERALIST / SPECIMEN 00','EVOLUTIONARY SPECIALIZATION','SAME WORLD · DIFFERENT INTERFACE'],
 eagle:['HUMAN ↔ EAGLE','VISION / PHOTONS','ACUITY · CONTRAST · MOTION'],
 bat:['HUMAN ↔ BAT','ACTIVE ACOUSTICS','SOUND → GEOMETRY'],
 dog:['HUMAN ↔ DOG','CHEMICAL SPACE','VOLATILES · GRADIENTS · MIXTURES'],
 mole:['HUMAN ↔ STAR-NOSED MOLE','ACTIVE TOUCH','TOPOGRAPHY · FRICTION · VIBRATION'],
 shark:['HUMAN ↔ SHARK','FIELD SENSING','BIOELECTRIC INFORMATION'],
 bird:['HUMAN ↔ MIGRATORY BIRD','ORIENTATION','FIELD → DIRECTION'],
 inner:['INNER EARTH','INTEROCEPTION','BODY → PERCEPTION'],
 human:['HOMO SAPIENS / REVEALED','CAPABILITY ATLAS','TRAIN · AMPLIFY · TRANSLATE'],
 final:['THE ODD EARTH INSTITUTE','HUMAN CAPACITY','MEASURE → TRAIN → EXTEND']
};

function sectionState(){
  const mid=innerHeight*.52;let best=chapters[0],bestD=Infinity,progress=.5;
  for(const el of chapters){const r=el.getBoundingClientRect(),c=r.top+r.height/2,d=Math.abs(c-mid);if(d<bestD){bestD=d;best=el;progress=THREE.MathUtils.clamp((mid-r.top)/r.height,0,1)}}
  return {name:best.dataset.scene||'origin',progress};
}
function opacityFor(name){
  const el=chapters.find(x=>x.dataset.scene===name);if(!el)return 0;
  const r=el.getBoundingClientRect(),mid=innerHeight*.52,d=Math.abs((r.top+r.height/2)-mid);
  const x=1-THREE.MathUtils.clamp(d/(innerHeight*.78),0,1);
  return THREE.MathUtils.smoothstep(x,0,1);
}
function setGroupOpacity(g,o){
  g.visible=o>.006;
  g.traverse(obj=>{
    const m=obj.material;if(!m)return;
    if(m.uniforms?.uOpacity)m.uniforms.uOpacity.value=m.userData.baseOpacity*o;
    else if(m.userData.baseOpacity!=null)m.opacity=m.userData.baseOpacity*o;
  });
}
function setMeta(name){
  if(name===activeName)return;activeName=name;
  const m=meta[name]||meta.origin;
  document.querySelector('#stageLabel').textContent=m[0];
  document.querySelector('#fieldReadout').textContent=m[1];
  document.querySelector('#principleReadout').textContent=m[2];
}
function tick(ms){
  requestAnimationFrame(tick);time=ms*.001;
  const ss=sectionState();setMeta(ss.name);
  const idx=Math.max(0,chapters.findIndex(x=>x.dataset.scene===ss.name));
  for(const [name,g] of Object.entries(groups)){
    const o=opacityFor(name);setGroupOpacity(g,o);
    if(o>.01){
      g.rotation.y=Math.sin(time*.18+idx*.7)*.055;
      g.rotation.x=Math.sin(time*.11+idx)*.012;
      g.position.y=Math.sin(time*.34)*.012;
      g.traverse(obj=>{if(obj.material?.uniforms?.uTime)obj.material.uniforms.uTime.value=time});
    }
  }

  const baseYaw=(idx*.56+(ss.progress-.5)*1.0);
  const radius=7.15+Math.cos(baseYaw)*.42;
  const tx=Math.sin(baseYaw)*1.15+pointerX*.16;
  const ty=.08+Math.sin(baseYaw*.55)*.10+pointerY*.08;
  camera.position.x+=(tx-camera.position.x)*.028;
  camera.position.y+=(ty-camera.position.y)*.028;
  camera.position.z+=(radius-camera.position.z)*.028;
  camera.lookAt(new THREE.Vector3(.04,.12,0));

  for(const a of animators){
    if(a.type==='pulse'){const s=1+.024*Math.sin(time*2.2+a.phase);a.obj.scale.setScalar(s)}
    if(a.type==='field'||a.type==='ring')a.obj.rotation.z=.045*Math.sin(time*.38+a.phase);
    if(a.type==='drift')a.obj.position.x=.045*Math.sin(time*.22+a.phase);
  }
  renderer.render(scene,camera);
}
addEventListener('pointermove',e=>{pointerX=(e.clientX/innerWidth-.5)*2;pointerY=(e.clientY/innerHeight-.5)*-2});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.7))});
tick(0);