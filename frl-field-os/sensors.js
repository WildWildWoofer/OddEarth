async function acquireLocation(log=true){
  if(!navigator.geolocation){toast('Geolocation unavailable');return null;}
  $('locationText').textContent='Acquiring position…';
  return new Promise(resolve=>navigator.geolocation.getCurrentPosition(pos=>{
    state.location={lat:pos.coords.latitude,lon:pos.coords.longitude,accuracy:pos.coords.accuracy,altitude:pos.coords.altitude,timestamp:new Date(pos.timestamp).toISOString()}; save();
    $('locationText').textContent=`${state.location.lat.toFixed(5)}, ${state.location.lon.toFixed(5)} ±${Math.round(state.location.accuracy)} m`;
    if(log) logEvent('location','gps','GPS position acquired',{...state.location},'MEASURED',Math.max(0,Math.min(1,1-state.location.accuracy/500)));
    updateMapPosition(); resolve(state.location);
  },err=>{ $('locationText').textContent=`Location error: ${err.message}`; toast('Location permission or fix unavailable'); resolve(null); },{enableHighAccuracy:true,timeout:12000,maximumAge:30000}));
}

async function refreshEnvironment(){
  let loc=state.location || await acquireLocation(false); if(!loc)return;
  $('refreshEnvBtn').disabled=true; $('refreshEnvBtn').textContent='Refreshing…';
  try{
    const w=`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,visibility&timezone=auto`;
    const a=`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${loc.lat}&longitude=${loc.lon}&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,european_aqi,uv_index&timezone=auto`;
    const [wr,ar]=await Promise.all([fetch(w),fetch(a)]); if(!wr.ok||!ar.ok)throw new Error('Environmental service unavailable');
    const [wj,aj]=await Promise.all([wr.json(),ar.json()]);
    state.environment={time:nowIso(),weather:{temperature:wj.current?.temperature_2m,humidity:wj.current?.relative_humidity_2m,apparent:wj.current?.apparent_temperature,precipitation:wj.current?.precipitation,weather_code:wj.current?.weather_code,cloud:wj.current?.cloud_cover,pressure:wj.current?.pressure_msl,wind_speed:wj.current?.wind_speed_10m,wind_direction:wj.current?.wind_direction_10m,visibility:wj.current?.visibility},air:{pm10:aj.current?.pm10,pm2_5:aj.current?.pm2_5,co:aj.current?.carbon_monoxide,no2:aj.current?.nitrogen_dioxide,so2:aj.current?.sulphur_dioxide,ozone:aj.current?.ozone,aqi:aj.current?.european_aqi,uv:aj.current?.uv_index},sources:{weather:'Open-Meteo forecast/current',air:'Open-Meteo Air Quality / CAMS'}};
    logEvent('environment','remote_environment',`Environment refreshed: ${fmt(state.environment.weather.temperature,1)} °C, wind ${fmt(state.environment.weather.wind_speed,0)} km/h, PM2.5 ${fmt(state.environment.air.pm2_5,0)} µg/m³`,state.environment,'REMOTE_MODEL');
  }catch(e){toast(e.message);}
  finally{$('refreshEnvBtn').disabled=false;$('refreshEnvBtn').textContent='Refresh';renderEnv();}
}

function renderEnv(){
  const e=state.environment;
  if(!e){$('envMetrics').innerHTML='<div class="subtle">No environmental data loaded.</div>';$('envInterpretation').textContent='Acquire location and refresh to populate environmental context.';return;}
  const cards=[['Temperature',fmt(e.weather.temperature,1),'°C'],['Apparent',fmt(e.weather.apparent,1),'°C'],['Humidity',fmt(e.weather.humidity,0),'%'],['Wind',fmt(e.weather.wind_speed,0),'km/h'],['PM2.5',fmt(e.air.pm2_5,0),'µg/m³'],['PM10',fmt(e.air.pm10,0),'µg/m³'],['Ozone',fmt(e.air.ozone,0),'µg/m³'],['UV index',fmt(e.air.uv,1),'index'],['NO₂',fmt(e.air.no2,0),'µg/m³'],['CO',fmt(e.air.co,0),'µg/m³'],['Visibility',fmt((e.weather.visibility||0)/1000,1),'km'],['Pressure',fmt(e.weather.pressure,0),'hPa']];
  $('envMetrics').innerHTML=cards.map(c=>`<div class="metric-card"><span>${c[0]}</span><strong>${c[1]}</strong><small>${c[2]}</small></div>`).join('');
  const notes=[];
  if(Number(e.weather.temperature)>=32) notes.push('High ambient temperature may increase heat-load risk during exertion or prolonged extrication.');
  if(Number(e.weather.wind_speed)>=35) notes.push('Strong wind can affect smoke/plume direction, scene operations and aerial assets.');
  if(Number(e.air.pm2_5)>=35) notes.push('Modelled particulate concentration is elevated; consider respiratory exposure context and local measurements if available.');
  if(Number(e.air.uv)>=8) notes.push('UV index is high to very high; prolonged responder exposure is relevant.');
  if(!notes.length) notes.push('No simple threshold flags are triggered by the currently loaded model fields. Interpret in context and against local guidance.');
  $('envInterpretation').innerHTML=notes.map(n=>`<p>${escapeHtml(n)}</p>`).join('');
}

