import React, { useMemo, useState, useRef } from 'react';
import { findSimilarSchools, similarityExplanation } from '../utils/similarSchools';
import './SimilarSchoolsPanel.css';

const SimilarSchoolsPanel = ({ school, allSchools, onClose, onSelectSchool }) => {
  const results = useMemo(() => findSimilarSchools(school, allSchools, 10), [school, allSchools]);
  const s = school;
  const isSec = s.phase === 'Secondary' || s.phase === 'All-through';
  const isPri = s.phase === 'Primary';
  const [hoveredSchool, setHoveredSchool] = useState(null);
  const [hoverPos, setHoverPos] = useState(null);
  const chartRef = useRef(null);

  const allSchoolsInChart = useMemo(() => {
    if (!results.length) return [];
    return [{ school: s, distance: 0, similarity: 100, isTarget: true }, ...results];
  }, [s, results]);

  const metrics = useMemo(() => {
    if (isSec) return [
      { key: 'attainment8', label: 'Attainment 8', fmt: v => v?.toFixed(1), field: 'attainment8' },
      { key: 'p8_prev', label: 'Progress 8 (2024)', fmt: v => v != null ? (v > 0 ? '+' : '') + v.toFixed(2) : null, field: 'p8_prev' },
      { key: 'basics_94', label: '4+ English & Maths', fmt: v => v != null ? v + '%' : null, field: 'basics_94' },
      { key: 'basics_95', label: '5+ English & Maths', fmt: v => v != null ? v + '%' : null, field: 'basics_95' },
    ];
    if (isPri) return [
      { key: 'ks2_rwm_exp', label: 'RWM Expected %', fmt: v => v != null ? v + '%' : null, field: 'ks2_rwm_exp' },
      { key: 'ks2_rwm_high', label: 'RWM Higher %', fmt: v => v != null ? v + '%' : null, field: 'ks2_rwm_high' },
      { key: 'ks2_read_avg', label: 'Reading Score', fmt: v => v?.toFixed(0), field: 'ks2_read_avg' },
      { key: 'ks2_mat_exp', label: 'Maths Expected %', fmt: v => v != null ? v + '%' : null, field: 'ks2_mat_exp' },
    ];
    return [];
  }, [isSec, isPri]);

  const handleBarHover = (e, item) => {
    if (!chartRef.current) return;
    const rect = chartRef.current.getBoundingClientRect();
    setHoveredSchool(item);
    setHoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  if (!results.length) {
    return (
      <div className="simf-overlay">
        <div className="simf-full">
          <button className="simf-close" onClick={onClose}>✕ Close</button>
          <h2 className="simf-title">Similar Schools</h2>
          <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Not enough contextual data to find similar schools for {s.name}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="simf-overlay">
      <div className="simf-full">
        <button className="simf-close" onClick={onClose}>✕ Close</button>

        <div className="simf-header">
          <h2 className="simf-title">Similar Schools to {s.name}</h2>
          <p className="simf-subtitle">
            10 schools with the most similar intake profile, based on FSM, SEN, EAL, school size, pupil stability and region. Outcomes shown for comparison only.
          </p>
          <div className="simf-ctx-row">
            {s.fsm_pct != null && <CtxTag label="FSM" value={s.fsm_pct + '%'} />}
            {s.sen_all_pct != null && <CtxTag label="SEN" value={s.sen_all_pct + '%'} />}
            {s.sen_ehcp_pct != null && <CtxTag label="EHCP" value={s.sen_ehcp_pct + '%'} />}
            {s.eal_pct != null && <CtxTag label="EAL" value={s.eal_pct + '%'} />}
            {s.pupils != null && <CtxTag label="Pupils" value={s.pupils.toLocaleString()} />}
            {s.stability_pct != null && <CtxTag label="Stability" value={s.stability_pct + '%'} />}
            {s.region && <CtxTag label="Region" value={s.region} />}
          </div>
        </div>

        <div className="simf-charts" ref={chartRef}>
          {metrics.map(metric => {
            const vals = allSchoolsInChart.map(r => r.school[metric.field]).filter(v => v != null);
            if (vals.length < 2) return null;
            let mn = Math.min(...vals), mx = Math.max(...vals);
            const isP8 = metric.key === 'p8_prev';
            if (isP8) { const abs = Math.max(Math.abs(mn), Math.abs(mx), 0.5); mn = -abs; mx = abs; }
            else { const pad = (mx - mn) * 0.1 || 1; mn = Math.max(0, mn - pad); mx = mx + pad; }
            const range = mx - mn || 1;

            return (
              <div key={metric.key} className="simf-chart-block">
                <h3 className="simf-chart-title">{metric.label}</h3>
                <div className="simf-bar-chart">
                  {allSchoolsInChart.map((r, i) => {
                    const rs = r.school;
                    const val = rs[metric.field];
                    if (val == null) return (
                      <div key={rs.urn || i} className="simf-bar-row">
                        <div className="simf-bar-label">{truncName(rs.name, 30)}</div>
                        <div className="simf-bar-track"><span className="simf-bar-na">N/A</span></div>
                      </div>
                    );
                    const pct = ((val - mn) / range) * 100;
                    const isTarget = r.isTarget;
                    let barColor = isTarget ? '#1d5a9e' : '#64748b';
                    if (isP8) barColor = isTarget ? '#1d5a9e' : val >= 0 ? '#0d7a42' : '#cc3333';
                    else if (!isTarget) {
                      const tv = s[metric.field];
                      if (tv != null) barColor = val > tv + 2 ? '#0d7a42' : val < tv - 2 ? '#cc3333' : '#64748b';
                    }

                    return (
                      <div key={rs.urn || i}
                        className={`simf-bar-row ${isTarget ? 'simf-bar-target' : 'simf-bar-hover'}`}
                        onMouseEnter={e => handleBarHover(e, r)}
                        onMouseMove={e => handleBarHover(e, r)}
                        onMouseLeave={() => setHoveredSchool(null)}
                        onClick={() => !isTarget && onSelectSchool(rs)}
                      >
                        <div className="simf-bar-label" title={rs.name}>
                          {isTarget && <span className="simf-star">★</span>}
                          {truncName(rs.name, 30)}
                          {!isTarget && <span className="simf-bar-match">{r.similarity}%</span>}
                        </div>
                        <div className="simf-bar-track">
                          {isP8 && <div className="simf-bar-zero" style={{ left: `${((0 - mn) / range) * 100}%` }} />}
                          <div className="simf-bar-fill" style={{
                            left: isP8 ? `${Math.min(pct, ((0 - mn) / range) * 100)}%` : '0%',
                            width: isP8 ? `${Math.abs(pct - ((0 - mn) / range) * 100)}%` : `${pct}%`,
                            background: barColor,
                            borderRadius: '4px',
                            height: isTarget ? '100%' : '75%',
                            opacity: isTarget ? 1 : 0.85,
                          }} />
                          <span className="simf-bar-val" style={{
                            left: `${Math.min(Math.max(pct + 1, 2), 92)}%`,
                            color: barColor, fontWeight: isTarget ? 800 : 700,
                          }}>
                            {metric.fmt(val)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {hoveredSchool && hoverPos && !hoveredSchool.isTarget && (
            <div className="simf-hover" style={{
              left: Math.min(hoverPos.x + 16, (chartRef.current?.offsetWidth || 800) - 340),
              top: Math.max(hoverPos.y - 10, 10),
              transform: 'translateY(-100%)',
            }}>
              <div className="simf-hover-name">{hoveredSchool.school.name}</div>
              <div className="simf-hover-meta">{hoveredSchool.school.la} · {hoveredSchool.school.town}</div>
              <div className="simf-hover-match">
                <strong>{hoveredSchool.similarity}% match</strong>
                <span className="simf-hover-reason">{similarityExplanation(s, hoveredSchool)}</span>
              </div>
              <div className="simf-hover-grid">
                <HoverStat label="FSM" val={hoveredSchool.school.fsm_pct} target={s.fsm_pct} suffix="%" />
                <HoverStat label="SEN" val={hoveredSchool.school.sen_all_pct} target={s.sen_all_pct} suffix="%" />
                <HoverStat label="EHCP" val={hoveredSchool.school.sen_ehcp_pct} target={s.sen_ehcp_pct} suffix="%" />
                <HoverStat label="EAL" val={hoveredSchool.school.eal_pct} target={s.eal_pct} suffix="%" />
                <HoverStat label="Pupils" val={hoveredSchool.school.pupils} target={s.pupils} />
                <HoverStat label="Stability" val={hoveredSchool.school.stability_pct} target={s.stability_pct} suffix="%" />
              </div>
              {hoveredSchool.school.ofsted && hoveredSchool.school.ofsted !== 'Not inspected' && (
                <span className="simf-hover-ofsted" style={{ background: ofstedCol(hoveredSchool.school.ofsted) }}>{hoveredSchool.school.ofsted}</span>
              )}
              <div className="simf-hover-click">Click to view full profile →</div>
            </div>
          )}
        </div>

        <div className="simf-table-section">
          <h3 className="simf-section-title">Detailed Comparison</h3>
          <div className="simf-table-wrap">
            <table className="simf-table">
              <thead>
                <tr>
                  <th></th>
                  <th className="simf-th-name">School</th>
                  <th>Match</th>
                  <th>FSM</th>
                  <th>SEN</th>
                  <th>EHCP</th>
                  <th>EAL</th>
                  <th>Pupils</th>
                  {isSec && <><th>A8</th><th>P8</th><th>4+</th></>}
                  {isPri && <><th>RWM</th><th>Read</th><th>Maths</th></>}
                  <th>Ofsted</th>
                </tr>
              </thead>
              <tbody>
                <tr className="simf-table-target">
                  <td>★</td>
                  <td className="simf-td-name">{s.name}</td>
                  <td>—</td>
                  <td>{s.fsm_pct ?? '—'}</td>
                  <td>{s.sen_all_pct ?? '—'}</td>
                  <td>{s.sen_ehcp_pct ?? '—'}</td>
                  <td>{s.eal_pct ?? '—'}</td>
                  <td>{s.pupils?.toLocaleString() ?? '—'}</td>
                  {isSec && <><td>{s.attainment8?.toFixed(1) ?? '—'}</td><td>{s.p8_prev != null ? (s.p8_prev > 0 ? '+' : '') + s.p8_prev.toFixed(2) : '—'}</td><td>{s.basics_94 != null ? s.basics_94 + '%' : '—'}</td></>}
                  {isPri && <><td>{s.ks2_rwm_exp != null ? s.ks2_rwm_exp + '%' : '—'}</td><td>{s.ks2_read_avg?.toFixed(0) ?? '—'}</td><td>{s.ks2_mat_exp != null ? s.ks2_mat_exp + '%' : '—'}</td></>}
                  <td>{s.ofsted && s.ofsted !== 'Not inspected' ? <span className="simf-tbl-ofsted" style={{ background: ofstedCol(s.ofsted) }}>{s.ofsted}</span> : '—'}</td>
                </tr>
                {results.map((r, i) => {
                  const rs = r.school;
                  return (
                    <tr key={rs.urn} className="simf-table-row" onClick={() => onSelectSchool(rs)}>
                      <td className="simf-td-rank">{i + 1}</td>
                      <td className="simf-td-name">{rs.name}</td>
                      <td><span className="simf-tbl-match">{r.similarity}%</span></td>
                      <td>{rs.fsm_pct ?? '—'}</td>
                      <td>{rs.sen_all_pct ?? '—'}</td>
                      <td>{rs.sen_ehcp_pct ?? '—'}</td>
                      <td>{rs.eal_pct ?? '—'}</td>
                      <td>{rs.pupils?.toLocaleString() ?? '—'}</td>
                      {isSec && <>
                        <td style={{ color: colorVs(rs.attainment8, s.attainment8, 3), fontWeight: 700 }}>{rs.attainment8?.toFixed(1) ?? '—'}</td>
                        <td style={{ color: colorVs(rs.p8_prev, s.p8_prev, 0.1), fontWeight: 700 }}>{rs.p8_prev != null ? (rs.p8_prev > 0 ? '+' : '') + rs.p8_prev.toFixed(2) : '—'}</td>
                        <td style={{ color: colorVs(rs.basics_94, s.basics_94, 3), fontWeight: 700 }}>{rs.basics_94 != null ? rs.basics_94 + '%' : '—'}</td>
                      </>}
                      {isPri && <>
                        <td style={{ color: colorVs(rs.ks2_rwm_exp, s.ks2_rwm_exp, 3), fontWeight: 700 }}>{rs.ks2_rwm_exp != null ? rs.ks2_rwm_exp + '%' : '—'}</td>
                        <td style={{ color: colorVs(rs.ks2_read_avg, s.ks2_read_avg, 2), fontWeight: 700 }}>{rs.ks2_read_avg?.toFixed(0) ?? '—'}</td>
                        <td style={{ color: colorVs(rs.ks2_mat_exp, s.ks2_mat_exp, 3), fontWeight: 700 }}>{rs.ks2_mat_exp != null ? rs.ks2_mat_exp + '%' : '—'}</td>
                      </>}
                      <td>{rs.ofsted && rs.ofsted !== 'Not inspected' ? <span className="simf-tbl-ofsted" style={{ background: ofstedCol(rs.ofsted) }}>{rs.ofsted}</span> : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="simf-method">
          <strong>Methodology</strong> · Schools ranked by weighted contextual similarity: FSM (25%), EAL (15%), SEN Support (13%), SEN EHCP (12%), school size (10%), stability (10%), region (15%). Hard filters: same phase and gender. Values normalised to 5th–95th percentile range per phase. Outcomes are shown for comparison only and do not influence rankings.
        </div>
      </div>
    </div>
  );
};

function truncName(name, len) { return name.length > len ? name.slice(0, len - 1) + '…' : name; }
function ofstedCol(o) { return { Outstanding: '#0d7a42', Good: '#1d5a9e', 'Requires improvement': '#e8920e', Inadequate: '#cc3333' }[o] || '#94a3b8'; }
function colorVs(val, target, threshold) {
  if (val == null || target == null) return '#334155';
  return val > target + threshold ? '#0d7a42' : val < target - threshold ? '#cc3333' : '#334155';
}

const CtxTag = ({ label, value }) => (
  <div className="simf-ctx-tag"><span className="simf-ctx-k">{label}</span> <span className="simf-ctx-v">{value}</span></div>
);

const HoverStat = ({ label, val, target, suffix = '' }) => {
  if (val == null) return null;
  const diff = target != null ? val - target : null;
  const close = diff != null && Math.abs(diff) < (suffix === '%' ? 5 : target * 0.15);
  return (
    <div className="simf-hs">
      <span className="simf-hs-k">{label}</span>
      <span className="simf-hs-v">{typeof val === 'number' ? (val % 1 === 0 ? val : val.toFixed(1)) : val}{suffix}</span>
      {close && <span className="simf-hs-eq">≈</span>}
    </div>
  );
};

export default SimilarSchoolsPanel;
