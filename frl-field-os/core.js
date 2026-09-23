'use strict';

const $ = (id) => document.getElementById(id);
const qs = (s) => document.querySelector(s);
const qsa = (s) => [...document.querySelectorAll(s)];

const STORE_KEY = 'frl-field-os-v4';
const LEGACY_KEY = 'frl-field-os-v3';
const LEGACY_V1_KEY = 'frl-field-os-v1';
const ARCHIVE_KEY = 'frl-field-os-v4-archive';
const LEGACY_ARCHIVE_KEY = 'frl-field-os-v3-archive';
const state = loadState();
let archives = loadArchives();
let patientStream = null;
let sceneStream = null;
let micStream = null;
let audioCtx = null;
let analyser = null;
let audioRAF = null;
let micRms = [];
let rppgTimer = null;
let rppgSamples = [];
let map = null;
let userMarker = null;
let resourceLayer = null;
let breathTaps = [];
let recognition = null;
let isListening = false;
let recognitionBaseText = '';
let recognitionFinalText = '';
let speechPromptEnabled = true;

const hazmatDB = [
  {un:'1005',name:'Ammonia, anhydrous',guide:'125',class:'2.3 toxic gas / 2.1',primary:'Toxic inhalation; corrosive; flammable range possible.',initial:'Move upwind/uphill. Avoid vapour cloud. Specialist PPE/SCBA.',aliases:['ammonia']},
  {un:'1017',name:'Chlorine',guide:'124',class:'2.3 toxic gas',primary:'Severe inhalation hazard; corrosive oxidizing gas.',initial:'Move upwind/uphill. Avoid low areas and vapour cloud. SCBA.',aliases:['chlorine gas']},
  {un:'1049',name:'Hydrogen, compressed',guide:'115',class:'2.1 flammable gas',primary:'Extremely flammable; invisible flame possible.',initial:'Eliminate ignition sources if safe. Do not approach leaking container.',aliases:['hydrogen']},
  {un:'1072',name:'Oxygen, compressed',guide:'122',class:'2.2 oxidizer',primary:'Strong oxidizer; accelerates combustion.',initial:'Keep combustibles and oils away. Ventilate if safe.',aliases:['oxygen']},
  {un:'1075',name:'Petroleum gases, liquefied / LPG',guide:'115',class:'2.1 flammable gas',primary:'Flammable vapour; BLEVE risk if heated.',initial:'Isolate ignition. Stay away from tank ends. Consider evacuation.',aliases:['lpg','propane butane']},
  {un:'1090',name:'Acetone',guide:'127',class:'3 flammable liquid',primary:'Highly flammable vapour; CNS effects at high exposure.',initial:'Remove ignition; ventilate; avoid vapour accumulation.',aliases:['acetone']},
  {un:'1170',name:'Ethanol / Ethyl alcohol',guide:'127',class:'3 flammable liquid',primary:'Flammable liquid and vapour.',initial:'Remove ignition sources; contain spill if trained and safe.',aliases:['ethanol','ethyl alcohol']},
  {un:'1202',name:'Diesel fuel / Gas oil',guide:'128',class:'3 combustible liquid',primary:'Combustible; aspiration hazard; environmental contamination.',initial:'Control ignition; prevent entry into drains/waterways.',aliases:['diesel','gas oil']},
  {un:'1203',name:'Gasoline / Petrol',guide:'128',class:'3 flammable liquid',primary:'Highly flammable vapour; vapours can travel to ignition source.',initial:'Move upwind; eliminate ignition; avoid low areas.',aliases:['gasoline','petrol']},
  {un:'1230',name:'Methanol',guide:'131',class:'3 flammable / toxic',primary:'Flammable; toxic by ingestion, inhalation and skin absorption.',initial:'Avoid exposure and ignition; use appropriate PPE.',aliases:['methanol','methyl alcohol']},
  {un:'1789',name:'Hydrochloric acid',guide:'157',class:'8 corrosive',primary:'Corrosive; irritating/toxic hydrogen chloride vapour.',initial:'Move upwind; avoid contact; protect airway/eyes/skin.',aliases:['hydrochloric acid','hcl']},
  {un:'1791',name:'Hypochlorite solution',guide:'154',class:'8 corrosive',primary:'Corrosive oxidizer; may release chlorine when mixed with acids.',initial:'Do not mix. Move upwind. Avoid contact and incompatible materials.',aliases:['bleach','sodium hypochlorite']},
  {un:'1824',name:'Sodium hydroxide solution',guide:'154',class:'8 corrosive',primary:'Severe corrosive injury risk.',initial:'Avoid skin/eye contact; prevent spread; copious water decon per protocol.',aliases:['sodium hydroxide','caustic soda','lye']},
  {un:'1830',name:'Sulfuric acid',guide:'137',class:'8 corrosive',primary:'Strong corrosive; reacts with water/metals; heat generation.',initial:'Avoid contact and incompatible materials; specialist spill response.',aliases:['sulfuric acid','sulphuric acid']},
  {un:'1977',name:'Nitrogen, refrigerated liquid',guide:'120',class:'2.2 cryogenic gas',primary:'Asphyxiation and cryogenic injury; pressure expansion.',initial:'Ventilate; avoid confined spaces; protect from cold contact.',aliases:['liquid nitrogen','nitrogen']},
  {un:'2031',name:'Nitric acid',guide:'157',class:'8 corrosive / oxidizer',primary:'Severe corrosive and oxidizing hazard; toxic fumes possible.',initial:'Move upwind; isolate combustibles; full chemical PPE/SCBA as indicated.',aliases:['nitric acid']},
  {un:'3082',name:'Environmentally hazardous liquid, n.o.s.',guide:'171',class:'9',primary:'Hazard varies by substance; environmental release concern.',initial:'Identify exact product/SDS; prevent environmental spread if safe.',aliases:['environmentally hazardous liquid']}
];

