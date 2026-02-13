import React from 'react';
import './ComparisonTray.css';

const ComparisonTray = ({ schools, onRemove, onCompare }) => {
  if (!schools || schools.length === 0) return null;

  return (
    <div className="comparison-tray">
      <div className="ct-inner">
        <div className="ct-schools">
          {schools.map((s, i) => (
            <div key={s.urn} className="ct-school" style={{ animationDelay: `${i * 0.05}s` }}>
              <span className="ct-name">{s.name}</span>
              <button className="ct-remove" onClick={() => onRemove(s.urn)}>✕</button>
            </div>
          ))}
        </div>
        <button
          className="ct-compare-btn"
          onClick={onCompare}
          disabled={schools.length < 2}
        >
          Compare {schools.length} school{schools.length !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  );
};

export default ComparisonTray;
