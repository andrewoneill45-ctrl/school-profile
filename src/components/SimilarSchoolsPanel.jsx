import React, { useMemo } from 'react';
import { findSimilarSchools, similarityExplanation, decileColor } from '../utils/similarSchools';
import './SimilarSchoolsPanel.css';

const PHASE_COLORS = { Primary: '#2672c0', Secondary: '#b91c4a', Special: '#5b3fa0', 'All-through': '#0d7a42' };

const SimilarSchoolsPanel = ({ school, allSchools, onClose, onSelectSchool }) => {
  const results = useMemo(() => findSimilarSchools(school, allSchools, 10), [school, allSchools]);
  const s = school;
  const isSec = s.phase === 'Secondary' || s.phase === 'All-through';
  const isPri = s.phase === 'Primary';

  if (!results.length) {
    return (
      <div className="sim-overlay" onClick={onClose}>
        <div className="sim-panel" onClick={e => e.stopPropagation()}>
          <button className="sim-close" onClick={onClose}>✕</button>
          <h2 className="sim-title">Similar Schools</h2>
          <p style={{ color: '#64748b', fontSize: '0.88rem' }}>Not enough contextual data to find similar schools for {s.name}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sim-overlay" onClick={onClose}>
      <div className="sim-panel" onClick={e => e.stopPropagation()}>
        <button className="sim-close" onClick={onClose}>✕</button>

        {/* Header */}
        <h2 className="sim-title">Similar Schools</h2>
        <p className="sim-subtitle">Schools with a similar intake profile to <strong>{s.name}</strong>, based on FSM, SEN, EAL, school size, stability and region.</p>

        {/* Target school context card */}
        <div className="sim-target">
          <div className="sim-target-name">{s.name}</div>
          <div className="sim-ctx-grid">
            {s.fsm_pct != null && <CtxPill label="FSM" value={s.fsm_pct + '%'} />}
            {s.sen_all_pct != null && <CtxPill label="SEN" value={s.sen_all_pct + '%'} />}
            {s.sen_ehcp_pct != null && <CtxPill label="EHCP" value={s.sen_ehcp_pct + '%'} />}
            {s.eal_pct != null && <CtxPill label="EAL" value={s.eal_pct + '%'} />}
            {s.pupils != null && <CtxPill label="Size" value={s.pupils.toLocaleString()} />}
            {s.region && <CtxPill label="Region" value={s.region} />}
          </div>
        </div>

        {/* Results */}
        <div className="sim-results">
          {results.map((r, i) => {
            const rs = r.school;
            const reason = similarityExplanation(s, r);
            return (
              <div key={rs.urn} className="sim-card" onClick={() => onSelectSchool(rs)}>
                <div className="sim-card-header">
                  <div className="sim-rank">{i + 1}</div>
                  <div className="sim-card-info">
                    <div className="sim-card-name">{rs.name}</div>
                    <div className="sim-card-meta">{rs.la} · {rs.town}</div>
                    {reason && <div className="sim-card-reason">{reason}</div>}
                  </div>
                  <div className="sim-match">{r.similarity}%</div>
                </div>

                {/* Context comparison */}
                <div className="sim-compare-row">
                  {s.fsm_pct != null && rs.fsm_pct != null && (
                    <CompareMetric label="FSM" target={s.fsm_pct} value={rs.fsm_pct} suffix="%" />
                  )}
                  {s.sen_all_pct != null && rs.sen_all_pct != null && (
                    <CompareMetric label="SEN" target={s.sen_all_pct} value={rs.sen_all_pct} suffix="%" />
                  )}
                  {s.eal_pct != null && rs.eal_pct != null && (
                    <CompareMetric label="EAL" target={s.eal_pct} value={rs.eal_pct} suffix="%" />
                  )}
                  {s.pupils != null && rs.pupils != null && (
                    <CompareMetric label="Size" target={s.pupils} value={rs.pupils} />
                  )}
                </div>

                {/* Outcome comparison */}
                {isSec && (
                  <div className="sim-outcomes">
                    {rs.attainment8 != null && <OutcomePill label="A8" value={rs.attainment8.toFixed(1)} target={s.attainment8} />}
                    {rs.p8_prev != null && <OutcomePill label="P8" value={(rs.p8_prev > 0 ? '+' : '') + rs.p8_prev.toFixed(2)} target={s.p8_prev} isP8 />}
                    {rs.basics_94 != null && <OutcomePill label="4+" value={rs.basics_94 + '%'} target={s.basics_94} />}
                    {rs.ofsted && rs.ofsted !== 'Not inspected' && (
                      <span className="sim-ofsted" style={{ background: { Outstanding: '#0d7a42', Good: '#1d5a9e', 'Requires improvement': '#e8920e', Inadequate: '#cc3333' }[rs.ofsted] || '#94a3b8' }}>{rs.ofsted}</span>
                    )}
                  </div>
                )}
                {isPri && (
                  <div className="sim-outcomes">
                    {rs.ks2_rwm_exp != null && <OutcomePill label="RWM" value={rs.ks2_rwm_exp + '%'} target={s.ks2_rwm_exp} />}
                    {rs.ks2_read_avg != null && <OutcomePill label="Read" value={rs.ks2_read_avg.toFixed(0)} target={s.ks2_read_avg} />}
                    {rs.ks2_mat_exp != null && <OutcomePill label="Maths" value={rs.ks2_mat_exp + '%'} target={s.ks2_mat_exp} />}
                    {rs.ofsted && rs.ofsted !== 'Not inspected' && (
                      <span className="sim-ofsted" style={{ background: { Outstanding: '#0d7a42', Good: '#1d5a9e', 'Requires improvement': '#e8920e', Inadequate: '#cc3333' }[rs.ofsted] || '#94a3b8' }}>{rs.ofsted}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Methodology note */}
        <div className="sim-method">
          <strong>Methodology:</strong> Schools are ranked by weighted contextual similarity across FSM (25%), EAL (15%), SEN K (13%), SEN EHCP (12%), school size (10%), pupil stability (10%), and region (15%). Schools must match on phase and gender. Outcomes are shown for comparison but do not influence the similarity ranking.
        </div>
      </div>
    </div>
  );
};

/* Sub-components */
const CtxPill = ({ label, value }) => (
  <div className="sim-ctx-pill">
    <span className="sim-ctx-label">{label}</span>
    <span className="sim-ctx-value">{value}</span>
  </div>
);

const CompareMetric = ({ label, target, value, suffix = '' }) => {
  const diff = value - target;
  const close = Math.abs(diff) < (suffix === '%' ? 5 : target * 0.15);
  return (
    <div className="sim-cm">
      <span className="sim-cm-label">{label}</span>
      <span className="sim-cm-value">{typeof value === 'number' ? (value % 1 === 0 ? value : value.toFixed(1)) : value}{suffix}</span>
      {close && <span className="sim-cm-match">≈</span>}
    </div>
  );
};

const OutcomePill = ({ label, value, target, isP8 }) => {
  let color = '#475569';
  if (target != null) {
    const tv = parseFloat(target);
    const sv = parseFloat(value);
    if (!isNaN(tv) && !isNaN(sv)) {
      if (isP8) {
        color = sv > tv + 0.1 ? '#0d7a42' : sv < tv - 0.1 ? '#cc3333' : '#475569';
      } else {
        color = sv > tv + 3 ? '#0d7a42' : sv < tv - 3 ? '#cc3333' : '#475569';
      }
    }
  }
  return (
    <div className="sim-outcome">
      <span className="sim-out-label">{label}</span>
      <span className="sim-out-value" style={{ color }}>{value}</span>
    </div>
  );
};

export default SimilarSchoolsPanel;
