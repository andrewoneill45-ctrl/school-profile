import jsPDF from 'jspdf';
import { findSimilarSchools } from './similarSchools';
import { callClaude, hasApiKey } from './ai';

const NAVY = [11, 29, 51], BLUE = [29, 90, 158], GREEN = [13, 122, 66], RED = [204, 51, 51], AMBER = [232, 146, 14];
const BLACK = [15, 23, 42], GREY = [100, 116, 139], LGREY = [241, 245, 249], WHITE = [255, 255, 255];
const ofC = r => r === 'Outstanding' ? GREEN : r === 'Good' ? BLUE : r === 'Requires improvement' ? AMBER : r === 'Inadequate' ? RED : GREY;
function wrap(d, t, w) { return d.splitTextToSize(t, w); }
function n(v, dp = 1) { return v != null ? Number(v).toFixed(dp) : null; }
function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null; }
function decile(val, arr) { if (val == null || !arr.length) return null; const s = [...arr].sort((a, b) => a - b); const r = s.filter(v => v < val).length / s.length; return Math.min(10, Math.max(1, Math.ceil(r * 10))); }
function decCol(d) { if (d >= 8) return GREEN; if (d >= 5) return AMBER; return RED; }

function drawRadar(doc, cx, cy, r, metrics) {
  const nn = metrics.length;
  if (nn < 3) return;
  const step = (2 * Math.PI) / nn, start = -Math.PI / 2;
  const pt = (i, v) => ({ x: cx + (v / 10) * r * Math.cos(start + i * step), y: cy + (v / 10) * r * Math.sin(start + i * step) });
  [2, 4, 6, 8, 10].forEach(ring => {
    doc.setDrawColor(225, 230, 240); doc.setLineWidth(ring === 10 ? 0.4 : 0.15);
    const pts = Array.from({ length: nn }, (_, i) => pt(i, ring));
    pts.forEach((p, i) => { const nx = pts[(i + 1) % nn]; doc.line(p.x, p.y, nx.x, nx.y); });
  });
  for (let i = 0; i < nn; i++) { const p = pt(i, 10); doc.setDrawColor(225, 230, 240); doc.setLineWidth(0.1); doc.line(cx, cy, p.x, p.y); }
  // School polygon
  const spts = metrics.map((m, i) => pt(i, m.decile || 5));
  doc.setFillColor(29, 90, 158); doc.setGState(new doc.GState({ opacity: 0.15 }));
  spts.forEach((p, i) => { i === 0 ? doc.moveTo(p.x, p.y) : doc.lineTo(p.x, p.y); }); doc.fill();
  doc.setGState(new doc.GState({ opacity: 1 }));
  doc.setDrawColor(...BLUE); doc.setLineWidth(0.6);
  spts.forEach((p, i) => { const nx = spts[(i + 1) % nn]; i === 0 ? doc.moveTo(p.x, p.y) : null; doc.line(p.x, p.y, nx.x, nx.y); });
  spts.forEach(p => { doc.setFillColor(...BLUE); doc.circle(p.x, p.y, 1, 'F'); });
  // Labels
  metrics.forEach((m, i) => {
    const lp = pt(i, 12);
    doc.setFontSize(5.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...GREY);
    doc.text(m.label, lp.x, lp.y, { align: 'center' });
    doc.setFontSize(5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...BLUE);
    doc.text(m.value, lp.x, lp.y + 3.5, { align: 'center' });
  });
}

// Sanitize text for jsPDF (Helvetica doesn't support all Unicode)
function sanitize(t) {
  return t.replace(/[\u2013\u2014\u2212]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\u2026/g, '...').replace(/\u00A0/g, ' ');
}

/**
 * Build the school data context for AI briefing
 */
