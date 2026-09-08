import { useEffect, useRef, useState } from 'react';
import { MapPin, RefreshCw } from 'lucide-react';
import { request } from '../api';
import { loadSdk } from '../library/PlaceMap';

export default function MapScene({ points, center, selected, onSelect, onMove, command }) {
  const container = useRef(null);
  const mapRef = useRef(null);
  const callbacks = useRef({ onSelect, onMove });
  callbacks.current = { onSelect, onMove };
  const [revision, setRevision] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const initial = useRef(center);
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    setReady(false); setError('');
    async function initialize() {
      try {
        const config = await request('/api/client-config/map', { signal: controller.signal });
        if (!config.enabled) throw new Error('地图暂不可用，仍可查看体验列表');
        const AMap = await loadSdk(config);
        if (disposed) return;
        const map = new AMap.Map(container.current, { zoom: 14, viewMode: '2D', center: [initial.current.lng, initial.current.lat], resizeEnable: true });
        mapRef.current = { map, AMap };
        map.on('moveend', () => { const location = map.getCenter(); callbacks.current.onMove({ lat: location.lat, lng: location.lng }); });
        setReady(true);
      } catch (failure) { if (!disposed) setError(failure.message); }
    }
    initialize();
    return () => { disposed = true; controller.abort(); mapRef.current?.map.destroy(); mapRef.current = null; };
  }, [revision]);
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const { map, AMap } = mapRef.current;
    const markers = points.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)).map((point) => {
      const content = document.createElement('button');
      content.type = 'button';
      content.className = `food-pin pin-${point.layer} ${selected === point.key ? 'pin-active' : ''}`;
      content.setAttribute('aria-label', `地图上的 ${point.restaurant_name}`);
      const score = document.createElement('span');
      score.className = 'pin-score'; score.textContent = point.rating ? Number(point.rating).toFixed(1) : '+';
      const name = document.createElement('span'); name.className = 'pin-name'; name.textContent = point.restaurant_name;
      content.append(score, name);
      const marker = new AMap.Marker({ position: [point.lng, point.lat], content, anchor: 'bottom-center', zIndex: selected === point.key ? 200 : 100 });
      marker.on('click', () => callbacks.current.onSelect(point.key));
      return marker;
    });
    map.add(markers);
    const syncLabels = () => markers.forEach((marker) => marker.getContent()?.classList.toggle('pin-detail', map.getZoom() >= 15));
    map.on('zoomend', syncLabels); syncLabels();
    return () => { map.off('zoomend', syncLabels); map.remove(markers); };
  }, [points, selected, ready]);
  useEffect(() => { if (ready) mapRef.current?.map.setCenter([center.lng, center.lat]); }, [center, ready]);
  useEffect(() => {
    if (!ready || !command) return;
    const map = mapRef.current.map;
    if (command.type === 'in') map.zoomIn();
    if (command.type === 'out') map.zoomOut();
  }, [command, ready]);
  return <div className="map-stage"><div className="map-canvas" ref={container} aria-label="美食地图" />{(!ready || error) && <div className="map-status" role={error ? 'alert' : 'status'}><MapPin size={22} /><span>{error || '正在展开美食地图…'}</span>{error && <button className="text-button" onClick={() => setRevision((value) => value + 1)}><RefreshCw size={16} />重试地图</button>}</div>}</div>;
}
