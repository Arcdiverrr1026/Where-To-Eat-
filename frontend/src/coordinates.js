export function wgs84ToGcj02(lng, lat) {
  if (!(72.004 <= lng && lng <= 137.8347 && 0.8293 <= lat && lat <= 55.8271)) return { lng, lat };
  const longitudeOffset = lng - 105;
  const latitudeOffset = lat - 35;
  const pi = Math.PI;
  const common = (20 * Math.sin(6 * longitudeOffset * pi) + 20 * Math.sin(2 * longitudeOffset * pi)) * 2 / 3;
  let latitudeDelta = -100 + 2 * longitudeOffset + 3 * latitudeOffset + 0.2 * latitudeOffset ** 2
    + 0.1 * longitudeOffset * latitudeOffset + 0.2 * Math.sqrt(Math.abs(longitudeOffset)) + common;
  latitudeDelta += (20 * Math.sin(latitudeOffset * pi) + 40 * Math.sin(latitudeOffset / 3 * pi)) * 2 / 3;
  latitudeDelta += (160 * Math.sin(latitudeOffset / 12 * pi) + 320 * Math.sin(latitudeOffset * pi / 30)) * 2 / 3;
  let longitudeDelta = 300 + longitudeOffset + 2 * latitudeOffset + 0.1 * longitudeOffset ** 2
    + 0.1 * longitudeOffset * latitudeOffset + 0.1 * Math.sqrt(Math.abs(longitudeOffset)) + common;
  longitudeDelta += (20 * Math.sin(longitudeOffset * pi) + 40 * Math.sin(longitudeOffset / 3 * pi)) * 2 / 3;
  longitudeDelta += (150 * Math.sin(longitudeOffset / 12 * pi) + 300 * Math.sin(longitudeOffset / 30 * pi)) * 2 / 3;
  const radians = lat / 180 * pi;
  const eccentricity = 0.00669342162296594323;
  const magic = 1 - eccentricity * Math.sin(radians) ** 2;
  const root = Math.sqrt(magic);
  return {
    lng: lng + longitudeDelta * 180 / (6378245 / root * Math.cos(radians) * pi),
    lat: lat + latitudeDelta * 180 / ((6378245 * (1 - eccentricity)) / (magic * root) * pi),
  };
}
