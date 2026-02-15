import jsPDF from 'jspdf';

const NAVY = [11, 29, 51], BLUE = [29, 90, 158], GREEN = [13, 122, 66], RED = [204, 51, 51], AMBER = [232, 146, 14];
const BLACK = [15, 23, 42], GREY = [100, 116, 139], LGREY = [241, 245, 249], WHITE = [255, 255, 255];
const ofC = r => r === 'Outstanding' ? GREEN : r === 'Good' ? BLUE : r === 'Requires improvement' ? AMBER : r === 'Inadequate' ? RED : GREY;
function wrap(d, t, w) { return d.splitTextToSize(t, w); }
function n(v, dp = 1) { return v != null ? Number(v).toFixed(dp) : null; }
function pct(val, arr) { if (val == null || !arr.length) return null; return Math.round(arr.filter(v => v < val).length / arr.length * 100); }
function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null; }
function decile(val, arr) { if (val == null || !arr.length) return null; const s = [...arr].sort((a, b) => a - b); const r = s.filter(v => v < val).length / s.length; return Math.min(10, Math.max(1, Math.ceil(r * 10))); }
function decCol(d) { if (d >= 8) return GREEN; if (d >= 5) return AMBER; return RED; }
function decText(d) { if (d >= 8) return 'top nationally'; if (d >= 5) return 'mid-range nationally'; return 'below average nationally'; }
function ordinal(n) { const s = ['th', 'st', 'nd', 'rd']; const v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
function pctDesc(p) { if (p >= 90) return 'in the top 10% nationally'; if (p >= 75) return 'in the top quartile'; if (p >= 50) return 'above the national average'; if (p >= 25) return 'below the national average'; return 'in the lowest quartile'; }

function drawRadar(doc, cx, cy, r, metrics) {
  const n = metrics.length;
  if (n < 3) return;
  const step = (2 * Math.PI) / n, start = -Math.PI / 2;
  const pt = (i, v) => ({ x: cx + (v / 10) * r * Math.cos(start + i * step), y: cy + (v / 10) * r * Math.sin(start + i * step) });

  // Grid
  [2, 4, 6, 8, 10].forEach(ring => {
    doc.setDrawColor(225, 230, 240); doc.setLineWidth(ring === 10 ? 0.4 : 0.15);
    const pts = Array.from({ length: n }, (_, i) => pt(i, ring));
    pts.forEach((p, i) => { const nx = pts[(i + 1) % n]; doc.line(p.x, p.y, nx.x, nx.y); });
  });
  // Axes
  for (let i = 0; i < n; i++) { const p = pt(i, 10); doc.setDrawColor(225, 230, 240); doc.setLineWidth(0.1); doc.line(cx, cy, p.x, p.y); }

  // Fill
  doc.setFillColor(29, 90, 158); doc.setGState(new doc.GState({ opacity: 0.12 }));
  const dPts = metrics.map((m, i) => pt(i, m.decile || 0));
  doc.moveTo(dPts[0].x, dPts[0].y);
  const pathLines = dPts.slice(1).map(p => `${p.x} ${p.y} l`).join(' ');
  // Manual polygon via lines
  doc.setDrawColor(29, 90, 158); doc.setLineWidth(0.6);
  doc.setGState(new doc.GState({ opacity: 1 }));
  for (let i = 0; i < dPts.length; i++) {
    const a = dPts[i], b = dPts[(i + 1) % dPts.length];
    doc.line(a.x, a.y, b.x, b.y);
  }

  // Points & labels
  metrics.forEach((m, i) => {
    const p = pt(i, m.decile || 0);
    const col = decCol(m.decile || 1);
    doc.setFillColor(...col); doc.circle(p.x, p.y, 1.5, 'F');

    const lp = pt(i, 12.5);
    const angle = start + i * step;
    const align = lp.x < cx - 2 ? 'right' : lp.x > cx + 2 ? 'left' : 'center';
    doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...BLACK);
    doc.text(m.label, lp.x, lp.y - 1.5, { align });
    doc.setFontSize(6); doc.setFont('helvetica', 'normal'); doc.setTextColor(...col);
    doc.text(`D${m.decile} · ${m.value}`, lp.x, lp.y + 2, { align });
  });
}

