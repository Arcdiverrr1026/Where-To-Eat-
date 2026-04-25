const params = new URLSearchParams(window.location.search);
const listContainer = document.getElementById("restaurant-list");
const statusLine = document.getElementById("list-status");
const dataSource = document.getElementById("data-source");
const filterSummary = document.getElementById("active-filters");
const sortTabs = document.querySelectorAll(".sort-tab");
const mapLink = document.getElementById("map-link");
const backToHomeLink = document.getElementById("back-to-home-link");

let restaurants = [];
let activeSort = "final_score";

function renderFilterSummary() {
  backToHomeLink.href = `/?${params.toString()}`;
  const labels = [
    params.get("category"),
    params.get("budget"),
    params.get("distance"),
    params.get("scene"),
  ].filter(Boolean);

  filterSummary.innerHTML = labels
    .map((item) => `<span class="filter-pill">${item}</span>`)
    .join("");
}

function sortRestaurants(items) {
  const sorted = [...items];
  if (activeSort === "avg_price" || activeSort === "distance_meters") {
    sorted.sort((a, b) => a[activeSort] - b[activeSort]);
    return sorted;
  }
  sorted.sort((a, b) => b.final_score - a.final_score);
  return sorted;
}

function renderList() {
  if (!restaurants.length) {
    listContainer.innerHTML = `
      <article class="restaurant-card empty-state">
        <h3>当前条件下没有找到评论信号更稳的店</h3>
        <p class="card-meta">可以返回上一页放宽预算或距离条件，或者导入更多评论后再看。</p>
      </article>
    `;
    return;
  }

  const items = sortRestaurants(restaurants);
  listContainer.innerHTML = items
    .map(
      (restaurant) => `
        <article class="restaurant-card">
          <div class="card-top">
            <div class="card-title-wrap">
              <h3>${restaurant.name}</h3>
              <p class="card-meta">${restaurant.distance_text} · 人均 ${restaurant.avg_price} 元 · 评论来源 ${restaurant.source}</p>
            </div>
            <div class="score-badge">
              <span>避雷推荐分</span>
              <strong>${restaurant.final_score}</strong>
            </div>
          </div>
          <div class="tag-row">
            ${restaurant.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
            ${restaurant.risk_flags.map((tag) => `<span class="risk">${tag}</span>`).join("")}
          </div>
          <div class="score-preview">
            ${scoreBar("综合避雷", restaurant.final_score)}
            ${scoreBar("预算友好", Math.max(100 - restaurant.avg_price, 30))}
            ${scoreBar("到达便利", Math.max(100 - Math.round(restaurant.distance_meters / 30), 25))}
          </div>
          <p><strong>近期判断：</strong>${restaurant.summary}</p>
          <div class="card-actions">
            <a class="secondary-button" href="/restaurant-view?id=${restaurant.restaurant_id}&${params.toString()}">看详细评价</a>
            <a class="secondary-button" href="/map-view?${params.toString()}">再看位置</a>
          </div>
        </article>
      `
    )
    .join("");
}

function scoreBar(label, value) {
  return `
    <div class="score-bar">
      <span>${label}</span>
      <div class="score-bar-track">
        <div class="score-bar-fill" style="width:${value}%"></div>
      </div>
      <strong>${value}</strong>
    </div>
  `;
}

function renderLoadingState() {
  listContainer.innerHTML = Array.from({ length: 3 })
    .map(
      () => `
        <article class="restaurant-card loading-card">
          <div class="skeleton skeleton-line short"></div>
          <div class="skeleton skeleton-line mid"></div>
          <div class="skeleton skeleton-line long"></div>
          <div class="skeleton skeleton-line long"></div>
        </article>
      `
    )
    .join("");
}

async function fetchRecommendations() {
  renderFilterSummary();
  renderLoadingState();
  mapLink.href = `/map-view?${params.toString()}`;

  const payload = {
    location: {
      lat: Number(params.get("lat") || 31.2304),
      lng: Number(params.get("lng") || 121.4737),
    },
    category: params.get("category") || "烧烤",
    budget: params.get("budget") || "50以内",
    distance: params.get("distance") || "步行10分钟内",
    scene: params.get("scene") || "宿舍聚餐",
  };

  try {
    const response = await fetch("/api/recommend/restaurants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error("request_failed");

    const data = await response.json();
    restaurants = data.list;
    statusLine.textContent = `共分析 ${data.total} 家店，默认按“同学真实反馈下更少踩雷”优先排序`;
    dataSource.textContent = restaurants[0] ? `当前店铺入口：${restaurants[0].source}` : "";
    renderList();
  } catch (error) {
    statusLine.textContent = "加载失败，请稍后重试。";
    listContainer.innerHTML = `
      <article class="restaurant-card empty-state">
        <h3>评价分析暂时不可用</h3>
        <p class="card-meta">请检查后端是否已启动，或稍后重新获取推荐。</p>
      </article>
    `;
  }
}

sortTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    sortTabs.forEach((item) => item.classList.remove("is-active"));
    tab.classList.add("is-active");
    activeSort = tab.dataset.sort;
    renderList();
  });
});

fetchRecommendations();
