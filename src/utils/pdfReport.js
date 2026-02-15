import jsPDF from 'jspdf';
const NAVY=[0,48,120],BLUE=[29,112,184],GREEN=[13,122,66],RED=[204,51,51],AMBER=[232,146,14],BLACK=[15,23,42],GREY=[100,116,139],LGREY=[241,245,249],WHITE=[255,255,255];
const ofstedCol=r=>r==='Outstanding'?GREEN:r==='Good'?BLUE:r==='Requires improvement'?AMBER:r==='Inadequate'?RED:GREY;
function wrap(d,t,w){return d.splitTextToSize(t,w)}
function n(v,d=1){return v!=null?Number(v).toFixed(d):null}
function pct(val,arr){if(val==null||!arr.length)return null;return Math.round(arr.filter(v=>v<val).length/arr.length*100)}
function avg(arr){return arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:null}
function pctDesc(p){if(p==null)return'';if(p>=95)return'among the highest in the country';if(p>=90)return'in the top 10% nationally';if(p>=80)return'in the top fifth nationally';if(p>=75)return'in the top quartile';if(p>=60)return'above the national average';if(p>=40)return'broadly in line with the national average';if(p>=25)return'below the national average';if(p>=10)return'in the lowest quartile';return'well below the national average'}
function ordinal(n){const s=['th','st','nd','rd'];const v=n%100;return n+(s[(v-20)%10]||s[v]||s[0])}

