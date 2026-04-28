const detailParams = new URLSearchParams(window.location.search);
const restaurantId = detailParams.get("id");
const backParams = new URLSearchParams(detailParams);
backParams.delete("id");
const hero = document.getElementById("detail-hero");
const grid = document.getElementById("detail-grid");
const statusNode = document.getElementById("detail-status");
const feedbackForm = document.getElementById("feedback-form");
const feedbackContent = document.getElementById("feedback-content");
const feedbackResult = document.getElementById("feedback-result");
const feedbackSubmit = document.getElementById("feedback-submit");
const publicReviewsNode = document.getElementById("public-reviews");

initChipGroups('[data-group="feedback-rating"]');
syncChipVisuals('[data-group="feedback-rating"]');

const RATING_LABELS = {
  1: "不推荐",
  2: "一般般",
  3: "还行可吃",
  4: "挺推荐",
  5: "夯到拉完了",
};

function listMarkup(items, className = "reason-list") {
  const safeItems = Array.isArray(items) ? items : [];
  return `<ul class="${className}">${safeItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function tagsMarkup(items, type = "tag") {
  return renderPills(items, type);
}

function renderPublicReviews(items) {
  const safeItems = Array.isArray(items) ? items : [];
  if (!safeItems.length) {
    publicReviewsNode.innerHTML = `<article class="restaurant-card empty-state"><p class="card-meta">这家店还没有公开评论，你可以写下第一条。</p></article>`;
    return;
  }

  publicReviewsNode.innerHTML = safeItems
    .map(
      (item) => `
        <article class="restaurant-card">
          <div class="card-top">
            <div class="card-title-wrap">
              <h3>匿名同学</h3>
              <p class="card-meta">${escapeHtml(item.created_at || "未知时间")} · 距今 ${escapeHtml(item.days_ago)} 天</p>
            </div>
            <div class="score-badge score-badge-soft">
              <span>这条评价</span>
              <strong style="font-size:1rem">${escapeHtml(RATING_LABELS[item.rating] || "还行可吃")}</strong>
            </div>
          </div>
          <p>${escapeHtml(item.content)}</p>
        </article>
      `
    )
    .join("");
}

function renderDetail(data) {
  const backHref = backParams.toString() ? `/recommendations?${backParams.toString()}` : "/";
  const importHref = backParams.toString()
    ? `/review-import?id=${safeUrlParam(data.restaurant_id)}&${backParams.toString()}`
    : `/review-import?id=${safeUrlParam(data.restaurant_id)}`;

  hero.innerHTML = `
    <a class="ghost-link" href="${backHref}">返回榜单</a>
    <p class="eyebrow">Campus Comment Detail</p>
    <h1 class="detail-title">${escapeHtml(data.name)}</h1>
    <p class="hero-text">${escapeHtml(data.category)} · ${escapeHtml(data.travel_text)} · ${escapeHtml(data.price_text)} · ${escapeHtml(data.business_hours)}</p>
    <div class="headline-metrics">
      ${tagsMarkup(data.tags, "tag")}
      ${tagsMarkup(data.risk_flags, "risk")}
    </div>
    <div class="headline-metrics">
      <span class="filter-pill">当前数据来源：${escapeHtml(data.review_source)}</span>
      <span class="filter-pill">已收录评论：${escapeHtml(data.review_count)}</span>
      <span class="filter-pill">${escapeHtml(data.price_source)}</span>
      <a class="ghost-action" href="${importHref}">批量导入历史评论</a>
    </div>
  `;

  grid.innerHTML = `
    <div class="detail-column">
      <section class="detail-block">
        <p class="eyebrow">Store Snapshot</p>
        <h2>最近评论里大概在说什么</h2>
        ${listMarkup(data.comment_overview)}
      </section>

      <section class="detail-block">
        <p class="eyebrow">Keywords</p>
        <h2>评论里常被提到的点</h2>
        <div class="tag-row">${tagsMarkup(data.highlighted_items, "tag")}</div>
        <div class="tag-row" style="margin-top:12px">${tagsMarkup(data.caution_items, "risk")}</div>
      </section>
    </div>

    <div class="detail-column">
      <section class="detail-block">
        <p class="eyebrow">Why People Go</p>
        <h2>评论里常提到的亮点</h2>
        ${listMarkup(data.comment_highlights)}
      </section>

      <section class="detail-block">
        <p class="eyebrow">Watch Out</p>
        <h2>评论里常提醒的地方</h2>
        ${listMarkup(data.caution_notes)}
      </section>

      <section class="detail-block">
        <p class="eyebrow">Scene Fit</p>
          <h2>适合什么场景</h2>
          <ul class="kv-list">
          ${Object.entries(data.scene_fit || {})
            .map(([key, value]) => `<li>${escapeHtml(key)}：${escapeHtml(value)}</li>`)
            .join("")}
        </ul>
      </section>
    </div>
  `;

  renderPublicReviews(data.reviews);
}

async function fetchDetail() {
  if (!restaurantId) {
    statusNode.textContent = "缺少店铺 ID。";
    return;
  }

  grid.innerHTML = `
    <div class="detail-column">
      <section class="detail-block">
        <div class="skeleton skeleton-line short"></div>
        <div class="skeleton skeleton-line long" style="margin-top:12px"></div>
        <div class="skeleton skeleton-line long" style="margin-top:12px"></div>
      </section>
    </div>
    <div class="detail-column">
      <section class="detail-block">
        <div class="skeleton skeleton-line short"></div>
        <div class="skeleton skeleton-line mid" style="margin-top:12px"></div>
        <div class="skeleton skeleton-line long" style="margin-top:12px"></div>
      </section>
    </div>
  `;

  try {
    const response = await fetch(`/api/restaurants/${safeUrlParam(restaurantId)}`);
    if (response.status === 404) {
      throw new Error("not_found");
    }
    if (!response.ok) throw new Error("request_failed");
    const data = await response.json();
    renderDetail(data);
  } catch (error) {
    statusNode.textContent = error.message === "not_found"
      ? "找不到这家店铺。请先从推荐榜单打开店铺，或确认店铺 ID 是否正确。"
      : "店铺详情加载失败，请返回重试。";
  }
}

feedbackForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!restaurantId || feedbackSubmit.disabled) return;

  const rating = Number(
    feedbackForm.querySelector('input[name="rating"]:checked')?.value || 3
  );
  const content = feedbackContent.value.trim();
  if (!content) {
    feedbackResult.textContent = "请先写点内容。";
    feedbackResult.classList.add("risk");
    return;
  }

  feedbackSubmit.disabled = true;
  feedbackSubmit.textContent = "正在提交...";
  feedbackResult.textContent = "正在发布评论...";
  feedbackResult.classList.remove("risk");

  try {
    const response = await fetch("/api/reviews/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurant_id: restaurantId,
        rating,
        content,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || "提交失败");
    }
    feedbackContent.value = "";
    feedbackResult.textContent = `发布成功，现在这家店已有 ${data.review_count} 条公开评论。`;
    await fetchDetail();
  } catch (error) {
    feedbackResult.textContent = `提交失败：${error.message}`;
    feedbackResult.classList.add("risk");
  } finally {
    feedbackSubmit.disabled = false;
    feedbackSubmit.textContent = "发布评论";
  }
});

fetchDetail();
