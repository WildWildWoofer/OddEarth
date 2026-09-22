import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';
import { MeshSurfaceSampler } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/math/MeshSurfaceSampler.js';

const canvas=document.querySelector('#world');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=.90;

const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0x030606,.052);
const camera=new THREE.PerspectiveCamera(35,innerWidth/innerHeight,.1,100);
camera.position.set(0,.18,5.15);

const mobile=innerWidth<760;
const N=mobile?15000:34000;
const TAU=Math.PI*2;
const HUMAN_N=Math.floor(N*.36);
const ANIMAL_N=Math.floor(N*.28);
const FIELD_N=Math.floor(N*.18);
const FREE_START=HUMAN_N+ANIMAL_N+FIELD_N;
const chapters=[...document.querySelectorAll('.scene')];

const positions=new Float32Array(N*3);
const velocities=new Float32Array(N*3);
const phases=new Float32Array(N);
const sizes=new Float32Array(N);
const colors=new Float32Array(N*3);
const target=new Float32Array(N*3);
const strength=new Float32Array(N);
const role=new Uint8Array(N);

const PALETTE={
  human:new THREE.Color('#c4c1b8'),
  humanFeature:new THREE.Color('#d3cdc0'),
  animal:new THREE.Color('#a39073'),
  field:new THREE.Color('#788f85'),
  brass:new THREE.Color('#a38758'),
  teal:new THREE.Color('#6d918b'),
  blood:new THREE.Color('#89534e'),
  free:new THREE.Color('#53605a')
};

const ASSETS={
  human:'https://cdn.jsdelivr.net/gh/ibrews/VitruvianGodot@bdecdcd537b4031fdd0fb299b7e4f93f084fffa0/godot_project/vitruvian_head.glb',
  eagle:'https://cdn.3dassets.dev/assets/20643/v1/model.glb',
  dog:'https://cdn.jsdelivr.net/gh/Ariescar/gobkit-free-assets@0d654ab3306515b1b63621a5c6548554034482dc/animal/Corgi.glb',
  bat:'https://cdn.jsdelivr.net/gh/Ariescar/gobkit-free-assets@0d654ab3306515b1b63621a5c6548554034482dc/animal/Bat.glb',
  shark:'https://cdn.jsdelivr.net/gh/Ariescar/gobkit-free-assets@0d654ab3306515b1b63621a5c6548554034482dc/animal/Shark.glb',
  bird:'https://cdn.jsdelivr.net/gh/Ariescar/gobkit-free-assets@0d654ab3306515b1b63621a5c6548554034482dc/animal/Duck.glb'
};

const geometryStatus={
  human:'fallback',eagle:'fallback',bat:'fallback',dog:'fallback',
  mole:'fallback',shark:'fallback',bird:'fallback',inner:'fallback'
};

let activeName='human';
let lastTime=performance.now();
let pointerX=0,pointerY=0;
let geometryRevision=0;

function rand(a,b){return a+Math.random()*(b-a)}
function gauss(){
  let u=0,v=0;
  while(!u)u=Math.random();
  while(!v)v=Math.random();
  return Math.sqrt(-2*Math.log(u))*Math.cos(TAU*v);
}
function smooth(a,b,x){
  const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1);
  return t*t*(3-2*t);
}
function push(out,x,y,z){out.push(x,y,z)}
function rotateY(x,z,a){return [x*Math.cos(a)+z*Math.sin(a),-x*Math.sin(a)+z*Math.cos(a)]}

