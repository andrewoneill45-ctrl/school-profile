/**
 * Professional PDF School Report Generator
 * Produces DfE-styled A4 reports with rich narrative prose
 */
import jsPDF from 'jspdf';

// ─── Colours ─────────────────────────────────────────────────
const NAVY = [0, 48, 120];
const BLUE = [29, 112, 184];
const GREEN = [0, 112, 60];
const RED = [212, 53, 28];
const AMBER = [244, 119, 56];
const BLACK = [11, 12, 12];
const GREY = [80, 90, 95];
const LIGHT_GREY = [243, 242, 241];
const WHITE = [255, 255, 255];

function getOfstedColor(r) {
  switch (r) {
    case 'Outstanding': return GREEN;
    case 'Good': return BLUE;
    case 'Requires improvement': case 'Requires Improvement': return AMBER;
    case 'Inadequate': return RED;
    default: return GREY;
  }
}

function wrap(doc, text, w) { return doc.splitTextToSize(text, w); }
function fmt(n, d = 1) { return n != null ? Number(n).toFixed(d) : null; }

// ─── Statistical helpers ─────────────────────────────────────

function percentileOf(value, allValues) {
  if (value == null || !allValues.length) return null;
  const sorted = [...allValues].sort((a, b) => a - b);
  const pos = sorted.filter(v => v < value).length;
  return Math.round((pos / sorted.length) * 100);
}

function percentileLabel(p) {
  if (p == null) return '';
  if (p >= 95) return 'among the highest performing in the country';
  if (p >= 90) return 'in the top 10% nationally';
  if (p >= 80) return 'in the top 20% nationally';
  if (p >= 75) return 'in the top quartile nationally';
  if (p >= 60) return 'above the national average';
  if (p >= 40) return 'broadly in line with the national average';
  if (p >= 25) return 'below the national average';
  if (p >= 10) return 'in the lowest quartile nationally';
  return 'significantly below the national average';
}

