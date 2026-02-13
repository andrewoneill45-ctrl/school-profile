import React, { useMemo } from 'react';
import { getOfstedColor, getOfstedLabel, formatNumber, formatPercent, formatScore, contextualiseMetric } from '../utils/dataHelpers';
import { exportSchoolPDF } from '../utils/pdfReport';
import './SchoolProfile.css';

const SchoolProfile = ({ school, allSchools, onClose, onCompare }) => {
  if (!school) return null;

  const ofstedColor = getOfstedColor(school.ofsted);
  const ofstedLabel = getOfstedLabel(school.ofsted);
  const isSecondary = school.phase === 'Secondary' || school.phase === 'All-through';
  const isPrimary = school.phase === 'Primary';

  // Contextualise metrics against national data
  const context = useMemo(() => {
    if (!allSchools) return {};

    // Filter to same phase for fair comparison
    const samePhase = allSchools.filter(s => s.phase === school.phase);

    return {
      attainment8: school.attainment8 != null
        ? contextualiseMetric(school.attainment8, samePhase.map(s => s.attainment8).filter(v => v != null), 'Attainment 8')
        : null,
      progress8: school.progress8 != null
        ? contextualiseMetric(school.progress8, samePhase.map(s => s.progress8).filter(v => v != null), 'Progress 8')
        : null,
      basics4: school.basics_94 != null
        ? contextualiseMetric(school.basics_94, samePhase.map(s => s.basics_94).filter(v => v != null), '4+ Basics')
        : null,
      basics5: school.basics_95 != null
        ? contextualiseMetric(school.basics_95, samePhase.map(s => s.basics_95).filter(v => v != null), '5+ Basics')
        : null,
      ks2rwm: school.ks2_rwm_exp != null
        ? contextualiseMetric(school.ks2_rwm_exp, samePhase.map(s => s.ks2_rwm_exp).filter(v => v != null), 'KS2 RWM')
        : null,
      pupils: school.pupils != null
        ? contextualiseMetric(school.pupils, samePhase.map(s => s.pupils).filter(v => v != null), 'Pupils')
        : null,
    };
  }, [school, allSchools]);

  // Calculate LA average for comparison
  const laAverage = useMemo(() => {
    if (!allSchools || !school.la) return {};
    const laSchools = allSchools.filter(s => s.la === school.la && s.phase === school.phase);
    const a8Vals = laSchools.map(s => s.attainment8).filter(v => v != null);
    const ks2Vals = laSchools.map(s => s.ks2_rwm_exp).filter(v => v != null);
    return {
      attainment8: a8Vals.length ? (a8Vals.reduce((a, b) => a + b, 0) / a8Vals.length) : null,
      ks2_rwm_exp: ks2Vals.length ? (ks2Vals.reduce((a, b) => a + b, 0) / ks2Vals.length) : null,
      schoolCount: laSchools.length,
    };
  }, [school, allSchools]);

  return (
    <div className="profile-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
        <button className="profile-close" onClick={onClose} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* ─── Header ─────────────────────────── */}
        <div className="profile-head">
          <div className="ph-content">
            <div className="ph-badges">
              <span className="ph-phase">{school.phase}</span>
              <span className="ph-type">{school.type}</span>
            </div>
            <h1 className="ph-name">{school.name}</h1>
            <p className="ph-location">
              {school.town && `${school.town}, `}{school.la} · {school.postcode}
              {school.region && ` · ${school.region}`}
            </p>
          </div>
          <div className="ph-ofsted">
            <div className="ph-ofsted-badge" style={{ background: ofstedColor }}>
              {ofstedLabel}
            </div>
            <span className="ph-ofsted-label">Ofsted</span>
          </div>
        </div>

        <div className="profile-body">
          {/* ─── Key facts ────────────────────── */}
          <section className="profile-section">
            <h2 className="ps-title">At a glance</h2>
            <div className="fact-grid">
              <div className="fact-card">
                <span className="fc-value">{formatNumber(school.pupils)}</span>
                <span className="fc-label">Pupils on roll</span>
                {context.pupils && context.pupils.percentile != null && (
                  <span className="fc-context" style={{ color: context.pupils.color }}>
                    {context.pupils.label} for {school.phase?.toLowerCase()} schools
                  </span>
                )}
              </div>
              {school.capacity && (
                <div className="fact-card">
                  <span className="fc-value">{formatNumber(school.capacity)}</span>
                  <span className="fc-label">Capacity</span>
                  {school.pupils && school.capacity && (
                    <span className="fc-context">
                      {Math.round((school.pupils / school.capacity) * 100)}% full
                    </span>
                  )}
                </div>
              )}
              {school.fsm_pct != null && (
                <div className="fact-card">
                  <span className="fc-value">{school.fsm_pct}%</span>
                  <span className="fc-label">Free school meals</span>
                </div>
              )}
              <div className="fact-card">
                <span className="fc-value">{school.gender || '—'}</span>
                <span className="fc-label">Gender</span>
              </div>
              {school.religiousCharacter && school.religiousCharacter !== 'None' && school.religiousCharacter !== 'Does not apply' && (
                <div className="fact-card">
                  <span className="fc-value fc-value-sm">{school.religiousCharacter}</span>
                  <span className="fc-label">Faith</span>
                </div>
              )}
              {school.trust && (
                <div className="fact-card fact-card-wide">
                  <span className="fc-value fc-value-sm">{school.trust}</span>
                  <span className="fc-label">Academy Trust</span>
                </div>
              )}
            </div>
          </section>

          {/* ─── Performance ──────────────────── */}
          {isSecondary && (school.attainment8 != null || school.basics_94 != null) && (
            <section className="profile-section">
              <h2 className="ps-title">Performance — Key Stage 4</h2>
              <div className="metric-grid">
                {school.attainment8 != null && (
                  <MetricCard
                    label="Attainment 8"
                    value={formatScore(school.attainment8)}
                    max={80}
                    current={school.attainment8}
                    context={context.attainment8}
                    laAvg={laAverage.attainment8}
                    laName={school.la}
                    color="#0c7c8a"
                  />
                )}
                {school.basics_94 != null && (
                  <MetricCard
                    label="English & Maths 4+"
                    value={`${school.basics_94}%`}
                    max={100}
                    current={school.basics_94}
                    context={context.basics4}
                    color="#1a8a5c"
                    suffix="%"
                  />
                )}
                {school.basics_95 != null && (
                  <MetricCard
                    label="English & Maths 5+"
                    value={`${school.basics_95}%`}
                    max={100}
                    current={school.basics_95}
                    context={context.basics5}
                    color="#c53030"
                    suffix="%"
                  />
                )}
                {school.progress8 != null && (
                  <div className="metric-card">
                    <div className="mc-header">
                      <span className="mc-label">Progress 8</span>
                      {context.progress8 && (
                        <span className="mc-context" style={{ color: context.progress8.color }}>
                          {context.progress8.label}
                        </span>
                      )}
                    </div>
                    <div className="mc-p8-value" style={{ color: school.progress8 >= 0 ? 'var(--ofsted-outstanding)' : 'var(--ofsted-inadequate)' }}>
                      {school.progress8 > 0 ? '+' : ''}{formatScore(school.progress8, 2)}
                    </div>
                    <div className="mc-p8-bar">
                      <div className="mc-p8-track">
                        <div className="mc-p8-zero" />
                        <div
                          className="mc-p8-fill"
                          style={{
                            left: school.progress8 >= 0 ? '50%' : `${50 + (school.progress8 / 2) * 50}%`,
                            width: `${Math.abs(school.progress8 / 2) * 50}%`,
                            background: school.progress8 >= 0 ? 'var(--ofsted-outstanding)' : 'var(--ofsted-inadequate)',
                          }}
                        />
                      </div>
                      <div className="mc-p8-labels">
                        <span>-1.0</span>
                        <span>0</span>
                        <span>+1.0</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {laAverage.attainment8 != null && (
                <div className="la-comparison">
                  <span className="la-comp-label">
                    {school.la} average ({laAverage.schoolCount} {school.phase?.toLowerCase()} schools):
                  </span>
                  <span className="la-comp-value">A8 = {formatScore(laAverage.attainment8)}</span>
                </div>
              )}
            </section>
          )}

          {isPrimary && (school.ks2_rwm_exp != null || school.ks2_read_avg != null) && (
            <section className="profile-section">
              <h2 className="ps-title">Performance — Key Stage 2</h2>
              <div className="metric-grid">
                {school.ks2_rwm_exp != null && (
                  <MetricCard
                    label="RWM Expected Standard"
                    value={`${school.ks2_rwm_exp}%`}
                    max={100}
                    current={school.ks2_rwm_exp}
                    context={context.ks2rwm}
                    laAvg={laAverage.ks2_rwm_exp}
                    laName={school.la}
                    color="#1d70b8"
                    suffix="%"
                  />
                )}
                {school.ks2_rwm_high != null && (
                  <MetricCard
                    label="RWM Higher Standard"
                    value={`${school.ks2_rwm_high}%`}
                    max={100}
                    current={school.ks2_rwm_high}
                    color="#e8a817"
                    suffix="%"
                  />
                )}
                {school.ks2_read_avg != null && (
                  <MetricCard
                    label="Reading Average"
                    value={formatScore(school.ks2_read_avg)}
                    max={120}
                    min={80}
                    current={school.ks2_read_avg}
                    color="#6c5ce7"
                  />
                )}
                {school.ks2_math_avg != null && (
                  <MetricCard
                    label="Maths Average"
                    value={formatScore(school.ks2_math_avg)}
                    max={120}
                    min={80}
                    current={school.ks2_math_avg}
                    color="#e8a817"
                  />
                )}
              </div>
            </section>
          )}

          {/* ─── Details grid ─────────────────── */}
          <section className="profile-section">
            <h2 className="ps-title">Details</h2>
            <div className="detail-grid">
              <DetailRow label="URN" value={school.urn} />
              <DetailRow label="Type" value={school.type} />
              <DetailRow label="Local authority" value={school.la} />
              <DetailRow label="Region" value={school.region} />
              <DetailRow label="Gender" value={school.gender} />
              <DetailRow label="Religious character" value={school.religiousCharacter} />
              {school.trust && <DetailRow label="Academy trust" value={school.trust} />}
            </div>
          </section>
        </div>

        {/* ─── Actions ────────────────────────── */}
        <div className="profile-actions">
          <button className="pa-btn pa-pdf" onClick={() => exportSchoolPDF(school, allSchools)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <polyline points="9 15 12 18 15 15" />
            </svg>
            Export PDF report
          </button>
          {onCompare && (
            <button className="pa-btn pa-compare" onClick={() => onCompare(school)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              Add to comparison
            </button>
          )}
          <button className="pa-btn pa-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Metric Card sub-component ──────────────────────────────
const MetricCard = ({ label, value, max, min = 0, current, context, laAvg, laName, color, suffix }) => {
  const range = max - min;
  const pct = Math.max(0, Math.min(100, ((current - min) / range) * 100));
  const laAvgPct = laAvg != null ? Math.max(0, Math.min(100, ((laAvg - min) / range) * 100)) : null;

  return (
    <div className="metric-card">
      <div className="mc-header">
        <span className="mc-label">{label}</span>
        {context && context.percentile != null && (
          <span className="mc-context" style={{ color: context.color }}>
            {context.label}
          </span>
        )}
      </div>
      <div className="mc-value" style={{ color }}>{value}</div>
      <div className="mc-bar">
        <div className="mc-track">
          <div
            className="mc-fill"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${color}44, ${color})`,
              animation: 'barFill 0.8s var(--ease-out) both',
            }}
          />
          {laAvgPct != null && (
            <div
              className="mc-la-marker"
              style={{ left: `${laAvgPct}%` }}
              title={`${laName} average: ${formatScore(laAvg)}`}
            >
              <div className="mc-la-line" />
              <div className="mc-la-tooltip">{laName} avg</div>
            </div>
          )}
        </div>
        <div className="mc-scale">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>
    </div>
  );
};

// ─── Detail Row sub-component ──────────────────────────────
const DetailRow = ({ label, value }) => {
  if (!value || value === 'null' || value === 'Not recorded') return null;
  return (
    <div className="detail-row">
      <span className="dr-label">{label}</span>
      <span className="dr-value">{value}</span>
    </div>
  );
};

export default SchoolProfile;
