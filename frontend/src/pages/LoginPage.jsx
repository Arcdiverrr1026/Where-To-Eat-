import { useState } from "react";
import { login } from "../services/session.js";

const LoginPage = ({ onLogin, notify, next }) => {
  const [username, setUsername] = useState("demo");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await login(username, password);
      onLogin(data.user);
      window.location.hash =
        next.startsWith("/") && !next.startsWith("//") ? next : "/";
      notify("登录成功");
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="login-panel">
      <h1>登录</h1>
      <form onSubmit={submit}>
        <label htmlFor="username">
          用户名
          <input
            id="username"
            autoComplete="username"
            required
            maxLength={40}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label htmlFor="password">
          密码
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? "登录中…" : "登录"}
        </button>
      </form>
      <div className="login-note">
        <strong>当前仅提供演示账号</strong>
        <p>
          请向维护者获取账号信息。使用同一账号的人会共享收藏与评价；暂不开放注册。
        </p>
      </div>
      <a className="text-button" href="#/">
        返回搜索
      </a>
    </section>
  );
};

export default LoginPage;
