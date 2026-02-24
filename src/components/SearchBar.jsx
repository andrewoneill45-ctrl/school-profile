import React, { useState, useRef, useEffect, useMemo } from 'react';
import { parseSearchQuery } from '../utils/searchParser';
import { aiParseSearch, hasApiKey } from '../utils/ai';
import './SearchBar.css';

const QUICK_FILTERS = [
  { label: 'Outstanding secondaries', q: 'outstanding secondary schools' },
  { label: 'Catholic primaries', q: 'catholic primary schools' },
  { label: 'Grammar schools', q: 'grammar schools' },
  { label: 'Harris academies', q: 'harris trust schools' },
  { label: 'High FSM secondaries', q: 'secondary schools with fsm above 50' },
  { label: 'Positive Progress 8', q: 'secondaries with positive progress 8' },
  { label: 'Struggling schools NE', q: 'underperforming schools in the north east' },
  { label: 'Outstanding + Good London', q: 'good or outstanding schools in london' },
];

const SearchBar = ({ schools, query, onQueryChange, onSearch, onAiSearch, resultCount, activeFilters, onClearFilters }) => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(query || '');
  const [suggestions, setSuggestions] = useState([]);
  const [selIdx, setSelIdx] = useState(-1);
  const [aiParsing, setAiParsing] = useState(false);
  const [aiExplanation, setAiExplanation] = useState('');
  const inputRef = useRef(null);
  const aiEnabled = hasApiKey();

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
    data.names.filter(n => n.toLowerCase().includes(q)).slice(0, 3)
      .forEach(n => r.push({ label: n, q: n, type: 'School' }));
    data.las.filter(n => n.toLowerCase().includes(q)).slice(0, 2)
      .forEach(n => r.push({ label: n, q: n, type: 'LA' }));
    data.towns.filter(n => n.toLowerCase().includes(q) && !data.las.some(la => la.toLowerCase() === n.toLowerCase())).slice(0, 2)
      .forEach(n => r.push({ label: n, q: n, type: 'Town' }));
    data.trusts.filter(n => n.toLowerCase().includes(q)).slice(0, 2)
      .forEach(n => r.push({ label: n, q: n, type: 'Trust' }));
    setSuggestions(r.slice(0, 8));
    setSelIdx(-1);
  }, [input, open, data]);

  const doSearch = async (searchQuery) => {
    const sq = searchQuery || input;
    if (!sq.trim()) return;
    setOpen(false);
    setSuggestions([]);
    setAiExplanation('');

    // Try AI parsing first, fall back to local
    if (aiEnabled && sq.length > 3 && onAiSearch) {
      setAiParsing(true);
      try {
        const filters = await aiParseSearch(sq, data.las, data.trusts);
        if (filters && Object.keys(filters).length > 0) {
          setAiExplanation('✦ AI understood: ' + describeAiFilters(filters));
          onAiSearch(sq, filters);
          setAiParsing(false);
          return;
        }
      } catch (err) {
        console.warn('AI parse failed, falling back to local:', err);
      }
      setAiParsing(false);
    }

    // Fallback: local parser
    onSearch(sq.trim());
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

  const handleOpen = () => { setInput(query || ''); setOpen(true); };

  const handleClear = () => {
    setInput(''); onQueryChange(''); onClearFilters();
    setOpen(false); setAiExplanation('');
  };

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
    if (activeFilters.maxAttainment8) c.push('A8 ≤ ' + activeFilters.maxAttainment8);
    if (activeFilters.minProgress8) c.push('P8 ≥ ' + activeFilters.minProgress8);
    if (activeFilters.maxProgress8) c.push('P8 ≤ ' + activeFilters.maxProgress8);
    if (activeFilters.minFSM) c.push('FSM ≥ ' + activeFilters.minFSM + '%');
    if (activeFilters.maxFSM) c.push('FSM ≤ ' + activeFilters.maxFSM + '%');
    if (activeFilters.fuzzyQuery) c.push('"' + activeFilters.fuzzyQuery + '"');
    if (activeFilters.nameQuery) c.push(activeFilters.nameQuery);
    return c;
  }, [activeFilters]);

  return (
    <>
      {/* Compact trigger button */}
      <button className="srch-btn" onClick={handleOpen}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <span className="srch-btn-text">
          {aiParsing ? '✦ Thinking…' : activeFilters ? chips.join(' · ') || 'Search' : 'Search schools…'}
        </span>
        {resultCount != null && <span className="srch-btn-count">{resultCount.toLocaleString()}</span>}
        {aiEnabled && <span className="srch-btn-ai">✦ AI</span>}
      </button>

      {/* Active filter chips + AI explanation */}
      {(chips.length > 0 || aiExplanation) && (
        <div className="srch-chips">
          {chips.map((c, i) => <span key={i} className="srch-chip">{c}</span>)}
          {aiExplanation && <span className="srch-chip srch-chip-ai">{aiExplanation}</span>}
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
                placeholder={aiEnabled ? "Ask anything — e.g. 'Outstanding Catholic secondaries in London'" : "Search by name, place, trust, or describe what you're looking for…"}
                autoComplete="off"
              />
              {input && <button type="button" className="srch-clear" onClick={() => setInput('')}>✕</button>}
              <button type="submit" className="srch-go">
                {aiEnabled && <span className="srch-go-ai">✦</span>} Search
              </button>
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

            {/* Quick filters + examples */}
            {!input && (
              <div className="srch-quick">
                {aiEnabled && (
                  <div className="srch-ai-note">
                    <span className="srch-ai-badge">✦ AI-Powered</span>
                    <span>Search understands natural language. Describe what you're looking for in plain English.</span>
                  </div>
                )}
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
                  <span>"Struggling schools in the north east with high disadvantage"</span>
                  <span>"Catholic primaries near SW1"</span>
                  <span>"Large academies with P8 above 0.5"</span>
                  <span>"Harris trust schools"</span>
                  <span>"Small rural primaries in the south west"</span>
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

function describeAiFilters(f) {
  const parts = [];
  if (f.phase) parts.push(f.phase);
  if (f.ofsted) parts.push(f.ofsted);
  if (f.ofstedMulti) parts.push(f.ofstedMulti.join(' or '));
  if (f.faithQuery && f.faithQuery !== '_any_faith') parts.push(f.faithQuery);
  if (f.typeQuery) parts.push(f.typeQuery);
  if (f.gender) parts.push(f.gender);
  parts.push('schools');
  if (f.locationQuery) parts.push('in ' + f.locationQuery);
  if (f.region) parts.push('in ' + f.region);
  if (f.postcodeQuery) parts.push('near ' + f.postcodeQuery);
  if (f.trustQuery) parts.push('(' + f.trustQuery + ')');
  if (f.minAttainment8) parts.push('A8 ≥ ' + f.minAttainment8);
  if (f.maxAttainment8) parts.push('A8 ≤ ' + f.maxAttainment8);
  if (f.minProgress8) parts.push('P8 ≥ ' + f.minProgress8);
  if (f.minFSM) parts.push('FSM ≥ ' + f.minFSM + '%');
  if (f.maxFSM) parts.push('FSM ≤ ' + f.maxFSM + '%');
  if (f.fuzzyQuery) parts.push('"' + f.fuzzyQuery + '"');
  return parts.join(' ');
}

export default SearchBar;