function ellipsoid(cx,cy,cz,rx,ry,rz,n,front=.0){
  const out=[];
  for(let i=0;i<n;i++){
    const th=Math.acos(rand(-1,1)),ph=rand(0,TAU),shell=.89+.11*Math.random();
    let x=cx+rx*shell*Math.sin(th)*Math.cos(ph);
    let y=cy+ry*shell*Math.cos(th);
    let z=cz+rz*shell*Math.sin(th)*Math.sin(ph);
    if(front>0&&Math.random()<front)z=cz+Math.abs(z-cz);
    push(out,x+gauss()*.003,y+gauss()*.003,z+gauss()*.003);
  }
  return out;
}
function tube(a,b,r1,r2,n){
  const out=[];
  const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b);
  const axis=B.clone().sub(A),len=axis.length();
  const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),axis.clone().normalize());
  for(let i=0;i<n;i++){
    const t=Math.random(),ang=rand(0,TAU),r=(r1+(r2-r1)*t)*(.88+.12*Math.random());
    const p=new THREE.Vector3(Math.cos(ang)*r,Math.sin(ang)*r,t*len).applyQuaternion(q).add(A);
    push(out,p.x,p.y,p.z);
  }
  return out;
}
function triangle(a,b,c,n,curve=0){
  const out=[];
  for(let i=0;i<n;i++){
    let u=Math.random(),v=Math.random();
    if(u+v>1){u=1-u;v=1-v}
    const x=a[0]+u*(b[0]-a[0])+v*(c[0]-a[0]);
    const y=a[1]+u*(b[1]-a[1])+v*(c[1]-a[1]);
    const z=a[2]+u*(b[2]-a[2])+v*(c[2]-a[2])+Math.sin(u*Math.PI)*Math.sin(v*Math.PI)*curve;
    push(out,x,y,z);
  }
  return out;
}
function merge(...arrs){
  const out=[];
  for(const a of arrs)out.push(...a);
  return out;
}

function proceduralHuman(){
  return merge(
    ellipsoid(0,.33,0,.46,.58,.42,6500,.38),
    ellipsoid(0,-.12,-.01,.34,.26,.31,2000,.28),
    triangle([-.14,.02,.34],[0,.18,.49],[.14,.02,.34],900,.012),
    ellipsoid(-.22,.03,.30,.15,.17,.08,900,.95),
    ellipsoid(.22,.03,.30,.15,.17,.08,900,.95),
    ellipsoid(0,-.18,.34,.17,.08,.045,700,.96),
    tube([-.12,-.30,0],[0,-.48,0],.14,.17,650),
    triangle([-.72,-.48,-.10],[0,-.24,-.16],[-1.05,-.74,-.22],1600,.02),
    triangle([.72,-.48,-.10],[0,-.24,-.16],[1.05,-.74,-.22],1600,.02)
  );
}
function proceduralEagle(){
  return merge(
    ellipsoid(0,.22,0,.43,.53,.38,4300,.42),
    ellipsoid(.02,-.05,-.02,.34,.30,.30,1800,.28),
    triangle([-.10,.13,.34],[.10,.20,.62],[.33,.10,.31],1400,.015),
    triangle([.10,.20,.62],[.42,.12,.26],[.23,-.08,.34],1000,.015),
    triangle([-.33,.48,-.10],[-.55,.88,-.04],[-.14,.65,.14],1000,.02),
    ellipsoid(-.14,.37,.35,.055,.047,.022,420,.98)
  );
}
function proceduralBat(){
  return merge(
    ellipsoid(0,.19,0,.31,.39,.28,3200,.38),
    ellipsoid(0,-.06,.21,.20,.16,.16,1300,.72),
    triangle([-.22,.42,.02],[-.45,.99,-.03],[-.05,.61,.09],1900,.018),
    triangle([.22,.42,.02],[.45,.99,-.03],[.05,.61,.09],1900,.018),
    ellipsoid(-.11,.24,.26,.045,.04,.022,280,.98),
    ellipsoid(.11,.24,.26,.045,.04,.022,280,.98)
  );
}
function proceduralDog(){
  return merge(
    ellipsoid(0,.22,0,.40,.46,.35,3900,.42),
    ellipsoid(-.02,-.02,.30,.31,.21,.30,1700,.84),
    ellipsoid(-.02,-.07,.56,.16,.11,.11,900,.98),
    triangle([-.29,.46,-.03],[-.45,.86,-.10],[-.05,.62,.03],1200,.018),
    triangle([.29,.46,-.03],[.45,.86,-.10],[.05,.62,.03],1200,.018),
    ellipsoid(-.02,-.04,.67,.10,.07,.055,500,.99)
  );
}
function proceduralMole(){
  let star=[];
  for(let i=0;i<22;i++){
    const a=i/22*TAU;
    star.push(...tube([0,-.05,.52],[.30*Math.cos(a),-.05+.30*Math.sin(a),.72],.022,.008,150));
  }
  return merge(
    ellipsoid(0,.17,0,.40,.35,.36,3900,.45),
    ellipsoid(-.02,-.04,.30,.27,.20,.25,1500,.82),
    star
  );
}
function proceduralShark(){
  return merge(
    ellipsoid(0,.10,0,.66,.36,.48,4800,.38),
    ellipsoid(-.08,.00,.38,.45,.22,.25,1900,.78),
    triangle([-.16,.44,-.06],[.02,.88,-.12],[.23,.42,.01],1300,.012),
    ellipsoid(-.22,.18,.37,.04,.03,.018,250,.99),
    ellipsoid(.22,.18,.37,.04,.03,.018,250,.99)
  );
}
function proceduralBird(){
  return merge(
    ellipsoid(0,.22,0,.32,.37,.28,3300,.40),
    ellipsoid(-.03,-.02,-.02,.26,.25,.24,1200,.35),
    triangle([-.10,.14,.26],[.02,.16,.55],[.15,.12,.25],900,.008),
    ellipsoid(-.11,.29,.26,.04,.03,.018,230,.99),
    ellipsoid(.11,.29,.26,.04,.03,.018,230,.99)
  );
}