function buildSchoolDataContext(s, all) {
  const isSec = s.phase === 'Secondary' || s.phase === 'All-through', isPri = s.phase === 'Primary';
  const same = all.filter(x => x.phase === s.phase);
  const vals = (arr, k) => arr.map(x => x[k]).filter(v => v != null);

  const lines = [`School: ${s.name} (URN ${s.urn})`, `Type: ${s.type}, Phase: ${s.phase}, Location: ${s.town}, ${s.la} (${s.region})`];
  if (s.trust) lines.push(`Trust: ${s.trust} (${all.filter(x => x.trust === s.trust).length} schools)`);
  lines.push(`Pupils: ${s.pupils || '?'}, FSM: ${s.fsm_pct ?? '?'}% (national avg: ${avg(vals(same, 'fsm_pct'))?.toFixed(1)}%), SEN: ${s.sen_all_pct ?? '?'}%, EAL: ${s.eal_pct ?? '?'}%`);
  if (s.ofsted) lines.push(`Ofsted: ${s.ofsted}${s.ofsted_date ? ' (inspected ' + s.ofsted_date + ')' : ''}`);
  if (s.ofsted_qoe) lines.push(`Sub-judgements: QoE: ${s.ofsted_qoe}, Behaviour: ${s.ofsted_behaviour || '?'}, Personal Dev: ${s.ofsted_personal_dev || '?'}, Leadership: ${s.ofsted_leadership || '?'}${s.ofsted_sixth_form ? ', Sixth Form: ' + s.ofsted_sixth_form : ''}${s.ofsted_early_years ? ', Early Years: ' + s.ofsted_early_years : ''}`);

  if (isSec) {
    if (s.attainment8 != null) lines.push(`Attainment 8: ${n(s.attainment8)} (national avg: ${n(avg(vals(same, 'attainment8')))}, decile ${decile(s.attainment8, vals(same, 'attainment8'))})`);
    if (s.a8_prev != null) lines.push(`A8 previous year: ${n(s.a8_prev)} (change: ${(s.attainment8 - s.a8_prev) > 0 ? '+' : ''}${n(s.attainment8 - s.a8_prev)})`);
    if (s.p8_prev != null) lines.push(`Progress 8 (2024): ${s.p8_prev > 0 ? '+' : ''}${n(s.p8_prev, 2)} (national avg: ${n(avg(vals(same, 'p8_prev')), 2)}, decile ${decile(s.p8_prev, vals(same, 'p8_prev'))})`);
    if (s.basics_94 != null) lines.push(`4+ English & Maths: ${s.basics_94}% (national: ${avg(vals(same, 'basics_94'))?.toFixed(0)}%)`);
    if (s.basics_95 != null) lines.push(`5+ English & Maths: ${s.basics_95}% (national: ${avg(vals(same, 'basics_95'))?.toFixed(0)}%)`);
    if (s.a8_disadv != null) lines.push(`Disadvantaged A8: ${n(s.a8_disadv)}, Non-disadv: ${n(s.a8_nondisadv)}, Gap: ${n((s.a8_nondisadv || 0) - s.a8_disadv)}`);
    if (s.p8_disadv != null) lines.push(`Disadvantaged P8: ${s.p8_disadv > 0 ? '+' : ''}${n(s.p8_disadv, 2)}`);
    if (s.ks4_trend?.length >= 2) {
      lines.push(`A8 trend: ${s.ks4_trend.filter(t => t.a8 != null).map(t => `${t.year || '?'}: ${n(t.a8)}`).join(', ')}`);
    }
  }
  if (isPri) {
    if (s.ks2_rwm_exp != null) lines.push(`RWM Expected: ${s.ks2_rwm_exp}% (national: ${avg(vals(same, 'ks2_rwm_exp'))?.toFixed(0)}%, decile ${decile(s.ks2_rwm_exp, vals(same, 'ks2_rwm_exp'))})`);
    if (s.ks2_read_avg != null) lines.push(`Reading: ${n(s.ks2_read_avg, 0)} (national: ${avg(vals(same, 'ks2_read_avg'))?.toFixed(0)})`);
    if (s.ks2_mat_exp != null) lines.push(`Maths: ${s.ks2_mat_exp}%`);
    if (s.ks2_rwm_disadv != null) lines.push(`Disadvantaged RWM: ${s.ks2_rwm_disadv}%, Non-disadv: ${s.ks2_rwm_nondisadv ?? '?'}%`);
  }

  // Similar schools summary
  const similar = findSimilarSchools(s, all, 5);
  if (similar.length) {
    lines.push(`\nSimilar schools (top 5 by contextual match):`);
    similar.forEach(r => {
      const rs = r.school;
      lines.push(`  ${rs.name} (${rs.la}, ${r.similarity}% match) — ${isSec ? 'A8: ' + n(rs.attainment8) + ', P8: ' + (rs.p8_prev != null ? (rs.p8_prev > 0 ? '+' : '') + n(rs.p8_prev, 2) : '?') : 'RWM: ' + (rs.ks2_rwm_exp ?? '?') + '%'}, Ofsted: ${rs.ofsted || '?'}`);
    });
  }

  // LA context
  const laSchools = same.filter(x => x.la === s.la);
  if (laSchools.length > 2) {
    lines.push(`\n${s.la} context (${laSchools.length} ${s.phase.toLowerCase()} schools):`);
    if (isSec) lines.push(`  LA avg A8: ${n(avg(vals(laSchools, 'attainment8')))}, LA avg P8: ${n(avg(vals(laSchools, 'p8_prev')), 2)}, LA avg FSM: ${avg(vals(laSchools, 'fsm_pct'))?.toFixed(0)}%`);
    if (isPri) lines.push(`  LA avg RWM: ${avg(vals(laSchools, 'ks2_rwm_exp'))?.toFixed(0)}%, LA avg FSM: ${avg(vals(laSchools, 'fsm_pct'))?.toFixed(0)}%`);
  }

  return lines.join('\n');
}

