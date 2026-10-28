import { useRef, useState } from "react";
import { MapPin, Search } from "lucide-react";
import { findLocation, searchRestaurants } from "../services/restaurants.js";
import { wgs84ToGcj02 } from "../services/coordinates.js";
import RestaurantList from "../components/RestaurantList.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Loading from "../components/Loading.jsx";
import Pagination from "../components/Pagination.jsx";
import ErrorState from "../components/ErrorState.jsx";
const SearchPage = ({
  config,
  search,
  setSearch,
  favoriteIds,
  onFavorite,
  busy,
}) => {
  const [address, setAddress] = useState("");
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationError, setLocationError] = useState("");
  const locationRequest = useRef(0);
  const searchRequest = useRef(0);
  const [filters, setFilters] = useState(
    search.filters || { keyword: "", radius: "1500", budget: "" },
  );
  const [coordinatesOpen, setCoordinatesOpen] = useState(false);
  const [coords, setCoords] = useState({ lng: "", lat: "" });
  const updateLocation = (location) =>
    setSearch((s) => ({
      ...s,
      location,
      result: null,
      error: "",
      scope: null,
    }));
  const locateAddress = async (event) => {
    event.preventDefault();
    const request = ++locationRequest.current;
    setLocationBusy(true);
    setLocationError("");
    try {
      const data = await findLocation(address);
      if (request === locationRequest.current) updateLocation(data.location);
    } catch (error) {
      if (request === locationRequest.current) setLocationError(error.message);
    } finally {
      if (request === locationRequest.current) setLocationBusy(false);
    }
  };
  const locateBrowser = () => {
    if (!navigator.geolocation) {
      setLocationError("浏览器不支持定位，请输入地点");
      return;
    }
    const request = ++locationRequest.current;
    setLocationBusy(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (request !== locationRequest.current) return;
        const location = wgs84ToGcj02(
          position.coords.longitude,
          position.coords.latitude,
        );
        updateLocation({ ...location, label: "当前位置" });
        setLocationBusy(false);
      },
      () => {
        if (request !== locationRequest.current) return;
        setLocationError("未能获取定位，请允许浏览器定位或输入地点");
        setLocationBusy(false);
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  };
  const doSearch = async (event, page = 1) => {
    event?.preventDefault();
    if (!search.location) {
      setLocationError("请先选择位置");
      return;
    }
    const request = ++searchRequest.current;
    const applied = page === 1 ? filters : search.filters;
    setSearch((s) => ({ ...s, loading: true, error: "", filters: applied }));
    try {
      const result = await searchRestaurants({
        location: search.location,
        filters: applied,
        page,
      });
      if (request === searchRequest.current)
        setSearch((s) => ({
          ...s,
          result,
          loading: false,
          scope: { ...applied, label: search.location.label },
        }));
    } catch (error) {
      if (request === searchRequest.current)
        setSearch((s) => ({
          ...s,
          result: null,
          loading: false,
          error: error.message,
        }));
    }
  };
  const unavailable = config.data && !config.data.mapConfigured;
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>今天，吃点啥？</h1>
          <p>2233吃吃吃</p>
        </div>
        <span className="source-note">
          <span className="status-dot" />
          高德地图数据 · 本站评价
        </span>
      </div>
      {config.error && (
        <ErrorState message={config.error} retry={config.reload} />
      )}
      {unavailable && (
        <div className="notice warning" role="status">
          <div>
            <strong>地图服务尚未配置</strong>
            <p>未配置地图服务，暂时无法搜索，请联系维护者。</p>
          </div>
          <button className="text-button" onClick={config.reload}>
            重新检查
          </button>
        </div>
      )}
      <div className="discover-layout">
        <aside className="filters" aria-label="就餐筛选">
          <div className="section-title">
            <h2>筛选条件</h2>
          </div>
          <form onSubmit={locateAddress} className="location-form">
            <label htmlFor="address">位置</label>
            <div className="input-action">
              <input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="输入地址或地标"
                maxLength={100}
                minLength={2}
                required
              />
              <button
                type="submit"
                aria-label="查找地点"
                disabled={locationBusy || search.loading || unavailable}
              >
                <Search size={18} />
              </button>
            </div>
          </form>
          <button
            className="location-button"
            onClick={locateBrowser}
            disabled={locationBusy || search.loading}
          >
            {locationBusy ? "正在获取位置…" : "使用我的位置"}
          </button>
          {search.location && (
            <p className="selected-location">
              <MapPin size={15} aria-hidden="true" />
              {search.location.label}
            </p>
          )}
          {locationError && (
            <p className="field-error" role="alert">
              {locationError}
            </p>
          )}
          <button
            className="text-button coordinate-toggle"
            aria-expanded={coordinatesOpen}
            onClick={() => setCoordinatesOpen((v) => !v)}
          >
            手动输入坐标
          </button>
          {coordinatesOpen && (
            <form
              className="coordinates"
              onSubmit={(e) => {
                e.preventDefault();
                locationRequest.current++;
                setLocationBusy(false);
                setLocationError("");
                updateLocation({
                  lng: Number(coords.lng),
                  lat: Number(coords.lat),
                  label: "手动选择的位置",
                });
                setCoordinatesOpen(false);
              }}
            >
              <p className="hint">使用高德 GCJ-02 坐标</p>
              <label>
                经度
                <input
                  type="number"
                  step="any"
                  min="-180"
                  max="180"
                  required
                  value={coords.lng}
                  onChange={(e) =>
                    setCoords({ ...coords, lng: e.target.value })
                  }
                />
              </label>
              <label>
                纬度
                <input
                  type="number"
                  step="any"
                  min="-90"
                  max="90"
                  required
                  value={coords.lat}
                  onChange={(e) =>
                    setCoords({ ...coords, lat: e.target.value })
                  }
                />
              </label>
              <button className="secondary" disabled={search.loading}>
                使用此位置
              </button>
            </form>
          )}
          <form onSubmit={doSearch} className="filter-form">
            <label htmlFor="keyword">
              关键词
              <input
                id="keyword"
                value={filters.keyword}
                maxLength={30}
                onChange={(e) =>
                  setFilters({ ...filters, keyword: e.target.value })
                }
                placeholder="如 火锅、面食"
              />
            </label>
            <label htmlFor="budget">
              每人预算
              <select
                id="budget"
                value={filters.budget}
                onChange={(e) =>
                  setFilters({ ...filters, budget: e.target.value })
                }
              >
                <option value="">不限预算</option>
                {[30, 50, 80, 120, 200].map((v) => (
                  <option value={v} key={v}>
                    {v} 元以内
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="radius">
              搜索范围
              <select
                id="radius"
                value={filters.radius}
                onChange={(e) =>
                  setFilters({ ...filters, radius: e.target.value })
                }
              >
                <option value="500">附近 500 米</option>
                <option value="1500">附近 1.5 公里</option>
                <option value="3000">附近 3 公里</option>
                <option value="5000">附近 5 公里</option>
              </select>
            </label>
            <button
              className="primary search-button"
              disabled={
                search.loading || locationBusy || unavailable || config.loading
              }
            >
              {search.loading ? "搜索中…" : "搜索"}
            </button>
          </form>
        </aside>
        <section
          className="results"
          aria-label="餐厅推荐"
          aria-busy={search.loading}
        >
          <div className="results-heading">
            <h2>{search.result ? "搜索结果" : "餐厅列表"}</h2>
            <span>
              {search.result
                ? `${search.result.total} 家符合条件`
                : "请先选择位置"}
            </span>
          </div>
          {search.scope && !search.loading && (
            <p className="scope">
              {search.scope.label} · {Number(search.scope.radius) / 1000} 公里内
              · {search.scope.keyword || "不限口味"} ·{" "}
              {search.scope.budget
                ? `${search.scope.budget} 元以内`
                : "不限预算"}
            </p>
          )}
          {search.loading ? (
            <Loading label="正在搜索…" />
          ) : search.error ? (
            <ErrorState message={search.error} retry={() => doSearch(null)} />
          ) : !search.result ? (
            <EmptyState title="请选择位置">
              <p>输入地址或使用当前位置后，即可搜索。</p>
            </EmptyState>
          ) : search.result.items.length ? (
            <>
              <RestaurantList
                items={search.result.items}
                favoriteIds={favoriteIds}
                onFavorite={onFavorite}
                busy={busy}
              />
              <Pagination
                {...search.result}
                onChange={(page) => doSearch(null, page)}
              />
              <p className="result-footnote">
                本次从地图最近的最多 25 家候选中筛选 · 距离为直线距离
                <br />
                距离得分最高 80，本站评价满 3 条后参与排序（最高 20）。
              </p>
            </>
          ) : (
            <EmptyState title="没有符合条件的餐厅">
              <p>
                可扩大范围、提高预算或更换关键词。
                <br />
                设置预算后，价格未知的餐厅不会显示。
              </p>
              <button
                className="secondary"
                onClick={() => {
                  setFilters({ keyword: "", radius: "3000", budget: "" });
                }}
              >
                放宽筛选条件
              </button>
            </EmptyState>
          )}
        </section>
      </div>
    </>
  );
};

export default SearchPage;
