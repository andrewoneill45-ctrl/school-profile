import React, { useMemo, useState, useRef, useEffect } from 'react';
import { aiAnalytics, hasApiKey } from '../utils/ai';
import './StatsPanel.css';

/* ─── Helpers ──────────────────────────── */
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const med = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const p10 = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length * 0.1)]; };
const p90 = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length * 0.9)]; };
const pctAbove = (a, v) => a.length ? Math.round(a.filter(x => x > v).length / a.length * 100) : null;

const PHASE_COLORS = { Primary: '#2672c0', Secondary: '#b91c4a', Special: '#5b3fa0', 'All-through': '#0d7a42' };
const OFSTED_COLORS = { Outstanding: '#0d7a42', Good: '#1d5a9e', 'Requires improvement': '#e8920e', Inadequate: '#cc3333' };

const StatsPanel = ({ filtered, allSchools, onClose, activeFilters }) => {
  const [tab, setTab] = useState('overview');
  const [aiQuery, setAiQuery] = useState('');
  const [aiMessages, setAiMessages] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const aiInputRef = useRef(null);
  const aiScrollRef = useRef(null);
  const isFiltered = !!activeFilters;

  const s = useMemo(() => {
    const data = filtered;
    const all = allSchools;
    const n = data.length;

    // Collect arrays
    const collect = (arr, key) => arr.map(s => s[key]).filter(v => v != null);
    const a8 = collect(data, 'attainment8'), a8All = collect(all, 'attainment8');
    const p8 = collect(data, 'p8_prev'), p8All = collect(all, 'p8_prev');
    const b94 = collect(data, 'basics_94'), b94All = collect(all, 'basics_94');
    const b95 = collect(data, 'basics_95'), b95All = collect(all, 'basics_95');
    const rwm = collect(data, 'ks2_rwm_exp'), rwmAll = collect(all, 'ks2_rwm_exp');
    const read = collect(data, 'ks2_read_avg'), readAll = collect(all, 'ks2_read_avg');
    const mat = collect(data, 'ks2_mat_exp'), matAll = collect(all, 'ks2_mat_exp');
    const fsm = collect(data, 'fsm_pct'), fsmAll = collect(all, 'fsm_pct');
    const sen = collect(data, 'sen_all_pct'), senAll = collect(all, 'sen_all_pct');
    const eal = collect(data, 'eal_pct'), ealAll = collect(all, 'eal_pct');
    const pupils = collect(data, 'pupils');

    // Phase / Ofsted counts
    const phases = {}, ofsted = {};
    data.forEach(s => {
      phases[s.phase || 'Other'] = (phases[s.phase || 'Other'] || 0) + 1;
      if (s.ofsted && s.ofsted !== 'Not inspected') ofsted[s.ofsted] = (ofsted[s.ofsted] || 0) + 1;
    });
    const ofstedTotal = Object.values(ofsted).reduce((a, b) => a + b, 0);

    // LA breakdown
    const laMap = {};
    data.forEach(s => {
      if (!s.la) return;
      if (!laMap[s.la]) laMap[s.la] = { count: 0, a8: [], p8: [], rwm: [], fsm: [] };
      laMap[s.la].count++;
      if (s.attainment8 != null) laMap[s.la].a8.push(s.attainment8);
      if (s.p8_prev != null) laMap[s.la].p8.push(s.p8_prev);
      if (s.ks2_rwm_exp != null) laMap[s.la].rwm.push(s.ks2_rwm_exp);
      if (s.fsm_pct != null) laMap[s.la].fsm.push(s.fsm_pct);
    });
    const laBreakdown = Object.entries(laMap)
      .map(([la, d]) => ({ la, ...d, avgA8: avg(d.a8), avgP8: avg(d.p8), avgRWM: avg(d.rwm), avgFSM: avg(d.fsm) }))
      .sort((a, b) => b.count - a.count);

    return {
      n, phases, ofsted, ofstedTotal,
      a8, a8All, p8, p8All, b94, b94All, b95, b95All,
      rwm, rwmAll, read, readAll, mat, matAll,
      fsm, fsmAll, sen, senAll, eal, ealAll, pupils,
      totalPupils: pupils.reduce((a, b) => a + b, 0),
      uniqueLAs: new Set(data.map(s => s.la).filter(Boolean)).size,
      uniqueTrusts: new Set(data.map(s => s.trust).filter(Boolean)).size,
      laBreakdown,
    };
  }, [filtered, allSchools]);

  // Build AI context string for the filtered set
  const aiContext = useMemo(() => {
    const lines = [];
    lines.push(`Filtered set: ${s.n} schools.`);
    if (s.a8.length) lines.push(`KS4: ${s.a8.length} schools. Avg A8: ${avg(s.a8)?.toFixed(1)}, Med A8: ${med(s.a8)?.toFixed(1)}, P10: ${p10(s.a8)?.toFixed(1)}, P90: ${p90(s.a8)?.toFixed(1)}. Avg P8: ${avg(s.p8)?.toFixed(2)}. Avg 4+: ${avg(s.b94)?.toFixed(0)}%. Avg 5+: ${avg(s.b95)?.toFixed(0)}%.`);
    if (s.rwm.length) lines.push(`KS2: ${s.rwm.length} schools. Avg RWM: ${avg(s.rwm)?.toFixed(0)}%, Avg Read: ${avg(s.read)?.toFixed(0)}, Avg Maths: ${avg(s.mat)?.toFixed(0)}%.`);
    if (s.fsm.length) lines.push(`Context: Avg FSM: ${avg(s.fsm)?.toFixed(1)}%, Avg SEN: ${avg(s.sen)?.toFixed(1)}%, Avg EAL: ${avg(s.eal)?.toFixed(1)}%.`);
    lines.push(`Phase mix: ${Object.entries(s.phases).map(([k,v]) => `${k}: ${v}`).join(', ')}.`);
    lines.push(`Ofsted: ${Object.entries(s.ofsted).map(([k,v]) => `${k}: ${v}`).join(', ')}.`);
    if (s.a8All.length) lines.push(`NATIONAL (all schools): Avg A8: ${avg(s.a8All)?.toFixed(1)}, Avg P8: ${avg(s.p8All)?.toFixed(2)}, Avg 4+: ${avg(s.b94All)?.toFixed(0)}%, Avg RWM: ${avg(s.rwmAll)?.toFixed(0)}%, Avg FSM: ${avg(s.fsmAll)?.toFixed(1)}%.`);
    // Top 10 LAs
    if (s.laBreakdown.length) {
      lines.push(`Top LAs in set: ${s.laBreakdown.slice(0, 15).map(la => `${la.la} (${la.count} schools, avgA8: ${la.avgA8?.toFixed(1) ?? 'n/a'}, avgFSM: ${la.avgFSM?.toFixed(0) ?? 'n/a'}%)`).join('; ')}.`);
    }
    return lines.join('\n');
  }, [s]);

  const handleAiSubmit = async (e) => {
    e.preventDefault();
    if (!aiQuery.trim() || aiLoading) return;
    const q = aiQuery.trim();
    setAiMessages(prev => [...prev, { role: 'user', content: q }]);
    setAiQuery('');
    setAiLoading(true);

    try {
      const reply = await aiAnalytics(q, aiContext, aiMessages);
      setAiMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setAiMessages(prev => [...prev, { role: 'assistant', content: 'Error: ' + err.message }]);
    }
    setAiLoading(false);
  };

  useEffect(() => {
    if (aiScrollRef.current) aiScrollRef.current.scrollTop = aiScrollRef.current.scrollHeight;
  }, [aiMessages, aiLoading]);

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'performance', label: 'Performance' },
    { id: 'context', label: 'Context' },
    { id: 'areas', label: 'By Area' },
    { id: 'ai', label: '✦ AI' },
  ];

  return (
    <div className="sp2-overlay" onClick={onClose}>
      <div className="sp2-panel" onClick={e => e.stopPropagation()}>
        <button className="sp2-close" onClick={onClose}>✕ Close</button>

        <h2 className="sp2-title">{isFiltered ? 'Filtered Analysis' : 'All Schools'}</h2>
        <p className="sp2-subtitle">{s.n.toLocaleString()} state-funded schools in England</p>

        {/* Tabs */}
        <div className="sp2-tabs">
          {TABS.map(t => (
            <button key={t.id} className={`sp2-tab ${tab === t.id ? 'sp2-tab-active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>

        {/* ─── Overview Tab ─── */}
        {tab === 'overview' && (
          <div className="sp2-body">
            {/* Key numbers */}
            <div className="sp2-kpi-grid">
              <KPI label="Schools" value={s.n.toLocaleString()} />
              <KPI label="Pupils" value={s.totalPupils?.toLocaleString()} />
              <KPI label="LAs" value={s.uniqueLAs} />
              <KPI label="Trusts" value={s.uniqueTrusts} />
            </div>

            <SectionTitle>Phase</SectionTitle>
            {Object.entries(s.phases).sort((a, b) => b[1] - a[1]).map(([phase, count]) => (
              <BarStat key={phase} label={phase} value={count} total={s.n} color={PHASE_COLORS[phase]} />
            ))}

            <SectionTitle>Ofsted</SectionTitle>
            {['Outstanding', 'Good', 'Requires improvement', 'Inadequate'].map(o => s.ofsted[o] ? (
              <BarStat key={o} label={o} value={s.ofsted[o]} total={s.ofstedTotal} color={OFSTED_COLORS[o]} />
            ) : null)}

            {/* Quick averages */}
            {(s.a8.length > 0 || s.rwm.length > 0) && <>
              <SectionTitle>Averages</SectionTitle>
              <div className="sp2-avg-grid">
                {s.a8.length > 0 && <>
                  <AvgCard label="Attainment 8" value={avg(s.a8)?.toFixed(1)} national={avg(s.a8All)?.toFixed(1)} />
                  <AvgCard label="Progress 8" value={avg(s.p8)?.toFixed(2)} national={avg(s.p8All)?.toFixed(2)} prefix />
                  <AvgCard label="4+ Eng & Ma" value={avg(s.b94)?.toFixed(0) + '%'} national={avg(s.b94All)?.toFixed(0) + '%'} />
                  <AvgCard label="5+ Eng & Ma" value={avg(s.b95)?.toFixed(0) + '%'} national={avg(s.b95All)?.toFixed(0) + '%'} />
                </>}
                {s.rwm.length > 0 && <>
                  <AvgCard label="RWM Expected" value={avg(s.rwm)?.toFixed(0) + '%'} national={avg(s.rwmAll)?.toFixed(0) + '%'} />
                  <AvgCard label="Reading" value={avg(s.read)?.toFixed(0)} national={avg(s.readAll)?.toFixed(0)} />
                  <AvgCard label="Maths" value={avg(s.mat)?.toFixed(0) + '%'} national={avg(s.matAll)?.toFixed(0) + '%'} />
                </>}
                <AvgCard label="FSM %" value={avg(s.fsm)?.toFixed(1) + '%'} national={avg(s.fsmAll)?.toFixed(1) + '%'} />
              </div>
            </>}
          </div>
        )}

        {/* ─── Performance Tab ─── */}
        {tab === 'performance' && (
          <div className="sp2-body">
            {s.a8.length > 0 && <>
              <SectionTitle>Attainment 8 Distribution</SectionTitle>
              <Histogram data={s.a8} national={s.a8All} bins={15} color="#1d5a9e" label="A8" />
              <StatStrip data={s.a8} national={s.a8All} label="A8" />

              <SectionTitle>Progress 8 Distribution</SectionTitle>
              <Histogram data={s.p8} national={s.p8All} bins={15} color="#0d7a42" label="P8" center0 />
              <StatStrip data={s.p8} national={s.p8All} label="P8" dp={2} prefix />

              <SectionTitle>4+ English & Maths</SectionTitle>
              <Histogram data={s.b94} national={s.b94All} bins={12} color="#b91c4a" label="4+%" />
              <StatStrip data={s.b94} national={s.b94All} label="4+" suffix="%" />
            </>}
            {s.rwm.length > 0 && <>
              <SectionTitle>RWM Expected %</SectionTitle>
              <Histogram data={s.rwm} national={s.rwmAll} bins={12} color="#2672c0" label="RWM%" />
              <StatStrip data={s.rwm} national={s.rwmAll} label="RWM" suffix="%" />

              <SectionTitle>Reading Score</SectionTitle>
              <Histogram data={s.read} national={s.readAll} bins={12} color="#0d7a42" label="Reading" />
              <StatStrip data={s.read} national={s.readAll} label="Read" />
            </>}
          </div>
        )}

        {/* ─── Context Tab ─── */}
        {tab === 'context' && (
          <div className="sp2-body">
            <SectionTitle>FSM % Distribution</SectionTitle>
            <Histogram data={s.fsm} national={s.fsmAll} bins={15} color="#e8920e" label="FSM%" />
            <StatStrip data={s.fsm} national={s.fsmAll} label="FSM" suffix="%" />

            {s.sen.length > 0 && <>
              <SectionTitle>SEN % Distribution</SectionTitle>
              <Histogram data={s.sen} national={s.senAll} bins={12} color="#5b3fa0" label="SEN%" />
              <StatStrip data={s.sen} national={s.senAll} label="SEN" suffix="%" />
            </>}

            {s.eal.length > 0 && <>
              <SectionTitle>EAL % Distribution</SectionTitle>
              <Histogram data={s.eal} national={s.ealAll} bins={12} color="#2672c0" label="EAL%" />
              <StatStrip data={s.eal} national={s.ealAll} label="EAL" suffix="%" />
            </>}

            <SectionTitle>School Size Distribution</SectionTitle>
            <Histogram data={s.pupils} bins={15} color="#64748b" label="Pupils" />
            <div className="sp2-stat-strip">
              <div className="sp2-ss-item"><span className="sp2-ss-k">Avg</span><span className="sp2-ss-v">{avg(s.pupils)?.toFixed(0)}</span></div>
              <div className="sp2-ss-item"><span className="sp2-ss-k">Median</span><span className="sp2-ss-v">{med(s.pupils)?.toFixed(0)}</span></div>
              <div className="sp2-ss-item"><span className="sp2-ss-k">Total</span><span className="sp2-ss-v">{s.totalPupils?.toLocaleString()}</span></div>
            </div>
          </div>
        )}

        {/* ─── By Area Tab ─── */}
        {tab === 'areas' && (
          <div className="sp2-body">
            <SectionTitle>Local Authority Breakdown ({s.laBreakdown.length} LAs)</SectionTitle>
            <div className="sp2-la-table-wrap">
              <table className="sp2-la-table">
                <thead>
                  <tr>
                    <th>Local Authority</th>
                    <th>Schools</th>
                    <th>Avg A8</th>
                    <th>Avg P8</th>
                    <th>Avg RWM</th>
                    <th>Avg FSM</th>
                  </tr>
                </thead>
                <tbody>
                  {s.laBreakdown.slice(0, 50).map(la => (
                    <tr key={la.la}>
                      <td className="sp2-la-name">{la.la}</td>
                      <td>{la.count}</td>
                      <td style={{ color: la.avgA8 != null ? colorVsNat(la.avgA8, avg(s.a8All), 3) : '#94a3b8', fontWeight: 700 }}>{la.avgA8?.toFixed(1) ?? '—'}</td>
                      <td style={{ color: la.avgP8 != null ? colorVsNat(la.avgP8, avg(s.p8All), 0.1) : '#94a3b8', fontWeight: 700 }}>{la.avgP8 != null ? (la.avgP8 > 0 ? '+' : '') + la.avgP8.toFixed(2) : '—'}</td>
                      <td style={{ color: la.avgRWM != null ? colorVsNat(la.avgRWM, avg(s.rwmAll), 3) : '#94a3b8', fontWeight: 700 }}>{la.avgRWM?.toFixed(0) ?? '—'}%</td>
                      <td>{la.avgFSM?.toFixed(0) ?? '—'}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── AI Tab ─── */}
        {tab === 'ai' && (
          <div className="sp2-body sp2-ai-body">
            <div className="sp2-ai-header">
              <div className="sp2-ai-badge">✦ AI Analysis</div>
              <p className="sp2-ai-desc">Ask questions about the {s.n.toLocaleString()} schools in your current filtered set. The AI has access to all aggregated performance and context data.</p>
            </div>

            {aiMessages.length === 0 && (
              <div className="sp2-ai-starters">
                <div className="sp2-ai-starter-title">Try asking:</div>
                {[
                  'Write a briefing note summarising these schools',
                  'What are the key patterns in this data?',
                  'Which LAs are performing above average and why might that be?',
                  'How does FSM relate to attainment in this set?',
                  'Compare the performance of these schools to the national average',
                ].map((q, i) => (
                  <button key={i} className="sp2-ai-starter" onClick={() => { setAiQuery(q); setTimeout(() => aiInputRef.current?.form?.requestSubmit(), 50); }}>{q}</button>
                ))}
              </div>
            )}

            <div className="sp2-ai-messages" ref={aiScrollRef}>
              {aiMessages.map((m, i) => (
                <div key={i} className={`sp2-ai-msg sp2-ai-${m.role}`}>
                  {m.role === 'assistant' && <div className="sp2-ai-avatar">✦</div>}
                  <div className="sp2-ai-content">{m.content}</div>
                </div>
              ))}
              {aiLoading && (
                <div className="sp2-ai-msg sp2-ai-assistant">
                  <div className="sp2-ai-avatar">✦</div>
                  <div className="sp2-ai-content sp2-ai-loading">Analysing data…</div>
                </div>
              )}
            </div>

            <form onSubmit={handleAiSubmit} className="sp2-ai-form">
              <input
                ref={aiInputRef}
                className="sp2-ai-input"
                value={aiQuery}
                onChange={e => setAiQuery(e.target.value)}
                placeholder="Ask about this data…"
                disabled={aiLoading}
              />
              <button type="submit" className="sp2-ai-send" disabled={aiLoading || !aiQuery.trim()}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Sub-components ───────────────────── */
const SectionTitle = ({ children }) => <div className="sp2-section-title">{children}</div>;

const KPI = ({ label, value }) => (
  <div className="sp2-kpi">
    <div className="sp2-kpi-value">{value || '—'}</div>
    <div className="sp2-kpi-label">{label}</div>
  </div>
);

const BarStat = ({ label, value, total, color }) => (
  <div className="sp2-bar-row">
    <div className="sp2-bar-info">
      <span>{label}</span>
      <span>{value.toLocaleString()} ({Math.round(value / total * 100)}%)</span>
    </div>
    <div className="sp2-bar-track">
      <div className="sp2-bar-fill" style={{ width: `${(value / total) * 100}%`, background: color }} />
    </div>
  </div>
);

const AvgCard = ({ label, value, national, prefix, suffix }) => {
  const fv = parseFloat(value);
  const nv = parseFloat(national);
  const diff = !isNaN(fv) && !isNaN(nv) ? fv - nv : null;
  return (
    <div className="sp2-avg-card">
      <div className="sp2-avg-label">{label}</div>
      <div className="sp2-avg-value">{prefix && fv > 0 ? '+' : ''}{value}</div>
      {national && <div className="sp2-avg-nat">
        National: {prefix && nv > 0 ? '+' : ''}{national}
        {diff != null && <span style={{ color: diff > 0 ? '#0d7a42' : diff < 0 ? '#cc3333' : '#64748b', marginLeft: 6, fontWeight: 700 }}>
          {diff > 0 ? '▲' : diff < 0 ? '▼' : '='} {Math.abs(diff).toFixed(1)}
        </span>}
      </div>}
    </div>
  );
};

const Histogram = ({ data, national, bins = 12, color = '#1d5a9e', label, center0 }) => {
  if (!data.length) return null;
  const sorted = [...data].sort((a, b) => a - b);
  let min = sorted[0], max = sorted[sorted.length - 1];
  if (center0) { const abs = Math.max(Math.abs(min), Math.abs(max)); min = -abs; max = abs; }
  const range = max - min || 1;
  const bw = range / bins;
  const counts = Array(bins).fill(0);
  data.forEach(v => { const i = Math.min(bins - 1, Math.floor((v - min) / bw)); counts[i]++; });
  const maxCount = Math.max(...counts);

  // National distribution (if provided)
  let natCounts = null;
  if (national && national.length) {
    natCounts = Array(bins).fill(0);
    national.forEach(v => { const i = Math.min(bins - 1, Math.max(0, Math.floor((v - min) / bw))); natCounts[i]++; });
    const natMax = Math.max(...natCounts);
    natCounts = natCounts.map(c => c / natMax * maxCount); // Scale to same height
  }

  const h = 120, w = 500, barGap = 2;
  const barW = (w - barGap * bins) / bins;

  return (
    <div className="sp2-hist-wrap">
      <svg viewBox={`0 0 ${w} ${h + 20}`} className="sp2-hist-svg">
        {/* National overlay */}
        {natCounts && natCounts.map((c, i) => (
          <rect key={'n' + i} x={i * (barW + barGap)} y={h - (c / maxCount) * h}
            width={barW} height={(c / maxCount) * h}
            fill="#e2e8f0" rx="2" />
        ))}
        {/* Filtered bars */}
        {counts.map((c, i) => (
          <rect key={i} x={i * (barW + barGap)} y={h - (c / maxCount) * h}
            width={barW} height={(c / maxCount) * h}
            fill={color} opacity="0.8" rx="2" />
        ))}
        {/* Zero line for P8 */}
        {center0 && (() => {
          const zx = ((0 - min) / range) * w;
          return <line x1={zx} y1={0} x2={zx} y2={h} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,2" />;
        })()}
        {/* X-axis labels */}
        {[0, Math.floor(bins / 4), Math.floor(bins / 2), Math.floor(bins * 3 / 4), bins - 1].map(i => (
          <text key={'l' + i} x={i * (barW + barGap) + barW / 2} y={h + 14}
            textAnchor="middle" fontSize="9" fill="#94a3b8">
            {(min + i * bw).toFixed(label === 'P8' ? 1 : 0)}
          </text>
        ))}
      </svg>
      {national && (
        <div className="sp2-hist-legend">
          <span><span className="sp2-hist-dot" style={{ background: color }} /> Filtered</span>
          <span><span className="sp2-hist-dot" style={{ background: '#e2e8f0' }} /> National</span>
        </div>
      )}
    </div>
  );
};

const StatStrip = ({ data, national, label, dp = 1, suffix = '', prefix }) => {
  if (!data.length) return null;
  const a = avg(data), m = med(data), lo = p10(data), hi = p90(data);
  const na = national ? avg(national) : null;
  const fmt = v => { let s = v?.toFixed(dp); if (prefix && v > 0) s = '+' + s; return s + suffix; };
  return (
    <div className="sp2-stat-strip">
      <div className="sp2-ss-item"><span className="sp2-ss-k">Avg</span><span className="sp2-ss-v">{fmt(a)}</span></div>
      <div className="sp2-ss-item"><span className="sp2-ss-k">Median</span><span className="sp2-ss-v">{fmt(m)}</span></div>
      <div className="sp2-ss-item"><span className="sp2-ss-k">P10</span><span className="sp2-ss-v">{fmt(lo)}</span></div>
      <div className="sp2-ss-item"><span className="sp2-ss-k">P90</span><span className="sp2-ss-v">{fmt(hi)}</span></div>
      {na != null && <div className="sp2-ss-item sp2-ss-nat"><span className="sp2-ss-k">National</span><span className="sp2-ss-v">{fmt(na)}</span></div>}
      <div className="sp2-ss-item"><span className="sp2-ss-k">n</span><span className="sp2-ss-v">{data.length.toLocaleString()}</span></div>
    </div>
  );
};

function colorVsNat(val, nat, threshold) {
  if (val == null || nat == null) return '#334155';
  return val > nat + threshold ? '#0d7a42' : val < nat - threshold ? '#cc3333' : '#334155';
}

export default StatsPanel;
