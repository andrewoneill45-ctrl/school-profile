import React, { useState, useCallback, useRef, useMemo } from 'react';
import Map, { Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

import LandingScreen from './components/LandingScreen';
import SearchBar from './components/SearchBar';
import SchoolCard from './components/SchoolCard';
import SchoolProfile from './components/SchoolProfile';
import ComparisonTray from './components/ComparisonTray';
import ComparePanel from './components/ComparePanel';

import { parseSearchQuery, applyFilters } from './utils/searchParser';

// ─── IMPORTANT: Replace with your Mapbox token ───
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.your_token_here';

// ─── Load school data ─────────────────────────────
import schoolsData from './schools.json';

const MAP_STYLES = {
  light: 'mapbox://styles/mapbox/light-v11',
  dark: 'mapbox://styles/mapbox/dark-v11',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
};

const App = () => {
  const [showLanding, setShowLanding] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState(null);
  const [hoveredSchool, setHoveredSchool] = useState(null);
  const [cursorPosition, setCursorPosition] = useState(null);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [compareList, setCompareList] = useState([]);
  const [showCompare, setShowCompare] = useState(false);
  const [mapStyle, setMapStyle] = useState('light');
  const mapRef = useRef(null);

  // ─── Filtered schools ───────────────────────────
  const filteredSchools = useMemo(() => {
    return applyFilters(schoolsData, activeFilters);
  }, [activeFilters]);

  // ─── GeoJSON for map ────────────────────────────
  const geojsonData = useMemo(() => ({
    type: 'FeatureCollection',
    features: filteredSchools.map(school => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [school.longitude, school.latitude]
      },
      properties: {
        urn: school.urn,
        name: school.name,
        phase: school.phase,
        ofsted: school.ofsted,
      }
    }))
  }), [filteredSchools]);

  // ─── Layer paint ────────────────────────────────
  const clusterLayer = {
    id: 'clusters',
    type: 'circle',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': ['step', ['get', 'point_count'], '#0c7c8a', 50, '#162d5a', 200, '#0f2042'],
      'circle-radius': ['step', ['get', 'point_count'], 18, 50, 24, 200, 32],
      'circle-stroke-width': 2,
      'circle-stroke-color': 'rgba(255,255,255,0.3)',
    }
  };

  const clusterCountLayer = {
    id: 'cluster-count',
    type: 'symbol',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': '{point_count_abbreviated}',
      'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
      'text-size': 13,
    },
    paint: { 'text-color': '#ffffff' }
  };

  const unclusteredLayer = {
    id: 'unclustered-point',
    type: 'circle',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 2, 10, 4, 14, 8, 18, 14],
      'circle-color': [
        'match', ['get', 'phase'],
        'Primary', '#1d70b8',
        'Secondary', '#c53030',
        'Special', '#6c5ce7',
        'Nursery', '#e8a817',
        '#8a929a'
      ],
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 14, 1.5],
      'circle-stroke-color': '#ffffff',
      'circle-opacity': 0.85,
    }
  };

  // ─── Zoom to results ────────────────────────────
  const zoomToResults = useCallback((results) => {
    if (!results.length || !mapRef.current) return;
    const lats = results.map(s => s.latitude).filter(Boolean);
    const lngs = results.map(s => s.longitude).filter(Boolean);
    if (!lats.length || !lngs.length) return;

    const padding = 0.005;
    const bounds = [
      [Math.min(...lngs) - padding, Math.min(...lats) - padding],
      [Math.max(...lngs) + padding, Math.max(...lats) + padding]
    ];

    mapRef.current.fitBounds(bounds, {
      padding: { top: 100, bottom: 60, left: 40, right: 40 },
      maxZoom: 15,
      duration: 1200,
    });
  }, []);

  // ─── Search handler ─────────────────────────────
  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    const filters = parseSearchQuery(query);
    setActiveFilters(filters);
    setShowLanding(false);
    setHoveredSchool(null);
    setSelectedSchool(null);

    const results = applyFilters(schoolsData, filters);
    if (results.length > 0) {
      zoomToResults(results);
    }
  }, [zoomToResults]);

  const handleExplore = useCallback(() => {
    setShowLanding(false);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setActiveFilters(null);
  }, []);

  // ─── Map hover ──────────────────────────────────
  const handleMouseMove = useCallback((event) => {
    if (!mapRef.current) return;
    const features = mapRef.current.queryRenderedFeatures(event.point, {
      layers: ['unclustered-point']
    });

    if (features.length > 0) {
      const feature = features[0];
      const school = schoolsData.find(s => s.urn === feature.properties.urn);
      if (school) {
        setHoveredSchool(school);
        setCursorPosition({ x: event.point.x, y: event.point.y });
      }
      mapRef.current.getCanvas().style.cursor = 'pointer';
    } else {
      setHoveredSchool(null);
      mapRef.current.getCanvas().style.cursor = '';
    }
  }, []);

  // ─── Map click ──────────────────────────────────
  const handleMapClick = useCallback((event) => {
    if (!mapRef.current) return;

    // Check clusters first
    const clusterFeatures = mapRef.current.queryRenderedFeatures(event.point, {
      layers: ['clusters']
    });

    if (clusterFeatures.length > 0) {
      const clusterId = clusterFeatures[0].properties.cluster_id;
      mapRef.current.getSource('schools').getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return;
        mapRef.current.easeTo({
          center: clusterFeatures[0].geometry.coordinates,
          zoom: zoom,
          duration: 500,
        });
      });
      return;
    }

    // Check individual schools
    const features = mapRef.current.queryRenderedFeatures(event.point, {
      layers: ['unclustered-point']
    });

    if (features.length > 0) {
      const school = schoolsData.find(s => s.urn === features[0].properties.urn);
      if (school) {
        setSelectedSchool(school);
        setHoveredSchool(null);
      }
    }
  }, []);

  // ─── Comparison ─────────────────────────────────
  const handleAddToCompare = useCallback((school) => {
    setCompareList(prev => {
      if (prev.find(s => s.urn === school.urn)) return prev;
      if (prev.length >= 3) {
        // Replace oldest
        return [...prev.slice(1), school];
      }
      return [...prev, school];
    });
    setSelectedSchool(null);
  }, []);

  const handleRemoveFromCompare = useCallback((urn) => {
    setCompareList(prev => prev.filter(s => s.urn !== urn));
  }, []);

  // ─── Map style toggle ──────────────────────────
  const cycleMapStyle = useCallback(() => {
    setMapStyle(prev => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'satellite';
      return 'light';
    });
  }, []);

  // ─── Go home ─────────────────────────────────────
  const handleGoHome = useCallback(() => {
    setShowLanding(true);
    setSearchQuery('');
    setActiveFilters(null);
    setHoveredSchool(null);
    setSelectedSchool(null);
    setCompareList([]);
    setShowCompare(false);
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [-1.5, 52.8],
        zoom: 6,
        duration: 1000,
      });
    }
  }, []);

  // ─── Render ─────────────────────────────────────
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Map */}
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: -1.5,
          latitude: 52.8,
          zoom: 6,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={MAP_STYLES[mapStyle]}
        mapboxAccessToken={MAPBOX_TOKEN}
        onMouseMove={handleMouseMove}
        onClick={handleMapClick}
        interactiveLayerIds={['unclustered-point', 'clusters']}
      >
        <Source
          id="schools"
          type="geojson"
          data={geojsonData}
          cluster={true}
          clusterMaxZoom={13}
          clusterRadius={50}
        >
          <Layer {...clusterLayer} />
          <Layer {...clusterCountLayer} />
          <Layer {...unclusteredLayer} />
        </Source>
      </Map>

      {/* Landing screen */}
      {showLanding && (
        <LandingScreen
          onSearch={handleSearch}
          onExplore={handleExplore}
          schoolCount={schoolsData.length}
        />
      )}

      {/* Search bar (visible after landing dismissed) */}
      {!showLanding && (
        <SearchBar
          schools={schoolsData}
          query={searchQuery}
          onQueryChange={setSearchQuery}
          onSearch={handleSearch}
          resultCount={activeFilters ? filteredSchools.length : null}
          activeFilters={activeFilters}
          onClearFilters={handleClearFilters}
        />
      )}

      {/* Hover card */}
      {hoveredSchool && !selectedSchool && (
        <SchoolCard school={hoveredSchool} position={cursorPosition} />
      )}

      {/* School profile modal */}
      {selectedSchool && (
        <SchoolProfile
          school={selectedSchool}
          allSchools={schoolsData}
          onClose={() => setSelectedSchool(null)}
          onCompare={handleAddToCompare}
        />
      )}

      {/* Comparison tray */}
      {!showLanding && !showCompare && (
        <ComparisonTray
          schools={compareList}
          onRemove={handleRemoveFromCompare}
          onCompare={() => setShowCompare(true)}
        />
      )}

      {/* Comparison panel */}
      {showCompare && (
        <ComparePanel
          schools={compareList}
          onRemove={handleRemoveFromCompare}
          onClose={() => setShowCompare(false)}
        />
      )}

      {/* Map controls */}
      {!showLanding && (
        <div className="map-controls">
          <button className="map-ctrl-btn map-home-btn" onClick={handleGoHome} title="Back to search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </button>
          <button className="map-ctrl-btn" onClick={cycleMapStyle} title="Change map style">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
              <line x1="8" y1="2" x2="8" y2="18" />
              <line x1="16" y1="6" x2="16" y2="22" />
            </svg>
          </button>
          <button className="map-ctrl-btn" onClick={handleClearFilters} title="Reset view">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </button>

          {/* Legend */}
          <div className="map-legend">
            <div className="legend-item"><span className="legend-dot" style={{ background: '#1d70b8' }} />Primary</div>
            <div className="legend-item"><span className="legend-dot" style={{ background: '#c53030' }} />Secondary</div>
            <div className="legend-item"><span className="legend-dot" style={{ background: '#6c5ce7' }} />Special</div>
            <div className="legend-item"><span className="legend-dot" style={{ background: '#8a929a' }} />Other</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
