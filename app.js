import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const canvas=document.querySelector('#world');
const renderer=new THREE.WebGLRenderer({canvas:canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;

const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0x030606,0.045);

const camera=new THREE.PerspectiveCamera(34,innerWidth/innerHeight,.1,100);
camera.position.set(0,.25,5.7);

const mobile=innerWidth<760;
const density=mobile?.28:.46;
const TAU=Math.PI*2;
const chapters=[...document.querySelectorAll('.scene')];
const groups={};
const fieldObjects=[];
let pointerX=0,pointerY=0,active='human';

const colors={
  human:new THREE.Color('#ded9ce'),
  humanWarm:new THREE.Color('#bcb2a2'),
  animal:new THREE.Color('#b7a47f'),
  moss:new THREE.Color('#7f9e90'),
  brass:new THREE.Color('#b89a65'),
  blood:new THREE.Color('#9d5d56'),
  teal:new THREE.Color('#78a6a0'),
  dim:new THREE.Color('#4f5e58')
};

const vertexShader=[
'attribute float aSize;',
'attribute float aPhase;',
'attribute float aGlow;',
'attribute vec3 aScatter;',
'uniform float uTime;',
'uniform float uSnap;',
'uniform float uOpacity;',
'uniform float uDrift;',
'varying float vAlpha;',
'varying float vGlow;',
'void main(){',
'  float s=smoothstep(0.0,1.0,uSnap);',
'  vec3 loose=aScatter;',
'  loose.x += sin(uTime*.38+aPhase*2.1+loose.y*.55)*uDrift;',
'  loose.y += cos(uTime*.31+aPhase*1.7+loose.z*.42)*uDrift*.78;',
'  loose.z += sin(uTime*.27+aPhase+loose.x*.47)*uDrift*.72;',
'  vec3 flow=position;',
'  flow.x += sin(uTime*.72+aPhase+position.y*4.1)*.032;',
'  flow.y += cos(uTime*.58+aPhase*1.3+position.x*3.4)*.022;',
'  flow.z += sin(uTime*.64+aPhase*.8+position.z*4.3)*.030;',
'  float settle=s*.94;',
'  vec3 p=mix(loose,flow,settle);',
'  vec4 mv=modelViewMatrix*vec4(p,1.0);',
'  float lockPulse=1.0+0.06*exp(-pow((s-.86)*10.0,2.0));',
'  gl_PointSize=max(.72,aSize*lockPulse*(168.0/-mv.z));',
'  gl_Position=projectionMatrix*mv;',
'  vAlpha=uOpacity*(.72+.22*sin(uTime*.42+aPhase));',
'  vGlow=aGlow;',
'}'
].join('\\n');

const fragmentShader=[
'uniform vec3 uColor;',
'varying float vAlpha;',
'varying float vGlow;',
'void main(){',
'  vec2 p=gl_PointCoord-.5;',
'  float r=length(p);',
'  if(r>.5)discard;',
'  float core=smoothstep(.43,.10,r);',
'  float halo=smoothstep(.50,.30,r)*.08;',
'  float a=(core*.82+halo)*vAlpha;',
'  vec3 c=uColor*(.52+.22*core+.08*vGlow);',
'  gl_FragColor=vec4(c,a);',
'}'
].join('\\n');

function rand(a,b){return a+Math.random()*(b-a)}
function gauss(){
  let u=0,v=0;
  while(!u)u=Math.random();
  while(!v)v=Math.random();
  return Math.sqrt(-2*Math.log(u))*Math.cos(TAU*v);
}
function push(out,x,y,z){out.push(x,y,z)}
function ellipsoid(cx,cy,cz,rx,ry,rz,n,frontBias=0){
  const out=[];
  n=Math.floor(n*density);
  for(let i=0;i<n;i++){
    const th=Math.acos(rand(-1,1));
    const ph=rand(0,TAU);
    const shell=.90+.10*Math.random();
    let x=cx+rx*shell*Math.sin(th)*Math.cos(ph);
    let y=cy+ry*shell*Math.cos(th);
    let z=cz+rz*shell*Math.sin(th)*Math.sin(ph);
    if(frontBias>0&&Math.random()<frontBias)z=cz+Math.abs(z-cz);
    push(out,x+gauss()*.004,y+gauss()*.004,z+gauss()*.004);
  }
  return out;
}
function tube(a,b,r1,r2,n){
  const out=[];
  n=Math.floor(n*density);
  const A=new THREE.Vector3(a[0],a[1],a[2]);
  const B=new THREE.Vector3(b[0],b[1],b[2]);
  const axis=B.clone().sub(A);
  const len=axis.length();
  const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),axis.clone().normalize());
  for(let i=0;i<n;i++){
    const t=Math.random();
    const r=(r1+(r2-r1)*t)*(.88+.12*Math.random());
    const ang=rand(0,TAU);
    const p=new THREE.Vector3(Math.cos(ang)*r,Math.sin(ang)*r,t*len).applyQuaternion(q).add(A);
    push(out,p.x+gauss()*.003,p.y+gauss()*.003,p.z+gauss()*.003);
  }
  return out;
}
function triangle(a,b,c,n,curve=0){
  const out=[];
  n=Math.floor(n*density);
  for(let i=0;i<n;i++){
    let u=Math.random(),v=Math.random();
    if(u+v>1){u=1-u;v=1-v}
    const x=a[0]+u*(b[0]-a[0])+v*(c[0]-a[0]);
    const y=a[1]+u*(b[1]-a[1])+v*(c[1]-a[1]);
    const z=a[2]+u*(b[2]-a[2])+v*(c[2]-a[2])+Math.sin(u*Math.PI)*Math.sin(v*Math.PI)*curve;
    push(out,x+gauss()*.004,y+gauss()*.004,z+gauss()*.004);
  }
  return out;
}
function arcPoints(cx,cy,cz,rx,ry,start,end,n,rotY=0){
  const out=[];
  for(let i=0;i<=n;i++){
    const a=start+(end-start)*(i/n);
    const x=rx*Math.cos(a),y=ry*Math.sin(a);
    out.push(cx+x*Math.cos(rotY),cy+y,cz+x*Math.sin(rotY));
  }
  return out;
}
function particleCloud(group,positions,color,size=4.9,opacity=.88,spread=2.7){
  const n=positions.length/3;
  const scatter=new Float32Array(positions.length);
  const sizes=new Float32Array(n);
  const phase=new Float32Array(n);
  const glow=new Float32Array(n);
  for(let i=0;i<n;i++){
    const j=i*3;
    const homeX=positions[j],homeY=positions[j+1],homeZ=positions[j+2];
    const a=rand(0,TAU),b=Math.acos(rand(-1,1)),r=spread*(.35+.65*Math.pow(Math.random(),.58));
    scatter[j]=homeX*.12+Math.sin(b)*Math.cos(a)*r;
    scatter[j+1]=homeY*.12+Math.cos(b)*r;
    scatter[j+2]=homeZ*.12+Math.sin(b)*Math.sin(a)*r;
    sizes[i]=size*(.30+.42*Math.random());
    phase[i]=Math.random()*TAU;
    glow[i]=Math.random();
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('aScatter',new THREE.BufferAttribute(scatter,3));
  geo.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));
  geo.setAttribute('aPhase',new THREE.BufferAttribute(phase,1));
  geo.setAttribute('aGlow',new THREE.BufferAttribute(glow,1));
  const mat=new THREE.ShaderMaterial({
    uniforms:{
      uColor:{value:color.clone()},
      uTime:{value:0},
      uSnap:{value:0},
      uOpacity:{value:0},
      uDrift:{value:.32}
    },
    vertexShader:vertexShader,
    fragmentShader:fragmentShader,
    transparent:true,
    depthWrite:false,
    blending:THREE.NormalBlending
  });
  mat.userData.baseOpacity=opacity*.46;
  const points=new THREE.Points(geo,mat);
  group.add(points);
  return points;
}
function line(group,pts,color,opacity=.22){
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
  const mat=new THREE.LineBasicMaterial({color:color,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
  mat.userData.baseOpacity=opacity;
  const obj=new THREE.Line(geo,mat);
  group.add(obj);
  fieldObjects.push(obj);
  return obj;
}

function humanFace(group,x=-.95,rot=.27,accent='none'){
  const root=new THREE.Group();
  root.position.x=x;
  root.rotation.y=rot;
  group.add(root);

  let body=[];
  body.push(...ellipsoid(0,.46,0,.50,.64,.46,2600,.33));
  body.push(...ellipsoid(0,.00,-.01,.38,.30,.35,850,.25));
  body.push(...tube([-.13,-.23,0],[0,-.42,0],.15,.18,320));
  body.push(...triangle([-.15,.12,.38],[0,.28,.53],[.15,.12,.38],420,.015));
  body.push(...ellipsoid(-.25,.10,.33,.17,.19,.09,340,.95));
  body.push(...ellipsoid(.25,.10,.33,.17,.19,.09,340,.95));
  body.push(...ellipsoid(0,-.12,.37,.19,.10,.05,280,.92));
  body.push(...triangle([-.82,-.46,-.10],[0,-.18,-.18],[-1.22,-.72,-.22],750,.03));
  body.push(...triangle([.82,-.46,-.10],[0,-.18,-.18],[1.22,-.72,-.22],750,.03));
  particleCloud(root,body,colors.human,5.2,.84,2.9);

  let warm=[];
  warm.push(...ellipsoid(-.15,.16,.42,.085,.045,.034,170,.98));
  warm.push(...ellipsoid(.15,.16,.42,.085,.045,.034,170,.98));
  warm.push(...arcPoints(0,-.13,.405,.16,.055,Math.PI*.12,Math.PI*.88,70,0));
  warm.push(...arcPoints(0,-.14,.408,.16,.055,Math.PI*1.12,Math.PI*1.88,70,0));
  warm.push(...arcPoints(-.15,.23,.415,.13,.035,Math.PI*.05,Math.PI*.95,55,0));
  warm.push(...arcPoints(.15,.23,.415,.13,.035,Math.PI*.05,Math.PI*.95,55,0));
  particleCloud(root,warm,accent==='inner'?colors.blood:colors.humanWarm,4.0,.90,2.3);

  if(accent==='vision'){
    particleCloud(root,ellipsoid(-.15,.16,.455,.055,.027,.016,150,.99).concat(ellipsoid(.15,.16,.455,.055,.027,.016,150,.99)),colors.brass,5.1,.96,1.9);
  }
  if(accent==='hearing'){
    particleCloud(root,ellipsoid(-.48,.21,.02,.055,.145,.07,180,.4).concat(ellipsoid(.48,.21,.02,.055,.145,.07,180,.4)),colors.teal,4.5,.86,2.1);
  }
  if(accent==='smell')particleCloud(root,ellipsoid(0,.06,.48,.07,.10,.055,190,.98),colors.brass,4.7,.90,1.8);
  if(accent==='inner'){
    particleCloud(root,ellipsoid(0,-.36,.03,.15,.18,.11,300,.5),colors.blood,5.0,.86,1.9);
  }
  return root;
}

function eagleHead(group,x=.98,rot=-.32){
  const root=new THREE.Group();root.position.x=x;root.rotation.y=rot;group.add(root);
  let pts=[];
  pts.push(...ellipsoid(0,.35,0,.47,.57,.42,2100,.35));
  pts.push(...ellipsoid(.04,.05,-.02,.37,.34,.34,900,.25));
  pts.push(...triangle([-.12,.25,.37],[.08,.33,.66],[.33,.20,.34],520,.02));
  pts.push(...triangle([.08,.33,.66],[.44,.24,.28],[.25,.06,.39],460,.02));
  pts.push(...triangle([-.36,.62,-.10],[-.62,.98,-.04],[-.17,.76,.16],420,.02));
  particleCloud(root,pts,colors.animal,5.2,.85,2.9);
  particleCloud(root,ellipsoid(-.16,.48,.39,.065,.055,.028,180,.98),colors.brass,5.2,.98,1.8);
  return root;
}
function batHead(group,x=1.00,rot=-.25){
  const root=new THREE.Group();root.position.x=x;root.rotation.y=rot;group.add(root);
  let pts=[];
  pts.push(...ellipsoid(0,.30,0,.33,.42,.30,1200,.32));
  pts.push(...ellipsoid(0,.02,.24,.22,.18,.18,520,.65));
  pts.push(...triangle([-.24,.50,.02],[-.48,1.08,-.02],[-.06,.68,.11],850,.025));
  pts.push(...triangle([.24,.50,.02],[.48,1.08,-.02],[.06,.68,.11],850,.025));
  pts.push(...ellipsoid(-.12,.34,.28,.052,.045,.026,130,.98));
  pts.push(...ellipsoid(.12,.34,.28,.052,.045,.026,130,.98));
  particleCloud(root,pts,colors.moss,5.1,.86,2.8);
  particleCloud(root,ellipsoid(-.13,.35,.31,.035,.025,.016,100,.99).concat(ellipsoid(.13,.35,.31,.035,.025,.016,100,.99)),colors.brass,4.8,.96,1.8);
  return root;
}
function dogHead(group,x=1.00,rot=-.32){
  const root=new THREE.Group();root.position.x=x;root.rotation.y=rot;group.add(root);
  let pts=[];
  pts.push(...ellipsoid(0,.31,0,.43,.49,.38,1800,.38));
  pts.push(...ellipsoid(-.03,.02,.34,.35,.23,.34,850,.82));
  pts.push(...ellipsoid(-.03,-.03,.60,.18,.13,.13,430,.98));
  pts.push(...triangle([-.31,.55,-.03],[-.48,.96,-.12],[-.06,.70,.04],500,.025));
  pts.push(...triangle([.31,.55,-.03],[.48,.96,-.12],[.06,.70,.04],500,.025));
  particleCloud(root,pts,colors.animal,5.2,.86,2.9);
  particleCloud(root,ellipsoid(-.03,-.01,.72,.12,.08,.065,300,.99),colors.brass,5.0,.95,1.7);
  particleCloud(root,ellipsoid(-.16,.37,.35,.05,.038,.023,110,.99).concat(ellipsoid(.16,.37,.35,.05,.038,.023,110,.99)),colors.humanWarm,4.5,.95,1.7);
  return root;
}
function moleHead(group,x=1.02,rot=-.28){
  const root=new THREE.Group();root.position.x=x;root.rotation.y=rot;group.add(root);
  let pts=[];
  pts.push(...ellipsoid(0,.26,0,.43,.38,.39,1650,.42));
  pts.push(...ellipsoid(-.03,.02,.34,.30,.22,.28,700,.82));
  particleCloud(root,pts,colors.dim,5.1,.88,2.9);
  let star=[];
  for(let i=0;i<22;i++){
    const a=i/22*TAU;
    star.push(...tube([0,.00,.58],[.34*Math.cos(a),.00+.34*Math.sin(a),.78],.028,.010,120));
  }
  particleCloud(root,star,colors.brass,4.5,.98,2.2);
  return root;
}
function sharkHead(group,x=1.05,rot=-.48){
  const root=new THREE.Group();root.position.x=x;root.rotation.y=rot;group.add(root);
  let pts=[];
  pts.push(...ellipsoid(0,.20,0,.72,.40,.54,2100,.35));
  pts.push(...ellipsoid(-.10,.11,.44,.49,.25,.29,950,.77));
  pts.push(...triangle([-.18,.54,-.07],[.02,1.00,-.13],[.25,.52,.02],520,.015));
  particleCloud(root,pts,colors.teal,5.1,.86,3.1);
  particleCloud(root,ellipsoid(-.25,.28,.42,.045,.034,.02,110,.99).concat(ellipsoid(.25,.28,.42,.045,.034,.02,110,.99)),colors.brass,4.4,.95,1.8);
  line(root,arcPoints(0,-.02,.64,.32,.12,Math.PI*.16,Math.PI*.84,80,0),colors.humanWarm,.22);
  return root;
}
function birdHead(group,x=1.00,rot=-.34){
  const root=new THREE.Group();root.position.x=x;root.rotation.y=rot;group.add(root);
  let pts=[];
  pts.push(...ellipsoid(0,.30,0,.34,.39,.31,1300,.38));
  pts.push(...ellipsoid(-.04,.05,-.02,.28,.27,.27,600,.32));
  pts.push(...triangle([-.11,.25,.29],[.02,.26,.60],[.16,.22,.28],450,.01));
  particleCloud(root,pts,colors.animal,5.0,.86,2.8);
  particleCloud(root,ellipsoid(-.12,.38,.29,.045,.035,.02,120,.99).concat(ellipsoid(.12,.38,.29,.045,.035,.02,120,.99)),colors.brass,4.6,.96,1.7);
  return root;
}

function ringField(group,center,color,count=6,axis='z'){
  for(let j=0;j<count;j++){
    const pts=[];
    const r=.42+j*.22;
    for(let i=0;i<=120;i++){
      const a=i/120*TAU;
      let x=center[0],y=center[1],z=center[2];
      if(axis==='z'){x+=Math.cos(a)*r;y+=Math.sin(a)*r*.52;z+=Math.sin(a*2)*.05}
      else if(axis==='x'){z+=Math.cos(a)*r;y+=Math.sin(a)*r*.55;x+=Math.sin(a*2)*.04}
      else{x+=Math.cos(a)*r;z+=Math.sin(a)*r*.72;y+=Math.sin(a*2)*.04}
      pts.push(x,y,z);
    }
    const l=line(group,pts,color,.16-j*.014);
    l.userData.field=true;
    l.userData.phase=j*.45;
  }
}
function plumeField(group,startX,startY){
  const pts=[];
  const n=Math.floor(1400*density);
  for(let i=0;i<n;i++){
    const t=Math.random();
    const a=rand(0,TAU);
    const spread=(.04+.46*t)*Math.random();
    push(pts,startX-t*1.6,startY+Math.sin(a)*spread*.42,Math.cos(a)*spread);
  }
  const p=particleCloud(group,pts,colors.brass,3.2,.32,1.6);
  p.userData.field=true;
  return p;
}

function sceneGroup(name,builder){
  const g=new THREE.Group();
  g.userData.name=name;
  builder(g);
  scene.add(g);
  groups[name]=g;
  g.traverse(function(o){
    if(o.material&&o.material.uniforms){
      o.material.uniforms.uOpacity.value=0;
      o.material.uniforms.uSnap.value=0;
    }else if(o.material){
      o.material.opacity=0;
    }
  });
}
sceneGroup('human',function(g){
  humanFace(g,0,0,'none');
});
sceneGroup('eagle',function(g){
  humanFace(g,-.95,.28,'vision');
  eagleHead(g,.98,-.32);
  for(let j=-3;j<=3;j++){
    const l=line(g,[-.77,.18,.46,.72,.24+j*.065,.58],colors.brass,.13);
    l.userData.field=true;
  }
});
sceneGroup('bat',function(g){
  humanFace(g,-.95,.28,'hearing');
  batHead(g,1.0,-.25);
  ringField(g,[.55,.30,.15],colors.teal,8,'z');
});
sceneGroup('dog',function(g){
  humanFace(g,-.95,.28,'smell');
  dogHead(g,1.0,-.32);
  plumeField(g,.98,.02);
});
sceneGroup('mole',function(g){
  humanFace(g,-.95,.28,'touch');
  moleHead(g,1.02,-.28);
  ringField(g,[.48,.0,.1],colors.brass,5,'x');
});
sceneGroup('shark',function(g){
  humanFace(g,-.95,.28,'field');
  sharkHead(g,1.05,-.48);
  ringField(g,[.55,.20,.0],colors.teal,9,'x');
});
sceneGroup('bird',function(g){
  humanFace(g,-.95,.28,'field');
  birdHead(g,1.0,-.34);
  ringField(g,[.0,.28,-.05],colors.brass,10,'y');
});
sceneGroup('inner',function(g){
  humanFace(g,0,0,'inner');
  ringField(g,[0,-.28,.05],colors.blood,6,'z');
  ringField(g,[0,.25,-.10],colors.moss,5,'x');
});

const labels={
  human:['00','HUMAN'],
  eagle:['01','VISION'],
  bat:['02','ECHOLOCATION'],
  dog:['03','CHEMICAL SPACE'],
  mole:['04','TOUCH'],
  shark:['05','FIELD SENSING'],
  bird:['06','ORIENTATION'],
  inner:['07','INNER EARTH']
};

function sectionMetrics(el){
  const r=el.getBoundingClientRect();
  const p=THREE.MathUtils.clamp((innerHeight-r.top)/(r.height+innerHeight),0,1);
  const centerDist=Math.abs((r.top+r.height*.5)-innerHeight*.5);
  const visibility=1-THREE.MathUtils.clamp(centerDist/(innerHeight*.82),0,1);
  return {progress:p,visibility:THREE.MathUtils.smoothstep(visibility,0,1)};
}
function snapCurve(p){
  if(p<.25)return p/.25*.08;
  if(p<.39)return .08+(p-.25)/.14*.12;
  if(p<.49){
    const t=(p-.39)/.10;
    return .20+(t*t*(3-2*t))*.80;
  }
  return 1;
}
function setSceneState(name,g,opacity,snap,field){
  g.visible=opacity>.005;
  g.traverse(function(o){
    const m=o.material;
    if(!m)return;
    if(m.uniforms&&m.uniforms.uOpacity){
      m.uniforms.uOpacity.value=(m.userData.baseOpacity||.8)*opacity;
      m.uniforms.uSnap.value=snap;
      m.uniforms.uTime.value=performance.now()*.001;
      m.uniforms.uDrift.value=.34*(1-snap)+.028;
      if(o.userData.field)m.uniforms.uOpacity.value*=field;
    }else if(m.userData.baseOpacity!=null){
      m.opacity=m.userData.baseOpacity*opacity*(o.userData.field?field:1);
    }
  });
}
function updateActive(name,locked){
  if(name!==active){
    active=name;
    const l=labels[name]||labels.human;
    document.querySelector('#sceneNumber').textContent=l[0];
    document.querySelector('#sceneName').textContent=l[1];
  }
  chapters.forEach(function(el){
    const is=el.dataset.scene===name;
    el.classList.toggle('is-active',is);
    el.classList.toggle('is-locked',is&&locked);
  });
}
function animate(){
  requestAnimationFrame(animate);
  let bestName='human',bestVis=-1,bestProgress=.5;
  chapters.forEach(function(el){
    const name=el.dataset.scene;
    const m=sectionMetrics(el);
    const snap=snapCurve(m.progress);
    const field=THREE.MathUtils.smoothstep(snap,.72,1);
    setSceneState(name,groups[name],m.visibility,snap,field);
    if(m.visibility>bestVis){bestVis=m.visibility;bestName=name;bestProgress=m.progress}
  });
  const locked=snapCurve(bestProgress)>.88;
  updateActive(bestName,locked);

  const index=Math.max(0,chapters.findIndex(function(x){return x.dataset.scene===bestName}));
  const orbit=(bestProgress-.5)*.58+(index%2?-.08:.08);
  const targetX=Math.sin(orbit)*.55+pointerX*.10;
  const targetY=.18+Math.sin(index*.7)*.04+pointerY*.06;
  const targetZ=5.45+Math.cos(orbit)*.12;
  camera.position.x+=(targetX-camera.position.x)*.035;
  camera.position.y+=(targetY-camera.position.y)*.035;
  camera.position.z+=(targetZ-camera.position.z)*.035;
  camera.lookAt(0,.20,0);

  Object.values(groups).forEach(function(g){
    if(!g.visible)return;
    g.position.y=Math.sin(performance.now()*.00032)*.009;
  });
  fieldObjects.forEach(function(o){
    if(o.userData.field)o.rotation.z=.018*Math.sin(performance.now()*.00045+(o.userData.phase||0));
  });

  const doc=document.documentElement;
  const max=doc.scrollHeight-innerHeight;
  document.querySelector('#progressBar').style.width=(max>0?scrollY/max*100:0)+'%';
  renderer.render(scene,camera);
}
addEventListener('pointermove',function(e){
  pointerX=(e.clientX/innerWidth-.5)*2;
  pointerY=(e.clientY/innerHeight-.5)*-2;
});
addEventListener('resize',function(){
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
});
animate();
