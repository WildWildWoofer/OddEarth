import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const canvas=document.querySelector('#world');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;

const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0x050908,.075);
const camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.1,100);
camera.position.set(0,.1,8);

const C={
  bone:0xd8d1c5,moss:0x7fa28f,brass:0xb09662,blood:0x8c5049,
  ice:0x8da9a4,blue:0x6d8d91,dim:0x47564f,white:0xeee9df
};
const reduced=innerWidth<760;
const density=reduced?.48:1;
const groups={};
let pointerX=0,pointerY=0,activeName='origin';
const mats=[];
const animators=[];

function rnd(a,b){return a+Math.random()*(b-a)}
function gaussian(){let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
function addPoints(group,positions,color=C.bone,size=.018,opacity=.75){
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  const mat=new THREE.PointsMaterial({color,size,transparent:true,opacity,depthWrite:false,blending:THREE.NormalBlending,sizeAttenuation:true});
  mat.userData.baseOpacity=opacity;mats.push(mat);
  const p=new THREE.Points(geo,mat);group.add(p);return p;
}
function addLine(group,positions,color=C.moss,opacity=.25){
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  const mat=new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false});
  mat.userData.baseOpacity=opacity;mats.push(mat);
  const l=new THREE.Line(geo,mat);group.add(l);return l;
}
function ellipsoid(cx,cy,cz,rx,ry,rz,n,shell=.18){
  const a=[];n=Math.floor(n*density);
  for(let i=0;i<n;i++){
    const th=Math.acos(rnd(-1,1)),ph=rnd(0,Math.PI*2);
    const r=1-shell*Math.random();
    a.push(cx+rx*r*Math.sin(th)*Math.cos(ph)+gaussian()*.005,
           cy+ry*r*Math.cos(th)+gaussian()*.005,
           cz+rz*r*Math.sin(th)*Math.sin(ph)+gaussian()*.005);
  }return a
}
function tube(ax,ay,az,bx,by,bz,r,n){
  const a=[];n=Math.floor(n*density);
  const A=new THREE.Vector3(ax,ay,az),B=new THREE.Vector3(bx,by,bz),dir=B.clone().sub(A),len=dir.length(),z=new THREE.Vector3(0,0,1);
  const q=new THREE.Quaternion().setFromUnitVectors(z,dir.clone().normalize());
  for(let i=0;i<n;i++){
    const t=Math.random(),ang=rnd(0,Math.PI*2),rr=r*(.35+.65*Math.random());
    const p=new THREE.Vector3(Math.cos(ang)*rr,Math.sin(ang)*rr,t*len).applyQuaternion(q).add(A);
    a.push(p.x,p.y,p.z);
  }return a
}
function triangle(a,b,c,n,depth=.03){
  const out=[];n=Math.floor(n*density);
  for(let i=0;i<n;i++){
    let u=Math.random(),v=Math.random();if(u+v>1){u=1-u;v=1-v}
    out.push(a[0]+u*(b[0]-a[0])+v*(c[0]-a[0])+gaussian()*depth,
             a[1]+u*(b[1]-a[1])+v*(c[1]-a[1])+gaussian()*depth,
             a[2]+u*(b[2]-a[2])+v*(c[2]-a[2])+gaussian()*depth);
  }return out
}
function ringPts(cx,cy,cz,rx,ry,rot=0,n=100){
  const out=[];for(let i=0;i<=n;i++){const a=i/n*Math.PI*2,x=rx*Math.cos(a),y=ry*Math.sin(a);out.push(cx+x*Math.cos(rot),cy+y,cz+x*Math.sin(rot))}return out
}
function fieldRings(group,cx,cy,cz,color,count=5,axis='z',opacity=.12){
  for(let j=0;j<count;j++){
    const r=.55+j*.28,pts=[];for(let i=0;i<=120;i++){const a=i/120*Math.PI*2;
      let x=cx,y=cy,z=cz;
      if(axis==='z'){x+=Math.cos(a)*r;y+=Math.sin(a)*r*.55;z+=Math.sin(a*2)*.07}
      else if(axis==='x'){z+=Math.cos(a)*r;y+=Math.sin(a)*r*.55;x+=Math.sin(a*2)*.07}
      else{x+=Math.cos(a)*r;z+=Math.sin(a)*r*.7;y+=Math.sin(a*2)*.06}
      pts.push(x,y,z)}
    const line=addLine(group,pts,color,opacity*(1-j/(count+2)));line.userData.phase=j*.7;animators.push({type:'ring',obj:line,speed:.05+j*.006});
  }
}
function human(group,x=0,color=C.bone,opacity=.72){
  addPoints(group,ellipsoid(x,1.48,0,.29,.34,.27,520),color,.018,opacity);
  addPoints(group,ellipsoid(x,.62,0,.53,.9,.27,1250),color,.017,opacity);
  addPoints(group,tube(x-.38,1.05,0,x-.86,.14,.02,.11,650),color,.016,opacity*.9);
  addPoints(group,tube(x+.38,1.05,0,x+.86,.14,.02,.11,650),color,.016,opacity*.9);
  addPoints(group,tube(x-.25,-.03,0,x-.32,-1.38,0,.14,800),color,.016,opacity*.9);
  addPoints(group,tube(x+.25,-.03,0,x+.32,-1.38,0,.14,800),color,.016,opacity*.9);
  addPoints(group,ellipsoid(x-.87,.08,.02,.13,.16,.08,150),color,.015,opacity*.78);
  addPoints(group,ellipsoid(x+.87,.08,.02,.13,.16,.08,150),color,.015,opacity*.78);
}
function eagle(group,x=1.25){
  addPoints(group,ellipsoid(x,.35,0,.42,.7,.27,850),C.brass,.018,.82);
  addPoints(group,ellipsoid(x,.95,.02,.24,.28,.22,320),C.bone,.017,.76);
  addPoints(group,triangle([x+.12,1.02,0],[x+.5,.92,.01],[x+.18,.82,.02],220,.012),C.brass,.014,.72);
  addPoints(group,triangle([x-.2,.63,.05],[x-1.45,.72,.28],[x-.48,-.05,.05],1250,.024),C.moss,.016,.72);
  addPoints(group,triangle([x+.2,.63,.05],[x+1.45,.72,.28],[x+.48,-.05,.05],1250,.024),C.moss,.016,.72);
  addPoints(group,triangle([x-.18,-.15,0],[x-.38,-.86,.05],[x,.0,.02],340,.02),C.dim,.015,.65);
  addPoints(group,triangle([x+.18,-.15,0],[x+.38,-.86,.05],[x,.0,.02],340,.02),C.dim,.015,.65);
  for(let i=-3;i<=3;i++)addLine(group,[x-.02,1.0,.18,x+2.1,1+i*.055,.4+i*.03],C.brass,.12);
}
function bat(group,x=1.2){
  addPoints(group,ellipsoid(x,.25,0,.28,.62,.2,650),C.bone,.017,.8);
  addPoints(group,ellipsoid(x,.88,0,.2,.22,.18,260),C.bone,.016,.78);
  addPoints(group,triangle([x-.15,.72,0],[x-1.55,.9,.15],[x-.55,-.48,.05],1500,.02),C.moss,.015,.7);
  addPoints(group,triangle([x+.15,.72,0],[x+1.55,.9,.15],[x+.55,-.48,.05],1500,.02),C.moss,.015,.7);
  addPoints(group,triangle([x-.12,1.02,0],[x-.38,1.35,.02],[x-.03,1.16,.02],180,.01),C.brass,.014,.72);
  addPoints(group,triangle([x+.12,1.02,0],[x+.38,1.35,.02],[x+.03,1.16,.02],180,.01),C.brass,.014,.72);
  for(let i=0;i<7;i++){const r=.42+i*.26;const l=addLine(group,ringPts(x,.76,.15,r,r*.43,-.04,120),C.moss,.18-i*.018);l.scale.x=1.25;animators.push({type:'pulse',obj:l,phase:i*.7})}
}
function dog(group,x=1.2){
  addPoints(group,ellipsoid(x,.2,0,.78,.5,.34,1100),C.moss,.017,.76);
  addPoints(group,ellipsoid(x+.62,.72,.0,.4,.38,.3,520),C.bone,.017,.8);
  addPoints(group,ellipsoid(x+.98,.63,.02,.35,.2,.22,300),C.brass,.015,.72);
  addPoints(group,triangle([x+.45,.94,0],[x+.42,1.38,.03],[x+.7,1.02,.05],230,.015),C.dim,.014,.72);
  addPoints(group,triangle([x+.73,.94,0],[x+.82,1.36,.02],[x+.96,.92,.04],230,.015),C.dim,.014,.72);
  for(const lx of [x-.48,x-.12,x+.35,x+.58])addPoints(group,tube(lx,.0,0,lx-.05,-.88,.02,.09,360),C.moss,.015,.66);
  addPoints(group,tube(x-.68,.38,0,x-1.15,.86,.05,.08,220),C.moss,.014,.6);
  const plume=[];for(let i=0;i<Math.floor(1700*density);i++){const t=Math.random(),ang=rnd(0,Math.PI*2),rr=(.08+.65*t)*Math.random();plume.push(x+1.25+t*2.4,.65+Math.sin(t*11+ang)*rr*.28,rr*Math.cos(ang))}const p=addPoints(group,plume,C.brass,.011,.26);animators.push({type:'plume',obj:p});
}
function mole(group,x=1.15){
  addPoints(group,ellipsoid(x,.1,0,.78,.42,.31,1050),C.dim,.017,.8);
  addPoints(group,ellipsoid(x+.66,.3,0,.35,.3,.27,480),C.bone,.016,.75);
  for(let i=0;i<22;i++){const a=i/22*Math.PI*2,oy=.3+Math.sin(a)*.09,oz=Math.cos(a)*.11;addPoints(group,tube(x+.92,oy,oz,x+1.32,.3+Math.sin(a)*.38,Math.cos(a)*.4,.018,115),C.brass,.012,.82)}
  for(const lx of [x-.38,x+.3])addPoints(group,tube(lx,.0,0,lx-.15,-.52,.18,.08,250),C.dim,.014,.65);
  for(let z=-5;z<=5;z++){const y=-.92+z*.11;addLine(group,[-2.2,y,-.55,2.4,y+.06*Math.sin(z),-.55],C.moss,.08)}
  const topo=[];for(let i=0;i<Math.floor(1000*density);i++){const px=rnd(-2.2,2.4),pz=rnd(-.55,.8),py=-.92+.035*Math.sin(px*9)+.022*Math.cos(pz*12);topo.push(px,py,pz)}addPoints(group,topo,C.moss,.009,.24);
}
function shark(group,x=1.25){
  addPoints(group,ellipsoid(x,.18,0,1.18,.42,.48,1450),C.blue,.018,.77);
  addPoints(group,triangle([x-.95,.15,0],[x-1.65,.84,.04],[x-1.52,.12,0],540,.02),C.blue,.016,.7);
  addPoints(group,triangle([x-.95,.12,0],[x-1.68,-.48,.04],[x-1.5,.12,0],540,.02),C.blue,.016,.7);
  addPoints(group,triangle([x,.34,0],[x-.2,1.05,.02],[x+.35,.36,.02],420,.016),C.bone,.014,.62);
  addPoints(group,triangle([x+.08,.08,.25],[x+.36,-.6,.7],[x+.55,.12,.28],370,.018),C.blue,.014,.64);
  fieldRings(group,x,.18,0,C.moss,8,'x',.12);
}
function bird(group,x=1.2){
  addPoints(group,ellipsoid(x,.28,0,.36,.55,.24,620),C.brass,.017,.78);
  addPoints(group,ellipsoid(x+.28,.75,0,.2,.23,.18,250),C.bone,.016,.74);
  addPoints(group,triangle([x-.05,.55,.04],[x-1.15,.9,.12],[x-.5,.05,.03],880,.018),C.moss,.015,.7);
  addPoints(group,triangle([x+.12,.5,.04],[x+1.2,.76,.12],[x+.55,-.02,.03],880,.018),C.moss,.015,.7);
  addPoints(group,triangle([x+.42,.77,0],[x+.75,.72,.01],[x+.45,.66,.01],150,.008),C.brass,.013,.78);
  for(let j=0;j<9;j++){const r=.7+j*.24;const l=addLine(group,ringPts(.15,.08,0,r,r*.56,.3+j*.04,150),j%2?C.brass:C.moss,.075);l.rotation.x=.6;animators.push({type:'field',obj:l,phase:j*.55})}
}
function sensoryHuman(group){
  human(group,0,C.bone,.86);
  fieldRings(group,0,.68,0,C.moss,5,'z',.10);
  fieldRings(group,0,.72,0,C.brass,4,'x',.08);
  for(let i=0;i<7;i++){const y=1.48+i*.025;addLine(group,[0,y,.1,2.5,y+.15*(i-3),.6],C.brass,.08)}
  const pulse=[];for(let i=0;i<=160;i++){const t=i/160,x=-1.1+t*2.2,y=.42+.08*Math.sin(t*Math.PI*14)*(1-.4*Math.sin(t*Math.PI*2));pulse.push(x,y,.35)}addLine(group,pulse,C.blood,.35);
}
function innerHuman(group){
  human(group,0,C.dim,.36);
  addPoints(group,ellipsoid(0,.66,.16,.18,.24,.11,460),C.blood,.022,.9);
  addPoints(group,ellipsoid(0,.06,.1,.3,.24,.13,500),C.brass,.018,.65);
  fieldRings(group,0,.65,.1,C.blood,5,'z',.15);
  fieldRings(group,0,.08,.08,C.brass,4,'z',.10);
  const breath=[];for(let i=0;i<=180;i++){const t=i/180*Math.PI*5;breath.push(-1.5+i/180*3,-.48+Math.sin(t)*.11,.25)}addLine(group,breath,C.moss,.3);
}

