const mapParams = new URLSearchParams(window.location.search);
const mapSummary = document.getElementById("map-filter-summary");
const mapStatus = document.getElementById("map-status");
const mapSelection = document.getElementById("map-selection");
const mapRestaurantList = document.getElementById("map-restaurant-list");
const realMapNode = document.getElementById("real-map");
const mapFallbackNode = document.getElementById("map-fallback");
let currentRestaurants = [];
let activeRestaurantId = null;
let mapInstance = null;
let infoWindow = null;
let userMarker = null;
let restaurantMarkers = [];

function renderMapFilters() {
  const labels = [
    mapParams.get("category"),
    mapParams.get("budget"),
    mapParams.get("distance"),
    mapParams.get("scene"),
  ].filter(Boolean);

  mapSummary.innerHTML = labels
    .map((item) => `<span class="filter-pill">${item}</span>`)
    .join("");
}

function detailHref(restaurantId) {
  return `/restaurant-view?id=${restaurantId}&${mapParams.toString()}`;
}

function renderSelection(item) {
  mapSelection.innerHTML = `
    <div class="card-top">
      <div class="card-title-wrap">
        <h3>${item.name}</h3>
        <p class="card-meta">${item.travel_text} · 人均 ${item.avg_price} 元 · ${item.review_count} 条评论</p>
      </div>
      <div class="score-badge score-badge-soft">
        <span>最近风向</span>
        <strong style="font-size:1rem">${item.comment_tone}</strong>
      </div>
    </div>
    <div class="tag-row" style="margin-top:14px">
      <span class="filter-pill">${item.comment_tone}</span>
      ${item.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
      ${item.risk_flags.map((tag) => `<span class="risk">${tag}</span>`).join("")}
    </div>
    <p style="margin-top:14px"><strong>大家最近在说：</strong>${item.summary}</p>
    <div class="card-actions" style="margin-top:16px">
      <a class="secondary-button" href="${detailHref(item.restaurant_id)}">查看详情</a>
      <a class="secondary-button" href="/recommendations?${mapParams.toString()}">回到榜单</a>
    </div>
  `;
}

function renderRestaurantList(restaurants) {
  mapRestaurantList.innerHTML = restaurants
    .map(
      (item, index) => `
        <button class="map-list-item ${item.restaurant_id === activeRestaurantId ? "is-active" : ""}" data-id="${item.restaurant_id}">
          <div class="map-list-index">${index + 1}</div>
          <div class="map-list-copy">
            <strong>${item.name}</strong>
            <span>${item.travel_text} · ${item.review_count} 条评论 · ${item.comment_tone}</span>
          </div>
          <div class="map-list-score">${item.review_count}</div>
        </button>
      `
    )
    .join("");

  mapRestaurantList.querySelectorAll(".map-list-item").forEach((itemNode) => {
    itemNode.addEventListener("click", () => {
      setActiveRestaurant(itemNode.dataset.id);
    });
  });
}

function updateMapMarkerState() {
  if (!window.AMap || !restaurantMarkers.length) return;
  restaurantMarkers.forEach(({ marker, restaurant }) => {
    const isActive = restaurant.restaurant_id === activeRestaurantId;
    marker.setIcon(
      new window.AMap.Icon({
        size: new window.AMap.Size(isActive ? 34 : 28, isActive ? 34 : 28),
        image:
          isActive
            ? "https://webapi.amap.com/theme/v1.3/markers/n/mark_r.png"
            : "https://webapi.amap.com/theme/v1.3/markers/n/mark_b.png",
        imageSize: new window.AMap.Size(isActive ? 34 : 28, isActive ? 34 : 28),
      })
    );
    marker.setzIndex(isActive ? 140 : 120);
  });
}

function updateMapSelection(restaurant) {
  if (!window.AMap || !mapInstance || !infoWindow || !restaurant) return;

  infoWindow.setContent(`
    <div class="map-info-window">
      <strong>${restaurant.name}</strong>
      <p>${restaurant.travel_text} · 人均 ${restaurant.avg_price} 元 · ${restaurant.review_count} 条评论</p>
    </div>
  `);
  infoWindow.open(mapInstance, [restaurant.lng, restaurant.lat]);
  mapInstance.setCenter([restaurant.lng, restaurant.lat]);
}

function setActiveRestaurant(restaurantId) {
  activeRestaurantId = restaurantId;
  const target = currentRestaurants.find((item) => item.restaurant_id === restaurantId);
  if (!target) return;

  renderSelection(target);
  renderRestaurantList(currentRestaurants);
  updateMapMarkerState();
  updateMapSelection(target);
}

