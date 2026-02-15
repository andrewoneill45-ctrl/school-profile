import React, { useState, useCallback, useMemo, useRef } from 'react';
import Map, { Source, Layer, Popup } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import LandingScreen from './components/LandingScreen';
import SearchBar from './components/SearchBar';
import SchoolProfile from './components/SchoolProfile';
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

/* ─── Hover Card (inline) ──────────────────────── */
const HoverCard = ({ school }) => {
  const s = school;
  const isSec = s.phase === 'Secondary' || s.phase === 'All-through';
  const isPri = s.phase === 'Primary';

  const ofstedColor = { Outstanding: '#0d7a42', Good: '#1d5a9e', 'Requires improvement': '#e8920e', Inadequate: '#cc3333' };

  return (
    <div style={{ fontFamily: "'Source Sans 3', sans-serif", minWidth: 220, maxWidth: 280, padding: '4px 2px' }}>
      {/* Name and phase */}
      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', lineHeight: 1.25, marginBottom: 4 }}>{s.name}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '1px 8px', borderRadius: 99, background: PHASE_COLORS[s.phase] || '#64748b', color: 'white' }}>{s.phase}</span>
        {s.ofsted && s.ofsted !== 'Not inspected' && (
          <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '1px 8px', borderRadius: 99, background: ofstedColor[s.ofsted] || '#94a3b8', color: 'white' }}>{s.ofsted}</span>
        )}
      </div>

      {/* Key info */}
      <div style={{ fontSize: '0.75rem', color: '#475569', lineHeight: 1.5 }}>
        {s.la && <div>{s.la}{s.town && s.town !== s.la ? ` · ${s.town}` : ''}</div>}
        {s.type && <div style={{ color: '#94a3b8' }}>{s.type}</div>}
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px 12px', marginTop: 8, paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>
        {s.pupils != null && <StatMini label="Pupils" value={s.pupils.toLocaleString()} />}
        {s.fsm_pct != null && <StatMini label="FSM" value={s.fsm_pct + '%'} />}
        {s.trust && <div style={{ gridColumn: '1 / -1' }}><StatMini label="Trust" value={s.trust.length > 35 ? s.trust.substring(0, 35) + '…' : s.trust} /></div>}
      </div>

      {/* Performance metrics */}
      {isSec && (s.attainment8 != null || s.progress8 != null) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px 12px', marginTop: 6, paddingTop: 6, borderTop: '1px solid #e2e8f0' }}>
          {s.attainment8 != null && <StatMini label="Attainment 8" value={s.attainment8.toFixed(1)} highlight />}
          {s.progress8 != null && <StatMini label="Progress 8" value={(s.progress8 > 0 ? '+' : '') + s.progress8.toFixed(2)} highlight />}
          {s.basics_94 != null && <StatMini label="Eng & Maths 4+" value={s.basics_94 + '%'} />}
          {s.basics_95 != null && <StatMini label="Eng & Maths 5+" value={s.basics_95 + '%'} />}
        </div>
      )}

      {isPri && (s.ks2_rwm_exp != null || s.ks2_read_avg != null) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px 12px', marginTop: 6, paddingTop: 6, borderTop: '1px solid #e2e8f0' }}>
          {s.ks2_rwm_exp != null && <StatMini label="RWM Expected" value={s.ks2_rwm_exp + '%'} highlight />}
          {s.ks2_rwm_high != null && <StatMini label="RWM Higher" value={s.ks2_rwm_high + '%'} />}
          {s.ks2_read_avg != null && <StatMini label="Reading" value={s.ks2_read_avg.toFixed(0)} />}
          {s.ks2_math_avg != null && <StatMini label="Maths" value={s.ks2_math_avg.toFixed(0)} />}
        </div>
      )}

      <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: 6, textAlign: 'center' }}>Click for full profile</div>
    </div>
  );
};

