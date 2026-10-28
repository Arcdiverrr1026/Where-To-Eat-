export const priceLabel = (price) =>
  price === null ? "人均暂无" : `约 ¥${price} / 人`;
export const dateLabel = (value) => new Date(value).toLocaleDateString("zh-CN");
export const mapLink = (r) =>
  `https://uri.amap.com/marker?position=${r.lng},${r.lat}&name=${encodeURIComponent(r.name)}&coordinate=gaode&callnative=0`;
