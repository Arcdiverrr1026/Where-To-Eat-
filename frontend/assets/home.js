const pageParams = new URLSearchParams(window.location.search);
const latInput = document.getElementById("lat");
const lngInput = document.getElementById("lng");
const locationButton = document.getElementById("use-current-location");
const locationStatus = document.getElementById("location-status");
const searchForm = document.getElementById("search-form");
const startSearchButton = document.getElementById("start-search-button");
const SEARCH_STATE_KEY = "where_to_eat_search_state";

function setLocationStatus(message, isError = false) {
  locationStatus.textContent = message;
  locationStatus.classList.toggle("risk", isError);
}

function applyFormState(state) {
  if (!state) return;

  if (state.lat) latInput.value = state.lat;
  if (state.lng) lngInput.value = state.lng;

  [
    ["category", state.category],
    ["budget", state.budget],
    ["distance", state.distance],
    ["scene", state.scene],
  ].forEach(([name, value]) => {
    if (!value) return;
    const input = Array.from(document.querySelectorAll(`input[name="${name}"]`))
      .find((candidate) => candidate.value === value);
    if (input) input.checked = true;
  });
}



function getCurrentFormState() {
  return {
    lat: latInput.value,
    lng: lngInput.value,
    category: document.querySelector('input[name="category"]:checked')?.value || "",
    budget: document.querySelector('input[name="budget"]:checked')?.value || "",
    distance: document.querySelector('input[name="distance"]:checked')?.value || "",
    scene: document.querySelector('input[name="scene"]:checked')?.value || "",
  };
}

function persistFormState() {
  window.sessionStorage.setItem(SEARCH_STATE_KEY, JSON.stringify(getCurrentFormState()));
}

function resetSearchButton() {
  startSearchButton.disabled = false;
  startSearchButton.textContent = "开始推荐";
}

function restoreFormFromParams() {
  const stateFromParams = {
    lat: pageParams.get("lat") || "",
    lng: pageParams.get("lng") || "",
    category: pageParams.get("category") || "",
    budget: pageParams.get("budget") || "",
    distance: pageParams.get("distance") || "",
    scene: pageParams.get("scene") || "",
  };
  const hasParams = Object.values(stateFromParams).some(Boolean);

  if (hasParams) {
    applyFormState(stateFromParams);
    setLocationStatus("已恢复上一次搜索的位置和筛选条件。");
    persistFormState();
  } else {
    try {
      const cached = JSON.parse(window.sessionStorage.getItem(SEARCH_STATE_KEY) || "null");
      if (cached) {
        applyFormState(cached);
        setLocationStatus("已恢复本次会话中的定位和筛选条件。");
      }
    } catch {
      // Ignore invalid cached state and keep defaults.
    }
  }

  syncChipVisuals();
}

initChipGroups();
restoreFormFromParams();
resetSearchButton();

window.addEventListener("pageshow", () => {
  resetSearchButton();
});

locationButton.addEventListener("click", () => {
  if (!navigator.geolocation) {
    setLocationStatus("当前浏览器不支持定位，请手动填写经纬度。", true);
    return;
  }

  locationButton.disabled = true;
  setLocationStatus("正在获取当前位置...");

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const gcj = wgs84ToGcj02(position.coords.longitude, position.coords.latitude);
      latInput.value = gcj.lat.toFixed(6);
      lngInput.value = gcj.lng.toFixed(6);
      persistFormState();
      locationButton.disabled = false;
      setLocationStatus("已更新为当前定位坐标（已转换为高德坐标系）。");
    },
    (error) => {
      locationButton.disabled = false;

      if (error.code === error.PERMISSION_DENIED) {
        setLocationStatus("你拒绝了定位权限，请手动填写经纬度。", true);
        return;
      }

      if (error.code === error.POSITION_UNAVAILABLE) {
        setLocationStatus("当前无法获取定位结果，请稍后重试或手动填写。", true);
        return;
      }

      if (error.code === error.TIMEOUT) {
        setLocationStatus("定位超时，请重试或手动填写经纬度。", true);
        return;
      }

      setLocationStatus("定位失败，请手动填写经纬度。", true);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    }
  );
});

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (startSearchButton.disabled) return;

  const formData = new FormData(event.currentTarget);
  const params = new URLSearchParams();

  ["lat", "lng", "category", "budget", "distance", "scene"].forEach((key) => {
    params.set(key, formData.get(key));
  });

  persistFormState();
  startSearchButton.disabled = true;
  startSearchButton.textContent = "正在获取推荐...";
  window.location.href = `/recommendations?${params.toString()}`;
});
