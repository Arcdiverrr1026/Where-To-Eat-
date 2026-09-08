import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { request } from '../api';
import { useAuth } from './state';
import { Brand, IconButton, Message } from './ui';

export default function Auth() {
  const { setUser } = useAuth();
  const [register, setRegister] = useState(false);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    const payload = { username: form.get('username').trim(), password: form.get('password') };
    if (register) payload.display_name = form.get('display_name').trim();
    try { setUser(await request(`/api/library/auth/${register ? 'register' : 'login'}`, { method: 'POST', body: payload })); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <div className="auth-page"><Brand /><main className="auth-form-wrap">
    <div className="auth-title"><LockKeyhole size={24} /><h1>{register ? '建立你的个人库' : '登录个人库'}</h1></div>
    <div className="segmented" role="group" aria-label="账号操作"><button aria-pressed={!register} onClick={() => { setRegister(false); setError(''); }}>登录</button><button aria-pressed={register} onClick={() => { setRegister(true); setError(''); }}>注册</button></div>
    <form onSubmit={submit} className="form-stack">
      {register && <label>称呼<input name="display_name" autoComplete="nickname" placeholder="朋友看到的名字" maxLength="40" required /></label>}
      <label>账号<input name="username" autoComplete="username" placeholder="字母、数字或下划线" minLength="3" maxLength="32" pattern="[a-zA-Z0-9_\-]+" required /></label>
      <label>密码<span className="password-field"><input name="password" type={visible ? 'text' : 'password'} autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 10 : 1} maxLength="128" placeholder={register ? '至少 10 位' : '输入密码'} required /><IconButton label={visible ? '隐藏密码' : '显示密码'} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</IconButton></span></label>
      <Message error>{error}</Message><button className="button primary" disabled={busy}>{busy ? '请稍候...' : register ? '创建个人库' : '登录'}<ArrowRight size={17} /></button>
    </form>
  </main><footer className="auth-footer">只记录自己的体验，只分享给想分享的人。</footer></div>;
}
