import React, { useState, useCallback, useMemo, useRef } from 'react';
import Map, { Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import LandingScreen from './components/LandingScreen';
import SearchBar from './components/SearchBar';
import SchoolProfile, { decileColor } from './components/SchoolProfile';
import ComparisonTray from './components/ComparisonTray';
import ComparePanel from './components/ComparePanel';
import { parseSearchQuery, applyFilters } from './utils/searchParser';
import schoolsRaw from './schools.json';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.your_token_here';
const MAP_STYLES = { light: 'mapbox://styles/mapbox/light-v11', dark: 'mapbox://styles/mapbox/dark-v11', satellite: 'mapbox://styles/mapbox/satellite-streets-v12' };
const PHASE_COLORS = { Primary: '#2672c0', Secondary: '#b91c4a', Special: '#5b3fa0', Nursery: '#64748b', 'All-through': '#0d7a42', '16 plus': '#64748b' };

const schoolsData = schoolsRaw.filter(s => {
  const t = (s.type || '').toLowerCase();
  return !t.includes('independent') && !t.includes('non-maintained special');
});
const schoolsByUrn = {};
schoolsData.forEach(s => { schoolsByUrn[String(s.urn)] = s; });

// Precompute decile arrays for fast lookup
function buildDecileArrays(schools) {
  const byPhase = {};
  schools.forEach(s => {
    const p = s.phase || 'Other';
    if (!byPhase[p]) byPhase[p] = {};
    const bp = byPhase[p];
    ['attainment8', 'p8_prev', 'basics_94', 'basics_95', 'fsm_pct', 'pupils',
     'ks2_rwm_exp', 'ks2_rwm_high', 'ks2_read_avg', 'ks2_writ_exp', 'ks2_mat_exp'].forEach(k => {
      if (s[k] != null) { if (!bp[k]) bp[k] = []; bp[k].push(s[k]); }
    });
  });
  return byPhase;
}
const decileArrays = buildDecileArrays(schoolsData);

function quickDecile(val, phase, key) {
  if (val == null) return null;
  const arr = decileArrays[phase]?.[key];
  if (!arr || !arr.length) return null;
  const rank = arr.filter(v => v < val).length / arr.length;
  return Math.min(10, Math.max(1, Math.ceil(rank * 10)));
}

/* ─── Hover Card ───────────────────────────────── */
const HoverCard = ({ school, onViewProfile }) => {
  const s = school;
  const isSec = s.phase === 'Secondary' || s.phase === 'All-through';
  const isPri = s.phase === 'Primary';
  const oC = { Outstanding: '#0d7a42', Good: '#1d5a9e', 'Requires improvement': '#e8920e', Inadequate: '#cc3333' };

  const truncStyle = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

  return (
    <div style={{ fontFamily: "'Source Sans 3', sans-serif" }}>
      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', lineHeight: 1.25, marginBottom: 4, ...truncStyle }}>{s.name}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '1px 8px', borderRadius: 99, background: PHASE_COLORS[s.phase] || '#64748b', color: 'white' }}>{s.phase}</span>
        {s.ofsted && s.ofsted !== 'Not inspected' && (
          <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '1px 8px', borderRadius: 99, background: oC[s.ofsted] || '#94a3b8', color: 'white' }}>{s.ofsted}</span>
        )}
      </div>
      <div style={{ fontSize: '0.75rem', color: '#475569', lineHeight: 1.5 }}>
        {s.la && <div style={truncStyle}>{s.la}{s.town && s.town !== s.la ? ` · ${s.town}` : ''}</div>}
        <div style={{ color: '#94a3b8', fontSize: '0.7rem', ...truncStyle }}>{s.type}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '3px 12px', marginTop: 7, paddingTop: 7, borderTop: '1px solid #e2e8f0' }}>
        {s.pupils != null && <HM label="Pupils" value={s.pupils.toLocaleString()} />}
        {s.fsm_pct != null && <HM label="FSM" value={s.fsm_pct + '%'} />}
      </div>

      {isSec && (s.attainment8 != null || s.p8_prev != null) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px 12px', marginTop: 6, paddingTop: 6, borderTop: '1px solid #e2e8f0' }}>
          {s.attainment8 != null && <HM label="Attainment 8" value={s.attainment8.toFixed(1)} color={decileColor(quickDecile(s.attainment8, s.phase, 'attainment8'))} big />}
          {s.p8_prev != null && <HM label="P8 (2024)" value={(s.p8_prev > 0 ? '+' : '') + s.p8_prev.toFixed(2)} color={decileColor(quickDecile(s.p8_prev, s.phase, 'p8_prev'))} big />}
          {s.basics_94 != null && <HM label="4+ Eng & Ma" value={s.basics_94 + '%'} color={decileColor(quickDecile(s.basics_94, s.phase, 'basics_94'))} />}
          {s.basics_95 != null && <HM label="5+ Eng & Ma" value={s.basics_95 + '%'} color={decileColor(quickDecile(s.basics_95, s.phase, 'basics_95'))} />}
        </div>
      )}

      {isPri && (s.ks2_rwm_exp != null || s.ks2_read_avg != null) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px 12px', marginTop: 6, paddingTop: 6, borderTop: '1px solid #e2e8f0' }}>
          {s.ks2_rwm_exp != null && <HM label="RWM Expected" value={s.ks2_rwm_exp + '%'} color={decileColor(quickDecile(s.ks2_rwm_exp, s.phase, 'ks2_rwm_exp'))} big />}
          {s.ks2_rwm_high != null && <HM label="RWM Higher" value={s.ks2_rwm_high + '%'} color={decileColor(quickDecile(s.ks2_rwm_high, s.phase, 'ks2_rwm_high'))} />}
          {s.ks2_read_avg != null && <HM label="Reading" value={s.ks2_read_avg.toFixed(0)} color={decileColor(quickDecile(s.ks2_read_avg, s.phase, 'ks2_read_avg'))} />}
          {s.ks2_writ_exp != null && <HM label="Writing" value={s.ks2_writ_exp + '%'} color={decileColor(quickDecile(s.ks2_writ_exp, s.phase, 'ks2_writ_exp'))} />}
          {s.ks2_mat_exp != null && <HM label="Maths" value={s.ks2_mat_exp + '%'} color={decileColor(quickDecile(s.ks2_mat_exp, s.phase, 'ks2_mat_exp'))} />}
        </div>
      )}

      <button onClick={(e) => { e.stopPropagation(); onViewProfile(); }}
        style={{
          width: '100%', marginTop: 8, padding: '8px', background: '#1d5a9e', color: 'white',
          border: 'none', borderRadius: 8, fontFamily: "'Source Sans 3', sans-serif",
          fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
        }}>
        View full profile →
      </button>
    </div>
  );
};

