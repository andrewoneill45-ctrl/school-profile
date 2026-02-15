import React from 'react';
import './ComparisonTray.css';

const ComparisonTray = ({ schools, onRemove, onCompare, onClear }) => {
  if (!schools?.length) return null;
  return (
    <div className="ct">
      <div className="ct-inner">
        <div className="ct-chips">
          {schools.map(s => (
            <div key={s.urn} className="ct-chip">
              <span className="ct-chip-name">{s.name?.length > 28 ? s.name.slice(0,26)+'…' : s.name}</span>
              <button className="ct-chip-x" onClick={() => onRemove(s.urn)}>✕</button>
            </div>
          ))}
        </div>
        <div className="ct-actions">
          <span className="ct-count">{schools.length} school{schools.length > 1 ? 's' : ''}</span>
          <button className="ct-btn ct-btn-compare" onClick={onCompare} disabled={schools.length < 2}>Compare</button>
          <button className="ct-btn ct-btn-clear" onClick={onClear}>Clear</button>
        </div>
      </div>
    </div>
  );
};
export default ComparisonTray;
