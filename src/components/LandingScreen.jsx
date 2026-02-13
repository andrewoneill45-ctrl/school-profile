import React, { useState, useRef, useEffect } from 'react';
import './LandingScreen.css';

const SUGGESTIONS = [
  'Outstanding secondary schools in Darlington',
  'Primary schools near W10',
  'Schools with Attainment 8 above 60',
  'Secondary schools in North East',
  'All schools in Hackney',
  'Good schools with more than 1000 pupils',
];

const LandingScreen = ({ onSearch, onExplore, schoolCount }) => {
  const [query, setQuery] = useState('');
  const [currentSuggestion, setCurrentSuggestion] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSuggestion(prev => (prev + 1) % SUGGESTIONS.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 600);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) onSearch(query.trim());
  };

  const handleSuggestionClick = (s) => {
    setQuery(s);
    onSearch(s);
  };

  return (
    <div className="landing">
      {/* GOV.UK-style top bar */}
      <div className="landing-topbar">
        <div className="landing-topbar-inner">
          <svg className="crown-icon" width="28" height="24" viewBox="0 0 36 32" fill="none">
            <path d="M18 0L22 12L36 8L30 22H6L0 8L14 12L18 0Z" fill="white" opacity="0.9"/>
            <rect x="5" y="24" width="26" height="4" rx="1" fill="white" opacity="0.9"/>
          </svg>
          <span className="topbar-service">Department for Education</span>
        </div>
      </div>

      {/* Blue header band — DfE style */}
      <div className="landing-header">
        <div className="landing-header-inner">
          <span className="landing-phase-tag">Beta</span>
          <span className="landing-phase-text">This is a new service. Help us improve it.</span>
        </div>
      </div>

      {/* Main content */}
      <div className="landing-body">
        <div className="landing-content">
          <h1 className="landing-title">
            Search for schools<br />in England
          </h1>

          <p className="landing-subtitle">
            Find and compare {schoolCount ? schoolCount.toLocaleString() : '25,000+'} schools 
            by name, location, performance data, or Ofsted rating.
          </p>

          {/* Search */}
          <form className="landing-search" onSubmit={handleSubmit}>
            <label className="search-label" htmlFor="school-search">
              Search by school name, town, postcode, or try a natural language query
            </label>
            <div className="search-row">
              <input
                ref={inputRef}
                id="school-search"
                type="text"
                className="search-input"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setIsTyping(true); }}
                onBlur={() => setIsTyping(false)}
                placeholder={isTyping ? '' : SUGGESTIONS[currentSuggestion]}
              />
              <button type="submit" className="search-button" disabled={!query.trim()}>
                Search
              </button>
            </div>
          </form>

          {/* Suggestions */}
          <div className="landing-suggestions">
            <span className="suggestions-label">Example searches:</span>
            <div className="suggestions-list">
              {SUGGESTIONS.slice(0, 4).map((s, i) => (
                <button key={i} className="suggestion-link" onClick={() => handleSuggestionClick(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Quick filters — styled as GOV.UK-like cards */}
          <div className="landing-cards">
            <button className="landing-card" onClick={() => onSearch('primary')}>
              <span className="card-stripe" style={{ background: 'var(--phase-primary)' }} />
              <span className="card-label">Primary schools</span>
              <span className="card-arrow">→</span>
            </button>
            <button className="landing-card" onClick={() => onSearch('secondary')}>
              <span className="card-stripe" style={{ background: 'var(--phase-secondary)' }} />
              <span className="card-label">Secondary schools</span>
              <span className="card-arrow">→</span>
            </button>
            <button className="landing-card" onClick={() => onSearch('outstanding')}>
              <span className="card-stripe" style={{ background: 'var(--ofsted-outstanding)' }} />
              <span className="card-label">Outstanding schools</span>
              <span className="card-arrow">→</span>
            </button>
            <button className="landing-card" onClick={() => onSearch('special')}>
              <span className="card-stripe" style={{ background: 'var(--phase-special)' }} />
              <span className="card-label">Special schools</span>
              <span className="card-arrow">→</span>
            </button>
          </div>

          {/* Explore link */}
          <button className="landing-explore" onClick={onExplore}>
            Or explore all schools on the map
          </button>
        </div>
      </div>
    </div>
  );
};

export default LandingScreen;
