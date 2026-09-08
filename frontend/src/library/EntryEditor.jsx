import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Check, Star } from 'lucide-react';
import { request } from '../api';
import { useEntries } from './state';
import { Loading, Message, PageHeader, returnLabels } from './ui';

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function Editor({ initial, id }) {
  const navigate = useNavigate();
  const { refresh } = useEntries();
  const [form, setForm] = useState(initial);
  const [tags, setTags] = useState(initial.tags.join('，'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function field(key) { return { value: form[key] ?? '', onChange: (event) => setForm({ ...form, [key]: event.target.value }) }; }
  async function save(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    const body = { ...form, lat: form.lat === '' || form.lat == null ? null : Number(form.lat), lng: form.lng === '' || form.lng == null ? null : Number(form.lng), spend: form.spend === '' || form.spend === null ? null : Number(form.spend), tags: tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean) };
    try {
      const result = await request(id ? `/api/library/entries/${id}` : '/api/library/entries', { method: id ? 'PUT' : 'POST', body });
      await refresh(); navigate(`/?view=mine&entry=${result.id}`, { replace: true });
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <form className="entry-editor" onSubmit={save}>
    <div className="editor-main"><section className="form-section"><h2>餐厅</h2><label>餐厅名称<input required maxLength="120" placeholder="这次吃的是哪家？" {...field('restaurant_name')} /></label><div className="form-grid"><label>菜系<input maxLength="40" list="categories" {...field('category')} /><datalist id="categories">{['家常菜', '火锅', '烧烤', '日料', '西餐', '面食', '咖啡甜品', '其他'].map((name) => <option key={name} value={name} />)}</datalist></label><label>用餐日期<input required type="date" max={today()} {...field('visited_on')} /></label></div><label>地址<input maxLength="300" placeholder="可选，方便下次找到" {...field('address')} /></label></section>
      <section className="form-section"><h2>地图位置</h2><div className="form-grid"><label>餐厅纬度<input type="number" step="any" min="-90" max="90" {...field('lat')} /></label><label>餐厅经度<input type="number" step="any" min="-180" max="180" {...field('lng')} /></label></div><label className="check-label"><input type="checkbox" checked={form.is_public} onChange={(event) => setForm({ ...form, is_public: event.target.checked })} />公开到大家的美食地图</label><p className="privacy-note">公开后，任何人都能看到餐厅位置、你的称呼和这条体验。取消勾选可撤回公开；已分享的副本不受影响。</p></section>
      <section className="form-section"><h2>这次体验</h2><fieldset className="rating-field"><legend>整体评价</legend>{[1, 2, 3, 4, 5].map((rating) => <label key={rating} title={`${rating} 分`}><input type="radio" name="rating" value={rating} checked={form.rating === rating} onChange={() => setForm({ ...form, rating })} /><Star size={29} fill={rating <= form.rating ? 'currentColor' : 'none'} /><span className="sr-only">{rating} 分</span></label>)}<span className="rating-caption">{['', '不推荐', '有些失望', '中规中矩', '值得再去', '特别喜欢'][form.rating]}</span></fieldset>
        <label>体验记录<textarea required maxLength="5000" rows="8" placeholder="吃了什么，哪道值得点，还有什么想记住的？" {...field('content')} /></label><span className="character-count">{form.content.length} / 5000</span>
      </section></div>
    <aside className="editor-side"><section className="form-section"><h2>再记两笔</h2><label>人均实付（元）<input type="number" min="0" max="100000" step="0.01" placeholder="未记录" {...field('spend')} /></label><label>下次还来吗？<select {...field('would_return')}>{Object.entries(returnLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>标签<input value={tags} maxLength="210" placeholder="如：适合聊天，值得排队" onChange={(event) => setTags(event.target.value)} /></label><label className="check-label"><input type="checkbox" checked={form.favorite} onChange={(event) => setForm({ ...form, favorite: event.target.checked })} />加入特别喜欢</label></section><div className="editor-save"><Message error>{error}</Message><button className="button primary" disabled={busy}><Check size={17} />{busy ? '正在保存...' : '保存到个人库'}</button><Link className="button subtle" to="/">取消</Link><span className="privacy-note">默认仅自己可见</span></div></aside>
  </form>;
}

export default function EntryEditor() {
  const { entryId } = useParams();
  const { state } = useLocation();
  const { entries, loading } = useEntries();
  const entry = entryId ? entries.find((item) => item.id === entryId) : null;
  const defaults = { restaurant_name: '', restaurant_id: '', category: '其他', address: '', lat: null, lng: null, visited_on: today(), rating: 4, content: '', spend: null, tags: [], would_return: 'unsure', favorite: false, is_public: false };
  if (loading && entryId) return <Loading />;
  if (entryId && (!entry || entry.kind !== 'own')) return <><PageHeader title="无法编辑这条记录" back="/" /><Message error>记录不存在，或属于保留原文的导入体验。</Message></>;
  const place = state?.place;
  const initial = entry ? Object.fromEntries(Object.keys(defaults).map((key) => [key, entry[key]])) : { ...defaults, ...(place ? Object.fromEntries(['restaurant_name', 'restaurant_id', 'category', 'address', 'lat', 'lng'].map((key) => [key, place[key] ?? defaults[key]])) : {}) };
  return <><PageHeader title={entryId ? '编辑体验' : '记一餐'} back="/" /><Editor key={entryId || 'new'} initial={initial} id={entryId} /></>;
}
