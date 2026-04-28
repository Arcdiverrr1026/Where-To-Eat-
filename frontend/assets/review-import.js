const importParams = new URLSearchParams(window.location.search);
const importForm = document.getElementById("import-form");
const restaurantIdInput = document.getElementById("restaurant-id");
const contentInput = document.getElementById("review-content");
const reviewFileInput = document.getElementById("review-file");
const resultNode = document.getElementById("import-result");
const detailLink = document.getElementById("import-detail-link");
const backLink = document.getElementById("import-back-link");
const useSampleButton = document.getElementById("use-sample");
const formatInputs = document.querySelectorAll('input[name="format"]');
const modeInputs = document.querySelectorAll('input[name="mode"]');

const jsonSample = `[
  { "rating": 5, "content": "羊肉串很香，分量足，适合宿舍聚餐", "days_ago": 1 },
  { "rating": 2, "content": "高峰排队久，出餐慢", "days_ago": 3 }
]`;

const csvSample = `rating,content,days_ago
5,红烧肉下饭，价格友好,1
4,适合一个人吃，出餐快,2
2,中午排队明显,4`;

function activeFormat() {
  return document.querySelector('input[name="format"]:checked')?.value || "json";
}

function activeMode() {
  return document.querySelector('input[name="mode"]:checked')?.value || "append";
}

function syncLinks() {
  const restaurantId = restaurantIdInput.value.trim();
  detailLink.href = restaurantId ? `/restaurant-view?id=${safeUrlParam(restaurantId)}` : "/";
  backLink.href = restaurantId ? `/restaurant-view?id=${safeUrlParam(restaurantId)}` : "/";
}



function loadSample() {
  contentInput.value = activeFormat() === "json" ? jsonSample : csvSample;
}

function setActiveFormat(nextFormat) {
  formatInputs.forEach((input) => {
    input.checked = input.value === nextFormat;
  });
  syncChipVisuals();
}

async function loadFileContent(file) {
  const text = await file.text();
  const loweredName = file.name.toLowerCase();

  if (loweredName.endsWith(".csv")) {
    setActiveFormat("csv");
  } else if (loweredName.endsWith(".json")) {
    setActiveFormat("json");
  }

  contentInput.value = text;
  resultNode.innerHTML = `<p class="card-meta">已载入文件：${escapeHtml(file.name)}</p>`;
}

function renderResult(data) {
  resultNode.innerHTML = `
    <div class="detail-block" style="padding:0;border:none;background:none">
      <div class="tag-row">
        <span class="tag">review_source: ${escapeHtml(data.review_source)}</span>
        <span class="tag">imported_count: ${escapeHtml(data.imported_count)}</span>
        <span class="tag">mode: ${escapeHtml(data.import_mode)}</span>
      </div>
      <p style="margin-top:16px">店铺 ID：${escapeHtml(data.restaurant_id)}</p>
      <p>示例评论：${escapeHtml(data.sample_review || "无")}</p>
      <div class="import-actions" style="margin-top:18px">
        <a class="secondary-button" href="/restaurant-view?id=${safeUrlParam(data.restaurant_id)}">查看更新后的详情</a>
        <a class="secondary-button" href="/admin">打开后台管理</a>
      </div>
    </div>
  `;
}

restaurantIdInput.value = importParams.get("id") || "";
syncLinks();
initChipGroups();
syncChipVisuals();

formatInputs.forEach((input) => {
  input.addEventListener("change", () => {
    syncChipVisuals();
    if (!contentInput.value.trim()) {
      loadSample();
    }
  });
});

modeInputs.forEach((input) => {
  input.addEventListener("change", syncChipVisuals);
});

restaurantIdInput.addEventListener("input", syncLinks);
useSampleButton.addEventListener("click", loadSample);
reviewFileInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    await loadFileContent(file);
  } catch (error) {
    resultNode.innerHTML = `<p class="risk">读取文件失败：${escapeHtml(error.message)}</p>`;
  }
});

importForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  syncLinks();

  const payload = {
    restaurant_id: restaurantIdInput.value.trim(),
    format: activeFormat(),
    mode: activeMode(),
    content: contentInput.value,
  };

  resultNode.innerHTML = `
    <div class="status-line">正在导入评论并刷新页面概况...</div>
    <div class="skeleton skeleton-line mid" style="margin-top:12px"></div>
    <div class="skeleton skeleton-line long" style="margin-top:12px"></div>
  `;

  try {
    const response = await fetch("/api/reviews/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || "导入失败");
    }
    renderResult(data);
  } catch (error) {
    resultNode.innerHTML = `<p class="risk">导入失败：${escapeHtml(error.message)}</p>`;
  }
});

if (!contentInput.value) {
  loadSample();
}