const WORKFLOW_STEPS = [
  {key:'safety',phase:'SCENE SAFETY',title:'Is it safe to approach?',hint:'Describe hazards, PPE, access, and whether additional resources are needed.',choices:['Scene safe','Traffic hazard','Fire / smoke','Chemical hazard','Violence risk','Need backup']},
  {key:'impression',phase:'FIRST LOOK',title:'What happened, and what is your immediate impression?',hint:'Tell me patient count, approximate age, mechanism or chief complaint, and any catastrophic bleeding.',choices:['Medical','Trauma','RTC','Major bleeding','No major bleeding']},
  {key:'response',phase:'RAPID LIFE-THREAT CHECK',title:'Is the patient responsive and breathing normally?',hint:'Say what you observe. If there is an immediate life threat, prioritize hands-on care and your local resuscitation protocol.',choices:['Alert and breathing','Responsive to voice','Responsive to pain','Unresponsive','Breathing normally','Abnormal / gasping']},
  {key:'airway',phase:'A — AIRWAY',title:'Tell me about the airway.',hint:'Patent or threatened? Any obstruction, secretions, swelling, facial injury, or airway intervention?',choices:['Airway patent','Airway threatened','Obstruction suspected','Secretions / blood','Airway intervention']},
  {key:'breathing',phase:'B — BREATHING',title:'Tell me about breathing.',hint:'Rate, work of breathing, symmetry, breath sounds if assessed, and SpO₂ if available.',choices:['Breathing comfortable','Increased work','Unequal chest movement','Cyanosis','SpO₂ available']},
  {key:'circulation',phase:'C — CIRCULATION',title:'Tell me about circulation and bleeding.',hint:'Pulse/heart rate, blood pressure, skin/perfusion, capillary refill, and any bleeding.',choices:['Pulse present','Major bleeding controlled','Skin warm','Skin cool / clammy','BP available']},
  {key:'disability',phase:'D — DISABILITY',title:'What is the neurological status?',hint:'AVPU/GCS, pupils, glucose if measured, pain, weakness, seizure activity, or confusion.',choices:['Alert','Confused','Voice','Pain','Unresponsive','Glucose available']},
  {key:'exposure',phase:'E — EXPOSURE',title:'What else do you find on exposure and examination?',hint:'Describe injuries, temperature concerns, rashes, burns, deformity, tenderness, or environmental exposure. Preserve dignity and warmth.',choices:['No additional findings','Bleeding / wound','Burn','Deformity','Temperature concern','Exposure concern']},
  {key:'history',phase:'HISTORY',title:'Give me the key history.',hint:'Symptoms, allergies, medications, past history, last oral intake, and events leading up to this incident—whatever is available.',choices:['History unavailable','Allergies known','Medications known','Past history known']},
  {key:'vitals',phase:'VITALS',title:'Dictate the latest vital signs.',hint:'For example: “heart rate 112, respiratory rate 24, sats 95, blood pressure 108 over 70, temperature 36.8.”',choices:['Vitals unavailable','Repeat vitals','Use patient sensors']},
  {key:'interventions',phase:'INTERVENTIONS',title:'What has been done, and how did the patient respond?',hint:'Record interventions and observed response. Follow your scope of practice and local protocol.',choices:['No intervention yet','Improved','No change','Deteriorated']},
  {key:'transport',phase:'TRANSPORT / HANDOVER',title:'What is the plan from here?',hint:'Dictate responder priority, destination, transport status, and anything the receiving team must know.',choices:['Critical','High','Standard','Low','Destination known','Ready for handover']}
];