function buildSections(s,all){
  const isSec=s.phase==='Secondary'||s.phase==='All-through',isPri=s.phase==='Primary';
  const same=all.filter(x=>x.phase===s.phase),la=same.filter(x=>x.la===s.la);
  const sections=[];

  let ov=s.name+' is a '+(s.type||'school').toLowerCase()+' located at '+[s.town,s.la,s.postcode].filter(Boolean).join(', ');
  if(s.region)ov+=' in the '+s.region+' region';
  ov+='. The school operates in the '+(s.phase||'').toLowerCase()+' phase';
  if(s.gender&&s.gender!=='Mixed')ov+=' as a '+s.gender.toLowerCase()+' school';ov+='. ';
  if(s.religiousCharacter&&!['None','Does not apply'].includes(s.religiousCharacter))ov+='It has a '+s.religiousCharacter+' religious character. ';
  if(s.trust){const ts=all.filter(x=>x.trust===s.trust);ov+='The school is part of '+s.trust;
    if(ts.length>1){const tp=ts.filter(x=>x.phase==='Primary').length,tsec=ts.filter(x=>x.phase==='Secondary'||x.phase==='All-through').length;
      const tlas=[...new Set(ts.map(x=>x.la))].length;ov+=', a multi-academy trust with '+ts.length+' schools';
      if(tp&&tsec)ov+=' ('+tp+' primary, '+tsec+' secondary)';if(tlas>1)ov+=' operating across '+tlas+' local authorities'}ov+='. '}
  sections.push({title:'School Overview',text:ov});

  let pup='';
  if(s.pupils){const pp=pct(s.pupils,same.map(x=>x.pupils).filter(Boolean));
    let sz='an average-sized';if(pp>=85)sz='a larger-than-average';else if(pp<=15)sz='a smaller-than-average';
    pup+='With '+s.pupils.toLocaleString()+' pupils on roll, this is '+sz+' '+s.phase?.toLowerCase()+' school';
    if(s.capacity){const occ=Math.round(s.pupils/s.capacity*100);pup+=', currently at '+occ+'% of its '+s.capacity.toLocaleString()+' place capacity';
      if(occ<70)pup+='. The school is significantly under capacity, which may have funding implications if rolls do not grow';
      else if(occ>95)pup+='. The school is near or at full capacity'}pup+='. '}
  if(s.fsm_pct!=null){const nf=avg(same.map(x=>x.fsm_pct).filter(v=>v!=null)),lf=avg(la.map(x=>x.fsm_pct).filter(v=>v!=null));
    pup+='The proportion of pupils eligible for free school meals is '+s.fsm_pct+'%';
    if(nf){const d=s.fsm_pct-nf;if(d>12)pup+=', significantly above the national average of '+n(nf,1)+'%';else if(d>5)pup+=', above the national average of '+n(nf,1)+'%';
      else if(d>-5)pup+=', broadly in line with the national average of '+n(nf,1)+'%';else pup+=', below the national average of '+n(nf,1)+'%'}
    if(lf&&la.length>2)pup+=' ('+s.la+' average: '+n(lf,1)+'%)';pup+='. ';
    if(s.fsm_pct>35)pup+='This above-average level of disadvantage is an important contextual factor when interpreting performance data. '}
  if(pup)sections.push({title:'Pupil Characteristics',text:pup});

  if(s.ofsted&&s.ofsted!=='Not inspected'){let of='At its most recent inspection, Ofsted judged '+s.name+' to be '+s.ofsted+'. ';
    const oc={};same.forEach(x=>{if(x.ofsted&&x.ofsted!=='Not inspected')oc[x.ofsted]=(oc[x.ofsted]||0)+1});
    const tot=Object.values(oc).reduce((a,b)=>a+b,0);const tp=tot>0?Math.round((oc[s.ofsted]||0)/tot*100):null;
    if(tp)of+='Nationally, '+tp+'% of inspected '+s.phase?.toLowerCase()+' schools hold a rating of '+s.ofsted+'. ';
    if(la.length>2){const gp=la.filter(x=>x.ofsted==='Outstanding'||x.ofsted==='Good').length;of+='Within '+s.la+', '+Math.round(gp/la.length*100)+'% of '+s.phase?.toLowerCase()+' schools are rated Good or Outstanding. '}
    sections.push({title:'Ofsted and Quality of Education',text:of})}

  if(isSec&&(s.attainment8!=null||s.basics_94!=null||s.progress8!=null)){let p='';
    if(s.attainment8!=null){const a8V=same.map(x=>x.attainment8).filter(Boolean);const pc=pct(s.attainment8,a8V);const na=avg(a8V);
      const laA8=la.map(x=>x.attainment8).filter(Boolean);const laA=avg(laA8);
      p+='The school\'s Attainment 8 score is '+n(s.attainment8);if(na)p+=' against a national average of '+n(na);
      p+='. This places the school '+pctDesc(pc)+'. ';
      if(laA&&la.length>2){const vs=s.attainment8>laA+3?'well above':s.attainment8>laA?'above':s.attainment8>laA-3?'broadly in line with':'below';
        p+='At local authority level, the '+s.la+' average is '+n(laA)+' and the school sits '+vs+' this benchmark. ';
        const lr=la.filter(x=>x.attainment8!=null).sort((a,b)=>b.attainment8-a.attainment8);const rk=lr.findIndex(x=>x.urn===s.urn)+1;
        if(rk>0)p+=s.name.split(' ')[0]+' sits '+ordinal(rk)+' out of '+lr.length+' secondary schools for Attainment 8 in the LA. '}
      if(s.fsm_pct!=null&&s.fsm_pct>30&&pc>=50)p+='This is particularly notable given the above-average proportion of disadvantaged pupils. '}
    if(s.progress8!=null){const p8V=same.map(x=>x.progress8).filter(v=>v!=null);const pc=pct(s.progress8,p8V);const sg=s.progress8>0?'+':'';
      p+='Progress 8 of '+sg+n(s.progress8,2)+' indicates pupils make ';
      if(s.progress8>0.5)p+='substantially more';else if(s.progress8>0.2)p+='more';else if(s.progress8>-0.2)p+='similar';else if(s.progress8>-0.5)p+='less';else p+='substantially less';
      p+=' progress than similar pupils nationally ('+pctDesc(pc)+'). '}
    if(s.basics_94!=null){const b4A=avg(same.map(x=>x.basics_94).filter(Boolean));
      p+=s.basics_94+'% achieved grade 4+ in both English and Mathematics';
      if(b4A){const vs=s.basics_94>b4A+5?', well above':s.basics_94>b4A?', above':s.basics_94>b4A-5?', broadly in line with':', below';p+=vs+' the national average'}p+='. ';
      if(s.basics_95!=null)p+=s.basics_95+'% achieved the strong pass (grade 5+). '}
    sections.push({title:'Educational Performance',text:p})}

  if(isPri&&(s.ks2_rwm_exp!=null||s.ks2_read_avg!=null)){let p='';
    if(s.ks2_rwm_exp!=null){const rv=same.map(x=>x.ks2_rwm_exp).filter(Boolean);const pc=pct(s.ks2_rwm_exp,rv);const na=avg(rv);
      p+='At Key Stage 2, '+s.ks2_rwm_exp+'% met the expected standard in reading, writing, and mathematics combined. ';
      if(na){const vs=s.ks2_rwm_exp>na+5?'above':s.ks2_rwm_exp>na-5?'broadly in line with':'below';
        p+='This is '+vs+' the national average of '+n(na,0)+'%, placing the school '+pctDesc(pc)+'. '}}
    if(s.ks2_rwm_high!=null){p+=s.ks2_rwm_high+'% achieved the higher standard';if(s.ks2_rwm_high>=15)p+=', suggesting effective challenge for able pupils';p+='. '}
    if(s.ks2_read_avg!=null&&s.ks2_math_avg!=null)p+='Average scaled scores: '+n(s.ks2_read_avg,0)+' reading, '+n(s.ks2_math_avg,0)+' maths (expected: 100). ';
    sections.push({title:'Educational Performance',text:p})}

  if(la.length>2){let c=s.name+' is one of '+la.length+' '+s.phase?.toLowerCase()+' schools in '+s.la+'. ';
    if(isSec){const laAvgs=[...new Set(all.map(x=>x.la))].map(ln=>{const ls=same.filter(x=>x.la===ln);const v=ls.map(x=>x.attainment8).filter(Boolean);
      return{la:ln,avg:avg(v),count:v.length}}).filter(x=>x.count>=3).sort((a,b)=>b.avg-a.avg);
      const r=laAvgs.findIndex(x=>x.la===s.la)+1;const laA=avg(la.map(x=>x.attainment8).filter(Boolean));
      if(r>0&&laA)c+=s.la+' has a secondary A8 average of '+n(laA)+', ranking '+ordinal(r)+' of '+laAvgs.length+' local authorities. '}
    sections.push({title:'Local Context',text:c})}

  let sum='';
  if(isSec&&s.attainment8!=null&&s.progress8!=null){const ap=pct(s.attainment8,same.map(x=>x.attainment8).filter(Boolean)),pp=pct(s.progress8,same.map(x=>x.progress8).filter(v=>v!=null));
    if(ap>=60&&pp>=60)sum+=s.name+' demonstrates strong performance across both attainment and progress. ';
    else if(ap<40&&pp>=60)sum+='While attainment is below average, strong Progress 8 indicates the school is adding significant value. ';
    else if(ap>=60&&pp<40)sum+='Above-average attainment but lower Progress 8 may reflect intake profile rather than school effectiveness. ';
    else sum+='Both measures fall below average, indicating challenges in securing strong outcomes. '}
  if(isPri&&s.ks2_rwm_exp!=null){const rp=pct(s.ks2_rwm_exp,same.map(x=>x.ks2_rwm_exp).filter(Boolean));
    if(rp>=60)sum+=s.name+' is performing well at KS2. ';else if(rp>=40)sum+=s.name+' performs broadly in line with national averages. ';else sum+='KS2 outcomes fall below average. '}
  sum+='This report is generated from publicly available DfE data and should be read alongside other sources including Ofsted reports.';
  sections.push({title:'Summary',text:sum});return sections}

