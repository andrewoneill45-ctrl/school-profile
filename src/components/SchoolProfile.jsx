import React, { useMemo, useState } from 'react';
import { exportSchoolPDF } from '../utils/pdfReport';
import './SchoolProfile.css';

/* ─── Decile helpers ───────────────────────────── */
function calcDecile(val, allVals) {
  if (val == null || !allVals.length) return null;
  const sorted = [...allVals].sort((a, b) => a - b);
  const rank = sorted.filter(v => v < val).length / sorted.length;
  return Math.min(10, Math.max(1, Math.ceil(rank * 10)));
}

export function decileColor(d) {
  if (d == null) return '#94a3b8';
  if (d >= 8) return '#0d7a42';
  if (d >= 5) return '#e8920e';
  return '#cc3333';
}

function decileBg(d) {
  if (d == null) return '#f1f5f9';
  if (d >= 8) return '#ecfdf5';
  if (d >= 5) return '#fffbeb';
  return '#fef2f2';
}

/* ─── SVG Radar Chart ──────────────────────────── */
const RADAR_LABELS = {
  // Secondary
  '4+ Eng & Maths': '4+ Eng & Ma',
  '5+ Eng & Maths': '5+ Eng & Ma',
  'School Size': 'School Size',
  'Progress 8 (2024)': 'P8 (2024)',
  'FSM': 'FSM %',
  // Primary
  'RWM Expected': 'RWM Exp',
  'RWM Higher': 'RWM Higher',
  'Reading': 'Reading',
  'Writing': 'Writing',
  'Maths': 'Maths',
};

const RadarChart = ({ metrics, size = 320 }) => {
  const pad = 80; // extra padding for labels
  const fullSize = size + pad * 2;
  const cx = fullSize / 2, cy = fullSize / 2, r = size * 0.30;
  const n = metrics.length;
  if (n < 3) return null;

  const angleStep = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2;
  const getPoint = (i, val) => {
    const angle = startAngle + i * angleStep;
    const dist = (val / 10) * r;
    return { x: cx + dist * Math.cos(angle), y: cy + dist * Math.sin(angle) };
  };

  const rings = [2, 4, 6, 8, 10];
  const gridLines = rings.map(ring => {
    const points = Array.from({ length: n }, (_, i) => getPoint(i, ring));
    return points.map(p => `${p.x},${p.y}`).join(' ');
  });
  const axes = Array.from({ length: n }, (_, i) => getPoint(i, 10));
  const dataPoints = metrics.map((m, i) => getPoint(i, m.decile || 0));
  const dataPath = dataPoints.map(p => `${p.x},${p.y}`).join(' ');
  const labelPoints = metrics.map((m, i) => {
    const angle = startAngle + i * angleStep;
    const dist = r + 42;
    return { x: cx + dist * Math.cos(angle), y: cy + dist * Math.sin(angle) };
  });

  return (
    <svg width={fullSize} height={fullSize} viewBox={`0 0 ${fullSize} ${fullSize}`} style={{ display: 'block', margin: '0 auto', maxWidth: '100%' }}>
      {gridLines.map((pts, i) => (
        <polygon key={i} points={pts} fill="none" stroke={i === 4 ? '#cbd5e1' : '#e2e8f0'} strokeWidth={i === 4 ? 1.2 : 0.5} />
      ))}
      {axes.map((p, i) => (
        <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#e2e8f0" strokeWidth={0.5} />
      ))}
      {/* Decile ring labels */}
      {[2, 4, 6, 8, 10].map(ring => {
        const p = getPoint(0, ring);
        return <text key={ring} x={p.x + 3} y={p.y - 2} fontSize="7" fill="#cbd5e1" fontFamily="'Source Sans 3', sans-serif">{ring}</text>;
      })}
      <polygon points={dataPath} fill="rgba(29,90,158,0.12)" stroke="#1d5a9e" strokeWidth={2.5} strokeLinejoin="round" />
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={6} fill={decileColor(metrics[i].decile)} stroke="white" strokeWidth={2} />
      ))}
      {labelPoints.map((p, i) => {
        const m = metrics[i];
        const anchor = p.x < cx - 10 ? 'end' : p.x > cx + 10 ? 'start' : 'middle';
        const displayLabel = RADAR_LABELS[m.label] || m.label;
        return (
          <g key={i}>
            <text x={p.x} y={p.y - 4} textAnchor={anchor} fontSize="11" fontWeight="700" fill="#334155" fontFamily="'Source Sans 3', sans-serif">{displayLabel}</text>
            <text x={p.x} y={p.y + 10} textAnchor={anchor} fontSize="12" fontWeight="800" fill={decileColor(m.decile)} fontFamily="'Source Sans 3', sans-serif">
              {m.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

/* ─── Info Popup ───────────────────────────────── */
const DecileInfoPopup = ({ onClose }) => (
  <div className="sp-info-overlay" onClick={onClose}>
    <div className="sp-info-box" onClick={e => e.stopPropagation()}>
      <button className="sp-info-close" onClick={onClose}>✕</button>
      <h3 style={{ margin: '0 0 10px', fontSize: '1rem', color: '#0f172a' }}>Understanding the Performance Profile</h3>
      <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6, margin: '0 0 12px' }}>
        Each metric is ranked against all schools of the same phase nationally and placed into a <strong>decile</strong> (1-10), where 10 is the highest performing.
      </p>
      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 14, borderRadius: 7, background: '#0d7a42', display: 'inline-block' }} /> <span style={{ fontSize: '0.82rem' }}>Top performance (decile 8-10)</span></span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 14, borderRadius: 7, background: '#e8920e', display: 'inline-block' }} /> <span style={{ fontSize: '0.82rem' }}>Mid-range (decile 5-7)</span></span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 14, borderRadius: 7, background: '#cc3333', display: 'inline-block' }} /> <span style={{ fontSize: '0.82rem' }}>Below average (decile 1-4)</span></span>
      </div>
      <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: 0 }}>
        The radar chart shows how a school's profile compares nationally. A larger shape indicates stronger overall performance. Data: DfE performance tables 2024/25.
      </p>
    </div>
  </div>
);

