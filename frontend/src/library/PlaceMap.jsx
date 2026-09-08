import { useEffect, useRef, useState } from 'react';
import { request } from '../api';
import { Message } from './ui';

let sdkPromise;
export function loadSdk(config) {
  if (window.AMap) return Promise.resolve(window.AMap);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    if (config.amap_security_js_code) window._AMapSecurityConfig = { securityJsCode: config.amap_security_js_code };
    const script = document.createElement('script');
    const timer = setTimeout(fail, 15000);
    function fail() { clearTimeout(timer); script.remove(); sdkPromise = null; reject(new Error('地图加载失败，请稍后重试')); }
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(config.amap_js_api_key)}`;
    script.async = true;
    script.onload = () => { clearTimeout(timer); if (window.AMap) resolve(window.AMap); else fail(); };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return sdkPromise;
}

export default function PlaceMap({ places, center, selected, onSelect }) {
  const container = useRef(null);
  const instance = useRef(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    setError(''); setReady(false);
    async function initialize() {
      try {
        const config = await request('/api/client-config/map', { signal: controller.signal });
        if (!config.enabled || !config.amap_js_api_key) throw new Error('地图密钥尚未配置');
        const AMap = await loadSdk(config);
        if (disposed) return;
        const map = new AMap.Map(container.current, { zoom: 14, viewMode: '2D', center: [center.lng, center.lat], resizeEnable: true });
        const markers = places.filter((place) => place.lat != null && place.lng != null).map((place) => {
          const marker = new AMap.Marker({ position: [place.lng, place.lat], title: place.restaurant_name });
          marker.on('click', () => onSelect(place.restaurant_id));
          return { marker, place };
        });
        const userMarker = new AMap.Marker({ position: [center.lng, center.lat], title: '搜索位置' });
        map.add([userMarker, ...markers.map(({ marker }) => marker)]);
        instance.current = { map, markers, AMap };
        setReady(true);
      } catch (failure) { if (!disposed) setError(failure.message); }
    }
    initialize();
    return () => { disposed = true; controller.abort(); instance.current?.map.destroy(); instance.current = null; };
  }, [places, center.lat, center.lng, onSelect, revision]);
  useEffect(() => {
    if (!ready || !instance.current || !selected) return;
    const { map, markers, AMap } = instance.current;
    if (selected.lat != null && selected.lng != null) map.setCenter([selected.lng, selected.lat]);
    markers.forEach(({ marker, place }) => {
      const active = place.restaurant_id === selected.restaurant_id;
      marker.setIcon(new AMap.Icon({ size: new AMap.Size(28, 34), imageSize: new AMap.Size(28, 34), image: `https://webapi.amap.com/theme/v1.3/markers/n/mark_${active ? 'r' : 'b'}.png` }));
      marker.setzIndex(active ? 140 : 120);
    });
  }, [ready, selected]);
  return <div className="place-map-wrap"><div className="place-map" ref={container} aria-label="附近餐厅地图" />{error ? <div className="map-feedback"><Message error>{error}</Message><button className="button" onClick={() => setRevision((value) => value + 1)}>重试地图</button></div> : !ready && <div className="map-feedback" role="status">正在加载地图...</div>}</div>;
}
