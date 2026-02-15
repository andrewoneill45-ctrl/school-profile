import React, { useMemo } from 'react';
import { exportSchoolPDF } from '../utils/pdfReport';
import './SchoolProfile.css';

const SchoolProfile = ({ school, allSchools, onClose, onCompare }) => {
  const s = school;
  if (!s) return null;

  const isSecondary = s.phase === 'Secondary' || s.phase === 'All-through';
  const isPrimary = s.phase === 'Primary';

  const context = useMemo(() => {
    if (!allSchools) return {};
    const same = allSchools.filter(x => x.phase === s.phase);
    const la = same.filter(x => x.la === s.la);
    const calcPct = (val, arr) => {
      if (val == null || !arr.length) return null;
      const sorted = [...arr].sort((a, b) => a - b);
      return Math.round((sorted.filter(v => v < val).length / sorted.length) * 100);
    };
    const avg = arr => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length) : null;
    return {
      a8Pct: calcPct(s.attainment8, same.map(x => x.attainment8).filter(Boolean)),
      p8Pct: calcPct(s.progress8, same.map(x => x.progress8).filter(v => v != null)),
      natA8Avg: avg(same.map(x => x.attainment8).filter(Boolean)),
      laA8Avg: avg(la.map(x => x.attainment8).filter(Boolean)),
      laCount: la.length,
      trustSchools: s.trust ? allSchools.filter(x => x.trust === s.trust).length : 0,
    };
  }, [s, allSchools]);

  const pctLabel = (p) => {
    if (p == null) return '';
    if (p >= 90) return 'Top 10%';
    if (p >= 75) return 'Top quartile';
    if (p >= 50) return 'Above average';
    if (p >= 25) return 'Below average';
    return 'Lowest quartile';
  };

  const pctColor = (p) => {
    if (p == null) return 'var(--slate-400)';
    if (p >= 75) return 'var(--green-600)';
    if (p >= 50) return 'var(--blue-600)';
    if (p >= 25) return 'var(--amber-500)';
    return 'var(--red-500)';
  };

  const ofstedColor = (o) => {
    switch (o) {
      case 'Outstanding': return 'var(--ofsted-outstanding)';
      case 'Good': return 'var(--ofsted-good)';
      case 'Requires improvement': return 'var(--ofsted-ri)';
      case 'Inadequate': return 'var(--ofsted-inadequate)';
      default: return 'var(--ofsted-none)';
    }
  };

  const occupancy = s.capacity ? Math.round((s.pupils / s.capacity) * 100) : null;

  return (
    <div className="sp-overlay" onClick={onClose}>
      <div className="sp-panel" onClick={e => e.stopPropagation()}>
        <button className="sp-close" onClick={onClose}>✕</button>

        <div className="sp-header" style={{ borderLeftColor: isSecondary ? 'var(--phase-secondary)' : isPrimary ? 'var(--phase-primary)' : 'var(--phase-special)' }}>
          <div className="sp-phase-badge">{s.phase}</div>
          <h2 className="sp-name">{s.name}</h2>
          <p className="sp-sub">{s.la} · {s.town}{s.postcode ? ` · ${s.postcode}` : ''}</p>
          {s.ofsted && s.ofsted !== 'Not inspected' && (
            <span className="sp-ofsted" style={{ background: ofstedColor(s.ofsted) }}>{s.ofsted}</span>
          )}
        </div>

        <div className="sp-facts">
          {s.pupils && <Fact label="Pupils" value={s.pupils.toLocaleString()} sub={occupancy ? `${occupancy}% full` : null} />}
          {s.type && <Fact label="Type" value={s.type} />}
          {s.gender && <Fact label="Gender" value={s.gender} />}
          {s.fsm_pct != null && <Fact label="FSM" value={`${s.fsm_pct}%`} sub={s.fsm_pct > 30 ? 'Above avg' : s.fsm_pct < 15 ? 'Below avg' : 'Average'} />}
          {s.religiousCharacter && s.religiousCharacter !== 'None' && s.religiousCharacter !== 'Does not apply' && (
            <Fact label="Faith" value={s.religiousCharacter} />
          )}
          {s.trust && <Fact label="Trust" value={s.trust} sub={context.trustSchools > 1 ? `${context.trustSchools} schools` : null} />}
        </div>

        {isSecondary && (s.attainment8 != null || s.progress8 != null) && (
          <div className="sp-section">
            <h3 className="sp-section-title">Key Stage 4</h3>
            <div className="sp-metrics">
              {s.attainment8 != null && (
                <Metric label="Attainment 8" value={s.attainment8.toFixed(1)} pct={context.a8Pct} pctLabel={pctLabel(context.a8Pct)} color={pctColor(context.a8Pct)} max={80}
                  sub={context.natA8Avg ? `National avg: ${context.natA8Avg.toFixed(1)}` : null}
                  sub2={context.laA8Avg ? `${s.la} avg: ${context.laA8Avg.toFixed(1)}` : null} />
              )}
              {s.progress8 != null && (
                <Metric label="Progress 8" value={(s.progress8 > 0 ? '+' : '') + s.progress8.toFixed(2)} pct={context.p8Pct} pctLabel={pctLabel(context.p8Pct)} color={pctColor(context.p8Pct)} />
              )}
              {s.basics_94 != null && <Metric label="Eng & Maths 4+" value={`${s.basics_94}%`} max={100} color="var(--blue-600)" />}
              {s.basics_95 != null && <Metric label="Eng & Maths 5+" value={`${s.basics_95}%`} max={100} color="var(--blue-600)" />}
            </div>
          </div>
        )}

        {isPrimary && (s.ks2_rwm_exp != null || s.ks2_read_avg != null) && (
          <div className="sp-section">
            <h3 className="sp-section-title">Key Stage 2</h3>
            <div className="sp-metrics">
              {s.ks2_rwm_exp != null && <Metric label="RWM Expected" value={`${s.ks2_rwm_exp}%`} max={100} color="var(--blue-600)" />}
              {s.ks2_rwm_high != null && <Metric label="RWM Higher" value={`${s.ks2_rwm_high}%`} max={100} color="var(--green-600)" />}
              {s.ks2_read_avg != null && <Metric label="Reading" value={s.ks2_read_avg.toFixed(0)} sub="Expected: 100" color={s.ks2_read_avg >= 100 ? 'var(--green-600)' : 'var(--amber-500)'} />}
              {s.ks2_math_avg != null && <Metric label="Maths" value={s.ks2_math_avg.toFixed(0)} sub="Expected: 100" color={s.ks2_math_avg >= 100 ? 'var(--green-600)' : 'var(--amber-500)'} />}
            </div>
          </div>
        )}

        <div className="sp-actions">
          <button className="sp-btn sp-btn-primary" onClick={() => exportSchoolPDF(s, allSchools)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg>
            Export PDF
          </button>
          {onCompare && (
            <button className="sp-btn sp-btn-secondary" onClick={() => onCompare(s)}>
              + Compare
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const Fact = ({ label, value, sub }) => (
  <div className="sp-fact">
    <span className="sp-fact-label">{label}</span>
    <span className="sp-fact-value">{value}</span>
    {sub && <span className="sp-fact-sub">{sub}</span>}
  </div>
);

const Metric = ({ label, value, pct, pctLabel, color, max, sub, sub2 }) => (
  <div className="sp-metric">
    <span className="sp-metric-label">{label}</span>
    <span className="sp-metric-value" style={{ color: color || 'var(--slate-900)' }}>{value}</span>
    {pct != null && <span className="sp-metric-pct" style={{ color }}>{pctLabel} ({pct}th percentile)</span>}
    {max && (
      <div className="sp-metric-bar">
        <div className="sp-metric-fill" style={{ width: `${(parseFloat(value) / max) * 100}%`, background: color || 'var(--blue-600)' }} />
      </div>
    )}
    {sub && <span className="sp-metric-sub">{sub}</span>}
    {sub2 && <span className="sp-metric-sub">{sub2}</span>}
  </div>
);

export default SchoolProfile;