const StatMini = ({ label, value, highlight }) => (
  <div>
    <div style={{ fontSize: '0.62rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1 }}>{label}</div>
    <div style={{ fontSize: highlight ? '0.92rem' : '0.8rem', fontWeight: highlight ? 800 : 600, color: '#0f172a', lineHeight: 1.3 }}>{value}</div>
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
  const [hoverCoords, setHoverCoords] = useState(null);
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

  // ─── Stats ──────────────────────────────────────
  const stats = useMemo(() => {
    const a = filtered, total = a.length;
    const phases = {}, ofstedCounts = {}, laCounts = {}, trustCounts = {};
    let a8 = [], p8 = [], fsm = [], pupils = [], ks2rwm = [], ks2read = [], ks2math = [];
    a.forEach(s => {
      phases[s.phase || 'Other'] = (phases[s.phase || 'Other'] || 0) + 1;
      if (s.ofsted && s.ofsted !== 'Not inspected') ofstedCounts[s.ofsted] = (ofstedCounts[s.ofsted] || 0) + 1;
      if (s.la) laCounts[s.la] = (laCounts[s.la] || 0) + 1;
      if (s.trust) trustCounts[s.trust] = (trustCounts[s.trust] || 0) + 1;
      if (s.attainment8 != null) a8.push(s.attainment8);
      if (s.progress8 != null) p8.push(s.progress8);
      if (s.fsm_pct != null) fsm.push(s.fsm_pct);
      if (s.pupils != null) pupils.push(s.pupils);
      if (s.ks2_rwm_exp != null) ks2rwm.push(s.ks2_rwm_exp);
      if (s.ks2_read_avg != null) ks2read.push(s.ks2_read_avg);
      if (s.ks2_math_avg != null) ks2math.push(s.ks2_math_avg);
    });
    const avg = a => a.length ? (a.reduce((x, y) => x + y, 0) / a.length) : null;
    const med = a => { if (!a.length) return null; const s = [...a].sort((x,y) => x-y); const m = Math.floor(s.length/2); return s.length%2 ? s[m] : (s[m-1]+s[m])/2; };
    const ofT = Object.values(ofstedCounts).reduce((x, y) => x + y, 0);
    return {
      total, phases, ofstedCounts, ofstedTotal: ofT,
      avgA8: avg(a8), medA8: med(a8), a8Count: a8.length,
      avgP8: avg(p8), medP8: med(p8), p8Count: p8.length,
      avgFSM: avg(fsm), medFSM: med(fsm),
      avgKS2RWM: avg(ks2rwm), ks2rwmCount: ks2rwm.length,
      avgKS2Read: avg(ks2read), avgKS2Math: avg(ks2math),
      totalPupils: pupils.reduce((x, y) => x + y, 0), avgPupils: avg(pupils),
      uniqueLAs: Object.keys(laCounts).length, uniqueTrusts: Object.keys(trustCounts).length,
    };
  }, [filtered]);

  // ─── Handlers ───────────────────────────────────
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

  const handleClearFilters = useCallback(() => {
    setActiveFilters(null); setSearchQuery(''); setSelectedSchool(null); setHoveredSchool(null);
    mapRef.current?.flyTo({ center: [-1.5, 52.8], zoom: 6, duration: 800 });
  }, []);

  const handleMapClick = useCallback((event) => {
    // Use queryRenderedFeatures for reliable click detection
    if (!mapRef.current) return;
    const map = mapRef.current.getMap();
    const features = map.queryRenderedFeatures(event.point, { layers: ['school-dots'] });
    if (features && features.length > 0) {
      const urn = String(features[0].properties.urn);
      const school = schoolsByUrn[urn];
      if (school) {
        setSelectedSchool(school);
        setHoveredSchool(null);
      }
    }
  }, []);

  const handleMouseMove = useCallback((event) => {
    if (!mapRef.current) return;
    const map = mapRef.current.getMap();
    const features = map.queryRenderedFeatures(event.point, { layers: ['school-dots'] });
    if (features && features.length > 0) {
      const urn = String(features[0].properties.urn);
      const school = schoolsByUrn[urn];
      if (school) {
        setHoveredSchool(school);
        setHoverCoords({ lng: school.longitude, lat: school.latitude });
        map.getCanvas().style.cursor = 'pointer';
        return;
      }
    }
    setHoveredSchool(null);
    setHoverCoords(null);
    map.getCanvas().style.cursor = '';
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredSchool(null); setHoverCoords(null);
  }, []);

  const handleAddCompare = useCallback((school) => {
    setCompareList(prev => { if (prev.find(s => s.urn === school.urn)) return prev; if (prev.length >= 3) return [...prev.slice(1), school]; return [...prev, school]; });
    setSelectedSchool(null);
  }, []);

  const handleGoHome = useCallback(() => {
    setShowLanding(true); setSearchQuery(''); setActiveFilters(null); setSelectedSchool(null);
    setCompareList([]); setShowCompare(false); setShowStats(false); setHoveredSchool(null); setHoverCoords(null);
    mapRef.current?.flyTo({ center: [-1.5, 52.8], zoom: 6, duration: 800 });
  }, []);

  const cycleMapStyle = useCallback(() => {
    setMapStyle(p => p === 'light' ? 'dark' : p === 'dark' ? 'satellite' : 'light');
  }, []);

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
            'circle-color': ['get', 'color'],
            'circle-opacity': 0.85,
            'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 5, 0, 10, 0.5, 14, 1],
            'circle-stroke-color': 'rgba(255,255,255,0.6)',
          }} />
        </Source>

        {/* Rich hover popup with full stats */}
        {hoveredSchool && hoverCoords && !selectedSchool && (
          <Popup longitude={hoverCoords.lng} latitude={hoverCoords.lat}
            closeButton={false} closeOnClick={false} anchor="bottom" offset={12}
            style={{ zIndex: 10 }}>
            <HoverCard school={hoveredSchool} />
          </Popup>
        )}
      </Map>

      {showLanding && <LandingScreen onSearch={handleSearch} onExplore={() => setShowLanding(false)} schoolCount={schoolsData.length} />}

      {!showLanding && <SearchBar schools={schoolsData} query={searchQuery} onQueryChange={setSearchQuery}
        onSearch={handleSearch} resultCount={activeFilters ? filtered.length : null}
        activeFilters={activeFilters} onClearFilters={handleClearFilters} />}

      {selectedSchool && <SchoolProfile school={selectedSchool} allSchools={schoolsData}
        onClose={() => setSelectedSchool(null)} onCompare={handleAddCompare} />}

      {!showLanding && !showCompare && <ComparisonTray schools={compareList}
        onRemove={(urn) => setCompareList(prev => prev.filter(s => s.urn !== urn))}
        onCompare={() => setShowCompare(true)} />}

      {showCompare && <ComparePanel schools={compareList} allSchools={schoolsData}
        onRemove={(urn) => { setCompareList(prev => { const n = prev.filter(s => s.urn !== urn); if (n.length < 2) setShowCompare(false); return n; }); }}
        onClose={() => setShowCompare(false)} />}

      {!showLanding && (
        <button className="stats-toggle" onClick={() => setShowStats(v => !v)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="18" y="3" width="4" height="18" rx="1"/><rect x="10" y="8" width="4" height="13" rx="1"/><rect x="2" y="13" width="4" height="8" rx="1"/></svg>
          {showStats ? 'Hide stats' : 'Stats'}
        </button>
      )}

      {!showLanding && showStats && (
        <div className="stats-panel">
          <div className="stats-title">{activeFilters ? 'Filtered Results' : 'All Schools (State-funded)'}</div>
          <div className="stats-grid">
            <div className="stat-row"><span className="stat-label">Schools</span><span className="stat-value">{stats.total.toLocaleString()}</span></div>
            <div className="stat-row"><span className="stat-label">Total pupils</span><span className="stat-value">{stats.totalPupils?.toLocaleString() || '—'}</span></div>
            <div className="stat-row"><span className="stat-label">Local authorities</span><span className="stat-value">{stats.uniqueLAs}</span></div>
            {stats.uniqueTrusts > 0 && <div className="stat-row"><span className="stat-label">Trusts</span><span className="stat-value">{stats.uniqueTrusts}</span></div>}
            <div className="stat-divider" />
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>By Phase</div>
            {Object.entries(stats.phases).sort((a, b) => b[1] - a[1]).map(([phase, count]) => (
              <div key={phase} className="stat-bar-row">
                <div className="stat-bar-label"><span>{phase}</span><span>{count.toLocaleString()} ({Math.round(count / stats.total * 100)}%)</span></div>
                <div className="stat-bar"><div className="stat-bar-fill" style={{ width: `${(count / stats.total) * 100}%`, background: PHASE_COLORS[phase] || '#64748b' }} /></div>
              </div>
            ))}
            <div className="stat-divider" />
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Ofsted Ratings</div>
            {ofstedOrder.map(o => stats.ofstedCounts[o] ? (
              <div key={o} className="stat-bar-row">
                <div className="stat-bar-label"><span>{o}</span><span>{stats.ofstedCounts[o].toLocaleString()} ({Math.round(stats.ofstedCounts[o] / stats.ofstedTotal * 100)}%)</span></div>
                <div className="stat-bar"><div className="stat-bar-fill" style={{ width: `${(stats.ofstedCounts[o] / stats.ofstedTotal) * 100}%`, background: ofstedColors[o] }} /></div>
              </div>
            ) : null)}
            {stats.a8Count > 0 && (<>
              <div className="stat-divider" />
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>KS4 ({stats.a8Count.toLocaleString()} schools)</div>
              <div className="stat-row"><span className="stat-label">Avg Attainment 8</span><span className="stat-value">{stats.avgA8?.toFixed(1)}</span></div>
              <div className="stat-row"><span className="stat-label">Median A8</span><span className="stat-value">{stats.medA8?.toFixed(1)}</span></div>
              {stats.p8Count > 0 && <>
                <div className="stat-row"><span className="stat-label">Avg Progress 8</span><span className="stat-value">{(stats.avgP8 > 0 ? '+' : '') + stats.avgP8?.toFixed(2)}</span></div>
                <div className="stat-row"><span className="stat-label">Median P8</span><span className="stat-value">{(stats.medP8 > 0 ? '+' : '') + stats.medP8?.toFixed(2)}</span></div>
              </>}
            </>)}
            {stats.ks2rwmCount > 0 && (<>
              <div className="stat-divider" />
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>KS2 ({stats.ks2rwmCount.toLocaleString()} schools)</div>
              <div className="stat-row"><span className="stat-label">Avg RWM Expected</span><span className="stat-value">{stats.avgKS2RWM?.toFixed(0)}%</span></div>
              {stats.avgKS2Read != null && <div className="stat-row"><span className="stat-label">Avg Reading</span><span className="stat-value">{stats.avgKS2Read?.toFixed(0)}</span></div>}
              {stats.avgKS2Math != null && <div className="stat-row"><span className="stat-label">Avg Maths</span><span className="stat-value">{stats.avgKS2Math?.toFixed(0)}</span></div>}
            </>)}
            {stats.avgFSM != null && (<>
              <div className="stat-divider" />
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Disadvantage</div>
              <div className="stat-row"><span className="stat-label">Avg FSM %</span><span className="stat-value">{stats.avgFSM?.toFixed(1)}%</span></div>
              <div className="stat-row"><span className="stat-label">Median FSM %</span><span className="stat-value">{stats.medFSM?.toFixed(1)}%</span></div>
              <div className="stat-row"><span className="stat-label">Avg School Size</span><span className="stat-value">{stats.avgPupils ? Math.round(stats.avgPupils).toLocaleString() : '—'}</span></div>
            </>)}
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
          </button>
          <button className="map-ctrl-btn map-home-btn" onClick={handleGoHome} title="Return to home">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
