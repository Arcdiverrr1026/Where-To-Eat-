import { config } from "./config.js";
import { HttpError } from "./http.js";
export const amapRequest = async (path, params) => {
  if (!config.amapKey)
    throw new HttpError(
      503,
      "MAP_NOT_CONFIGURED",
      "暂时无法搜索：尚未配置高德地图服务，请联系维护者",
    );
  const url = new URL(config.amapBaseUrl.replace(/\/$/, "") + path);
  url.search = new URLSearchParams({ ...params, key: config.amapKey });
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(config.mapTimeout),
    });
    if (!response.ok) throw new Error("upstream");
    const data = await response.json();
    if (data.status !== "1") throw new Error("provider rejected request");
    return data;
  } catch (error) {
    if (error.name === "TimeoutError")
      throw new HttpError(504, "MAP_TIMEOUT", "地图服务响应超时，请稍后重试");
    throw new HttpError(
      502,
      "MAP_UNAVAILABLE",
      "地图服务暂时不可用，请稍后重试或联系维护者检查配置",
    );
  }
};
export const geocode = async (address) => {
  const data = await amapRequest("/v3/geocode/geo", { address });
  const place = data.geocodes?.[0];
  if (!place)
    throw new HttpError(
      404,
      "LOCATION_NOT_FOUND",
      "未找到这个位置，请输入更完整的城市和地点",
    );
  const [lng, lat] = String(place.location).split(",").map(Number);
  if (!Number.isFinite(lng) || !Number.isFinite(lat))
    throw new HttpError(502, "MAP_UNAVAILABLE", "地图服务返回的位置无效");
  return { lng, lat, label: place.formatted_address || address };
};
const field = (value) => {
  return typeof value === "string" ? value : "";
};
export const nearby = async ({ lng, lat, radius, keyword }) => {
  const data = await amapRequest("/v5/place/around", {
    location: `${lng.toFixed(6)},${lat.toFixed(6)}`,
    radius,
    keywords: keyword,
    types: "050000",
    page_size: 25,
    page_num: 1,
    sortrule: "distance",
    show_fields: "business",
  });
  if (!Array.isArray(data.pois))
    throw new HttpError(502, "MAP_UNAVAILABLE", "地图服务返回了无效的餐厅列表");
  const seen = new Set();
  return data.pois.flatMap((poi) => {
    const [lng, lat] = field(poi.location).split(",").map(Number);
    const sourceId = field(poi.id);
    const name = field(poi.name);
    if (
      !sourceId ||
      !name ||
      seen.has(sourceId) ||
      !Number.isFinite(lng) ||
      !Number.isFinite(lat) ||
      Math.abs(lng) > 180 ||
      Math.abs(lat) > 90
    )
      return [];
    seen.add(sourceId);
    const rawCost = field(poi.business?.cost).trim();
    const cost = Number(rawCost);
    return [
      {
        sourceId,
        name,
        address: field(poi.address),
        category: field(poi.type).split(";").slice(1).join(" · "),
        lng,
        lat,
        price:
          rawCost && Number.isFinite(cost) && cost > 0 && cost < 1e8
            ? cost
            : null,
        hours:
          field(poi.business?.opentime_today) ||
          field(poi.business?.opentime_week),
        phone: field(poi.business?.tel),
      },
    ];
  });
};
