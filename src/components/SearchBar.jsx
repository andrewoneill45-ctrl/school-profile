import React, { useState, useRef, useEffect, useMemo } from 'react';
import './SearchBar.css';

const SearchBar = ({ schools, query, onQueryChange, onSearch, resultCount, activeFilters, onClearFilters }) => {
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Build autocomplete index
  const autocompleteData = useMemo(() => {
    if (!schools || schools.length === 0) return { names: [], las: [], towns: [], trusts: [] };
    const names = [...new Set(schools.map(s => s.name))].filter(Boolean).slice(0, 500);
    const las = [...new Set(schools.map(s => s.la))].filter(Boolean).sort();
    const towns = [...new Set(schools.map(s => s.town))].filter(Boolean).sort();
    const trusts = [...new Set(schools.map(s => s.trust))].filter(Boolean).sort().slice(0, 200);
    return { names, las, towns, trusts };
  }, [schools]);

  // Generate suggestions
  useEffect(() => {
    if (!query || query.length < 2 || !isFocused) {
      setSuggestions([]);
      return;
    }

    const q = query.toLowerCase();
    const results = [];

    // Match school names
    autocompleteData.names
      .filter(n => n.toLowerCase().includes(q))
      .slice(0, 4)
      .forEach(n => results.push({ type: 'school', label: n, icon: '🏫' }));

    // Match LAs
    autocompleteData.las
      .filter(n => n.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach(n => results.push({ type: 'la', label: `Schools in ${n}`, query: `in ${n}`, icon: '📍' }));

    // Match towns
    autocompleteData.towns
      .filter(n => n.toLowerCase().includes(q))
      .slice(0, 2)
      .forEach(n => results.push({ type: 'town', label: `Schools in ${n}`, query: `in ${n}`, icon: '🏘️' }));

    // Match trusts
    autocompleteData.trusts
      .filter(n => n.toLowerCase().includes(q))
      .slice(0, 2)
      .forEach(n => results.push({ type: 'trust', label: n, query: `trust ${n}`, icon: '🔗' }));

    setSuggestions(results.slice(0, 8));
    setSelectedIdx(-1);
  }, [query, isFocused, autocompleteData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedIdx >= 0 && suggestions[selectedIdx]) {
      const s = suggestions[selectedIdx];
      onSearch(s.query || s.label);
    } else if (query.trim()) {
      onSearch(query.trim());
    }
    setSuggestions([]);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Escape') {
      setSuggestions([]);
      inputRef.current?.blur();
    }
  };

  const handleSuggestionClick = (suggestion) => {
    onSearch(suggestion.query || suggestion.label);
    setSuggestions([]);
  };

  // Describe active filters as chips
  const filterChips = useMemo(() => {
    if (!activeFilters) return [];
    const chips = [];
    if (activeFilters.phase) chips.push({ key: 'phase', label: activeFilters.phase });
    if (activeFilters.ofsted) chips.push({ key: 'ofsted', label: activeFilters.ofsted });
    if (activeFilters.region) chips.push({ key: 'region', label: activeFilters.region });
    if (activeFilters.locationQuery) chips.push({ key: 'location', label: `in ${activeFilters.locationQuery}` });
    if (activeFilters.postcodeQuery) chips.push({ key: 'postcode', label: activeFilters.postcodeQuery });
    if (activeFilters.minAttainment8) chips.push({ key: 'a8', label: `A8 > ${activeFilters.minAttainment8}` });
    if (activeFilters.minProgress8) chips.push({ key: 'p8', label: `P8 > ${activeFilters.minProgress8}` });
    return chips;
  }, [activeFilters]);

  return (
    <div className="search-bar-container">
      <form className="search-bar" onSubmit={handleSubmit}>
        <div className={`search-bar-inner ${isFocused ? 'focused' : ''}`}>
          <svg className="sb-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="sb-input"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            onKeyDown={handleKeyDown}
            placeholder="Search schools by name, location, or try a natural language query..."
          />
          {query && (
            <button type="button" className="sb-clear" onClick={() => { onQueryChange(''); onClearFilters(); }}>
              ✕
            </button>
          )}
        </div>

        {/* Autocomplete dropdown */}
        {suggestions.length > 0 && isFocused && (
          <div className="sb-suggestions" ref={suggestionsRef}>
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                className={`sb-suggestion ${i === selectedIdx ? 'selected' : ''}`}
                onMouseDown={() => handleSuggestionClick(s)}
              >
                <span className="sb-suggestion-icon">{s.icon}</span>
                <span className="sb-suggestion-label">{s.label}</span>
                <span className="sb-suggestion-type">{s.type}</span>
              </button>
            ))}
          </div>
        )}
      </form>

      {/* Filter chips and result count */}
      {(filterChips.length > 0 || resultCount != null) && (
        <div className="search-meta">
          {filterChips.map(chip => (
            <span key={chip.key} className="filter-chip">
              {chip.label}
            </span>
          ))}
          {resultCount != null && (
            <span className="result-count">
              {resultCount.toLocaleString()} school{resultCount !== 1 ? 's' : ''} found
            </span>
          )}
          {filterChips.length > 0 && (
            <button className="clear-all" onClick={onClearFilters}>
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
