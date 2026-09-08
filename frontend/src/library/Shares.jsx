import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDownToLine, Check, Copy, Link2, Plus, Share2, X } from 'lucide-react';
import { request } from '../api';
import { useEntries } from './state';
import { Empty, IconButton, Loading, Message, PageHeader, Rating, Timestamp } from './ui';

function ShareCreated({ share }) {
  const [message, setMessage] = useState('');
  async function copy() {
    try { await navigator.clipboard.writeText(share.code); setMessage('分享码已复制'); }
    catch { setMessage('无法访问剪贴板，可选中分享码复制'); }
  }
  return <section className="share-created"><span className="success-icon"><Check size={24} /></span><h2>分享码已生成</h2><p>{share.title} · {share.count} 条体验 · <Timestamp value={share.expires_at} /> 到期</p><div className="share-code"><input aria-label="新生成的分享码" readOnly value={share.code} onFocus={(event) => event.target.select()} /><IconButton label="复制分享码" onClick={copy}><Copy size={19} /></IconButton></div><Message>{message}</Message><p className="privacy-note">分享码只在此显示一次，请妥善保留。持码者可读取并导入这些记录。</p><Link className="button" to="/shares">返回分享管理</Link></section>;
}

export function CreateShare() {
  const { entries, loading, error: entriesError } = useEntries();
  const [params] = useSearchParams();
  const own = entries.filter((entry) => entry.kind === 'own');
  const [selected, setSelected] = useState(() => (params.get('ids') || '').split(',').filter(Boolean));
  const [title, setTitle] = useState('值得分享的餐厅');
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const valid = selected.filter((id) => own.some((entry) => entry.id === id));
  async function create(event) {
    event.preventDefault();
    if (busy || !valid.length) return;
    setBusy(true); setError('');
    try { setResult(await request('/api/library/shares', { method: 'POST', body: { title, entry_ids: valid, expires_in_days: days } })); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <><PageHeader title="创建分享" subtitle="只分享你选中的亲身体验" back="/shares" />
    {result ? <ShareCreated share={result} /> : loading ? <Loading /> : entriesError ? <Message error>{entriesError}</Message> : !own.length ? <Empty title="还没有可分享的亲身体验" action={<Link className="button primary" to="/entries/new"><Plus size={16} />记一餐</Link>} /> : <form className="share-builder" onSubmit={create}>
      <section><h2>选择体验 <span className="count">{valid.length} / 100</span></h2><div className="share-picker">{own.map((entry) => <label className="share-pick" key={entry.id}><input type="checkbox" checked={valid.includes(entry.id)} disabled={valid.length >= 100 && !valid.includes(entry.id)} onChange={() => setSelected((current) => current.includes(entry.id) ? current.filter((id) => id !== entry.id) : [...current, entry.id])} /><span><strong>{entry.restaurant_name}</strong><small>{entry.visited_on} · {entry.category}</small></span><Rating value={entry.rating} /></label>)}</div></section>
      <aside className="share-settings form-stack"><h2>分享设置</h2><label>分享名称<input required maxLength="80" value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>有效期<select value={days} onChange={(event) => setDays(Number(event.target.value))}><option value="1">1 天</option><option value="7">7 天</option><option value="30">30 天</option></select></label><p className="privacy-note">将分享餐厅资料、体验原文、评分、消费、用餐日期和你的称呼。不会分享账号或其他记录。</p><p className="privacy-note">分享的是当前副本。撤销后无法继续导入，但不会删除朋友已经导入的副本。</p><Message error>{error}</Message><button className="button primary" disabled={busy || !valid.length}><Share2 size={17} />{busy ? '正在生成...' : `生成分享码（${valid.length}）`}</button></aside>
    </form>}
  </>;
}

export function ImportShare() {
  const { refresh } = useEntries();
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewCode, setPreviewCode] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function check(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setResult(null); setPreview(null);
    try { setPreview(await request('/api/library/share-preview', { method: 'POST', body: { code: code.trim() } })); setPreviewCode(code.trim()); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  async function importEntries() {
    if (busy || !preview) return;
    setBusy(true); setError('');
    try {
      setResult(await request('/api/library/share-import', { method: 'POST', body: { code: previewCode } }));
      setPreview(null); await refresh();
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <><PageHeader title="导入朋友的体验" back="/shares" />
    <form className="code-import-form" onSubmit={check}><label htmlFor="share-code">分享码</label><div className="inline-form"><input id="share-code" autoComplete="off" autoCapitalize="none" spellCheck="false" placeholder="WTE-..." value={code} minLength="10" maxLength="80" required onChange={(event) => { setCode(event.target.value); setPreview(null); setResult(null); setError(''); }} /><button className="button primary" disabled={busy}>{busy && !preview ? '正在查看...' : '预览分享'}</button></div></form>
    <Message error>{error}</Message>
    {result && <div className="import-success"><Check size={23} /><h2>已导入 {result.imported_count} 条体验</h2><p>{result.skipped_count ? `跳过 ${result.skipped_count} 条已有记录，未覆盖原有内容。` : '来源和原作者的体验已保留。'}</p><Link className="button primary" to="/?view=friends">查看朋友的体验</Link></div>}
    {preview && <section className="share-preview"><div className="preview-heading"><div><h2>{preview.title}</h2><p>{preview.entries.length} 条体验 · <Timestamp value={preview.expires_at} /> 到期</p></div><button className="button primary" disabled={busy || preview.is_owner || preview.entries.every((entry) => entry.already_imported)} onClick={importEntries}><ArrowDownToLine size={17} />{preview.is_owner ? '这些是你的记录' : preview.entries.every((entry) => entry.already_imported) ? '已全部在库中' : busy ? '正在导入...' : '导入个人库'}</button></div>
      <div className="preview-entries">{preview.entries.map((entry) => <article className="preview-entry" key={entry.id}><div className="preview-entry-top"><h3>{entry.restaurant_name}</h3><Rating value={entry.rating} /></div><p className="muted">{entry.author_name} · {entry.visited_on}{entry.spend !== null && ` · 人均 ¥${entry.spend}`}{entry.already_imported && ' · 已在库中'}</p><p className="experience-text">{entry.content}</p><p className="muted">{entry.address}</p></article>)}</div>
    </section>}
  </>;
}

export default function Shares() {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    request('/api/library/shares', { signal: controller.signal }).then((result) => { if (!controller.signal.aborted) setShares(result.shares); })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  async function revoke(share) {
    if (!window.confirm(`撤销「${share.title}」？此分享码将立即失效，朋友已导入的副本不受影响。`)) return;
    setBusy(share.id); setError('');
    try { await request(`/api/library/shares/${share.id}`, { method: 'DELETE' }); setRevision((value) => value + 1); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(null); }
  }
  return <><PageHeader title="私下分享" subtitle="由你决定，哪些体验给谁看"><Link className="button subtle" to="/shares/import"><ArrowDownToLine size={17} />导入分享码</Link><Link className="button primary" to="/shares/new"><Plus size={17} />创建分享</Link></PageHeader>
    <Message error>{error}</Message>{error && <button className="button" onClick={() => setRevision((value) => value + 1)}>重试</button>}
    {loading ? <Loading /> : !shares.length ? <Empty title="还没有发出的分享" action={<Link className="button primary" to="/shares/new"><Share2 size={17} />创建第一份分享</Link>}>只包含你主动选中的体验。</Empty> : <div className="share-list">{shares.map((share) => {
      const status = share.revoked_at ? '已撤销' : share.expires_at <= Date.now() / 1000 ? '已过期' : '有效';
      return <article className="share-row" key={share.id}><div className="share-row-icon"><Link2 size={22} /></div><div className="share-row-copy"><h2>{share.title}</h2><p>{share.count} 条体验 · {share.import_count} 人导入 · 尾号 {share.code_hint}</p><small><Timestamp value={share.expires_at} /> 到期</small></div><span className={`share-status ${status === '有效' ? 'active' : ''}`}>{status}</span>{status === '有效' && <button className="button subtle danger-text" disabled={busy !== null} onClick={() => revoke(share)}><X size={16} />{busy === share.id ? '撤销中...' : '撤销'}</button>}</article>;
    })}</div>}
  </>;
}