function emptyDetails(){
  return {patient:'',age:'',sex:'',category:'',priority:'',destination:'',complaint:'',assessment:'',treatment:''};
}
const BASE_WORKFLOW_KEYS = WORKFLOW_STEPS.map(x=>x.key);
const ADAPTIVE_STEPS = {
  hemorrhage:{key:'hemorrhage',phase:'X — MAJOR HAEMORRHAGE',title:'Document the major bleeding now.',hint:'Where is it, how severe does it appear, and what has already been done? Prioritize hands-on care and local haemorrhage-control protocol.',choices:['Bleeding identified','Bleeding controlled','Bleeding ongoing','Multiple bleeding sites','Additional help requested']},
  resus:{key:'resus',phase:'IMMEDIATE RESUSCITATION STATUS',title:'Give me the immediate resuscitation status.',hint:'Describe responsiveness, breathing, pulse/AED status if assessed, help activated, and changes since first contact. Follow your local resuscitation protocol.',choices:['Help activated','AED available','Breathing reassessed','Pulse reassessed','Condition changed']},
  respiratory_detail:{key:'respiratory_detail',phase:'FOCUSED BREATHING CHECK',title:'Give me a focused breathing update.',hint:'Describe work of breathing, chest symmetry, audible sounds, colour, SpO₂ trend if available, and whether the patient is worsening or improving.',choices:['Worsening','Improving','No change','Chest asymmetry','Audible wheeze / stridor']},
  trauma_detail:{key:'trauma_detail',phase:'FOCUSED TRAUMA CHECK',title:'What trauma findings matter most?',hint:'Describe mechanism, obvious injuries, deformity, tenderness, bleeding, and any change during reassessment.',choices:['Head / neck','Chest','Abdomen / pelvis','Limb injury','No additional trauma finding']},
  neuro_detail:{key:'neuro_detail',phase:'FOCUSED NEURO CHECK',title:'Give me a focused neurological update.',hint:'Describe AVPU/GCS if used, speech, facial symmetry, limb movement, pupils, seizure activity, glucose if measured, and time last known well if relevant.',choices:['Speech change','Facial asymmetry','One-sided weakness','Seizure','Glucose available','No focal finding']},
  exposure_detail:{key:'exposure_detail',phase:'ENVIRONMENT / EXPOSURE',title:'Tell me what the environment may be doing to the patient or crew.',hint:'Describe smoke, chemicals, heat, cold, water, confined space, electrical risk, or other exposure and whether the scene remains safe.',choices:['Smoke exposure','Chemical exposure','Heat','Cold','Water / immersion','Scene remains safe']},
  reassess:{key:'reassess',phase:'EARLY REASSESSMENT',title:'Something you dictated deserves an early repeat check. What has changed?',hint:'Repeat the most important observations or vital signs and describe whether the patient is improving, unchanged, or deteriorating.',choices:['Improving','No change','Deteriorating','Repeat vitals obtained']},
};
function allWorkflowSteps(){return [...WORKFLOW_STEPS,...Object.values(ADAPTIVE_STEPS)];}
function stepByKey(key){return allWorkflowSteps().find(x=>x.key===key);}
function emptyWorkflow(){return {active:false,step:0,path:[...BASE_WORKFLOW_KEYS],started:null,completed:null,answers:{},voicePrompts:true,adaptiveNotes:[]};}
function freshState(){return {version:4,incident:null,timeline:[],location:null,environment:null,latest:{},details:emptyDetails(),workflow:emptyWorkflow()};}
function normalizeState(raw){
  const base=freshState();
  if(!raw||typeof raw!=='object')return base;
  const wf={...emptyWorkflow(),...(raw.workflow||{}),answers:{...(raw.workflow?.answers||{})}};
  if(!Array.isArray(wf.path)||!wf.path.length)wf.path=[...BASE_WORKFLOW_KEYS];
  return {...base,...raw,version:4,latest:raw.latest||{},timeline:Array.isArray(raw.timeline)?raw.timeline:[],details:{...emptyDetails(),...(raw.details||{})},workflow:wf};
}