let humanBase=proceduralHuman();
const animalBases={
  eagle:proceduralEagle(),
  bat:proceduralBat(),
  dog:proceduralDog(),
  mole:proceduralMole(),
  shark:proceduralShark(),
  bird:proceduralBird()
};

function rayField(){
  const out=[];
  for(let i=0;i<4500;i++){
    const lane=(i%14)-6.5,t=Math.random();
    push(out,-.25+t*2.4,.12+lane*.028+Math.sin(t*5+lane)*.012,.38+t*.28);
  }
  return out;
}
function echoField(){
  const out=[];
  for(let i=0;i<5000;i++){
    const shell=1+(i%7),a=rand(-Math.PI*.85,Math.PI*.85),r=.18+shell*.14+gauss()*.018;
    push(out,.66+Math.cos(a)*r,.18+Math.sin(a)*r*.72,.18+Math.sin(a*2)*.10);
  }
  return out;
}
function scentField(){
  const out=[];
  for(let i=0;i<5000;i++){
    const t=Math.random(),a=rand(0,TAU),spread=(.03+.48*t)*Math.random();
    push(out,.92-t*2.25,.02+Math.sin(a)*spread*.46,.44+Math.cos(a)*spread);
  }
  return out;
}
function tactileField(){
  const out=[];
  for(let i=0;i<4800;i++){
    const x=rand(-1.55,1.55),z=rand(.08,.62);
    push(out,x,-.56+.045*Math.sin(x*11)+.025*Math.cos(z*15),z);
  }
  return out;
}
function electricField(){
  const out=[];
  for(let i=0;i<5200;i++){
    const band=(i%10)+1,a=rand(0,TAU),r=.28+band*.11;
    push(out,.38+Math.sin(a*2)*.05,.10+Math.sin(a)*r*.55,Math.cos(a)*r);
  }
  return out;
}
function orientationField(){
  const out=[];
  for(let i=0;i<5200;i++){
    const band=(i%9)+1,a=rand(0,TAU),r=.40+band*.12;
    push(out,Math.cos(a)*r,.10+Math.sin(a*2)*.05,Math.sin(a)*r*.72);
  }
  return out;
}
function innerField(){
  const out=[];
  for(let i=0;i<5200;i++){
    const mode=i%3,a=rand(0,TAU);
    if(mode===0){
      const r=.12+.08*Math.random();
      push(out,Math.cos(a)*r,-.30+Math.sin(a)*r,.10+gauss()*.03);
    }else if(mode===1){
      const x=rand(-.48,.48);
      push(out,x,-.02+.08*Math.sin(x*16+a),.12+gauss()*.04);
    }else{
      const r=.28+.22*Math.random();
      push(out,Math.cos(a)*r,.10+Math.sin(a)*r*.55,-.06+gauss()*.04);
    }
  }
  return out;
}
const fields={
  human:innerField(),eagle:rayField(),bat:echoField(),dog:scentField(),
  mole:tactileField(),shark:electricField(),bird:orientationField(),inner:innerField()
};

const loader=new GLTFLoader();
const tempPoint=new THREE.Vector3();

