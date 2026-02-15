import React from 'react';
import { exportSchoolPDF } from '../utils/pdfReport';
import './ComparePanel.css';

const ComparePanel = ({ schools, allSchools, onRemove, onClose }) => {
  if (!schools.length) return null;
  const isSecondary = schools.some(s => s.phase === 'Secondary' || s.phase === 'All-through');
  const isPrimary = schools.some(s => s.phase === 'Primary');

  const Row = ({ label, values, fmt, highlight }) => (
    <div className="cp-row">
      <div className="cp-row-label">{label}</div>
      {values.map((v, i) => {
        const best = highlight && values.filter(x => x != null).length > 1;
        const max = best ? Math.max(...values.filter(x => x != null)) : null;
        const isBest = best && v === max;
        return <div key={i} className={`cp-row-val ${isBest ? 'cp-best' : ''}`}>{v != null ? (fmt ? fmt(v) : v) : '—'}</div>;
      })}
    </div>
  );

  return (
    <div className="cp-overlay" onClick={onClose}>
      <div className="cp-panel" onClick={e => e.stopPropagation()}>
        <div className="cp-head">
          <h2 className="cp-title">Compare Schools</h2>
          <button className="cp-close" onClick={onClose}>✕</button>
        </div>
        <div className="cp-table">
          <div className="cp-row cp-row-header">
            <div className="cp-row-label" />
            {schools.map(s => (
              <div key={s.urn} className="cp-row-val cp-school-name">
                <span>{s.name}</span>
                <button className="cp-rm" onClick={() => onRemove(s.urn)}>✕</button>
              </div>
            ))}
          </div>
          <Row label="Phase" values={schools.map(s => s.phase)} />
          <Row label="Ofsted" values={schools.map(s => s.ofsted)} />
          <Row label="Pupils" values={schools.map(s => s.pupils)} fmt={v => v.toLocaleString()} />
          <Row label="FSM %" values={schools.map(s => s.fsm_pct)} fmt={v => v + '%'} />
          {isSecondary && <>
            <Row label="Attainment 8" values={schools.map(s => s.attainment8)} fmt={v => v.toFixed(1)} highlight />
            <Row label="Progress 8" values={schools.map(s => s.progress8)} fmt={v => (v > 0 ? '+' : '') + v.toFixed(2)} highlight />
            <Row label="Eng & Maths 4+" values={schools.map(s => s.basics_94)} fmt={v => v + '%'} highlight />
            <Row label="Eng & Maths 5+" values={schools.map(s => s.basics_95)} fmt={v => v + '%'} highlight />
          </>}
          {isPrimary && <>
            <Row label="RWM Expected" values={schools.map(s => s.ks2_rwm_exp)} fmt={v => v + '%'} highlight />
            <Row label="RWM Higher" values={schools.map(s => s.ks2_rwm_high)} fmt={v => v + '%'} highlight />
            <Row label="Reading Avg" values={schools.map(s => s.ks2_read_avg)} fmt={v => v.toFixed(0)} highlight />
            <Row label="Maths Avg" values={schools.map(s => s.ks2_math_avg)} fmt={v => v.toFixed(0)} highlight />
          </>}
        </div>
      </div>
    </div>
  );
};
export default ComparePanel;
