function workflowPath(){
  if(!state.workflow)state.workflow=emptyWorkflow();
  if(!Array.isArray(state.workflow.path)||!state.workflow.path.length)state.workflow.path=[...BASE_WORKFLOW_KEYS];
  return state.workflow.path;
}
function workflowStepAt(i=state.workflow.step){return stepByKey(workflowPath()[i])||WORKFLOW_STEPS[0];}
function workflowAnswer(step=state.workflow.step){return String(state.workflow?.answers?.[workflowStepAt(step)?.key]||'');}
function startWorkflow(restart=false){
  if(!state.incident)startIncident(false);
  if(restart || !state.workflow) state.workflow=emptyWorkflow();
  state.workflow.active=true;
  state.workflow.started=state.workflow.started||nowIso();
  state.workflow.voicePrompts=state.workflow.voicePrompts!==false;
  speechPromptEnabled=state.workflow.voicePrompts;
  save();navigate('workflow');renderWorkflow(true);
}
function restartWorkflow(){
  if(state.workflow && Object.keys(state.workflow.answers||{}).length && !confirm('Restart the guided response? Existing workflow answers remain in the incident timeline but the guide fields will reset.'))return;
  state.workflow=emptyWorkflow();state.workflow.active=true;state.workflow.started=nowIso();save();renderWorkflow(true);
}
function renderWorkflow(speak=false){
  if(!$('workflowQuestion'))return;
  if(!state.workflow)state.workflow=emptyWorkflow();
  const path=workflowPath(),total=path.length;
  const idx=Math.max(0,Math.min(state.workflow.step||0,total-1));state.workflow.step=idx;
  const step=workflowStepAt(idx);
  $('workflowProgressLabel').textContent=`Step ${idx+1} of ${total}`;
  $('workflowProgress').style.width=`${Math.round(((idx+1)/total)*100)}%`;
  $('workflowSteps').innerHTML=path.map((key,i)=>{const x=stepByKey(key);return `<li class="${i<idx?'done':i===idx?'active':''}"><span>${escapeHtml((x?.phase||key).replace(/^[A-E] — /,''))}</span>${!BASE_WORKFLOW_KEYS.includes(key)?'<small>adaptive</small>':''}</li>`}).join('');
  $('workflowPhase').textContent=step.phase;$('workflowQuestion').textContent=step.title;$('workflowHint').textContent=step.hint;
  if(document.activeElement!==$('workflowAnswer'))$('workflowAnswer').value=workflowAnswer(idx);
  $('dictationInterim').textContent='';
  $('workflowQuickChoices').innerHTML=(step.choices||[]).map(c=>`<button class="workflow-choice" data-workflow-choice="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('');
  $('workflowBackBtn').disabled=idx===0;$('workflowNextBtn').textContent=idx===total-1?'Save & finish':'Save & continue';
  $('voicePromptBtn').textContent=speechPromptEnabled?'Voice prompts on':'Voice prompts off';
  if($('adaptiveStatus')){const n=path.filter(k=>!BASE_WORKFLOW_KEYS.includes(k)).length;$('adaptiveStatus').textContent=n?`${n} focused ${n===1?'prompt':'prompts'} added from this incident`:'Listening for findings that need a focused follow-up';}
  renderConversationTrail();renderWorkflowMemory();updateCriticalBanner();if(speak&&speechPromptEnabled)setTimeout(speakWorkflowPrompt,120);
}
function renderConversationTrail(){
  const el=$('conversationTrail');if(!el)return;
  const answered=workflowPath().slice(0,state.workflow.step).map(k=>[stepByKey(k),state.workflow.answers?.[k]]).filter(x=>x[1]).slice(-4);
  el.innerHTML=answered.length?answered.map(([s,a])=>`<div class="conversation-turn"><span>${escapeHtml(s.phase)}</span><p>${escapeHtml(a)}</p></div>`).join(''):'<div class="conversation-empty">The conversation will stay here as you move through the response.</div>';
}
function renderWorkflowMemory(){
  const answers=state.workflow?.answers||{};
  const rows=workflowPath().map(k=>{const s=stepByKey(k);return [s?.phase||k,answers[k]]}).filter(x=>x[1]);
  $('workflowMemory').innerHTML=rows.length?rows.map(([k,v])=>`<div class="memory-item"><span>${escapeHtml(k)}</span><p>${escapeHtml(v)}</p></div>`).join(''):'<div class="memory-empty">Nothing captured yet. Your answers will appear here as the guide progresses.</div>';
}
function appendWorkflowChoice(text){const el=$('workflowAnswer'),cur=el.value.trim();el.value=cur?`${cur}${/[.!?]$/.test(cur)?'':' ;'} ${text}`:text;el.focus();updateCriticalBanner();}
function detectImmediateThreat(text){const t=String(text||'').toLowerCase();return /unresponsive|not breathing|no breathing|gasping|agonal|no pulse|pulseless|airway obstruct|airway blocked|massive bleeding|catastrophic bleeding|exsanguinat|severe respiratory distress/.test(t);}
function updateCriticalBanner(){const all=Object.values(state.workflow?.answers||{}).join(' ')+' '+($('workflowAnswer')?.value||'');$('criticalBanner').hidden=!detectImmediateThreat(all);}
function parseNumber(text,patterns){for(const p of patterns){const m=text.match(p);if(m)return Number(m[1]);}return null;}
function parseClinicalSpeech(text){
  const t=String(text||'').toLowerCase().replace(/\bpoint\b/g,'.');const out={vitals:{},details:{}};
  out.vitals.hr=parseNumber(t,[/(?:heart rate|pulse|hr)\s*(?:is|of|at|equals)?\s*(\d{2,3})\b/]);
  out.vitals.rr=parseNumber(t,[/(?:respiratory rate|respiration rate|resp rate|rr)\s*(?:is|of|at|equals)?\s*(\d{1,2})\b/]);
  out.vitals.spo2=parseNumber(t,[/(?:spo2|sp ?o ?2|sats?|oxygen saturation)\s*(?:is|of|at|equals)?\s*(\d{2,3})\b/]);
  const bp=t.match(/(?:blood pressure|bp)\s*(?:is|of|at|equals)?\s*(\d{2,3})\s*(?:over|\/|by)\s*(\d{2,3})/);if(bp){out.vitals.sbp=Number(bp[1]);out.vitals.dbp=Number(bp[2]);}
  out.vitals.temp=parseNumber(t,[/(?:temperature|temp)\s*(?:is|of|at|equals)?\s*(\d{2}(?:\.\d)?)/]);out.vitals.pain=parseNumber(t,[/(?:pain|pain score)\s*(?:is|of|at|equals)?\s*(\d{1,2})\b/]);
  if(/\bunresponsive\b/.test(t))out.vitals.avpu='Unresponsive';else if(/respond(?:s|ing)? to pain|\bonly pain\b/.test(t))out.vitals.avpu='Pain';else if(/respond(?:s|ing)? to voice|\bonly voice\b/.test(t))out.vitals.avpu='Voice';else if(/\balert\b/.test(t))out.vitals.avpu='Alert';
  const age=t.match(/\b(\d{1,3})\s*(?:year|years|yr|yo|y\/o)(?:\s*old)?\b/);if(age)out.details.age=age[1];
  if(/\bfemale\b|\bwoman\b|\bgirl\b/.test(t))out.details.sex='Female';else if(/\bmale\b|\bman\b|\bboy\b/.test(t))out.details.sex='Male';
  if(/road traffic|traffic collision|motor vehicle|mvc|rtc|car crash|vehicle collision/.test(t))out.details.category='Road traffic collision';else if(/fall|stab|gunshot|trauma|fracture|injury|assault/.test(t))out.details.category='Trauma';else if(/fire|smoke/.test(t))out.details.category='Fire / smoke';else if(/chemical|hazmat|spill|gas leak/.test(t))out.details.category='Hazmat';
  if(/\bcritical\b/.test(t))out.details.priority='Critical';else if(/\bhigh priority\b/.test(t))out.details.priority='High';else if(/\bstandard priority\b/.test(t))out.details.priority='Standard';else if(/\blow priority\b/.test(t))out.details.priority='Low';return out;
}
function applyParsedWorkflow(step,text){
  const parsed=parseClinicalSpeech(text),v=parsed.vitals,d=parsed.details;Object.assign(state.details,Object.fromEntries(Object.entries(d).filter(([,x])=>x!==''&&x!=null)));
  if(step.key==='impression'&&text&&!state.details.complaint)state.details.complaint=text;
  if(['airway','breathing','circulation','disability','exposure','hemorrhage','respiratory_detail','trauma_detail','neuro_detail','exposure_detail','reassess'].includes(step.key)&&text)state.details.assessment=[state.details.assessment,`${step.phase}: ${text}`].filter(Boolean).join('\n');
  if(step.key==='interventions'&&text)state.details.treatment=text;
  if(step.key==='transport'){const dest=text.match(/(?:destination|transport(?:ing)? to|going to|to)\s+([A-Z][A-Za-z0-9 .'-]{2,60})/i);if(dest&&!state.details.destination)state.details.destination=dest[1].trim();}
  const hasVitals=Object.values(v).some(x=>x!==null&&x!==undefined);if(hasVitals){const prior=latestVitalsEvent(state)?.data||{},observed=Object.fromEntries(Object.entries(v).filter(([,x])=>x!==null&&x!==undefined)),merged={...prior,...observed};const bits=[];if(merged.hr!=null)bits.push(`HR ${merged.hr}`);if(merged.rr!=null)bits.push(`RR ${merged.rr}`);if(merged.spo2!=null)bits.push(`SpO₂ ${merged.spo2}%`);if(merged.sbp!=null)bits.push(`BP ${merged.sbp}/${merged.dbp??'—'}`);if(merged.temp!=null)bits.push(`Temp ${merged.temp}`);if(merged.avpu)bits.push(`AVPU ${merged.avpu}`);if(merged.pain!=null)bits.push(`Pain ${merged.pain}/10`);state.timeline.unshift({id:crypto.randomUUID?.()||Math.random().toString(36).slice(2),time:nowIso(),domain:'patient',type:'manual_vitals',summary:bits.join(' · '),data:merged,observed_now:observed,evidence:'MANUAL_MEASUREMENT',confidence:null,lat:state.location?.lat??null,lon:state.location?.lon??null});state.latest.patient={time:nowIso(),summary:bits.join(' · '),evidence:'MANUAL_MEASUREMENT',data:merged};}
}
function insertAdaptiveAfterCurrent(keys,reason){
  const path=workflowPath(),at=state.workflow.step+1;let added=0;
  keys.forEach((k,offset)=>{if(!path.includes(k)){path.splice(at+added,0,k);added++;}});
  if(added){state.workflow.adaptiveNotes=state.workflow.adaptiveNotes||[];state.workflow.adaptiveNotes.push({time:nowIso(),reason,keys:keys.filter(k=>path.includes(k))});}
  return added;
}
function adaptWorkflow(step,text){
  const t=String(text||'').toLowerCase(),keys=[];
  if(/massive bleeding|catastrophic bleeding|major bleeding|spurting|exsanguinat/.test(t))keys.push('hemorrhage');
  if(/unresponsive|not breathing|no breathing|gasping|agonal|no pulse|pulseless/.test(t))keys.push('resus');
  if(step.key==='breathing' && /severe|distress|wheeze|stridor|cyanosis|unequal|asymmetr|chest pain|short of breath|dyspn/.test(t))keys.push('respiratory_detail');
  if((step.key==='impression'||step.key==='exposure') && /road traffic|collision|crash|fall|stab|gunshot|fracture|trauma|assault|deform/.test(t))keys.push('trauma_detail');
  if(step.key==='disability' && /weakness|facial|speech|slurred|seizure|confus|pupil|stroke/.test(t))keys.push('neuro_detail');
  if((step.key==='safety'||step.key==='exposure') && /smoke|chemical|hazmat|spill|gas leak|heat|cold|hypother|immersion|confined|electrical/.test(t))keys.push('exposure_detail');
  const p=parseClinicalSpeech(text).vitals;const abnormal=(p.hr!=null&&(p.hr<50||p.hr>120))||(p.rr!=null&&(p.rr<10||p.rr>30))||(p.spo2!=null&&p.spo2<94)||(p.sbp!=null&&p.sbp<100)||(p.avpu&&p.avpu!=='Alert');
  if(step.key==='vitals'&&abnormal)keys.push('reassess');
  return insertAdaptiveAfterCurrent([...new Set(keys)],`Focused follow-up from ${step.phase}`);
}
function commitWorkflowAnswer(skip=false){
  const idx=state.workflow.step||0,step=workflowStepAt(idx),text=$('workflowAnswer').value.trim();if(!text&&!skip){toast('Say or type an observation, or tap Skip');return;}
  if(text){state.workflow.answers[step.key]=text;applyParsedWorkflow(step,text);adaptWorkflow(step,text);state.timeline.unshift({id:crypto.randomUUID?.()||Math.random().toString(36).slice(2),time:nowIso(),domain:'workflow',type:`workflow_${step.key}`,summary:`${step.phase}: ${text}`,data:{step:step.key,answer:text},evidence:'MANUAL_OBSERVATION',confidence:null,lat:state.location?.lat??null,lon:state.location?.lon??null});state.latest.workflow={time:nowIso(),summary:`${step.phase}: ${text}`,evidence:'MANUAL_OBSERVATION',data:{step:step.key,answer:text}};}
  if(idx>=workflowPath().length-1){state.workflow.completed=nowIso();state.workflow.active=false;save();renderWorkflow(false);toast('Primary survey captured');navigate('report');return;}
  state.workflow.step=idx+1;save();renderWorkflow(true);
}
function workflowBack(){if((state.workflow.step||0)>0){state.workflow.step--;save();renderWorkflow(true);}}
function speakWorkflowPrompt(){if(!('speechSynthesis'in window)||!window.SpeechSynthesisUtterance)return;const step=workflowStepAt(state.workflow.step||0);window.speechSynthesis.cancel();const u=new window.SpeechSynthesisUtterance(`${step.title} ${step.hint}`);u.rate=.98;u.pitch=1;u.lang='en-ZA';window.speechSynthesis.speak(u);}
function toggleVoicePrompts(){speechPromptEnabled=!speechPromptEnabled;state.workflow.voicePrompts=speechPromptEnabled;save();renderWorkflow(false);if(speechPromptEnabled)speakWorkflowPrompt();}
function setupRecognition(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){$('speechSupport').textContent='Browser speech recognition is unavailable here. Type normally or use the keyboard microphone.';$('dictateBtn').disabled=true;return;}recognition=new SR();recognition.lang='en-ZA';recognition.interimResults=true;recognition.continuous=false;recognition.maxAlternatives=1;recognition.onstart=()=>{isListening=true;$('dictateBtn').classList.add('listening');$('dictateLabel').textContent='Listening…';$('speechSupport').textContent='Speak naturally. Tap again to stop.';};recognition.onresult=e=>{let interim='';for(let i=e.resultIndex;i<e.results.length;i++){const txt=e.results[i][0].transcript;if(e.results[i].isFinal)recognitionFinalText+=(recognitionFinalText?' ':'')+txt;else interim+=txt;}const combined=[recognitionBaseText,recognitionFinalText].filter(Boolean).join(recognitionBaseText&&recognitionFinalText?' ':'');$('workflowAnswer').value=combined;$('dictationInterim').textContent=interim;updateCriticalBanner();};recognition.onerror=e=>{$('speechSupport').textContent=`Voice input stopped (${e.error}). You can type instead.`;};recognition.onend=()=>{isListening=false;$('dictateBtn').classList.remove('listening');$('dictateLabel').textContent='Dictate';$('dictationInterim').textContent='';$('speechSupport').textContent='Voice input ready. Review the transcript before saving.';};}
function toggleDictation(){if(!recognition){setupRecognition();if(!recognition)return;}if(isListening){try{recognition.stop();}catch{}return;}recognitionBaseText=$('workflowAnswer').value.trim();recognitionFinalText='';try{recognition.start();}catch(e){toast('Voice input could not start');}}

