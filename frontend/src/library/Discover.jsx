import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LocateFixed, MapPin, Plus, Search } from 'lucide-react';
import { request, readSession, writeSession } from '../api';
import { wgs84ToGcj02 } from '../coordinates';
import { Empty, Loading, Message, PageHeader } from './ui';
import PlaceMap from './PlaceMap';

export default function Discover() {
  const [location, setLocation] = useState(() => {
    try { return JSON.parse(readSession('wte_place_location', 'null')) || { lat: 31.2304, lng: 121.4737 }; }
    catch { return { lat: 31.2304, lng: 121.4737 }; }
  });
  const [center, setCenter] = useState(location);
  const [category, setCategory] = useState('');
  const [distance, setDistance] = useState(3000);
  const [budget, setBudget] = useState('');
  const [places, setPlaces] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const selected = places?.find((place) => place.restaurant_id === selectedId) || places?.[0];
  function locate() {
    setError('');
    if (!navigator.geolocation) { setError('此浏览器不支持定位，可手动设置坐标'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition((position) => {
      const coords = wgs84ToGcj02(position.coords.longitude, position.coords.latitude);
      setLocation(coords); writeSession('wte_place_location', JSON.stringify(coords));
      setLocating(false); setMessage('已取得当前位置');
    }, () => { setLocating(false); setError('未能获取位置，可重试或手动设置坐标'); }, { timeout: 10000, maximumAge: 60000 });
  }
  async function search(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    const coords = { lat: Number(location.lat), lng: Number(location.lng) };
    try {
      const result = await request('/api/library/places', { method: 'POST', body: { ...coords, category: category.trim() || '餐厅', max_distance: Number(distance), max_price: budget === '' ? null : Number(budget) } });
      setPlaces(result.places); setCenter(coords); setMessage(result.message); setSelectedId(null);
      writeSession('wte_place_location', JSON.stringify(coords));
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <><PageHeader title="附近餐厅" subtitle="找到地点，再记下自己的体验"><Link className="button subtle" to="/entries/new"><Plus size={17} />手动记录</Link></PageHeader>
    <form className="discover-form" onSubmit={search}><div className="discover-search"><div className="search-field"><Search size={17} /><input aria-label="餐厅关键词或菜系" maxLength="40" placeholder="想吃什么？不填就看附近餐厅" value={category} onChange={(event) => setCategory(event.target.value)} /></div><select aria-label="搜索距离" value={distance} onChange={(event) => setDistance(event.target.value)}><option value="1000">1 公里内</option><option value="3000">3 公里内</option><option value="5000">5 公里内</option></select><input className="budget-filter" aria-label="最高人均预算" type="number" min="0" max="100000" value={budget} placeholder="人均上限" onChange={(event) => setBudget(event.target.value)} /><button className="button primary" disabled={busy || locating}><Search size={17} />{busy ? '正在查找...' : '查找餐厅'}</button></div>
      <div className="location-controls"><button className="text-button" type="button" disabled={locating} onClick={locate}><LocateFixed size={16} />{locating ? '正在定位...' : '使用当前位置'}</button><details><summary>搜索坐标</summary><div className="form-grid"><label>纬度<input type="number" min="-90" max="90" step="any" required value={location.lat} onChange={(event) => setLocation({ ...location, lat: event.target.value })} /></label><label>经度<input type="number" min="-180" max="180" step="any" required value={location.lng} onChange={(event) => setLocation({ ...location, lng: event.target.value })} /></label></div></details></div>
    </form><Message error>{error}</Message><Message>{message}</Message>
    {busy ? <Loading /> : places === null ? <Empty title="这一餐，想吃什么？" /> : !places.length ? <Empty title="没有找到匹配的餐厅" action={<Link className="button" to="/entries/new">手动记录餐厅</Link>} /> : <div className="discover-results"><div className="place-results"><h2>{places.length} 家餐厅</h2>{places.map((place) => <article className={`place-row ${selected?.restaurant_id === place.restaurant_id ? 'is-selected' : ''}`} key={place.restaurant_id}><button className="place-select" onClick={() => setSelectedId(place.restaurant_id)} aria-pressed={selected?.restaurant_id === place.restaurant_id}><strong>{place.restaurant_name}</strong><span>{place.category} · {place.distance_meters} 米{place.avg_price != null && ` · 参考人均 ¥${place.avg_price}`}</span><small><MapPin size={13} />{place.address}</small></button><Link className="button subtle" to="/entries/new" state={{ place }}><Plus size={15} />记一餐</Link></article>)}</div><div className="map-column"><PlaceMap places={places} center={center} selected={selected} onSelect={setSelectedId} /><span className="map-attribution">地点资料来自高德地图，不代表用餐评价</span></div></div>}
  </>;
}
