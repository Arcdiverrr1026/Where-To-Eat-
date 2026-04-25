const restaurantsNode = document.getElementById("admin-restaurants");
const reviewsNode = document.getElementById("admin-reviews");
const cachedRestaurantsNode = document.getElementById("admin-cached-restaurants");
const analysisCachesNode = document.getElementById("admin-analysis-caches");

function renderRestaurantList(items) {
  if (!items.length) {
    restaurantsNode.innerHTML = `<article class="restaurant-card empty-state"><p class="card-meta">还没有任何店铺积累到真实评价。</p></article>`;
    return;
  }

  restaurantsNode.innerHTML = items
    .map(
      (item) => `
        <article class="restaurant-card">
          <div class="card-top">
            <div class="card-title-wrap">
              <h3>${item.restaurant_id}</h3>
              <p class="card-meta">最近收录时间：${item.last_imported_at || "未知"}</p>
            </div>
            <div class="score-badge score-badge-soft">
              <span>评价数</span>
              <strong>${item.review_count}</strong>
            </div>
          </div>
          <div class="card-actions">
            <a class="secondary-button" href="/restaurant-view?id=${item.restaurant_id}">查看详情</a>
            <a class="secondary-button" href="/review-import?id=${item.restaurant_id}">补录历史评论</a>
          </div>
        </article>
      `
    )
    .join("");
}

function renderReviewList(items) {
  if (!items.length) {
    reviewsNode.innerHTML = `<article class="restaurant-card empty-state"><p class="card-meta">还没有最近新增的真实评价。</p></article>`;
    return;
  }

  reviewsNode.innerHTML = items
    .map(
      (item) => `
        <article class="restaurant-card">
          <div class="card-top">
            <div class="card-title-wrap">
              <h3>${item.restaurant_id}</h3>
              <p class="card-meta">评分 ${item.rating} · ${item.created_at || "未知时间"}</p>
            </div>
            <div class="score-badge">
              <span>距今天</span>
              <strong>${item.days_ago}</strong>
            </div>
          </div>
          <p>${item.content}</p>
        </article>
      `
    )
    .join("");
}

function renderCachedRestaurantList(items) {
  if (!items.length) {
    cachedRestaurantsNode.innerHTML = `<article class="restaurant-card empty-state"><p class="card-meta">还没有缓存任何餐厅基础信息。</p></article>`;
    return;
  }

  cachedRestaurantsNode.innerHTML = items
    .map(
      (item) => `
        <article class="restaurant-card">
          <div class="card-top">
            <div class="card-title-wrap">
              <h3>${item.name}</h3>
              <p class="card-meta">${item.category} · ${item.distance_meters}m · ${item.source}</p>
            </div>
            <div class="score-badge score-badge-soft">
              <span>人均</span>
              <strong>${item.avg_price}</strong>
            </div>
          </div>
          <p class="card-meta">${item.address}</p>
          <p class="card-meta">更新时间：${item.updated_at || "未知"} · 营业时间：${item.business_hours}</p>
          <div class="card-actions">
            <a class="secondary-button" href="/restaurant-view?id=${item.restaurant_id}">查看详情</a>
            <a class="secondary-button" href="/review-import?id=${item.restaurant_id}">导入评论</a>
          </div>
        </article>
      `
    )
    .join("");
}

function renderAnalysisCacheList(items) {
  if (!items.length) {
    analysisCachesNode.innerHTML = `<article class="restaurant-card empty-state"><p class="card-meta">还没有生成任何口碑分析结果。</p></article>`;
    return;
  }

  analysisCachesNode.innerHTML = items
    .map((item) => {
      const tags = item.tags.length
        ? item.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")
        : `<span class="card-meta">暂无标签</span>`;
      const risks = item.risk_flags.length
        ? item.risk_flags.map((risk) => `<span class="risk">${risk}</span>`).join("")
        : `<span class="card-meta">暂无风险标记</span>`;

      return `
        <article class="restaurant-card">
          <div class="card-top">
            <div class="card-title-wrap">
              <h3>${item.restaurant_name}</h3>
              <p class="card-meta">${item.restaurant_id}${item.restaurant_category ? ` · ${item.restaurant_category}` : ""}</p>
            </div>
            <div class="score-badge">
              <span>口碑分</span>
              <strong>${item.final_score}</strong>
            </div>
          </div>
          <p class="card-meta">评价来源：${item.review_source} · 评价数：${item.review_count} · 更新时间：${item.updated_at || "未知"}</p>
          <div class="tag-row">${tags}</div>
          <div class="tag-row">${risks}</div>
          <div class="card-actions">
            <a class="secondary-button" href="/restaurant-view?id=${item.restaurant_id}">查看详情</a>
            <a class="secondary-button" href="/review-import?id=${item.restaurant_id}">补录历史评论</a>
          </div>
        </article>
      `;
    })
    .join("");
}

async function fetchDashboard() {
  restaurantsNode.innerHTML = `<article class="restaurant-card loading-card"><div class="skeleton skeleton-line short"></div><div class="skeleton skeleton-line long"></div></article>`;
  reviewsNode.innerHTML = `<article class="restaurant-card loading-card"><div class="skeleton skeleton-line short"></div><div class="skeleton skeleton-line long"></div></article>`;
  cachedRestaurantsNode.innerHTML = `<article class="restaurant-card loading-card"><div class="skeleton skeleton-line short"></div><div class="skeleton skeleton-line long"></div></article>`;
  analysisCachesNode.innerHTML = `<article class="restaurant-card loading-card"><div class="skeleton skeleton-line short"></div><div class="skeleton skeleton-line long"></div></article>`;

  try {
    const response = await fetch("/api/admin/dashboard");
    if (!response.ok) throw new Error("request_failed");
    const data = await response.json();
    renderRestaurantList(data.imported_restaurants);
    renderReviewList(data.recent_reviews);
    renderCachedRestaurantList(data.cached_restaurants);
    renderAnalysisCacheList(data.analysis_caches);
  } catch (error) {
    restaurantsNode.innerHTML = `<article class="restaurant-card empty-state"><p class="risk">后台数据加载失败。</p></article>`;
    reviewsNode.innerHTML = `<article class="restaurant-card empty-state"><p class="risk">后台数据加载失败。</p></article>`;
    cachedRestaurantsNode.innerHTML = `<article class="restaurant-card empty-state"><p class="risk">后台数据加载失败。</p></article>`;
    analysisCachesNode.innerHTML = `<article class="restaurant-card empty-state"><p class="risk">后台数据加载失败。</p></article>`;
  }
}

fetchDashboard();