function initMap(){
  if(map){map.invalidateSize();updateMapPosition();return;}
  if(!window.L){$('mapCanvas').innerHTML='<div class="panel">Map library unavailable offline. Location and resource list can still function when loaded.</div>';return;}
  map=L.map('mapCanvas',{zoomControl:true}).setView([0,0],2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
  resourceLayer=L.layerGroup().addTo(map); updateMapPosition();
}
function updateMapPosition(){
  if(!state.location)return;
  $('locationText').textContent=`${state.location.lat.toFixed(5)}, ${state.location.lon.toFixed(5)} ±${Math.round(state.location.accuracy||0)} m`;
  if(!map)return;
  const ll=[state.location.lat,state.location.lon]; if(userMarker) userMarker.setLatLng(ll); else userMarker=L.circleMarker(ll,{radius:8,weight:3}).addTo(map).bindPopup('Current responder position'); map.setView(ll,14);
}

async function findResources(){
  let loc=state.location || await acquireLocation(false); if(!loc)return;
  $('findResourcesBtn').disabled=true;$('findResourcesBtn').textContent='Searching…';
  const query=`[out:json][timeout:25];(nwr(around:10000,${loc.lat},${loc.lon})["amenity"~"hospital|clinic|doctors"];nwr(around:10000,${loc.lat},${loc.lon})["emergency"="ambulance_station"];);out center tags 60;`;
  try{
    const r=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:'data='+encodeURIComponent(query)}); if(!r.ok)throw new Error('OpenStreetMap resource query failed');
    const j=await r.json();
    const resources=j.elements.map(el=>({name:el.tags?.name||el.tags?.operator||'Unnamed facility',kind:el.tags?.amenity||el.tags?.emergency||'medical resource',lat:el.lat??el.center?.lat,lon:el.lon??el.center?.lon,phone:el.tags?.phone||el.tags?.['contact:phone']||'',emergency:el.tags?.emergency||''})).filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lon)).map(x=>({...x,distance:haversine(loc.lat,loc.lon,x.lat,x.lon)})).sort((a,b)=>a.distance-b.distance).slice(0,25);
    renderResources(resources); logEvent('location','nearby_resources',`Loaded ${resources.length} nearby medical resources within 10 km`,{count:resources.length,resources},'PUBLIC_DATA');
  }catch(e){$('resourceList').textContent=e.message;toast(e.message);}finally{$('findResourcesBtn').disabled=false;$('findResourcesBtn').textContent='Find nearby medical resources';}
}
function renderResources(resources){
  $('resourceList').innerHTML=resources.length?resources.map((r,i)=>`<div class="resource-item"><div><strong>${escapeHtml(r.name)}</strong><br><small>${escapeHtml(r.kind)}${r.phone?' · '+escapeHtml(r.phone):''}</small></div><strong>${r.distance.toFixed(1)} km</strong></div>`).join(''):'No mapped resources returned.';
  if(map&&resourceLayer){resourceLayer.clearLayers();resources.forEach(r=>L.marker([r.lat,r.lon]).addTo(resourceLayer).bindPopup(`<b>${escapeHtml(r.name)}</b><br>${escapeHtml(r.kind)}<br>${r.distance.toFixed(1)} km`));}
}
function haversine(a,b,c,d){const R=6371,toR=x=>x*Math.PI/180;const x=toR(c-a),y=toR(d-b);const q=Math.sin(x/2)**2+Math.cos(toR(a))*Math.cos(toR(c))*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(q));}

