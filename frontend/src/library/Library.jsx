import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Edit3, Heart, Plus, Search, Share2, Trash2, Utensils } from 'lucide-react';
import { request } from '../api';
import { useEntries } from './state';
import { Empty, IconButton, Loading, Message, PageHeader, Rating, returnLabels } from './ui';

export function EntryDetail({ entry, onDeleted }) {
  const { refresh } = useEntries();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function favorite() {
    setBusy(true); setError('');
    try { await request(`/api/library/entries/${entry.id}/favorite`, { method: 'PATCH', body: { favorite: !entry.favorite } }); await refresh(); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!window.confirm(entry.kind === 'own' ? '删除这条体验？包含它的分享码也会失效，朋友已导入的副本不受影响。' : '从你的个人库删除这条导入体验？原作者的记录不受影响。')) return;
    setBusy(true); setError('');
    try { await request(`/api/library/entries/${entry.id}`, { method: 'DELETE' }); await refresh(); onDeleted?.(); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <article className="entry-detail">
    <div className="detail-topline"><span className={`source-label ${entry.kind === 'own' ? '' : 'source-friend'}`}>{entry.kind === 'own' ? '亲身体验' : `来自 ${entry.author_name}`}</span><div className="icon-actions">
      <IconButton label={entry.favorite ? '取消喜欢' : '特别喜欢'} disabled={busy} onClick={favorite}><Heart size={18} fill={entry.favorite ? 'currentColor' : 'none'} /></IconButton>
      {entry.kind === 'own' && <><Link className="icon-button" title="编辑体验" aria-label="编辑体验" to={`/entries/${entry.id}/edit`}><Edit3 size={18} /></Link><Link className="icon-button" title="分享这条体验" aria-label="分享这条体验" to={`/shares/new?ids=${entry.id}`}><Share2 size={18} /></Link></>}
      <IconButton label="删除记录" disabled={busy} onClick={remove}><Trash2 size={18} /></IconButton>
    </div></div>
    <div className="restaurant-mark"><Utensils size={25} strokeWidth={1.4} /></div>
    <h2>{entry.restaurant_name}</h2><p className="detail-address">{entry.category}{entry.address && ` · ${entry.address}`}</p>
    <div className="detail-facts"><div><span>用餐日期</span><strong>{entry.visited_on}</strong></div><div><span>{entry.kind === 'own' ? '我的评价' : '作者评价'}</span><Rating value={entry.rating} /></div><div><span>人均实付</span><strong>{entry.spend === null ? '未记录' : `¥${entry.spend}`}</strong></div></div>
    <h3>{entry.kind === 'own' ? '这次体验' : '原作者的体验'}</h3><p className="experience-text">{entry.content}</p>
    <div className="entry-tags">{entry.tags.map((tag) => <span key={tag}>{tag}</span>)}<span className={`return-label return-${entry.would_return}`}>{returnLabels[entry.would_return]}</span></div>
    {entry.kind !== 'own' && <p className="provenance">{entry.author_name} 的分享 · {entry.source_title}</p>}
    <Message error>{error}</Message>
  </article>;
}

export default function Library() {
  const navigate = useNavigate();
  const { entries, loading, error, refresh } = useEntries();
  const [params, setParams] = useSearchParams();
  const source = params.get('source') || 'all';
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('recent');
  const [selecting, setSelecting] = useState(false);
  const [checked, setChecked] = useState([]);
  const filtered = useMemo(() => entries.filter((entry) => {
    const matchesSource = source === 'all' || (source === 'favorite' ? entry.favorite : entry.kind === source);
    return matchesSource && `${entry.restaurant_name} ${entry.content} ${entry.category} ${entry.address} ${entry.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase().trim());
  }).sort((first, second) => sort === 'rating' ? second.rating - first.rating : sort === 'spend' ? (first.spend ?? Infinity) - (second.spend ?? Infinity) : second.visited_on.localeCompare(first.visited_on) || second.updated_at - first.updated_at), [entries, source, query, sort]);
  const active = filtered.find((entry) => entry.id === params.get('entry')) || filtered[0];
  const selected = checked.filter((id) => entries.some((entry) => entry.id === id && entry.kind === 'own'));
  function toggle(id) { setChecked((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]); }
  function pick(entry) {
    if (window.matchMedia?.('(max-width: 620px)').matches) { navigate(`/entries/${entry.id}`); return; }
    const next = new URLSearchParams(params); next.set('entry', entry.id); setParams(next, { replace: true });
  }
  return <>
    <PageHeader title="个人库" subtitle={`${entries.length} 条体验 · ${entries.filter((entry) => entry.kind === 'own').length} 条亲身记录`}>
      <Link className="button subtle" to="/shares/import"><Share2 size={16} />导入分享码</Link><Link className="button primary" to="/entries/new"><Plus size={17} />记一餐</Link>
    </PageHeader>
    <div className="library-toolbar"><div className="search-field"><Search size={17} /><input aria-label="搜索个人库" placeholder="搜索餐厅、体验或标签" value={query} onChange={(event) => setQuery(event.target.value)} /></div><select aria-label="排序" value={sort} onChange={(event) => setSort(event.target.value)}><option value="recent">最近吃过</option><option value="rating">评分优先</option><option value="spend">人均从低到高</option></select><button className="button subtle" onClick={() => { setSelecting(!selecting); setChecked([]); }}>{selecting ? '取消选择' : '选择分享'}</button></div>
    <div className="library-tabs" role="group" aria-label="记录来源">{[['all', '全部'], ['own', '亲身体验'], ['imported', '朋友分享'], ['favorite', '特别喜欢']].map(([value, label]) => <button key={value} aria-pressed={source === value} onClick={() => { const next = new URLSearchParams(); if (value !== 'all') next.set('source', value); setParams(next); }}>{label}</button>)}</div>
    {selecting && <div className="selection-bar"><span>已选 {selected.length} 条亲身体验</span><button className="text-button" onClick={() => setChecked(filtered.filter((entry) => entry.kind === 'own').map((entry) => entry.id).slice(0, 100))}>选择当前结果</button>{selected.length > 0 && <Link className="button primary" to={`/shares/new?ids=${selected.join(',')}`}><Share2 size={15} />生成分享码</Link>}</div>}
    {error ? <><Message error>{error}</Message><button className="button" onClick={refresh}>重试</button></> : loading ? <Loading /> : !filtered.length ? <Empty title={entries.length ? '没有匹配的体验' : '还没有餐厅记录'} action={<Link className="button primary" to="/entries/new"><Plus size={17} />记下第一餐</Link>}>{entries.length ? '换个关键词或筛选条件。' : '从最近吃过的一家开始。'}</Empty> : <div className="library-split">
      <div className="entry-list" aria-label="餐厅体验列表">{filtered.map((entry) => <div className={`entry-row ${active?.id === entry.id ? 'is-selected' : ''}`} key={entry.id}>
        {selecting && <input className="entry-checkbox" type="checkbox" aria-label={`分享 ${entry.restaurant_name}`} disabled={entry.kind !== 'own' || (selected.length >= 100 && !selected.includes(entry.id))} checked={selected.includes(entry.id)} onChange={() => toggle(entry.id)} />}
        <button className="entry-select" aria-pressed={active?.id === entry.id} onClick={() => pick(entry)}><div className="entry-row-title"><strong>{entry.restaurant_name}</strong>{entry.favorite && <Heart size={14} fill="currentColor" />}</div><div className="entry-row-meta"><Rating value={entry.rating} /><span>{entry.visited_on}</span></div><p>{entry.content}</p><div className="entry-row-bottom"><span>{entry.kind === 'own' ? entry.category : `来自 ${entry.author_name}`}</span><span>{entry.spend === null ? '人均未记录' : `¥${entry.spend} / 人`}</span></div></button>
      </div>)}</div>
      <div className="detail-pane" key={active.id}><EntryDetail entry={active} /></div>
    </div>}
  </>;
}

export function EntryView() {
  const { entryId } = useParams();
  const { entries, loading, error, refresh } = useEntries();
  const navigate = useNavigate();
  const entry = entries.find((item) => item.id === entryId);
  if (loading) return <Loading />;
  return <><PageHeader title="体验详情" back="/" />{error ? <><Message error>{error}</Message><button className="button" onClick={refresh}>重试</button></> : entry ? <EntryDetail entry={entry} onDeleted={() => navigate('/')} /> : <Empty title="记录不存在" action={<Link className="button" to="/">返回个人库</Link>} />}</>;
}