function showMapFallback(message) {
  mapFallbackNode.textContent = message;
  mapFallbackNode.classList.remove("hidden");
  realMapNode.classList.add("hidden");
}

function hideMapFallback() {
  mapFallbackNode.classList.add("hidden");
  realMapNode.classList.remove("hidden");
}

function loadAmapScript(config) {
  return new Promise((resolve, reject) => {
    if (window.AMap) {
      resolve(window.AMap);
      return;
    }

    if (config.amap_security_js_code) {
      window._AMapSecurityConfig = {
        securityJsCode: config.amap_security_js_code,
      };
    }

    const script = document.createElement("script");
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(config.amap_js_api_key)}`;
    script.async = true;
    script.onload = () => {
      if (window.AMap) {
        resolve(window.AMap);
        return;
      }
      reject(new Error("amap_not_loaded"));
    };
    script.onerror = () => reject(new Error("amap_script_failed"));
    document.head.appendChild(script);
  });
}

function renderRealMap(restaurants, payload, config) {
  if (!config.enabled || !config.amap_js_api_key) {
    showMapFallback("未配置高德 JS API Key，当前无法显示真实地图。");
    return;
  }

  loadAmapScript(config)
    .then((AMap) => {
      hideMapFallback();
      mapInstance = new AMap.Map("real-map", {
        viewMode: "2D",
        zoom: 15,
        center: [payload.location.lng, payload.location.lat],
        resizeEnable: true,
      });

      infoWindow = new AMap.InfoWindow({
        offset: new AMap.Pixel(0, -28),
      });

      userMarker = new AMap.Marker({
        position: [payload.location.lng, payload.location.lat],
        title: "你的位置",
        label: {
          content: "你",
          direction: "top",
        },
      });

      restaurantMarkers = restaurants.map((restaurant) => {
        const marker = new AMap.Marker({
          position: [restaurant.lng, restaurant.lat],
          title: restaurant.name,
          offset: new AMap.Pixel(-14, -14),
          zIndex: 120,
        });
        marker.on("click", () => {
          setActiveRestaurant(restaurant.restaurant_id);
        });
        return { marker, restaurant };
      });

      mapInstance.add([userMarker, ...restaurantMarkers.map((item) => item.marker)]);
      updateMapMarkerState();
      updateMapSelection(restaurants[0]);
    })
    .catch(() => {
      showMapFallback("真实地图加载失败，请检查高德 JS API Key 或安全密钥配置。");
    });
}

async function fetchMapRestaurants() {
  renderMapFilters();
  const payload = {
    location: {
      lat: Number(mapParams.get("lat") || 31.2304),
      lng: Number(mapParams.get("lng") || 121.4737),
    },
    category: mapParams.get("category") || "烧烤",
    budget: mapParams.get("budget") || "50以内",
    distance: mapParams.get("distance") || "步行10分钟内",
    scene: mapParams.get("scene") || "宿舍聚餐",
  };

  try {
    const [response, configResponse] = await Promise.all([
      fetch("/api/recommend/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
      fetch("/api/client-config/map"),
    ]);
    if (!response.ok) throw new Error("request_failed");
    if (!configResponse.ok) throw new Error("config_failed");
    const data = await response.json();
    const mapConfig = await configResponse.json();
    if (!data.list.length) {
      mapStatus.textContent = "没有可展示的餐厅位置。";
      mapSelection.textContent = "当前筛选条件下暂无店铺。";
      mapRestaurantList.innerHTML = "";
      showMapFallback("当前筛选条件下暂无可展示的餐厅坐标。");
      return;
    }
    currentRestaurants = [...data.list].sort(
      (a, b) => a.distance_meters - b.distance_meters || b.review_count - a.review_count
    );
    activeRestaurantId = currentRestaurants[0].restaurant_id;
    mapStatus.textContent = `已展示 ${currentRestaurants.length} 家店的位置和评论概况`;
    renderRestaurantList(currentRestaurants);
    renderSelection(currentRestaurants[0]);
    renderRealMap(currentRestaurants, payload, mapConfig);
  } catch (error) {
    mapStatus.textContent = "地图数据加载失败。";
    mapSelection.textContent = "请确认后端服务已启动，再返回重试。";
    mapRestaurantList.innerHTML = "";
    showMapFallback("真实地图或推荐接口加载失败，请检查服务与 Key 配置。");
  }
}

fetchMapRestaurants();