function sampleMesh(mesh,count,out){
  const sampler=new MeshSurfaceSampler(mesh).build();
  for(let i=0;i<count;i++){
    sampler.sample(tempPoint);
    tempPoint.applyMatrix4(mesh.matrixWorld);
    push(out,tempPoint.x,tempPoint.y,tempPoint.z);
  }
}
function sampleScene(root,totalCount){
  root.updateMatrixWorld(true);
  const meshes=[];
  root.traverse(obj=>{
    if(obj.isMesh&&obj.geometry&&obj.geometry.attributes?.position)meshes.push(obj);
  });
  if(!meshes.length)throw new Error('No mesh surfaces found');
  const weights=meshes.map(m=>Math.max(1,m.geometry.attributes.position.count));
  const sum=weights.reduce((a,b)=>a+b,0);
  const out=[];
  meshes.forEach((m,i)=>{
    const count=Math.max(80,Math.floor(totalCount*weights[i]/sum));
    sampleMesh(m,count,out);
  });
  return out;
}
function normalizeCloud(src,opts={}){
  const axis=opts.axis||'y';
  const flipZ=opts.flipZ||false;
  const targetHeight=opts.height||1.15;
  const out=[];
  let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
  for(let i=0;i<src.length;i+=3){
    const x=src[i],y=src[i+1],z=src[i+2];
    minX=Math.min(minX,x);maxX=Math.max(maxX,x);
    minY=Math.min(minY,y);maxY=Math.max(maxY,y);
    minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);
  }
  const cx=(minX+maxX)/2,cy=(minY+maxY)/2,cz=(minZ+maxZ)/2;
  const spanX=maxX-minX,spanY=maxY-minY,spanZ=maxZ-minZ;
  let denom=axis==='x'?spanX:axis==='z'?spanZ:spanY;
  const s=targetHeight/Math.max(.0001,denom);
  for(let i=0;i<src.length;i+=3){
    let x=(src[i]-cx)*s,y=(src[i+1]-cy)*s,z=(src[i+2]-cz)*s;
    if(axis==='x'){const oy=y;y=x;x=oy}
    if(axis==='z'){const oy=y;y=z;z=oy}
    if(flipZ)z=-z;
    push(out,x,y,z);
  }
  return out;
}
function eugeneFit(src){
  const out=[];
  for(let i=0;i<src.length;i+=3){
    let x=src[i],y=src[i+1],z=src[i+2];

    // Public-reference v0.1 fit: slightly longer face, restrained cheek width,
    // firmer lower jaw and a little more nasal projection. This is intentionally
    // conservative until controlled multi-angle references replace it.
    const yn=THREE.MathUtils.clamp((y+.58)/1.16,0,1);
    const jaw=1-smooth(.26,.55,yn);
    const temple=smooth(.58,.92,yn);
    x*=.94+.055*jaw+.02*temple;
    y*=1.035;

    const central=Math.exp(-(x*x)/.035);
    const noseBand=Math.exp(-Math.pow((y-.06)/.19,2));
    z+=central*noseBand*.038;

    const cheekBand=Math.exp(-Math.pow((y-.02)/.22,2));
    z+=Math.exp(-Math.pow((Math.abs(x)-.19)/.10,2))*cheekBand*.010;

    if(y<-.14){
      x*=.985;
      z+=.008;
    }
    push(out,x,y,z);
  }
  return out;
}
function cropPortrait(src,kind){
  const out=[];
  for(let i=0;i<src.length;i+=3){
    const x=src[i],y=src[i+1],z=src[i+2];
    let keep=true;
    if(kind==='human')keep=y>-.62&&y<.66&&Math.abs(x)<.62;
    if(kind==='eagle')keep=y>-.06&&Math.abs(x)<.72;
    if(kind==='dog')keep=y>-.52;
    if(kind==='bat')keep=y>-.50;
    if(kind==='shark')keep=x>-1.0;
    if(kind==='bird')keep=y>-.55;
    if(keep)push(out,x,y,z);
  }
  return out.length>600?out:src;
}
function loadGLBPoints(url,count,opts){
  return new Promise((resolve,reject)=>{
    loader.load(url,gltf=>{
      try{
        let pts=sampleScene(gltf.scene,count);
        pts=normalizeCloud(pts,opts);
        pts=cropPortrait(pts,opts.kind);
        if(opts.fit)pts=opts.fit(pts);
        resolve(pts);
      }catch(err){reject(err)}
    },undefined,reject);
  });
}
async function hydrateRealGeometry(){
  const jobs=[
    ['human',ASSETS.human,26000,{kind:'human',axis:'y',height:1.18,flipZ:false,fit:eugeneFit}],
    ['eagle',ASSETS.eagle,20000,{kind:'eagle',axis:'y',height:1.24,flipZ:false}],
    ['dog',ASSETS.dog,18000,{kind:'dog',axis:'y',height:1.20,flipZ:false}],
    ['bat',ASSETS.bat,18000,{kind:'bat',axis:'y',height:1.15,flipZ:false}],
    ['shark',ASSETS.shark,18000,{kind:'shark',axis:'y',height:1.15,flipZ:false}],
    ['bird',ASSETS.bird,18000,{kind:'bird',axis:'y',height:1.12,flipZ:false}]
  ];
  await Promise.allSettled(jobs.map(async([name,url,count,opts])=>{
    try{
      const pts=await loadGLBPoints(url,count,opts);
      if(name==='human'){
        humanBase=pts;
        geometryStatus.human='cc0-mesh-eugene-fit-v01';
        geometryStatus.inner='cc0-mesh-eugene-fit-v01';
      }else{
        animalBases[name]=pts;
        geometryStatus[name]='cc0-mesh';
      }
      geometryRevision++;
      if(activeName===name||(name==='human'&&(activeName==='human'||activeName==='inner')))setTargets(activeName);
    }catch(err){
      console.warn('[Odd Earth] geometry fallback:',name,err);
    }
  }));
  console.info('[Odd Earth] geometry:',geometryStatus);
}

