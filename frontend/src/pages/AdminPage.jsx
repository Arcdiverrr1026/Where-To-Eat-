import { useState } from "react";
import { updateRestaurant, removeReview } from "../services/admin.js";
import useResource from "../hooks/useResource.js";
import { dateLabel, priceLabel } from "../utils/format.js";
import Loading from "../components/Loading.jsx";
import ErrorState from "../components/ErrorState.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Pagination from "../components/Pagination.jsx";
const EditRestaurant = ({ restaurant: r, onSaved, notify }) => {
  const [form, setForm] = useState({
    name: r.name,
    address: r.address,
    price: r.price ?? "",
    hidden: r.hidden,
  });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await updateRestaurant(r.id, {
        ...form,
        price: form.price === "" ? null : Number(form.price),
      });
      onSaved();
      notify("餐厅信息已保存");
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="admin-edit">
      <summary>编辑信息</summary>
      <form onSubmit={submit}>
        <label>
          店名
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            maxLength={150}
          />
        </label>
        <label>
          地址
          <input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            required
            maxLength={300}
          />
        </label>
        <label>
          人均价格（元，可留空）
          <input
            type="number"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            min="0"
            max="10000"
            step="0.01"
          />
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={form.hidden}
            onChange={(e) => setForm({ ...form, hidden: e.target.checked })}
          />
          在发现和收藏中隐藏这家餐厅
        </label>
        <button className="primary" disabled={busy}>
          {busy ? "保存中…" : "保存修改"}
        </button>
      </form>
    </details>
  );
};
const AdminPage = ({ notify }) => {
  const [tab, setTab] = useState("restaurants");
  const [page, setPage] = useState(1);
  const [removing, setRemoving] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const resource = useResource(`/admin/${tab}?page=${page}`);
  const remove = async (id) => {
    if (confirmation !== id) {
      setConfirmation(id);
      return;
    }
    setRemoving(id);
    try {
      await removeReview(id);
      setConfirmation(null);
      resource.reload();
      notify("评价已移除");
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setRemoving(null);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>内容管理</h1>
          <p>管理已缓存的餐厅数据与用户评价。</p>
        </div>
      </div>
      <div className="tabs" aria-label="管理分类">
        {[
          ["restaurants", "餐厅信息"],
          ["reviews", "本站评价"],
        ].map(([value, label]) => (
          <button
            aria-pressed={tab === value}
            className={tab === value ? "active" : ""}
            key={value}
            onClick={() => {
              setTab(value);
              setPage(1);
              setConfirmation(null);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <section className="admin-content">
        {resource.loading ? (
          <Loading />
        ) : resource.error ? (
          <ErrorState message={resource.error} retry={resource.reload} />
        ) : resource.data?.items.length ? (
          <>
            {resource.data.items.map((item) =>
              tab === "restaurants" ? (
                <article className="admin-row" key={item.id}>
                  <div className="admin-row-heading">
                    <h2>{item.name}</h2>
                    <span
                      className={`state-label ${item.hidden ? "muted" : ""}`}
                    >
                      {item.hidden ? "已隐藏" : "可见"}
                    </span>
                  </div>
                  <p>{item.address}</p>
                  <p className="hint">
                    {priceLabel(item.price)} · 高德 ID：{item.sourceId}
                  </p>
                  <EditRestaurant
                    key={`${item.id}-${item.name}-${item.price}-${item.hidden}`}
                    restaurant={item}
                    onSaved={resource.reload}
                    notify={notify}
                  />
                </article>
              ) : (
                <article className="admin-row" key={item.id}>
                  <div className="admin-row-heading">
                    <h2>{item.restaurantName}</h2>
                    <span>{item.rating} / 5</span>
                  </div>
                  <p className="review-content">{item.content}</p>
                  <div className="admin-review-bottom">
                    <span className="hint">
                      {item.username} · {dateLabel(item.createdAt)}
                    </span>
                    <button
                      className="text-button danger"
                      disabled={removing !== null}
                      onClick={() => remove(item.id)}
                    >
                      {removing === item.id
                        ? "移除中…"
                        : confirmation === item.id
                          ? "确认移除此评价"
                          : "移除评价"}
                    </button>
                  </div>
                </article>
              ),
            )}
            <Pagination {...resource.data} onChange={setPage} />
          </>
        ) : (
          <EmptyState
            title={
              tab === "restaurants" ? "还没有缓存餐厅" : "暂时没有本站评价"
            }
          >
            <p>
              {tab === "restaurants"
                ? "搜索过的餐厅会缓存到这里。"
                : "用户发表评价后会显示在这里。"}
            </p>
          </EmptyState>
        )}
      </section>
    </>
  );
};

export default AdminPage;
