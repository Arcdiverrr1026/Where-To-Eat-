// Distances belong to a search, never to the persisted restaurant.
export const distanceMeters = (origin, destination) => {
  const rad = (value) => (value * Math.PI) / 180;
  const dLat = rad(destination.lat - origin.lat);
  const dLng = rad(destination.lng - origin.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(origin.lat)) *
      Math.cos(rad(destination.lat)) *
      Math.sin(dLng / 2) ** 2;
  return Math.round(
    6371000 *
      2 *
      Math.atan2(Math.sqrt(Math.min(1, a)), Math.sqrt(Math.max(0, 1 - a))),
  );
};
export const recommend = (restaurants, options) => {
  return restaurants
    .flatMap((restaurant) => {
      const distance = distanceMeters(options, restaurant);
      if (
        distance > options.radius ||
        (options.budget !== null &&
          (restaurant.price === null || restaurant.price > options.budget))
      )
        return [];
      const proximity = 80 * Math.max(0, 1 - distance / options.radius);
      const reviews =
        restaurant.reviewCount >= 3 ? (20 * restaurant.averageRating) / 5 : 0;
      const reasons = [
        `直线距离约 ${distance < 1000 ? `${distance} 米` : `${(distance / 1000).toFixed(1)} 公里`}`,
      ];
      if (options.budget !== null)
        reasons.push(`地图人均 ¥${restaurant.price}，符合预算`);
      if (options.keyword) reasons.push(`符合「${options.keyword}」搜索条件`);
      if (restaurant.reviewCount >= 3)
        reasons.push(
          `本站 ${restaurant.reviewCount} 条评价，均分 ${restaurant.averageRating.toFixed(1)}`,
        );
      else reasons.push("本站评价不足 3 条，暂不参与排序");
      return [
        {
          ...restaurant,
          distance,
          reasons,
          score: Math.round((proximity + reviews) * 100) / 100,
          scoreBreakdown: {
            proximity: Math.round(proximity * 100) / 100,
            reviews: Math.round(reviews * 100) / 100,
          },
        },
      ];
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.distance - b.distance ||
        a.sourceId.localeCompare(b.sourceId),
    );
};