function buildNarrative(s, all) {
  const isSec = s.phase === 'Secondary' || s.phase === 'All-through', isPri = s.phase === 'Primary';
  const same = all.filter(x => x.phase === s.phase), la = same.filter(x => x.la === s.la);
  const vals = (arr, k) => arr.map(x => x[k]).filter(v => v != null);
  const sections = [];

  // Overview
  let ov = s.name + ' is a ' + (s.type || 'school').toLowerCase() + ' located in ' + [s.town, s.la].filter(Boolean).join(', ');
  if (s.region) ov += ' (' + s.region + ')';
  ov += '. ';
  if (s.trust) { const ts = all.filter(x => x.trust === s.trust); ov += 'Part of ' + s.trust + ' (' + ts.length + ' schools). '; }
  if (s.pupils) ov += s.pupils.toLocaleString() + ' pupils on roll. ';
  if (s.fsm_pct != null) {
    const nf = avg(vals(same, 'fsm_pct'));
    ov += 'FSM: ' + s.fsm_pct + '%';
    if (nf) { ov += s.fsm_pct > nf + 10 ? ', significantly above' : s.fsm_pct > nf + 3 ? ', above' : s.fsm_pct > nf - 3 ? ', in line with' : ', below'; ov += ' the national average (' + n(nf) + '%). '; }
  }
  sections.push({ title: 'School Overview', text: ov });

  // Performance
  if (isSec) {
    let p = '';
    if (s.attainment8 != null) {
      const d = decile(s.attainment8, vals(same, 'attainment8')); const na = avg(vals(same, 'attainment8'));
      p += 'Attainment 8 of ' + n(s.attainment8) + ' places the school in decile ' + d + ' (' + decText(d) + ').';
      if (na) p += ' National average: ' + n(na) + '.';
      const laA = avg(vals(la, 'attainment8'));
      if (laA && la.length > 2) { p += ' ' + s.la + ' average: ' + n(laA) + '.'; }
      if (s.a8_prev != null) { const ch = s.attainment8 - s.a8_prev; p += ' ' + (ch > 0 ? 'Up' : 'Down') + ' ' + Math.abs(ch).toFixed(1) + ' from 2024 (' + n(s.a8_prev) + '). '; }
      p += ' ';
    }
    if (s.p8_prev != null) {
      const d = decile(s.p8_prev, vals(same, 'p8_prev')); const sg = s.p8_prev > 0 ? '+' : '';
      p += 'Progress 8 (2024) of ' + sg + n(s.p8_prev, 2) + ' (decile ' + d + ', ' + decText(d) + '). ';
      if (s.p8_prev > 0.5) p += 'Pupils make substantially more progress than similar pupils nationally. ';
      else if (s.p8_prev > 0.2) p += 'Pupils make more progress than similar pupils nationally. ';
      else if (s.p8_prev > -0.2) p += 'Pupils make similar progress to national peers. ';
      else p += 'Pupils make less progress than similar pupils nationally. ';
      if (s.fsm_pct != null && s.fsm_pct > 30 && s.p8_prev > 0) p += 'This is particularly notable given above-average disadvantage. ';
    }
    if (s.basics_94 != null) {
      const d = decile(s.basics_94, vals(same, 'basics_94'));
      p += s.basics_94 + '% achieved 4+ in English and Maths (decile ' + d + '). ';
    }
    if (s.basics_95 != null) {
      const d = decile(s.basics_95, vals(same, 'basics_95'));
      p += s.basics_95 + '% achieved the strong pass at 5+ (decile ' + d + '). ';
    }
    if (p) sections.push({ title: 'Educational Performance', text: p });
  }

  if (isPri) {
    let p = '';
    if (s.ks2_rwm_exp != null) {
      const d = decile(s.ks2_rwm_exp, vals(same, 'ks2_rwm_exp')); const na = avg(vals(same, 'ks2_rwm_exp'));
      p += s.ks2_rwm_exp + '% reached the expected standard in reading, writing and maths combined (decile ' + d + ', ' + decText(d) + ').';
      if (na) p += ' National average: ' + n(na, 0) + '%.';
      if (s.ks2_rwm_prev != null) { const ch = s.ks2_rwm_exp - s.ks2_rwm_prev; p += ' ' + (ch > 0 ? 'Up' : 'Down') + ' ' + Math.abs(ch).toFixed(0) + 'pp from 2024. '; }
      p += ' ';
    }
    if (s.ks2_rwm_high != null) {
      const d = decile(s.ks2_rwm_high, vals(same, 'ks2_rwm_high'));
      p += s.ks2_rwm_high + '% reached the higher standard (decile ' + d + '). ';
    }
    if (s.ks2_read_avg != null) {
      const d = decile(s.ks2_read_avg, vals(same, 'ks2_read_avg'));
      p += 'Average reading score: ' + n(s.ks2_read_avg, 0) + ' (decile ' + d + ', expected: 100). ';
    }
    if (s.ks2_writ_exp != null) {
      const d = decile(s.ks2_writ_exp, vals(same, 'ks2_writ_exp'));
      p += 'Writing at expected: ' + s.ks2_writ_exp + '% (decile ' + d + '). ';
    }
    if (s.ks2_mat_exp != null) {
      const d = decile(s.ks2_mat_exp, vals(same, 'ks2_mat_exp'));
      p += 'Maths at expected: ' + s.ks2_mat_exp + '% (decile ' + d + '). ';
    }
    if (p) sections.push({ title: 'Educational Performance', text: p });
  }

  // Disadvantaged
  if (isSec && s.a8_disadv != null) {
    let d = 'Disadvantaged pupils achieved an Attainment 8 of ' + n(s.a8_disadv);
    if (s.a8_nondisadv != null) d += ', compared with ' + n(s.a8_nondisadv) + ' for non-disadvantaged peers (gap: ' + n(s.a8_nondisadv - s.a8_disadv) + '). ';
    else d += '. ';
    if (s.p8_disadv != null) d += 'Progress 8 for disadvantaged pupils: ' + (s.p8_disadv > 0 ? '+' : '') + n(s.p8_disadv, 2) + '. ';
    if (s.b94_disadv != null && s.b94_nondisadv != null) d += 'Basics 4+: ' + s.b94_disadv + '% disadvantaged vs ' + s.b94_nondisadv + '% others. ';
    sections.push({ title: 'Disadvantaged Pupils', text: d });
  }

  if (isPri && s.ks2_rwm_disadv != null) {
    let d = 'Disadvantaged pupils: ' + s.ks2_rwm_disadv + '% reached RWM expected';
    if (s.ks2_rwm_nondisadv != null) d += ', compared with ' + s.ks2_rwm_nondisadv + '% non-disadvantaged (gap: ' + (s.ks2_rwm_nondisadv - s.ks2_rwm_disadv).toFixed(0) + 'pp). ';
    else d += '. ';
    sections.push({ title: 'Disadvantaged Pupils', text: d });
  }

  // Ofsted
  if (s.ofsted && s.ofsted !== 'Not inspected') {
    let of = 'Ofsted rating: ' + s.ofsted + '. ';
    const oc = {}; same.forEach(x => { if (x.ofsted && x.ofsted !== 'Not inspected') oc[x.ofsted] = (oc[x.ofsted] || 0) + 1; });
    const tot = Object.values(oc).reduce((a, b) => a + b, 0);
    if (tot) of += Math.round((oc[s.ofsted] || 0) / tot * 100) + '% of ' + s.phase.toLowerCase() + ' schools nationally hold this rating. ';
    sections.push({ title: 'Ofsted', text: of });
  }

  // Summary
  let sum = 'In summary, ' + s.name;
  if (isSec && s.attainment8 != null) {
    const ad = decile(s.attainment8, vals(same, 'attainment8'));
    const pd = s.p8_prev != null ? decile(s.p8_prev, vals(same, 'p8_prev')) : null;
    if (ad >= 8 && pd && pd >= 8) sum += ' demonstrates strong performance across both attainment and progress';
    else if (ad < 5 && pd && pd >= 7) sum += ' shows strong value-added despite below-average attainment, suggesting effective teaching with a challenging intake';
    else if (ad >= 7 && pd && pd < 5) sum += ' has above-average attainment but lower progress, which may reflect intake profile rather than school effectiveness';
    else sum += ' shows a mixed performance picture that merits further investigation';
  }
  if (isPri && s.ks2_rwm_exp != null) {
    const d = decile(s.ks2_rwm_exp, vals(same, 'ks2_rwm_exp'));
    if (d >= 8) sum += ' is performing strongly at KS2';
    else if (d >= 5) sum += ' performs broadly in line with national averages at KS2';
    else sum += ' has KS2 outcomes below the national average';
  }
  sum += '. This report uses publicly available DfE data and should be read alongside Ofsted reports and other sources.';
  sections.push({ title: 'Summary', text: sum });

  return sections;
}

