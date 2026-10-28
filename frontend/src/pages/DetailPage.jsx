import { useState } from "react";
import { Heart } from "lucide-react";
import { saveReview, deleteReview } from "../services/restaurants.js";
import useResource from "../hooks/useResource.js";
import { priceLabel, dateLabel, mapLink } from "../utils/format.js";
import Loading from "../components/Loading.jsx";
import ErrorState from "../components/ErrorState.jsx";
const ReviewForm = ({ mine, onSave, busy }) => {
  const [rating, setRating] = useState(mine?.rating || 5);
  const [content, setContent] = useState(mine?.content || "");
  return (
    <form
      className="review-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ rating: Number(rating), content });
      }}
    >
      <label htmlFor="rating">
        评分
        <select
          id="rating"
          value={rating}
          onChange={(e) => setRating(e.target.value)}
        >
          {[5, 4, 3, 2, 1].map((n) => (
            <option value={n} key={n}>
              {n} 分
            </option>
          ))}
        </select>
      </label>
      <label htmlFor="review-content">
        评价内容
        <textarea
          id="review-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          minLength={5}
          maxLength={500}
          rows={4}
          required
          placeholder="至少 5 个字"
        />
      </label>
      <div className="form-bottom">
        <span className="hint">
          {content.length} / 500 · 每个账号每家餐厅一条评价
        </span>
        <button className="primary" disabled={busy}>
          {busy ? "正在保存…" : mine ? "更新评价" : "发布评价"}
        </button>
      </div>
    </form>
  );
};
const DetailPage = ({ id, user, favoriteIds, onFavorite, busy, notify }) => {
  const resource = useResource(`/restaurants/${id}`);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (resource.loading) return <Loading />;
  if (resource.error)
    return (
      <>
        <a href="#/" className="back-link">
          ← 返回发现
        </a>
        <ErrorState message={resource.error} retry={resource.reload} />
      </>
    );
  if (!resource.data) return null;
  const { restaurant: r, reviews, ownReview } = resource.data;
  const mine = ownReview || reviews.find((v) => v.userId === user?.id);
  const save = async (body) => {
    setSaving(true);
    try {
      await saveReview(id, body);
      resource.reload();
      notify("评价已保存");
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSaving(true);
    try {
      await deleteReview(id);
      resource.reload();
      setConfirmDelete(false);
      notify("你的评价已删除");
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="detail-page">
      <a href="#/" className="back-link">
        ← 返回发现
      </a>
      <section className="detail-header">
        <p className="category">{r.category || "餐饮"}</p>
        <div className="detail-title">
          <h1>{r.name}</h1>
          <button
            className={`secondary ${favoriteIds.has(r.id) ? "is-favorite" : ""}`}
            aria-pressed={favoriteIds.has(r.id)}
            disabled={busy}
            onClick={() => onFavorite(r.id)}
          >
            <Heart
              size={17}
              fill={favoriteIds.has(r.id) ? "currentColor" : "none"}
              aria-hidden="true"
            />
            {favoriteIds.has(r.id) ? "已收藏" : "收藏餐厅"}
          </button>
        </div>
        <p className="detail-address">{r.address || "地址暂无"}</p>
        <div className="detail-facts">
          <strong>{priceLabel(r.price)}</strong>
          <span>
            {r.reviewCount
              ? `本站 ${r.averageRating.toFixed(1)} 分 · ${r.reviewCount} 条评价`
              : "暂无本站评价"}
          </span>
          <a href={mapLink(r)} target="_blank" rel="noreferrer">
            在高德地图查看 ↗
          </a>
        </div>
      </section>
      <div className="detail-layout">
        <section>
          <div className="section-bar">
            <h2>本站用餐评价</h2>
            <span>{r.reviewCount} 条</span>
          </div>
          <p className="hint">
            由本站账号发布，与地图平台评分独立。当前为共享演示账号，不代表独立用户数量。
          </p>
          {reviews.length === 0 ? (
            <div className="review-empty">
              <h3>暂无评价</h3>
            </div>
          ) : (
            <div className="review-list">
              {reviews.map((review) => (
                <article className="review" key={review.id}>
                  <div className="review-top">
                    <strong>
                      {review.username}
                      {review.userId === user?.id ? "（当前账号）" : ""}
                    </strong>
                    <span className="rating">{review.rating} / 5</span>
                  </div>
                  <p>{review.content}</p>
                  <time dateTime={review.createdAt}>
                    {dateLabel(review.createdAt)}
                    {review.updatedAt !== review.createdAt ? " · 已编辑" : ""}
                  </time>
                </article>
              ))}
              {r.reviewCount > reviews.length && (
                <p className="hint">展示最近 100 条评价。</p>
              )}
            </div>
          )}
          <div className="write-review">
            <div className="section-bar">
              <h2>{mine ? "管理我的评价" : "发表评价"}</h2>
              {mine && (
                <button
                  className="text-button danger"
                  disabled={saving}
                  onClick={remove}
                >
                  {confirmDelete ? "确认删除评价" : "删除我的评价"}
                </button>
              )}
            </div>
            {user ? (
              <ReviewForm
                key={`${user.id}-${mine?.updatedAt || "new"}`}
                mine={mine}
                onSave={save}
                busy={saving}
              />
            ) : (
              <p>
                登录后可发表评价。
                <a
                  href={`#/login?next=${encodeURIComponent(`/restaurant/${id}`)}`}
                >
                  去登录
                </a>
              </p>
            )}
          </div>
        </section>
        <aside className="store-info">
          <h2>店铺信息</h2>
          <p>
            <span>
              <strong>营业时间</strong>
              {r.hours || "地图暂无提供，请向商家确认"}
            </span>
          </p>
          <p>
            <span>
              <strong>联系电话</strong>
              {r.phone || "地图暂无提供"}
            </span>
          </p>
          <p className="hint">
            基础信息来自高德地图，价格和营业时间仅供参考。最后同步：
            {dateLabel(r.updatedAt)}。
          </p>
          <p className="hint">
            本站不抓取其他平台评价，也不会根据菜系推断价格。
          </p>
        </aside>
      </div>
    </div>
  );
};

export default DetailPage;
