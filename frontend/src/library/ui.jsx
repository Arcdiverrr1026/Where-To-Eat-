import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Star } from 'lucide-react';
import brand from '../../assets/icons/miniprogram-avatar.png';

export function Brand() {
  return <Link to="/" className="brand"><img src={brand} alt="" width="38" height="38" /><span><strong>Where To Eat</strong><small>把好吃的，留在地图上</small></span></Link>;
}

export function IconButton({ label, children, ...props }) {
  return <button type="button" className="icon-button" title={label} aria-label={label} {...props}>{children}</button>;
}

export function Message({ children, error = false }) {
  if (!children) return null;
  return <p className={`message ${error ? 'message-error' : ''}`} role={error ? 'alert' : 'status'}>{children}</p>;
}

export function Empty({ title, children, action }) {
  return <div className="empty"><BookOpen size={36} strokeWidth={1.4} /><h2>{title}</h2>{children && <p>{children}</p>}{action}</div>;
}

export function Loading() {
  return <div className="loading-rows" role="status" aria-label="正在加载">{[1, 2, 3].map((index) => <div className="loading-row" key={index} />)}</div>;
}

export function PageHeader({ title, subtitle, back, children }) {
  return <header className="page-heading"><div>{back && <Link className="back-link" to={back}><ArrowLeft size={16} />返回</Link>}<h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div><div className="heading-actions">{children}</div></header>;
}

export function Rating({ value }) {
  return <span className="rating" aria-label={`${value} 分，满分 5 分`}>{[1, 2, 3, 4, 5].map((score) => <Star key={score} size={14} fill={score <= value ? 'currentColor' : 'none'} className={score <= value ? '' : 'star-empty'} />)}</span>;
}

export function Timestamp({ value }) {
  return <time dateTime={new Date(value * 1000).toISOString()}>{new Date(value * 1000).toLocaleDateString('zh-CN')}</time>;
}

export const returnLabels = { yes: '还会再去', no: '不会再去', unsure: '再想想' };
