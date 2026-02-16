import React, { useState, useRef, useEffect, useMemo } from 'react';
import './SearchBar.css';

const SearchBar = ({ schools, query, onQueryChange, onSearch, resultCount, activeFilters, onClearFilters }) => {
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [selIdx, setSelIdx] = useState(-1);
  const ref = useRef(null);

  const data = useMemo(() => {
    if (!schools?.length) return { names: [], las: [], towns: [] };
    return {
      names: [...new Set(schools.map(s => s.name))].filter(Boolean).slice(0, 600),
      las: [...new Set(schools.map(s => s.la))].filter(Boolean).sort(),
      towns: [...new Set(schools.map(s => s.town))].filter(Boolean).sort(),
    };
  }, [schools]);

  useEffect(() => {
    if (!query || query.length < 2 || !focused) { setSuggestions([]); return; }
    const q = query.toLowerCase();
    const r = [];
    data.las.filter(n => n.toLowerCase().includes(q)).slice(0, 3).forEach(n => r.push({ label: 'Schools in ' + n, q: 'in ' + n, type: 'LA' }));
    data.towns.filter(n => n.toLowerCase().includes(q)).slice(0, 2).forEach(n => r.push({ label: 'Schools in ' + n, q: 'in ' + n, type: 'Town' }));
    data.names.filter(n => n.toLowerCase().includes(q)).slice(0, 3).forEach(n => r.push({ label: n, q: n, type: 'School' }));
    setSuggestions(r.slice(0, 7));
    setSelIdx(-1);
  }, [query, focused, data]);

  const submit = e => { e.preventDefault(); if (selIdx >= 0 && suggestions[selIdx]) onSearch(suggestions[selIdx].q); else if (query.trim()) onSearch(query.trim()); setSuggestions([]); ref.current?.blur(); };
  const keyDown = e => { if (e.key === 'ArrowDown') { e.preventDefault(); setSelIdx(p => Math.min(p + 1, suggestions.length - 1)); } else if (e.key === 'ArrowUp') { e.preventDefault(); setSelIdx(p => Math.max(p - 1, -1)); } else if (e.key === 'Escape') { setSuggestions([]); ref.current?.blur(); } };

  const chips = useMemo(() => {
    if (!activeFilters) return [];
    const c = [];
    if (activeFilters.phase) c.push(activeFilters.phase);
    if (activeFilters.ofsted) c.push(activeFilters.ofsted);
    if (activeFilters.region) c.push(activeFilters.region);
    if (activeFilters.locationQuery) c.push(activeFilters.locationQuery);
    if (activeFilters.postcodeQuery) c.push(activeFilters.postcodeQuery);
    if (activeFilters.minAttainment8) c.push('A8>' + activeFilters.minAttainment8);
    if (activeFilters.minProgress8) c.push('P8>' + activeFilters.minProgress8);
    if (activeFilters.fuzzyQuery) c.push('"' + activeFilters.fuzzyQuery + '"');
    return c;
  }, [activeFilters]);

  return (
    <div className="sb-wrap">
      <form className="sb" onSubmit={submit}>
        <div className={'sb-box ' + (focused ? 'sb-focus' : '')}>
          <svg className="sb-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input ref={ref} className="sb-in" value={query} onChange={e => onQueryChange(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 150)} onKeyDown={keyDown} placeholder="Search schools..." />
          {query && <button type="button" className="sb-x" onClick={() => { onQueryChange(''); onClearFilters(); }}>✕</button>}
        </div>
        {suggestions.length > 0 && focused && (
          <div className="sb-dd">
            {suggestions.map((s, i) => (
              <button key={i} type="button" className={'sb-opt ' + (i === selIdx ? 'sb-sel' : '')} onMouseDown={() => { onSearch(s.q); setSuggestions([]); }}>
                <span className="sb-opt-label">{s.label}</span>
                <span className="sb-opt-type">{s.type}</span>
              </button>
            ))}
          </div>
        )}
      </form>
      {(chips.length > 0 || resultCount != null) && (
        <div className="sb-meta">
          {chips.map((c, i) => <span key={i} className="sb-chip">{c}</span>)}
          {resultCount != null && <span className="sb-count">{resultCount.toLocaleString()} schools</span>}
          {chips.length > 0 && <button className="sb-clear" onClick={onClearFilters}>Clear</button>}
        </div>
      )}
    </div>
  );
};
export default SearchBar;