function writeColor(i,c,scale=1){
  const k=i*3;
  colors[k]=c.r*scale;colors[k+1]=c.g*scale;colors[k+2]=c.b*scale;
}
function updateColors(name){
  const fieldColor=name==='shark'||name==='bat'?PALETTE.teal:name==='inner'?PALETTE.blood:name==='eagle'||name==='dog'||name==='bird'?PALETTE.brass:PALETTE.field;
  for(let i=0;i<N;i++){
    if(i<HUMAN_N){
      const feature=(i%17===0);
      writeColor(i,feature?PALETTE.humanFeature:PALETTE.human,feature?.91:.78);
      role[i]=0;
    }else if(i<HUMAN_N+ANIMAL_N){
      writeColor(i,PALETTE.animal,.68);
      role[i]=1;
    }else if(i<FREE_START){
      writeColor(i,fieldColor,.62);
      role[i]=2;
    }else{
      writeColor(i,PALETTE.free,.28);
      role[i]=3;
    }
  }
  colorAttr.needsUpdate=true;
}
function setTargets(name){
  strength.fill(0);
  const humanShift=name==='inner'?0:-.83;
  const humanRot=name==='inner'?0:.28;
  const animalShift=.86;
  const animalRot=-.31;

  const hLen=humanBase.length/3;
  for(let n=0;n<HUMAN_N;n++){
    const j=((Math.random()*hLen)|0)*3,k=n*3;
    const x=humanBase[j],z=humanBase[j+2],r=rotateY(x,z,humanRot);
    target[k]=r[0]+humanShift;
    target[k+1]=humanBase[j+1]+.08;
    target[k+2]=r[1];
    strength[n]=.69+Math.random()*.30;
  }

  if(name!=='human'&&name!=='inner'){
    const src=animalBases[name],len=src.length/3;
    for(let n=0;n<ANIMAL_N;n++){
      const idx=HUMAN_N+n,j=((Math.random()*len)|0)*3,k=idx*3;
      const x=src[j],z=src[j+2],r=rotateY(x,z,animalRot);
      target[k]=r[0]+animalShift;
      target[k+1]=src[j+1]+.08;
      target[k+2]=r[1];
      strength[idx]=.61+Math.random()*.32;
    }
  }else if(name==='inner'){
    for(let n=0;n<ANIMAL_N;n++){
      const idx=HUMAN_N+n,j=((Math.random()*hLen)|0)*3,k=idx*3;
      target[k]=humanBase[j];
      target[k+1]=humanBase[j+1]+.08;
      target[k+2]=humanBase[j+2];
      strength[idx]=.30+Math.random()*.24;
    }
  }

  const fsrc=fields[name],flen=fsrc.length/3;
  for(let n=0;n<FIELD_N;n++){
    const idx=HUMAN_N+ANIMAL_N+n,j=((Math.random()*flen)|0)*3,k=idx*3;
    target[k]=fsrc[j];target[k+1]=fsrc[j+1];target[k+2]=fsrc[j+2];
    strength[idx]=.23+Math.random()*.34;
  }
  updateColors(name);
}

