import React from 'react';
import { getOfstedColor, getOfstedLabel, formatNumber, formatScore } from '../utils/dataHelpers';
import './SchoolCard.css';

const SchoolCard = ({ school, position }) => {
  if (!school || !position) return null;

  const ofstedColor = getOfstedColor(school.ofsted);
  const ofstedLabel = getOfstedLabel(school.ofsted);
  const isSecondary = school.phase === 'Secondary' || school.phase === 'All-through';

  return (
    <div
      className="school-card"
      style={{
        left: `${position.x}px`,
        top: `${position.y - 10}px`,
      }}
    >
      <div className="sc-header">
        <div className="sc-title">{school.name}</div>
        <div className="sc-badges">
          <span className="sc-phase">{school.phase}</span>
          <span className="sc-ofsted" style={{ background: ofstedColor }}>{ofstedLabel}</span>
        </div>
      </div>

      <div className="sc-details">
        <div className="sc-detail">
          <span className="sc-label">Location</span>
          <span className="sc-value">{school.town || school.la}, {school.postcode}</span>
        </div>
        {school.pupils && (
          <div className="sc-detail">
            <span className="sc-label">Pupils</span>
            <span className="sc-value">{formatNumber(school.pupils)}</span>
          </div>
        )}
        {isSecondary && school.attainment8 != null && (
          <div className="sc-detail">
            <span className="sc-label">Attainment 8</span>
            <span className="sc-value sc-highlight">{formatScore(school.attainment8)}</span>
          </div>
        )}
        {!isSecondary && school.ks2_rwm_exp != null && (
          <div className="sc-detail">
            <span className="sc-label">KS2 RWM Expected</span>
            <span className="sc-value sc-highlight">{school.ks2_rwm_exp}%</span>
          </div>
        )}
      </div>

      <div className="sc-footer">Click for full profile</div>
    </div>
  );
};

export default SchoolCard;
