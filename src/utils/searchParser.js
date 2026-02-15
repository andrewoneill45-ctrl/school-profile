const REGIONS={'london':'London','south east':'South East','south west':'South West','east of england':'East of England','east midlands':'East Midlands','west midlands':'West Midlands','yorkshire and the humber':'Yorkshire and the Humber','yorkshire':'Yorkshire and the Humber','north west':'North West','north east':'North East'};
const PHASE={'primary':'Primary','primaries':'Primary','junior':'Primary','infant':'Primary','juniors':'Primary','secondary':'Secondary','secondaries':'Secondary','high school':'Secondary','special':'Special','special school':'Special','nursery':'Nursery','all-through':'All-through','all through':'All-through','sixth form':'16 plus','post-16':'16 plus','post 16':'16 plus'};
const OFSTED={'outstanding':'Outstanding','good':'Good','requires improvement':'Requires improvement','ri':'Requires improvement','inadequate':'Inadequate','failing':'Inadequate'};
const FAITH={'catholic':'Roman Catholic','rc':'Roman Catholic','church of england':'Church of England','c of e':'Church of England','coe':'Church of England','jewish':'Jewish','muslim':'Muslim','islamic':'Muslim','sikh':'Sikh','hindu':'Hindu','methodist':'Methodist','faith':'_any_faith'};
const TYPE={'academy':'academy','academies':'academy','free school':'free school','maintained':'maintained','grammar':'grammar','grammars':'grammar'};
const PERF={'top performing':{minAttainment8:60},'best performing':{minAttainment8:55},'highest performing':{minAttainment8:60},'high performing':{minAttainment8:50},'well above average':{minAttainment8:55},'above average':{minAttainment8:48},'below average':{maxAttainment8:42},'struggling':{maxAttainment8:35},'underperforming':{maxAttainment8:38},'low performing':{maxAttainment8:38},'coasting':{minAttainment8:38,maxAttainment8:46}};
const SIZE={'very large':{minPupils:1500},'large':{minPupils:1000},'big':{minPupils:1000},'small':{maxPupils:300},'very small':{maxPupils:150},'tiny':{maxPupils:100}};
const TRUSTS=['ark','harris','oasis','dixons','united learning','delta','outwood','inspiration','ormiston','star academies','northern education','reach','kingsbridge','greenwood','the kemnal','academies enterprise','education alliance','the spencer','astrea','david ross'];

