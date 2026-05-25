import { useState, useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { CROSSINGS, CORRIDORS, RAIL_LINES, CITIES } from './data/crossings';
import { supabase } from './lib/supabase';

// ─── CONFIG ────────────────────────────────────────────────────────────────
// Replace with your Mapbox public token
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || 'YOUR_MAPBOX_TOKEN_HERE';
const EXPIRY_MS = 12 * 60 * 1000; // 12 minutes

// ─── HELPERS ───────────────────────────────────────────────────────────────
function timeAgo(ts) {
  if (!ts) return '';
  const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins === 1) return '1 min ago';
  return `${mins} min ago`;
}

function expiryPct(ts) {
  if (!ts) return 0;
  const elapsed = Date.now() - new Date(ts).getTime();
  return Math.max(0, Math.min(100, 100 - (elapsed / EXPIRY_MS * 100)));
}

function minsLeft(ts) {
  if (!ts) return 0;
  const elapsed = Date.now() - new Date(ts).getTime();
  return Math.max(0, Math.round((EXPIRY_MS - elapsed) / 60000));
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
export default function App() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});

  const [reports, setReports] = useState({});        // { crossingId: { status, reportedAt, reportCount } }
  const [selectedId, setSelectedId] = useState(null);
  const [view, setView] = useState('list');           // 'list' | 'detail'
  const [filterCity, setFilterCity] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterCorridor, setFilterCorridor] = useState('All');
  const [toast, setToast] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);

  // ── Load initial reports from Supabase ──────────────────────────────────
  useEffect(() => {
    loadReports();
    const channel = supabase
      .channel('reports-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => {
        loadReports();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  async function loadReports() {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) { console.error('Load reports error:', error); setIsLoading(false); return; }

    const map = {};
    data?.forEach(r => {
      if (!map[r.crossing_id] || new Date(r.created_at) > new Date(map[r.crossing_id].reportedAt)) {
        map[r.crossing_id] = {
          status: r.status,
          reportedAt: r.created_at,
          reportCount: (map[r.crossing_id]?.reportCount || 0) + 1,
          id: r.id,
        };
      }
    });
    setReports(map);
    setIsLoading(false);
  }

  // ── Auto-expire check every 60s ─────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(loadReports, 60000);
    return () => clearInterval(interval);
  }, []);

  // ── Map initialization ───────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [-112.0740, 33.4484],
      zoom: 9,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: false,
    }), 'top-right');

    map.on('load', () => {
      // Add rail line sources
      RAIL_LINES.forEach((line, i) => {
        const sourceId = `rail-${i}`;
        map.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: line.coordinates },
          },
        });
        map.addLayer({
          id: `${sourceId}-layer`,
          type: 'line',
          source: sourceId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': line.corridor === 'BNSF' ? '#f97316' : '#AA000E',
            'line-width': 2.5,
            'line-opacity': 0.75,
            'line-dasharray': [5, 3],
          },
        });
      });

      // Add crossing markers
      CROSSINGS.forEach(c => {
        const el = document.createElement('div');
        el.className = 'crossing-marker marker-clear';
        el.dataset.id = c.id;
        el.title = c.name;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          handleSelectCrossing(c.id);
        });

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([c.lng, c.lat])
          .addTo(map);

        markersRef.current[c.id] = marker;
      });

      setMapLoaded(true); setTimeout(() => map.resize(), 100);
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // ── Update marker colors when reports change ─────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    CROSSINGS.forEach(c => {
      const el = markersRef.current[c.id]?.getElement();
      if (!el) return;
      const r = reports[c.id];
      const status = r?.status || 'clear';
      el.className = `crossing-marker marker-${status}`;
    });
  }, [reports, mapLoaded]);

  // ── Select crossing & fly map ────────────────────────────────────────────
  const handleSelectCrossing = useCallback((id) => {
    setSelectedId(id);
    setView('detail');
    const c = CROSSINGS.find(x => x.id === id);
    if (c && mapRef.current) {
      mapRef.current.flyTo({ center: [c.lng, c.lat], zoom: 14, duration: 800 });
    }
  }, []);

  // ── Submit report ────────────────────────────────────────────────────────
  async function submitReport(crossingId, status) {
    const expiresAt = new Date(Date.now() + EXPIRY_MS).toISOString();
    const { error } = await supabase.from('reports').insert({
      crossing_id: crossingId,
      status,
      expires_at: expiresAt,
      reported_at: new Date().toISOString(),
    });

    if (error) {
      showToast('Error submitting report. Try again.');
      console.error(error);
      return;
    }

    const msgs = {
      blocked: '🚨 Blocked crossing reported — thank you!',
      warning: '⚡ Slow train reported — heads up sent!',
      clear: '✅ Crossing marked clear',
    };
    showToast(msgs[status]);
    await loadReports();
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // ── Derived data ─────────────────────────────────────────────────────────
  const enriched = CROSSINGS.map(c => ({
    ...c,
    ...(reports[c.id] || { status: 'clear', reportedAt: null, reportCount: 0 }),
  }));

  const filtered = enriched
    .filter(c => filterCity === 'All' || c.city === filterCity)
    .filter(c => filterStatus === 'All' || c.status === filterStatus)
    .filter(c => filterCorridor === 'All' || c.corridor === filterCorridor)
    .sort((a, b) => {
      const order = { blocked: 0, warning: 1, clear: 2 };
      return order[a.status] - order[b.status];
    });

  const blockedCount = enriched.filter(c => c.status === 'blocked').length;
  const warningCount = enriched.filter(c => c.status === 'warning').length;
  const clearCount = enriched.filter(c => c.status === 'clear').length;

  const selectedCrossing = selectedId ? enriched.find(c => c.id === selectedId) : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      {/* HEADER */}
      <header className="header">
        <div className="logo">
          <div className="logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
              <path d="M4 12h16M4 6h16M4 18h16M8 3v18M16 3v18"/>
            </svg>
          </div>
          <div>
            <div className="logo-name">TrackAlert</div>
            <div className="logo-sub">Phoenix Valley · AZ</div>
          </div>
        </div>
        <div className="stats-row">
          <div className="stat-pill"><span className="dot dot-red"/>{blockedCount} blocked</div>
          <div className="stat-pill"><span className="dot dot-yellow"/>{warningCount} slow</div>
          <div className="stat-pill"><span className="dot dot-green"/>{clearCount} clear</div>
        </div>
      </header>

      {/* MAP */}
      <div className="map-wrap">
        <div ref={mapContainer} className="map"/>
        {toast && <div className="toast show">{toast}</div>}
      </div>

      {/* BOTTOM PANEL */}
      <div className="panel">
        <div className="panel-top">
          {view === 'detail' ? (
            <>
              <button className="back-btn" onClick={() => { setView('list'); setSelectedId(null); }}>
                ← All crossings
              </button>
              <span className="panel-title">Crossing Detail</span>
            </>
          ) : (
            <>
              <span className="panel-title">
                {filtered.length} crossing{filtered.length !== 1 ? 's' : ''}
                {(filterCity !== 'All' || filterStatus !== 'All' || filterCorridor !== 'All') ? ' (filtered)' : ''}
              </span>
              <div className="filters">
                <select value={filterCorridor} onChange={e => setFilterCorridor(e.target.value)}>
                  <option value="All">All lines</option>
                  <option value="BNSF">BNSF</option>
                  <option value="UP">Union Pacific</option>
                </select>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="All">All status</option>
                  <option value="blocked">Blocked</option>
                  <option value="warning">Slow</option>
                  <option value="clear">Clear</option>
                </select>
                <select value={filterCity} onChange={e => setFilterCity(e.target.value)}>
                  <option value="All">All cities</option>
                  {CITIES.map(city => <option key={city} value={city}>{city}</option>)}
                </select>
              </div>
            </>
          )}
        </div>

        <div className="panel-body">
          {view === 'list' ? (
            <CrossingList crossings={filtered} onSelect={handleSelectCrossing} loading={isLoading} />
          ) : selectedCrossing ? (
            <CrossingDetail
              crossing={selectedCrossing}
              onReport={submitReport}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── CROSSING LIST ─────────────────────────────────────────────────────────
function CrossingList({ crossings, onSelect, loading }) {
  if (loading) return (
    <div className="loading-state">
      <div className="spinner"/>
      <span>Loading crossing data...</span>
    </div>
  );
  if (crossings.length === 0) return (
    <div className="empty-state">No crossings match your filters.</div>
  );
  return (
    <div className="crossing-list">
      {crossings.map(c => (
        <button
          key={c.id}
          className={`crossing-item ${c.status === 'blocked' ? 'item-blocked' : c.status === 'warning' ? 'item-warning' : ''}`}
          onClick={() => onSelect(c.id)}
        >
          <div className="ci-corridor" style={{ background: c.corridor === 'BNSF' ? '#f97316' : '#AA000E' }}>
            {c.corridor}
          </div>
          <div className="ci-main">
            <div className="ci-name">{c.name}</div>
            <div className="ci-road">{c.road}</div>
          </div>
          <div className="ci-right">
            <div className={`ci-status status-${c.status}`}>
              {c.status === 'blocked' ? 'BLOCKED' : c.status === 'warning' ? 'SLOW' : 'CLEAR'}
            </div>
            {c.reportedAt && <div className="ci-time">{timeAgo(c.reportedAt)}</div>}
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── CROSSING DETAIL ────────────────────────────────────────────────────────
function CrossingDetail({ crossing: c, onReport }) {
  const pct = expiryPct(c.reportedAt);
  const mins = minsLeft(c.reportedAt);
  const statusLabel = c.status === 'blocked' ? 'TRAIN BLOCKING' : c.status === 'warning' ? 'MOVING SLOWLY' : 'ALL CLEAR';
  const corridor = CORRIDORS[c.corridor];
  const mapsUrl = `https://maps.apple.com/?q=${encodeURIComponent(c.name)}&ll=${c.lat},${c.lng}`;
  const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`;

  return (
    <div className="detail">
      <div className="detail-header">
        <span className="detail-corridor" style={{ background: c.corridor === 'BNSF' ? '#1a1200' : '#1a0808', color: c.corridor === 'BNSF' ? '#f97316' : '#e24b4a', borderColor: c.corridor === 'BNSF' ? '#f97316' : '#AA000E' }}>
          {corridor.name}
        </span>
        <h2 className="detail-name">{c.name}</h2>
        <div className="detail-meta">{c.road} · {c.fraId}</div>
        {c.notes && <div className="detail-note">ℹ {c.notes}</div>}

        <div className={`detail-status status-badge-${c.status}`}>
          {c.status === 'blocked' ? '🚨' : c.status === 'warning' ? '⚡' : '✅'} {statusLabel}
        </div>

        {c.status !== 'clear' && c.reportedAt && (
          <div className="expiry-section">
            <div className="expiry-label">
              Expires in ~{mins} min · {c.reportCount || 1} report{c.reportCount !== 1 ? 's' : ''}
              <span className="expiry-time">{timeAgo(c.reportedAt)}</span>
            </div>
            <div className="expiry-track">
              <div
                className={`expiry-fill fill-${c.status}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="report-section">
        <div className="report-label">Report current status:</div>
        <div className="report-grid">
          <button className="rpt-btn rpt-blocked" onClick={() => onReport(c.id, 'blocked')}>
            <span className="rpt-icon">🚂</span>
            <span>Train blocking</span>
          </button>
          <button className="rpt-btn rpt-warning" onClick={() => onReport(c.id, 'warning')}>
            <span className="rpt-icon">⚡</span>
            <span>Moving slow</span>
          </button>
          <button className="rpt-btn rpt-clear" onClick={() => onReport(c.id, 'clear')}>
            <span className="rpt-icon">✓</span>
            <span>All clear</span>
          </button>
        </div>
      </div>

      <div className="nav-section">
        <div className="report-label">Navigation:</div>
        <div className="nav-btns">
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="nav-btn">
            🗺 Apple Maps
          </a>
          <a href={gmapsUrl} target="_blank" rel="noreferrer" className="nav-btn">
            📍 Google Maps
          </a>
        </div>
      </div>
    </div>
  );
}
