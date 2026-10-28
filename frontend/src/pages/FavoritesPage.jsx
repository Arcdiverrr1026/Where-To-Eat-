import Loading from "../components/Loading.jsx";
import ErrorState from "../components/ErrorState.jsx";
import EmptyState from "../components/EmptyState.jsx";
import RestaurantList from "../components/RestaurantList.jsx";

const FavoritesPage = ({
  session,
  user,
  favorites,
  favoriteIds,
  onFavorite,
  busy,
}) => {
  let content;
  if (session.loading) content = <Loading />;
  else if (!user)
    content = (
      <EmptyState title="登录后查看收藏">
        <a className="primary" href="#/login?next=%2Ffavorites">
          登录演示账号
        </a>
      </EmptyState>
    );
  else if (favorites.loading) content = <Loading />;
  else if (favorites.error)
    content = <ErrorState message={favorites.error} retry={favorites.reload} />;
  else if (favorites.data?.items.length)
    content = (
      <section className="saved-list">
        <RestaurantList
          items={favorites.data.items}
          favoriteIds={favoriteIds}
          onFavorite={onFavorite}
          busy={busy}
        />
      </section>
    );
  else
    content = (
      <EmptyState title="暂无收藏">
        <p>在搜索结果或详情页点击收藏后，会显示在这里。</p>
        <a className="primary" href="#/">
          搜索附近餐厅
        </a>
      </EmptyState>
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>我的收藏</h1>
        </div>
      </div>
      {content}
    </>
  );
};

export default FavoritesPage;