async function startCamera(kind){
  const front=kind==='patient',video=front?$('patientVideo'):$('sceneVideo');
  try{
    if(front&&patientStream) stopStream(patientStream); if(!front&&sceneStream) stopStream(sceneStream);
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:front?'user':{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false});
    video.srcObject=stream; await video.play();
    if(front){patientStream=stream;$('patientCameraStatus').textContent='Front camera live';$('patientCamBtn').textContent='Restart front camera';$('rppgBtn').disabled=false;$('patientSnapBtn').disabled=false;}
    else{sceneStream=stream;$('sceneCameraStatus').textContent='Rear camera live';$('sceneCamBtn').textContent='Restart rear camera';$('sceneSnapBtn').disabled=false;monitorSceneLight();}
  }catch(e){toast('Camera unavailable: '+e.message);}
}
function stopStream(s){s?.getTracks().forEach(t=>t.stop());}
function captureSnapshot(kind){
  const video=kind==='patient'?$('patientVideo'):$('sceneVideo'),canvas=kind==='patient'?$('patientCanvas'):$('sceneCanvas'); if(!video.videoWidth)return;
  canvas.width=640;canvas.height=Math.round(640*video.videoHeight/video.videoWidth);const ctx=canvas.getContext('2d');ctx.drawImage(video,0,0,canvas.width,canvas.height);
  const sample=ctx.getImageData(0,0,canvas.width,canvas.height).data;let sum=0;for(let i=0;i<sample.length;i+=64)sum+=(sample[i]+sample[i+1]+sample[i+2])/3;const brightness=sum/(sample.length/64);
  logEvent(kind==='patient'?'patient':'scene','snapshot',`${kind==='patient'?'Patient':'Scene'} frame logged · brightness ${brightness.toFixed(0)}/255`,{brightness},'MEASURED'); toast('Frame observation logged');
}
function monitorSceneLight(){
  const v=$('sceneVideo'),c=$('sceneCanvas'),ctx=c.getContext('2d'); c.width=80;c.height=60;
  const tick=()=>{if(!sceneStream)return;try{ctx.drawImage(v,0,0,80,60);const d=ctx.getImageData(0,0,80,60).data;let s=0;for(let i=0;i<d.length;i+=4)s+=(d[i]+d[i+1]+d[i+2])/3;const b=s/(d.length/4);$('sceneLight').textContent=`LIGHT ${Math.round(b)}/255`;}catch{}requestAnimationFrame(tick)};tick();
}

function startRppg(){
  if(!patientStream||rppgTimer)return;
  rppgSamples=[];const video=$('patientVideo'),canvas=$('patientCanvas'),ctx=canvas.getContext('2d');canvas.width=160;canvas.height=120;const start=performance.now();$('rppgBtn').disabled=true;$('cameraHr').textContent='…';
  rppgTimer=setInterval(()=>{
    if(video.readyState<2)return;ctx.drawImage(video,0,0,160,120);const x=61,y=28,w=38,h=18,d=ctx.getImageData(x,y,w,h).data;let g=0;for(let i=0;i<d.length;i+=4)g+=d[i+1];g/=d.length/4;rppgSamples.push({t:performance.now()/1000,g});const elapsed=(performance.now()-start)/1000;$('pulseCountdown').textContent=Math.max(0,20-elapsed).toFixed(1);
    if(elapsed>=20){clearInterval(rppgTimer);rppgTimer=null;$('rppgBtn').disabled=false;$('pulseCountdown').textContent='complete';const out=estimatePulse(rppgSamples);if(out){$('cameraHr').textContent=Math.round(out.hr);$('pulseQuality').textContent=Math.round(out.quality*100)+'%';$('rppgQuality').textContent='Q '+Math.round(out.quality*100)+'%';logEvent('patient','camera_rppg',`Experimental camera pulse estimate ${Math.round(out.hr)} bpm (quality ${Math.round(out.quality*100)}%)`,{hr:out.hr,quality:out.quality,duration:20,samples:rppgSamples.length},'EXPERIMENTAL_ESTIMATE',out.quality);}else{$('cameraHr').textContent='—';$('pulseQuality').textContent='low';toast('Pulse signal too weak — stabilize face and lighting');}}
  },70);
}
function estimatePulse(samples){
  if(samples.length<120)return null;const duration=samples.at(-1).t-samples[0].t,fs=(samples.length-1)/duration;if(fs<8)return null;const x=samples.map(s=>s.g);const trendWin=Math.max(5,Math.round(fs*1.2));const detr=x.map((v,i)=>{let a=0,n=0;for(let k=Math.max(0,i-trendWin);k<=Math.min(x.length-1,i+trendWin);k++){a+=x[k];n++;}return v-a/n;});const mean=detr.reduce((a,b)=>a+b,0)/detr.length;const sig=detr.map(v=>v-mean);const energy=sig.reduce((a,b)=>a+b*b,0)/sig.length;if(energy<0.01)return null;const minLag=Math.floor(fs*60/180),maxLag=Math.ceil(fs*60/45);let bestLag=0,best=-Infinity;for(let lag=minLag;lag<=maxLag;lag++){let c=0,n=0;for(let i=lag;i<sig.length;i++){c+=sig[i]*sig[i-lag];n++;}c/=n;if(c>best){best=c;bestLag=lag;}}const quality=Math.max(0,Math.min(1,best/energy));const hr=60*fs/bestLag;if(!Number.isFinite(hr)||hr<40||hr>190||quality<0.08)return null;return{hr,quality,fs};
}

