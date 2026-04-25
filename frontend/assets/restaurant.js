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
const feedbackChipGroups = document.querySelectorAll('[data-group="feedback-rating"]');

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

function renderDetail(data) {
  const backHref = backParams.toString() ? `/recommendations?${backParams.toString()}` : "/";
  const importHref = backParams.toString()
    ? `/review-import?id=${data.restaurant_id}&${backParams.toString()}`
    : `/review-import?id=${data.restaurant_id}`;

  hero.innerHTML = `
    <a class="ghost-link" href="${backHref}">返回榜单</a>
    <p class="eyebrow">Campus Review Detail</p>
    <h1 class="detail-title">${data.name}</h1>
    <p class="hero-text">${data.category} · ${data.distance_text} · 人均 ${data.avg_price} 元 · ${data.business_hours}</p>
    <div class="headline-metrics">
      ${tagsMarkup(data.tags, "tag")}
      ${tagsMarkup(data.risk_flags, "risk")}
    </div>
    <div class="headline-metrics">
      <span class="filter-pill">当前评论来源：${data.review_source}</span>
      <span class="filter-pill">已收录评价：${data.review_count}</span>
      <a class="ghost-action" href="${importHref}">批量导入历史评论</a>
    </div>
  `;

  grid.innerHTML = `
    <div class="detail-column">
      <section class="detail-block">
        <p class="eyebrow">Score Breakdown</p>
        <h2>评分拆解</h2>
        <div class="score-grid">
          <div class="score-tile"><span>近期口碑分</span><strong>${data.scores.reputation}</strong><small>反映最近评论整体正负面和口味趋势。</small></div>
          <div class="score-tile"><span>真实性分</span><strong>${data.scores.authenticity}</strong><small>用于提示模板化评论和异常集中评价风险。</small></div>
          <div class="score-tile"><span>学生适配分</span><strong>${data.scores.student_fit}</strong><small>结合预算、距离和场景判断是否适合学生去。</small></div>
          <div class="score-tile"><span>稳定性分</span><strong>${data.scores.stability}</strong><small>关注高峰期翻车概率和体验波动。</small></div>
        </div>
      </section>

      <section class="detail-block">
        <p class="eyebrow">Recent Review</p>
        <h2>最近同学怎么说</h2>
        ${listMarkup(data.recent_review_summary)}
      </section>

      <section class="detail-block">
        <p class="eyebrow">Signals</p>
        <h2>菜品与风险点</h2>
        <div class="tag-row">${tagsMarkup(data.popular_dishes, "tag")}</div>
        <div class="tag-row" style="margin-top:12px">${tagsMarkup(data.common_negatives, "risk")}</div>
      </section>
    </div>

    <div class="detail-column">
      <section class="detail-block">
        <p class="eyebrow">Why Go</p>
        <h2>同学为什么还愿意推荐</h2>
        ${listMarkup(data.recommend_reasons)}
      </section>

      <section class="detail-block">
        <p class="eyebrow">Be Careful</p>
        <h2>同学最近提醒的雷点</h2>
        ${listMarkup(data.warning_points)}
      </section>

      <section class="detail-block">
        <p class="eyebrow">Scene Fit</p>
        <h2>场景匹配</h2>
        <ul class="kv-list">
          ${Object.entries(data.scene_fit)
            .map(([key, value]) => `<li>${key}：${value}</li>`)
            .join("")}
        </ul>
      </section>
    </div>
  `;
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
    feedbackResult.textContent = "请先填写你的真实评价。";
    feedbackResult.classList.add("risk");
    return;
  }

  feedbackSubmit.disabled = true;
  feedbackSubmit.textContent = "正在提交...";
  feedbackResult.textContent = "正在写入评价并重算分析...";
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
    feedbackResult.textContent = `提交成功，当前已纳入 ${data.review_count} 条真实评价。`;
    await fetchDetail();
  } catch (error) {
    feedbackResult.textContent = `提交失败：${error.message}`;
    feedbackResult.classList.add("risk");
  } finally {
    feedbackSubmit.disabled = false;
    feedbackSubmit.textContent = "提交真实评价";
  }
});

fetchDetail();