for(let i=0;i<N;i++){
  const a=rand(0,TAU),b=Math.acos(rand(-1,1)),r=rand(.9,4.2),k=i*3;
  positions[k]=Math.sin(b)*Math.cos(a)*r;
  positions[k+1]=Math.cos(b)*r*.65;
  positions[k+2]=Math.sin(b)*Math.sin(a)*r*.78;
  velocities[k]=gauss()*.02;velocities[k+1]=gauss()*.02;velocities[k+2]=gauss()*.02;
  phases[i]=rand(0,TAU);
  sizes[i]=mobile?rand(.66,1.35):rand(.60,1.58);
}

const geometry=new THREE.BufferGeometry();
const posAttr=new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage);
geometry.setAttribute('position',posAttr);
geometry.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));
geometry.setAttribute('aPhase',new THREE.BufferAttribute(phases,1));
const colorAttr=new THREE.BufferAttribute(colors,3);
geometry.setAttribute('color',colorAttr);

const vertexShader=[
'attribute vec3 color;',
'attribute float aSize;',
'attribute float aPhase;',
'varying vec3 vColor;',
'varying float vPulse;',
'void main(){',
'  vColor=color;',
'  vPulse=.90+.10*sin(aPhase);',
'  vec4 mv=modelViewMatrix*vec4(position,1.0);',
'  gl_PointSize=clamp(aSize*(92.0/-mv.z),.60,2.65);',
'  gl_Position=projectionMatrix*mv;',
'}'
].join('\n');
const fragmentShader=[
'varying vec3 vColor;',
'varying float vPulse;',
'void main(){',
'  vec2 q=gl_PointCoord-.5;',
'  float r=length(q);',
'  if(r>.5)discard;',
'  float a=smoothstep(.5,.12,r)*.61*vPulse;',
'  gl_FragColor=vec4(vColor,a);',
'}'
].join('\n');
const material=new THREE.ShaderMaterial({
  vertexShader,fragmentShader,transparent:true,depthWrite:false,
  blending:THREE.NormalBlending
});
const particles=new THREE.Points(geometry,material);
scene.add(particles);
setTargets('human');
hydrateRealGeometry();

const labels={
  human:['00','HUMAN'],eagle:['01','VISION'],bat:['02','ECHOLOCATION'],
  dog:['03','CHEMICAL SPACE'],mole:['04','TOUCH'],shark:['05','FIELD SENSING'],
  bird:['06','ORIENTATION'],inner:['07','INNER EARTH']
};

function sectionState(){
  let best=chapters[0],bestDist=Infinity,progress=.5;
  const mid=innerHeight*.5;
  for(const el of chapters){
    const r=el.getBoundingClientRect();
    const d=Math.abs((r.top+r.height*.5)-mid);
    if(d<bestDist){
      bestDist=d;best=el;
      progress=THREE.MathUtils.clamp((mid-r.top)/r.height,0,1);
    }
  }
  return {name:best.dataset.scene,progress};
}
function attractionFor(p){
  return smooth(.08,.40,p)*(1-smooth(.80,.98,p));
}
function fieldFor(p){
  return smooth(.43,.62,p)*(1-smooth(.82,.98,p));
}
function updateUI(name,p){
  if(name!==activeName){
    activeName=name;
    setTargets(name);
    const l=labels[name]||labels.human;
    document.querySelector('#sceneNumber').textContent=l[0];
    document.querySelector('#sceneName').textContent=l[1];
  }
  const locked=attractionFor(p)>.68;
  chapters.forEach(el=>{
    const is=el.dataset.scene===name;
    el.classList.toggle('is-active',is);
    el.classList.toggle('is-locked',is&&locked);
  });
}

