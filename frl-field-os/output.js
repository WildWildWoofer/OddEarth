function saveIncidentDetails(){
  const details={
    patient:$('iPatient').value.trim(),age:$('iAge').value.trim(),sex:$('iSex').value,
    category:$('iCategory').value,priority:$('iPriority').value,destination:$('iDestination').value.trim(),
    complaint:$('iComplaint').value.trim(),assessment:$('iAssessment').value.trim(),treatment:$('iTreatment').value.trim()
  };
  if(!state.incident)startIncident(false);
  state.details=details;
  save();toast('Incident details saved');
}
function logQuickNote(){
  const text=$('quickNoteInput').value.trim();if(!text){toast('Enter a field note');return;}
  logEvent('incident','field_note',text,{note:text},'MANUAL_OBSERVATION');$('quickNoteInput').value='';toast('Field note logged');
}
function cleanLine(v,fallback='Not recorded'){const t=String(v??'').trim();return t||fallback;}
function localDateTime(iso){if(!iso)return'—';return new Date(iso).toLocaleString([], {year:'numeric',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'});}
function vitalString(sourceState=state){
  const e=latestVitalsEvent(sourceState);if(!e)return'No manual vital set logged';
  const d=e.data||{},bits=[];
  if(d.hr!=null)bits.push(`HR ${d.hr} bpm`);if(d.rr!=null)bits.push(`RR ${d.rr}/min`);if(d.spo2!=null)bits.push(`SpO2 ${d.spo2}%`);if(d.sbp!=null)bits.push(`BP ${d.sbp}/${d.dbp??'—'} mmHg`);if(d.temp!=null)bits.push(`Temp ${d.temp} C`);if(d.avpu)bits.push(`AVPU ${d.avpu}`);if(d.pain!=null)bits.push(`Pain ${d.pain}/10`);
  return bits.join(' | ')||'Manual vital set logged';
}
function cameraPulseString(sourceState=state){
  const e=sourceState.timeline.find(x=>x.type==='camera_rppg');if(!e)return'';
  return `Camera pulse estimate ${Math.round(e.data?.hr??0)} bpm${e.confidence!=null?` (quality ${Math.round(e.confidence*100)}%)`:''} [EXPERIMENTAL]`;
}
function generateHandover(sourceState=state){
  if(!sourceState.incident)return'No active incident. Start an incident to generate an ATMIST handover.';
  const d={...emptyDetails(),...(sourceState.details||{})};
  const loc=sourceState.location;
  const env=sourceState.environment;
  const scene=sourceState.timeline.find(e=>e.type==='scene_observation');
  const haz=sourceState.timeline.find(e=>e.domain==='hazmat');
  const pulse=cameraPulseString(sourceState);
  const notes=sourceState.timeline.filter(e=>e.type==='field_note').slice(0,4);
  const recent=sourceState.timeline.slice(0,8).reverse();
  const patientBits=[d.patient||'Patient',d.age?`age ${d.age}`:'age unknown',d.sex||'sex not recorded'].join(' · ');
  const position=loc?`${loc.lat.toFixed(5)}, ${loc.lon.toFixed(5)} (±${Math.round(loc.accuracy||0)} m)`:'Not acquired';
  const sceneText=scene?.summary||'No scene observation logged';
  const envText=env?`${fmt(env.weather?.temperature,1)} C, wind ${fmt(env.weather?.wind_speed,0)} km/h, PM2.5 ${fmt(env.air?.pm2_5,0)} ug/m3, AQI ${fmt(env.air?.aqi,0)} [REMOTE MODEL]`:'No remote environment loaded';
  const lines=[
    'FRL FIELD INCIDENT — ATMIST HANDOVER',
    `Incident: ${sourceState.incident.id}`,
    `Started: ${localDateTime(sourceState.incident.started)}`,
    `Priority: ${cleanLine(d.priority,'Unassigned')} | Type: ${cleanLine(d.category,'Unspecified')}`,
    `Position: ${position}`,
    '',
    `A — ${patientBits}`,
    `T — Incident time ${new Date(sourceState.incident.started).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`,
    `M — ${cleanLine(d.complaint,'Mechanism / chief complaint not recorded')}`,
    `I — ${cleanLine(d.assessment,'Assessment / injuries not recorded')}`,
    `S — ${vitalString(sourceState)}`,
    ...(pulse?[`    ${pulse}`]:[]),
    `T — ${cleanLine(d.treatment,'Treatment / response not recorded')}`,
    `Destination — ${cleanLine(d.destination,'Not recorded')}`,
    '',
    'GUIDED PRIMARY SURVEY',
    ...(sourceState.workflow?.path||BASE_WORKFLOW_KEYS).map(k=>{const s=stepByKey(k);return [s?.phase||k,sourceState.workflow?.answers?.[k]]}).filter(x=>x[1]).map(([k,v])=>`${k}: ${v}`),
    ...(Object.values(sourceState.workflow?.answers||{}).some(Boolean)?[]:['No guided survey entries logged']),
    '',
    'SCENE / EXPOSURE',
    `Scene: ${sceneText}`,
    ...(haz?[`Hazmat: ${haz.summary}`]:[]),
    `Environment: ${envText}`,
    ...(notes.length?['', 'FIELD NOTES', ...notes.map(e=>`${new Date(e.time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} — ${e.summary}`)]:[]),
    '',
    'RECENT TIMELINE',
    ...(recent.length?recent.map(e=>`${new Date(e.time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} | ${e.domain.toUpperCase()} | ${e.summary} [${e.evidence}]`):['No observations logged']),
    '',
    'Evidence labels: manual/measured values, experimental estimates and remote-model context are intentionally kept distinct.'
  ];
  return lines.join('\n');
}
function renderReport(){
  $('handoverText').textContent=generateHandover();
  $('reportGeneratedAt').textContent=`Generated ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;
  $('eventCount').textContent=`${state.timeline.length} EVENT${state.timeline.length===1?'':'S'}`;
}
function renderArchives(){
  const el=$('archiveList');if(!archives.length){el.innerHTML='No archived incidents yet. Starting a new incident automatically archives the previous populated incident.';return;}
  el.innerHTML=archives.slice(0,10).map(a=>`<div class="archive-item" data-archive-id="${escapeHtml(a.incident?.id||'')}"><strong>${escapeHtml(a.incident?.id||'Incident')}</strong><small>${escapeHtml(localDateTime(a.incident?.started))} · ${a.timeline?.length||0} events · ${escapeHtml(a.details?.patient||'No patient label')}</small><div class="archive-actions"><button class="btn" data-archive-copy="${escapeHtml(a.incident?.id||'')}">Copy</button><button class="btn" data-archive-json="${escapeHtml(a.incident?.id||'')}">JSON</button></div></div>`).join('');
}
async function copyText(text,success='Copied'){try{await navigator.clipboard.writeText(text);toast(success);}catch{const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();toast(success);}}
function copyReport(){if(!state.incident){toast('No incident to copy');return;}copyText(generateHandover(),'Handover copied');}
async function shareReport(){
  if(!state.incident){toast('No incident to share');return;}const text=generateHandover();
  if(navigator.share){try{await navigator.share({title:`FRL ${state.incident.id}`,text});return;}catch(e){if(e.name==='AbortError')return;}}
  copyText(text,'Share unavailable — handover copied');
}
function printReport(){if(!state.incident){toast('No incident to print');return;}navigate('report');setTimeout(()=>window.print(),80);}
function downloadText(){if(!state.incident){toast('No incident to export');return;}download(`${state.incident.id}-handover.txt`,generateHandover(),'text/plain;charset=utf-8');}
function exportArchiveAll(){if(!archives.length){toast('Archive is empty');return;}download(`FRL-incident-archive-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(archives,null,2),'application/json');}
function handleArchiveClick(e){
  const copy=e.target.closest('[data-archive-copy]'),json=e.target.closest('[data-archive-json]');if(!copy&&!json)return;
  const id=(copy||json).dataset.archiveCopy||(copy||json).dataset.archiveJson;const a=archives.find(x=>x.incident?.id===id);if(!a)return;
  if(copy)copyText(a.handover||generateHandover(a),'Archived handover copied');
  if(json)download(`${id}.json`,JSON.stringify(a,null,2),'application/json');
}

function exportJson(){if(!state.incident){toast('No incident to export');return;}const out={...state,handover:generateHandover(),exportedAt:nowIso()};download(`${state.incident.id}.json`,JSON.stringify(out,null,2),'application/json');}
function exportCsv(){if(!state.timeline.length){toast('Timeline is empty');return;}const rows=[['time','domain','type','evidence','confidence','latitude','longitude','summary','data_json'],...state.timeline.slice().reverse().map(e=>[e.time,e.domain,e.type,e.evidence,e.confidence??'',e.lat??'',e.lon??'',e.summary,JSON.stringify(e.data)])];const csv=rows.map(r=>'"'+r.map(v=>String(v).replaceAll('"','""')).join('\",\"')+'"').join('\n');download(`${state.incident?.id||'FRL'}-timeline.csv`,csv,'text/csv');}
function download(name,body,type){const blob=new Blob([body],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function clearData(){if(!confirm('Clear the current local incident? Archived incidents will be kept.'))return;Object.assign(state,freshState());localStorage.removeItem(STORE_KEY);renderAll();toast('Current incident cleared');}

function bind(){
  qsa('[data-target]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.target)));
  qsa('.back').forEach(b=>b.addEventListener('click',()=>navigate('home')));
  $('newIncidentBtn').onclick=()=>{
    if(state.incident&&(state.timeline.length||state.details.patient||state.details.complaint)&&!confirm('Start a new incident? The current populated incident will be archived locally first.'))return;
    startIncident();
  };
  $('saveIncidentMetaBtn').onclick=saveIncidentDetails;
  $('quickNoteBtn').onclick=logQuickNote;
  $('startGuideBtn').onclick=()=>startWorkflow(false);
  $('restartWorkflowBtn').onclick=restartWorkflow;
  $('workflowNextBtn').onclick=()=>commitWorkflowAnswer(false);
  $('workflowSkipBtn').onclick=()=>commitWorkflowAnswer(true);
  $('workflowBackBtn').onclick=workflowBack;
  $('dictateBtn').onclick=toggleDictation;
  $('speakPromptBtn').onclick=speakWorkflowPrompt;
  $('voicePromptBtn').onclick=toggleVoicePrompts;
  $('workflowAnswer').addEventListener('input',updateCriticalBanner);
  $('workflowQuickChoices').addEventListener('click',e=>{const b=e.target.closest('[data-workflow-choice]');if(b)appendWorkflowChoice(b.dataset.workflowChoice);});
  $('patientCamBtn').onclick=()=>startCamera('patient');$('sceneCamBtn').onclick=()=>startCamera('scene');$('patientSnapBtn').onclick=()=>captureSnapshot('patient');$('sceneSnapBtn').onclick=()=>captureSnapshot('scene');$('rppgBtn').onclick=startRppg;$('saveVitalsBtn').onclick=saveVitals;$('breathTapBtn').onclick=tapBreath;$('resetBreathsBtn').onclick=resetBreaths;$('micBtn').onclick=startMic;$('logAudioBtn').onclick=logAudioObservation;$('motionBtn').onclick=enableMotion;
  qsa('#sceneChips button').forEach(b=>b.onclick=()=>b.classList.toggle('selected'));$('logSceneBtn').onclick=logScene;
  $('refreshEnvBtn').onclick=refreshEnvironment;$('locateBtn').onclick=()=>acquireLocation(true);$('findResourcesBtn').onclick=findResources;
  $('hazmatSearchBtn').onclick=searchHazmat;$('hazmatQuery').addEventListener('keydown',e=>{if(e.key==='Enter')searchHazmat()});$('hazmatLogBtn').onclick=logHazmat;
  $('copyReportBtn').onclick=copyReport;$('shareReportBtn').onclick=shareReport;$('printReportBtn').onclick=printReport;$('downloadTxtBtn').onclick=downloadText;
  $('exportBtn').onclick=exportJson;$('exportCsvBtn').onclick=exportCsv;$('exportArchiveBtn').onclick=exportArchiveAll;$('clearTimelineBtn').onclick=clearData;
  $('archiveList').addEventListener('click',handleArchiveClick);
  window.addEventListener('online',updateNetwork);window.addEventListener('offline',updateNetwork);
}

function clock(){const el=$('liveClock');if(!el)return;const d=new Date();el.textContent=d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});}

async function boot(){bind();updateNetwork();speechPromptEnabled=state.workflow?.voicePrompts!==false;renderAll();setupRecognition();clock();setInterval(clock,1000);if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});if(state.location){$('locationText').textContent=`${state.location.lat.toFixed(5)}, ${state.location.lon.toFixed(5)} ±${Math.round(state.location.accuracy||0)} m`;}
}
boot();
