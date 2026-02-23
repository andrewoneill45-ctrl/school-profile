import React, { useState, useRef, useEffect } from 'react';
import './LandingScreen.css';

const SUGGESTIONS = [
  'Outstanding secondary schools in Sunderland',
  'Primary schools near W10',
  'Schools with Attainment 8 above 55',
  'Catholic schools in Manchester',
  'Harris Federation schools',
  'Secondary schools in North East with positive Progress 8',
];

const LandingScreen = ({ onSearch, onExplore, schoolCount }) => {
  const [query, setQuery] = useState('');
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [typing, setTyping] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setPlaceholderIdx(i => (i + 1) % SUGGESTIONS.length), 3200);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 500);
  }, []);

  const submit = (e) => { e.preventDefault(); if (query.trim()) onSearch(query.trim()); };
  const quickSearch = (s) => { setQuery(s); onSearch(s); };

  return (
    <div className="landing">
      <div className="landing-inner">
        <h1 className="landing-h1">School Profiles</h1>
        <p className="landing-subtitle">England</p>

        <p className="landing-p">
          Search {schoolCount ? schoolCount.toLocaleString() : '25,000+'} schools by name, town, postcode, local authority, or ask a question like
          "outstanding secondaries in Darlington with high attainment".
        </p>

        <form className="landing-form" onSubmit={submit}>
          <div className="lf-row">
            <svg className="lf-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              ref={inputRef}
              className="lf-input"
              value={query}
              onChange={e => { setQuery(e.target.value); setTyping(true); }}
              onBlur={() => setTyping(false)}
              placeholder={typing ? '' : SUGGESTIONS[placeholderIdx]}
            />
            {query && <button type="button" className="lf-clear" onClick={() => setQuery('')}>✕</button>}
            <button type="submit" className="lf-submit" disabled={!query.trim()}>Search</button>
          </div>
        </form>

        <div className="landing-tries">
          <span className="tries-label">Try:</span>
          {SUGGESTIONS.slice(0, 4).map((s, i) => (
            <button key={i} className="try-link" onClick={() => quickSearch(s)}>{s}</button>
          ))}
        </div>

        <div className="landing-filters">
          <button className="lf-pill" onClick={() => quickSearch('primary')}>
            <span className="pill-dot" style={{ background: '#2672c0' }}/>Primary
          </button>
          <button className="lf-pill" onClick={() => quickSearch('secondary')}>
            <span className="pill-dot" style={{ background: '#b91c4a' }}/>Secondary
          </button>
          <button className="lf-pill" onClick={() => quickSearch('outstanding')}>
            <span className="pill-dot" style={{ background: '#0d7a42' }}/>Outstanding
          </button>
          <button className="lf-pill" onClick={() => quickSearch('special')}>
            <span className="pill-dot" style={{ background: '#5b3fa0' }}/>Special
          </button>
        </div>

        <button className="landing-map-link" onClick={onExplore}>
          Or explore the full map →
        </button>

        <div className="landing-footer">
          <span>Data: DfE Get Information About Schools · KS4 and KS2 performance tables 2024/25</span>
        </div>
      </div>
    </div>
  );
};

export default LandingScreen;