function make(name,builder){
  const g=new THREE.Group();builder(g);g.visible=true;g.userData.name=name;scene.add(g);groups[name]=g;
  g.traverse(o=>{if(o.material)o.material.opacity=0});return g
}
make('origin',g=>{human(g,0,C.bone,.86);fieldRings(g,0,.48,0,C.moss,7,'y',.08)});
make('thesis',g=>{human(g,0,C.bone,.73);fieldRings(g,0,.55,0,C.brass,10,'y',.06)});
make('eagle',g=>{human(g,-1.18,C.bone,.65);eagle(g,1.15);fieldRings(g,1.15,.72,.2,C.brass,3,'z',.05)});
make('bat',g=>{human(g,-1.2,C.bone,.62);bat(g,1.15)});
make('dog',g=>{human(g,-1.2,C.bone,.62);dog(g,1.05)});
make('mole',g=>{human(g,-1.25,C.bone,.6);mole(g,1.0)});
make('shark',g=>{human(g,-1.25,C.bone,.56);shark(g,1.1)});
make('bird',g=>{human(g,-1.2,C.bone,.6);bird(g,1.0)});
make('inner',g=>innerHuman(g));
make('human',g=>sensoryHuman(g));
make('final',g=>{sensoryHuman(g);fieldRings(g,0,.55,0,C.brass,9,'y',.055)});

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
const chapters=[...document.querySelectorAll('.chapter')];

