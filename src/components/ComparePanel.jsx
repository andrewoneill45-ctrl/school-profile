import React from 'react';
import { getOfstedColor, getOfstedLabel, formatNumber, formatScore } from '../utils/dataHelpers';
import './ComparePanel.css';

const ComparePanel = ({ schools, onRemove, onClose }) => {
  if (!schools || schools.length === 0) return null;

  const isSecondary = schools.some(s => s.phase === 'Secondary' || s.phase === 'All-through');
  const isPrimary = schools.some(s => s.phase === 'Primary');

  const metrics = [];

  if (isSecondary) {
    metrics.push(
      { key: 'attainment8', label: 'Attainment 8', format: v => formatScore(v), highlight: true },
      { key: 'progress8', label: 'Progress 8', format: v => v != null ? (v > 0 ? '+' : '') + formatScore(v, 2) : '—' },
      { key: 'basics_94', label: 'Eng & Maths 4+', format: v => v != null ? `${v}%` : '—' },
      { key: 'basics_95', label: 'Eng & Maths 5+', format: v => v != null ? `${v}%` : '—' },
    );
  }

  if (isPrimary) {
    metrics.push(
      { key: 'ks2_rwm_exp', label: 'KS2 RWM Expected', format: v => v != null ? `${v}%` : '—', highlight: true },
      { key: 'ks2_rwm_high', label: 'KS2 RWM Higher', format: v => v != null ? `${v}%` : '—' },
      { key: 'ks2_read_avg', label: 'Reading Avg', format: v => formatScore(v) },
      { key: 'ks2_math_avg', label: 'Maths Avg', format: v => formatScore(v) },
    );
  }

  metrics.push(
    { key: 'pupils', label: 'Pupils', format: v => formatNumber(v) },
    { key: 'ofsted', label: 'Ofsted', format: v => getOfstedLabel(v), isOfsted: true },
  );

  // Find the best value for each metric for highlighting
  const getBestIdx = (key) => {
    const values = schools.map(s => {
      const v = s[key];
      if (v == null || v === '—') return null;
      if (typeof v === 'string') return null;
      return v;
    });
    if (values.every(v => v == null)) return -1;
    const max = Math.max(...values.filter(v => v != null));
    return values.indexOf(max);
  };

  return (
    <div className="compare-overlay" onClick={onClose}>
      <div className="compare-panel" onClick={(e) => e.stopPropagation()}>
        <div className="cp-header">
          <h2 className="cp-title">Compare Schools</h2>
          <button className="cp-close" onClick={onClose}>✕</button>
        </div>

        <div className="cp-body">
          <div className="cp-table">
            {/* School names row */}
            <div className="cp-row cp-row-header">
              <div className="cp-label" />
              {schools.map((s, i) => (
                <div key={s.urn} className="cp-cell cp-school-header" style={{ animationDelay: `${i * 0.05}s` }}>
                  <button className="cp-remove" onClick={() => onRemove(s.urn)} title="Remove">✕</button>
                  <div className="cp-school-name">{s.name}</div>
                  <div className="cp-school-meta">
                    <span className="cp-phase-dot" style={{ background: s.phase === 'Primary' ? 'var(--phase-primary)' : 'var(--phase-secondary)' }} />
                    {s.phase} · {s.la}
                  </div>
                </div>
              ))}
            </div>

            {/* Metric rows */}
            {metrics.map((metric) => {
              const bestIdx = metric.highlight ? getBestIdx(metric.key) : -1;
              return (
                <div key={metric.key} className="cp-row">
                  <div className="cp-label">{metric.label}</div>
                  {schools.map((s, i) => {
                    const val = metric.format(s[metric.key]);
                    const isBest = i === bestIdx;
                    return (
                      <div
                        key={s.urn}
                        className={`cp-cell ${isBest ? 'cp-best' : ''} ${metric.isOfsted ? 'cp-ofsted-cell' : ''}`}
                      >
                        {metric.isOfsted ? (
                          <span className="cp-ofsted-badge" style={{ background: getOfstedColor(s.ofsted) }}>
                            {val}
                          </span>
                        ) : (
                          <span className={`cp-value ${isBest ? 'cp-value-best' : ''}`}>{val}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComparePanel;
