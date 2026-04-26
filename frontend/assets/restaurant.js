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
const feedbackChipGroups = document.querySelectorAll('[data-group="feedback-rating"]');

const RATING_LABELS = {
  1: "不推荐",
  2: "一般般",
  3: "还行可吃",
  4: "挺推荐",
  5: "夯到拉完了",
};

function listMarkup(items, className = "reason-list") {
  return `<ul class="${className}">${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

function tagsMarkup(items, type = "tag") {
  return items.map((item) => `<span class="${type}">${item}</span>`).join("");
}

feedbackChipGroups.forEach((group) => {
  const chips = group.querySelectorAll(".chip");
  chips.forEach((chip) => {
    const input = chip.querySelector("input");
    input.addEventListener("change", () => {
      chips.forEach((item) => item.classList.remove("chip-active"));
      if (input.checked) chip.classList.add("chip-active");
    });
    chip.classList.toggle("chip-active", input.checked);
  });
});

function renderPublicReviews(items) {
  if (!items.length) {
    publicReviewsNode.innerHTML = `<article class="restaurant-card empty-state"><p class="card-meta">这家店还没有公开评论，你可以写下第一条。</p></article>`;
    return;
  }

  publicReviewsNode.innerHTML = items
    .map(
      (item) => `
        <article class="restaurant-card">
          <div class="card-top">
            <div class="card-title-wrap">
              <h3>匿名同学</h3>
              <p class="card-meta">${item.created_at || "未知时间"} · 距今 ${item.days_ago} 天</p>
            </div>
            <div class="score-badge score-badge-soft">
              <span>这条评价</span>
              <strong style="font-size:1rem">${RATING_LABELS[item.rating] || "还行可吃"}</strong>
            </div>
          </div>
          <p>${item.content}</p>
        </article>
      `
    )
    .join("");
}

function renderDetail(data) {
  const backHref = backParams.toString() ? `/recommendations?${backParams.toString()}` : "/";
  const importHref = backParams.toString()
    ? `/review-import?id=${data.restaurant_id}&${backParams.toString()}`
    : `/review-import?id=${data.restaurant_id}`;

  hero.innerHTML = `
    <a class="ghost-link" href="${backHref}">返回榜单</a>
    <p class="eyebrow">Campus Comment Detail</p>
    <h1 class="detail-title">${data.name}</h1>
    <p class="hero-text">${data.category} · ${data.travel_text} · 人均 ${data.avg_price} 元 · ${data.business_hours}</p>
    <div class="headline-metrics">
      ${tagsMarkup(data.tags, "tag")}
      ${tagsMarkup(data.risk_flags, "risk")}
    </div>
    <div class="headline-metrics">
      <span class="filter-pill">当前数据来源：${data.review_source}</span>
      <span class="filter-pill">已收录评论：${data.review_count}</span>
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
          ${Object.entries(data.scene_fit)
            .map(([key, value]) => `<li>${key}：${value}</li>`)
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
    const response = await fetch(`/api/restaurants/${restaurantId}`);
    if (!response.ok) throw new Error("request_failed");
    const data = await response.json();
    renderDetail(data);
  } catch (error) {
    statusNode.textContent = "店铺详情加载失败，请返回重试。";
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
