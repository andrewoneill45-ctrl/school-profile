/**
 * AI Utility v2 - school-level intelligence
 * Sends actual school data (smartly truncated) for precise Q&A
 */

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_KEY = import.meta.env.VITE_ANTHROPIC_KEY || '';
const MODEL = 'claude-sonnet-4-20250514';

export async function callClaude({ system, messages, maxTokens = 1024 }) {
  if (!API_KEY) throw new Error('No API key configured. Set VITE_ANTHROPIC_KEY in .env');

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content?.map(c => c.text || '').join('') || '';
}

/**
 * Build a compact data snapshot of filtered schools for AI context
 * Sends aggregates + individual school rows (up to 200)
 */
export function buildSchoolContext(filtered, allSchools) {
  const n = filtered.length;
  const collect = (arr, key) => arr.map(s => s[key]).filter(v => v != null);
  const avg = a => a.length ? (a.reduce((x, y) => x + y, 0) / a.length) : null;
  const med = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

  const a8 = collect(filtered, 'attainment8'), a8All = collect(allSchools, 'attainment8');
  const p8 = collect(filtered, 'p8_prev'), p8All = collect(allSchools, 'p8_prev');
  const b94 = collect(filtered, 'basics_94'), rwm = collect(filtered, 'ks2_rwm_exp');
  const fsm = collect(filtered, 'fsm_pct'), fsmAll = collect(allSchools, 'fsm_pct');
  const sen = collect(filtered, 'sen_all_pct'), eal = collect(filtered, 'eal_pct');

  const lines = [];
  lines.push(`FILTERED SET: ${n} schools.`);

  const phases = {}, ofsted = {}, laMap = {};
  filtered.forEach(s => {
    phases[s.phase || 'Other'] = (phases[s.phase || 'Other'] || 0) + 1;
    if (s.ofsted && s.ofsted !== 'Not inspected') ofsted[s.ofsted] = (ofsted[s.ofsted] || 0) + 1;
    if (s.la) {
      if (!laMap[s.la]) laMap[s.la] = { count: 0, a8: [], p8: [], rwm: [], fsm: [] };
      laMap[s.la].count++;
      if (s.attainment8 != null) laMap[s.la].a8.push(s.attainment8);
      if (s.p8_prev != null) laMap[s.la].p8.push(s.p8_prev);
      if (s.ks2_rwm_exp != null) laMap[s.la].rwm.push(s.ks2_rwm_exp);
      if (s.fsm_pct != null) laMap[s.la].fsm.push(s.fsm_pct);
    }
  });

  lines.push(`Phase: ${Object.entries(phases).map(([k,v]) => `${k}: ${v}`).join(', ')}.`);
  lines.push(`Ofsted: ${Object.entries(ofsted).map(([k,v]) => `${k}: ${v}`).join(', ')}.`);

  if (a8.length) lines.push(`KS4 (${a8.length}): Avg A8: ${avg(a8)?.toFixed(1)}, Med: ${med(a8)?.toFixed(1)}, Avg P8: ${avg(p8)?.toFixed(2)}, 4+: ${avg(b94)?.toFixed(0)}%.`);
  if (rwm.length) lines.push(`KS2 (${rwm.length}): Avg RWM: ${avg(rwm)?.toFixed(0)}%, Read: ${avg(collect(filtered, 'ks2_read_avg'))?.toFixed(0)}.`);
  lines.push(`Context: FSM: ${avg(fsm)?.toFixed(1)}%, SEN: ${avg(sen)?.toFixed(1)}%, EAL: ${avg(eal)?.toFixed(1)}%.`);
  if (a8All.length) lines.push(`NATIONAL: A8: ${avg(a8All)?.toFixed(1)}, P8: ${avg(p8All)?.toFixed(2)}, FSM: ${avg(fsmAll)?.toFixed(1)}%.`);

  const laBreakdown = Object.entries(laMap).map(([la, d]) => ({ la, ...d, avgA8: avg(d.a8), avgP8: avg(d.p8), avgRWM: avg(d.rwm), avgFSM: avg(d.fsm) })).sort((a, b) => b.count - a.count);
  if (laBreakdown.length > 1) {
    lines.push(`\nLA BREAKDOWN:`);
    laBreakdown.slice(0, 20).forEach(la => {
      lines.push(`${la.la}: ${la.count} schools, A8: ${la.avgA8?.toFixed(1) ?? '-'}, P8: ${la.avgP8?.toFixed(2) ?? '-'}, RWM: ${la.avgRWM?.toFixed(0) ?? '-'}%, FSM: ${la.avgFSM?.toFixed(0) ?? '-'}%`);
    });
  }

  // Individual schools (up to 200)
  const schoolsToSend = filtered.slice(0, 200);
  if (schoolsToSend.length > 0) {
    lines.push(`\nSCHOOL DATA (${schoolsToSend.length} of ${n}):`);
    lines.push('name | la | phase | ofsted | pupils | fsm% | sen% | eal% | A8 | P8 | 4+% | 5+% | RWM% | read | trust | QoE | Behaviour | PersonalDev | Leadership');
    schoolsToSend.forEach(s => {
      lines.push([
        s.name, s.la, s.phase, s.ofsted || '-',
        s.pupils || '-', s.fsm_pct ?? '-', s.sen_all_pct ?? '-', s.eal_pct ?? '-',
        s.attainment8?.toFixed(1) ?? '-', s.p8_prev != null ? (s.p8_prev > 0 ? '+' : '') + s.p8_prev.toFixed(2) : '-',
        s.basics_94 ?? '-', s.basics_95 ?? '-',
        s.ks2_rwm_exp ?? '-', s.ks2_read_avg?.toFixed(0) ?? '-',
        s.trust ? s.trust.substring(0, 30) : '-',
        s.ofsted_qoe || '-', s.ofsted_behaviour || '-', s.ofsted_personal_dev || '-', s.ofsted_leadership || '-',
      ].join(' | '));
    });
    if (n > 200) lines.push(`... and ${n - 200} more schools not shown.`);
  }

  return lines.join('\n');
}

