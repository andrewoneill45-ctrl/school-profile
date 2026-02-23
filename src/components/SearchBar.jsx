import React, { useState, useRef, useEffect, useMemo } from 'react';
import './SearchBar.css';

const QUICK_FILTERS = [
  { label: 'Outstanding secondaries', q: 'outstanding secondary' },
  { label: 'Catholic primaries', q: 'catholic primary' },
  { label: 'Grammar schools', q: 'grammar schools' },
  { label: 'Harris academies', q: 'harris' },
  { label: 'High FSM secondaries', q: 'secondary fsm above 50' },
  { label: 'Positive Progress 8', q: 'secondary positive progress' },
];

const SearchBar = ({ schools, query, onQueryChange, onSearch, resultCount, activeFilters, onClearFilters }) => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(query || '');
  const [suggestions, setSuggestions] = useState([]);
  const [selIdx, setSelIdx] = useState(-1);
  const inputRef = useRef(null);

  const data = useMemo(() => {
    if (!schools?.length) return { names: [], las: [], towns: [], trusts: [] };
    return {
      names: [...new Set(schools.map(s => s.name))].filter(Boolean).slice(0, 800),
      las: [...new Set(schools.map(s => s.la))].filter(Boolean).sort(),
      towns: [...new Set(schools.map(s => s.town))].filter(Boolean).sort(),
      trusts: [...new Set(schools.map(s => s.trust).filter(Boolean))].sort(),
    };
  }, [schools]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    if (!input || input.length < 2 || !open) { setSuggestions([]); return; }
    const q = input.toLowerCase();
    const r = [];
    // School name matches
    data.names.filter(n => n.toLowerCase().includes(q)).slice(0, 3)
      .forEach(n => r.push({ label: n, q: n, type: 'School' }));
    // LA matches
    data.las.filter(n => n.toLowerCase().includes(q)).slice(0, 2)
      .forEach(n => r.push({ label: n, q: n, type: 'LA' }));
    // Town matches
    data.towns.filter(n => n.toLowerCase().includes(q) && !data.las.some(la => la.toLowerCase() === n.toLowerCase())).slice(0, 2)
      .forEach(n => r.push({ label: n, q: n, type: 'Town' }));
    // Trust matches
    data.trusts.filter(n => n.toLowerCase().includes(q)).slice(0, 2)
      .forEach(n => r.push({ label: n, q: n, type: 'Trust' }));
    setSuggestions(r.slice(0, 8));
    setSelIdx(-1);
  }, [input, open, data]);

  const doSearch = (searchQuery) => {
    const sq = searchQuery || input;
    if (!sq.trim()) return;
    onSearch(sq.trim());
    setOpen(false);
    setSuggestions([]);
  };

  const submit = e => {
    e.preventDefault();
    if (selIdx >= 0 && suggestions[selIdx]) doSearch(suggestions[selIdx].q);
    else doSearch();
  };

  const keyDown = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelIdx(p => Math.min(p + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelIdx(p => Math.max(p - 1, -1)); }
    else if (e.key === 'Escape') { setOpen(false); setSuggestions([]); }
  };

  const handleOpen = () => {
    setInput(query || '');
    setOpen(true);
  };

  const handleClear = () => {
    setInput('');
    onQueryChange('');
    onClearFilters();
    setOpen(false);
  };

  // Chips for active filters
  const chips = useMemo(() => {
    if (!activeFilters) return [];
    const c = [];
    if (activeFilters.phase) c.push(activeFilters.phase);
    if (activeFilters.ofsted) c.push(activeFilters.ofsted);
    if (activeFilters.ofstedMulti) c.push(activeFilters.ofstedMulti.join(' / '));
    if (activeFilters.region) c.push(activeFilters.region);
    if (activeFilters.locationQuery) c.push(activeFilters.locationQuery);
    if (activeFilters.postcodeQuery) c.push(activeFilters.postcodeQuery);
    if (activeFilters.trustQuery) c.push(activeFilters.trustQuery);
    if (activeFilters.typeQuery) c.push(activeFilters.typeQuery);
    if (activeFilters.faithQuery && activeFilters.faithQuery !== '_any_faith') c.push(activeFilters.faithQuery);
    if (activeFilters.gender) c.push(activeFilters.gender);
    if (activeFilters.minAttainment8) c.push('A8 ≥ ' + activeFilters.minAttainment8);
    if (activeFilters.minProgress8) c.push('P8 ≥ ' + activeFilters.minProgress8);
    if (activeFilters.minFSM) c.push('FSM ≥ ' + activeFilters.minFSM + '%');
    if (activeFilters.fuzzyQuery) c.push('"' + activeFilters.fuzzyQuery + '"');
    return c;
  }, [activeFilters]);

  return (
    <>
      {/* Compact trigger button */}
      <button className="srch-btn" onClick={handleOpen}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <span className="srch-btn-text">{activeFilters ? chips.join(' · ') || 'Search' : 'Search schools…'}</span>
        {resultCount != null && <span className="srch-btn-count">{resultCount.toLocaleString()}</span>}
      </button>

      {/* Active filter chips (shown below button) */}
      {chips.length > 0 && (
        <div className="srch-chips">
          {chips.map((c, i) => <span key={i} className="srch-chip">{c}</span>)}
          <button className="srch-chip-clear" onClick={handleClear}>✕ Clear</button>
        </div>
      )}

      {/* Full-screen search overlay */}
      {open && (
        <div className="srch-overlay" onClick={() => setOpen(false)}>
          <div className="srch-panel" onClick={e => e.stopPropagation()}>
            <form onSubmit={submit} className="srch-form">
              <svg className="srch-form-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                ref={inputRef}
                className="srch-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={keyDown}
                placeholder="Search by name, place, trust, or describe what you're looking for…"
                autoComplete="off"
              />
              {input && <button type="button" className="srch-clear" onClick={() => setInput('')}>✕</button>}
              <button type="submit" className="srch-go">Search</button>
            </form>

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="srch-sugg">
                {suggestions.map((s, i) => (
                  <button key={i} type="button"
                    className={'srch-sugg-item ' + (i === selIdx ? 'srch-sugg-sel' : '')}
                    onMouseDown={() => doSearch(s.q)}>
                    <span className="srch-sugg-label">{s.label}</span>
                    <span className="srch-sugg-type">{s.type}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Quick filters */}
            {!input && (
              <div className="srch-quick">
                <div className="srch-quick-title">Quick searches</div>
                <div className="srch-quick-grid">
                  {QUICK_FILTERS.map((qf, i) => (
                    <button key={i} className="srch-quick-btn" onClick={() => doSearch(qf.q)}>
                      {qf.label}
                    </button>
                  ))}
                </div>
                <div className="srch-quick-title" style={{ marginTop: 16 }}>Try things like</div>
                <div className="srch-examples">
                  <span>"Outstanding secondaries in Camden"</span>
                  <span>"Catholic primaries sunderland"</span>
                  <span>"Harris academies"</span>
                  <span>"Secondary fsm above 40 london"</span>
                  <span>"SW1"</span>
                  <span>"Good or outstanding primary north east"</span>
                </div>
              </div>
            )}

            <button className="srch-close" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
    </>
  );
};

export default SearchBar;
