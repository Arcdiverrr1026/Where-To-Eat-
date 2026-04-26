const params = new URLSearchParams(window.location.search);
const listContainer = document.getElementById("restaurant-list");
const statusLine = document.getElementById("list-status");
const dataSource = document.getElementById("data-source");
const filterSummary = document.getElementById("active-filters");
const sortTabs = document.querySelectorAll(".sort-tab");
const mapLink = document.getElementById("map-link");
const backToHomeLink = document.getElementById("back-to-home-link");

let restaurants = [];
let activeSort = "review_count";

const TONE_CLASS = {
  "大家挺推荐": "tag",
  "最近讨论不少": "tag",
  "评价还在积累": "filter-pill",
  "吐槽偏多": "risk",
  "还没人留言": "filter-pill",
};

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
  if (activeSort === "review_count") {
    sorted.sort((a, b) => {
      if (b.review_count !== a.review_count) return b.review_count - a.review_count;
      if (a.comment_tone !== b.comment_tone) {
        const tonePriority = {
          "大家挺推荐": 3,
          "最近讨论不少": 2,
          "评价还在积累": 1,
          "还没人留言": 0,
          "吐槽偏多": -1,
        };
        return (
          (tonePriority[b.comment_tone] || 0) - (tonePriority[a.comment_tone] || 0)
        );
      }
      return a.distance_meters - b.distance_meters;
    });
    return sorted;
  }
  return sorted;
}

function tonePill(label) {
  return `<span class="${TONE_CLASS[label] || "filter-pill"}">${label}</span>`;
}

function renderList() {
  if (!restaurants.length) {
    listContainer.innerHTML = `
      <article class="restaurant-card empty-state">
        <h3>当前条件下还没有可参考的店铺评论</h3>
        <p class="card-meta">可以返回上一页放宽预算或距离条件，或者先去某家店下面补几条评论。</p>
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
              <p class="card-meta">${restaurant.travel_text} · ${restaurant.price_text} · ${restaurant.review_count} 条评论</p>
            </div>
            <div class="score-badge score-badge-soft">
              <span>最近风向</span>
              <strong style="font-size:1rem">${restaurant.comment_tone}</strong>
            </div>
          </div>
          <div class="tag-row">
            <span class="filter-pill">${restaurant.scene_match}</span>
            ${tonePill(restaurant.comment_tone)}
          </div>
          <div class="tag-row">
            ${restaurant.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
            ${restaurant.risk_flags.map((tag) => `<span class="risk">${tag}</span>`).join("")}
          </div>
          <p><strong>大家最近在说：</strong>${restaurant.summary}</p>
          <p class="card-meta">店铺来源：${restaurant.source} · ${restaurant.price_source}</p>
          <div class="card-actions">
            <a class="secondary-button" href="/restaurant-view?id=${restaurant.restaurant_id}&${params.toString()}">看详细评价</a>
            <a class="secondary-button" href="/map-view?${params.toString()}">再看位置</a>
          </div>
        </article>
      `
    )
    .join("");
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
    statusLine.textContent = `共找到 ${data.total} 家店，默认按“评论数量更多、最近更有讨论”排序`;
    dataSource.textContent = restaurants[0] ? `当前店铺入口：${restaurants[0].source}` : "";
    renderList();
  } catch (error) {
    statusLine.textContent = "加载失败，请稍后重试。";
    listContainer.innerHTML = `
      <article class="restaurant-card empty-state">
        <h3>评论列表暂时不可用</h3>
        <p class="card-meta">请检查后端是否已启动，或稍后重新获取附近店铺。</p>
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