/* ─── Main Component ───────────────────────────── */
const SchoolProfile = ({ school, allSchools, onClose, onCompare }) => {
  const s = school;
  const [showInfo, setShowInfo] = useState(false);
  if (!s) return null;

  const isSecondary = s.phase === 'Secondary' || s.phase === 'All-through';
  const isPrimary = s.phase === 'Primary';

  const ctx = useMemo(() => {
    if (!allSchools) return {};
    const same = allSchools.filter(x => x.phase === s.phase);
    const la = same.filter(x => x.la === s.la);
    const vals = (arr, key) => arr.map(x => x[key]).filter(v => v != null);
    return {
      same, la,
      a8Decile: calcDecile(s.attainment8, vals(same, 'attainment8')),
      p8PrevDecile: calcDecile(s.p8_prev, vals(same, 'p8_prev')),
      b94Decile: calcDecile(s.basics_94, vals(same, 'basics_94')),
      b95Decile: calcDecile(s.basics_95, vals(same, 'basics_95')),
      fsmDecile: calcDecile(s.fsm_pct, vals(same, 'fsm_pct')),
      pupilDecile: calcDecile(s.pupils, vals(same, 'pupils')),
      rwmExpDecile: calcDecile(s.ks2_rwm_exp, vals(same, 'ks2_rwm_exp')),
      rwmHighDecile: calcDecile(s.ks2_rwm_high, vals(same, 'ks2_rwm_high')),
      readDecile: calcDecile(s.ks2_read_avg, vals(same, 'ks2_read_avg')),
      writDecile: calcDecile(s.ks2_writ_exp, vals(same, 'ks2_writ_exp')),
      matDecile: calcDecile(s.ks2_mat_exp, vals(same, 'ks2_mat_exp')),
      natA8: avg(vals(same, 'attainment8')),
      laA8: avg(vals(la, 'attainment8')),
      trustSchools: s.trust ? allSchools.filter(x => x.trust === s.trust).length : 0,
    };
  }, [s, allSchools]);

  const radarMetrics = useMemo(() => {
    if (isSecondary) {
      const m = [];
      if (s.basics_94 != null) m.push({ label: '4+ Eng & Maths', value: s.basics_94 + '%', decile: ctx.b94Decile });
      if (s.basics_95 != null) m.push({ label: '5+ Eng & Maths', value: s.basics_95 + '%', decile: ctx.b95Decile });
      if (s.pupils != null) m.push({ label: 'School Size', value: s.pupils.toLocaleString(), decile: ctx.pupilDecile });
      if (s.p8_prev != null) m.push({ label: 'Progress 8 (2024)', value: (s.p8_prev > 0 ? '+' : '') + s.p8_prev.toFixed(2), decile: ctx.p8PrevDecile });
      if (s.fsm_pct != null) m.push({ label: 'FSM', value: s.fsm_pct + '%', decile: 11 - (ctx.fsmDecile || 5) });
      return m;
    }
    if (isPrimary) {
      const m = [];
      if (s.ks2_rwm_exp != null) m.push({ label: 'RWM Expected', value: s.ks2_rwm_exp + '%', decile: ctx.rwmExpDecile });
      if (s.ks2_rwm_high != null) m.push({ label: 'RWM Higher', value: s.ks2_rwm_high + '%', decile: ctx.rwmHighDecile });
      if (s.ks2_read_avg != null) m.push({ label: 'Reading', value: s.ks2_read_avg.toFixed(0), decile: ctx.readDecile });
      if (s.ks2_writ_exp != null) m.push({ label: 'Writing', value: s.ks2_writ_exp + '%', decile: ctx.writDecile });
      if (s.ks2_mat_exp != null) m.push({ label: 'Maths', value: s.ks2_mat_exp + '%', decile: ctx.matDecile });
      return m;
    }
    return [];
  }, [s, ctx, isSecondary, isPrimary]);

  const ofstedColor = (o) => {
    const map = { Outstanding: '#0d7a42', Good: '#1d5a9e', 'Requires improvement': '#e8920e', Inadequate: '#cc3333' };
    return map[o] || '#94a3b8';
  };

  const occupancy = s.capacity ? Math.round((s.pupils / s.capacity) * 100) : null;

  return (
    <div className="sp-overlay" onClick={onClose}>
      <div className="sp-panel" onClick={e => e.stopPropagation()}>
        <button className="sp-close" onClick={onClose}>✕</button>

        <div className="sp-header" style={{ borderLeftColor: isSecondary ? '#b91c4a' : isPrimary ? '#2672c0' : '#5b3fa0' }}>
          <div className="sp-phase-badge">{s.phase}</div>
          <h2 className="sp-name">{s.name}</h2>
          <p className="sp-sub">{s.la} · {s.town}{s.postcode ? ` · ${s.postcode}` : ''}</p>
          {s.ofsted && s.ofsted !== 'Not inspected' && (
            <span className="sp-ofsted" style={{ background: ofstedColor(s.ofsted) }}>{s.ofsted}</span>
          )}
        </div>

        <div className="sp-facts">
          {s.pupils != null && <Fact label="Pupils" value={s.pupils.toLocaleString()} sub={occupancy ? `${occupancy}% full` : null} />}
          {s.type && <Fact label="Type" value={s.type} />}
          {s.fsm_pct != null && <Fact label="FSM" value={`${s.fsm_pct}%`} />}
          {s.trust && <Fact label="Trust" value={s.trust} sub={ctx.trustSchools > 1 ? `${ctx.trustSchools} schools` : null} />}
        </div>

        {/* Headlines - colour coded, no D-numbers */}
        {isSecondary && s.attainment8 != null && (
          <div className="sp-headlines">
            <Headline label="Attainment 8" value={s.attainment8.toFixed(1)} decile={ctx.a8Decile} prev={s.a8_prev} />
            {s.p8_prev != null && <Headline label="Progress 8 (2024)" value={(s.p8_prev > 0 ? '+' : '') + s.p8_prev.toFixed(2)} decile={ctx.p8PrevDecile} />}
            {s.basics_94 != null && <Headline label="4+ Eng & Ma" value={s.basics_94 + '%'} decile={ctx.b94Decile} prev={s.b94_prev} />}
            {s.basics_95 != null && <Headline label="5+ Eng & Ma" value={s.basics_95 + '%'} decile={ctx.b95Decile} prev={s.b95_prev} />}
          </div>
        )}
        {isPrimary && s.ks2_rwm_exp != null && (
          <div className="sp-headlines">
            <Headline label="RWM Expected" value={s.ks2_rwm_exp + '%'} decile={ctx.rwmExpDecile} prev={s.ks2_rwm_prev} suffix="%" />
            {s.ks2_rwm_high != null && <Headline label="RWM Higher" value={s.ks2_rwm_high + '%'} decile={ctx.rwmHighDecile} />}
            {s.ks2_read_avg != null && <Headline label="Reading" value={s.ks2_read_avg.toFixed(0)} decile={ctx.readDecile} prev={s.ks2_read_avg_prev} />}
            {s.ks2_writ_exp != null && <Headline label="Writing" value={s.ks2_writ_exp + '%'} decile={ctx.writDecile} />}
            {s.ks2_mat_exp != null && <Headline label="Maths" value={s.ks2_mat_exp + '%'} decile={ctx.matDecile} />}
          </div>
        )}

        {/* Radar */}
        {radarMetrics.length >= 3 && (
          <div className="sp-section">
            <div className="sp-section-header">
              <h3 className="sp-section-title" style={{ marginBottom: 0 }}>National Performance Profile</h3>
              <button className="sp-info-btn" onClick={() => setShowInfo(true)} title="What does this mean?">ⓘ</button>
            </div>
            <RadarChart metrics={radarMetrics} size={320} />
            <div className="sp-decile-legend">
              <span className="sp-dl-item"><span className="sp-dl-dot" style={{ background: '#0d7a42' }} />Top</span>
              <span className="sp-dl-item"><span className="sp-dl-dot" style={{ background: '#e8920e' }} />Mid-range</span>
              <span className="sp-dl-item"><span className="sp-dl-dot" style={{ background: '#cc3333' }} />Below average</span>
            </div>
          </div>
        )}

        {/* Disadvantaged */}
        {isSecondary && s.a8_disadv != null && (
          <div className="sp-section">
            <h3 className="sp-section-title">Disadvantaged Gap</h3>
            <div className="sp-gap-grid">
              <GapBar label="A8" disadv={s.a8_disadv} other={s.a8_nondisadv} max={80} />
              {s.b94_disadv != null && <GapBar label="4+ E&M" disadv={s.b94_disadv} other={s.b94_nondisadv} max={100} suffix="%" />}
              {s.b95_disadv != null && <GapBar label="5+ E&M" disadv={s.b95_disadv} other={s.b95_nondisadv} max={100} suffix="%" />}
            </div>
          </div>
        )}

        <div className="sp-actions">
          <button className="sp-btn sp-btn-primary" onClick={() => exportSchoolPDF(s, allSchools)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg>
            Export PDF
          </button>
          {onCompare && <button className="sp-btn sp-btn-secondary" onClick={() => onCompare(s)}>+ Compare</button>}
        </div>
      </div>

      {showInfo && <DecileInfoPopup onClose={() => setShowInfo(false)} />}
    </div>
  );
};

/* ─── Sub-components ───────────────────────────── */
function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null; }