export function parseSearchQuery(query){
  if(!query||!query.trim())return null;
  const original=query.trim();const lower=original.toLowerCase();const f={};
  for(const[kw,val]of Object.entries(PHASE)){if(lower.includes(kw)){f.phase=val;break}}
  for(const[kw,val]of Object.entries(OFSTED)){if(lower.includes(kw)){f.ofsted=val;break}}
  for(const[kw,vals]of Object.entries(PERF)){if(lower.includes(kw)){Object.assign(f,vals);break}}
  for(const[kw,vals]of Object.entries(SIZE)){if(lower.includes(kw)){Object.assign(f,vals);break}}
  for(const[kw,val]of Object.entries(FAITH)){if(lower.includes(kw)){f.faithQuery=val;break}}
  for(const[kw,val]of Object.entries(TYPE)){if(lower.includes(kw)){f.typeQuery=val;break}}
  if(/\b(girls|girl's|all.girls)\b/.test(lower))f.gender='Girls';
  else if(/\b(boys|boy's|all.boys)\b/.test(lower))f.gender='Boys';
  for(const[kw,val]of Object.entries(REGIONS)){if(lower.includes(kw)){f.region=val;break}}
  let m;
  m=lower.match(/(?:attainment\s*8?|a8)\s*(?:above|over|>|more than|greater than|at least|higher than)\s*([\d.]+)/);if(m)f.minAttainment8=parseFloat(m[1]);
  m=lower.match(/(?:attainment\s*8?|a8)\s*(?:below|under|<|less than|lower than)\s*([\d.]+)/);if(m)f.maxAttainment8=parseFloat(m[1]);
  m=lower.match(/(?:progress\s*8?|p8)\s*(?:above|over|>|more than|greater than|at least|higher than)\s*([-\d.]+)/);if(m)f.minProgress8=parseFloat(m[1]);
  m=lower.match(/(?:progress\s*8?|p8)\s*(?:below|under|<|less than|lower than)\s*([-\d.]+)/);if(m)f.maxProgress8=parseFloat(m[1]);
  if(lower.includes('positive progress')||lower.includes('positive p8'))f.minProgress8=0.01;
  if(lower.includes('negative progress')||lower.includes('negative p8'))f.maxProgress8=-0.01;
  m=lower.match(/(?:more than|above|over|>|at least)\s*(\d+)\s*(?:pupils?|students?|children)/);if(m)f.minPupils=parseInt(m[1]);
  m=lower.match(/(?:less than|fewer than|below|under|<)\s*(\d+)\s*(?:pupils?|students?|children)/);if(m)f.maxPupils=parseInt(m[1]);
  m=lower.match(/(?:fsm|free school meals?|disadvantaged|pupil premium)\s*(?:above|over|>|more than)\s*(\d+)/);if(m)f.minFSM=parseFloat(m[1]);
  m=original.match(/\b([A-Za-z]{1,2}\d{1,2}[A-Za-z]?\s*\d?[A-Za-z]{0,2})\b/);
  if(m){const pc=m[1].toUpperCase().trim();if(/^[A-Z]{1,2}\d/.test(pc)&&pc.length>=2&&pc.length<=8)f.postcodeQuery=pc}
  for(const t of TRUSTS){if(lower.includes(t)){f.trustQuery=t;break}}
  if(!f.trustQuery){m=lower.match(/(?:trust|mat|federation)\s+(?:called|named)?\s*(.+?)(?:\s+(?:in|with|that|schools?)|$)/);if(m)f.trustQuery=m[1].trim()}
  if(!f.region&&!f.postcodeQuery){
    m=lower.match(/(?:in|near|around|from|across)\s+([a-z][a-z\s,'-]{1,40}?)(?:\s+(?:with|that|where|and|who|which|having|show|above|below|la|local|region)|[,.]|$)/);
    if(m){let place=m[1].trim().replace(/\s+(school|primary|secondary|special|academy|academies|that|are|is|with|good|outstanding|inadequate|more|less|above|below).*$/,'').trim();
      const skip=['england','uk','the uk','the country','my area','the map','a','this'];
      if(!skip.includes(place)&&place.length>1)f.locationQuery=place}
  }
  m=lower.match(/(?:called|named)\s+['"]?([a-z\s]+?)['"]?(?:\s|$)/);if(m)f.nameQuery=m[1].trim();
  if(Object.keys(f).length===0&&original.length>=2)f.fuzzyQuery=original;
  return Object.keys(f).length>0?f:null;
}

export function applyFilters(schools,filters){
  if(!filters)return schools;
  return schools.filter(s=>{
    if(filters.phase&&s.phase!==filters.phase)return false;
    if(filters.ofsted&&s.ofsted!==filters.ofsted)return false;
    if(filters.gender&&s.gender!==filters.gender)return false;
    if(filters.region&&!(s.region||'').toLowerCase().includes(filters.region.toLowerCase()))return false;
    if(filters.locationQuery){const q=filters.locationQuery.toLowerCase();const ff=[s.la,s.town,s.name,s.postcode].filter(Boolean).map(x=>x.toLowerCase());if(!ff.some(f=>f.includes(q)))return false}
    if(filters.nameQuery&&!(s.name||'').toLowerCase().includes(filters.nameQuery.toLowerCase()))return false;
    if(filters.postcodeQuery){const pc=(s.postcode||'').toUpperCase().replace(/\s/g,'');if(!pc.startsWith(filters.postcodeQuery.replace(/\s/g,'')))return false}
    if(filters.trustQuery){const q=filters.trustQuery.toLowerCase();if(!(s.trust||'').toLowerCase().includes(q)&&!(s.name||'').toLowerCase().includes(q))return false}
    if(filters.typeQuery&&!(s.type||'').toLowerCase().includes(filters.typeQuery))return false;
    if(filters.faithQuery){const fa=(s.religiousCharacter||'').toLowerCase();if(filters.faithQuery==='_any_faith'){if(!fa||fa==='none'||fa==='does not apply')return false}else{if(!fa.includes(filters.faithQuery.toLowerCase()))return false}}
    if(filters.minAttainment8!=null&&(s.attainment8==null||s.attainment8<filters.minAttainment8))return false;
    if(filters.maxAttainment8!=null&&(s.attainment8==null||s.attainment8>filters.maxAttainment8))return false;
    if(filters.minProgress8!=null&&(s.progress8==null||s.progress8<filters.minProgress8))return false;
    if(filters.maxProgress8!=null&&(s.progress8==null||s.progress8>filters.maxProgress8))return false;
    if(filters.minPupils!=null&&(s.pupils==null||s.pupils<filters.minPupils))return false;
    if(filters.maxPupils!=null&&(s.pupils==null||s.pupils>filters.maxPupils))return false;
    if(filters.minBasics4!=null&&(s.basics_94==null||s.basics_94<filters.minBasics4))return false;
    if(filters.minBasics5!=null&&(s.basics_95==null||s.basics_95<filters.minBasics5))return false;
    if(filters.minFSM!=null&&(s.fsm_pct==null||s.fsm_pct<filters.minFSM))return false;
    if(filters.fuzzyQuery){const q=filters.fuzzyQuery.toLowerCase();const all=[s.name,s.la,s.town,s.trust,s.postcode,s.region,s.type,s.religiousCharacter].filter(Boolean).map(x=>x.toLowerCase());const direct=all.some(t=>t.includes(q)||q.includes(t));if(direct)return true;const words=q.split(/\s+/);const blob=all.join(' ');return words.every(w=>blob.includes(w))}
    return true;
  });
}

export function describeFilters(filters){
  if(!filters)return'';if(filters.fuzzyQuery)return'"'+filters.fuzzyQuery+'"';
  const p=[];if(filters.ofsted)p.push(filters.ofsted);if(filters.phase)p.push(filters.phase.toLowerCase());if(filters.typeQuery)p.push(filters.typeQuery);if(filters.faithQuery&&filters.faithQuery!=='_any_faith')p.push(filters.faithQuery);p.push('schools');if(filters.locationQuery)p.push('in '+filters.locationQuery);if(filters.region)p.push('in '+filters.region);if(filters.postcodeQuery)p.push('near '+filters.postcodeQuery);if(filters.trustQuery)p.push('('+filters.trustQuery+')');if(filters.minAttainment8)p.push('A8 >= '+filters.minAttainment8);if(filters.maxAttainment8)p.push('A8 <= '+filters.maxAttainment8);if(filters.minProgress8)p.push('P8 >= '+filters.minProgress8);
  return p.join(' ');
}
