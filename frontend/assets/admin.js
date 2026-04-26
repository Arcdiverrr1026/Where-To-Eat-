const restaurantsNode = document.getElementById("admin-restaurants");
const reviewsNode = document.getElementById("admin-reviews");
const cachedRestaurantsNode = document.getElementById("admin-cached-restaurants");
const resetButton = document.getElementById("reset-trial-data");
const resetFeedbackNode = document.getElementById("reset-feedback");

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
              <p class="card-meta">${item.created_at || "未知时间"} · 这条评价：${item.rating}</p>
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

async function fetchDashboard() {
  restaurantsNode.innerHTML = `<article class="restaurant-card loading-card"><div class="skeleton skeleton-line short"></div><div class="skeleton skeleton-line long"></div></article>`;
  reviewsNode.innerHTML = `<article class="restaurant-card loading-card"><div class="skeleton skeleton-line short"></div><div class="skeleton skeleton-line long"></div></article>`;
  cachedRestaurantsNode.innerHTML = `<article class="restaurant-card loading-card"><div class="skeleton skeleton-line short"></div><div class="skeleton skeleton-line long"></div></article>`;

  try {
    const response = await fetch("/api/admin/dashboard");
    if (!response.ok) throw new Error("request_failed");
    const data = await response.json();
    renderRestaurantList(data.imported_restaurants);
    renderReviewList(data.recent_reviews);
    renderCachedRestaurantList(data.cached_restaurants);
  } catch (error) {
    restaurantsNode.innerHTML = `<article class="restaurant-card empty-state"><p class="risk">后台数据加载失败。</p></article>`;
    reviewsNode.innerHTML = `<article class="restaurant-card empty-state"><p class="risk">后台数据加载失败。</p></article>`;
    cachedRestaurantsNode.innerHTML = `<article class="restaurant-card empty-state"><p class="risk">后台数据加载失败。</p></article>`;
  }
}

async function resetTrialData() {
  if (!resetButton) return;

  const confirmed = window.confirm(
    "确认清空当前试运行数据吗？这会删除历史导入评价和餐厅缓存。"
  );
  if (!confirmed) return;

  resetButton.disabled = true;
  resetFeedbackNode.textContent = "正在清空试运行数据...";

  try {
    const response = await fetch("/api/admin/reset-data", { method: "POST" });
    if (!response.ok) throw new Error("reset_failed");
    const data = await response.json();
    resetFeedbackNode.textContent = `${data.message} 已清空 ${data.cleared_reviews} 条评价和 ${data.cleared_restaurants} 条餐厅缓存。`;
    await fetchDashboard();
  } catch (error) {
    resetFeedbackNode.textContent = "清空失败，请稍后重试。";
  } finally {
    resetButton.disabled = false;
  }
}

if (resetButton) {
  resetButton.addEventListener("click", resetTrialData);
}

fetchDashboard();