export function exportSchoolPDF(school, allSchools) {
  const s = school, all = allSchools;
  const doc = new jsPDF('p', 'mm', 'a4');
  const W = 210, H = 297, M = 20, CW = W - M * 2;
  const isSec = s.phase === 'Secondary' || s.phase === 'All-through', isPri = s.phase === 'Primary';
  const same = all.filter(x => x.phase === s.phase);
  const vals = (arr, k) => arr.map(x => x[k]).filter(v => v != null);

  // ── Header ──────────────────────────────────
  doc.setFillColor(...NAVY); doc.rect(0, 0, W, 50, 'F');
  doc.setTextColor(180, 195, 215); doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
  doc.text('School Profiles · Briefing Note', M, 11);
  doc.setFontSize(7.5); doc.text(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), W - M, 11, { align: 'right' });
  doc.setTextColor(...WHITE); doc.setFontSize(16); doc.setFont('helvetica', 'bold');
  const nl = wrap(doc, s.name, CW - 45); doc.text(nl, M, 25);
  doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(170, 185, 210);
  doc.text([s.la, s.phase, s.type, 'URN ' + s.urn].filter(Boolean).join(' · '), M, nl.length > 1 ? 36 : 34);
  if (s.ofsted && s.ofsted !== 'Not inspected') {
    const oc = ofC(s.ofsted); doc.setFillColor(...oc); doc.roundedRect(W - M - 35, 20, 35, 12, 2, 2, 'F');
    doc.setTextColor(...WHITE); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.text(s.ofsted, W - M - 17.5, 27.5, { align: 'center' });
  }

  let y = 56;

  // ── Key facts strip ─────────────────────────
  doc.setFillColor(...LGREY); doc.rect(M, y, CW, 18, 'F');
  const facts = [];
  if (s.pupils) facts.push(['Pupils', s.pupils.toLocaleString()]);
  if (s.fsm_pct != null) facts.push(['FSM', s.fsm_pct + '%']);
  if (s.gender) facts.push(['Gender', s.gender]);
  if (s.postcode) facts.push(['Postcode', s.postcode]);
  if (s.trust) facts.push(['Trust', s.trust.length > 25 ? s.trust.substring(0, 25) + '...' : s.trust]);
  const fw = CW / Math.min(facts.length, 5);
  facts.slice(0, 5).forEach((f, i) => {
    const x = M + 5 + i * fw;
    doc.setFontSize(5.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...GREY); doc.text(f[0].toUpperCase(), x, y + 6);
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...BLACK); doc.text(f[1], x, y + 12.5);
  });
  y += 24;

  // ── Headline metrics ────────────────────────
  const metrics = [];
  if (isSec) {
    if (s.attainment8 != null) metrics.push({ l: 'Attainment 8', v: n(s.attainment8), d: decile(s.attainment8, vals(same, 'attainment8')), bar: s.attainment8 / 80 });
    if (s.p8_prev != null) metrics.push({ l: 'Progress 8 (2024)', v: (s.p8_prev > 0 ? '+' : '') + n(s.p8_prev, 2), d: decile(s.p8_prev, vals(same, 'p8_prev')) });
    if (s.basics_94 != null) metrics.push({ l: 'Eng & Ma 4+', v: s.basics_94 + '%', d: decile(s.basics_94, vals(same, 'basics_94')), bar: s.basics_94 / 100 });
    if (s.basics_95 != null) metrics.push({ l: 'Eng & Ma 5+', v: s.basics_95 + '%', d: decile(s.basics_95, vals(same, 'basics_95')), bar: s.basics_95 / 100 });
  }
  if (isPri) {
    if (s.ks2_rwm_exp != null) metrics.push({ l: 'RWM Expected', v: s.ks2_rwm_exp + '%', d: decile(s.ks2_rwm_exp, vals(same, 'ks2_rwm_exp')), bar: s.ks2_rwm_exp / 100 });
    if (s.ks2_rwm_high != null) metrics.push({ l: 'RWM Higher', v: s.ks2_rwm_high + '%', d: decile(s.ks2_rwm_high, vals(same, 'ks2_rwm_high')), bar: s.ks2_rwm_high / 100 });
    if (s.ks2_read_avg != null) metrics.push({ l: 'Reading', v: n(s.ks2_read_avg, 0), d: decile(s.ks2_read_avg, vals(same, 'ks2_read_avg')), bar: s.ks2_read_avg / 120 });
    if (s.ks2_writ_exp != null) metrics.push({ l: 'Writing', v: s.ks2_writ_exp + '%', d: decile(s.ks2_writ_exp, vals(same, 'ks2_writ_exp')), bar: s.ks2_writ_exp / 100 });
    if (s.ks2_mat_exp != null) metrics.push({ l: 'Maths', v: s.ks2_mat_exp + '%', d: decile(s.ks2_mat_exp, vals(same, 'ks2_mat_exp')), bar: s.ks2_mat_exp / 100 });
  }

  if (metrics.length) {
    const mw = CW / Math.min(metrics.length, 5);
    metrics.slice(0, 5).forEach((m, i) => {
      const x = M + i * mw;
      doc.setFontSize(5.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...GREY); doc.text(m.l.toUpperCase(), x, y);
      doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY); doc.text(m.v, x, y + 10);
      if (m.d != null) {
        const dc = decCol(m.d);
        doc.setFillColor(...dc); doc.roundedRect(x, y + 12.5, 14, 5, 1.5, 1.5, 'F');
        doc.setTextColor(...WHITE); doc.setFontSize(5.5); doc.setFont('helvetica', 'bold');
        doc.text('D' + m.d, x + 7, y + 16, { align: 'center' });
      }
      if (m.bar != null) {
        const bw = mw - 12;
        doc.setFillColor(225, 230, 240); doc.roundedRect(x, y + 19, bw, 2.5, 1, 1, 'F');
        doc.setFillColor(...BLUE); doc.roundedRect(x, y + 19, Math.max(0, m.bar * bw), 2.5, 1, 1, 'F');
      }
    });
    y += 28;
  }

  doc.setDrawColor(225, 230, 240); doc.line(M, y, W - M, y); y += 6;

  // ── Radar chart ─────────────────────────────
  const radarData = [];
  if (isSec) {
    if (s.basics_94 != null) radarData.push({ label: '4+ E&M', value: s.basics_94 + '%', decile: decile(s.basics_94, vals(same, 'basics_94')) });
    if (s.basics_95 != null) radarData.push({ label: '5+ E&M', value: s.basics_95 + '%', decile: decile(s.basics_95, vals(same, 'basics_95')) });
    if (s.pupils != null) radarData.push({ label: 'Size', value: s.pupils.toLocaleString(), decile: decile(s.pupils, vals(same, 'pupils')) });
    if (s.p8_prev != null) radarData.push({ label: 'P8 2024', value: (s.p8_prev > 0 ? '+' : '') + n(s.p8_prev, 2), decile: decile(s.p8_prev, vals(same, 'p8_prev')) });
    if (s.fsm_pct != null) radarData.push({ label: 'FSM %', value: s.fsm_pct + '%', decile: 11 - (decile(s.fsm_pct, vals(same, 'fsm_pct')) || 5) });
  }
  if (isPri) {
    if (s.ks2_rwm_exp != null) radarData.push({ label: 'RWM Exp', value: s.ks2_rwm_exp + '%', decile: decile(s.ks2_rwm_exp, vals(same, 'ks2_rwm_exp')) });
    if (s.ks2_rwm_high != null) radarData.push({ label: 'RWM High', value: s.ks2_rwm_high + '%', decile: decile(s.ks2_rwm_high, vals(same, 'ks2_rwm_high')) });
    if (s.ks2_read_avg != null) radarData.push({ label: 'Reading', value: n(s.ks2_read_avg, 0), decile: decile(s.ks2_read_avg, vals(same, 'ks2_read_avg')) });
    if (s.ks2_writ_exp != null) radarData.push({ label: 'Writing', value: s.ks2_writ_exp + '%', decile: decile(s.ks2_writ_exp, vals(same, 'ks2_writ_exp')) });
    if (s.ks2_mat_exp != null) radarData.push({ label: 'Maths', value: s.ks2_mat_exp + '%', decile: decile(s.ks2_mat_exp, vals(same, 'ks2_mat_exp')) });
  }

  if (radarData.length >= 3) {
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY);
    doc.text('National Decile Profile', W / 2, y + 2, { align: 'center' });
    y += 6;
    drawRadar(doc, W / 2, y + 30, 25, radarData);
    // Legend
    y += 62;
    doc.setFontSize(5.5); doc.setFont('helvetica', 'normal');
    [[GREEN, 'Top (D8-10)'], [AMBER, 'Mid (D5-7)'], [RED, 'Low (D1-4)']].forEach((item, i) => {
      const lx = W / 2 - 30 + i * 26;
      doc.setFillColor(...item[0]); doc.circle(lx, y, 1.5, 'F');
      doc.setTextColor(...GREY); doc.text(item[1], lx + 3, y + 1);
    });
    y += 8;
  }

  doc.setDrawColor(225, 230, 240); doc.line(M, y, W - M, y); y += 6;

  // ── Narrative sections ──────────────────────
  const sections = buildNarrative(s, all);
  sections.forEach(sec => {
    if (y > H - 40) { doc.addPage(); y = M; }
    doc.setFillColor(...BLUE); doc.rect(M, y - 1, 2.5, 6, 'F');
    doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...BLACK);
    doc.text(sec.title, M + 6, y + 3.5); y += 10;
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 41, 59);
    const lines = wrap(doc, sec.text, CW);
    lines.forEach(line => { if (y > H - 20) { doc.addPage(); y = M; } doc.text(line, M, y); y += 4; });
    y += 4;
  });

  // ── Footer ──────────────────────────────────
  const tp = doc.internal.getNumberOfPages();
  for (let i = 1; i <= tp; i++) {
    doc.setPage(i);
    doc.setDrawColor(225, 230, 240); doc.line(M, H - 14, W - M, H - 14);
    doc.setFontSize(6); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GREY);
    doc.text('School Profiles · Data: DfE GIAS and performance tables 2024/25', M, H - 10);
    doc.text('Page ' + i + ' of ' + tp, W - M, H - 10, { align: 'right' });
  }

  const safe = s.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40);
  doc.save(safe + '_Briefing.pdf');
}
