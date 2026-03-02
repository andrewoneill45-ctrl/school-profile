import React, { useMemo, useState, useRef } from 'react';
import './RiseMode.css';

const METRICS = {
  secondary: [
    { x: 'ks4_fsm_pct', y: 'attainment8', xl: 'FSM %', yl: 'Attainment 8', title: 'Disadvantage vs Attainment' },
    { x: 'ks4_fsm_pct', y: 'p8_prev', xl: 'FSM %', yl: 'Progress 8', title: 'Disadvantage vs Progress' },
    { x: 'sen_all_pct', y: 'attainment8', xl: 'SEN %', yl: 'Attainment 8', title: 'SEN vs Attainment' },
    { x: 'eal_pct', y: 'attainment8', xl: 'EAL %', yl: 'Attainment 8', title: 'EAL vs Attainment' },
    { x: '_a8_change', y: 'p8_prev', xl: 'A8 3-Year Change', yl: 'Progress 8 (2024)', title: '★ Dynamic Schools', isDynamic: true },
  ],
  primary: [
    { x: 'ks2_fsm_pct', y: 'ks2_rwm_exp', xl: 'FSM %', yl: 'RWM Expected %', title: 'Disadvantage vs KS2' },
    { x: 'sen_all_pct', y: 'ks2_rwm_exp', xl: 'SEN %', yl: 'RWM Expected %', title: 'SEN vs KS2' },
    { x: 'eal_pct', y: 'ks2_rwm_exp', xl: 'EAL %', yl: 'RWM Expected %', title: 'EAL vs KS2' },
    { x: 'ks2_fsm_pct', y: 'ks2_read_avg', xl: 'FSM %', yl: 'Reading Score', title: 'Disadvantage vs Reading' },
  ],
};

function linearRegression(points) {
  const n = points.length;
  if (n < 3) return null;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  points.forEach(p => { sx += p.x; sy += p.y; sxy += p.x * p.y; sxx += p.x * p.x; });
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 0.001) return null;
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  // R²
  const yMean = sy / n;
  let ssTot = 0, ssRes = 0;
  points.forEach(p => { const pred = slope * p.x + intercept; ssTot += (p.y - yMean) ** 2; ssRes += (p.y - pred) ** 2; });
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  return { slope, intercept, r2 };
}

function residual(school, reg, xKey, yKey) {
  if (!reg || school[xKey] == null || school[yKey] == null) return null;
  const predicted = reg.slope * school[xKey] + reg.intercept;
  return school[yKey] - predicted;
}

