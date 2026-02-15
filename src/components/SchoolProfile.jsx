import React, { useMemo } from 'react';
import { exportSchoolPDF } from '../utils/pdfReport';
import './SchoolProfile.css';

/* ─── Decile helpers ───────────────────────────── */
function calcDecile(val, allVals) {
  if (val == null || !allVals.length) return null;
  const sorted = [...allVals].sort((a, b) => a - b);
  const rank = sorted.filter(v => v < val).length / sorted.length;
  return Math.min(10, Math.max(1, Math.ceil(rank * 10)));
}

function decileColor(d) {
  if (d == null) return '#94a3b8';
  if (d >= 8) return '#0d7a42'; // green
  if (d >= 5) return '#e8920e'; // amber
  return '#cc3333'; // red
}

function decileLabel(d) {
  if (d == null) return '';
  if (d >= 8) return 'Top';
  if (d >= 5) return 'Mid';
  return 'Low';
}

/* ─── SVG Radar Chart ──────────────────────────── */
const RadarChart = ({ metrics, size = 220 }) => {
  const cx = size / 2, cy = size / 2, r = size * 0.36;
  const n = metrics.length;
  if (n < 3) return null;

  const angleStep = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2;

  const getPoint = (i, val) => {
    const angle = startAngle + i * angleStep;
    const dist = (val / 10) * r;
    return { x: cx + dist * Math.cos(angle), y: cy + dist * Math.sin(angle) };
  };

  // Grid rings
  const rings = [2, 4, 6, 8, 10];
  const gridLines = rings.map(ring => {
    const points = Array.from({ length: n }, (_, i) => getPoint(i, ring));
    return points.map(p => `${p.x},${p.y}`).join(' ');
  });

  // Axis lines
  const axes = Array.from({ length: n }, (_, i) => getPoint(i, 10));

  // Data polygon
  const dataPoints = metrics.map((m, i) => getPoint(i, m.decile || 0));
  const dataPath = dataPoints.map(p => `${p.x},${p.y}`).join(' ');

  // Label positions (pushed out a bit)
  const labelPoints = metrics.map((m, i) => {
    const angle = startAngle + i * angleStep;
    const dist = r + 30;
    return { x: cx + dist * Math.cos(angle), y: cy + dist * Math.sin(angle) };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', margin: '0 auto' }}>
      {/* Grid */}
      {gridLines.map((pts, i) => (
        <polygon key={i} points={pts} fill="none" stroke="#e2e8f0" strokeWidth={i === 4 ? 1.5 : 0.5} />
      ))}
      {/* Axes */}
      {axes.map((p, i) => (
        <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#e2e8f0" strokeWidth={0.5} />
      ))}
      {/* Data area */}
      <polygon points={dataPath} fill="rgba(29,90,158,0.15)" stroke="#1d5a9e" strokeWidth={2} />
      {/* Data points */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4.5} fill={decileColor(metrics[i].decile)} stroke="white" strokeWidth={1.5} />
      ))}
      {/* Labels */}
      {labelPoints.map((p, i) => {
        const m = metrics[i];
        const anchor = p.x < cx - 10 ? 'end' : p.x > cx + 10 ? 'start' : 'middle';
        return (
          <g key={i}>
            <text x={p.x} y={p.y - 5} textAnchor={anchor} fontSize="9" fontWeight="700" fill="#0f172a" fontFamily="'Source Sans 3', sans-serif">{m.label}</text>
            <text x={p.x} y={p.y + 7} textAnchor={anchor} fontSize="8" fontWeight="600" fill={decileColor(m.decile)} fontFamily="'Source Sans 3', sans-serif">
              D{m.decile || '?'} · {m.value}
            </text>
          </g>
        );
      })}
      {/* Centre label */}
      <text x={cx} y={cy + 3} textAnchor="middle" fontSize="7" fill="#94a3b8" fontFamily="'Source Sans 3', sans-serif">National Decile</text>
    </svg>
  );
};