/**
 * Generate AI briefing
 */
async function generateAIBriefing(s, all) {
  const context = buildSchoolDataContext(s, all);

  const reply = await callClaude({
    system: `You are a senior analyst in the Schools Policy team at the Department for Education, writing a ministerial briefing for the Secretary of State for Education and the Schools Minister. This briefing should be the quality you would expect on a minister's desk.

STYLE: Professional, analytical prose. UK English. No markdown. No asterisks or hash symbols. No bullet points. Write in flowing paragraphs.

Write FOUR sections, each as a separate paragraph with a short capitalised heading on its own line:

EXECUTIVE SUMMARY
Two to three sentences capturing the essential character of this school — its strengths, challenges, and overall trajectory. A minister reading only this paragraph should understand the key picture.

PERFORMANCE ANALYSIS
Analyse the school's outcomes in detail, contextualising against national averages and decile positions. Comment on trends where available. Note any tension between attainment and progress. For the Secretary of State, the question is always: are pupils in this school getting a good enough deal?

CONTEXT AND DISADVANTAGE
Examine the school's intake profile — FSM, SEN, EAL — and how this relates to outcomes. If disadvantage data is available, analyse the gap. Compare to similar schools. Is this school performing as expected given its context, better, or worse?

OFSTED AND QUALITY
Analyse the Ofsted picture, including sub-judgements where available. Note any discrepancies between different judgement areas. Consider how the Ofsted picture aligns with the performance data.

Keep the total to approximately 350-450 words. Every claim should be grounded in the data provided. Do not invent data.`,
    messages: [{ role: 'user', content: `Write a ministerial briefing for: \n\n${context}` }],
    maxTokens: 800,
  });

  return reply;
}

/**
 * Main export — async, calls AI if available
 */