const Fact = ({ label, value, sub }) => (
  <div className="sp-fact">
    <span className="sp-fact-label">{label}</span>
    <span className="sp-fact-value">{value}</span>
    {sub && <span className="sp-fact-sub">{sub}</span>}
  </div>
);

const Headline = ({ label, value, decile, prev, suffix }) => {
  const change = prev != null ? (parseFloat(value) - prev) : null;
  return (
    <div className="sp-headline" style={{ background: decileBg(decile), borderLeft: `3px solid ${decileColor(decile)}` }}>
      <span className="sp-hl-label">{label}</span>
      <span className="sp-hl-value" style={{ color: decileColor(decile) }}>{value}</span>
      {change != null && change !== 0 && (
        <span className={`sp-hl-change ${change > 0 ? 'sp-up' : 'sp-down'}`}>
          {change > 0 ? '▲' : '▼'} {Math.abs(change).toFixed(change % 1 === 0 ? 0 : 1)}{suffix || ''}
        </span>
      )}
    </div>
  );
};

const GapBar = ({ label, disadv, other, max, suffix = '' }) => {
  if (disadv == null) return null;
  const gap = other != null ? (other - disadv) : null;
  return (
    <div className="sp-gap-row">
      <span className="sp-gap-label">{label}</span>
      <div className="sp-gap-bars">
        <div className="sp-gap-bar-wrap"><div className="sp-gap-bar sp-gap-disadv" style={{ width: `${(disadv / max) * 100}%` }} /><span className="sp-gap-val">{disadv}{suffix} Disadv</span></div>
        {other != null && <div className="sp-gap-bar-wrap"><div className="sp-gap-bar sp-gap-other" style={{ width: `${(other / max) * 100}%` }} /><span className="sp-gap-val">{other}{suffix} Other</span></div>}
      </div>
      {gap != null && <span className="sp-gap-diff">Gap: {gap.toFixed(1)}</span>}
    </div>
  );
};

export default SchoolProfile;