/* ─── Main Component ───────────────────────────── */
const SchoolProfile = ({ school, allSchools, onClose, onCompare }) => {
  const s = school;
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
      // Secondary deciles
      a8Decile: calcDecile(s.attainment8, vals(same, 'attainment8')),
      p8PrevDecile: calcDecile(s.p8_prev, vals(same, 'p8_prev')),
      b94Decile: calcDecile(s.basics_94, vals(same, 'basics_94')),
      b95Decile: calcDecile(s.basics_95, vals(same, 'basics_95')),
      fsmDecile: calcDecile(s.fsm_pct, vals(same, 'fsm_pct')),
      pupilDecile: calcDecile(s.pupils, vals(same, 'pupils')),
      // Primary deciles
      rwmExpDecile: calcDecile(s.ks2_rwm_exp, vals(same, 'ks2_rwm_exp')),
      rwmHighDecile: calcDecile(s.ks2_rwm_high, vals(same, 'ks2_rwm_high')),
      readDecile: calcDecile(s.ks2_read_avg, vals(same, 'ks2_read_avg')),
      writDecile: calcDecile(s.ks2_writ_exp, vals(same, 'ks2_writ_exp')),
      matDecile: calcDecile(s.ks2_mat_exp, vals(same, 'ks2_mat_exp')),
      // Averages
      natA8: avg(vals(same, 'attainment8')),
      laA8: avg(vals(la, 'attainment8')),
      laCount: la.length,
      trustSchools: s.trust ? allSchools.filter(x => x.trust === s.trust).length : 0,
    };
  }, [s, allSchools]);

  const occupancy = s.capacity ? Math.round((s.pupils / s.capacity) * 100) : null;

  // ── Radar metrics ──────────────────────────────
  const radarMetrics = useMemo(() => {
    if (isSecondary) {
      const m = [];
      if (s.basics_94 != null) m.push({ label: '4+ Eng & Ma', value: s.basics_94 + '%', decile: ctx.b94Decile });
      if (s.basics_95 != null) m.push({ label: '5+ Eng & Ma', value: s.basics_95 + '%', decile: ctx.b95Decile });
      if (s.pupils != null) m.push({ label: 'School Size', value: s.pupils.toLocaleString(), decile: ctx.pupilDecile });
      if (s.p8_prev != null) m.push({ label: 'P8 2024', value: (s.p8_prev > 0 ? '+' : '') + s.p8_prev.toFixed(2), decile: ctx.p8PrevDecile });
      if (s.fsm_pct != null) m.push({ label: 'FSM %', value: s.fsm_pct + '%', decile: 11 - (ctx.fsmDecile || 5) }); // Invert: low FSM = good
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

  return (
    <div className="sp-overlay" onClick={onClose}>
      <div className="sp-panel" onClick={e => e.stopPropagation()}>
        <button className="sp-close" onClick={onClose}>✕</button>

        {/* Header */}
        <div className="sp-header" style={{ borderLeftColor: isSecondary ? '#b91c4a' : isPrimary ? '#2672c0' : '#5b3fa0' }}>
          <div className="sp-phase-badge">{s.phase}</div>
          <h2 className="sp-name">{s.name}</h2>
          <p className="sp-sub">{s.la} · {s.town}{s.postcode ? ` · ${s.postcode}` : ''}</p>
          {s.ofsted && s.ofsted !== 'Not inspected' && (
            <span className="sp-ofsted" style={{ background: ofstedColor(s.ofsted) }}>{s.ofsted}</span>
          )}
        </div>

        {/* Key facts */}
        <div className="sp-facts">
          {s.pupils != null && <Fact label="Pupils" value={s.pupils.toLocaleString()} sub={occupancy ? `${occupancy}% full` : null} />}
          {s.type && <Fact label="Type" value={s.type} />}
          {s.fsm_pct != null && <Fact label="FSM" value={`${s.fsm_pct}%`} />}
          {s.trust && <Fact label="Trust" value={s.trust} sub={ctx.trustSchools > 1 ? `${ctx.trustSchools} schools` : null} />}
        </div>

        {/* Headline scores */}
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

        {/* Radar chart */}
        {radarMetrics.length >= 3 && (
          <div className="sp-section">
            <h3 className="sp-section-title">National Decile Profile</h3>
            <RadarChart metrics={radarMetrics} size={240} />
            <div className="sp-decile-legend">
              <span className="sp-dl-item"><span className="sp-dl-dot" style={{ background: '#0d7a42' }} />Top (D8-10)</span>
              <span className="sp-dl-item"><span className="sp-dl-dot" style={{ background: '#e8920e' }} />Mid (D5-7)</span>
              <span className="sp-dl-item"><span className="sp-dl-dot" style={{ background: '#cc3333' }} />Low (D1-4)</span>
            </div>
          </div>
        )}

        {/* Disadvantaged breakdown */}
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

        {/* Actions */}
        <div className="sp-actions">
          <button className="sp-btn sp-btn-primary" onClick={() => exportSchoolPDF(s, allSchools)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg>
            Export PDF
          </button>
          {onCompare && (
            <button className="sp-btn sp-btn-secondary" onClick={() => onCompare(s)}>+ Compare</button>
          )}
        </div>
      </div>
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
    <div className="sp-headline">
      <span className="sp-hl-label">{label}</span>
      <span className="sp-hl-value">{value}</span>
      <div className="sp-hl-meta">
        {decile != null && (
          <span className="sp-hl-decile" style={{ background: decileColor(decile) }}>D{decile}</span>
        )}
        {change != null && change !== 0 && (
          <span className={`sp-hl-change ${change > 0 ? 'sp-up' : 'sp-down'}`}>
            {change > 0 ? '▲' : '▼'} {Math.abs(change).toFixed(change % 1 === 0 ? 0 : 1)}{suffix || ''}
          </span>
        )}
      </div>
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
        <div className="sp-gap-bar-wrap">
          <div className="sp-gap-bar sp-gap-disadv" style={{ width: `${(disadv / max) * 100}%` }} />
          <span className="sp-gap-val">{disadv}{suffix}</span>
        </div>
        {other != null && (
          <div className="sp-gap-bar-wrap">
            <div className="sp-gap-bar sp-gap-other" style={{ width: `${(other / max) * 100}%` }} />
            <span className="sp-gap-val">{other}{suffix}</span>
          </div>
        )}
      </div>
      {gap != null && <span className="sp-gap-diff">Gap: {gap.toFixed(1)}</span>}
    </div>
  );
};

export default SchoolProfile;