function sectionState(){
  const mid=innerHeight*.52;
  let best=null,bestD=Infinity,progress=.5;
  for(const el of chapters){
    const r=el.getBoundingClientRect(),c=r.top+r.height/2,d=Math.abs(c-mid);
    if(d<bestD){bestD=d;best=el;progress=THREE.MathUtils.clamp((mid-r.top)/r.height,0,1)}
  }
  return {name:best?.dataset.scene||'origin',progress};
}
function setMeta(name){
  if(name===activeName)return;activeName=name;
  const m=meta[name]||meta.origin;
  document.querySelector('#stageLabel').textContent=m[0];
  document.querySelector('#fieldReadout').textContent=m[1];
  document.querySelector('#principleReadout').textContent=m[2];
}
function opacityOf(name){
  const el=chapters.find(x=>x.dataset.scene===name);if(!el)return 0;
  const r=el.getBoundingClientRect(),mid=innerHeight*.52,d=Math.abs((r.top+r.height/2)-mid);
  return THREE.MathUtils.smoothstep(1-THREE.MathUtils.clamp(d/(innerHeight*.88),0,1),0,1);
}
function setOpacity(group,o){
  group.visible=o>.008;
  group.traverse(obj=>{if(obj.material&&obj.material.userData.baseOpacity!=null)obj.material.opacity=obj.material.userData.baseOpacity*o});
}
function animate(t){
  requestAnimationFrame(animate);
  const ss=sectionState();setMeta(ss.name);
  for(const [name,g] of Object.entries(groups)){
    const o=opacityOf(name);setOpacity(g,o);
    if(o>.01){g.rotation.y+=(Math.sin(t*.00012+Object.keys(groups).indexOf(name))*.00018);g.position.y=.05*Math.sin(t*.00022)}
  }
  const idx=Math.max(0,chapters.findIndex(x=>x.dataset.scene===ss.name));
  const orbit=idx*.54+(ss.progress-.5)*.95;
  const targetX=Math.sin(orbit)*1.25+pointerX*.2,targetZ=7.15+Math.cos(orbit)*.55;
  camera.position.x+=(targetX-camera.position.x)*.025;
  camera.position.y+=(.1+pointerY*.12-camera.position.y)*.025;
  camera.position.z+=(targetZ-camera.position.z)*.025;
  camera.lookAt(0,.1,0);
  for(const a of animators){
    if(a.type==='ring')a.obj.rotation.y=t*.00005*a.speed*8+a.obj.userData.phase;
    if(a.type==='pulse'){const s=1+.025*Math.sin(t*.002+a.phase);a.obj.scale.setScalar(s)}
    if(a.type==='plume')a.obj.rotation.x=.03*Math.sin(t*.00035);
    if(a.type==='field')a.obj.rotation.z=.05*Math.sin(t*.00028+a.phase);
  }
  renderer.render(scene,camera);
}
addEventListener('pointermove',e=>{pointerX=(e.clientX/innerWidth-.5)*2;pointerY=(e.clientY/innerHeight-.5)*-2});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.75))});
animate(0);
