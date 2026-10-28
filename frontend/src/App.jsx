import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { logout as requestLogout } from "./services/session.js";
import {
  listFavorites,
  addFavorite,
  removeFavorite,
} from "./services/favorites.js";
import useResource from "./hooks/useResource.js";
import useRoute from "./hooks/useRoute.js";
import EmptyState from "./components/EmptyState.jsx";
import Loading from "./components/Loading.jsx";
import ErrorState from "./components/ErrorState.jsx";
import SearchPage from "./pages/SearchPage.jsx";
import DetailPage from "./pages/DetailPage.jsx";
import FavoritesPage from "./pages/FavoritesPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
const App = () => {
  const route = useRoute();
  const path = route.split("?")[0];
  const session = useResource("/session");
  const config = useResource("/config");
  const user = session.data?.user;
  const favorites = useResource(user ? `/favorites?user=${user.id}` : null);
  const favoriteIds = new Set(
    user ? favorites.data?.items.map((r) => r.id) || [] : [],
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [search, setSearch] = useState({
    location: null,
    result: null,
    loading: false,
    error: "",
    scope: null,
    filters: null,
  });
  const main = useRef(null);
  const firstRoute = useRef(true);
  useEffect(() => {
    if (firstRoute.current) {
      firstRoute.current = false;
      return;
    }
    main.current?.focus();
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [route]);
  const notify = (message, type = "success") => {
    setNotice({ message, type });
  };
  const onFavorite = async (id) => {
    if (!user) {
      window.location.hash = `/login?next=${encodeURIComponent(route)}`;
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const exists = favoriteIds.has(id);
      await (exists ? removeFavorite(id) : addFavorite(id));
      favorites.setData(await listFavorites());
      notify(exists ? "已取消收藏" : "已加入收藏");
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setBusy(false);
    }
  };
  const logout = async () => {
    setBusy(true);
    try {
      await requestLogout();
      session.setData({ user: null });
      window.location.hash = "/";
      notify("已退出登录");
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setBusy(false);
    }
  };
  const detail = path.match(/^\/restaurant\/(\d+)$/);
  let content;
  if (path === "/")
    content = (
      <SearchPage
        config={config}
        search={search}
        setSearch={setSearch}
        favoriteIds={favoriteIds}
        onFavorite={onFavorite}
        busy={busy}
      />
    );
  else if (path === "/login")
    content = user ? (
      <EmptyState title={`已登录为 ${user.username}`}>
        <a href="#/" className="primary">
          返回搜索
        </a>
      </EmptyState>
    ) : (
      <LoginPage
        onLogin={(user) => session.setData({ user })}
        notify={notify}
        next={new URLSearchParams(route.split("?")[1]).get("next") || "/"}
      />
    );
  else if (detail)
    content = (
      <DetailPage
        key={`${detail[1]}-${user?.id || "guest"}`}
        id={detail[1]}
        user={user}
        favoriteIds={favoriteIds}
        onFavorite={onFavorite}
        busy={busy}
        notify={notify}
      />
    );
  else if (path === "/favorites")
    content = (
      <FavoritesPage
        session={session}
        user={user}
        favorites={favorites}
        favoriteIds={favoriteIds}
        onFavorite={onFavorite}
        busy={busy}
      />
    );
  else if (path === "/admin")
    content = session.loading ? (
      <Loading />
    ) : user?.role === "admin" ? (
      <AdminPage notify={notify} />
    ) : (
      <EmptyState title="需要管理员权限">
        <a className="primary" href="#/login?next=%2Fadmin">
          登录
        </a>
      </EmptyState>
    );
  else
    content = (
      <EmptyState title="页面不存在">
        <a className="primary" href="#/">
          返回搜索
        </a>
      </EmptyState>
    );
  return (
    <>
      <a
        href="#main"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          main.current?.focus();
        }}
      >
        跳到主要内容
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#/" aria-label="Where To Eat 首页">
            Where To Eat<span className="brand-zh">今天去哪吃</span>
          </a>
          <nav aria-label="主导航">
            <a href="#/" aria-current={path === "/" ? "page" : undefined}>
              发现
            </a>
            <a
              href="#/favorites"
              aria-current={path === "/favorites" ? "page" : undefined}
            >
              收藏
            </a>
            {user?.role === "admin" && (
              <a
                href="#/admin"
                aria-current={path === "/admin" ? "page" : undefined}
              >
                管理
              </a>
            )}
          </nav>
          <div className="account">
            {session.loading ? (
              <span className="account-name">连接中…</span>
            ) : user ? (
              <>
                <span className="account-name">{user.username}</span>
                <button
                  className="header-button"
                  disabled={busy}
                  onClick={logout}
                >
                  退出
                </button>
              </>
            ) : (
              <a className="header-login" href="#/login">
                登录
              </a>
            )}
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} ref={main} className="app-main">
        {session.error && (
          <ErrorState
            message={`登录状态加载失败：${session.error}`}
            retry={session.reload}
          />
        )}
        <div className="announcement" aria-live="polite">
          {notice && (
            <div
              className={`notice ${notice.type === "error" ? "error" : "success"}`}
            >
              <p>{notice.message}</p>
              <button
                className="icon-button"
                aria-label="关闭提示"
                onClick={() => setNotice(null)}
              >
                <X size={17} />
              </button>
            </div>
          )}
        </div>
        {content}
      </main>
      <footer className="site-footer">
        <span>Where To Eat</span>
        <span>React · Express · PostgreSQL · 数据来自高德地图</span>
      </footer>
    </>
  );
};

export default App;
