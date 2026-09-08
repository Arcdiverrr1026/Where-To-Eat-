import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, BookOpen, ChevronDown, ChevronUp, Coffee, Compass, Globe2, Heart, Layers2, LocateFixed, LogOut, MapPin, Minus, Plus, Search, Share2, SlidersHorizontal, Soup, Sparkles, Users, X } from 'lucide-react';
import { request } from '../api';
import { wgs84ToGcj02 } from '../coordinates';
import { useAuth, useEntries } from '../library/state';
import { Brand, IconButton, Message, Rating } from '../library/ui';
import Auth from '../library/Auth';
import Library, { EntryDetail, EntryView } from '../library/Library';
import EntryEditor from '../library/EntryEditor';
import Shares, { CreateShare, ImportShare } from '../library/Shares';
import MapScene from './MapScene';

const modes = [['public', '大家的', Globe2], ['mine', '我的', Heart], ['friends', '朋友的', Users], ['fusion', '融合', Layers2]];
const titles = { public: '大家的美食地图', mine: '我的美食足迹', friends: '朋友的美食地图', fusion: '我们的美食拼图' };
const initialCenter = { lat: 31.2304, lng: 121.4737 };

function Protect({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  return user ? children : <Navigate to="/login" state={{ returnTo: location.pathname + location.search, place: location.state?.place }} replace />;
}

function Login() {
  const { user } = useAuth();
  const location = useLocation();
  return user ? <Navigate replace to={location.state?.returnTo || '/'} state={{ place: location.state?.place }} /> : <Auth />;
}

export default function MapWorkspace() {
  const { user, logout, error: authError, retry } = useAuth();
  const { entries, error: entriesError } = useEntries();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const requestedView = params.get('view');
  const view = modes.some(([value]) => value === requestedView) ? requestedView : 'public';
  const mapVisible = location.pathname === '/';
  const [center, setCenter] = useState(initialCenter);
  const movedCenter = useRef(initialCenter);
  const [moved, setMoved] = useState(false);
  const [command, setCommand] = useState(null);
  const [query, setQuery] = useState('');
  const [searchedQuery, setSearchedQuery] = useState('');
  const [category, setCategory] = useState('');
  const [radius, setRadius] = useState('3000');
  const [budget, setBudget] = useState('');
  const [filters, setFilters] = useState(false);
  const [community, setCommunity] = useState([]);
  const [places, setPlaces] = useState([]);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [communityError, setCommunityError] = useState('');
  const [reload, setReload] = useState(0);
  const [authors, setAuthors] = useState(null);
  const [showLayers, setShowLayers] = useState(false);
  const [includeMine, setIncludeMine] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const activeRequest = useRef(null);
  useEffect(() => {
    const controller = new AbortController();
    setCommunityError('');
    request('/api/library/community/entries', { signal: controller.signal }).then((data) => setCommunity(data.entries)).catch((failure) => { if (!controller.signal.aborted) setCommunityError(failure.message); });
    return () => controller.abort();
  }, [entries, location.pathname, reload]);
  const search = useCallback(async (coords, keyword = '', distance = '3000', maxPrice = '') => {
    if (!Number.isInteger(Number(distance)) || Number(distance) < 100 || Number(distance) > 50000) {
      setError('搜索距离请输入 100 至 50000 米的整数');
      return;
    }
    activeRequest.current?.abort();
    const controller = new AbortController(); activeRequest.current = controller;
    setBusy(true); setError(''); setMessage(''); setMoved(false);
    try {
      const data = await request('/api/library/places', { method: 'POST', signal: controller.signal, body: { ...coords, category: keyword.trim() || '餐厅', max_distance: Number(distance), max_price: maxPrice === '' ? null : Number(maxPrice) } });
      if (controller.signal.aborted) return;
      setPlaces(data.places); setMessage(data.message); setSearchedQuery(keyword); setCenter(coords);
    } catch (failure) { if (!controller.signal.aborted) setError(failure.message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }, []);
  useEffect(() => { search(initialCenter); return () => activeRequest.current?.abort(); }, [search]);
  useEffect(() => { document.title = `${mapVisible ? titles[view] : '美食足迹'} · Where To Eat`; }, [view, mapVisible]);
  const own = useMemo(() => entries.filter((entry) => entry.kind === 'own').map((entry) => ({ ...entry, key: `own-${entry.id}`, layer: 'mine' })), [entries]);
  const others = useMemo(() => {
    const imported = entries.filter((entry) => entry.kind === 'imported').map((entry) => ({ ...entry, key: `import-${entry.id}`, layer: 'friend' }));
    const importedOrigins = new Set(imported.map((entry) => entry.origin_id));
    const publicOthers = community.filter((entry) => entry.author_id !== user?.id && !importedOrigins.has(entry.id)).map((entry) => ({ ...entry, key: `public-${entry.id}`, layer: 'friend' }));
    return [...imported, ...publicOthers];
  }, [entries, community, user]);
  const availableAuthors = useMemo(() => [...new Map(others.map((entry) => [entry.author_id, { id: entry.author_id, name: entry.author_name }])).values()], [others]);
  const experiences = useMemo(() => {
    const data = view === 'public' ? community.map((entry) => ({ ...entry, key: `public-${entry.id}`, layer: 'public' })) : view === 'mine' ? own : view === 'friends' ? others.filter((entry) => authors === null || authors.includes(entry.author_id)) : [...(includeMine ? own : []), ...others.filter((entry) => authors?.includes(entry.author_id))];
    const term = searchedQuery.trim().toLowerCase();
    return data.filter((entry) => (!term || `${entry.restaurant_name} ${entry.category} ${entry.content} ${entry.tags.join(' ')}`.toLowerCase().includes(term)) && (budget === '' || entry.spend == null || entry.spend <= Number(budget)));
  }, [view, community, own, others, authors, includeMine, searchedQuery, budget]);
  const nearby = useMemo(() => view === 'public' ? places.map((place) => ({ ...place, key: `place-${place.restaurant_id}`, layer: 'place' })) : [], [places, view]);
  const points = useMemo(() => [...nearby, ...experiences], [nearby, experiences]);
  const detail = points.find((point) => point.key === selected) || (params.get('entry') ? own.find((entry) => entry.id === params.get('entry')) : null);
  const selectedPlaceReviews = detail ? experiences.filter((entry) => entry.restaurant_id ? entry.restaurant_id === detail.restaurant_id : entry.restaurant_name === detail.restaurant_name) : [];
  function pick(key) { setSelected(key); setExpanded(true); const point = points.find((item) => item.key === key); if (Number.isFinite(point?.lat) && Number.isFinite(point?.lng)) setCenter({ lat: point.lat, lng: point.lng }); }
  function switchView(value) {
    if (!user && (value === 'mine' || value === 'fusion')) { navigate('/login', { state: { returnTo: `/?view=${value}` } }); return; }
    navigate(`/?view=${value}`); setSelected(null); setExpanded(false); setShowLayers(value === 'fusion');
  }
  function submit(event) { event?.preventDefault(); setSelected(null); search(movedCenter.current, query.trim() || category, radius, budget); }
  function locate() {
    if (!navigator.geolocation) { setError('浏览器不支持定位'); return; }
    setLocating(true); setError('');
    navigator.geolocation.getCurrentPosition((position) => {
      const coords = wgs84ToGcj02(position.coords.longitude, position.coords.latitude);
      movedCenter.current = coords; search(coords, query.trim() || category, radius, budget); setLocating(false);
    }, () => { setLocating(false); setError('没有取得位置。可允许定位，或拖动地图后搜索这片区域。'); }, { timeout: 10000, maximumAge: 60000 });
  }
  async function signOut() { try { await logout(); navigate('/'); setSelected(null); } catch (failure) { setError(failure.message); } }
  const onMove = useCallback((coords) => { movedCenter.current = coords; setMoved(true); }, []);
  function record(place) { navigate('/entries/new', { state: { place } }); }
  const closeDetail = () => { setSelected(null); const next = new URLSearchParams(params); next.delete('entry'); setParams(next, { replace: true }); };
  return <div className="food-map-app">
    <svg className="liquid-filter-defs" aria-hidden="true"><defs><filter id="liquid-refraction" x="-20%" y="-30%" width="140%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="0.025 0.08" numOctaves="2" seed="7" result="noise" /><feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G" /></filter></defs></svg>
    <MapScene points={points} center={center} selected={detail?.key} onSelect={pick} onMove={onMove} command={command} />
    <header className="map-header"><div className="map-brand glass-surface"><Brand /></div><div className="map-header-actions">
      {mapVisible && moved && <button className="search-area glass-surface" disabled={busy} onClick={submit}><Search size={15} />搜索这片区域</button>}
      <nav className="map-account glass-surface" aria-label="账号和足迹"><Link to="/library" title="足迹手账" aria-label="足迹手账"><BookOpen size={20} /><span>足迹手账</span></Link><Link to="/shares" title="分享足迹" aria-label="分享足迹"><Share2 size={19} /><span>分享足迹</span></Link>{user ? <><span className="map-avatar" title={user.display_name}>{user.display_name.slice(0, 1)}</span><IconButton label="退出登录" onClick={signOut}><LogOut size={18} /></IconButton></> : <Link className="map-login" to="/login">登录 / 注册</Link>}</nav></div></header>
    {mapVisible && <>
      <section className="map-search glass-surface" aria-label="搜索餐厅"><form onSubmit={submit}><Search size={21} /><input aria-label="餐厅关键词或菜系" placeholder="搜一家店，或一种想吃的…" maxLength="40" value={query} onChange={(event) => setQuery(event.target.value)} /><IconButton label="筛选餐厅" onClick={() => setFilters(!filters)} aria-expanded={filters}><SlidersHorizontal size={19} /></IconButton><button className="search-submit" disabled={busy} aria-label="查找餐厅"><ArrowUpRight size={22} /></button></form>{filters && <div className="map-filters"><label>距离<select value={radius} onChange={(event) => setRadius(event.target.value)}><option value="1000">1 公里</option><option value="3000">3 公里</option><option value="5000">5 公里</option><option value="10000">10 公里</option></select></label><label>人均上限<input aria-label="最高人均预算" type="number" min="0" max="100000" placeholder="不限" value={budget} onChange={(event) => setBudget(event.target.value)} /></label><button className="button" onClick={submit}>应用</button></div>}</section>
      <div className="map-categories" role="group" aria-label="餐厅分类">{[['', '随便逛逛', Compass], ['咖啡', '咖啡时光', Coffee], ['火锅', '热乎一口', Soup]].map(([value, label, Icon]) => <button key={value} aria-pressed={category === value} onClick={() => { setCategory(value); setQuery(''); setSelected(null); search(movedCenter.current, value, radius, budget); }}><Icon size={16} />{label}</button>)}</div>
      <aside className={`explore-panel glass-surface ${expanded ? 'is-expanded' : ''}`} aria-label="美食地图内容"><button className="mobile-sheet-handle" aria-label={expanded ? '收起列表' : '展开列表'} onClick={() => setExpanded(!expanded)}>{expanded ? <ChevronDown size={19} /> : <ChevronUp size={19} />}</button>
        <div className="explore-scroll">
          {detail ? <><div className="explore-title"><button className="text-button" onClick={closeDetail}><ArrowLeft size={16} />返回地图列表</button><IconButton label="关闭详情" onClick={closeDetail}><X size={18} /></IconButton></div><div className={`restaurant-stamp stamp-${detail.layer}`}><MapPin size={26} /><span>{detail.layer === 'place' ? '发现一家店' : detail.layer === 'mine' ? '我的足迹' : '有人喜欢这里'}</span></div><h1 className="place-title">{detail.restaurant_name}</h1><p className="place-address">{detail.address || '地址未填写'}</p>
            {detail.kind ? <EntryDetail entry={detail} onDeleted={closeDetail} /> : <>{detail.rating && <div className="public-review"><div className="review-author"><span className="map-avatar">{detail.author_name.slice(0, 1)}</span><button onClick={() => { setAuthors([detail.author_id]); switchView('friends'); }}>{detail.author_name}<ArrowUpRight size={13} /></button><Rating value={detail.rating} /></div><time>{detail.visited_on}</time><p>{detail.content}</p><div className="entry-tags">{detail.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>{detail.spend != null && <p className="muted">人均实付 ¥{detail.spend}</p>}</div>}
              <button className="button primary write-review" onClick={() => record(detail)}><Plus size={17} />我也吃过，记一餐</button>{selectedPlaceReviews.filter((entry) => entry.key !== detail.key).map((entry) => <button className="community-snippet" key={entry.key} onClick={() => pick(entry.key)}><strong>{entry.author_name}</strong><Rating value={entry.rating} /><p>{entry.content}</p></button>)}</>}
          </> : <><div className="explore-title"><h1>{titles[view]}</h1><span className="title-sticker"><Sparkles size={24} /></span></div>
            <div className="explore-summary"><span>{experiences.length} 条体验{view === 'public' ? ' · 自愿公开' : ''}</span>{(view === 'friends' || view === 'fusion') && <button className="text-button" onClick={() => setShowLayers(!showLayers)}><Layers2 size={15} />选择足迹</button>}</div>
            {showLayers && <div className="map-layers"><h2>这张地图里有谁？</h2>{view === 'fusion' && <label className="check-label"><input type="checkbox" checked={includeMine} onChange={(event) => setIncludeMine(event.target.checked)} />我的足迹</label>}{availableAuthors.map((author) => <label className="check-label" key={author.id}><input type="checkbox" checked={authors === null ? view === 'friends' : authors.includes(author.id)} onChange={() => setAuthors((current) => { const chosen = current ?? (view === 'friends' ? availableAuthors.map((item) => item.id) : []); return chosen.includes(author.id) ? chosen.filter((id) => id !== author.id) : [...chosen, author.id]; })} />{author.name}</label>)}{!availableAuthors.length && <p className="muted">还没有可选的朋友足迹</p>}<Link className="text-button" to="/shares/import"><Share2 size={15} />导入朋友的分享码</Link></div>}
            <Message error>{communityError || (view !== 'public' && entriesError)}</Message>{communityError && <button className="text-button" onClick={() => setReload((value) => value + 1)}>重新加载点评</button>}
            {!experiences.length && <div className="map-empty"><div className="empty-stamp"><Heart size={24} /></div><h2>{view === 'public' ? '这里还在等第一口好评' : view === 'fusion' ? '把喜欢的足迹放在一起' : '还没有留下美食足迹'}</h2><Link to={view === 'friends' ? '/shares/import' : '/entries/new'}>{view === 'friends' ? '导入一份朋友的分享' : '记下我吃过的'}<ArrowUpRight size={15} /></Link></div>}
            <div className="map-records">{experiences.map((entry) => <button className="map-record" key={entry.key} onClick={() => pick(entry.key)}><div className={`record-icon record-${entry.layer}`}><MapPin size={21} /></div><div className="record-copy"><strong>{entry.restaurant_name}</strong><span><Rating value={entry.rating} />{entry.kind === 'own' ? '我' : entry.author_name}</span><p>{entry.content}</p>{entry.lat == null && <small>尚未标注位置</small>}</div><ArrowUpRight size={16} /></button>)}</div>
            {view === 'public' && <><div className="nearby-heading"><h2>附近，随便逛逛</h2><span>{busy ? '寻找中…' : `${places.length} 家`}</span></div><p className="data-source">高德地点资料 · 不代表用户点评</p>{nearby.map((place) => <button className="map-record nearby-record" key={place.key} onClick={() => pick(place.key)}><div className="record-icon record-place"><Soup size={21} /></div><div className="record-copy"><strong>{place.restaurant_name}</strong><span>{place.distance_meters} 米{place.avg_price != null ? ` · 参考人均 ¥${place.avg_price}` : ''}</span><p>{place.address}</p></div><Plus size={17} /></button>)}{!busy && !places.length && <p className="no-places">没有匹配的地点，可换个关键词或移动地图。</p>}</>}
          </>}
        </div>
      </aside>
      <div className="map-toolbar glass-surface"><IconButton label="放大地图" onClick={() => setCommand({ type: 'in', id: Date.now() })}><Plus size={21} /></IconButton><IconButton label="缩小地图" onClick={() => setCommand({ type: 'out', id: Date.now() })}><Minus size={21} /></IconButton><IconButton label="使用当前位置" disabled={locating} onClick={locate}><LocateFixed size={20} /></IconButton></div>
      <Link className="map-add" to="/entries/new" aria-label="记一餐"><Plus size={22} /><span>记一餐</span></Link>
      <div className="map-view-dock"><nav className="liquid-mode" aria-label="地图视图">{modes.map(([value, label, Icon]) => <button key={value} aria-pressed={view === value} onClick={() => switchView(value)}><Icon size={19} /><span>{label}</span></button>)}</nav></div>
    </>}
    {(error || message || authError) && <div className="map-notice glass-surface"><Message error={Boolean(error || authError)}>{error || authError || message}</Message>{authError && <button className="text-button" onClick={retry}>重新连接账号</button>}<IconButton label="关闭提示" onClick={() => { setError(''); setMessage(''); }}><X size={16} /></IconButton></div>}
    {!mapVisible && <section className="route-sheet glass-surface" aria-label="足迹操作"><Link className="close-sheet icon-button" to="/" title="回到地图" aria-label="回到地图"><X size={21} /></Link><div className="route-scroll"><Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/library" element={<Protect><Library /></Protect>} />
      <Route path="/entries/new" element={<Protect><EntryEditor /></Protect>} />
      <Route path="/entries/:entryId" element={<Protect><EntryView /></Protect>} />
      <Route path="/entries/:entryId/edit" element={<Protect><EntryEditor /></Protect>} />
      <Route path="/shares" element={<Protect><Shares /></Protect>} />
      <Route path="/shares/new" element={<Protect><CreateShare /></Protect>} />
      <Route path="/shares/import" element={<Protect><ImportShare /></Protect>} />
      {['/discover', '/recommendations', '/map-view', '/restaurant-view', '/admin'].map((path) => <Route key={path} path={path} element={<Navigate to="/" replace />} />)}
      <Route path="/review-import" element={<Navigate to="/shares/import" replace />} />
      <Route path="*" element={<div className="empty"><h1>没有找到这页</h1><Link to="/">回到地图</Link></div>} />
    </Routes></div></section>}
  </div>;
}
