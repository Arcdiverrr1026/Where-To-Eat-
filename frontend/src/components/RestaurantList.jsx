import { Heart } from "lucide-react";
import { priceLabel } from "../utils/format.js";

const RestaurantList = ({ items, favoriteIds, onFavorite, busy }) => {
  return (
    <div className="restaurant-list">
      {items.map((r) => (
        <article className="restaurant-row" key={r.id}>
          <div className="restaurant-main">
            <div className="row-top">
              <span className="category">{r.category || "餐饮"}</span>
              {r.distance !== undefined && (
                <span className="distance">
                  {r.distance < 1000
                    ? `${r.distance} m`
                    : `${(r.distance / 1000).toFixed(1)} km`}
                </span>
              )}
            </div>
            <h3>
              <a href={`#/restaurant/${r.id}`}>{r.name}</a>
            </h3>
            <p className="address">{r.address || "地图暂未提供地址"}</p>
            <div className="restaurant-meta">
              <strong>{priceLabel(r.price)}</strong>
              <span>
                {r.reviewCount
                  ? `本站 ${r.averageRating.toFixed(1)} 分 · ${r.reviewCount} 条评价`
                  : "暂无本站评价"}
              </span>
            </div>
            {r.reasons && (
              <div className="reasons">
                <span className="reason-label">推荐理由</span>
                <p>{r.reasons.join(" · ")}</p>
              </div>
            )}
          </div>
          <button
            className={`icon-button favorite-button ${favoriteIds.has(r.id) ? "is-favorite" : ""}`}
            aria-label={`${favoriteIds.has(r.id) ? "取消收藏" : "收藏"} ${r.name}`}
            aria-pressed={favoriteIds.has(r.id)}
            disabled={busy}
            onClick={() => onFavorite(r.id)}
          >
            <Heart
              size={20}
              fill={favoriteIds.has(r.id) ? "currentColor" : "none"}
              aria-hidden="true"
            />
          </button>
        </article>
      ))}
    </div>
  );
};

export default RestaurantList;