export async function exportSchoolPDF(school, allSchools, onProgress) {
  const s = school, all = allSchools;
  const isSec = s.phase === 'Secondary' || s.phase === 'All-through', isPri = s.phase === 'Primary';
  const same = all.filter(x => x.phase === s.phase);
  const vals = (arr, k) => arr.map(x => x[k]).filter(v => v != null);

  // Generate AI briefing if key available
  let aiBriefing = '';
  if (hasApiKey()) {
    if (onProgress) onProgress('Generating AI briefing…');
    try {
      aiBriefing = await generateAIBriefing(s, all);
    } catch (err) {
      console.warn('AI briefing failed:', err);
      aiBriefing = '';
    }
  }

  if (onProgress) onProgress('Building PDF…');

  const doc = new jsPDF('p', 'mm', 'a4');
  const W = 210, H = 297, M = 18, CW = W - M * 2;
  let y = 0;

  // ═══════════════════════════════════════════
  // PAGE 1 — Identity + AI Briefing
  // ═══════════════════════════════════════════

  // Header band
  doc.setFillColor(...NAVY); doc.rect(0, 0, W, 46, 'F');
  doc.setTextColor(160, 175, 200); doc.setFontSize(6.5); doc.setFont('helvetica', 'bold');
  doc.text('MINISTERIAL BRIEFING · SCHOOL PROFILES', M, 10);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(130, 150, 180);
  doc.text(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), W - M, 10, { align: 'right' });
  doc.setTextColor(...WHITE); doc.setFontSize(15); doc.setFont('helvetica', 'bold');
  const nameLines = wrap(doc, s.name, CW - 50); doc.text(nameLines, M, 23);
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(170, 185, 210);
  doc.text([s.la, s.phase, s.type, 'URN ' + s.urn].filter(Boolean).join('  ·  '), M, nameLines.length > 1 ? 34 : 32);
  // Ofsted badge
  if (s.ofsted && s.ofsted !== 'Not inspected') {
    const oc = ofC(s.ofsted); doc.setFillColor(...oc); doc.roundedRect(W - M - 36, 18, 36, 13, 2.5, 2.5, 'F');
    doc.setTextColor(...WHITE); doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.text(s.ofsted, W - M - 18, 26, { align: 'center' });
  }
  // Classification badge
  doc.setFillColor(180, 195, 215); doc.roundedRect(W - M - 36, 33, 36, 6, 1.5, 1.5, 'F');
  doc.setTextColor(...NAVY); doc.setFontSize(5); doc.setFont('helvetica', 'bold');
  doc.text('OFFICIAL - SENSITIVE', W - M - 18, 37.2, { align: 'center' });

  y = 52;

  // Key facts strip — two rows
  const row1Facts = [], row2Facts = [];
  if (s.pupils) row1Facts.push(['Pupils', s.pupils.toLocaleString()]);
  if (s.fsm_pct != null) row1Facts.push(['FSM', s.fsm_pct + '%']);
  if (s.sen_all_pct != null) row1Facts.push(['SEN', s.sen_all_pct + '%']);
  if (s.eal_pct != null) row1Facts.push(['EAL', s.eal_pct + '%']);
  if (s.gender && s.gender !== 'Mixed') row1Facts.push(['Gender', s.gender]);
  if (s.trust) row2Facts.push(['Trust', s.trust.length > 40 ? s.trust.substring(0, 40) + '...' : s.trust]);
  if (s.postcode) row2Facts.push(['Postcode', s.postcode]);
  if (s.town) row2Facts.push(['Town', s.town]);
  if (s.region) row2Facts.push(['Region', s.region]);

  const stripH = row2Facts.length ? 28 : 16;
  doc.setFillColor(245, 247, 250); doc.rect(M, y, CW, stripH, 'F');

  const fw1 = CW / Math.min(row1Facts.length, 6);
  row1Facts.slice(0, 6).forEach((f, i) => {
    const x = M + 4 + i * fw1;
    doc.setFontSize(5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...GREY); doc.text(f[0].toUpperCase(), x, y + 5.5);
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...BLACK); doc.text(f[1], x, y + 11.5);
  });
  if (row2Facts.length) {
    const fw2 = CW / Math.min(row2Facts.length, 5);
    row2Facts.slice(0, 5).forEach((f, i) => {
      const x = M + 4 + i * fw2;
      doc.setFontSize(5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...GREY); doc.text(f[0].toUpperCase(), x, y + 17);
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...BLACK); doc.text(f[1], x, y + 23);
    });
  }
  y += stripH + 4;

  // Headline metrics
  const metrics = [];
  if (isSec) {
    if (s.attainment8 != null) metrics.push({ l: 'Attainment 8', v: n(s.attainment8), d: decile(s.attainment8, vals(same, 'attainment8')), bar: s.attainment8 / 80 });
    if (s.p8_prev != null) metrics.push({ l: 'Progress 8', v: (s.p8_prev > 0 ? '+' : '') + n(s.p8_prev, 2), d: decile(s.p8_prev, vals(same, 'p8_prev')) });
    if (s.basics_94 != null) metrics.push({ l: 'Eng & Ma 4+', v: s.basics_94 + '%', d: decile(s.basics_94, vals(same, 'basics_94')), bar: s.basics_94 / 100 });
    if (s.basics_95 != null) metrics.push({ l: 'Eng & Ma 5+', v: s.basics_95 + '%', d: decile(s.basics_95, vals(same, 'basics_95')), bar: s.basics_95 / 100 });
  }
  if (isPri) {
    if (s.ks2_rwm_exp != null) metrics.push({ l: 'RWM Expected', v: s.ks2_rwm_exp + '%', d: decile(s.ks2_rwm_exp, vals(same, 'ks2_rwm_exp')), bar: s.ks2_rwm_exp / 100 });
    if (s.ks2_rwm_high != null) metrics.push({ l: 'RWM Higher', v: s.ks2_rwm_high + '%', d: decile(s.ks2_rwm_high, vals(same, 'ks2_rwm_high')), bar: s.ks2_rwm_high / 100 });
    if (s.ks2_read_avg != null) metrics.push({ l: 'Reading', v: n(s.ks2_read_avg, 0), d: decile(s.ks2_read_avg, vals(same, 'ks2_read_avg')), bar: s.ks2_read_avg / 120 });
    if (s.ks2_mat_exp != null) metrics.push({ l: 'Maths', v: s.ks2_mat_exp + '%', d: decile(s.ks2_mat_exp, vals(same, 'ks2_mat_exp')), bar: s.ks2_mat_exp / 100 });
  }

  if (metrics.length) {
    const mw = CW / Math.min(metrics.length, 5);
    metrics.slice(0, 5).forEach((m, i) => {
      const x = M + i * mw;
      doc.setFontSize(5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...GREY); doc.text(m.l.toUpperCase(), x, y);
      doc.setFontSize(17); doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY); doc.text(m.v, x, y + 9);
      if (m.d != null) {
        doc.setFillColor(...decCol(m.d)); doc.roundedRect(x, y + 11.5, 13, 5, 1.5, 1.5, 'F');
        doc.setTextColor(...WHITE); doc.setFontSize(5.5); doc.setFont('helvetica', 'bold');
        doc.text('D' + m.d, x + 6.5, y + 15, { align: 'center' });
      }
      if (m.bar != null) {
        const bw = mw - 10;
        doc.setFillColor(225, 230, 240); doc.roundedRect(x, y + 18, bw, 2, 1, 1, 'F');
        doc.setFillColor(...BLUE); doc.roundedRect(x, y + 18, Math.max(0, m.bar * bw), 2, 1, 1, 'F');
      }
    });
    y += 26;
  }

  // Ofsted sub-judgements grid
  if (s.ofsted_qoe) {
    doc.setDrawColor(225, 230, 240); doc.line(M, y, W - M, y); y += 5;
    doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY);
    doc.text('OFSTED SUB-JUDGEMENTS', M, y);
    if (s.ofsted_date) {
      doc.setFontSize(5.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GREY);
      doc.text('Inspected ' + s.ofsted_date, M + 52, y);
    }
    y += 6;
    const allJudges = [
      ['Quality of Education', s.ofsted_qoe],
      ['Behaviour & Attitudes', s.ofsted_behaviour],
      ['Personal Development', s.ofsted_personal_dev],
      ['Leadership & Management', s.ofsted_leadership],
      ...(s.ofsted_early_years ? [['Early Years', s.ofsted_early_years]] : []),
      ...(s.ofsted_sixth_form ? [['Sixth Form', s.ofsted_sixth_form]] : []),
      ...(s.ofsted_safeguarding ? [['Safeguarding', s.ofsted_safeguarding]] : []),
    ].filter(j => j[1]);

    // Row 1: up to 4 items
    const r1 = allJudges.slice(0, 4);
    const jw1 = CW / 4;
    r1.forEach((j, i) => {
      const x = M + i * jw1;
      doc.setFontSize(5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GREY); doc.text(j[0], x, y);
      const jc = j[0] === 'Safeguarding' ? (j[1] === 'Effective' ? GREEN : RED) : ofC(j[1]);
      doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...jc);
      doc.text(j[1], x, y + 5);
    });
    y += 11;

    // Row 2: remaining items if any
    if (allJudges.length > 4) {
      const r2 = allJudges.slice(4);
      const jw2 = CW / 4;
      r2.forEach((j, i) => {
        const x = M + i * jw2;
        doc.setFontSize(5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GREY); doc.text(j[0], x, y);
        const jc = j[0] === 'Safeguarding' ? (j[1] === 'Effective' ? GREEN : RED) : ofC(j[1]);
        doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...jc);
        doc.text(j[1], x, y + 5);
      });
      y += 11;
    }
    y += 2;
  }

  // ── AI BRIEFING ─────────────────────────────
  if (aiBriefing) {
    doc.setDrawColor(...BLUE); doc.setLineWidth(0.8); doc.line(M, y, M + 60, y);
    y += 6;
    const cleanBriefing = sanitize(aiBriefing);
    // Parse sections from AI response
    const sections = cleanBriefing.split(/\n(?=[A-Z]{2,})/);
    sections.forEach(section => {
      const trimmed = section.trim();
      if (!trimmed) return;
      if (y > H - 30) { doc.addPage(); y = M; }
      // Check if first line is a heading
      const firstNewline = trimmed.indexOf('\n');
      const firstLine = firstNewline > 0 ? trimmed.substring(0, firstNewline).trim() : '';
      const isHeading = firstLine && firstLine === firstLine.toUpperCase() && firstLine.length < 50;

      if (isHeading) {
        doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY);
        doc.text(firstLine, M, y); y += 5;
        const body = trimmed.substring(firstNewline + 1).trim();
        if (body) {
          doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 41, 59);
          const lines = wrap(doc, body, CW);
          lines.forEach(line => { if (y > H - 16) { doc.addPage(); y = M; } doc.text(line, M, y); y += 3.8; });
          y += 3;
        }
      } else {
        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 41, 59);
        const lines = wrap(doc, trimmed, CW);
        lines.forEach(line => { if (y > H - 16) { doc.addPage(); y = M; } doc.text(line, M, y); y += 3.8; });
        y += 3;
      }
    });
  }

  // ═══════════════════════════════════════════
  // PAGE 2 — Data Detail
  // ═══════════════════════════════════════════
  doc.addPage();
  y = M;

  // Page 2 header
  doc.setFillColor(...NAVY); doc.rect(0, 0, W, 14, 'F');
  doc.setTextColor(...WHITE); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
  doc.text(s.name + ' - Data Detail', M, 9);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(170, 185, 210);
  doc.text('Page 2', W - M, 9, { align: 'right' });
  y = 20;

  // Radar chart
  const radarData = [];
  if (isSec) {
    if (s.attainment8 != null) radarData.push({ label: 'A8', value: n(s.attainment8), decile: decile(s.attainment8, vals(same, 'attainment8')) });
    if (s.basics_94 != null) radarData.push({ label: '4+ E&M', value: s.basics_94 + '%', decile: decile(s.basics_94, vals(same, 'basics_94')) });
    if (s.basics_95 != null) radarData.push({ label: '5+ E&M', value: s.basics_95 + '%', decile: decile(s.basics_95, vals(same, 'basics_95')) });
    if (s.pupils != null) radarData.push({ label: 'Size', value: s.pupils.toLocaleString(), decile: decile(s.pupils, vals(same, 'pupils')) });
    if (s.p8_prev != null) radarData.push({ label: 'P8', value: (s.p8_prev > 0 ? '+' : '') + n(s.p8_prev, 2), decile: decile(s.p8_prev, vals(same, 'p8_prev')) });
    if (s.fsm_pct != null) radarData.push({ label: 'FSM', value: s.fsm_pct + '%', decile: decile(s.fsm_pct, vals(same, 'fsm_pct')) });
  }
  if (isPri) {
    if (s.ks2_rwm_exp != null) radarData.push({ label: 'RWM', value: s.ks2_rwm_exp + '%', decile: decile(s.ks2_rwm_exp, vals(same, 'ks2_rwm_exp')) });
    if (s.ks2_read_avg != null) radarData.push({ label: 'Read', value: n(s.ks2_read_avg, 0), decile: decile(s.ks2_read_avg, vals(same, 'ks2_read_avg')) });
    if (s.ks2_mat_exp != null) radarData.push({ label: 'Maths', value: s.ks2_mat_exp + '%', decile: decile(s.ks2_mat_exp, vals(same, 'ks2_mat_exp')) });
    if (s.pupils != null) radarData.push({ label: 'Size', value: s.pupils.toLocaleString(), decile: decile(s.pupils, vals(same, 'pupils')) });
    if (s.fsm_pct != null) radarData.push({ label: 'FSM', value: s.fsm_pct + '%', decile: decile(s.fsm_pct, vals(same, 'fsm_pct')) });
  }

  if (radarData.length >= 3) {
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY);
    doc.text('National Decile Profile', W / 2, y, { align: 'center' }); y += 4;
    drawRadar(doc, W / 2, y + 28, 24, radarData);
    y += 60;
    doc.setFontSize(5); doc.setFont('helvetica', 'normal');
    [[GREEN, 'Top (D8-10)'], [AMBER, 'Mid (D5-7)'], [RED, 'Low (D1-4)']].forEach((item, i) => {
      const lx = W / 2 - 28 + i * 24;
      doc.setFillColor(...item[0]); doc.circle(lx, y, 1.5, 'F');
      doc.setTextColor(...GREY); doc.text(item[1], lx + 3, y + 1);
    });
    y += 8;
  }

  // Similar Schools table
  const similar = findSimilarSchools(s, all, 10);
  if (similar.length >= 3) {
    if (y > H - 90) { doc.addPage(); y = M; }
    doc.setDrawColor(...BLUE); doc.setLineWidth(0.6); doc.line(M, y, M + 50, y); y += 5;
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY);
    doc.text('CONTEXTUALLY SIMILAR SCHOOLS', M, y); y += 4;
    doc.setFontSize(5.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GREY);
    doc.text('Schools with similar intake profiles. Outcomes shown for comparison. Green/red indicate above/below target school.', M, y); y += 5;

    const cols = isSec
      ? [{ l: 'School', w: 50 }, { l: 'Match', w: 14 }, { l: 'FSM', w: 11 }, { l: 'SEN', w: 11 }, { l: 'EAL', w: 11 }, { l: 'Pupils', w: 14 }, { l: 'A8', w: 13 }, { l: 'P8', w: 13 }, { l: '4+', w: 11 }, { l: 'Ofsted', w: 14 }]
      : [{ l: 'School', w: 50 }, { l: 'Match', w: 14 }, { l: 'FSM', w: 11 }, { l: 'SEN', w: 11 }, { l: 'EAL', w: 11 }, { l: 'Pupils', w: 14 }, { l: 'RWM', w: 13 }, { l: 'Read', w: 13 }, { l: 'Maths', w: 11 }, { l: 'Ofsted', w: 14 }];
    const totalW = cols.reduce((a, c) => a + c.w, 0);
    const scale = CW / totalW;

    // Header
    doc.setFillColor(241, 245, 249); doc.rect(M, y, CW, 5.5, 'F');
    let cx = M;
    cols.forEach(c => {
      doc.setFontSize(5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...GREY);
      doc.text(c.l.toUpperCase(), cx + 1, y + 3.8); cx += c.w * scale;
    });
    y += 6.5;

    // Target row
    doc.setFillColor(235, 243, 255); doc.rect(M, y - 0.5, CW, 6.5, 'F');
    cx = M;
    const tVals = isSec
      ? [s.name.substring(0, 26), 'TARGET', s.fsm_pct ?? '-', s.sen_all_pct ?? '-', s.eal_pct ?? '-', s.pupils?.toLocaleString() ?? '-', s.attainment8 != null ? n(s.attainment8) : '—', s.p8_prev != null ? (s.p8_prev > 0 ? '+' : '') + n(s.p8_prev, 2) : '—', s.basics_94 != null ? s.basics_94 + '%' : '—', s.ofsted || '-']
      : [s.name.substring(0, 26), 'TARGET', s.fsm_pct ?? '-', s.sen_all_pct ?? '-', s.eal_pct ?? '-', s.pupils?.toLocaleString() ?? '-', s.ks2_rwm_exp != null ? s.ks2_rwm_exp + '%' : '—', s.ks2_read_avg != null ? n(s.ks2_read_avg, 0) : '—', s.ks2_mat_exp != null ? s.ks2_mat_exp + '%' : '—', s.ofsted || '-'];
    tVals.forEach((v, i) => {
      doc.setFontSize(5.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...BLUE);
      doc.text(String(v), cx + 1, y + 4); cx += cols[i].w * scale;
    });
    y += 7.5;

    // School rows
    similar.forEach((r, ri) => {
      if (y > H - 16) { doc.addPage(); y = M; }
      const rs = r.school;
      if (ri % 2 === 0) { doc.setFillColor(249, 250, 252); doc.rect(M, y - 0.5, CW, 6.5, 'F'); }
      cx = M;
      const rVals = isSec
        ? [rs.name.substring(0, 26), r.similarity + '%', rs.fsm_pct ?? '-', rs.sen_all_pct ?? '-', rs.eal_pct ?? '-', rs.pupils?.toLocaleString() ?? '-', rs.attainment8 != null ? n(rs.attainment8) : '—', rs.p8_prev != null ? (rs.p8_prev > 0 ? '+' : '') + n(rs.p8_prev, 2) : '—', rs.basics_94 != null ? rs.basics_94 + '%' : '—', rs.ofsted || '-']
        : [rs.name.substring(0, 26), r.similarity + '%', rs.fsm_pct ?? '-', rs.sen_all_pct ?? '-', rs.eal_pct ?? '-', rs.pupils?.toLocaleString() ?? '-', rs.ks2_rwm_exp != null ? rs.ks2_rwm_exp + '%' : '—', rs.ks2_read_avg != null ? n(rs.ks2_read_avg, 0) : '—', rs.ks2_mat_exp != null ? rs.ks2_mat_exp + '%' : '—', rs.ofsted || '-'];
      rVals.forEach((v, i) => {
        let col = BLACK;
        if (i >= 6 && i <= 8) {
          const tv = isSec ? [s.attainment8, s.p8_prev, s.basics_94][i - 6] : [s.ks2_rwm_exp, s.ks2_read_avg, s.ks2_mat_exp][i - 6];
          const sv = parseFloat(v);
          if (tv != null && !isNaN(sv)) {
            const threshold = (i === 7 && isSec) ? 0.1 : 3;
            col = sv > tv + threshold ? GREEN : sv < tv - threshold ? RED : BLACK;
          }
        }
        doc.setFontSize(5.5); doc.setFont('helvetica', i === 0 ? 'bold' : 'normal'); doc.setTextColor(...col);
        doc.text(String(v), cx + 1, y + 4); cx += cols[i].w * scale;
      });
      y += 7;
    });
    y += 4;

    doc.setFontSize(4.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GREY);
    const methLines = wrap(doc, 'Methodology: Weighted contextual similarity: FSM (25%), EAL (15%), SEN K (13%), EHCP (12%), size (10%), stability (10%), region (15%). Same phase and gender.', CW);
    methLines.forEach(line => { doc.text(line, M, y); y += 2.8; });
  }

  // ── Footer on all pages ─────────────────────
  const tp = doc.internal.getNumberOfPages();
  for (let i = 1; i <= tp; i++) {
    doc.setPage(i);
    doc.setDrawColor(225, 230, 240); doc.line(M, H - 12, W - M, H - 12);
    doc.setFontSize(5.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GREY);
    doc.text('School Profiles · DfE Performance Data 2024/25 · AI-assisted analysis', M, H - 8);
    doc.text('Page ' + i + ' of ' + tp, W - M, H - 8, { align: 'right' });
    doc.setFontSize(4.5); doc.setTextColor(180, 190, 200);
    doc.text('OFFICIAL - SENSITIVE', W / 2, H - 8, { align: 'center' });
  }

  const safe = s.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40);
  doc.save(safe + '_Ministerial_Briefing.pdf');
}