function integrate(now){
  requestAnimationFrame(integrate);
  const dt=Math.min(.032,(now-lastTime)/1000||.016);
  lastTime=now;
  const st=sectionState();
  const attraction=attractionFor(st.progress);
  const sensory=fieldFor(st.progress);
  updateUI(st.name,st.progress);

  const t=now*.001;
  for(let i=0;i<N;i++){
    const k=i*3;
    let x=positions[k],y=positions[k+1],z=positions[k+2];
    let vx=velocities[k],vy=velocities[k+1],vz=velocities[k+2];
    const ph=phases[i];

    // Shared coherent field. The anatomy emerges from this motion rather than
    // replacing it, so neighbouring particles travel in related currents.
    const fx=Math.sin(y*1.35+t*.30)+Math.cos(z*1.10-t*.22);
    const fy=Math.sin(z*1.50+t*.25)+Math.cos(x*.95+t*.18);
    const fz=Math.sin(x*1.20-t*.28)+Math.cos(y*1.28+t*.21);
    const flow=.052;
    vx+=fx*flow*dt;vy+=fy*flow*.82*dt;vz+=fz*flow*dt;

    let bind=attraction;
    if(i>=HUMAN_N+ANIMAL_N&&i<FREE_START)bind*=sensory;
    if(i>=FREE_START)bind=0;
    if(st.name==='human'&&i>=HUMAN_N&&i<HUMAN_N+ANIMAL_N)bind=0;

    if(bind>0&&strength[i]>0){
      const dx=target[k]-x,dy=target[k+1]-y,dz=target[k+2]-z;
      const dist=Math.sqrt(dx*dx+dy*dy+dz*dz)+.0001;
      const spring=(2.15*strength[i])*(.62+.38*bind);
      vx+=dx*spring*bind*dt;
      vy+=dy*spring*bind*dt;
      vz+=dz*spring*bind*dt;

      // Tangential circulation: particles keep travelling across the sampled
      // surface instead of freezing into a static point cloud.
      const swirl=.19*bind*(.58+.42*Math.sin(ph+t*.35));
      vx+=(-dy+dz*.25)*swirl*dt;
      vy+=(dx*.65-dz*.20)*swirl*dt;
      vz+=(dx*.12+dy*.20)*swirl*dt;

      // Continual exchange with the free field.
      const exchange=.82+.18*Math.sin(t*.42+ph*2.3);
      vx+=dx*(exchange-.90)*.22*dt;
      vy+=dy*(exchange-.90)*.22*dt;
      vz+=dz*(exchange-.90)*.22*dt;

      if(dist<.045){
        vx+=Math.sin(ph+t*.8)*.0025;
        vy+=Math.cos(ph*1.7+t*.6)*.0022;
        vz+=Math.sin(ph*.8-t*.7)*.0025;
      }
    }

    const rr=x*x+(y*1.15)*(y*1.15)+(z*.92)*(z*.92);
    if(rr>20){
      vx+=-x*.16*dt;vy+=-y*.18*dt;vz+=-z*.15*dt;
    }

    const damping=Math.pow(.986,dt*60);
    vx*=damping;vy*=damping;vz*=damping;
    x+=vx*dt;y+=vy*dt;z+=vz*dt;

    positions[k]=x;positions[k+1]=y;positions[k+2]=z;
    velocities[k]=vx;velocities[k+1]=vy;velocities[k+2]=vz;
  }
  posAttr.needsUpdate=true;

  const idx=Math.max(0,chapters.findIndex(el=>el.dataset.scene===st.name));
  const orbit=(st.progress-.5)*.43+(idx%2?-.04:.04);
  const cx=Math.sin(orbit)*.31+pointerX*.07;
  const cy=.11+pointerY*.045;
  const cz=5.15+Math.cos(orbit)*.07;
  camera.position.x+=(cx-camera.position.x)*.028;
  camera.position.y+=(cy-camera.position.y)*.028;
  camera.position.z+=(cz-camera.position.z)*.028;
  camera.lookAt(0,.06,0);

  const max=document.documentElement.scrollHeight-innerHeight;
  document.querySelector('#progressBar').style.width=(max>0?scrollY/max*100:0)+'%';
  renderer.render(scene,camera);
}
addEventListener('pointermove',e=>{
  pointerX=(e.clientX/innerWidth-.5)*2;
  pointerY=(e.clientY/innerHeight-.5)*-2;
});
addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
});
requestAnimationFrame(integrate);