const AI_STYLE = `STYLE RULES:
- Write in flowing, well-structured paragraphs. Never use markdown formatting of any kind — no asterisks, no hash symbols, no bullet points, no dashes as list markers.
- Use UK English throughout.
- Structure longer responses with short capitalised section headings on their own line (e.g. OVERVIEW, PERFORMANCE, CONTEXT) followed by prose paragraphs.
- Weave data naturally into sentences rather than listing figures.
- Be analytically sharp. Draw out patterns, tensions, and policy-relevant insights.
- When asked about specific schools, reference them by name with their data.`;

export async function aiAnalytics(query, dataContext, history = []) {
  return callClaude({
    system: `You are an expert education data analyst writing for senior civil servants and ministers at the Department for Education in England. You have access to school-level data for a filtered set of schools.

${AI_STYLE}

DATA:
${dataContext}`,
    messages: [...history.map(m => ({ role: m.role, content: m.content })), { role: 'user', content: query }],
    maxTokens: 1500,
  });
}

export async function aiPlaceBriefing(laName, context) {
  return callClaude({
    system: `You are an expert education analyst at the Department for Education. Write a comprehensive place-based briefing for "${laName}".

${AI_STYLE}

SECTIONS: OVERVIEW, PERFORMANCE, DISADVANTAGE, SCHOOL IMPROVEMENT, IMPLICATIONS

DATA:
${context}`,
    messages: [{ role: 'user', content: `Write a full place-based briefing for ${laName}.` }],
    maxTokens: 2000,
  });
}

export async function aiTrustAnalysis(trustName, context) {
  return callClaude({
    system: `You are an expert education analyst at the Department for Education. Write a comprehensive briefing on the multi-academy trust "${trustName}".

${AI_STYLE}

SECTIONS: OVERVIEW, PERFORMANCE, CONTEXT, VALUE ADDED, POLICY IMPLICATIONS

DATA:
${context}`,
    messages: [{ role: 'user', content: `Write a full analytical briefing on ${trustName}.` }],
    maxTokens: 2000,
  });
}

export async function aiParseSearch(query, sampleLAs, sampleTrusts) {
  const system = `You are a search parser for an English schools data explorer. Convert natural language queries into a JSON filter object.

Available filter keys:
- phase: "Primary" | "Secondary" | "Special" | "All-through"
- ofsted: "Outstanding" | "Good" | "Requires improvement" | "Inadequate"
- ofstedMulti: array of ofsted values
- region: "London" | "South East" | "South West" | "East of England" | "East Midlands" | "West Midlands" | "Yorkshire and The Humber" | "North West" | "North East"
- locationQuery: LA name or town (lowercase)
- trustQuery: trust name (lowercase)
- typeQuery: "academy" | "free school" | "maintained" | "grammar"
- faithQuery: "Roman Catholic" | "Church of England" | "Jewish" | "Muslim" | "_any_faith"
- gender: "Boys" | "Girls"
- minAttainment8 / maxAttainment8: number (20-70)
- minProgress8 / maxProgress8: number (-2 to +2)
- minFSM / maxFSM: percentage (0-100)
- minPupils / maxPupils: number
- postcodeQuery: prefix e.g. "SW1"
- fuzzyQuery: freetext (last resort)
- nameQuery: specific school name

Some LAs: ${sampleLAs.slice(0, 30).join(', ')}.
Some trusts: ${sampleTrusts.slice(0, 20).join(', ')}.

Return ONLY valid JSON, no explanation. For "good or outstanding" use ofstedMulti. For "best/top" use minAttainment8: 55+. For "struggling" use maxAttainment8: 38. For "high disadvantage" use minFSM: 40+.`;

  const reply = await callClaude({ system, messages: [{ role: 'user', content: query }], maxTokens: 300 });
  try { return JSON.parse(reply.replace(/```json\s*|```/g, '').trim()); }
  catch { return { fuzzyQuery: query }; }
}

export function hasApiKey() { return !!API_KEY; }