export function exportSchoolPDF(school,allSchools){
  const doc=new jsPDF('p','mm','a4');const W=210,H=297,M=20,CW=W-M*2;let y=0;
  doc.setFillColor(...NAVY);doc.rect(0,0,W,52,'F');
  doc.setTextColor(180,195,215);doc.setFontSize(8);doc.setFont('helvetica','normal');doc.text('Schools Explorer \u00B7 Briefing Note',M,12);
  doc.setTextColor(...WHITE);doc.setFontSize(16);doc.setFont('helvetica','bold');
  const nl=wrap(doc,school.name,CW-45);doc.text(nl,M,27);
  doc.setFontSize(9);doc.setFont('helvetica','normal');doc.setTextColor(170,185,210);
  doc.text((school.la||'')+' \u00B7 '+(school.phase||'')+' \u00B7 '+(school.type||'')+' \u00B7 URN '+(school.urn||''),M,nl.length>1?38:36);
  doc.setFontSize(8);doc.text(new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}),W-M,12,{align:'right'});
  if(school.ofsted&&school.ofsted!=='Not inspected'){const oc=ofstedCol(school.ofsted);doc.setFillColor(...oc);doc.roundedRect(W-M-35,22,35,12,2,2,'F');
    doc.setTextColor(...WHITE);doc.setFontSize(7.5);doc.setFont('helvetica','bold');doc.text(school.ofsted,W-M-17.5,29.5,{align:'center'})}
  y=58;doc.setFillColor(...LGREY);doc.rect(M,y,CW,20,'F');
  const facts=[];if(school.pupils)facts.push(['Pupils',school.pupils.toLocaleString()]);
  if(school.capacity)facts.push(['Capacity',school.capacity.toLocaleString()]);if(school.fsm_pct!=null)facts.push(['FSM',school.fsm_pct+'%']);
  if(school.gender)facts.push(['Gender',school.gender]);if(school.postcode)facts.push(['Postcode',school.postcode]);
  const fw=CW/Math.min(facts.length,5);
  facts.slice(0,5).forEach((f,i)=>{const x=M+6+i*fw;doc.setFontSize(6);doc.setFont('helvetica','bold');doc.setTextColor(...GREY);doc.text(f[0].toUpperCase(),x,y+7);
    doc.setFontSize(9);doc.setFont('helvetica','bold');doc.setTextColor(...BLACK);doc.text(f[1],x,y+14)});
  y+=28;const isSec=school.phase==='Secondary'||school.phase==='All-through',isPri=school.phase==='Primary';
  const metrics=[];
  if(isSec){if(school.attainment8!=null)metrics.push({l:'Attainment 8',v:n(school.attainment8),bar:school.attainment8/80});
    if(school.progress8!=null)metrics.push({l:'Progress 8',v:(school.progress8>0?'+':'')+n(school.progress8,2)});
    if(school.basics_94!=null)metrics.push({l:'Eng & Maths 4+',v:school.basics_94+'%',bar:school.basics_94/100});
    if(school.basics_95!=null)metrics.push({l:'Eng & Maths 5+',v:school.basics_95+'%',bar:school.basics_95/100})}
  if(isPri){if(school.ks2_rwm_exp!=null)metrics.push({l:'RWM Expected',v:school.ks2_rwm_exp+'%',bar:school.ks2_rwm_exp/100});
    if(school.ks2_rwm_high!=null)metrics.push({l:'RWM Higher',v:school.ks2_rwm_high+'%',bar:school.ks2_rwm_high/100});
    if(school.ks2_read_avg!=null)metrics.push({l:'Reading',v:n(school.ks2_read_avg,0),bar:school.ks2_read_avg/120});
    if(school.ks2_math_avg!=null)metrics.push({l:'Maths',v:n(school.ks2_math_avg,0),bar:school.ks2_math_avg/120})}
  if(metrics.length){const mw=CW/Math.min(metrics.length,4);
    metrics.slice(0,4).forEach((m,i)=>{const x=M+i*mw;doc.setFontSize(6);doc.setFont('helvetica','bold');doc.setTextColor(...GREY);doc.text(m.l.toUpperCase(),x,y);
      doc.setFontSize(20);doc.setFont('helvetica','bold');doc.setTextColor(...NAVY);doc.text(m.v,x,y+11);
      if(m.bar!=null){const bw=mw-14;doc.setFillColor(225,230,240);doc.roundedRect(x,y+14,bw,2.5,1,1,'F');doc.setFillColor(...BLUE);doc.roundedRect(x,y+14,Math.max(0,m.bar*bw),2.5,1,1,'F')}});y+=26}
  doc.setDrawColor(225,230,240);doc.line(M,y,W-M,y);y+=8;
  const sections=buildSections(school,allSchools);
  sections.forEach(sec=>{if(y>H-45){doc.addPage();y=M}
    doc.setFillColor(...BLUE);doc.rect(M,y-1,3,6.5,'F');doc.setFontSize(10.5);doc.setFont('helvetica','bold');doc.setTextColor(...BLACK);doc.text(sec.title,M+7,y+4);y+=12;
    doc.setFontSize(9.2);doc.setFont('helvetica','normal');doc.setTextColor(30,41,59);
    const lines=wrap(doc,sec.text,CW);lines.forEach(line=>{if(y>H-22){doc.addPage();y=M}doc.text(line,M,y);y+=4.3});y+=5});
  const tp=doc.internal.getNumberOfPages();
  for(let i=1;i<=tp;i++){doc.setPage(i);const fy=H-12;doc.setDrawColor(225,230,240);doc.line(M,fy-3,W-M,fy-3);
    doc.setFontSize(6.5);doc.setFont('helvetica','normal');doc.setTextColor(...GREY);
    doc.text('Schools Explorer \u00B7 Data: DfE GIAS and performance tables',M,fy);doc.text('Page '+i+' of '+tp,W-M,fy,{align:'right'})}
  const safe=school.name.replace(/[^a-zA-Z0-9]/g,'_').substring(0,40);doc.save(safe+'_Briefing.pdf')}