const RiseMode = ({ schools, allSchools, onSelectSchool, onClose }) => {
  const [metricIdx, setMetricIdx] = useState(0);
  const [hoveredSchool, setHoveredSchool] = useState(null);
  const [hoverPos, setHoverPos] = useState(null);
  const svgRef = useRef(null);

  const phase = useMemo(() => {
    const sec = schools.filter(s => s.phase === 'Secondary' || s.phase === 'All-through').length;
    const pri = schools.filter(s => s.phase === 'Primary').length;
    return sec >= pri ? 'secondary' : 'primary';
  }, [schools]);

  const metrics = METRICS[phase];
  const m = metrics[metricIdx] || metrics[0];

  const data = useMemo(() => {
    // For Dynamic Schools, compute A8 3-year change from ks4_trend
    let workingSchools = schools;
    if (m.isDynamic) {
      workingSchools = schools.map(s => {
        // Use ks4_trend if available, otherwise a8 vs a8_prev
        if (s.ks4_trend && s.ks4_trend.length >= 2) {
          const validYears = s.ks4_trend.filter(t => t.a8 != null).sort((a, b) => (a.year || 0) - (b.year || 0));
          if (validYears.length >= 2) {
            const first = validYears[0].a8, last = validYears[validYears.length - 1].a8;
            return { ...s, _a8_change: last - first };
          }
        }
        if (s.attainment8 != null && s.a8_prev != null) {
          return { ...s, _a8_change: Math.round((s.attainment8 - s.a8_prev) * 10) / 10 };
        }
        return s;
      });
    }

    const points = workingSchools
      .filter(s => s[m.x] != null && s[m.y] != null)
      .map(s => ({ school: s, x: s[m.x], y: s[m.y] }));

    const reg = linearRegression(points);

    // Calculate residuals and std dev
    if (reg) {
      points.forEach(p => { p.residual = p.y - (reg.slope * p.x + reg.intercept); });
      const resArr = points.map(p => p.residual);
      const resMean = resArr.reduce((a, b) => a + b, 0) / resArr.length;
      const resStd = Math.sqrt(resArr.map(r => (r - resMean) ** 2).reduce((a, b) => a + b, 0) / resArr.length);
      points.forEach(p => { p.zScore = resStd > 0 ? p.residual / resStd : 0; });
    }

    const xVals = points.map(p => p.x), yVals = points.map(p => p.y);
    return {
      points,
      reg,
      xMin: Math.min(...xVals), xMax: Math.max(...xVals),
      yMin: Math.min(...yVals), yMax: Math.max(...yVals),
      overperformers: points.filter(p => p.zScore > 1.2).sort((a, b) => b.zScore - a.zScore),
      underperformers: points.filter(p => p.zScore < -1.2).sort((a, b) => a.zScore - b.zScore),
    };
  }, [schools, m]);

  const W = 700, H = 450, P = 60;
  const scaleX = x => P + ((x - data.xMin) / (data.xMax - data.xMin || 1)) * (W - P * 2);
  const scaleY = y => H - P - ((y - data.yMin) / (data.yMax - data.yMin || 1)) * (H - P * 2);

  const handleMouseMove = (e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width * W;
    const my = (e.clientY - rect.top) / rect.height * H;

    let closest = null, minDist = 20;
    data.points.forEach(p => {
      const dx = scaleX(p.x) - mx, dy = scaleY(p.y) - my;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < minDist) { minDist = d; closest = p; }
    });
    setHoveredSchool(closest);
    if (closest) setHoverPos({ x: e.clientX, y: e.clientY });
  };

  const dotColor = (p) => {
    // Dynamic Schools: colour by quadrant
    if (m.isDynamic) {
      if (p.x > 0 && p.y > 0) return '#0d7a42';  // Rising Stars (improving A8 + positive P8)
      if (p.x <= 0 && p.y > 0) return '#1d5a9e';  // Strong & Steady (stable/declining A8 but positive P8)
      if (p.x > 0 && p.y <= 0) return '#e8920e';  // Improving from Low (improving A8 but negative P8)
      return '#cc3333';                              // Declining (both negative)
    }
    // Default: regression residual
    if (!p.zScore) return '#94a3b8';
    if (p.zScore > 1.2) return '#0d7a42';
    if (p.zScore < -1.2) return '#cc3333';
    return '#94a3b8';
  };

  return (
    <div className="rise-overlay">
      <div className="rise-panel">
        <button className="rise-close" onClick={onClose}>✕ Close</button>
        <h2 className="rise-title">RISE Mode — Contextual Analysis</h2>
        <p className="rise-subtitle">{m.isDynamic
          ? 'Dynamic Schools: plotting 3-year Attainment 8 trajectory against Progress 8. Top-right = rising stars (improving attainment with strong value-added). Bottom-left = schools in decline. Schools need ks4_trend data with 2+ years to appear.'
          : 'Identifying schools performing above or below expectation given their context. Green dots outperform; red dots underperform the regression line by 1+ standard deviations.'
        }</p>

        <div className="rise-metric-tabs">
          {metrics.map((mt, i) => (
            <button key={i} className={`rise-metric-tab ${i === metricIdx ? 'rise-metric-active' : ''}`} onClick={() => setMetricIdx(i)}>
              {mt.title}
            </button>
          ))}
        </div>

        <div className="rise-chart-wrap">
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="rise-svg" onMouseMove={handleMouseMove} onMouseLeave={() => setHoveredSchool(null)}>
            {/* Grid */}
            {[0, 0.25, 0.5, 0.75, 1].map(f => {
              const y = H - P - f * (H - P * 2);
              const yVal = data.yMin + f * (data.yMax - data.yMin);
              return <g key={'gy' + f}>
                <line x1={P} y1={y} x2={W - P} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                <text x={P - 8} y={y + 3} textAnchor="end" fontSize="10" fill="#94a3b8">{yVal.toFixed(m.yl.includes('P8') ? 1 : 0)}</text>
              </g>;
            })}
            {[0, 0.25, 0.5, 0.75, 1].map(f => {
              const x = P + f * (W - P * 2);
              const xVal = data.xMin + f * (data.xMax - data.xMin);
              return <g key={'gx' + f}>
                <line x1={x} y1={P} x2={x} y2={H - P} stroke="#f1f5f9" strokeWidth="1" />
                <text x={x} y={H - P + 18} textAnchor="middle" fontSize="10" fill="#94a3b8">{xVal.toFixed(0)}</text>
              </g>;
            })}

            {/* Zero line for P8-type y-axis */}
            {(m.yl.includes('P8') || m.yl.includes('Progress')) && data.yMin < 0 && data.yMax > 0 && (
              <line x1={P} y1={scaleY(0)} x2={W - P} y2={scaleY(0)} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4,3" />
            )}

            {/* Zero line for x-axis on Dynamic Schools (A8 change = 0) */}
            {m.isDynamic && data.xMin < 0 && data.xMax > 0 && (
              <line x1={scaleX(0)} y1={P} x2={scaleX(0)} y2={H - P} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4,3" />
            )}

            {/* Quadrant labels for Dynamic Schools */}
            {m.isDynamic && (
              <>
                <text x={W - P - 8} y={P + 16} textAnchor="end" fontSize="10" fill="#0d7a42" fontWeight="700" opacity="0.5">Rising Stars</text>
                <text x={P + 8} y={P + 16} textAnchor="start" fontSize="10" fill="#1d5a9e" fontWeight="700" opacity="0.5">Strong &amp; Steady</text>
                <text x={P + 8} y={H - P - 8} textAnchor="start" fontSize="10" fill="#cc3333" fontWeight="700" opacity="0.5">Declining</text>
                <text x={W - P - 8} y={H - P - 8} textAnchor="end" fontSize="10" fill="#e8920e" fontWeight="700" opacity="0.5">Improving from Low</text>
              </>
            )}

            {/* Regression line */}
            {data.reg && (
              <line
                x1={scaleX(data.xMin)} y1={scaleY(data.reg.slope * data.xMin + data.reg.intercept)}
                x2={scaleX(data.xMax)} y2={scaleY(data.reg.slope * data.xMax + data.reg.intercept)}
                stroke="#1d5a9e" strokeWidth="2" strokeDasharray="6,4" opacity="0.6"
              />
            )}

            {/* Dots */}
            {data.points.map((p, i) => (
              <circle key={i}
                cx={scaleX(p.x)} cy={scaleY(p.y)} r={hoveredSchool === p ? 6 : 3.5}
                fill={dotColor(p)} opacity={hoveredSchool === p ? 1 : 0.6}
                style={{ cursor: 'pointer', transition: 'r 80ms' }}
                onClick={() => onSelectSchool && onSelectSchool(p.school)}
              />
            ))}

            {/* Axis labels */}
            <text x={W / 2} y={H - 8} textAnchor="middle" fontSize="12" fill="#64748b" fontWeight="600">{m.xl}</text>
            <text x={16} y={H / 2} textAnchor="middle" fontSize="12" fill="#64748b" fontWeight="600" transform={`rotate(-90, 16, ${H / 2})`}>{m.yl}</text>

            {/* R² badge */}
            {data.reg && (
              <text x={W - P} y={P + 16} textAnchor="end" fontSize="10" fill="#94a3b8">R² = {data.reg.r2.toFixed(3)}</text>
            )}
          </svg>
        </div>

        {/* Hover tooltip */}
        {hoveredSchool && hoverPos && (
          <div className="rise-tooltip" style={{ left: hoverPos.x + 12, top: hoverPos.y - 60 }}>
            <div className="rise-tt-name">{hoveredSchool.school.name}</div>
            <div className="rise-tt-meta">{hoveredSchool.school.la} · {hoveredSchool.school.ofsted || 'Not inspected'}</div>
            <div className="rise-tt-stats">
              <span>{m.xl}: {hoveredSchool.x.toFixed(1)}</span>
              <span>{m.yl}: {hoveredSchool.y.toFixed(1)}</span>
              {hoveredSchool.zScore != null && (
                <span style={{ color: dotColor(hoveredSchool), fontWeight: 700 }}>
                  {hoveredSchool.zScore > 0 ? '+' : ''}{hoveredSchool.zScore.toFixed(2)} σ
                </span>
              )}
            </div>
          </div>
        )}

        {/* Tables */}
        <div className="rise-lists">
          {m.isDynamic ? (<>
            <div className="rise-list">
              <h3 className="rise-list-title rise-list-over">Rising Stars ({data.points.filter(p => p.x > 0 && p.y > 0).length})</h3>
              <p className="rise-list-desc">Improving Attainment 8 trajectory with positive Progress 8 — schools on an upward path</p>
              <div className="rise-list-scroll">
                {data.points.filter(p => p.x > 0 && p.y > 0).sort((a, b) => (b.x + b.y) - (a.x + a.y)).slice(0, 20).map((p, i) => (
                  <button key={i} className="rise-list-item" onClick={() => onSelectSchool && onSelectSchool(p.school)}>
                    <span className="rise-list-rank">{i + 1}</span>
                    <div className="rise-list-info">
                      <span className="rise-list-name">{p.school.name}</span>
                      <span className="rise-list-la">{p.school.la} · {p.school.ofsted || '—'}</span>
                    </div>
                    <div className="rise-list-stats">
                      <span style={{ color: '#0d7a42' }}>A8 {p.x > 0 ? '↑' : '↓'}{Math.abs(p.x).toFixed(1)}</span>
                      <span>P8 {p.y > 0 ? '+' : ''}{p.y.toFixed(2)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="rise-list">
              <h3 className="rise-list-title rise-list-under">Declining ({data.points.filter(p => p.x < 0 && p.y < 0).length})</h3>
              <p className="rise-list-desc">Falling Attainment 8 with negative Progress 8 — schools that may need targeted support</p>
              <div className="rise-list-scroll">
                {data.points.filter(p => p.x < 0 && p.y < 0).sort((a, b) => (a.x + a.y) - (b.x + b.y)).slice(0, 20).map((p, i) => (
                  <button key={i} className="rise-list-item" onClick={() => onSelectSchool && onSelectSchool(p.school)}>
                    <span className="rise-list-rank">{i + 1}</span>
                    <div className="rise-list-info">
                      <span className="rise-list-name">{p.school.name}</span>
                      <span className="rise-list-la">{p.school.la} · {p.school.ofsted || '—'}</span>
                    </div>
                    <div className="rise-list-stats">
                      <span style={{ color: '#cc3333' }}>A8 {p.x > 0 ? '↑' : '↓'}{Math.abs(p.x).toFixed(1)}</span>
                      <span>P8 {p.y.toFixed(2)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>) : (<>
          <div className="rise-list">
            <h3 className="rise-list-title rise-list-over">Overperformers ({data.overperformers.length})</h3>
            <p className="rise-list-desc">Schools achieving significantly better outcomes than predicted by their context</p>
            <div className="rise-list-scroll">
              {data.overperformers.slice(0, 20).map((p, i) => (
                <button key={i} className="rise-list-item" onClick={() => onSelectSchool && onSelectSchool(p.school)}>
                  <span className="rise-list-rank">{i + 1}</span>
                  <div className="rise-list-info">
                    <span className="rise-list-name">{p.school.name}</span>
                    <span className="rise-list-la">{p.school.la} · FSM: {p.school.fsm_pct ?? '—'}% · {p.school.ofsted || '—'}</span>
                  </div>
                  <span className="rise-list-z" style={{ color: '#0d7a42' }}>+{p.zScore.toFixed(2)}σ</span>
                </button>
              ))}
            </div>
          </div>
          <div className="rise-list">
            <h3 className="rise-list-title rise-list-under">Needs Support ({data.underperformers.length})</h3>
            <p className="rise-list-desc">Schools achieving significantly lower outcomes than predicted by their context</p>
            <div className="rise-list-scroll">
              {data.underperformers.slice(0, 20).map((p, i) => (
                <button key={i} className="rise-list-item" onClick={() => onSelectSchool && onSelectSchool(p.school)}>
                  <span className="rise-list-rank">{i + 1}</span>
                  <div className="rise-list-info">
                    <span className="rise-list-name">{p.school.name}</span>
                    <span className="rise-list-la">{p.school.la} · FSM: {p.school.fsm_pct ?? '—'}% · {p.school.ofsted || '—'}</span>
                  </div>
                  <span className="rise-list-z" style={{ color: '#cc3333' }}>{p.zScore.toFixed(2)}σ</span>
                </button>
              ))}
            </div>
          </div>
          </>)}
        </div>

        <div className="rise-method">
          Methodology: Linear regression of {m.yl} against {m.xl} across {data.points.length} schools. Schools highlighted where residual exceeds ±1.2 standard deviations from the regression line. This is a simplified contextual model — it should not be used in isolation for accountability purposes.
        </div>
      </div>
    </div>
  );
};

export default RiseMode;
