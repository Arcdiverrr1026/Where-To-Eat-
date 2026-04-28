/**
 * Shared utilities for the Where To Eat frontend.
 * Include this script before page-specific scripts.
 */

/**
 * Initialize chip-group radio buttons: wire up change listeners that
 * toggle the "chip-active" class when the underlying <input> is checked.
 * @param {string} [selector="[data-group]"] — CSS selector for chip group containers
 */
function initChipGroups(selector) {
  var scope = selector || "[data-group]";
  document.querySelectorAll(scope).forEach(function (group) {
    var chips = group.querySelectorAll(".chip");
    chips.forEach(function (chip) {
      var input = chip.querySelector("input");
      if (!input) return;
      input.addEventListener("change", function () {
        chips.forEach(function (item) { item.classList.remove("chip-active"); });
        if (input.checked) chip.classList.add("chip-active");
      });
    });
  });
}

/**
 * Re-sync "chip-active" classes with current <input> checked state.
 * Useful after programmatically changing radio values.
 * @param {string} [selector="[data-group]"] — CSS selector for chip group containers
 */
function syncChipVisuals(selector) {
  var scope = selector || "[data-group]";
  document.querySelectorAll(scope).forEach(function (group) {
    var chips = group.querySelectorAll(".chip");
    chips.forEach(function (chip) {
      var input = chip.querySelector("input");
      if (!input) return;
      chip.classList.toggle("chip-active", input.checked);
    });
  });
}

/**
 * Escape dynamic text before it is placed into HTML templates.
 * This keeps stored user comments and external POI fields from becoming HTML.
 * @param {unknown} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, function (char) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char];
  });
}

function safeUrlParam(value) {
  return encodeURIComponent(String(value ?? ""));
}

function renderPills(items, className) {
  var safeItems = Array.isArray(items) ? items : [];
  return safeItems
    .map(function (item) {
      return '<span class="' + className + '">' + escapeHtml(item) + "</span>";
    })
    .join("");
}

/**
 * Build the standard recommendation API request payload from URL search params.
 * Shared by the recommendations page and the map page.
 *
 * NOTE: The default fallback values here match the home page form defaults.
 * @param {URLSearchParams} params
 * @returns {object}
 */
function buildRecommendPayload(params) {
  return {
    location: {
      lat: Number(params.get("lat") || 31.2304),
      lng: Number(params.get("lng") || 121.4737),
    },
    category: params.get("category") || "烧烤",
    budget: params.get("budget") || "50以内",
    distance: params.get("distance") || "步行10分钟内",
    scene: params.get("scene") || "宿舍聚餐",
  };
}

// ---------------------------------------------------------------------------
// WGS-84  →  GCJ-02 (火星坐标) coordinate conversion
//
// Browser navigator.geolocation returns WGS-84 (GPS standard).
// AMap (高德) search API and JS map SDK both use GCJ-02.
// Without conversion the user marker / search centre drifts 100-600 m.
// ---------------------------------------------------------------------------

var _GCJ_A  = 6378245.0;
var _GCJ_EE = 0.00669342162296594323;

function _outOfChina(lng, lat) {
  return !(72.004 <= lng && lng <= 137.8347 && 0.8293 <= lat && lat <= 55.8271);
}

function _transformLat(x, y) {
  var r = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  r += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
  r += (20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin(y / 3.0 * Math.PI)) * 2.0 / 3.0;
  r += (160.0 * Math.sin(y / 12.0 * Math.PI) + 320.0 * Math.sin(y * Math.PI / 30.0)) * 2.0 / 3.0;
  return r;
}

function _transformLng(x, y) {
  var r = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  r += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
  r += (20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin(x / 3.0 * Math.PI)) * 2.0 / 3.0;
  r += (150.0 * Math.sin(x / 12.0 * Math.PI) + 300.0 * Math.sin(x / 30.0 * Math.PI)) * 2.0 / 3.0;
  return r;
}

/**
 * Convert a WGS-84 coordinate pair to GCJ-02 (火星坐标).
 * Returns { lat, lng } in GCJ-02.  Coordinates outside mainland China
 * are returned as-is (no offset applies).
 */
function wgs84ToGcj02(lng, lat) {
  if (_outOfChina(lng, lat)) return { lng: lng, lat: lat };

  var dx = _transformLng(lng - 105.0, lat - 35.0);
  var dy = _transformLat(lng - 105.0, lat - 35.0);
  var radLat = lat / 180.0 * Math.PI;
  var magic  = Math.sin(radLat);
  magic = 1 - _GCJ_EE * magic * magic;
  var sqrtMagic = Math.sqrt(magic);
  dx = (dx * 180.0) / (_GCJ_A / sqrtMagic * Math.cos(radLat) * Math.PI);
  dy = (dy * 180.0) / ((_GCJ_A * (1 - _GCJ_EE)) / (magic * sqrtMagic) * Math.PI);
  return { lng: lng + dx, lat: lat + dy };
}