function nationalAvg(values) {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// ─── Narrative generation ────────────────────────────────────

function generateNarrative(school, allSchools) {
  const s = school;
  const isSecondary = s.phase === 'Secondary' || s.phase === 'All-through';
  const isPrimary = s.phase === 'Primary';
  const samePhase = allSchools ? allSchools.filter(x => x.phase === s.phase) : [];
  const laSchools = allSchools ? allSchools.filter(x => x.la === s.la && x.phase === s.phase) : [];
  const sections = [];

  // ─── SECTION 1: Overview ───────────────────────
  let overview = `${s.name} is a ${(s.type || 'school').toLowerCase()} situated in ${s.town || s.la}`;
  if (s.region && s.region !== s.town) overview += `, in the ${s.region} region of England`;
  overview += '. ';

  if (s.religiousCharacter && s.religiousCharacter !== 'None' && s.religiousCharacter !== 'Does not apply') {
    overview += `The school has a ${s.religiousCharacter} religious character. `;
  }

  if (s.trust) {
    overview += `It operates as part of the ${s.trust}`;
    // Count trust schools
    if (allSchools) {
      const trustSchools = allSchools.filter(x => x.trust === s.trust);
      if (trustSchools.length > 1) {
        overview += `, a multi-academy trust comprising ${trustSchools.length} schools across England`;
      }
    }
    overview += '. ';
  }

  if (s.gender && s.gender !== 'Mixed') {
    overview += `It is a ${s.gender.toLowerCase()} school. `;
  }

  sections.push({ title: 'Overview', text: overview });

  // ─── SECTION 2: School community ───────────────
  let community = '';

  if (s.pupils) {
    const pupilPct = percentileOf(s.pupils, samePhase.map(x => x.pupils).filter(Boolean));
    let sizeDesc = 'average-sized';
    if (pupilPct >= 80) sizeDesc = 'larger than average';
    else if (pupilPct >= 95) sizeDesc = 'one of the largest';
    else if (pupilPct <= 20) sizeDesc = 'smaller than average';
    else if (pupilPct <= 5) sizeDesc = 'one of the smallest';

    community += `With ${s.pupils.toLocaleString()} pupils on roll, ${s.name} is ${sizeDesc} for a ${s.phase?.toLowerCase()} school`;
    if (s.capacity) {
      const occupancy = Math.round((s.pupils / s.capacity) * 100);
      community += `, operating at ${occupancy}% of its capacity of ${s.capacity.toLocaleString()} places`;
    }
    community += '. ';
  }

  if (s.fsm_pct != null) {
    const nationalFSMAvg = nationalAvg(samePhase.map(x => x.fsm_pct).filter(v => v != null));
    let fsmContext = '';
    if (nationalFSMAvg) {
      const diff = s.fsm_pct - nationalFSMAvg;
      if (diff > 15) fsmContext = 'substantially above';
      else if (diff > 5) fsmContext = 'above';
      else if (diff > -5) fsmContext = 'broadly in line with';
      else if (diff > -15) fsmContext = 'below';
      else fsmContext = 'substantially below';
      community += `The proportion of pupils eligible for free school meals stands at ${s.fsm_pct}%, which is ${fsmContext} the national average of ${nationalFSMAvg.toFixed(1)}% for ${s.phase?.toLowerCase()} schools. `;
    } else {
      community += `${s.fsm_pct}% of pupils are eligible for free school meals. `;
    }

    if (s.fsm_pct > 30) {
      community += `This higher-than-average level of disadvantage provides important context when considering the school's performance outcomes. `;
    }
  }

  if (laSchools.length > 1) {
    community += `The school is one of ${laSchools.length} ${s.phase?.toLowerCase()} schools serving the ${s.la} local authority area. `;
  }

  if (community) sections.push({ title: 'School Community', text: community });

  // ─── SECTION 3: Ofsted ─────────────────────────
  if (s.ofsted && s.ofsted !== 'Not inspected') {
    let ofstedText = `At its most recent inspection, Ofsted judged ${s.name} to be ${s.ofsted}. `;

    if (allSchools) {
      const ofstedCounts = {};
      samePhase.forEach(x => {
        if (x.ofsted && x.ofsted !== 'Not inspected') {
          ofstedCounts[x.ofsted] = (ofstedCounts[x.ofsted] || 0) + 1;
        }
      });
      const totalInspected = Object.values(ofstedCounts).reduce((a, b) => a + b, 0);
      const sameRatingCount = ofstedCounts[s.ofsted] || 0;
      const sameRatingPct = totalInspected > 0 ? Math.round((sameRatingCount / totalInspected) * 100) : null;

      if (sameRatingPct) {
        ofstedText += `Nationally, ${sameRatingPct}% of inspected ${s.phase?.toLowerCase()} schools hold a rating of ${s.ofsted}. `;
      }
    }

    // LA Ofsted context
    if (laSchools.length > 2) {
      const laOfsted = {};
      laSchools.forEach(x => {
        if (x.ofsted && x.ofsted !== 'Not inspected') {
          laOfsted[x.ofsted] = (laOfsted[x.ofsted] || 0) + 1;
        }
      });
      const laOutstandingPct = laOfsted['Outstanding'] ? Math.round((laOfsted['Outstanding'] / laSchools.length) * 100) : 0;
      const laGoodPlusPct = ((laOfsted['Outstanding'] || 0) + (laOfsted['Good'] || 0));
      const laGoodPlusPctVal = Math.round((laGoodPlusPct / laSchools.length) * 100);
      ofstedText += `Within ${s.la}, ${laGoodPlusPctVal}% of ${s.phase?.toLowerCase()} schools are rated Good or Outstanding. `;
    }

    sections.push({ title: 'Inspection', text: ofstedText });
  }

  // ─── SECTION 4: KS4 Performance ────────────────
  if (isSecondary && (s.attainment8 != null || s.basics_94 != null || s.progress8 != null)) {
    let perfText = '';

    if (s.attainment8 != null) {
      const a8Values = samePhase.map(x => x.attainment8).filter(v => v != null);
      const pct = percentileOf(s.attainment8, a8Values);
      const avg = nationalAvg(a8Values);
      const laA8Values = laSchools.map(x => x.attainment8).filter(v => v != null);
      const laAvg = nationalAvg(laA8Values);

      perfText += `The school's Attainment 8 score of ${fmt(s.attainment8)} places it ${percentileLabel(pct)}`;
      if (avg) perfText += `, compared to a national average of ${fmt(avg)}`;
      perfText += '. ';

      if (laAvg && laA8Values.length > 2) {
        const vsLA = s.attainment8 > laAvg ? 'above' : s.attainment8 < laAvg - 2 ? 'below' : 'in line with';
        perfText += `This is ${vsLA} the ${s.la} local authority average of ${fmt(laAvg)}. `;
      }

      // Contextualised by disadvantage
      if (s.fsm_pct != null && s.fsm_pct > 25 && pct >= 50) {
        perfText += `This performance is particularly notable given the school's higher-than-average proportion of disadvantaged pupils. `;
      }
    }

    if (s.progress8 != null) {
      const p8Values = samePhase.map(x => x.progress8).filter(v => v != null);
      const pct = percentileOf(s.progress8, p8Values);
      const sign = s.progress8 > 0 ? '+' : '';

      perfText += `The school's Progress 8 score of ${sign}${fmt(s.progress8, 2)} indicates that, on average, pupils make `;
      if (s.progress8 > 0.5) perfText += 'substantially more';
      else if (s.progress8 > 0.2) perfText += 'more';
      else if (s.progress8 > -0.2) perfText += 'similar';
      else if (s.progress8 > -0.5) perfText += 'less';
      else perfText += 'substantially less';
      perfText += ` progress between Key Stage 2 and Key Stage 4 than pupils with similar starting points nationally. `;

      if (pct != null) {
        perfText += `This places the school ${percentileLabel(pct)} for pupil progress. `;
      }
    }

    if (s.basics_94 != null) {
      const b4Values = samePhase.map(x => x.basics_94).filter(v => v != null);
      const b4Avg = nationalAvg(b4Values);

      perfText += `In the headline measure of English and Mathematics, ${s.basics_94}% of pupils achieved a standard pass (grade 4 or above) in both subjects`;
      if (b4Avg) {
        const vs = s.basics_94 > b4Avg + 3 ? 'above' : s.basics_94 < b4Avg - 3 ? 'below' : 'broadly in line with';
        perfText += `, ${vs} the national average of ${fmt(b4Avg, 0)}%`;
      }
      perfText += '. ';

      if (s.basics_95 != null) {
        perfText += `${s.basics_95}% achieved a strong pass (grade 5 or above) in both English and Mathematics. `;
      }
    }

    sections.push({ title: 'Key Stage 4 Performance', text: perfText });
  }

  // ─── SECTION 5: KS2 Performance ────────────────
  if (isPrimary && (s.ks2_rwm_exp != null || s.ks2_read_avg != null)) {
    let perfText = '';

    if (s.ks2_rwm_exp != null) {
      const rwmValues = samePhase.map(x => x.ks2_rwm_exp).filter(v => v != null);
      const pct = percentileOf(s.ks2_rwm_exp, rwmValues);
      const avg = nationalAvg(rwmValues);
      const laRWM = laSchools.map(x => x.ks2_rwm_exp).filter(v => v != null);
      const laAvg = nationalAvg(laRWM);

      perfText += `At the end of Key Stage 2, ${s.ks2_rwm_exp}% of pupils at ${s.name} met the expected standard in the combined measure of reading, writing, and mathematics. `;
      perfText += `This places the school ${percentileLabel(pct)}`;
      if (avg) perfText += `, where the national average stands at ${fmt(avg, 0)}%`;
      perfText += '. ';

      if (laAvg && laRWM.length > 2) {
        const vsLA = s.ks2_rwm_exp > laAvg + 3 ? 'above' : s.ks2_rwm_exp < laAvg - 3 ? 'below' : 'in line with';
        perfText += `Performance is ${vsLA} the ${s.la} average of ${fmt(laAvg, 0)}%. `;
      }
    }

    if (s.ks2_rwm_high != null) {
      let highDesc = '';
      if (s.ks2_rwm_high >= 20) highDesc = 'a strong proportion';
      else if (s.ks2_rwm_high >= 10) highDesc = 'a reasonable proportion';
      else highDesc = 'a smaller proportion';
      perfText += `${highDesc} of pupils (${s.ks2_rwm_high}%) achieved the higher standard in reading, writing, and mathematics, indicating the extent to which the school challenges its most able learners. `;
    }

    if (s.ks2_read_avg != null && s.ks2_math_avg != null) {
      perfText += `In the national assessments, pupils achieved average scaled scores of ${fmt(s.ks2_read_avg, 0)} in reading and ${fmt(s.ks2_math_avg, 0)} in mathematics, against a national expected standard of 100. `;

      const readAbove = s.ks2_read_avg >= 100;
      const mathAbove = s.ks2_math_avg >= 100;
      if (readAbove && mathAbove) {
        perfText += 'Both scores exceed the expected standard, suggesting that the school is performing well across the core curriculum. ';
      } else if (!readAbove && !mathAbove) {
        perfText += 'Both scores fall below the expected standard, which may indicate areas for development across the curriculum. ';
      } else if (readAbove && !mathAbove) {
        perfText += 'While reading performance is at or above the expected standard, mathematics may be an area for further development. ';
      } else {
        perfText += 'While mathematics performance is at or above the expected standard, reading may be an area for further development. ';
      }
    }

    if (s.fsm_pct != null && s.fsm_pct > 25 && s.ks2_rwm_exp != null) {
      const rwmPct = percentileOf(s.ks2_rwm_exp, samePhase.map(x => x.ks2_rwm_exp).filter(v => v != null));
      if (rwmPct >= 50) {
        perfText += `Given the school's higher-than-average proportion of disadvantaged pupils, these outcomes are indicative of effective teaching and strong leadership. `;
      }
    }

    sections.push({ title: 'Key Stage 2 Performance', text: perfText });
  }

  // ─── SECTION 6: Summary ────────────────────────
  let summary = '';

  if (isSecondary && s.attainment8 != null && s.progress8 != null) {
    const a8Pct = percentileOf(s.attainment8, samePhase.map(x => x.attainment8).filter(v => v != null));
    const p8Pct = percentileOf(s.progress8, samePhase.map(x => x.progress8).filter(v => v != null));

    if (a8Pct >= 60 && p8Pct >= 60) {
      summary += `Overall, ${s.name} demonstrates strong performance across both attainment and progress measures, `;
      summary += 'suggesting that the school is achieving well for its pupils regardless of their starting points. ';
    } else if (a8Pct < 40 && p8Pct >= 60) {
      summary += `While the school's overall attainment is below average, its strong Progress 8 score indicates that pupils are making more progress than might be expected given their starting points. `;
      summary += 'This suggests effective teaching and a school that is adding significant value. ';
    } else if (a8Pct >= 60 && p8Pct < 40) {
      summary += `The school achieves above-average attainment, though its Progress 8 score suggests that pupils may not be making as much progress as similar students nationally. `;
      summary += 'The relatively high attainment may partly reflect the prior attainment profile of the intake. ';
    } else if (a8Pct < 40 && p8Pct < 40) {
      summary += `Both attainment and progress measures fall below the national average, indicating that the school faces challenges in securing strong outcomes for its pupils. `;
    }
  }

  if (isPrimary && s.ks2_rwm_exp != null) {
    const rwmPct = percentileOf(s.ks2_rwm_exp, samePhase.map(x => x.ks2_rwm_exp).filter(v => v != null));
    if (rwmPct >= 60) {
      summary += `Overall, ${s.name} is performing well at Key Stage 2, with outcomes that place it above the national average. `;
    } else if (rwmPct >= 40) {
      summary += `Overall, ${s.name} is performing broadly in line with the national average at Key Stage 2. `;
    } else {
      summary += `Overall, the school's Key Stage 2 outcomes fall below the national average, suggesting potential areas for improvement. `;
    }
  }

  summary += `This report is based on publicly available data from the Department for Education's Get Information About Schools (GIAS) service and the school and college performance tables. `;
  summary += `It should be read alongside other sources of information, including the school's most recent Ofsted inspection report, when forming a view of the school's overall effectiveness.`;

  if (summary) sections.push({ title: 'Summary', text: summary });

  return sections;
}

// ─── PDF generation ──────────────────────────────────────────

export function exportSchoolPDF(school, allSchools) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const W = 210, H = 297, M = 20;
  const CW = W - M * 2;
  let y = 0;

  // ─── Header ─────────────────────────────────────
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 50, 'F');

  doc.setTextColor(...WHITE);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Department for Education · Schools Explorer', M, 12);

  doc.setFontSize(17);
  doc.setFont('helvetica', 'bold');
  const nameLines = wrap(doc, school.name, CW - 45);
  doc.text(nameLines, M, 28);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(190, 200, 215);
  doc.text(`${school.phase || ''} · ${school.type || ''} · URN: ${school.urn || ''}`, M, 44);

  // Ofsted badge
  if (school.ofsted && school.ofsted !== 'Not inspected') {
    const oc = getOfstedColor(school.ofsted);
    doc.setFillColor(...oc);
    doc.roundedRect(W - M - 38, 23, 38, 14, 2, 2, 'F');
    doc.setTextColor(...WHITE);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(school.ofsted, W - M - 19, 31.5, { align: 'center' });
  }

  y = 58;

  // ─── Key facts bar ──────────────────────────────
  doc.setFillColor(...LIGHT_GREY);
  doc.rect(0, y - 4, W, 24, 'F');

  const facts = [];
  if (school.la) facts.push(['Local Authority', school.la]);
  if (school.town) facts.push(['Town', school.town]);
  if (school.postcode) facts.push(['Postcode', school.postcode]);
  if (school.pupils) facts.push(['Pupils', school.pupils.toLocaleString()]);
  if (school.fsm_pct != null) facts.push(['FSM', `${school.fsm_pct}%`]);
  if (school.gender && school.gender !== 'Mixed') facts.push(['Gender', school.gender]);

  const fW = CW / Math.min(facts.length, 6);
  facts.slice(0, 6).forEach((f, i) => {
    const x = M + i * fW;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GREY);
    doc.setFontSize(6.5);
    doc.text(f[0].toUpperCase(), x, y + 2);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BLACK);
    doc.setFontSize(8.5);
    const val = wrap(doc, f[1], fW - 4);
    doc.text(val[0], x, y + 9);
  });

  y += 30;

  // ─── Performance metrics ────────────────────────
  const isSecondary = school.phase === 'Secondary' || school.phase === 'All-through';
  const isPrimary = school.phase === 'Primary';

  if (isSecondary && (school.attainment8 != null || school.basics_94 != null)) {
    const metrics = [];
    if (school.attainment8 != null) metrics.push({ l: 'Attainment 8', v: fmt(school.attainment8), m: 80 });
    if (school.progress8 != null) metrics.push({ l: 'Progress 8', v: (school.progress8 > 0 ? '+' : '') + fmt(school.progress8, 2), m: null });
    if (school.basics_94 != null) metrics.push({ l: 'Eng & Maths 4+', v: `${school.basics_94}%`, m: 100 });
    if (school.basics_95 != null) metrics.push({ l: 'Eng & Maths 5+', v: `${school.basics_95}%`, m: 100 });

    const cW = CW / Math.min(metrics.length, 4);
    metrics.slice(0, 4).forEach((m, i) => {
      const x = M + i * cW;
      doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...GREY);
      doc.text(m.l.toUpperCase(), x, y);
      doc.setFontSize(22); doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY);
      doc.text(m.v, x, y + 12);
      if (m.m) {
        const bW = cW - 12;
        const fill = (parseFloat(m.v) / m.m) * bW;
        doc.setFillColor(220, 225, 230); doc.roundedRect(x, y + 15, bW, 3, 1, 1, 'F');
        doc.setFillColor(...BLUE); doc.roundedRect(x, y + 15, Math.max(0, fill), 3, 1, 1, 'F');
      }
    });
    y += 28;
  }

  if (isPrimary && (school.ks2_rwm_exp != null || school.ks2_read_avg != null)) {
    const metrics = [];
    if (school.ks2_rwm_exp != null) metrics.push({ l: 'RWM Expected', v: `${school.ks2_rwm_exp}%`, m: 100 });
    if (school.ks2_rwm_high != null) metrics.push({ l: 'RWM Higher', v: `${school.ks2_rwm_high}%`, m: 100 });
    if (school.ks2_read_avg != null) metrics.push({ l: 'Reading Avg', v: fmt(school.ks2_read_avg, 0), m: 120 });
    if (school.ks2_math_avg != null) metrics.push({ l: 'Maths Avg', v: fmt(school.ks2_math_avg, 0), m: 120 });

    const cW = CW / Math.min(metrics.length, 4);
    metrics.slice(0, 4).forEach((m, i) => {
      const x = M + i * cW;
      doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...GREY);
      doc.text(m.l.toUpperCase(), x, y);
      doc.setFontSize(22); doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY);
      doc.text(m.v, x, y + 12);
      if (m.m) {
        const bW = cW - 12;
        const fill = (parseFloat(m.v) / m.m) * bW;
        doc.setFillColor(220, 225, 230); doc.roundedRect(x, y + 15, bW, 3, 1, 1, 'F');
        doc.setFillColor(...BLUE); doc.roundedRect(x, y + 15, Math.max(0, fill), 3, 1, 1, 'F');
      }
    });
    y += 28;
  }

  // ─── Divider ────────────────────────────────────
  doc.setDrawColor(210, 215, 220);
  doc.line(M, y, W - M, y);
  y += 8;

  // ─── Narrative sections ─────────────────────────
  const sections = generateNarrative(school, allSchools);

  sections.forEach(section => {
    // Check for new page
    if (y > H - 50) {
      doc.addPage();
      y = M;
    }

    // Section heading
    doc.setFillColor(...BLUE);
    doc.rect(M, y - 1, 3, 7, 'F');
    doc.setTextColor(...BLACK);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(section.title, M + 7, y + 4);
    y += 12;

    // Section text
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 35, 40);

    // Split by sentences for better flow
    const lines = wrap(doc, section.text, CW);
    lines.forEach(line => {
      if (y > H - 25) {
        doc.addPage();
        y = M;
      }
      doc.text(line, M, y);
      y += 4.5;
    });

    y += 6;
  });

  // ─── Footer ─────────────────────────────────────
  const addFooter = (pageDoc, pageNum, totalPages) => {
    const fy = H - 12;
    pageDoc.setDrawColor(210, 215, 220);
    pageDoc.line(M, fy - 4, W - M, fy - 4);
    pageDoc.setFontSize(7);
    pageDoc.setFont('helvetica', 'normal');
    pageDoc.setTextColor(...GREY);
    pageDoc.text('Schools Explorer · Data: DfE GIAS and performance tables', M, fy);
    pageDoc.text(`Page ${pageNum} · Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, W - M, fy, { align: 'right' });
  };

  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages);
  }

  // ─── Save ───────────────────────────────────────
  const safeName = school.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40);
  doc.save(`${safeName}_Report.pdf`);
}