const HM = ({ label, value, big, color }) => (
  <div>
    <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1 }}>{label}</div>
    <div style={{ fontSize: big ? '1rem' : '0.85rem', fontWeight: big ? 800 : 700, color: color || '#0f172a', lineHeight: 1.3 }}>{value}</div>
  </div>
);

/* ─── Main App ─────────────────────────────────── */
const App = () => {
  const mapRef = useRef(null);
  const [showLanding, setShowLanding] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState(null);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [hoveredSchool, setHoveredSchool] = useState(null);
  const [hoverPos, setHoverPos] = useState(null);
  const [compareList, setCompareList] = useState([]);
  const [showCompare, setShowCompare] = useState(false);
  const [mapStyle, setMapStyle] = useState('light');
  const [showStats, setShowStats] = useState(false);

  const filtered = useMemo(() => activeFilters ? applyFilters(schoolsData, activeFilters) : schoolsData, [activeFilters]);

  const geojson = useMemo(() => ({
    type: 'FeatureCollection',
    features: filtered.filter(s => s.latitude && s.longitude).map(s => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.longitude, s.latitude] },
      properties: { urn: String(s.urn), color: PHASE_COLORS[s.phase] || '#64748b' },
    })),
  }), [filtered]);

  const stats = useMemo(() => {
    const a = filtered, total = a.length;
    const phases = {}, ofstedCounts = {};
    let a8 = [], p8 = [], fsm = [], pupils = [], ks2rwm = [], ks2read = [], ks2math = [];
    a.forEach(s => {
      phases[s.phase || 'Other'] = (phases[s.phase || 'Other'] || 0) + 1;
      if (s.ofsted && s.ofsted !== 'Not inspected') ofstedCounts[s.ofsted] = (ofstedCounts[s.ofsted] || 0) + 1;
      if (s.attainment8 != null) a8.push(s.attainment8);
      if (s.p8_prev != null) p8.push(s.p8_prev);
      if (s.fsm_pct != null) fsm.push(s.fsm_pct);
      if (s.pupils != null) pupils.push(s.pupils);
      if (s.ks2_rwm_exp != null) ks2rwm.push(s.ks2_rwm_exp);
      if (s.ks2_read_avg != null) ks2read.push(s.ks2_read_avg);
      if (s.ks2_mat_exp != null) ks2math.push(s.ks2_mat_exp);
    });
    const avg = a => a.length ? (a.reduce((x, y) => x + y, 0) / a.length) : null;
    const med = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
    const ofT = Object.values(ofstedCounts).reduce((x, y) => x + y, 0);
    return {
      total, phases, ofstedCounts, ofstedTotal: ofT,
      avgA8: avg(a8), medA8: med(a8), a8Count: a8.length,
      avgP8: avg(p8), medP8: med(p8), p8Count: p8.length,
      avgFSM: avg(fsm), medFSM: med(fsm),
      avgKS2RWM: avg(ks2rwm), ks2rwmCount: ks2rwm.length,
      avgKS2Read: avg(ks2read), avgKS2Math: avg(ks2math),
      totalPupils: pupils.reduce((x, y) => x + y, 0), avgPupils: avg(pupils),
      uniqueLAs: new Set(a.map(s => s.la).filter(Boolean)).size,
      uniqueTrusts: new Set(a.map(s => s.trust).filter(Boolean)).size,
    };
  }, [filtered]);

  const handleSearch = useCallback((q) => {
    const filters = parseSearchQuery(q);
    setActiveFilters(filters); setSearchQuery(q); setShowLanding(false); setSelectedSchool(null); setHoveredSchool(null);
    if (filters) {
      const results = applyFilters(schoolsData, filters);
      if (results.length > 0 && results.length < 500) {
        const lats = results.map(s => s.latitude).filter(Boolean), lngs = results.map(s => s.longitude).filter(Boolean);
        if (lats.length) {
          const bounds = [[Math.min(...lngs) - 0.05, Math.min(...lats) - 0.05], [Math.max(...lngs) + 0.05, Math.max(...lats) + 0.05]];
          setTimeout(() => mapRef.current?.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 800 }), 100);
        }
      }
    }
  }, []);

  const handleClearFilters = useCallback(() => { setActiveFilters(null); setSearchQuery(''); setSelectedSchool(null); setHoveredSchool(null); mapRef.current?.flyTo({ center: [-1.5, 52.8], zoom: 6, duration: 800 }); }, []);

  const handleMapClick = useCallback((event) => {
    if (!mapRef.current) return;
    const map = mapRef.current.getMap();
    const features = map.queryRenderedFeatures(event.point, { layers: ['school-dots'] });
    if (features && features.length > 0) {
      const urn = String(features[0].properties.urn);
      const school = schoolsByUrn[urn];
      if (school) { setSelectedSchool(school); setHoveredSchool(null); }
    }
  }, []);

  const handleMouseMove = useCallback((event) => {
    if (!mapRef.current) return;
    const map = mapRef.current.getMap();
    const features = map.queryRenderedFeatures(event.point, { layers: ['school-dots'] });
    if (features && features.length > 0) {
      const urn = String(features[0].properties.urn);
      const school = schoolsByUrn[urn];
      if (school) { setHoveredSchool(school); setHoverPos({ x: event.point.x, y: event.point.y }); map.getCanvas().style.cursor = 'pointer'; return; }
    }
    setHoveredSchool(null); setHoverPos(null); map.getCanvas().style.cursor = '';
  }, []);

  const handleMouseLeave = useCallback(() => { setHoveredSchool(null); setHoverPos(null); }, []);
  const handleAddCompare = useCallback((school) => { setCompareList(prev => { if (prev.find(s => s.urn === school.urn)) return prev; if (prev.length >= 3) return [...prev.slice(1), school]; return [...prev, school]; }); setSelectedSchool(null); }, []);
  const handleGoHome = useCallback(() => { setShowLanding(true); setSearchQuery(''); setActiveFilters(null); setSelectedSchool(null); setCompareList([]); setShowCompare(false); setShowStats(false); setHoveredSchool(null); setHoverPos(null); mapRef.current?.flyTo({ center: [-1.5, 52.8], zoom: 6, duration: 800 }); }, []);
  const cycleMapStyle = useCallback(() => { setMapStyle(p => p === 'light' ? 'dark' : p === 'dark' ? 'satellite' : 'light'); }, []);

  const openProfileFromHover = useCallback(() => {
    if (hoveredSchool) { setSelectedSchool(hoveredSchool); setHoveredSchool(null); }
  }, [hoveredSchool]);

  const ofstedColors = { Outstanding: '#0d7a42', Good: '#1d5a9e', 'Requires improvement': '#e8920e', Inadequate: '#cc3333' };
  const ofstedOrder = ['Outstanding', 'Good', 'Requires improvement', 'Inadequate'];

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Map ref={mapRef} initialViewState={{ longitude: -1.5, latitude: 52.8, zoom: 6 }}
        style={{ width: '100%', height: '100%' }} mapStyle={MAP_STYLES[mapStyle]} mapboxAccessToken={MAPBOX_TOKEN}
        onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} onClick={handleMapClick}>
        <Source id="schools" type="geojson" data={geojson}>
          <Layer id="school-dots" type="circle" paint={{
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 1.5, 8, 3, 10, 5, 14, 8],
            'circle-color': ['get', 'color'], 'circle-opacity': 0.85,
            'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 5, 0, 10, 0.5, 14, 1],
            'circle-stroke-color': 'rgba(255,255,255,0.6)',
          }} />
        </Source>
      </Map>

      {hoveredSchool && hoverPos && !selectedSchool && (
        <div style={{
          position: 'absolute', left: Math.min(hoverPos.x + 14, window.innerWidth - 280), top: Math.max(hoverPos.y - 14, 10),
          transform: 'translateY(-100%)', zIndex: 400, pointerEvents: 'auto',
        }}>
          <div style={{
            background: 'white', borderRadius: 12, padding: '12px 14px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.15)', width: 260, overflow: 'hidden',
          }}>
            <HoverCard school={hoveredSchool} onViewProfile={openProfileFromHover} />
          </div>
        </div>
      )}

      {showLanding && <LandingScreen onSearch={handleSearch} onExplore={() => setShowLanding(false)} schoolCount={schoolsData.length} />}
      {!showLanding && <SearchBar schools={schoolsData} query={searchQuery} onQueryChange={setSearchQuery} onSearch={handleSearch} resultCount={activeFilters ? filtered.length : null} activeFilters={activeFilters} onClearFilters={handleClearFilters} />}
      {selectedSchool && <SchoolProfile school={selectedSchool} allSchools={schoolsData} onClose={() => setSelectedSchool(null)} onCompare={handleAddCompare} />}
      {!showLanding && !showCompare && <ComparisonTray schools={compareList} onRemove={(urn) => setCompareList(prev => prev.filter(s => s.urn !== urn))} onCompare={() => setShowCompare(true)} />}
      {showCompare && <ComparePanel schools={compareList} allSchools={schoolsData} onRemove={(urn) => { setCompareList(prev => { const n = prev.filter(s => s.urn !== urn); if (n.length < 2) setShowCompare(false); return n; }); }} onClose={() => setShowCompare(false)} />}

      {!showLanding && (
        <button className="stats-toggle" onClick={() => setShowStats(v => !v)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="18" y="3" width="4" height="18" rx="1" /><rect x="10" y="8" width="4" height="13" rx="1" /><rect x="2" y="13" width="4" height="8" rx="1" /></svg>
          {showStats ? 'Hide stats' : 'Stats'}
        </button>
      )}

      {!showLanding && showStats && (
        <div className="stats-overlay" onClick={() => setShowStats(false)}>
          <div className="stats-panel" onClick={e => e.stopPropagation()}>
            <button className="stats-close" onClick={() => setShowStats(false)}>✕</button>
            <div className="stats-title">{activeFilters ? 'Filtered Results' : 'All Schools'}</div>
            <div className="stats-subtitle">State-funded schools in England · {stats.total.toLocaleString()} schools</div>
            <div className="stats-grid">
              <div className="stat-row"><span className="stat-label">Total pupils</span><span className="stat-value">{stats.totalPupils?.toLocaleString() || '—'}</span></div>
              <div className="stat-row"><span className="stat-label">Local authorities</span><span className="stat-value">{stats.uniqueLAs}</span></div>
              {stats.uniqueTrusts > 0 && <div className="stat-row"><span className="stat-label">Trusts</span><span className="stat-value">{stats.uniqueTrusts}</span></div>}
              <div className="stat-divider" />
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>By Phase</div>
              {Object.entries(stats.phases).sort((a, b) => b[1] - a[1]).map(([phase, count]) => (
                <div key={phase} className="stat-bar-row">
                  <div className="stat-bar-label"><span>{phase}</span><span>{count.toLocaleString()} ({Math.round(count / stats.total * 100)}%)</span></div>
                  <div className="stat-bar"><div className="stat-bar-fill" style={{ width: `${(count / stats.total) * 100}%`, background: PHASE_COLORS[phase] || '#64748b' }} /></div>
                </div>
              ))}
              <div className="stat-divider" />
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ofsted</div>
              {ofstedOrder.map(o => stats.ofstedCounts[o] ? (
                <div key={o} className="stat-bar-row">
                  <div className="stat-bar-label"><span>{o}</span><span>{stats.ofstedCounts[o].toLocaleString()} ({Math.round(stats.ofstedCounts[o] / stats.ofstedTotal * 100)}%)</span></div>
                  <div className="stat-bar"><div className="stat-bar-fill" style={{ width: `${(stats.ofstedCounts[o] / stats.ofstedTotal) * 100}%`, background: ofstedColors[o] }} /></div>
                </div>
              ) : null)}
              {stats.a8Count > 0 && (<>
                <div className="stat-divider" />
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>KS4 Performance ({stats.a8Count.toLocaleString()} schools)</div>
                <div className="stat-row"><span className="stat-label">Average Attainment 8</span><span className="stat-value">{stats.avgA8?.toFixed(1)}</span></div>
                <div className="stat-row"><span className="stat-label">Median Attainment 8</span><span className="stat-value">{stats.medA8?.toFixed(1)}</span></div>
                {stats.p8Count > 0 && <div className="stat-row"><span className="stat-label">Average Progress 8 (2024)</span><span className="stat-value">{(stats.avgP8 > 0 ? '+' : '') + stats.avgP8?.toFixed(2)}</span></div>}
              </>)}
              {stats.ks2rwmCount > 0 && (<>
                <div className="stat-divider" />
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>KS2 Performance ({stats.ks2rwmCount.toLocaleString()} schools)</div>
                <div className="stat-row"><span className="stat-label">Average RWM Expected</span><span className="stat-value">{stats.avgKS2RWM?.toFixed(0)}%</span></div>
                {stats.avgKS2Read != null && <div className="stat-row"><span className="stat-label">Average Reading Score</span><span className="stat-value">{stats.avgKS2Read?.toFixed(0)}</span></div>}
              </>)}
              {stats.avgFSM != null && (<>
                <div className="stat-divider" />
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Context</div>
                <div className="stat-row"><span className="stat-label">Average FSM %</span><span className="stat-value">{stats.avgFSM?.toFixed(1)}%</span></div>
                <div className="stat-row"><span className="stat-label">Average School Size</span><span className="stat-value">{stats.avgPupils ? Math.round(stats.avgPupils).toLocaleString() : '—'}</span></div>
              </>)}
            </div>
          </div>
        </div>
      )}

      {!showLanding && (
        <div className="map-controls">
          <div className="map-legend">
            {Object.entries(PHASE_COLORS).filter(([k]) => stats.phases[k]).map(([phase, color]) => (
              <div key={phase} className="legend-item"><div className="legend-dot" style={{ background: color }} />{phase}</div>
            ))}
          </div>
          <button className="map-ctrl-btn" onClick={cycleMapStyle} title="Change map style">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" /></svg>
          </button>
          <button className="map-ctrl-btn map-home-btn" onClick={handleGoHome} title="Return to home">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