function tapBreath(){const t=performance.now();breathTaps.push(t);breathTaps=breathTaps.filter(x=>t-x<90000);if(breathTaps.length>=4){const intervals=[];for(let i=1;i<breathTaps.length;i++)intervals.push((breathTaps[i]-breathTaps[i-1])/1000);const avg=intervals.reduce((a,b)=>a+b,0)/intervals.length;const rr=60/avg;$('tapRr').textContent=rr.toFixed(1);if(breathTaps.length>=6)state.latest.patient={time:nowIso(),summary:`Observed RR ${rr.toFixed(1)}/min`,evidence:'MANUAL_OBSERVATION',data:{rr}};}else $('tapRr').textContent=`tap ${breathTaps.length}`;}
function resetBreaths(){breathTaps=[];$('tapRr').textContent='—';}

async function startMic(){
  try{if(micStream){stopStream(micStream);micStream=null;cancelAnimationFrame(audioRAF);$('micBtn').textContent='Start microphone';$('audioStatus').textContent='Microphone off';$('logAudioBtn').disabled=true;return;}
    micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});audioCtx=new (window.AudioContext||window.webkitAudioContext)();const src=audioCtx.createMediaStreamSource(micStream);analyser=audioCtx.createAnalyser();analyser.fftSize=1024;src.connect(analyser);$('micBtn').textContent='Stop microphone';$('audioStatus').textContent='Live audio level only · not recording';$('logAudioBtn').disabled=false;drawAudio();
  }catch(e){toast('Microphone unavailable: '+e.message);}
}
function drawAudio(){const c=$('audioMeter'),ctx=c.getContext('2d'),data=new Uint8Array(analyser.fftSize);const loop=()=>{if(!analyser)return;analyser.getByteTimeDomainData(data);let rms=0;for(const v of data){const n=(v-128)/128;rms+=n*n;}rms=Math.sqrt(rms/data.length);micRms.push({t:Date.now(),r:rms});micRms=micRms.filter(x=>Date.now()-x.t<60000);ctx.clearRect(0,0,c.width,c.height);ctx.beginPath();for(let i=0;i<data.length;i++){const x=i/(data.length-1)*c.width,y=data[i]/255*c.height;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.strokeStyle='#0a9d66';ctx.lineWidth=2;ctx.stroke();audioRAF=requestAnimationFrame(loop)};loop();}
async function logAudioObservation(){if(!analyser)return;$('logAudioBtn').disabled=true;$('audioStatus').textContent='Sampling level for 10 seconds…';const start=Date.now();await new Promise(r=>setTimeout(r,10000));const x=micRms.filter(s=>s.t>=start).map(s=>s.r);const mean=x.length?x.reduce((a,b)=>a+b,0)/x.length:0;const peak=x.length?Math.max(...x):0;logEvent('patient','audio_observation',`10 s acoustic level observation logged (relative RMS ${mean.toFixed(3)})`,{duration_s:10,relative_rms_mean:mean,relative_rms_peak:peak},'MEASURED');$('audioStatus').textContent='Live audio level only · not recording';$('logAudioBtn').disabled=false;}

async function enableMotion(){
  try{
    if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'){const p=await DeviceOrientationEvent.requestPermission();if(p!=='granted')throw new Error('orientation permission denied');}
    if(typeof DeviceMotionEvent!=='undefined'&&typeof DeviceMotionEvent.requestPermission==='function'){const p=await DeviceMotionEvent.requestPermission();if(p!=='granted')throw new Error('motion permission denied');}
    window.addEventListener('deviceorientation',e=>{const h=e.webkitCompassHeading ?? (e.alpha!=null?(360-e.alpha)%360:null);$('heading').textContent=h==null?'—':Math.round(h)+'°';$('beta').textContent=e.beta==null?'—':e.beta.toFixed(1)+'°';$('gamma').textContent=e.gamma==null?'—':e.gamma.toFixed(1)+'°';});
    window.addEventListener('devicemotion',e=>{const a=e.accelerationIncludingGravity;if(!a)return;const mag=Math.sqrt((a.x||0)**2+(a.y||0)**2+(a.z||0)**2);$('motionMag').textContent=mag.toFixed(2);});
    $('motionNote').textContent='Motion/orientation sensors active.';logEvent('motion','phone_sensors','Phone motion/orientation sensors enabled',{},'MEASURED');
  }catch(e){toast('Motion sensors unavailable: '+e.message);}
}

function saveVitals(){
  const vals={hr:num('vHr'),rr:num('vRr'),spo2:num('vSpo2'),sbp:num('vSbp'),dbp:num('vDbp'),temp:num('vTemp'),avpu:$('vAvpu').value||null,pain:num('vPain')};const bits=[];if(vals.hr!=null)bits.push(`HR ${vals.hr}`);if(vals.rr!=null)bits.push(`RR ${vals.rr}`);if(vals.spo2!=null)bits.push(`SpO₂ ${vals.spo2}%`);if(vals.sbp!=null)bits.push(`BP ${vals.sbp}/${vals.dbp??'—'}`);if(vals.avpu)bits.push(`AVPU ${vals.avpu}`);if(!bits.length){toast('Enter at least one observation');return;}logEvent('patient','manual_vitals',bits.join(' · '),vals,'MANUAL_MEASUREMENT');toast('Vitals logged');
}
function num(id){const v=$(id).value.trim();return v===''?null:Number(v);}

function logScene(){const tags=qsa('#sceneChips button.selected').map(b=>b.dataset.tag),notes=$('sceneNotes').value.trim();if(!tags.length&&!notes){toast('Select a scene tag or add notes');return;}const summary=[tags.join(', '),notes].filter(Boolean).join(' · ');logEvent('scene','scene_observation',summary,{tags,notes},'MANUAL_OBSERVATION');toast('Scene observation logged');}

function searchHazmat(){
  const q=$('hazmatQuery').value.trim().toLowerCase().replace(/^un\s*/,'');if(!q){return;}
  const hit=hazmatDB.find(x=>x.un===q||x.name.toLowerCase().includes(q)||x.aliases.some(a=>a.includes(q)||q.includes(a)));
  if(!hit){$('hazmatResult').innerHTML=`<h3>No local quick-set match</h3><p>V2 intentionally does not guess. Verify <strong>${escapeHtml($('hazmatQuery').value)}</strong> using the current ERG/CAMEO/NIOSH or your agency hazmat resources.</p><p class="muted small">Use the current official ERG/CAMEO/NIOSH or agency resources for confirmation.</p>`;return;}
  $('hazmatResult').dataset.un=hit.un;$('hazmatResult').innerHTML=`<div class="hazard-title">UN ${hit.un} · ${escapeHtml(hit.name)}</div><div class="hazard-grid"><div><span>ERG guide</span><strong>${hit.guide}</strong></div><div><span>Class</span><strong>${escapeHtml(hit.class)}</strong></div><div><span>Primary concern</span>${escapeHtml(hit.primary)}</div><div><span>Initial orientation</span>${escapeHtml(hit.initial)}</div></div><p class="muted small">Offline quick-reference seed only. Confirm against the current official ERG and material-specific resources.</p>`;
}
function logHazmat(){const un=$('hazmatResult').dataset.un,q=$('hazmatQuery').value.trim();const hit=hazmatDB.find(x=>x.un===un);logEvent('hazmat','suspected_hazmat',hit?`Suspected UN ${hit.un}: ${hit.name}`:`Suspected hazmat: ${q||'unspecified'}`,hit||{query:q},'MANUAL_OBSERVATION');toast('Hazmat concern logged');}