function loadState(){
  try{
    const current=localStorage.getItem(STORE_KEY);
    if(current)return normalizeState(JSON.parse(current));
    const legacy=localStorage.getItem(LEGACY_KEY);
    if(legacy)return normalizeState(JSON.parse(legacy));
    const v1=localStorage.getItem(LEGACY_V1_KEY);
    if(v1)return normalizeState(JSON.parse(v1));
  }catch{}
  return freshState();
}
function loadArchives(){
  try{
    const current=JSON.parse(localStorage.getItem(ARCHIVE_KEY)||'null');
    if(Array.isArray(current))return current;
    const legacy=JSON.parse(localStorage.getItem(LEGACY_ARCHIVE_KEY)||'[]');
    return Array.isArray(legacy)?legacy:[];
  }catch{return[];}
}
function saveArchives(){localStorage.setItem(ARCHIVE_KEY,JSON.stringify(archives.slice(0,50)));}
function save(){localStorage.setItem(STORE_KEY,JSON.stringify(state));renderAll();}
function nowIso(){return new Date().toISOString();}
function makeId(){return 'FRL-'+new Date().toISOString().replace(/\D/g,'').slice(0,14)+'-'+Math.random().toString(36).slice(2,6).toUpperCase();}
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800);}
function fmt(v,d=0){return Number.isFinite(Number(v))?Number(v).toFixed(d):'—';}
function escapeHtml(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

function logEvent(domain, type, summary, data={}, evidence='MANUAL', confidence=null){
  if(!state.incident) startIncident(false);
  state.timeline.unshift({id:crypto.randomUUID?.() || Math.random().toString(36).slice(2), time:nowIso(), domain, type, summary, data, evidence, confidence, lat:state.location?.lat ?? null, lon:state.location?.lon ?? null});
  state.timeline = state.timeline.slice(0,1000);
  state.latest[domain] = {time:nowIso(),summary,evidence,data};
  save();
}

function archiveCurrent(silent=true){
  if(!state.incident || (!state.timeline.length && !state.details.patient && !state.details.complaint))return;
  const snapshot=JSON.parse(JSON.stringify(state));
  snapshot.incident={...snapshot.incident,status:'archived',archived:nowIso()};
  snapshot.handover=generateHandover(snapshot);
  archives=archives.filter(a=>a.incident?.id!==snapshot.incident.id);
  archives.unshift(snapshot);
  archives=archives.slice(0,50);
  saveArchives();
  if(!silent)toast('Incident archived locally');
}

function startIncident(announce=true){
  if(state.incident && (state.timeline.length || state.details.patient || state.details.complaint))archiveCurrent(true);
  const next=freshState();
  Object.assign(state,next,{incident:{id:makeId(),started:nowIso(),status:'active'}});
  save();
  if(announce)toast('New incident started');
}

function navigate(id){
  qsa('.view').forEach(v=>v.classList.toggle('active',v.id===id));
  qsa('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.target===id));
  window.scrollTo({top:0,behavior:'auto'});
  if(id==='map') setTimeout(initMap,50);
  if(id==='workflow'){if(!state.incident)startIncident(false);state.workflow.active=true;save();setTimeout(()=>renderWorkflow(false),20);}
}

function renderAll(){
  const hasIncident=!!state.incident;
  $('incidentTitle').textContent=hasIncident?state.incident.id:'No active incident';
  $('incidentMeta').textContent=hasIncident?`Started ${new Date(state.incident.started).toLocaleString()} · ${state.timeline.length} observations`:'Start an incident to unify patient, scene and environmental observations.';
  const domains=['patient','scene','environment','location','hazmat','motion'];
  const covered=domains.filter(d=>state.latest[d] || (d==='location'&&state.location) || (d==='environment'&&state.environment)).length;
  const pct=Math.round(covered/domains.length*100);
  $('fusionScore').textContent=pct+'%';
  $('fusionRing').style.width=pct+'%';
  const items=[
    ['Patient',latestVitalsLabel()],
    ['Scene',state.latest.scene?.summary || 'No scene observation'],
    ['Environment',state.environment?`${fmt(state.environment.weather.temperature,1)} °C · PM2.5 ${fmt(state.environment.air.pm2_5,0)}`:'No remote environment'],
    ['Position',state.location?`${state.location.lat.toFixed(5)}, ${state.location.lon.toFixed(5)}`:'No position']
  ];
  $('synthesis').innerHTML=items.map(([k,v])=>`<div class="synthesis-item"><span>${k}</span><strong>${escapeHtml(v)}</strong></div>`).join('');
  renderIncidentFields();
  renderPriority();
  $('homeOutputStatus').textContent=hasIncident?`${state.timeline.length} events · handover ready`:'No incident yet';
  renderWorkflow(false);
  renderTimeline();
  renderEnv();
  renderReport();
  renderArchives();
}

function latestVitalsEvent(sourceState=state){return sourceState.timeline.find(e=>e.type==='manual_vitals')||null;}
function latestVitalsLabel(){
  const e=latestVitalsEvent();
  if(!e)return state.latest.patient?.summary||'No patient observations';
  const d=e.data||{},bits=[];
  if(d.hr!=null)bits.push(`HR ${d.hr}`); if(d.rr!=null)bits.push(`RR ${d.rr}`); if(d.spo2!=null)bits.push(`SpO₂ ${d.spo2}%`); if(d.sbp!=null)bits.push(`BP ${d.sbp}/${d.dbp??'—'}`); if(d.avpu)bits.push(d.avpu);
  return bits.join(' · ')||e.summary;
}
function setField(id,value){const el=$(id);if(el&&document.activeElement!==el)el.value=value??'';}
function renderIncidentFields(){
  const d=state.details||emptyDetails();
  setField('iPatient',d.patient);setField('iAge',d.age);setField('iSex',d.sex);setField('iCategory',d.category);setField('iPriority',d.priority);setField('iDestination',d.destination);setField('iComplaint',d.complaint);setField('iAssessment',d.assessment);setField('iTreatment',d.treatment);
}
function renderPriority(){
  const p=(state.details?.priority||'').toLowerCase();const el=$('homePriorityBadge');
  el.className='priority-chip '+(p||'neutral');el.textContent=state.details?.priority?.toUpperCase()||'UNSET';
}

function renderTimeline(){
  if(!state.timeline.length){$('timelineList').innerHTML='<div class="subtle">No observations logged yet.</div>';return;}
  $('timelineList').innerHTML=state.timeline.map(e=>`<article class="timeline-item"><div><span class="kind">${escapeHtml(e.domain.toUpperCase())} · ${escapeHtml(e.evidence)}</span> <span class="time">${new Date(e.time).toLocaleTimeString()}</span></div><p>${escapeHtml(e.summary)}</p><div class="meta">${e.confidence!=null?`confidence ${Math.round(e.confidence*100)}% · `:''}${e.lat!=null?`${e.lat.toFixed(5)}, ${e.lon.toFixed(5)} · `:''}${new Date(e.time).toLocaleDateString()}</div></article>`).join('');
}

function updateNetwork(){const on=navigator.onLine;$('netBadge').textContent=on?'ONLINE':'OFFLINE';$('netBadge').classList.toggle('online',on);$('netBadge').classList.toggle('offline',!on);}

